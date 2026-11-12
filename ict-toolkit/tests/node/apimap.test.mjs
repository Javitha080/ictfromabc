// apimap.test.mjs — console API integrity: method presence/shape, the embedded
// API map (parsed from the list() console output), parseSpec via call(), and
// the 8-endpoint quick battery.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeSandbox, loadBypass, flush, logText, findLog, callsOf, initFailedEntry } from './helpers/sandbox.mjs';

const ORIGIN = 'https://www.ictfromabc.com';
const VERBS = /^(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)$/;

function boot(opts = {}) {
  const s = makeSandbox(opts);
  loadBypass(s);
  assert.equal(initFailedEntry(s), undefined);
  assert.match(logText(s), /v3\.0\.2 armed — mode: standalone/);
  return s;
}

// Each API_MAP row is logged by list() as one console.log whose first arg is
//   '%c' + METHOD(padded) + '%c PATH' + '%c  [Category ·auth|·public]  description'
const ROW_RE = /^%c(\S+)\s*%c\s*(\S+)\s*%c\s+\[([^\]]+)\]\s*([\s\S]+)$/;

function parseRows(s, filter) {
  s.__ICT_API.list(filter);
  const rows = [];
  for (const l of s.__ictConsole.__logs) {
    const fmt = l.args[0];
    if (typeof fmt !== 'string') continue;
    const m = ROW_RE.exec(fmt);
    if (m) {
      const [cat, flag] = m[3].split('·').map((x) => x.trim());
      rows.push({ m: m[1], p: m[2], c: cat, a: flag === 'auth', d: m[4] });
    }
  }
  return rows;
}

test('5a: __ICT_API exposes every documented method as a function', () => {
  const s = boot();
  const api = s.__ICT_API;
  assert.equal(api.version, '3.0.2');
  assert.equal(api.mode, 'standalone');
  for (const name of ['help', 'list', 'call', 'quick', 'resolveVideo', 'pin', 'lesson', 'allowed', 'pdfs', 'pastPapers', 'watchdog', 'debug', 'log']) {
    assert.equal(typeof api[name], 'function', `__ICT_API.${name} must be a function`);
  }
  // menu wiring (12 commands registered at boot)
  assert.equal(s.__menu.length, 12);
});

test('5b: every map row has c/m/p/a/d, p starts with "/", m is an upper verb, pairs unique', () => {
  const s = boot();
  const rows = parseRows(s);
  assert.ok(rows.length > 80, `expected the full 86-entry map, got ${rows.length}`);

  for (const r of rows) {
    assert.ok(r.c && r.c.length, `row ${r.m} ${r.p}: category present`);
    assert.ok(VERBS.test(r.m), `row method "${r.m}" must be an uppercase HTTP verb`);
    assert.ok(r.p.startsWith('/'), `row path "${r.p}" must start with "/"`);
    assert.ok(typeof r.a === 'boolean', `row ${r.m} ${r.p}: auth flag present`);
    assert.ok(r.d && r.d.length >= 4, `row ${r.m} ${r.p}: description present`);
  }

  const key = (r) => r.m + ' ' + r.p;
  const uniq = new Set(rows.map(key));
  assert.equal(uniq.size, rows.length, 'method+path pairs must be unique');
});

test('5c: list("Admin") returns the /admin/ row and includes the RBAC note', () => {
  const s = boot();
  const out = s.__ICT_API.list('Admin');
  assert.ok(Array.isArray(out) && out.length >= 1);
  assert.ok(out.some((r) => /\/admin\//.test(r)), 'returned rows mention /admin/ paths');

  const text = logText(s);
  assert.ok(/403/.test(text), 'RBAC note (STUDENT -> 403) is printed');
  assert.ok(/Unauthorized/.test(text), 'the live-verified role-gate result is included');
});

test('5d: call() parseSpec — "/user" and "GET /user" hit APEX + /api + path (v3.0.2: API_BASE is the apex origin, the only host that validates Bearer tokens)', async () => {
  const s = boot({ responses: [{ status: 200, body: {} }, { status: 200, body: {} }] });

  const r1 = await s.__ICT_API.call('/user');
  assert.equal(r1.status, 200);
  assert.deepEqual(r1.body, {});

  let c = callsOf(s, { urlRe: /\/api\/user$/ });
  assert.equal(c.length, 1);
  assert.equal(c[0].url, 'https://ictfromabc.com/api/user');
  assert.equal(c[0].method, 'GET');
  assert.equal(c[0].init.headers.Accept, 'application/json');

  const r2 = await s.__ICT_API.call('GET /user');
  c = callsOf(s, { urlRe: /\/api\/user$/ });
  assert.equal(c.length, 2);
  assert.equal(c[1].url, 'https://ictfromabc.com/api/user', 'same absolute URL for both spellings');
  assert.equal(c[1].method, 'GET');
  assert.equal(r2.status, 200);

  // method extraction from "POST /reviews"
  s.__nextResponses.push({ status: 200, body: {} });
  await s.__ICT_API.call('POST /reviews', { rating: 5 });
  const post = callsOf(s, { method: 'POST', urlRe: /\/api\/reviews$/ });
  assert.equal(post.length, 1);
  assert.equal(post[0].url, 'https://ictfromabc.com/api/reviews');
  assert.equal(post[0].bodyText, JSON.stringify({ rating: 5 }));
});

test('5e: quick() runs the 10 QUICK_PATHS against the stub and returns 10 rows', async () => {
  const s = boot();
  const out = await s.__ICT_API.quick();

  assert.equal(out.length, 10, 'the live-verified battery has 10 endpoints');
  for (const row of out) {
    assert.equal(typeof row.status, 'number', `row ${row.path} got status ${row.status}`);
    assert.equal(row.status, 200);
    assert.ok(row.path.startsWith('/'));
  }
  assert.equal(s.__calls.length, 10, 'each row is one backend call (stubbed, offline)');
  assert.ok(s.__ictConsole.__logs.some((l) => l.level === 'table'), 'results are presented via console.table');
  const paths = out.map((r) => r.path);
  assert.ok(paths.includes('/admin/courses'), 'the deliberate RBAC check is part of the battery');
});
