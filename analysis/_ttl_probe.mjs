// Measures how long a freshly-minted /api/login token stays valid.
// One login, then poll /api/user on a fixed interval until it 401s.
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
console.log(`t=0    login -> ${login.status}  token=${lj && lj.token ? lj.token.split('|')[0] : 'NONE'}`);
if (!lj || !lj.token) { console.log('login failed', JSON.stringify(lj)); process.exit(1); }

const token = lj.token;
const t0 = Date.now();
for (let i = 1; i <= 24; i++) {
  await new Promise(r => setTimeout(r, 10000));
  const secs = ((Date.now() - t0) / 1000).toFixed(0);
  const r = await fetch(HOST + '/user', { headers: { Authorization: 'Bearer ' + token, Accept: 'application/json', 'User-Agent': UA } });
  const txt = await r.text();
  console.log(`t=${String(secs).padStart(4)}s  /user -> ${r.status}  ${txt.slice(0, 80)}`);
  if (r.status !== 200) { console.log(`TOKEN DIED at ~${secs}s`); break; }
}
