// xhr.test.mjs — the XMLHttpRequest twin of the fetch hook: body rewrite at
// send time and load-event inspection (401 -> relogin, pause-bounce neutralized).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  makeSandbox, loadBypass, flush, logText, findLog, callsOf, initFailedEntry, b64,
} from './helpers/sandbox.mjs';

const ORIGIN = 'https://www.ictfromabc.com';
const PIN = 'PIN-XHR';
const CONF = 0.95;
const CREDS = b64('0760000001\nPassw0rd#');

function boot(opts = {}) {
  const s = makeSandbox(opts);
  loadBypass(s);
  assert.equal(initFailedEntry(s), undefined);
  assert.match(logText(s), /v3\.0\.2 armed — mode: standalone/);
  return s;
}

test('8a: XHR POST /api/login body is rewritten to the pinned pair', () => {
  const s = boot({ localStorage: { ict_pin: PIN, ict_conf: String(CONF) } });
  assert.equal(s.XMLHttpRequest.prototype.__ictHooked, true, 'XHR prototype hooked');

  const xhr = new s.XMLHttpRequest();
  xhr.open('POST', '/api/login');
  xhr.send(JSON.stringify({ phoneNumber: '0760000001', password: 'pw', visitorId: 'RAW_XHR_FP', confidenceScore: 0.2 }));

  assert.equal(s.__xhr.length, 1, 'exactly one backend XHR send');
  const rec = s.__xhr[0];
  assert.equal(rec.method, 'POST');
  assert.equal(rec.url, '/api/login');
  const sent = JSON.parse(rec.bodyText);
  assert.equal(sent.visitorId, PIN, 'outgoing XHR body carries the pinned visitorId');
  assert.equal(sent.confidenceScore, CONF, 'outgoing XHR body carries the pinned confidenceScore');
  assert.equal(sent.phoneNumber, '0760000001');
  assert.ok(findLog(s, /rewrote XHR body/));
  assert.ok(findLog(s, /login attempt observed/), 'XHR login attempt observed too');
});

test('8b: XHR 401 on /api/user with saved creds -> relogin POST via hooked fetch; on 200 -> token + reload', async () => {
  const s = boot({
    gm: { ict_bypass_creds: CREDS },
    localStorage: { ict_pin: PIN, ict_conf: String(CONF) },
    responses: [{ status: 200, body: { token: 'XHR|fresh-token', role: 'STUDENT' } }],
  });

  const xhr = new s.XMLHttpRequest();
  xhr.open('GET', '/api/user');
  xhr.send(); // hook registers the load listener because the URL is an /api/ path

  xhr.status = 401;
  xhr.responseText = '{"msg":"Unauthenticated."}';
  xhr.responseURL = ORIGIN + '/api/user';
  xhr.__ictFire('load');
  await flush();

  const posts = callsOf(s, { method: 'POST', urlRe: /\/api\/login$/ });
  assert.equal(posts.length, 1, 'the 401 load event triggered exactly one relogin POST');
  const sent = JSON.parse(posts[0].bodyText);
  assert.equal(sent.visitorId, PIN, 'relogin body pinned');
  assert.equal(sent.phoneNumber, '0760000001');
  assert.equal(sent.password, 'Passw0rd#');

  await flush();
  assert.equal(s.localStorage.getItem('token'), 'XHR|fresh-token', 'fresh token adopted after XHR-triggered relogin');
  assert.equal(s.__reloads.length, 1, 'reload flagged');
});

test('8c: XHR load with 302 pause-bounce -> PauseBounceError neutralized, no crash', () => {
  const s = boot({ responses: [{ status: 302, body: { redirect_url: '/blocked' } }] });

  const xhr = new s.XMLHttpRequest();
  xhr.open('POST', '/api/login');
  xhr.send('{"visitorId":"FP"}');

  xhr.status = 302;
  xhr.responseText = JSON.stringify({ redirect_url: '/blocked' });
  xhr.responseURL = ORIGIN + '/api/login';
  xhr.__ictFire('load'); // must not throw despite PauseBounceError inside

  assert.ok(findLog(s, /XHR pause bounce neutralized/), 'pause error caught and logged');
  assert.ok(findLog(s, /PAUSE BOUNCE intercepted/));
});

test('8d: XHR with no body / non-API URL -> untouched passthrough', () => {
  const s = boot({ localStorage: { ict_pin: PIN, ict_conf: String(CONF) } });

  const xhr = new s.XMLHttpRequest();
  xhr.open('GET', 'https://cdn.example.com/lib.js');
  xhr.send();

  assert.equal(s.__xhr.length, 1);
  assert.equal(s.__xhr[0].body, undefined);
  assert.equal(findLog(s, /rewrote/), undefined, 'no rewrite for non-API URLs');

  const xhr2 = new s.XMLHttpRequest();
  xhr2.open('POST', '/api/other');
  xhr2.send('plain text body');
  assert.equal(s.__xhr[1].bodyText, 'plain text body', 'non-JSON body passes unchanged');
});

test('8e: XHR load 200 on an /api/ path backs up the token seen in localStorage', () => {
  const s = boot({ localStorage: { ict_pin: PIN, ict_conf: String(CONF) } });

  const xhr = new s.XMLHttpRequest();
  xhr.open('GET', '/api/user');
  xhr.send();
  s.localStorage.setItem('token', 'XHR|live-token');
  s.localStorage.setItem('role', 'STUDENT');

  xhr.status = 200;
  xhr.responseText = '{}';
  xhr.responseURL = ORIGIN + '/api/user';
  xhr.__ictFire('load');

  const backup = JSON.parse(s.__gm.get('ict_backup_token'));
  assert.equal(backup.token, 'XHR|live-token', 'token backed up on 200 via XHR');
  assert.equal(backup.role, 'STUDENT');
});
