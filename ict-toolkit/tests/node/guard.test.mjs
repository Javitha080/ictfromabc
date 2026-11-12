// guard.test.mjs — SPA navigation guard: history.pushState/replaceState pushes
// to /blocked are dropped before reaching the router; the counter is exposed
// via __ICT_API.pin().blockedBounces; popstate lands on /blocked bounce back.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeSandbox, loadBypass, flush, logText, findLog, initFailedEntry } from './helpers/sandbox.mjs';

function boot(opts = {}) {
  const s = makeSandbox(opts);
  loadBypass(s);
  assert.equal(initFailedEntry(s), undefined);
  assert.match(logText(s), /v3\.0\.2 armed — mode: standalone/);
  return s;
}

const pushCalls = (s) => s.__historyCalls.filter((c) => c.op === 'pushState');
const replaceCalls = (s) => s.__historyCalls.filter((c) => c.op === 'replaceState');

test('6a: pushState("/blocked") is suppressed and bumps blockedBounces', () => {
  const s = boot({ localStorage: { ict_pin: 'PIN-GUARD', ict_conf: '0.9' } });
  assert.equal(s.__ICT_API.pin().blockedBounces, 0);

  s.history.pushState({ route: 'blocked' }, '', '/blocked');

  assert.equal(pushCalls(s).length, 0, 'the router push must NOT reach the recorder');
  assert.equal(s.__ICT_API.pin().blockedBounces, 1, 'internal counter incremented');
  assert.ok(findLog(s, /blocked navigation to \/blocked via history\.pushState/));
  assert.ok(s.__notifications.some((n) => /Blocked bounce to \/blocked/.test(n.text || '')));
});

test('6b: pushState to a normal route reaches the recorder', () => {
  const s = boot({ localStorage: { ict_pin: 'PIN-GUARD', ict_conf: '0.9' } });

  s.history.pushState({ route: 'lessons' }, '', '/dashboard/lessons');

  assert.equal(pushCalls(s).length, 1, 'valid route passes through');
  assert.equal(pushCalls(s)[0].args[2], '/dashboard/lessons');
  assert.equal(s.__ICT_API.pin().blockedBounces, 0, 'counter untouched');
  assert.equal(findLog(s, /blocked navigation/), undefined);
});

test('6c: replaceState("/blocked") is suppressed too', () => {
  const s = boot({ localStorage: { ict_pin: 'PIN-GUARD', ict_conf: '0.9' } });

  s.history.replaceState({}, '', '/blocked');
  s.history.replaceState({}, '', '/dashboard');

  assert.equal(replaceCalls(s).length, 1, 'only the /dashboard replaceState passes');
  assert.equal(replaceCalls(s)[0].args[2], '/dashboard');
  assert.equal(s.__ICT_API.pin().blockedBounces, 1, 'the /blocked attempt counted once');
});

test('6d: exact-path matching — "/onboarding/blocked-notice" passes through (v3 fix)', () => {
  // v2 used /\/blocked\b/, which also matched any segment STARTING with
  // "blocked" (\b at the "d-" boundary) and silently dropped legitimate
  // navigations. v3 matches /blocked only as an exact path (or /blocked/...).
  const s = boot({ localStorage: { ict_pin: 'PIN-GUARD', ict_conf: '0.9' } });

  s.history.pushState({}, '', '/onboarding/blocked-notice');

  assert.equal(pushCalls(s).length, 1, 'legitimate route reaches the router');
  assert.equal(pushCalls(s)[0].args[2], '/onboarding/blocked-notice');
  assert.equal(s.__ICT_API.pin().blockedBounces, 0, 'counter untouched');
  assert.equal(findLog(s, /blocked navigation/), undefined);
});

test('6e: popstate landing on /blocked with pin/backup bounces back', () => {
  const s = boot({ localStorage: { ict_pin: 'PIN-POP', ict_conf: '0.9' } });
  s.location.pathname = '/blocked';

  s.__fireWindowEvent('popstate');

  assert.equal(s.__st.historyBack, true, 'history.back() invoked to escape /blocked');
  assert.ok(findLog(s, /popstate landed on \/blocked — bouncing back/));
});

test('6f: popstate on /blocked WITHOUT pin or backup stays put', () => {
  const s = boot(); // no pin, no backup
  s.location.pathname = '/blocked';

  s.__fireWindowEvent('popstate');

  assert.equal(s.__st.historyBack, false, 'nothing to protect — no bounce');
});

test('6g: popstate on a normal route does nothing', () => {
  const s = boot({ localStorage: { ict_pin: 'PIN-POP', ict_conf: '0.9' } });
  // pathname stays /dashboard

  s.__fireWindowEvent('popstate');

  assert.equal(s.__st.historyBack, false);
});
