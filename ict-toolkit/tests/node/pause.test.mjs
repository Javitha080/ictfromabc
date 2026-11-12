// pause.test.mjs — pause-bounce suppression (302 and body redirect_url ->
// /blocked), 422 fingerprint diagnostics, auto-pin capture (first-wins).
// v3 semantics: the fetch hook answers every pause bounce with a SYNTHETIC
// 200 {suppressed:true} — the real 302/redirect never reaches the caller or
// the site's own handler. Token preservation + suppression counter asserted.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  makeSandbox, loadBypass, flush, logText, findLog, callsOf, initFailedEntry, b64,
} from './helpers/sandbox.mjs';

const ORIGIN = 'https://www.ictfromabc.com';

function boot(opts = {}) {
  const s = makeSandbox(opts);
  loadBypass(s);
  assert.equal(initFailedEntry(s), undefined);
  assert.match(logText(s), /v3\.0\.2 armed — mode: standalone/);
  return s;
}

test('3a: 302 login answer with redirect_url /blocked -> intercepted, no crash, token survives', async () => {
  const s = boot({
    localStorage: { token: 'T|123' },
    responses: [{ status: 302, body: { redirect_url: '/blocked' } }],
  });

  // v3: the caller receives a synthetic 200 — the 302 pause never escapes the hook
  const resp = await s.fetch(ORIGIN + '/api/login', {
    method: 'POST',
    body: JSON.stringify({ phoneNumber: '0760000001', password: 'pw', visitorId: 'FP', confidenceScore: 0.9 }),
  });
  await flush();

  assert.equal(resp.status, 200, 'caller receives the synthetic 200, not the 302');
  assert.deepEqual(await resp.json(), { suppressed: true });
  assert.ok(findLog(s, /PAUSE BOUNCE suppressed/), 'pause branch logged');
  const notif = s.__notifications.find((n) => /Pause bounce suppressed/.test(n.text || ''));
  assert.ok(notif, 'GM_notification fired for the pause suppression');
  assert.equal(s.__ICT_API.pin().pauseBlocks, 1, 'suppression counter incremented');

  assert.equal(s.localStorage.getItem('token'), 'T|123', 'token in localStorage survives');
  assert.equal(s.__ICT_API.pin().blockedBounces, 0, 'no navigation was attempted');
  assert.equal(s.__reloads.length, 0);
});

test('3a-2: 302 with EMPTY body still intercepts (JSON parse tolerant)', async () => {
  const s = boot({ responses: [{ status: 302, body: '' }] });
  const resp = await s.fetch(ORIGIN + '/api/login', { method: 'POST', body: '{"visitorId":"FP"}' });
  await flush();
  assert.equal(resp.status, 200, 'empty-body 302 also suppressed to a synthetic 200');
  assert.deepEqual(await resp.json(), { suppressed: true });
  assert.ok(findLog(s, /PAUSE BOUNCE suppressed/));
  assert.equal(s.__ICT_API.pin().pauseBlocks, 1);
});

test('3b: 200 answer with body redirect_url /blocked -> intercepted and token backed up', async () => {
  const s = boot({
    localStorage: { token: 'T|123', role: 'STUDENT' },
    responses: [{ status: 200, body: { redirect_url: '/blocked' } }],
  });

  const resp = await s.fetch(ORIGIN + '/api/login', { method: 'POST', body: '{"visitorId":"FP"}' });
  await flush();

  assert.equal(resp.status, 200, 'the pause body answer becomes a synthetic 200');
  assert.deepEqual(await resp.json(), { suppressed: true });
  assert.ok(findLog(s, /PAUSE BOUNCE suppressed/), 'redirect_url branch logged');
  assert.ok(s.__notifications.some((n) => /Pause bounce suppressed — token preserved/.test(n.text || '')));
  assert.equal(s.__ICT_API.pin().pauseBlocks, 1);

  // status 200 also triggers backupTokens() before the inspection
  const backup = JSON.parse(s.__gm.get('ict_backup_token'));
  assert.equal(backup.token, 'T|123', 'token preserved into GM backup');
  assert.equal(backup.role, 'STUDENT');
});

test('3c: 422 with errors.visitorId fingerprint message -> diagnostics logged', async () => {
  const s = boot({
    responses: [{ status: 422, body: { message: 'Validation failed', errors: { visitorId: ['Please check your browser / fingerprint and try again'] } } }],
  });

  const resp = await s.fetch(ORIGIN + '/api/login', { method: 'POST', body: '{"visitorId":"BAD_FP"}' });
  await flush();

  assert.equal(resp.status, 422);
  const log = findLog(s, /422 fingerprint rejection/);
  assert.ok(log, '422 diagnostics logged');
  assert.ok(/check your browser/.test(JSON.stringify(log.args)), 'the server message is included');
  assert.ok(s.__notifications.some((n) => /422 fingerprint rejection/.test(n.text || '') && /no pin set/.test(n.text || '')),
    'notification mentions that no pin is set');
});

test('3d: 200 {token} after observed attempts with NO pin -> captures the FIRST attempt (first-wins)', async () => {
  const s = boot({
    responses: [
      { status: 200, body: {} },            // first login: observed but no token
      { status: 200, body: { token: 'T|123', role: 'STUDENT' } }, // second login: captures
    ],
  });

  // attempt 1 (no pin yet) — recorded FIRST; a later attempt must not overwrite it
  await s.fetch(ORIGIN + '/api/login', {
    method: 'POST',
    body: JSON.stringify({ phoneNumber: '0771234567', password: 'pw', visitorId: 'FP_FIRST', confidenceScore: 0.9 }),
  });
  await flush();
  assert.equal(s.__ICT_API.pin().pinnedVisitorId, 'NOT SET', 'no pin before a successful login');

  // attempt 2 with a different fingerprint — first-wins: it must NOT replace the
  // first observed attempt (the first one may be the one that succeeds).
  await s.fetch(ORIGIN + '/api/login', {
    method: 'POST',
    body: JSON.stringify({ phoneNumber: '0771234567', password: 'pw', visitorId: 'FP_LATEST', confidenceScore: 0.88 }),
  });
  await flush();

  const pin = JSON.parse(s.__gm.get('ict_pin'));
  assert.equal(pin.visitorId, 'FP_FIRST', 'pin captured from the FIRST observed attempt (first-wins)');
  assert.equal(pin.confidenceScore, 0.9);
  assert.ok(/auto-captured/.test(pin.source));
  assert.equal(s.__ICT_API.pin().pinnedVisitorId, 'FP_FIRST');
  assert.ok(findLog(s, /auto-pin captured/));
  assert.ok(s.__notifications.some((n) => /Pinned visitorId captured/.test(n.text || '')));
});

test('3e: 200 {token} with NO observed login attempt -> does NOT invent a pin', async () => {
  const s = boot({ responses: [{ status: 200, body: { token: 'T|123' } }] });
  await s.fetch(ORIGIN + '/api/user'); // non-login API 200 with token — irrelevant to capture
  await s.fetch(ORIGIN + '/api/login/otp', { method: 'POST', body: JSON.stringify({ otp: '1111', visitorId: 'FPX' }) });
  // noteLoginAttempt requires phoneNumber AND visitorId — this body has neither
  await flush();

  assert.equal(s.__ICT_API.pin().pinnedVisitorId, 'NOT SET');
});
