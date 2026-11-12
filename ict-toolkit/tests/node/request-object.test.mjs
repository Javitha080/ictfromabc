// request-object.test.mjs — REGRESSION TEST for the Request-object path.
// The hook must clone the Request, read its body, rewrite, rebuild — and NEVER
// send the original Request twice (a raw-fingerprint login re-enrolls/re-locks).
// 2a Request + raw fp body -> exactly ONE backend call carrying the PINNED pair
// 2b clone-ok-but-text()-rejects -> FAIL-CLOSED (v3 fix): the promise rejects
//    with the original TypeError and ZERO backend calls — v2 "gracefully"
//    re-sent the ORIGINAL unpinned Request, the exact leak this prevents
// 2c clone() throwing SYNCHRONOUSLY -> fail-closed too (v3 fix): caught, logged,
//    rejected with a suppression TypeError — v2 crashed the caller's fetch
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeSandbox, loadBypass, flush, logText, findLog, callsOf, initFailedEntry } from './helpers/sandbox.mjs';

const ORIGIN = 'https://www.ictfromabc.com';
const LOGIN_URL = ORIGIN + '/api/login';
const RAW = JSON.stringify({ phoneNumber: '0760000001', password: 'pw', visitorId: 'RAW_FINGERPRINT', confidenceScore: 0.11 });
const PIN = 'PIN-REQ-777';

function boot() {
  const s = makeSandbox({ localStorage: { ict_pin: PIN, ict_conf: '0.93' } });
  loadBypass(s);
  assert.equal(initFailedEntry(s), undefined);
  assert.match(logText(s), /v3\.0\.2 armed — mode: standalone/);
  return s;
}

function makeLoginRequest(s) {
  return new s.Request(LOGIN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: RAW,
  });
}

test('2a: Request input with raw fingerprint -> exactly ONE backend fetch, PINNED body', async () => {
  const s = boot();

  const req = makeLoginRequest(s);
  const resp = await s.fetch(req);
  await flush();

  assert.equal(resp.status, 200);
  const calls = callsOf(s, { method: 'POST', urlRe: /\/api\/login$/ });
  assert.equal(s.__calls.length, 1, 'exactly one backend fetch call total (no double-send)');
  assert.equal(calls.length, 1);

  const sent = JSON.parse(calls[0].bodyText);
  assert.equal(sent.visitorId, PIN, 'outgoing body carries the pinned visitorId');
  assert.equal(sent.confidenceScore, 0.93, 'outgoing body carries the pinned confidenceScore');
  assert.equal(sent.phoneNumber, '0760000001');

  assert.ok(findLog(s, /rewrote Request body/), 'Request-path rewrite must be logged');
  assert.equal(findLog(s, /rewrote request body/), undefined, 'init-body path must not be the one logging');
  assert.ok(findLog(s, /login attempt observed/), 'login attempt still observed on Request path');
});

test('2b: Request whose clone().text() rejects -> fail-closed: rejects, ZERO backend calls', async () => {
  // v3 never sends a body it could not read — an unpinned login is the one
  // mistake that re-enrolls the fingerprint and re-locks the account.
  const s = boot();

  const req = makeLoginRequest(s);
  req.clone = () => ({ text: () => Promise.reject(new TypeError('body stream disturbed')) });

  await assert.rejects(() => s.fetch(req), TypeError, 'the original rejection propagates to the caller');
  await flush();
  assert.equal(s.__calls.length, 0, 'fail-closed: nothing was sent');
});

test('2c: Request whose clone() throws synchronously -> fail-closed rejection, ZERO backend calls', async () => {
  // v3 catches the sync throw inside the hook, logs the suppression, and
  // rejects with a fingerprint-protection TypeError (v2 crashed the caller).
  const s = boot();

  const req = makeLoginRequest(s);
  Object.defineProperty(req, 'clone', { value() { throw new TypeError('already used'); } });

  await assert.rejects(() => s.fetch(req), /unreadable login body/,
    'suppression TypeError carries the fail-closed reason');
  await flush();
  assert.equal(s.__calls.length, 0, 'no backend call happened');
  assert.ok(findLog(s, /request suppressed \(fail-closed\)/), 'suppression logged');
});
