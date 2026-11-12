// rewrite.test.mjs — body rewriter via the hooked fetch.
// 1a login JSON rewritten to the pinned pair (pin preset in localStorage BEFORE load)
// 1b nested objects rewritten
// 1c no pin -> body untouched
// 1d non-login JSON with visitorId STILL rewritten (rewriter targets any JSON body)
// 1e URLSearchParams login body: rewritten IN PLACE, kept urlencoded (v3 fix — v2 shipped it raw)
// 1f GET requests untouched
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  makeSandbox, loadBypass, flush, logText, findLog, callsOf, initFailedEntry, logText as _lt,
} from './helpers/sandbox.mjs';

const ORIGIN = 'https://www.ictfromabc.com';
const LOGIN_URL = ORIGIN + '/api/login';

function assertCleanBoot(t, s) {
  assert.equal(initFailedEntry(s), undefined, 'sandbox init must not fail');
  assert.match(logText(s), /v3\.0\.2 armed — mode: standalone/);
}

test('1a: login body with raw fingerprint is rewritten to the pinned pair', async () => {
  const s = makeSandbox({ localStorage: { ict_pin: 'PIN-ALPHA-999', ict_conf: '0.91' } });
  loadBypass(s);
  assertCleanBoot(0, s);

  const resp = await s.fetch(LOGIN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phoneNumber: '0760000001', password: 'pw', visitorId: 'RAW_FINGERPRINT', confidenceScore: 0.1 }),
  });
  await flush();
  assert.equal(resp.status, 200);

  const calls = callsOf(s, { method: 'POST', urlRe: /\/api\/login$/ });
  assert.equal(calls.length, 1);
  const sent = JSON.parse(calls[0].bodyText);
  assert.equal(sent.visitorId, 'PIN-ALPHA-999');
  assert.equal(sent.confidenceScore, 0.91);
  assert.equal(sent.phoneNumber, '0760000001');
  assert.equal(sent.password, 'pw');

  assert.ok(findLog(s, /rewrote request body/), 'hook must log the rewrite');
  assert.ok(findLog(s, /login attempt observed/), 'hook must observe login attempts');
  const obs = findLog(s, /login attempt observed/);
  const obsData = JSON.stringify(obs.args);
  assert.ok(/076\*\*\*\*001/.test(obsData), 'phone number must be masked in the log');
  assert.ok(/"pinnedByRewrite":true/.test(obsData), 'observed attempt must say it was pinned');
});

test('1b: nested visitorId/confidenceScore inside a JSON body is rewritten', async () => {
  const s = makeSandbox({ localStorage: { ict_pin: 'PIN-NEST', ict_conf: '0.77' } });
  loadBypass(s);
  assertCleanBoot(0, s);

  await s.fetch(ORIGIN + '/api/login/otp', {
    method: 'POST',
    body: JSON.stringify({
      otp: '4242',
      device: { id: 'd1', fingerprint: { visitorId: 'RAW_NESTED', confidenceScore: 0.3, extra: { visitorId: 'RAW_DEEP' } } },
    }),
  });
  await flush();

  const calls = callsOf(s, { method: 'POST', urlRe: /\/api\/login\/otp$/ });
  assert.equal(calls.length, 1);
  const sent = JSON.parse(calls[0].bodyText);
  assert.equal(sent.device.fingerprint.visitorId, 'PIN-NEST');
  assert.equal(sent.device.fingerprint.confidenceScore, 0.77);
  assert.equal(sent.device.fingerprint.extra.visitorId, 'PIN-NEST', 'deeply nested visitorId also rewritten');
  assert.equal(sent.otp, '4242', 'unrelated keys untouched');
});

test('1c: with NO pin set, the body is sent unchanged', async () => {
  const s = makeSandbox();
  loadBypass(s);
  assertCleanBoot(0, s);
  assert.equal(s.__ICT_API.pin().pinnedVisitorId, 'NOT SET');

  const raw = JSON.stringify({ phoneNumber: '0771234567', password: 'pw', visitorId: 'RAW_FP', confidenceScore: 0.5 });
  await s.fetch(LOGIN_URL, { method: 'POST', body: raw });
  await flush();

  const calls = callsOf(s, { method: 'POST', urlRe: /\/api\/login$/ });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].bodyText, raw, 'body must be byte-identical when no pin exists');
  assert.equal(findLog(s, /rewrote request body/), undefined, 'no rewrite log without a pin');
  assert.ok(findLog(s, /login attempt observed/), 'attempt still observed');
});

test('1d: non-login JSON body (POST /api/reviews) with visitorId is ALSO rewritten', async () => {
  const s = makeSandbox({ localStorage: { ict_pin: 'PIN-REV', ict_conf: '0.82' } });
  loadBypass(s);
  assertCleanBoot(0, s);

  await s.fetch(ORIGIN + '/api/reviews', {
    method: 'POST',
    body: JSON.stringify({ rating: 5, comment: 'ok', visitorId: 'RAW_FP' }),
  });
  await flush();

  const calls = callsOf(s, { method: 'POST', urlRe: /\/api\/reviews$/ });
  assert.equal(calls.length, 1);
  const sent = JSON.parse(calls[0].bodyText);
  assert.equal(sent.visitorId, 'PIN-REV', 'rewriter targets ANY JSON body carrying visitorId');
  assert.equal(sent.rating, 5);
  assert.ok(findLog(s, /rewrote request body/));
  assert.equal(findLog(s, /login attempt observed/), undefined, 'non-login path must not mark a login attempt');
});

test('1e: URLSearchParams login body is rewritten IN PLACE (kept urlencoded)', async () => {
  // v2 shipped urlencoded logins raw (rewriteBody only accepted JSON) — a raw
  // fingerprint leak on any non-JSON login path. v3 rewrites the params in
  // place and keeps the urlencoded encoding (no Content-Type override).
  const s = makeSandbox({ localStorage: { ict_pin: 'PIN-USP', ict_conf: '0.9' } });
  loadBypass(s);
  assertCleanBoot(0, s);

  const params = new s.URLSearchParams();
  params.set('phoneNumber', '0760000001');
  params.set('password', 'pw');
  params.set('visitorId', 'RAW_FP');
  params.set('confidenceScore', '0.44');

  await s.fetch(LOGIN_URL, { method: 'POST', body: params });
  await flush();

  const calls = callsOf(s, { method: 'POST', urlRe: /\/api\/login$/ });
  assert.equal(calls.length, 1);
  const sent = new URLSearchParams(calls[0].bodyText);
  assert.equal(sent.get('visitorId'), 'PIN-USP', 'visitorId pinned in the urlencoded body');
  assert.equal(sent.get('confidenceScore'), '0.9', 'confidenceScore pinned');
  assert.equal(sent.get('phoneNumber'), '0760000001', 'unrelated fields untouched');
  assert.equal(sent.get('password'), 'pw');
  assert.equal(calls[0].headers, undefined, 'no Content-Type override — body stays urlencoded');
  assert.ok(findLog(s, /rewrote urlencoded login body/), 'urlencoded rewrite logged');
  assert.equal(findLog(s, /rewrote request body/), undefined, 'the JSON-path log must not be used');
  assert.ok(findLog(s, /login attempt observed/), 'urlencoded login attempt still observed');
});

test('1f: GET requests are untouched (no body, no rewrite)', async () => {
  const s = makeSandbox({ localStorage: { ict_pin: 'PIN-GET', ict_conf: '0.8' } });
  loadBypass(s);
  assertCleanBoot(0, s);

  const resp = await s.fetch(ORIGIN + '/api/user', { method: 'GET', headers: { Accept: 'application/json' } });
  await flush();

  assert.equal(resp.status, 200);
  const calls = callsOf(s, { method: 'GET', urlRe: /\/api\/user$/ });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].body, undefined, 'GET must carry no body');
  assert.equal(findLog(s, /rewrote/), undefined, 'no rewrite activity for GETs');
});
