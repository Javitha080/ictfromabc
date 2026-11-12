#!/usr/bin/env node
/**
 * ict.mjs — ICTFromABC session + lesson CLI
 *
 * Session commands
 *   login --phone <n> --password <p> [--fp <visitorId>] [--conf 0.97] [--dry-run]
 *   session import <file>            import a suite export (token/role/user/fingerprint)
 *   session show [--json]            show the stored session, token redacted
 *   session clear
 *   whoami
 *
 * Content commands
 *   lessons                          GET /api/lessons/allowed
 *   lesson <lessonId>                GET /api/lessons/<id>
 *   resolve <videoId>                generate a token + resolve the embed/HLS
 *   download <videoId> [--out dir] [--quality 720] [--ffmpeg] [--keep-ts]
 *   download-lesson <lessonId> [--out dir] [--quality 720] [--ffmpeg]
 *   api <path> [--json]              authenticated GET against /api
 *
 * Global flags: --json, --dry-run, --base <url>, --token <bearer>, --verbose
 *
 * Node 18+. No dependencies. The Bearer token is a password: the session file is
 * written with owner-only permissions where the OS supports it.
 */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const CONFIG_DIR = path.join(ROOT, 'config');
const SESSION_FILE = path.join(CONFIG_DIR, 'session.local.json');
const PROFILE_FILE = path.join(CONFIG_DIR, 'profile.local.json');
const DEFAULT_BASE = 'https://ictfromabc.com/api';
const SITE_ORIGIN = 'https://ictfromabc.com';
const REFERER = SITE_ORIGIN + '/';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const EXIT = { ok: 0, usage: 2, auth: 3, paused: 4, network: 5, failed: 6 };

// ---------------------------------------------------------------------------
// Output helpers
// ---------------------------------------------------------------------------

const paint = (code, s) => (process.stdout.isTTY ? `\u001b[${code}m${s}\u001b[0m` : s);
const red = (s) => paint('31', s);
const green = (s) => paint('32', s);
const yellow = (s) => paint('33', s);
const dim = (s) => paint('90', s);

let VERBOSE = false;
const log = (...a) => { if (VERBOSE) console.error(dim('[debug]'), ...a); };
const info = (s) => console.error(s);
const warn = (s) => console.error(yellow('! ') + s);
const fail = (s) => console.error(red('x ') + s);

function die(message, code = EXIT.failed) {
  fail(message);
  process.exit(code);
}

function out(obj, asJson) {
  void asJson;
  process.stdout.write(JSON.stringify(obj, null, 2) + '\n');
}

function redactToken(t) {
  if (!t) return '';
  const s = String(t);
  if (s.length <= 12) return '***';
  return s.slice(0, 6) + '…' + s.slice(-4);
}

function rel(p) {
  const r = path.relative(process.cwd(), p);
  return r && !r.startsWith('..') ? r : p;
}

// ---------------------------------------------------------------------------
// Args
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--') { positional.push(...argv.slice(i + 1)); break; }
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      if (eq !== -1) {
        flags[a.slice(2, eq)] = a.slice(eq + 1);
      } else {
        const key = a.slice(2);
        const next = argv[i + 1];
        if (next !== undefined && !next.startsWith('--')) { flags[key] = next; i++; }
        else flags[key] = true;
      }
    } else {
      positional.push(a);
    }
  }
  return { flags, positional };
}

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------

function ensureConfigDir() {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
}

function readJson(file, fallback) {
  try {
    const text = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

function writePrivate(file, data) {
  ensureConfigDir();
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', { mode: 0o600 });
  try { fs.chmodSync(file, 0o600); } catch { /* Windows */ }
}

function loadSession() {
  const s = readJson(SESSION_FILE, null);
  if (!s || !s.token) return null;
  return s;
}

function saveSession(session) {
  writePrivate(SESSION_FILE, session);
}

function clearSession() {
  try { fs.unlinkSync(SESSION_FILE); } catch { /* already gone */ }
}

function requireToken(flags) {
  if (flags.token && flags.token !== true) return String(flags.token);
  if (process.env.ICT_TOKEN) return process.env.ICT_TOKEN;
  const s = loadSession();
  if (s && s.token) return s.token;
  die('No token. Run `login`, `session import <file>`, or pass --token.', EXIT.auth);
}

function loadProfile() {
  const p = readJson(PROFILE_FILE, null) || {};
  const s = loadSession() || {};
  const fp = p.visitorId || (s.fingerprint && s.fingerprint.visitorId) || '';
  const conf = p.confidenceScore != null ? p.confidenceScore
    : (s.fingerprint && s.fingerprint.confidenceScore != null ? s.fingerprint.confidenceScore : '');
  return { visitorId: String(fp || ''), confidenceScore: conf === '' ? '' : String(conf) };
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function baseUrl(flags) {
  return String(flags.base || process.env.ICT_API_BASE || DEFAULT_BASE).replace(/\/+$/, '');
}

async function apiRequest(method, apiPath, { flags, body, token, expectJson = true } = {}) {
  const url = baseUrl(flags) + (apiPath.startsWith('/') ? apiPath : '/' + apiPath);
  if (flags['dry-run']) {
    info(dim(`[dry-run] ${method} ${url}`) + (body ? dim(' body=' + JSON.stringify(body)) : ''));
    return { dryRun: true, status: 0, json: null, text: '' };
  }
  const headers = {
    'Accept': 'application/json',
    'User-Agent': UA,
    'Origin': SITE_ORIGIN,
    'Referer': REFERER + 'auth/login'
  };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const t = token || null;
  if (t) headers['Authorization'] = 'Bearer ' + t;

  let res;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: 'manual'
    });
  } catch (e) {
    throw Object.assign(new Error(`Network error on ${method} ${url}: ${e.message}`), { code: EXIT.network });
  }

  const text = await res.text();
  let json = null;
  if (expectJson && text) {
    try { json = JSON.parse(text); } catch { /* non-JSON */ }
  }
  log(method, url, '->', res.status, `${text.length} bytes`);
  return { status: res.status, json, text, res };
}

async function loginOnce(flags = {}) {
  const phone = String(flags.phone || process.env.ICT_PHONE || '');
  const password = String(flags.password || process.env.ICT_PASSWORD || '');
  if (!phone || !password) return '';
  const profile = loadProfile();
  const visitorId = String(flags.fp || profile.visitorId || '');
  let confidence = flags.conf != null ? Number(flags.conf) : Number(profile.confidenceScore);
  if (!Number.isFinite(confidence)) confidence = 0;
  const r = await apiRequest('POST', '/login', {
    flags: { ...flags, 'dry-run': false },
    body: { phoneNumber: phone, password, visitorId, confidenceScore: confidence },
    token: null
  });
  if (r.status !== 200 || !r.json || !r.json.token) return '';
  saveSession({
    version: 2,
    savedAt: new Date().toISOString(),
    baseUrl: baseUrl(flags),
    token: r.json.token,
    role: r.json.role || '',
    user: r.json.user || null,
    fingerprint: { visitorId, confidenceScore: confidence },
    meta: {
      authenticated: r.json.authenticated,
      course_id: r.json.course_id,
      skippable: r.json.skippable
    }
  });
  return r.json.token;
}

async function apiJson(method, apiPath, opts = {}) {
  const r = await apiRequest(method, apiPath, opts);
  if (r.dryRun) return r;
  if (r.status === 302 && r.json && r.json.token) {
    // Pause response carrying a token: usable session.
    saveSession({
      ...(loadSession() || {}),
      token: r.json.token,
      role: r.json.role || '',
      user: r.json.user || null,
      savedAt: new Date().toISOString()
    });
    return { status: 200, json: r.json, text: r.text, res: r.res, convertedFrom302: true };
  }
  if (r.status === 302) {
    const target = (r.json && (r.json.redirect_url || r.json.redirectUrl)) || '/blocked';
    throw Object.assign(new Error(`Account on Pause (302 -> ${target}). Only staff can unpause; do not retry logins.`), { code: EXIT.paused, pause: true, target });
  }
  if (r.status === 401) {
    // Tokens have a 3-minute absolute lifetime, and any login replaces them.
    // Re-login once when credentials are available (env or flags); never for
    // the login call itself, and never twice in a row.
    if (apiPath !== '/login' && !opts.__retried) {
      const fresh = await loginOnce(opts.flags || {});
      if (fresh) {
        warn('Token expired (3-minute TTL). Re-logged in with the pinned identity.');
        return apiJson(method, apiPath, { ...opts, token: fresh, __retried: true });
      }
    }
    throw Object.assign(new Error(
      '401 Unauthenticated. The token has a 3-minute lifetime, and a newer login also replaces it. '
      + 'Run `login` again, or set ICT_PHONE/ICT_PASSWORD for automatic re-login.'
    ), { code: EXIT.auth });
  }
  if (r.status < 200 || r.status >= 300) {
    const msg = (r.json && (r.json.message || r.json.msg)) || `HTTP ${r.status}`;
    const errs = r.json && r.json.errors ? ' ' + Object.keys(r.json.errors).join(', ') : '';
    throw Object.assign(new Error(`${method} ${apiPath}: ${msg}${errs}`), { code: EXIT.failed, status: r.status, json: r.json });
  }
  if (r.json === null && r.text) {
    throw new Error(`${method} ${apiPath}: expected JSON, got ${r.text.slice(0, 120)}`);
  }
  return r;
}

// ---------------------------------------------------------------------------
// Auth commands
// ---------------------------------------------------------------------------

async function cmdLogin(flags) {
  const phone = String(flags.phone || '');
  const password = String(flags.password || '');
  if (!phone || !password) {
    die('Usage: ict login --phone <phoneNumber> --password <password> [--fp <visitorId>] [--conf 0.97]', EXIT.usage);
  }
  const profile = loadProfile();
  const visitorId = String(flags.fp || profile.visitorId || '');
  let confidence = flags.conf != null ? flags.conf : profile.confidenceScore;
  if (!visitorId) {
    warn('No visitorId pinned. The server will see this device\'s own fingerprint.');
    warn('Set one with --fp or config/profile.local.json to avoid binding the account to a new device.');
  }
  const numConf = Number(confidence);
  const body = {
    phoneNumber: phone,
    password,
    visitorId,
    confidenceScore: Number.isFinite(numConf) ? numConf : 0
  };

  if (flags['dry-run']) {
    out({ dryRun: true, url: baseUrl(flags) + '/login', body: { ...body, password: '***' } }, true);
    return;
  }

  info('POST /api/login with the pinned identity. If the pair does not match the bound device,');
  info('the account can flip to Account on Pause (staff-only unlock).');
  let r;
  try {
    r = await apiJson('POST', '/login', { flags, body });
  } catch (e) {
    if (e.pause) {
      fail(e.message);
      process.exit(EXIT.paused);
    }
    if (e.status === 422) {
      fail('Validation: ' + e.message);
      process.exit(EXIT.failed);
    }
    if (e.status === 401 || e.status === 400) {
      fail('Login rejected: ' + e.message);
      process.exit(EXIT.auth);
    }
    throw e;
  }

  const j = r.json || {};
  if (!j.token) {
    if (j.otp_required || j.otpRequired) {
      info('OTP required. Complete it in the browser with the userscript installed; the CLI does not send OTP.');
      process.exit(EXIT.auth);
    }
    out(j, true);
    die('Login returned no token. Nothing stored.', EXIT.auth);
  }

  const session = {
    version: 2,
    savedAt: new Date().toISOString(),
    baseUrl: baseUrl(flags),
    token: j.token,
    role: j.role || '',
    user: j.user || null,
    fingerprint: { visitorId, confidenceScore: body.confidenceScore },
    meta: {
      authenticated: j.authenticated,
      course_id: j.course_id,
      skippable: j.skippable
    }
  };
  saveSession(session);
  info(green('Login OK.') + ' role=' + (session.role || '?') + ' token=' + redactToken(j.token));
  info(yellow('This login replaced any other active session. The account allows one token at a time.'));
  out({
    ok: true,
    role: session.role,
    user: session.user ? {
      id: session.user.id,
      first_name: session.user.first_name,
      last_name: session.user.last_name
    } : null,
    token: redactToken(j.token),
    savedTo: rel(SESSION_FILE)
  }, true);
}

async function cmdSession(flags, positional) {
  const sub = positional[1] || 'show';
  if (sub === 'show') {
    const s = loadSession();
    if (!s) { die('No session stored.', EXIT.auth); }
    out({
      savedAt: s.savedAt,
      ageSeconds: s.savedAt ? Math.max(0, Math.round((Date.now() - Date.parse(s.savedAt)) / 1000)) : null,
      baseUrl: s.baseUrl || DEFAULT_BASE,
      token: redactToken(s.token),
      role: s.role || '',
      user: s.user || null,
      fingerprint: s.fingerprint || null,
      meta: s.meta || null
    }, true);
    return;
  }
  if (sub === 'clear') {
    clearSession();
    info(green('Session cleared.'));
    return;
  }
  if (sub === 'export') {
    const s = loadSession();
    if (!s) die('No session stored.', EXIT.auth);
    const file = path.resolve(String(positional[2] || flags.file || path.join(CONFIG_DIR, 'session.export.local.json')));
    fs.mkdirSync(path.dirname(file), { recursive: true });
    writePrivate(file, {
      version: 2,
      exportedAt: new Date().toISOString(),
      savedAt: s.savedAt || null,
      baseUrl: SITE_ORIGIN,
      token: s.token,
      role: s.role || '',
      user: s.user || null,
      fingerprint: s.fingerprint || loadProfile()
    });
    info(green('Session exported to ') + rel(file) + yellow('  (contains a live Bearer token)'));
    return;
  }
  if (sub === 'import') {
    const file = positional[2] || flags.file;
    if (!file) die('Usage: ict session import <export.json>', EXIT.usage);
    const raw = JSON.parse(fs.readFileSync(path.resolve(String(file)), 'utf8').replace(/^\uFEFF/, ''));
    const token = raw.token || (raw.session && raw.session.token);
    if (!token) die('The file has no token field.', EXIT.usage);
    const session = {
      version: 2,
      savedAt: new Date().toISOString(),
      baseUrl: raw.baseUrl || baseUrl(flags),
      token,
      role: raw.role || (raw.session && raw.session.role) || '',
      user: raw.user || null,
      fingerprint: raw.fingerprint || null,
      meta: raw.lastOk || null
    };
    saveSession(session);
    if (session.fingerprint && session.fingerprint.visitorId) {
      writePrivate(PROFILE_FILE, {
        visitorId: String(session.fingerprint.visitorId),
        confidenceScore: session.fingerprint.confidenceScore == null ? '' : String(session.fingerprint.confidenceScore)
      });
    }
    info(green('Session imported.') + ' role=' + (session.role || '?') + ' token=' + redactToken(token));
    return;
  }
  die('Usage: ict session [show|import <file>|clear]', EXIT.usage);
}

async function cmdWhoami(flags) {
  const r = await apiJson('GET', '/user', { flags, token: requireToken(flags) });
  const j = r.json || {};
  const user = j.user || j;
  out({
    ok: true,
    id: user.id,
    first_name: user.first_name,
    last_name: user.last_name,
    phoneNumber: user.phone_number || user.phoneNumber,
    role: (loadSession() || {}).role || user.role,
    course_id: user.course_id,
    rawKeys: Object.keys(j)
  }, true);
}

// ---------------------------------------------------------------------------
// Lessons / videos
// ---------------------------------------------------------------------------

async function cmdLessons(flags) {
  const r = await apiJson('GET', '/lessons/allowed', { flags, token: requireToken(flags) });
  const j = r.json;
  const list = Array.isArray(j) ? j : (j.lessons || j.data || []);
  const rows = list.map((l) => ({
    id: l.id,
    title: l.title,
    course_id: l.course_id,
    videos: Array.isArray(l.videos) ? l.videos.length : undefined,
    created_at: l.created_at
  }));
  out({ ok: true, count: rows.length, lessons: rows }, true);
}

function lessonVideos(j) {
  if (Array.isArray(j)) return j;
  if (j && Array.isArray(j.videos)) return j.videos;
  if (j && j.lesson && Array.isArray(j.lesson.videos)) return j.lesson.videos;
  return [];
}

async function cmdLesson(flags, positional) {
  const id = positional[1];
  if (!id) die('Usage: ict lesson <lessonId>', EXIT.usage);
  const r = await apiJson('GET', `/lessons/${encodeURIComponent(id)}`, { flags, token: requireToken(flags) });
  const j = r.json || {};
  const videos = lessonVideos(j);
  out({
    ok: true,
    lesson: j.lesson ? { id: j.lesson.id, title: j.lesson.title } : (j.id ? { id: j.id, title: j.title } : null),
    live: j.live,
    count: videos.length,
    videos: videos.map((v) => ({
      id: v.id,
      title: v.title,
      video_url: v.video_url || null,
      thumbnail_url: v.thumbnail_url || null,
      created_at: v.created_at
    }))
  }, true);
}

async function resolveVideo(flags, videoId, titleHint) {
  const token = requireToken(flags);
  const tok = await apiJson('GET', `/videos/${encodeURIComponent(videoId)}/generate-token`, { flags, token });
  if (tok.dryRun) return { dryRun: true };
  const t = tok.json || {};
  if (!t.token) throw new Error('generate-token returned no token');
  const infoRes = await apiJson('GET', `/videos/${encodeURIComponent(videoId)}`, { flags, token });
  const v = infoRes.json || {};
  if (!v.video_url) throw new Error('videos/{id} returned no video_url');
  const kind = /youtube\.com|youtu\.be/i.test(v.video_url) ? 'youtube'
    : /iframe\.mediadelivery\.net\/embed/i.test(v.video_url) ? 'bunny'
    : /\.m3u8/i.test(v.video_url) ? 'hls'
    : /\.mp4/i.test(v.video_url) ? 'mp4' : 'other';
  const embed = v.video_url;
  const signed = appendToken(embed, t.token, t.expires);
  const guid = (embed.match(/embed\/\d+\/([0-9a-f-]{36})/i) || [])[1] || '';
  return {
    id: Number(videoId),
    title: v.title || titleHint || `Video ${videoId}`,
    kind,
    embed,
    signed,
    token: t.token,
    expires: t.expires,
    guid,
    library: (embed.match(/embed\/(\d+)\//i) || [])[1] || '',
    hls: guessHls(embed, guid)
  };
}

function appendToken(url, token, expires) {
  if (!url || !token) return url;
  const sep = url.includes('?') ? '&' : '?';
  return url + sep + 'token=' + encodeURIComponent(token) + '&expires=' + encodeURIComponent(expires);
}

function guessHls(embed, guid) {
  if (!guid) return '';
  const cacheFile = path.join(CONFIG_DIR, 'pullzones.local.json');
  const zones = readJson(cacheFile, {});
  const lib = (String(embed).match(/embed\/(\d+)\//i) || [])[1];
  const host = lib && zones[lib];
  return host ? `https://${host}/${guid}/playlist.m3u8` : '';
}

function rememberPullZone(library, host) {
  if (!library || !host) return;
  const cacheFile = path.join(CONFIG_DIR, 'pullzones.local.json');
  const zones = readJson(cacheFile, {});
  if (zones[library] === host) return;
  zones[library] = host;
  writePrivate(cacheFile, zones);
}

async function cmdResolve(flags, positional) {
  const id = positional[1];
  if (!id) die('Usage: ict resolve <videoId>', EXIT.usage);
  const item = await resolveVideo(flags, id);
  if (item.dryRun) return;
  if (!item.hls && item.kind === 'bunny') {
    try {
      await ensureHls(item, flags);
    } catch (e) {
      warn('HLS resolve failed: ' + e.message);
    }
  }
  out({
    ok: true,
    video: {
      id: item.id,
      title: item.title,
      kind: item.kind,
      embed: item.embed,
      signed_embed: item.signed,
      token: redactToken(item.token),
      expires: item.expires,
      hls: item.hls || null
    }
  }, true);
}

// ---------------------------------------------------------------------------
// HLS download
// ---------------------------------------------------------------------------

function headersForMedia(extra = {}) {
  return {
    'Accept': '*/*',
    'User-Agent': UA,
    'Referer': REFERER,
    'Origin': SITE_ORIGIN,
    'Accept-Language': 'en-US,en;q=0.9',
    ...extra
  };
}

async function fetchText(url, { retries = 3 } = {}) {
  let last;
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, { headers: headersForMedia(), redirect: 'follow' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (e) {
      last = e;
      await sleep(400 * (i + 1));
    }
  }
  throw last;
}

async function fetchBuffer(url, { retries = 4 } = {}) {
  let last;
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, { headers: headersForMedia(), redirect: 'follow' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    } catch (e) {
      last = e;
      await sleep(400 * (i + 1));
    }
  }
  throw last;
}

function parseHls(text, baseUrlStr) {
  const lines = String(text || '').split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  if (!lines.length) throw new Error('Empty playlist');
  if (lines.some((l) => l.startsWith('#EXT-X-STREAM-INF'))) {
    const variants = [];
    for (let i = 0; i < lines.length; i++) {
      if (!lines[i].startsWith('#EXT-X-STREAM-INF')) continue;
      const res = /RESOLUTION=(\d+)x(\d+)/i.exec(lines[i]);
      const bw = /BANDWIDTH=(\d+)/i.exec(lines[i]);
      let url = '';
      for (let k = i + 1; k < lines.length; k++) {
        if (lines[k] && !lines[k].startsWith('#')) { url = lines[k]; i = k; break; }
      }
      if (url) variants.push({
        url: new URL(url, baseUrlStr).href,
        height: res ? Number(res[2]) : 0,
        bandwidth: bw ? Number(bw[1]) : 0
      });
    }
    variants.sort((a, b) => (b.height - a.height) || (b.bandwidth - a.bandwidth));
    return { master: true, variants };
  }

  const parts = [];
  let key = null;
  let map = null;
  let seq = 0;
  let index = 0;
  for (const line of lines) {
    if (line.startsWith('#EXT-X-MEDIA-SEQUENCE:')) {
      seq = Number(line.split(':')[1]) || 0;
    } else if (line.startsWith('#EXT-X-KEY:')) {
      if (/METHOD=NONE/i.test(line)) { key = null; continue; }
      const method = (/METHOD=([^,]+)/i.exec(line) || [])[1] || '';
      const uri = (/URI="([^"]+)"/i.exec(line) || [])[1] || '';
      const ivHex = (/IV=0x([0-9a-f]+)/i.exec(line) || [])[1] || '';
      key = method.toUpperCase() === 'AES-128' && uri
        ? { uri: new URL(uri, baseUrlStr).href, iv: ivHex ? Buffer.from(ivHex, 'hex') : null }
        : null;
    } else if (line.startsWith('#EXT-X-MAP:')) {
      const m = (/URI="([^"]+)"/i.exec(line) || [])[1];
      if (m) map = new URL(m, baseUrlStr).href;
    } else if (!line.startsWith('#')) {
      parts.push({
        url: new URL(line, baseUrlStr).href,
        key,
        iv: key ? (key.iv || sequenceIv(seq + index)) : null
      });
      index++;
    }
  }
  const encrypted = parts.some((p) => !!p.key);
  const isFmp4 = /\/(?:init|seg|chunk)[^/]*\.(?:m4s|mp4)/i.test(parts.map((p) => p.url).join(' ')) || !!map;
  return { master: false, parts, map, encrypted, ext: isFmp4 ? 'mp4' : 'ts' };
}

function sequenceIv(n) {
  const iv = Buffer.alloc(16);
  let x = BigInt(n || 0);
  for (let i = 15; i >= 0; i--) { iv[i] = Number(x & 255n); x >>= 8n; }
  return iv;
}

async function mapLimit(items, limit, worker) {
  let next = 0;
  const runners = [];
  for (let i = 0; i < Math.min(limit, items.length); i++) {
    runners.push((async () => {
      while (true) {
        const idx = next++;
        if (idx >= items.length) return;
        await worker(items[idx], idx);
      }
    })());
  }
  await Promise.all(runners);
}

function sanitizeName(s) {
  return String(s || 'video')
    .replace(/[\\/:*?"<>|]+/g, '_')
    .replace(/\s+/g, ' ')
    .replace(/^\.+|\.+$/g, '')
    .trim()
    .slice(0, 90) || 'video';
}

function ffmpegAvailable() {
  return new Promise((resolve) => {
    try {
      const p = spawn('ffmpeg', ['-version'], { stdio: 'ignore' });
      p.on('error', () => resolve(false));
      p.on('exit', (code) => resolve(code === 0));
    } catch {
      resolve(false);
    }
  });
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const p = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => { err += d.toString(); if (err.length > 8000) err = err.slice(-8000); });
    p.on('error', reject);
    p.on('exit', (code) => code === 0 ? resolve() : reject(new Error('ffmpeg exited ' + code + '\n' + err.slice(-2000))));
  });
}

async function downloadHls(hlsUrl, outFile, { quality, ffmpegRemux, keepTs, quiet, limit } = {}) {
  const masterText = await fetchText(hlsUrl);
  let master = parseHls(masterText, hlsUrl);
  let mediaUrl = hlsUrl;
  let media = master;

  if (master.master) {
    if (!master.variants.length) throw new Error('Master playlist has no variants');
    const pick = quality
      ? (master.variants.find((v) => v.height === Number(quality))
        || master.variants.find((v) => v.height <= Number(quality))
        || master.variants[0])
      : master.variants[0];
    mediaUrl = pick.url;
    if (!quiet) info(dim(`  quality ${pick.height ? pick.height + 'p' : pick.bandwidth + 'bps'} ` +
      `(${master.variants.map((v) => (v.height || v.bandwidth)).join('/')})`));
    media = parseHls(await fetchText(mediaUrl), mediaUrl);
    if (media.master) throw new Error('Nested master playlist');
  }

  if (!media.parts.length) throw new Error('Playlist has no segments');
  if (media.encrypted && !quiet) info(dim('  AES-128: decrypting'));

  if (limit && Number(limit) > 0 && media.parts.length > Number(limit)) {
    if (!quiet) info(dim(`  limiting to first ${limit} of ${media.parts.length} segments`));
    media.parts = media.parts.slice(0, Number(limit));
  }

  const keyCache = new Map();
  const loadKey = async (keyInfo) => {
    if (keyCache.has(keyInfo.uri)) return keyCache.get(keyInfo.uri);
    const buf = await fetchBuffer(keyInfo.uri);
    keyCache.set(keyInfo.uri, buf);
    return buf;
  };

  const tmpDir = path.join(path.dirname(outFile), '.ict-parts-' + process.pid + '-' + Date.now());
  await fsp.mkdir(tmpDir, { recursive: true });
  const partFile = (i) => path.join(tmpDir, String(i).padStart(6, '0') + '.' + media.ext);

  let done = 0;
  const total = media.parts.length;
  const t0 = Date.now();
  let bytes = 0;

  try {
    await mapLimit(media.parts, 4, async (part, i) => {
      let buf = await fetchBuffer(part.url);
      if (part.key) {
        const key = await loadKey(part.key);
        const iv = part.iv || sequenceIv(i);
        const decipher = crypto.createDecipheriv('aes-128-cbc', key, iv);
        buf = Buffer.concat([decipher.update(buf), decipher.final()]);
      }
      bytes += buf.length;
      await fsp.writeFile(partFile(i), buf);
      done++;
      if (!quiet && (done === total || done % 25 === 0)) {
        const pct = ((done / total) * 100).toFixed(0);
        const mb = (bytes / 1048576).toFixed(1);
        info(dim(`  ${done}/${total} segments (${pct}%, ${mb} MB, ${((Date.now() - t0) / 1000).toFixed(0)}s)`));
      }
    });

    // Concatenate to a single transport stream, streaming so memory stays flat.
    const tsFile = outFile.replace(/\.(ts|mp4)$/i, '') + '.' + media.ext;
    await fsp.mkdir(path.dirname(tsFile), { recursive: true });
    const ws = fs.createWriteStream(tsFile);
    const failure = new Promise((_, reject) => ws.once('error', reject));
    failure.catch(() => {});
    const write = async (buf) => {
      if (!ws.write(buf)) await Promise.race([once(ws, 'drain'), failure]);
    };
    try {
      if (media.map) {
        const init = await fetchBuffer(media.map);
        await write(init);
      }
      for (let i = 0; i < total; i++) {
        const buf = await fsp.readFile(partFile(i));
        await write(buf);
      }
    } finally {
      await new Promise((resolve, reject) => ws.end((err) => err ? reject(err) : resolve()));
    }

    let finalFile = tsFile;
    if (ffmpegRemux && media.ext === 'ts') {
      const mp4 = tsFile.replace(/\.ts$/i, '.mp4');
      if (!quiet) info(dim('  remuxing with ffmpeg'));
      await runFfmpeg(['-y', '-i', tsFile, '-c', 'copy', '-bsf:a', 'aac_adtstoasc', mp4]);
      if (!keepTs) await fsp.unlink(tsFile).catch(() => {});
      finalFile = mp4;
    }
    return { file: finalFile, bytes, segments: total, seconds: (Date.now() - t0) / 1000 };
  } finally {
    await fsp.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function ensureHls(item, flags) {
  if (item.hls) return item.hls;
  if (item.kind === 'youtube') throw new Error('YouTube source: use yt-dlp, not the HLS path');
  if (/\.m3u8/i.test(item.embed)) return item.embed;

  // Learn the pull zone by reading the signed embed page.
  if (item.signed) {
    try {
      const html = await fetchText(item.signed);
      const m = html.match(/([a-z0-9-]+\.b-cdn\.net)/i);
      if (m && item.guid) {
        const candidate = `https://${m[1]}/${item.guid}/playlist.m3u8`;
        const txt = await fetchText(candidate);
        if (txt.startsWith('#EXTM3U')) {
          rememberPullZone(item.library, m[1]);
          item.hls = candidate;
          return candidate;
        }
      }
    } catch (e) {
      log('signed embed read failed:', e.message);
    }
  }
  throw new Error('No HLS URL. Open the video in the browser once with the suite installed to learn the pull zone, then retry.');
}

async function cmdDownload(flags, positional) {
  const id = positional[1];
  if (!id) die('Usage: ict download <videoId> [--out dir] [--quality 720] [--ffmpeg] [--keep-ts]', EXIT.usage);
  const item = await resolveVideo(flags, id);
  if (item.dryRun) return;
  const hls = await ensureHls(item, flags);
  if (flags['dry-run']) { info(dim('[dry-run] HLS ' + hls)); return; }

  const outDir = path.resolve(String(flags.out || path.join(ROOT, 'downloads')));
  await fsp.mkdir(outDir, { recursive: true });
  const base = sanitizeName(`${item.id} - ${item.title}`);
  const target = path.join(outDir, base + '.ts');

  info(`Downloading ${item.title} (#${item.id})`);
  info(dim('  ' + hls));
  const res = await downloadHls(hls, target, {
    quality: flags.quality,
    ffmpegRemux: !!flags.ffmpeg,
    keepTs: !!flags['keep-ts'],
    limit: flags.limit
  });
  info(green('Saved ') + rel(res.file) + dim(` (${(res.bytes / 1048576).toFixed(1)} MB, ${res.segments} segments, ${res.seconds.toFixed(0)}s)`));
  out({ ok: true, videoId: item.id, file: res.file, bytes: res.bytes, segments: res.segments }, true);
}

async function cmdDownloadUrl(flags, positional) {
  const url = positional[1];
  if (!url) die('Usage: ict download-url <playlist.m3u8> [--out file] [--quality 720] [--limit N] [--ffmpeg]', EXIT.usage);
  if (!/^https?:\/\//i.test(url)) die('The playlist must be an http(s) URL.', EXIT.usage);
  const outDir = path.resolve(String(flags.out || path.join(ROOT, 'downloads')));
  await fsp.mkdir(outDir, { recursive: true });
  let target;
  if (flags.out && /\.(ts|mp4)$/i.test(String(flags.out))) target = path.resolve(String(flags.out));
  else target = path.join(outDir, sanitizeName(flags.name || 'hls-download') + '.ts');

  info('Downloading ' + url);
  const res = await downloadHls(url, target, {
    quality: flags.quality,
    ffmpegRemux: !!flags.ffmpeg,
    keepTs: !!flags['keep-ts'],
    limit: flags.limit
  });
  info(green('Saved ') + rel(res.file) + dim(` (${(res.bytes / 1048576).toFixed(1)} MB, ${res.segments} segments, ${res.seconds.toFixed(0)}s)`));
  out({ ok: true, file: res.file, bytes: res.bytes, segments: res.segments }, true);
}

async function cmdDownloadLesson(flags, positional) {
  const id = positional[1];
  if (!id) die('Usage: ict download-lesson <lessonId> [--out dir] [--quality 720] [--ffmpeg]', EXIT.usage);
  const token = requireToken(flags);
  const r = await apiJson('GET', `/lessons/${encodeURIComponent(id)}`, { flags, token });
  if (r.dryRun) return;
  const j = r.json || {};
  const videos = lessonVideos(j);
  if (!videos.length) die('Lesson has no videos.', EXIT.failed);
  const title = (j.lesson && j.lesson.title) || `lesson-${id}`;
  const outDir = path.resolve(String(flags.out || path.join(ROOT, 'downloads', sanitizeName(`${id} - ${title}`))));
  info(`Lesson ${id}: ${videos.length} video(s) -> ${rel(outDir)}`);

  const results = new Array(videos.length);
  const queue = [];

  // Phase 1: resolve every video while the Bearer token is fresh. The token is
  // short-lived and single-session; resolving first keeps the whole lesson from
  // depending on it for the duration of the downloads.
  for (let i = 0; i < videos.length; i++) {
    const v = videos[i];
    try {
      const item = await resolveVideo(flags, v.id, v.title);
      if (item.kind === 'youtube') {
        warn(`#${v.id} is YouTube; skipping (use: yt-dlp "${item.embed}")`);
        results[i] = { id: v.id, skipped: 'youtube' };
        continue;
      }
      item.hls = await ensureHls(item, flags);
      queue.push({ i, item });
      results[i] = { id: v.id, pending: true };
    } catch (e) {
      fail(`#${v.id}: ${e.message}`);
      results[i] = { id: v.id, error: e.message };
    }
    await sleep(150);
  }

  info(`Resolved ${queue.length}/${videos.length} video(s); starting downloads (segments need no token).`);

  // Phase 2: Bunny segments are tokenless behind the site Referer, so a login
  // takeover during this loop does not break the transfer.
  for (let k = 0; k < queue.length; k++) {
    const { i, item } = queue[k];
    const baseName = sanitizeName(`${item.id} - ${item.title}`);
    const target = path.join(outDir, baseName + '.ts');
    const finalPath = path.join(outDir, baseName + (flags.ffmpeg ? '.mp4' : '.ts'));
    if (flags['skip-existing'] && fs.existsSync(finalPath)) {
      const bytes = fs.statSync(finalPath).size;
      info(`\n[${k + 1}/${queue.length}] ${item.title} (#${item.id}) - skip, already saved (${(bytes / 1048576).toFixed(1)} MB)`);
      results[i] = { id: item.id, file: finalPath, bytes, skipped: 'exists' };
      continue;
    }
    info(`\n[${k + 1}/${queue.length}] ${item.title} (#${item.id})`);
    try {
      const res = await downloadHls(item.hls, target, {
        quality: flags.quality,
        ffmpegRemux: !!flags.ffmpeg,
        keepTs: !!flags['keep-ts'],
        limit: flags.limit
      });
      results[i] = { id: item.id, file: res.file, bytes: res.bytes, segments: res.segments };
      info(green('  saved ') + rel(res.file));
    } catch (e) {
      fail(`#${item.id}: ${e.message}`);
      results[i] = { id: item.id, error: e.message };
    }
    await sleep(300);
  }
  out({ ok: true, lesson: Number(id), results }, true);
}

async function cmdApi(flags, positional) {
  const p = positional[1];
  if (!p) die('Usage: ict api <path> [--json]', EXIT.usage);
  const r = await apiJson('GET', p, { flags, token: requireToken(flags) });
  if (r.dryRun) return;
  process.stdout.write(JSON.stringify(r.json !== null ? r.json : r.text, null, 2) + '\n');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const USAGE = `ict — ICTFromABC session + lesson CLI

Session
  ict login --phone <n> --password <p> [--fp <visitorId>] [--conf 0.97] [--dry-run]
  ict session import <export.json>
  ict session export [file]
  ict session show
  ict session clear
  ict whoami

Content
  ict lessons
  ict lesson <lessonId>
  ict resolve <videoId>
  ict download <videoId> [--out dir] [--quality 720] [--ffmpeg] [--keep-ts]
  ict download-url <m3u8> [--out file] [--quality 720] [--limit N] [--ffmpeg]
  ict download-lesson <lessonId> [--out dir] [--quality 720] [--ffmpeg] [--skip-existing]
  ict api <path>

Global
  --json       machine-readable output (default for most commands)
  --dry-run    print requests without sending
  --base <u>   API base (default ${DEFAULT_BASE})
  --token <t>  Bearer token override
  --verbose    request logging

Env
  ICT_TOKEN       Bearer token override
  ICT_API_BASE    API base override
  ICT_PHONE       phone for automatic re-login on 401
  ICT_PASSWORD    password for automatic re-login on 401

A token lasts 180s, and any login replaces it. Set ICT_PHONE/ICT_PASSWORD to
let long commands re-login and retry once instead of failing at 180s.
Session: ${rel(SESSION_FILE)}
`;

async function main() {
  const { flags, positional } = parseArgs(process.argv.slice(2));
  if (flags.verbose) VERBOSE = true;
  const cmd = positional[0];
  if (!cmd || cmd === 'help' || flags.help) { process.stdout.write(USAGE); return; }

  switch (cmd) {
    case 'login': return cmdLogin(flags);
    case 'session': return cmdSession(flags, positional);
    case 'whoami': return cmdWhoami(flags);
    case 'lessons': return cmdLessons(flags);
    case 'lesson': return cmdLesson(flags, positional);
    case 'resolve': return cmdResolve(flags, positional);
    case 'download': return cmdDownload(flags, positional);
    case 'download-url': return cmdDownloadUrl(flags, positional);
    case 'download-lesson': return cmdDownloadLesson(flags, positional);
    case 'api': return cmdApi(flags, positional);
    default:
      fail(`Unknown command: ${cmd}`);
      process.stdout.write(USAGE);
      process.exit(EXIT.usage);
  }
}

main().catch((e) => {
  fail(e.message);
  if (VERBOSE && e.stack) console.error(e.stack);
  process.exit(e.code || EXIT.failed);
});
