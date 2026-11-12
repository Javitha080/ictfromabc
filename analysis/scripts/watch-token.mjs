// Watch a stored Bearer token without logging in again.
// Usage: node watch-token.mjs <session.json> [seconds...]
import fs from 'node:fs';
const [file, ...marks] = process.argv.slice(2);
const points = marks.length ? marks.map(Number) : [0, 60, 180, 300];
const session = JSON.parse(fs.readFileSync(file, 'utf8'));
const t0 = Date.now();
const stamp = () => `${((Date.now() - t0) / 1000).toFixed(0)}s`;

async function probe() {
  try {
    const r = await fetch('https://ictfromabc.com/api/user', {
      headers: { accept: 'application/json', authorization: `Bearer ${session.token}` }
    });
    await r.text();
    return r.status;
  } catch (e) {
    return 'ERR ' + e.message;
  }
}

for (const p of points) {
  const waitMs = p * 1000 - (Date.now() - t0);
  if (waitMs > 0) await new Promise((r) => setTimeout(r, waitMs));
  console.log(`${stamp()} -> ${await probe()}`);
}
