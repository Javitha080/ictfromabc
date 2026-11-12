#!/usr/bin/env node
/**
 * extract_api_current.mjs — static API surface extraction for ictfromabc bundles.
 *
 * Resolves the API wrapper's export -> HTTP method mapping per build instead of
 * assuming the old minified names. Parses every literal/template path passed to
 * a wrapper helper plus direct fetch() calls, and records request body keys.
 *
 * Output: analysis/api_findings_current.json
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const CURRENT = path.join(ROOT, 'js', 'current');
const OLD_DIRS = [path.join(ROOT, 'js', 'all'), path.join(ROOT, 'js', 'nodes'), path.join(ROOT, 'js', 'live')];

const BASE_RE = /https:\/\/ictfromabc\.com\/api/;

async function walk(dir) {
  const out = [];
  let ents;
  try {
    ents = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of ents) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else if (e.isFile() && e.name.endsWith('.js')) out.push(p);
  }
  return out;
}

function lineOf(src, idx) {
  let n = 1;
  for (let i = 0; i < idx && i < src.length; i++) if (src[i] === '\n') n++;
  return n;
}

/** Parse `function NAME(...){return a({method:"GET"...` definitions. */
function parseWrapper(src) {
  const methods = {};
  const defRe = /function\s+([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{\s*return\s+[A-Za-z_$][\w$]*\(\{\s*method\s*:\s*"(GET|POST|PUT|PATCH|DELETE)"/g;
  for (const m of src.matchAll(defRe)) methods[m[1]] = m[2];

  const exportMap = {};
  const exp = src.match(/export\s*\{([^}]*)\}\s*;?\s*$/);
  if (exp) {
    for (const part of exp[1].split(',')) {
      const bits = part.trim().split(/\s+as\s+/);
      if (bits.length === 2) exportMap[bits[1].trim()] = bits[0].trim();
      else if (bits[0]) exportMap[bits[0].trim()] = bits[0].trim();
    }
  }
  const byExport = {};
  for (const [expName, internal] of Object.entries(exportMap)) {
    if (methods[internal]) byExport[expName] = methods[internal];
  }
  return { methods, exportMap, byExport, rawGetExports: Object.keys(byExport).filter((k) => byExport[k] === 'GET') };
}

/** Extract balanced (...) content starting at src[start] === '('. */
function balanced(src, start, open = '(', close = ')') {
  let depth = 0;
  let quote = null;
  for (let i = start; i < src.length; i++) {
    const ch = src[i];
    if (quote) {
      if (ch === '\\') i++;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      continue;
    }
    if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return { inner: src.slice(start + 1, i), end: i };
    }
  }
  return null;
}

function splitTopLevel(s) {
  const parts = [];
  let depth = 0;
  let quote = null;
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (quote) {
      if (ch === '\\') i++;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      continue;
    }
    if ('({['.includes(ch)) depth++;
    else if (')}]'.includes(ch)) depth--;
    else if (ch === ',' && depth === 0) {
      parts.push(s.slice(start, i).trim());
      start = i + 1;
    }
  }
  parts.push(s.slice(start).trim());
  return parts;
}

function unquoteString(s) {
  const q = s[0];
  if ((q !== '"' && q !== "'") || s[s.length - 1] !== q) return null;
  try {
    if (q === '"') return JSON.parse(s);
  } catch {}
  return s.slice(1, -1).replace(/\\(['"\\])/g, '$1').replace(/\\n/g, '\n');
}

/** Replace ${...} in a template literal with {param}; returns {path, params}. */
function templateToPath(s) {
  const params = [];
  let out = '';
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '$' && s[i + 1] === '{') {
      let depth = 1;
      let j = i + 2;
      let quote = null;
      for (; j < s.length; j++) {
        const ch = s[j];
        if (quote) {
          if (ch === '\\') j++;
          else if (ch === quote) quote = null;
          continue;
        }
        if (ch === '"' || ch === "'" || ch === '`') quote = ch;
        else if (ch === '{') depth++;
        else if (ch === '}') {
          depth--;
          if (depth === 0) break;
        }
      }
      params.push(s.slice(i + 2, j));
      out += '{param}';
      i = j;
    } else out += s[i];
  }
  return { path: out, params };
}

/** First argument -> literal path info, or null when dynamic. */
function argToPath(arg) {
  if (!arg) return null;
  const a = arg.trim();
  if (a.startsWith('`')) {
    const inner = a.slice(1, -1);
    const { path: p, params } = templateToPath(inner);
    if (!p.startsWith('/')) return null;
    return { raw: a, path: p, params, kind: 'template' };
  }
  const str = unquoteString(a);
  if (str != null) {
    if (!str.startsWith('/') || str.startsWith('//')) return null;
    return { raw: a, path: str, params: [], kind: 'literal' };
  }
  // Concatenated literal prefix: "/admin/tickets"+e
  const pieces = [...a.matchAll(/(["'])(\/(?:[^"'\\]|\\.)*)\1/g)];
  if (pieces.length && a.includes('+')) {
    const prefix = pieces.map((m) => m[2]).join('');
    if (prefix.startsWith('/')) return { raw: a, path: prefix + '{suffix}', params: ['concatenated'], kind: 'concat' };
  }
  return null;
}

/** Top-level keys of an object literal argument. */
function objectKeys(arg) {
  const a = arg.trim();
  if (!a.startsWith('{')) return null;
  const keys = [];
  let depth = 0;
  let quote = null;
  for (let i = 0; i < a.length; i++) {
    const ch = a[i];
    if (quote) {
      if (ch === '\\') i++;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      continue;
    }
    if ('({['.includes(ch)) depth++;
    else if (')}]'.includes(ch)) depth--;
    else if (depth === 1) {
      const rest = a.slice(i);
      const m = rest.match(/^([A-Za-z_$][\w$]*)\s*:/);
      if (m) {
        keys.push(m[1]);
        i += m[0].length - 1;
      }
    }
  }
  return keys.length ? keys : null;
}

/** Extract paths passed to wrapper helpers + direct fetch calls from one file. */
function analyzeFile(src, file, byExport, wrapperBase, wrapperNames) {
  const calls = [];
  const direct = [];
  const importRe = /import\s*\{([^}]*)\}\s*from\s*["'][^"']*\/([A-Za-z0-9_\-]+)\.js["']/g;
  const aliases = {};
  const names = wrapperNames || [wrapperBase.split('/').pop().replace(/\.js$/, '')];

  for (const m of src.matchAll(importRe)) {
    if (!names.includes(m[2])) continue;
    for (const part of m[1].split(',')) {
      const bits = part.trim().split(/\s+as\s+/);
      const imported = (bits[0] || '').trim();
      const local = (bits[1] || bits[0] || '').trim();
      if (byExport[imported]) aliases[local] = byExport[imported];
    }
  }

  for (const [alias, method] of Object.entries(aliases)) {
    const re = new RegExp(`(?<![\\w$.])${alias.replace(/[$]/g, '\\$&')}\\s*\\(`, 'g');
    for (const m of src.matchAll(re)) {
      const open = m.index + m[0].length - 1;
      const bal = balanced(src, open);
      if (!bal) continue;
      const args = splitTopLevel(bal.inner);
      const pinfo = argToPath(args[0]);
      if (!pinfo) {
        if (args[0]) {
          calls.push({
            file: path.relative(ROOT, file).replace(/\\/g, '/'),
            method,
            path: null,
            dynamicFirstArg: args[0].slice(0, 120),
            call: `(${bal.inner.slice(0, 300)})`,
            line: lineOf(src, m.index),
          });
        }
        continue;
      }
      let finalMethod = method;
      let spoof = null;
      const allArgs = bal.inner;
      const sm = allArgs.match(/_method\s*:\s*"(PUT|PATCH|DELETE|POST)"/);
      if (sm) {
        spoof = sm[1];
        finalMethod = sm[1];
      }
      let body = null;
      let bodyFields = null;
      let bodyKind = null;
      if (args[1]) {
        body = args[1].slice(0, 600);
        if (args[1].trim().startsWith('{')) {
          bodyFields = objectKeys(args[1]);
          bodyKind = 'json-or-form-object';
        } else if (args[1].includes('new FormData') || args[1].includes('FormData')) {
          bodyKind = 'FormData';
        } else {
          bodyKind = 'var';
        }
      }
      let formFields = [];
      if (bodyKind === 'FormData' || (args[2] && args[2].trim() === '""')) {
        const around = src.slice(Math.max(0, m.index - 2500), Math.min(src.length, bal.end + 2500));
        for (const fm of around.matchAll(/\.append\(\s*["']([^"']+)["']/g)) formFields.push(fm[1]);
      }
      calls.push({
        file: path.relative(ROOT, file).replace(/\\/g, '/'),
        method: finalMethod,
        path: pinfo.path,
        rawPath: pinfo.raw,
        pathKind: pinfo.kind,
        pathParams: pinfo.params,
        spoofedFrom: spoof,
        body,
        bodyKind,
        bodyFields,
        formFields: [...new Set(formFields)],
        call: bal.inner.slice(0, 500),
        line: lineOf(src, m.index),
      });
    }
  }

  // Direct https://ictfromabc.com/api or `${base}/...` fetch calls.
  for (const m of src.matchAll(/fetch\s*\(/g)) {
    const bal = balanced(src, m.index + m[0].length - 1);
    if (!bal) continue;
    const args = splitTopLevel(bal.inner);
    const first = args[0] || '';
    if (!/ictfromabc\.com\/api|`\$\{[A-Za-z_$][\w$]*\}\//.test(first + src.slice(m.index, bal.end))) continue;
    const methodM = bal.inner.match(/method\s*:\s*"(GET|POST|PUT|PATCH|DELETE)"/);
    let p = null;
    const full = first.match(/https:\/\/ictfromabc\.com\/api(\/[^`"']*)/);
    if (full) p = full[1];
    if (!p) {
      const t = first.match(/`\$\{[A-Za-z_$][\w$]*\}(\/[^`]*)`/);
      if (t) p = t[1].replace(/\$\{[^}]*\}/g, '{param}');
    }
    direct.push({
      file: path.relative(ROOT, file).replace(/\\/g, '/'),
      method: methodM ? methodM[1] : 'GET',
      path: p,
      raw: first.slice(0, 200),
      call: bal.inner.slice(0, 400),
      line: lineOf(src, m.index),
    });
  }

  return { aliases, calls, direct };
}

async function analyzeBuild(files, label) {
  // locate wrapper by base string
  let wrapperFile = null;
  let wrapperSrc = '';
  for (const f of files) {
    let s;
    try {
      s = await fs.readFile(f, 'utf8');
    } catch {
      continue;
    }
    if (BASE_RE.test(s) && /export\s*\{/.test(s)) {
      wrapperSrc = s;
      wrapperFile = f;
      break;
    }
  }
  const wrapper = wrapperFile
    ? { file: path.relative(ROOT, wrapperFile).replace(/\\/g, '/'), base: 'https://ictfromabc.com/api', ...parseWrapper(wrapperSrc) }
    : null;
  const wrapperNames = wrapperFile
    ? [...new Set([wrapperFile.split(/[\\/]/).pop().replace(/\.js$/, ''), wrapperFile.split(/[\\/]/).pop().replace(/\.js$/, '').split('_').pop()])]
    : [];

  const calls = [];
  const direct = [];
  const noLiteral = [];
  const perFile = {};
  if (wrapper) {
    for (const f of files) {
      let s;
      try {
        s = await fs.readFile(f, 'utf8');
      } catch {
        continue;
      }
      if (!s.includes(`/${wrapper.file.split('/').pop().replace(/\.js$/, '')}.js`)) {
        // still scan direct fetch calls in every file
        const { correct: _c, calls: c, direct: d } = { correct: 0, ...analyzeFile(s, f, wrapper.byExport, wrapper.file, wrapperNames) };
        if (c.length || d.length) perFile[path.relative(ROOT, f).replace(/\\/g, '/')] = { calls: c.length, direct: d.length };
        for (const x of c) if (!x.path) noLiteral.push(x);
        calls.push(...c.filter((x) => x.path));
        direct.push(...d);
        continue;
      }
      const res = analyzeFile(s, f, wrapper.byExport, wrapper.file, wrapperNames);
      if (res.calls.length || res.direct.length) perFile[path.relative(ROOT, f).replace(/\\/g, '/')] = { calls: res.calls.length, direct: res.direct.length, aliases: res.aliases };
      for (const x of res.calls) if (!x.path) noLiteral.push(x);
      calls.push(...res.calls.filter((x) => x.path));
      direct.push(...res.direct);
    }
  }
  return { label, files: files.length, wrapper, calls, direct, noLiteral, perFile };
}

async function main() {
  const currentFiles = await walk(CURRENT);
  const oldFiles = (await Promise.all(OLD_DIRS.map(walk))).flat();

  const cur = await analyzeBuild(currentFiles, 'current');
  const old = await analyzeBuild(oldFiles, 'old');

  const union = new Map();
  for (const [build, data] of [['current', cur], ['old', old]]) {
    for (const c of data.calls) {
      const key = c.path.replace(/\{param\}/g, '{x}');
      const curEntry = union.get(key) || { path: c.path, methods: {}, builds: new Set(), bodyFields: new Set(), files: new Set() };
      curEntry.methods[c.method] = true;
      curEntry.builds.add(build);
      curEntry.files.add(c.file);
      for (const f of c.bodyFields || []) curEntry.bodyFields.add(f);
      for (const f of c.formFields || []) curEntry.bodyFields.add(f + ' (form)');
      union.set(key, curEntry);
    }
    for (const d of data.direct) {
      if (!d.path) continue;
      const key = d.path.replace(/\$\{[^}]*\}/g, '{x}');
      const curEntry = union.get(key) || { path: d.path, methods: {}, builds: new Set(), bodyFields: new Set(), files: new Set() };
      curEntry.methods[d.method] = true;
      curEntry.builds.add(build);
      curEntry.files.add(d.file);
      union.set(key, curEntry);
    }
  }

  const out = {
    generatedAt: new Date().toISOString(),
    current: {
      files: cur.files,
      wrapper: cur.wrapper,
      callCount: cur.calls.length,
      directCount: cur.direct.length,
      calls: cur.calls,
      direct: cur.direct,
      dynamicFirstArg: cur.noLiteral.slice(0, 100),
      perFile: cur.perFile,
    },
    old: {
      files: old.files,
      wrapper: old.wrapper,
      callCount: old.calls.length,
      directCount: old.direct.length,
      calls: old.calls,
      direct: old.direct,
      perFile: old.perFile,
    },
    union: [...union.values()]
      .map((u) => ({
        path: u.path,
        methods: Object.keys(u.methods).sort(),
        builds: [...u.builds].sort(),
        bodyFields: [...u.bodyFields].sort(),
        files: [...u.files].sort(),
      }))
      .sort((a, b) => a.path.localeCompare(b.path)),
  };
  await fs.writeFile(path.join(HERE, 'api_findings_current.json'), JSON.stringify(out, null, 2));

  console.log('current wrapper:', cur.wrapper?.file, JSON.stringify(cur.wrapper?.byExport));
  console.log('old wrapper:', old.wrapper?.file, JSON.stringify(old.wrapper?.byExport));
  console.log(`current calls=${cur.calls.length} direct=${cur.direct.length}; old calls=${old.calls.length} direct=${old.direct.length}; union paths=${out.union.length}`);
  const currentOnly = out.union.filter((u) => u.builds.length === 1 && u.builds[0] === 'current');
  const oldOnly = out.union.filter((u) => u.builds.length === 1 && u.builds[0] === 'old');
  console.log(`current-only=${currentOnly.length} old-only=${oldOnly.length} both=${out.union.length - currentOnly.length - oldOnly.length}`);
}

main().catch((e) => {
  console.error(e.stack || String(e));
  process.exitCode = 1;
});
