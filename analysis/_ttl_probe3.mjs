// 1-second polling after one login, to pin the exact revocation moment.
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
console.log(`login -> ${login.status} token=${lj && lj.token ? lj.token.split('|')[0] : 'NONE'} rl=${login.headers.get('x-ratelimit-remaining')}`);
if (!lj || !lj.token) { console.log(JSON.stringify(lj)); process.exit(1); }
const token = lj.token;
const t0 = Date.now();
let died = null;
for (let i = 1; i <= 40; i++) {
  await new Promise(r => setTimeout(r, 1000));
  const r = await fetch(HOST + '/user', { headers: { Authorization: 'Bearer ' + token, Accept: 'application/json', 'User-Agent': UA } });
  const secs = ((Date.now() - t0) / 1000).toFixed(0);
  if (r.status !== 200) { died = secs; console.log(`t=${secs}s -> ${r.status}  DEAD`); break; }
  if (i % 5 === 0) console.log(`t=${secs}s -> 200`);
}
if (!died) console.log('still alive after 40s');
