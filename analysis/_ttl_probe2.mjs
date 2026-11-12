// Controlled token-liveness probe.
// After one login, alternates full-header vs minimal-header GETs on a tight
// schedule so we can tell "needs Origin/Referer" apart from "revoked over time".
const HOST = 'https://ictfromabc.com/api';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const login = await fetch(HOST + '/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'User-Agent': UA,
             Origin: 'https://ictfromabc.com', Referer: 'https://ictfromabc.com/auth/login' },
  body: JSON.stringify({ phoneNumber: process.env.ICT_PHONE||'', password: process.env.ICT_PASS||'',
                         visitorId: 'CWUriseStUq30ANV6hIt', confidenceScore: 0.97 }),
  redirect: 'manual'
});
const lj = await login.json().catch(() => null);
console.log(`login -> ${login.status}  token=${lj && lj.token ? lj.token.split('|')[0] : 'NONE'}  rl=${login.headers.get('x-ratelimit-remaining')}`);
if (!lj || !lj.token) { console.log(JSON.stringify(lj)); process.exit(1); }
const token = lj.token;
const t0 = Date.now();

const get = async (full) => {
  const h = { Authorization: 'Bearer ' + token, Accept: 'application/json', 'User-Agent': UA };
  if (full) { h.Origin = 'https://ictfromabc.com'; h.Referer = 'https://ictfromabc.com/dashboard/myLessons'; }
  const r = await fetch(HOST + '/user', { headers: h });
  return `${r.status}`;
};

// t=0 baseline, both header styles back-to-back
console.log(`t=0    full=${await get(true)}  minimal=${await get(false)}`);

for (let i = 1; i <= 12; i++) {
  await new Promise(r => setTimeout(r, 5000));
  const secs = ((Date.now() - t0) / 1000).toFixed(0);
  const full = await get(true);
  const minimal = await get(false);
  console.log(`t=${String(secs).padStart(3)}s  full=${full}  minimal=${minimal}`);
  if (full !== '200' && minimal !== '200') { console.log(`BOTH DEAD at ~${secs}s`); break; }
}
