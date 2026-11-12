// Probe: (a) does a second login invalidate the first token? (b) what is the idle TTL?
// Usage: node token-lifetime.mjs <phone> <password>
const [phone, password] = process.argv.slice(2);
const API = 'https://ictfromabc.com/api';
const FP = { visitorId: 'CWUriseStUq30ANV6hIt', confidenceScore: 0.97 };

const login = async () => {
  const r = await fetch(`${API}/login`, {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json' },
    body: JSON.stringify({ phoneNumber: phone, password, ...FP })
  });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, token: j.token || null, msg: j.msg || j.message };
};

const probe = async (token) => {
  if (!token) return 'no-token';
  const r = await fetch(`${API}/user`, {
    headers: { accept: 'application/json', authorization: `Bearer ${token}` }
  });
  await r.text();
  return r.status;
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const t0 = Date.now();
const stamp = () => `${((Date.now() - t0) / 1000).toFixed(0)}s`;

const A = await login();
console.log(`${stamp()} login A -> ${A.status} ${A.msg || ''}`);
console.log(`${stamp()} A   -> ${await probe(A.token)}`);

const B = await login();
console.log(`${stamp()} login B -> ${B.status} ${B.msg || ''}`);
console.log(`${stamp()} A after B -> ${await probe(A.token)}`);
console.log(`${stamp()} B         -> ${await probe(B.token)}`);

for (const wait of [30000, 30000, 35000]) {
  await sleep(wait);
  console.log(`${stamp()} A -> ${await probe(A.token)}   B -> ${await probe(B.token)}`);
}

// A third login, then immediately re-probe B: distinguishes TTL from rebind.
const C = await login();
console.log(`${stamp()} login C -> ${C.status}`);
console.log(`${stamp()} B after C -> ${await probe(B.token)}   C -> ${await probe(C.token)}`);
