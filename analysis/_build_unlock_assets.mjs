import fs from 'fs';

const INV = 'analysis/INVENTORY_UNLOCKED.json';
if (!fs.existsSync(INV)) {
  console.error('Missing ' + INV + ' — run analysis/_inventory_full.mjs first.');
  process.exit(1);
}

const inv = JSON.parse(fs.readFileSync(INV, 'utf8'));
const KNOWN = {
  '2027-al': 'A/L 2027 — Monthly Lessons',
  '2026-al': 'A/L 2026 — Revision',
  'al-videos': 'A/L Video Modules',
  'ol-videos': 'O/L Video Modules',
  'git': 'GIT Seminars',
  'al-2028': 'A/L 2028',
  'al-2029': 'A/L 2029'
};

const courseLabels = Object.assign({}, KNOWN);
if (inv.courses && typeof inv.courses === 'object') {
  for (const group of Object.values(inv.courses)) {
    if (!Array.isArray(group)) continue;
    for (const c of group) {
      if (c && c.id) courseLabels[c.id] = c.title || courseLabels[c.id] || c.id;
    }
  }
}

const lessons = (inv.lessons || []).map(l => ({
  id: Number(l.id),
  title: l.title,
  description: String(l.description || '').slice(0, 500),
  course_id: l.course_id,
  price: l.price == null ? 0 : l.price,
  videos: (l.videos || []).map(v => {
    const m = v.media && v.media.kind && v.media.kind !== 'none' ? v.media : null;
    return {
      id: Number(v.id),
      title: v.title,
      description: String(v.description || '').slice(0, 300),
      media: m ? {
        kind: m.kind,
        ...(m.videoId ? { videoId: m.videoId } : {}),
        ...(m.libraryId ? { libraryId: m.libraryId } : {}),
        ...(m.guid ? { guid: m.guid } : {}),
        ...(m.zone ? { zone: m.zone } : {}),
        ...(m.playlist ? { playlist: m.playlist } : {}),
        ...(m.playlist_check ? { playlistStatus: m.playlist_check.status, playlistOk: !!m.playlist_check.ok } : {}),
        ...(m.url ? { url: m.url } : {})
      } : null,
      video_url: v.video_url || null,
      token: (v.token && v.token.token) || null,
      expires: (v.token && v.token.expires) || null
    };
  })
}));

lessons.sort((a, b) => {
  const order = ['2027-al', '2026-al', 'al-videos', 'ol-videos', 'git'];
  const ai = order.indexOf(a.course_id), bi = order.indexOf(b.course_id);
  const ao = ai < 0 ? 99 : ai, bo = bi < 0 ? 99 : bi;
  return ao !== bo ? ao - bo : b.id - a.id;
});

const data = {
  generatedAt: inv.generatedAt || new Date().toISOString(),
  account: inv.account || null,
  courseLabels,
  lessons
};

let vTotal = 0, bunny = 0, youtube = 0, other = 0, playlistOk = 0;
for (const l of lessons) for (const v of l.videos) {
  vTotal++;
  const k = v.media ? v.media.kind : 'none';
  if (k === 'bunny') { bunny++; if (v.media.playlistOk) playlistOk++; }
  else if (k === 'youtube') youtube++;
  else other++;
}

const json = JSON.stringify(data);
const jsonScriptSafe = json.replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

// --- userscript -------------------------------------------------------------
const tpl = fs.readFileSync('ict-toolkit/userscript/ict-unlock.template.js', 'utf8');
const marker = 'const DATA = /*__ICT_DATA__*/null;';
if (!tpl.includes(marker)) throw new Error('Userscript data marker not found');
const us = tpl.replace(marker, 'const DATA = ' + json + ';');
fs.writeFileSync('ict-toolkit/userscript/ict-unlock.user.js', us);

// --- dashboard --------------------------------------------------------------
const htmlTpl = fs.readFileSync('dashboard/unlocked.template.html', 'utf8');
const htmlMarker = 'const DATA = /*__ICT_DATA__*/null;';
if (!htmlTpl.includes(htmlMarker)) throw new Error('Dashboard data marker not found');
const html = htmlTpl.replace(htmlMarker, 'const DATA = ' + jsonScriptSafe + ';');
fs.writeFileSync('dashboard/unlocked.html', html);

// --- markdown inventory -----------------------------------------------------
const md = [];
md.push('# Unlocked Lesson Inventory — ictfromabc.com');
md.push('');
md.push('Generated: ' + data.generatedAt);
md.push('');
md.push('Account: user `79787` / `REDACTED_PHONE`, role `STUDENT`, course `2027-al`.');
md.push('');
md.push('## Headline');
md.push('');
md.push('- `GET /api/lessons/{id}` returns **200 for ' + lessons.length + ' of 101 lessons**; `/api/lessons/allowed` lists only 11.');
md.push('- Net entitlement gap: **' + (lessons.length - 11) + ' lessons** readable beyond the official allowed set.');
md.push('- **' + vTotal + ' videos** inventoried: **' + bunny + ' Bunny**, **' + youtube + ' YouTube**, **' + other + ' other/unresolved**.');
md.push('- Bunny master playlists verified with the site Referer for **' + playlistOk + '/' + bunny + '** Bunny videos.');
md.push('- All listed PDFs are downloadable directly from `/storage/...` **without authentication** (' + ((inv.pdfs && inv.pdfs.directStorage && inv.pdfs.directStorage.filter(x => x.check && x.check.ok).length) || 0) + ' checked OK).');
md.push('');
md.push('## Lessons by course');
md.push('');
md.push('| Course | Lesson | Videos | Bunny | YouTube | Other | Title |');
md.push('|---|---:|---:|---:|---:|---:|---|');
for (const l of lessons) {
  const b = l.videos.filter(v => v.media && v.media.kind === 'bunny').length;
  const y = l.videos.filter(v => v.media && v.media.kind === 'youtube').length;
  const o = l.videos.length - b - y;
  md.push('| `' + l.course_id + '` | ' + l.id + ' | ' + l.videos.length + ' | ' + b + ' | ' + y + ' | ' + o + ' | ' + String(l.title).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ') + ' |');
}
md.push('');
md.push('## PDF exposure');
md.push('');
if (inv.pdfs && inv.pdfs.types) {
  for (const [type, t] of Object.entries(inv.pdfs.types)) {
    md.push('### `' + type + '` — ' + t.count + ' PDFs');
    md.push('');
    md.push('| ID | Title | Direct URL | No-auth check |');
    md.push('|---:|---|---|---|');
    for (const p of t.pdfs) {
      const ds = (inv.pdfs.directStorage || []).find(x => x.type === type && Number(x.id) === Number(p.id));
      md.push('| ' + p.id + ' | ' + String(p.title).replace(/\|/g, '\\|') + ' | `' + p.url + '` | ' + (ds && ds.check && ds.check.ok ? 'HTTP ' + ds.check.status + ' / ' + ds.check.contentType : 'FAIL') + ' |');
    }
    md.push('');
  }
}
md.push('## Notes');
md.push('');
md.push('- Bunny playback is gated by `Referer: https://ictfromabc.com/` on the pull zone, not by `generate-token`. Master playlists return 200/206 with that header; the site player works on unsafe-reference origins.');
md.push('- Lesson videos are reachable only for lessons whose detail endpoint is 200: `/api/videos/{id}` returns 403 for videos attached to non-entitled lessons.');
md.push('- PDF list endpoints are bearer-authenticated, but the returned `/storage/...` URLs are public; no Bearer header is needed to fetch the files.');
md.push('- Timestamps/tokens in `INVENTORY_UNLOCKED.json` are from generation time; tokens are short-lived and not needed for Bunny playlist access.');
md.push('');
fs.writeFileSync('analysis/INVENTORY_UNLOCKED.md', md.join('\n'));

console.log('wrote ict-toolkit/userscript/ict-unlock.user.js (' + us.length + ' bytes)');
console.log('wrote dashboard/unlocked.html (' + html.length + ' bytes)');
console.log('wrote analysis/INVENTORY_UNLOCKED.md');
console.log(JSON.stringify({ lessons: lessons.length, videos: vTotal, bunny, youtube, other, playlistOk }));
