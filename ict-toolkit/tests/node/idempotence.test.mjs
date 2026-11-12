// idempotence.test.mjs — running the userscript source twice in the SAME
// sandbox must be a no-op the second time: the guard `if (W.__ICT_BYPASS) return`
// exits before any hooking, so armedAt / api identity / fetch wrapper all stay
// from the FIRST load.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeSandbox, loadBypass, flush, readSource, callsOf, initFailedEntry, logText } from './helpers/sandbox.mjs';

const SOURCE = readSource();
const ORIGIN = 'https://www.ictfromabc.com';

test('7a: second load returns early — armedAt, api identity and fetch wrapper unchanged', async () => {
  const s = makeSandbox({ localStorage: { ict_pin: 'PIN-IDEM', ict_conf: '0.9' } });

  loadBypass(s, SOURCE);
  const armedAt1 = s.__ICT_BYPASS.armedAt;
  const api1 = s.__ICT_API;
  const fetch1 = s.fetch;
  const xhrProto1 = Object.getOwnPropertyDescriptor(s.XMLHttpRequest.prototype, 'send').value;

  s.__clock.advance(1000); // a re-arm would stamp a different armedAt

  loadBypass(s, SOURCE); // second run in the same sandbox

  assert.equal(s.__ICT_BYPASS.armedAt, armedAt1, '__ICT_BYPASS keeps the FIRST armedAt');
  assert.equal(s.__ICT_API, api1, '__ICT_API object identity preserved');
  assert.equal(s.fetch, fetch1, 'fetch NOT re-wrapped (same reference)');
  assert.equal(Object.getOwnPropertyDescriptor(s.XMLHttpRequest.prototype, 'send').value, xhrProto1,
    'XHR send prototype not re-wrapped');
  assert.equal(s.fetch.__ictHooked, true, 'single-hook marker intact');
  assert.equal(s.XMLHttpRequest.prototype.__ictHooked, true);

  // behavior proof: one hooked call == exactly one backend call
  s.__nextResponses.push({ status: 200, body: {} });
  await s.fetch(ORIGIN + '/api/user');
  await flush();
  assert.equal(callsOf(s, { urlRe: /\/api\/user$/ }).length, 1, 'no double-send through stacked hooks');

  // second load produced no new logs after the first boot
  const installs = s.__ictConsole.__logs.filter((l) => /fetch hook installed/.test(l.text)).length;
  assert.equal(installs, 1, 'installFetchHook logged exactly once across both loads');
  assert.equal(initFailedEntry(s), undefined);
});

test('7b: the guard object is stamped before any other work', () => {
  const s = makeSandbox({ href: 'https://metrics.ictfromabc.com/x' });
  loadBypass(s, SOURCE);
  // even on the metrics host (early return path) the stamp exists
  assert.equal(typeof s.__ICT_BYPASS.armedAt, 'number');
  assert.equal(s.__ICT_BYPASS.v, '3.0.2');
  assert.equal(s.__ICT_API, undefined, 'metrics host: observing only, no console API');
  assert.match(logText(s), /metrics\.ictfromabc\.com hit/);
});

test('7c: double-arm via a second sandbox is independent (fresh module state each time)', async () => {
  const s1 = makeSandbox({ localStorage: { ict_pin: 'PIN-A', ict_conf: '0.9' } });
  const s2 = makeSandbox({ localStorage: { ict_pin: 'PIN-B', ict_conf: '0.9' } });
  loadBypass(s1, SOURCE);
  loadBypass(s2, SOURCE);
  assert.notEqual(s1.__ICT_BYPASS.armedAt, undefined);
  assert.notEqual(s2.__ICT_BYPASS.armedAt, undefined);
  assert.equal(s1.__ICT_API.pin().pinnedVisitorId, 'PIN-A');
  assert.equal(s2.__ICT_API.pin().pinnedVisitorId, 'PIN-B');
  assert.ok(s1.__ICT_API !== s2.__ICT_API);
});
