// Measure the age at which a fresh token stops working, twice in a row.
// A consistent age = server TTL. A random age = another client logged in.
// Usage: node token-age.mjs <phone> <password>
const [phone, password, runsArg] = process.argv.slice(2);
const runs = Math.max(1, Number(runsArg) || 2);
const API = 'https://ictfromabc.com/api';
const FP = { visitorId: 'CWUriseStUq30ANV6hIt', confidenceScore: 0.97 };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function login() {
  const r = await fetch(`${API}/login`, {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json' },
    body: JSON.stringify({ phoneNumber: phone, password, ...FP })
  });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, token: j.token || null };
}

async function probe(token) {
  const r = await fetch(`${API}/user`, {
    headers: { accept: 'application/json', authorization: `Bearer ${token}` }
  });
  await r.text();
  return r.status;
}

for (let run = 0; run < runs; run++) {
  const label = String.fromCharCode(65 + run);
  const { status, token } = await login();
  const t0 = Date.now();
  console.log(`${label} login ${status} at ${new Date(t0).toISOString()}`);
  if (!token) { console.log(`${label} no token, stop`); break; }
  for (let age = 0; age <= 300; age += 10) {
    const wait = t0 + age * 1000 - Date.now();
    if (wait > 0) await sleep(wait);
    const s = await probe(token);
    console.log(`${label} ${age}s -> ${s}`);
    if (s === 401) break;
  }
  await sleep(2000);
}
