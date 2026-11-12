// reauth.test.mjs — standalone-mode auto-relogin state machine:
// 4a no saved creds -> no relogin attempt on a real 401
// 4b creds saved -> 401 triggers a pinned POST /api/login; 200 {token} sets
//    localStorage.token/role and flags location.reload()
// 4c 45 s cooldown: a second 401 shortly after -> NO second login POST
// 4d fail cap: five failed logins (403 answers) -> a sixth trigger is inert
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  makeSandbox, loadBypass, flush, logText, findLog, callsOf, initFailedEntry, b64,
} from './helpers/sandbox.mjs';

const ORIGIN = 'https://www.ictfromabc.com';
const PIN = 'PIN-REAUTH';
const CONF = 0.92;
const CREDS = b64('0760000001\nPassw0rd#');

function boot(opts = {}) {
  const s = makeSandbox(opts);
  loadBypass(s);
  assert.equal(initFailedEntry(s), undefined);
  assert.match(logText(s), /v3\.0\.2 armed — mode: standalone/);
  return s;
}

const withCreds = { gm: { ict_bypass_creds: CREDS }, localStorage: { ict_pin: PIN, ict_conf: String(CONF) } };

function loginPosts(s) {
  return callsOf(s, { method: 'POST', urlRe: /\/api\/login$/ });
}

test('4a: no saved creds -> 401 on an API path does NOT trigger a login POST', async () => {
  const s = boot({ localStorage: { ict_pin: PIN, ict_conf: String(CONF) } }); // pin but no creds
  s.__nextResponses.push({ status: 401, body: '' });

  await s.fetch(ORIGIN + '/api/user');
  await flush();

  assert.equal(loginPosts(s).length, 0, 'reauth must bail before any network call');
  assert.equal(s.__calls.length, 1, 'only the original 401 call happened');
});

test('4b: 401 with saved creds -> pinned login POST; on 200 {token} -> localStorage + reload', async () => {
  const s = boot({
    ...withCreds,
    responses: [
      { status: 401, body: '' },
      { status: 200, body: { token: 'NEWTOKEN|12345678', role: 'STUDENT' } },
    ],
  });

  await s.fetch(ORIGIN + '/api/user'); // the real 401
  await flush(); // reauth fires (not awaited by the hook)

  const posts = loginPosts(s);
  assert.equal(posts.length, 1, 'exactly one relogin POST');
  assert.equal(posts[0].url, 'https://ictfromabc.com/api/login');
  const sent = JSON.parse(posts[0].bodyText);
  assert.equal(sent.phoneNumber, '0760000001');
  assert.equal(sent.password, 'Passw0rd#');
  assert.equal(sent.visitorId, PIN, 'relogin body carries the PINNED visitorId');
  assert.equal(sent.confidenceScore, CONF);
  assert.equal(posts[0].init.headers['Content-Type'], 'application/json');

  await flush(); // response processing (localStorage writes happen before reload)

  assert.equal(s.localStorage.getItem('token'), 'NEWTOKEN|12345678', 'fresh token adopted');
  assert.equal(s.localStorage.getItem('role'), 'STUDENT');
  assert.equal(s.__reloads.length, 1, 'location.reload flagged so the SPA adopts the fresh token');
  assert.ok(findLog(s, /taking the session back \(401 \/api\/user\)/));
  assert.ok(findLog(s, /session restored/));
  assert.equal(JSON.parse(s.__gm.get('ict_backup_token')).token, 'NEWTOKEN|12345678', 'fresh token backed up');
});

test('4c: cooldown — a second 401 within 45 s triggers NO second login POST', async () => {
  const s = boot({
    ...withCreds,
    responses: [
      { status: 401, body: '' },
      { status: 200, body: { token: 'NEWTOKEN|12345678', role: 'STUDENT' } },
      { status: 401, body: '' },
    ],
  });

  await s.fetch(ORIGIN + '/api/user'); // 401 #1 -> successful relogin
  await flush();
  assert.equal(loginPosts(s).length, 1);
  assert.equal(s.__reloads.length, 1);

  await s.fetch(ORIGIN + '/api/user'); // 401 #2 within the 45 s window (real clock: ms apart)
  await flush();
  assert.equal(loginPosts(s).length, 1, 'cooldown blocks the second attempt');
  assert.equal(s.__reloads.length, 1);
  assert.equal(s.__calls.length, 3, 'no hidden extra calls');
});

test('4d: fail cap — five failed logins then the trigger becomes inert', async () => {
  const s = boot(withCreds);

  const trigger = async () => {
    s.__nextResponses.push({ status: 401, body: '' }, { status: 403, body: { msg: 'Unauthorized' } });
    await s.fetch(ORIGIN + '/api/user');
    await flush();
  };

  for (let i = 1; i <= 5; i++) {
    s.__clock.advance(46_000); // out of the 45 s cooldown window each time
    await trigger();
    assert.equal(loginPosts(s).length, i, `attempt ${i} produced a login POST`);
  }

  assert.ok(findLog(s, /auto-relogin HTTP 403/), 'each 403 answer is logged');

  // sixth trigger: fail cap hit — no sixth POST, one cap log
  s.__clock.advance(46_000);
  s.__nextResponses.push({ status: 401, body: '' });
  await s.fetch(ORIGIN + '/api/user');
  await flush();

  assert.equal(loginPosts(s).length, 5, 'sixth trigger is inert');
  const caps = logText(s).match(/auto-relogin stopped: 5 failed attempts/g);
  assert.equal(caps && caps.length, 1, 'cap message logged exactly once');
});

test('4e: relogin on /blocked is skipped by design', async () => {
  const s = boot({ ...withCreds, href: 'https://www.ictfromabc.com/blocked' });
  assert.match(logText(s), /landed on \/blocked/);
  s.__nextResponses.push({ status: 401, body: '' });

  await s.fetch(ORIGIN + '/api/user');
  await flush();

  assert.equal(loginPosts(s).length, 0, 'paused accounts need staff unlock — relogin suppressed');
});
