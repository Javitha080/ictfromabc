import fs from 'fs';

const B = 'https://ictfromabc.com/api';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const REF = 'https://ictfromabc.com/dashboard/myLessons';
const ZONES = { '415489': 'vz-0d705596-3d4', '619330': 'vz-842e9805-ddc' };
const sleep = ms => new Promise(r => setTimeout(r, ms));

let token = JSON.parse(fs.readFileSync('analysis/_live_token.json', 'utf8')).token;

async function login() {
  const r = await fetch(B + '/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'User-Agent': UA, Origin: 'https://ictfromabc.com', Referer: 'https://ictfromabc.com/auth/login' },
    body: JSON.stringify({ phoneNumber: process.env.ICT_PHONE||'', password: process.env.ICT_PASS||'', visitorId: 'CWUriseStUq30ANV6hIt', confidenceScore: 0.97 }),
    redirect: 'manual'
  });
  const j = await r.json();
  if (!j.token) throw new Error('relogin failed: ' + JSON.stringify(j));
  token = j.token;
  fs.writeFileSync('analysis/_live_token.json', JSON.stringify({ token, role: j.role, user: j.user, course_id: j.course_id, at: new Date().toISOString() }, null, 2));
  console.log('  [relogin] new token id', token.split('|')[0]);
  return token;
}

async function api(path, opts = {}) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const r = await fetch(B + path, {
      method: opts.method || 'GET',
      headers: {
        Accept: 'application/json', 'User-Agent': UA,
        Authorization: 'Bearer ' + token,
        Origin: 'https://ictfromabc.com', Referer: REF,
        ...(opts.body ? { 'Content-Type': 'application/json' } : {})
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      redirect: 'manual'
    });
    if (r.status === 401 && attempt < 3) { await login(); continue; }
    if (r.status === 429) { const ra = parseInt(r.headers.get('retry-after') || '5'); await sleep(Math.min(ra, 30) * 1000); continue; }
    const text = await r.text();
    let json = null; try { json = JSON.parse(text); } catch {}
    return { status: r.status, json, text };
  }
  return { status: 0, json: null, text: 'giving up' };
}

function classify(url) {
  if (!url) return { kind: 'none' };
  let m = url.match(/youtube\.com\/embed\/([A-Za-z0-9_-]+)/);
  if (m) return { kind: 'youtube', videoId: m[1] };
  m = url.match(/iframe\.mediadelivery\.net\/embed\/(\d+)\/([0-9a-f-]+)/i);
  if (m) {
    const zone = ZONES[m[1]] || null;
    return { kind: 'bunny', libraryId: m[1], guid: m[2], zone, playlist: zone ? `https://${zone}.b-cdn.net/${m[2]}/playlist.m3u8` : null };
  }
  if (/\.m3u8/.test(url)) return { kind: 'hls', playlist: url };
  if (/\.mp4/.test(url)) return { kind: 'mp4', url };
  m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (m) return { kind: 'vimeo', videoId: m[1] };
  return { kind: 'other', url };
}

async function checkPlaylist(playlist) {
  if (!playlist) return { status: 0, ok: false };
  try {
    const r = await fetch(playlist, {
      headers: { 'User-Agent': UA, Referer: 'https://ictfromabc.com/', Origin: 'https://ictfromabc.com', Range: 'bytes=0-400' },
      redirect: 'follow'
    });
    const body = await r.text();
    return { status: r.status, ok: r.status === 200 || r.status === 206, head: body.slice(0, 200) };
  } catch (e) {
    return { status: 0, ok: false, error: String(e.message || e) };
  }
}

const report = { generatedAt: new Date().toISOString(), account: { phone: process.env.ICT_PHONE||'', user_id: 79787, course_id: '2027-al' }, courses: [], lessons: [], pdfs: { types: {}, directStorage: [] } };

console.log('== courses ==');
{
  const r = await api('/courses');
  report.courses = r.json;
  console.log('courses status', r.status, Array.isArray(r.json) ? r.json.length : typeof r.json);
  await sleep(300);
}

console.log('== pdfs by type ==');
for (const type of ['tute', 'lesson-pp', 'paper-book']) {
  const r = await api('/pdfs/' + type);
  const list = (r.json && r.json.pdfs) || [];
  report.pdfs.types[type] = { status: r.status, count: list.length, pdfs: list };
  console.log(type, 'status', r.status, 'count', list.length);
  for (const p of list) {
    const abs = p.url && p.url.startsWith('http') ? p.url : 'https://ictfromabc.com' + p.url;
    let check = { status: 0, contentType: null, length: null, ok: false };
    try {
      const rr = await fetch(abs, { headers: { 'User-Agent': UA, Referer: 'https://ictfromabc.com/dashboard/pdf/' + type, Range: 'bytes=0-200' }, redirect: 'follow' });
      check = { status: rr.status, contentType: rr.headers.get('content-type'), length: rr.headers.get('content-length'), ok: rr.status === 200 || rr.status === 206 };
      await rr.arrayBuffer().catch(() => {});
    } catch (e) { check.error = String(e.message || e); }
    report.pdfs.directStorage.push({ type, id: p.id, title: p.title, url: p.url, abs, check });
    console.log('  pdf', p.id, check.status, check.ok ? 'DIRECT-OK' : 'FAIL', String(p.title).slice(0, 50));
    await sleep(350);
  }
  await sleep(300);
}
fs.writeFileSync('analysis/INVENTORY_PDFS.json', JSON.stringify(report.pdfs, null, 2));
console.log('PDF report saved');

console.log('== lesson/video inventory ==');
const sweep = JSON.parse(fs.readFileSync('analysis/_lesson_sweep.json', 'utf8'));
const accessible = sweep.filter(x => x.status === 200);
console.log('accessible lessons:', accessible.length);

let videoCount = 0, bunnyCount = 0, ytCount = 0;
for (const entry of accessible) {
  const r = await api('/lessons/' + entry.id);
  if (r.status !== 200) {
    console.log('lesson', entry.id, 'DETAIL FAIL', r.status, r.text.slice(0, 100));
    report.lessons.push({ id: entry.id, title: entry.title, course_id: entry.course_id, status: r.status, error: r.text.slice(0, 200), videos: [] });
    await sleep(300);
    continue;
  }
  const lesson = r.json.lesson || r.json;
  const videos = Array.isArray(r.json.videos) ? r.json.videos : [];
  const out = {
    id: lesson.id, title: lesson.title, description: lesson.description, course_id: lesson.course_id, price: lesson.price,
    videos: []
  };
  console.log(`lesson ${entry.id} [${lesson.course_id}] ${String(lesson.title).slice(0, 52)} videos=${videos.length}`);
  for (const v of videos) {
    videoCount++;
    const d = await api('/videos/' + v.id);
    const info = { id: v.id, title: v.title, description: v.description, thumbnail_url: v.thumbnail_url, preview_url: v.preview_url, created_at: v.created_at, video_status: d.status };
    if (d.status === 200 && d.json) {
      info.video_url = d.json.video_url;
      info.media = classify(d.json.video_url);
      if (info.media.kind === 'bunny') {
        bunnyCount++;
        info.media.playlist_check = await checkPlaylist(info.media.playlist);
        if (info.media.playlist_check.head) info.media.playlist_check.head = info.media.playlist_check.head.replace(/\s+/g, ' ').slice(0, 120);
      } else if (info.media.kind === 'youtube') ytCount++;
      else if (info.media.kind === 'hls' || info.media.kind === 'mp4') {
        info.media.check = await checkPlaylist(info.media.playlist || info.media.url);
      }
      const t = await api(`/videos/${v.id}/generate-token`);
      info.token = { status: t.status, message: t.json && t.json.message, token: t.json && t.json.token, expires: t.json && t.json.expires };
      console.log(`   v${v.id} ${d.status} ${info.media.kind}${info.media.playlist_check ? ' playlist=' + info.media.playlist_check.status : ''} tok=${t.status}`);
      await sleep(300);
    } else {
      console.log(`   v${v.id} video detail ${d.status} ${d.text.slice(0, 80)}`);
    }
    out.videos.push(info);
    fs.writeFileSync('analysis/_inventory_progress.json', JSON.stringify({ done: report.lessons.length, current: out }, null, 2));
    await sleep(300);
  }
  report.lessons.push(out);
  await sleep(300);
}

report.stats = {
  accessibleLessons: report.lessons.length,
  totalVideos: videoCount,
  bunnyVideos: bunnyCount,
  youtubeVideos: ytCount,
  playlistsOk: report.lessons.reduce((n, l) => n + l.videos.filter(v => v.media && v.media.playlist_check && v.media.playlist_check.ok).length, 0)
};
fs.writeFileSync('analysis/INVENTORY_UNLOCKED.json', JSON.stringify(report, null, 2));
console.log('DONE', JSON.stringify(report.stats));
