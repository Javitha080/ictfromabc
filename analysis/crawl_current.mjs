#!/usr/bin/env node
/**
 * crawl_current.mjs — public GET-only crawler for ictfromabc.com
 *
 * Scope: https://ictfromabc.com same-origin page shells + /_app/immutable JS modules.
 * No auth, no cookies, no POST. 2 concurrent requests, 150 ms global pacing,
 * 30 s timeout, one retry on network/5xx/429.
 *
 * Outputs:
 *   js/current/_app/immutable/...        downloaded JS modules
 *   analysis/crawl_current_log.json      per-request status/size/failure log
 *   analysis/route_nodes_current.json    route -> node ids / modules / direct imports
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const JS_ROOT = path.join(ROOT, 'js', 'current');
const LOG_PATH = path.join(HERE, 'crawl_current_log.json');
const ROUTE_PATH = path.join(HERE, 'route_nodes_current.json');

const ORIGIN = 'https://ictfromabc.com';
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const CONCURRENCY = 2;
const DELAY_MS = 150;
const TIMEOUT_MS = 30_000;
const MODULE_CAP = 400;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------------------------------------------------------------- pacing */

let nextRequestAt = 0;
async function pace() {
  const now = Date.now();
  const slot = Math.max(now, nextRequestAt);
  nextRequestAt = slot + DELAY_MS;
  const wait = slot - now;
  if (wait > 0) await sleep(wait);
}

async function fetchOnce(url, accept) {
  const res = await fetch(url, {
    method: 'GET',
    redirect: 'follow',
    headers: {
      'User-Agent': UA,
      Accept: accept,
      'Accept-Language': 'en-US,en;q=0.9',
      'Cache-Control': 'no-cache',
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const buf = Buffer.from(await res.arrayBuffer());
  return {
    status: res.status,
    finalUrl: res.url,
    contentType: res.headers.get('content-type') || '',
    buf,
  };
}

/** One retry on network error, 429 or 5xx. No retry on 403/404. */
async function politeFetch(url, accept) {
  const attempts = [];
  for (let attempt = 1; attempt <= 2; attempt++) {
    await pace();
    const started = Date.now();
    try {
      const r = await fetchOnce(url, accept);
      attempts.push({ attempt, status: r.status, ms: Date.now() - started });
      const retryable = r.status === 429 || r.status >= 500;
      if (retryable && attempt === 1) {
        await sleep(500);
        continue;
      }
      return { ...r, attempts };
    } catch (err) {
      attempts.push({
        attempt,
        error: String(err && err.message ? err.message : err),
        ms: Date.now() - started,
      });
      if (attempt === 2) return { error: String(err), attempts };
      await sleep(500);
    }
  }
  return { error: 'unreachable', attempts };
}

async function mapPool(items, worker, concurrency = CONCURRENCY) {
  let cursor = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const idx = cursor++;
      if (idx >= items.length) return;
      await worker(items[idx], idx);
    }
  });
  await Promise.all(runners);
}

/* -------------------------------------------------------------- seed routes */

function isAssetPath(p) {
  return /\.(?:js|mjs|css|map|png|jpe?g|gif|svg|webp|ico|woff2?|ttf|otf|eot|mp4|webm|pdf|zip|csv|json|txt|xml)$/i.test(
    p
  );
}

function normalizeRoute(p) {
  if (!p) return null;
  let s = String(p).trim();
  if (!s) return null;
  if (s.startsWith('http://') || s.startsWith('https://')) {
    let u;
    try {
      u = new URL(s);
    } catch {
      return null;
    }
    if (u.protocol !== 'https:') return null;
    if (!['ictfromabc.com', 'www.ictfromabc.com'].includes(u.hostname)) return null;
    s = u.pathname;
  }
  s = s.split('?')[0].split('#')[0];
  if (!s.startsWith('/')) return null;
  if (s.startsWith('//')) return null;
  if (s.startsWith('/_app/') || s.startsWith('/storage/') || s.startsWith('/api/')) return null;
  if (s === '/api' || s === '/storage') return null;
  if (s.includes('${') || s.includes('$') || s.includes('*') || s.includes(':')) return null;
  if (isAssetPath(s)) return null;
  if (s.length > 300) return null;
  // collapse duplicate slashes, strip trailing slash except root
  s = s.replace(/\/{2,}/g, '/');
  if (s.length > 1 && s.endsWith('/')) s = s.slice(0, -1);
  return s;
}

async function readLines(file) {
  try {
    const raw = await fs.readFile(file, 'utf8');
    return raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

async function buildSeedRoutes() {
  const fromRoutes = (await readLines(path.join(ROOT, 'routes_pages.txt'))).map(normalizeRoute);
  const fromEndpoints = (await readLines(path.join(ROOT, 'endpoints.txt'))).map(normalizeRoute);
  const seeds = new Set(['/auth/login']);
  for (const r of [...fromRoutes, ...fromEndpoints]) if (r) seeds.add(r);
  // Do not crawl the SPA root fallback for every unknown; keep deduped set.
  return [...seeds].sort();
}

/* ------------------------------------------------------------- extraction */

function extractHtmlInfo(html, pageUrl) {
  const modules = new Set();
  const assets = new Set();

  // Covers ../_app/..., ./_app/..., /_app/..., bare _app/... and quoted forms.
  const assetRe = /(?:\.\.\/|\.\/|\/)?_app\/immutable\/[A-Za-z0-9._\-/]+/g;
  for (const m of html.matchAll(assetRe)) {
    let s = m[0];
    if (s.startsWith('../')) s = s.slice(2);
    if (s.startsWith('./')) s = s.slice(1);
    if (!s.startsWith('/')) s = '/' + s;
    const abs = new URL(s, pageUrl).href;
    if (!abs.startsWith(ORIGIN + '/_app/immutable/')) continue;
    if (abs.endsWith('.js')) modules.add(new URL(abs).pathname);
    else assets.add(new URL(abs).pathname);
  }

  const ids = html.match(/node_ids\s*:\s*\[([^\]]*)\]/);
  const nodeIds = ids
    ? ids[1]
        .split(',')
        .map((x) => x.trim())
        .filter((x) => /^\d+$/.test(x))
        .map(Number)
    : [];
  const kitVar = (html.match(/__sveltekit_[A-Za-z0-9]+/) || [null])[0];
  const dataMatch = html.match(/\bdata\s*:\s*(\[[^\]]*\])/);
  const dataSnippet = dataMatch ? dataMatch[1].slice(0, 800) : null;

  return { modules: [...modules], assets: [...assets], nodeIds, kitVar, dataSnippet };
}

function extractImports(src, moduleUrl) {
  const found = new Set();
  const push = (spec) => {
    if (!spec) return;
    if (/^(?:https?:)?\/\//i.test(spec)) return;
    if (!spec.startsWith('.') && !spec.startsWith('/')) return; // bare package import
    let abs;
    try {
      abs = new URL(spec, moduleUrl);
    } catch {
      return;
    }
    if (abs.origin !== ORIGIN) return;
    if (!abs.pathname.startsWith('/_app/immutable/')) return;
    if (!abs.pathname.endsWith('.js')) return;
    found.add(abs.pathname);
  };

  for (const re of [
    /\bfrom\s*["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
    /\bimport\s*["']([^"']+)["']/g,
  ]) {
    for (const m of src.matchAll(re)) push(m[1]);
  }
  return [...found];
}

/* -------------------------------------------------------------------- main */

const log = {
  startedAt: new Date().toISOString(),
  target: ORIGIN,
  userAgent: UA,
  policy: { methods: ['GET'], concurrency: CONCURRENCY, delayMs: DELAY_MS, timeoutMs: TIMEOUT_MS, moduleCap: MODULE_CAP },
  buildVersion: null,
  oldBuildVersionFromBlueprint: '1788800994930',
  html: [],
  assets: [],
  modules: [],
  failures: [],
  summary: {},
};

const routeNodes = {};
const importsByModule = {};
const moduleBuffers = new Map(); // pathname -> source text

async function fetchBuildVersion() {
  const r = await politeFetch(ORIGIN + '/_app/version.json', 'application/json');
  log.versionRequest = { status: r.status ?? null, size: r.buf?.length ?? 0, attempts: r.attempts, error: r.error ?? null };
  if (r.buf) {
    const txt = r.buf.toString('utf8');
    try {
      log.buildVersion = JSON.parse(txt).version ?? null;
    } catch {
      log.buildVersionRaw = txt.slice(0, 200);
    }
  }
}

async function crawlHtml(routes) {
  await mapPool(routes, async (route) => {
    const url = ORIGIN + route;
    const r = await politeFetch(url, 'text/html,application/xhtml+xml');
    const entry = {
      route,
      url,
      status: r.status ?? null,
      finalUrl: r.finalUrl ?? null,
      size: r.buf?.length ?? 0,
      contentType: r.contentType ?? null,
      attempts: r.attempts,
      error: r.error ?? null,
      nodeIds: [],
      sveltekit: null,
      modules: [],
      assets: [],
    };
    if (r.buf) {
      const protocol = (() => {
        try {
          return new URL(r.finalUrl).protocol;
        } catch {
          return null;
        }
      })();
      if (protocol === 'https:') {
        const info = extractHtmlInfo(r.buf.toString('utf8'), r.finalUrl);
        entry.nodeIds = info.nodeIds;
        entry.sveltekit = info.kitVar;
        entry.dataSnippet = info.dataSnippet;
        entry.modules = info.modules;
        entry.assets = info.assets;
        for (const a of info.assets) log.assets.push({ route, url: ORIGIN + a });
        routeNodes[route] = {
          status: entry.status,
          nodeIds: info.nodeIds,
          sveltekit: info.kitVar,
          htmlModules: info.modules,
          nodeModules: info.modules.filter((m) => m.includes('/nodes/')),
        };
      } else {
        entry.skipped = `redirected off https (${r.finalUrl})`;
      }
    }
    if (entry.status !== 200 || entry.error) log.failures.push({ phase: 'html', ...entry });
    log.html.push(entry);
  });
}

async function crawlModules(seedModules) {
  const queue = [...new Set(seedModules)].sort();
  const seen = new Set(queue);
  let downloaded = 0;

  const worker = async () => {
    while (queue.length) {
      if (downloaded >= MODULE_CAP) return;
      const modPath = queue.shift();
      if (!modPath || seen.has(modPath + '#done')) continue;
      seen.add(modPath + '#done');
      downloaded++;
      const url = ORIGIN + modPath;
      const r = await politeFetch(url, 'application/javascript,text/javascript,*/*');
      const entry = {
        url: modPath,
        status: r.status ?? null,
        size: r.buf?.length ?? 0,
        contentType: r.contentType ?? null,
        attempts: r.attempts,
        error: r.error ?? null,
        imports: [],
      };
      if (r.buf && r.status === 200) {
        const src = r.buf.toString('utf8');
        moduleBuffers.set(modPath, src);
        const imports = extractImports(src, url);
        entry.imports = imports;
        importsByModule[modPath] = imports;
        const dest = path.join(JS_ROOT, modPath.replace(/^\//, ''));
        const safe = path.resolve(dest);
        if (safe.startsWith(path.resolve(JS_ROOT) + path.sep)) {
          await fs.mkdir(path.dirname(safe), { recursive: true });
          await fs.writeFile(safe, r.buf);
        } else {
          entry.saveError = 'path traversal guard';
        }
        for (const imp of imports) {
          if (!seen.has(imp)) {
            seen.add(imp);
            queue.push(imp);
          }
        }
      }
      if (entry.status !== 200 || entry.error) log.failures.push({ phase: 'module', ...entry });
      log.modules.push(entry);
    }
  };

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return { downloaded, remainingQueued: queue.length };
}

async function main() {
  await fs.mkdir(path.join(JS_ROOT, '_app', 'immutable'), { recursive: true });

  console.log('[1/4] build version + seed routes');
  await fetchBuildVersion();
  const routes = await buildSeedRoutes();
  console.log(`      build=${log.buildVersion} routes=${routes.length}`);

  console.log('[2/4] HTML shells');
  await crawlHtml(routes);
  const htmlOk = log.html.filter((h) => h.status === 200).length;
  console.log(`      html ok=${htmlOk}/${log.html.length}`);

  const seedModules = [...new Set(log.html.flatMap((h) => h.modules))].sort();
  console.log(`[3/4] JS modules (seed=${seedModules.length}, cap=${MODULE_CAP})`);
  const modStats = await crawlModules(seedModules);
  console.log(`      downloaded=${modStats.downloaded} queued-left=${modStats.remainingQueued}`);

  console.log('[4/4] route nodes + logs');
  for (const route of Object.keys(routeNodes)) {
    const nodeMods = routeNodes[route].nodeModules;
    const map = {};
    for (const m of nodeMods) map[m] = importsByModule[m] || [];
    routeNodes[route].importsByModule = map;
  }

  const okModules = log.modules.filter((m) => m.status === 200);
  const htmlStatus = {};
  for (const h of log.html) htmlStatus[h.status ?? 'ERR'] = (htmlStatus[h.status ?? 'ERR'] || 0) + 1;
  const modStatus = {};
  for (const m of log.modules) modStatus[m.status ?? 'ERR'] = (modStatus[m.status ?? 'ERR'] || 0) + 1;

  log.summary = {
    buildVersion: log.buildVersion,
    buildChanged: log.buildVersion !== log.oldBuildVersionFromBlueprint,
    routesRequested: log.html.length,
    routes200: htmlOk,
    htmlStatus,
    seedsFromHtml: seedModules.length,
    modulesAttempted: log.modules.length,
    modules200: okModules.length,
    modulesBytes: okModules.reduce((a, b) => a + b.size, 0),
    moduleStatus: modStatus,
    uniqueModulePaths: new Set(log.modules.map((m) => m.url)).size,
    failures: log.failures.length,
    assetsSeen: log.assets.length,
  };
  log.finishedAt = new Date().toISOString();

  await fs.writeFile(LOG_PATH, JSON.stringify(log, null, 2));
  await fs.writeFile(
    ROUTE_PATH,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        buildVersion: log.buildVersion,
        note: 'nodeIds and htmlModules come from the SSR shell; importsByModule is direct static/dynamic imports parsed from each node module.',
        routes: routeNodes,
      },
      null,
      2
    )
  );
  console.log(JSON.stringify(log.summary, null, 2));
}

main().catch(async (err) => {
  log.fatal = String(err && err.stack ? err.stack : err);
  log.finishedAt = new Date().toISOString();
  try {
    await fs.writeFile(LOG_PATH, JSON.stringify(log, null, 2));
  } catch {}
  console.error(log.fatal);
  process.exitCode = 1;
});
