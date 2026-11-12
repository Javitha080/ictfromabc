// ==UserScript==
// @name         ICT Unlock — Full Lesson Access + Video Toolkit
// @namespace    ict-toolkit.local
// @version      1.0.0
// @description  Surfaces every lesson the account can actually read, rewrites the site's entitlement fields so the native UI shows them as ALLOWED, and adds a panel with direct playback + ffmpeg/yt-dlp download commands.
// @author       operator
// @match        *://ictfromabc.com/*
// @match        *://www.ictfromabc.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  if (window.__ICT_UNLOCK__) return;
  if (!/(^|\.)ictfromabc\.com$/i.test(location.hostname)) return;
  window.__ICT_UNLOCK__ = true;

  // Injected by analysis/_build_unlock_assets.mjs. Shape:
  // { generatedAt, courseLabels:{id:label}, lessons:[{id,title,description,course_id,price,videos:[{id,title,description,media,video_url,token,expires}]}] }
  const DATA = /*__ICT_DATA__*/null;
  const LESSONS = (DATA && DATA.lessons) || [];
  const COURSE_LABELS = (DATA && DATA.courseLabels) || {};
  const LESSON_MAP = new Map(LESSONS.map(l => [Number(l.id), l]));
  const STORE_KEY = 'ict_unlock_ids_v1';
  const SCAN_KEY = 'ict_unlock_scan_v1';

  function loadIds() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr) && arr.length) return new Set(arr.map(Number));
      }
    } catch (e) { /* ignore */ }
    return new Set(LESSONS.map(l => Number(l.id)));
  }

  let accessIds = loadIds();

  function saveIds() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify([...accessIds])); } catch (e) { /* ignore */ }
  }

  function loadScan() {
    try {
      const raw = localStorage.getItem(SCAN_KEY);
      if (!raw) return;
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return;
      for (const l of arr) {
        const id = Number(l.id);
        if (!id) continue;
        const existing = LESSON_MAP.get(id);
        if (existing) {
          if ((!existing.videos || !existing.videos.length) && l.videos && l.videos.length) existing.videos = l.videos;
        } else {
          LESSONS.push(l);
          LESSON_MAP.set(id, l);
        }
      }
    } catch (e) { /* ignore */ }
  }
  loadScan();

  const origFetch = window.fetch.bind(window);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function urlOf(input) {
    try {
      const raw = typeof input === 'string' ? input : (input && input.url) || String(input);
      return new URL(raw, location.origin);
    } catch (e) { return null; }
  }

  function isApi(u) {
    return u && /(^|\.)ictfromabc\.com$/i.test(u.hostname) && /^\/api\//.test(u.pathname);
  }

  function synth(l) {
    return {
      id: l.id,
      title: l.title,
      description: l.description || '',
      course_id: l.course_id,
      price: l.price == null ? 0 : l.price,
      created_at: l.created_at || null,
      purchase_status: 'ALLOWED',
      has_tutes: false,
      zoom: null
    };
  }

  function markAllowed(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    const id = Number(obj.id);
    if (accessIds.has(id)) return Object.assign({}, obj, { purchase_status: 'ALLOWED' });
    return obj;
  }

  function mergeArray(arr) {
    let changed = false;
    const out = arr.map(item => {
      const next = markAllowed(item);
      if (next !== item) changed = true;
      return next;
    });
    const have = new Set(out.map(x => Number(x.id)));
    for (const id of accessIds) {
      if (have.has(id)) continue;
      const l = LESSON_MAP.get(id);
      if (!l) continue;
      out.push(synth(l));
      have.add(id);
      changed = true;
    }
    return { out, changed };
  }

  function rewriteJson(json) {
    if (Array.isArray(json)) {
      const { out, changed } = mergeArray(json);
      return changed ? out : json;
    }
    if (json && Array.isArray(json.lessons)) {
      const { out, changed } = mergeArray(json.lessons);
      return changed ? Object.assign({}, json, { lessons: out }) : json;
    }
    return json;
  }

  const COURSE_SKIP = new Set(['grades', 'ol-lessons']);

  function shouldRewrite(pathname) {
    if (pathname === '/api/lessons/allowed') return 'allowed';
    if (pathname === '/api/lessons') return 'lessons';
    const m = pathname.match(/^\/api\/courses\/([^/]+)$/);
    if (m && !COURSE_SKIP.has(m[1])) return 'course';
    return null;
  }

  window.fetch = async function (input, init) {
    const u = urlOf(input);
    const mode = u && isApi(u) ? shouldRewrite(u.pathname) : null;
    const res = await origFetch(input, init);
    if (!mode || !res || !res.ok) return res;
    try {
      const data = await res.clone().json();
      const next = rewriteJson(data);
      if (next === data) return res;
      const headers = new Headers(res.headers);
      headers.delete('content-length');
      headers.delete('content-encoding');
      headers.set('content-type', 'application/json; charset=utf-8');
      return new Response(JSON.stringify(next), { status: res.status, statusText: res.statusText, headers });
    } catch (e) {
      return res;
    }
  };

  // ---------------------------------------------------------------------------
  // Media helpers
  // ---------------------------------------------------------------------------

  const ZONES = { '415489': 'vz-0d705596-3d4', '619330': 'vz-842e9805-ddc' };

  function classify(url) {
    if (!url) return { kind: 'none' };
    let m = url.match(/youtube\.com\/embed\/([A-Za-z0-9_-]+)/) || url.match(/youtu\.be\/([A-Za-z0-9_-]+)/);
    if (m) return { kind: 'youtube', videoId: m[1] };
    m = url.match(/iframe\.mediadelivery\.net\/embed\/(\d+)\/([0-9a-f-]+)/i);
    if (m) {
      const zone = ZONES[m[1]] || null;
      return { kind: 'bunny', libraryId: m[1], guid: m[2], zone, playlist: zone ? 'https://' + zone + '.b-cdn.net/' + m[2] + '/playlist.m3u8' : null };
    }
    if (/\.m3u8/i.test(url)) return { kind: 'hls', playlist: url };
    if (/\.mp4/i.test(url)) return { kind: 'mp4', url };
    m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    if (m) return { kind: 'vimeo', videoId: m[1] };
    return { kind: 'other', url };
  }

  function tokenized(v) {
    const m = v.media || {};
    let url = v.video_url || '';
    if (!url && m.kind === 'bunny') url = 'https://iframe.mediadelivery.net/embed/' + m.libraryId + '/' + m.guid + '?preload=false';
    if (url && v.token && m.kind === 'bunny') {
      url += (url.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(v.token) + '&expires=' + encodeURIComponent(v.expires || '');
    }
    return url;
  }

  async function apiJson(path) {
    const token = localStorage.getItem('token');
    const res = await origFetch(new URL(path, location.origin).href, {
      headers: Object.assign({ Accept: 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
      redirect: 'follow'
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  }

  async function ensureMedia(v) {
    if (v.media && v.media.kind && v.media.kind !== 'none') return v.media;
    const j = await apiJson('/api/videos/' + v.id);
    v.video_url = j.video_url;
    v.media = classify(j.video_url);
    try {
      const t = await apiJson('/api/videos/' + v.id + '/generate-token');
      if (t && t.token) { v.token = t.token; v.expires = t.expires; }
    } catch (e) { /* token optional */ }
    return v.media;
  }

  // ---------------------------------------------------------------------------
  // Commands
  // ---------------------------------------------------------------------------

  function ffmpegCmd(lesson, v) {
    const m = v.media || {};
    if (m.kind !== 'bunny' || !m.playlist) return null;
    const out = 'L' + lesson.id + '-V' + v.id + '.mp4';
    return 'ffmpeg -headers $' + "'" + 'Referer: https://ictfromabc.com/\\r\\nOrigin: https://ictfromabc.com' + "'" +
      ' -i "' + m.playlist + '" -c copy -bsf:a aac_adtstoasc "' + out + '"';
  }

  function ytdlpCmd(lesson, v) {
    const m = v.media || {};
    if (m.kind !== 'youtube' || !m.videoId) return null;
    return 'yt-dlp "https://www.youtube.com/watch?v=' + m.videoId + '" -o "L' + lesson.id + '-V' + v.id + '.%(ext)s"';
  }

  function cliCmd(lesson) {
    return 'node ict-toolkit/cli/ict.mjs download-lesson ' + lesson.id + ' --ffmpeg';
  }

  function manifest() {
    const lines = [];
    lines.push('ICT UNLOCK MANIFEST');
    lines.push('generated: ' + ((DATA && DATA.generatedAt) || new Date().toISOString()));
    lines.push('account course: ' + (localStorage.getItem('course_id') || '2027-al'));
    lines.push('');
    for (const l of visibleLessons()) {
      lines.push('LESSON ' + l.id + '  [' + l.course_id + ']  ' + l.title);
      lines.push('  ' + lessonUrl(l.id));
      for (const v of (l.videos || [])) {
        lines.push('  - VIDEO ' + v.id + '  ' + v.title);
        const url = tokenized(v) || (v.media && (v.media.playlist || v.media.url)) || '';
        if (url) lines.push('    ' + url);
        const f = ffmpegCmd(l, v);
        if (f) lines.push('    ' + f);
        const y = ytdlpCmd(l, v);
        if (y) lines.push('    ' + y);
      }
      lines.push('  CLI: ' + cliCmd(l));
      lines.push('');
    }
    return lines.join('\n');
  }

  // ---------------------------------------------------------------------------
  // Panel UI
  // ---------------------------------------------------------------------------

  const COURSE_ORDER = ['2027-al', '2026-al', 'al-videos', 'ol-videos', 'git'];
  const expanded = new Set();
  let filter = '';
  let host = null, root = null, bodyEl = null, toastEl = null;

  function lessonUrl(id) { return 'https://ictfromabc.com/dashboard/lessons/' + id + '/videos'; }

  function courseLabel(id) { return COURSE_LABELS[id] || String(id || 'other'); }

  function visibleLessons() {
    const q = filter.trim().toLowerCase();
    const arr = LESSONS.filter(l => accessIds.has(Number(l.id)));
    arr.sort((a, b) => {
      const ai = COURSE_ORDER.indexOf(a.course_id), bi = COURSE_ORDER.indexOf(b.course_id);
      const ao = ai < 0 ? 99 : ai, bo = bi < 0 ? 99 : bi;
      return ao !== bo ? ao - bo : Number(b.id) - Number(a.id);
    });
    if (!q) return arr;
    return arr.filter(l =>
      String(l.title).toLowerCase().includes(q) ||
      String(l.course_id).toLowerCase().includes(q) ||
      (l.videos || []).some(v => String(v.title).toLowerCase().includes(q))
    );
  }

  const CSS = `
    :host { all: initial; }
    * { box-sizing: border-box; font-family: ui-sans-serif, system-ui, "Segoe UI", Roboto, Arial, sans-serif; }
    #fab { position: fixed; right: 18px; bottom: 18px; z-index: 2147483647; border: 0; border-radius: 999px;
      padding: 10px 16px; background: #dc2626; color: #fff; font-weight: 700; font-size: 13px; cursor: pointer;
      box-shadow: 0 8px 24px rgba(0,0,0,.35); letter-spacing: .02em; }
    #fab:hover { background: #b91c1c; }
    #panel { position: fixed; right: 18px; bottom: 66px; z-index: 2147483647; width: 560px; max-width: calc(100vw - 24px);
      height: 76vh; max-height: 760px; display: none; flex-direction: column; background: #0b0f14; color: #e5e7eb;
      border: 1px solid #27303b; border-radius: 14px; overflow: hidden; box-shadow: 0 20px 50px rgba(0,0,0,.55); }
    #panel.open { display: flex; }
    .hd { display: flex; align-items: center; gap: 10px; padding: 12px 14px; background: #111820; border-bottom: 1px solid #27303b; }
    .hd h1 { font-size: 14px; margin: 0; font-weight: 800; letter-spacing: .04em; color: #fff; }
    .hd .stats { font-size: 11px; color: #93a4b8; margin-left: auto; white-space: nowrap; }
    .hd button { border: 1px solid #33414f; background: #18212b; color: #cbd5e1; border-radius: 8px; padding: 5px 8px;
      font-size: 11px; cursor: pointer; }
    .hd button:hover { background: #223041; }
    .bar { display: flex; gap: 8px; padding: 10px 12px; border-bottom: 1px solid #1d2630; background: #0e141a; }
    .bar input { flex: 1; min-width: 0; background: #0b1117; border: 1px solid #2a3644; color: #e5e7eb; border-radius: 8px;
      padding: 7px 10px; font-size: 12px; outline: none; }
    .bar input:focus { border-color: #dc2626; }
    .bar button { border: 1px solid #33414f; background: #18212b; color: #cbd5e1; border-radius: 8px; padding: 7px 10px;
      font-size: 11px; cursor: pointer; white-space: nowrap; }
    .bar button:hover { background: #223041; }
    .bar button.warn { border-color: #7f1d1d; color: #fca5a5; }
    .body { overflow: auto; padding: 10px 12px 16px; flex: 1; }
    .course { margin: 14px 0 6px; font-size: 10px; letter-spacing: .14em; text-transform: uppercase; color: #7c8ea3; }
    .lesson { border: 1px solid #1f2933; border-radius: 10px; margin-bottom: 8px; background: #0f151c; overflow: hidden; }
    .lhead { display: flex; gap: 8px; align-items: center; padding: 9px 10px; cursor: pointer; }
    .lhead:hover { background: #131b24; }
    .lid { font-size: 10px; color: #64748b; font-variant-numeric: tabular-nums; width: 38px; flex: none; }
    .ltitle { flex: 1; font-size: 12px; line-height: 1.35; color: #e2e8f0; }
    .pill { font-size: 10px; padding: 2px 6px; border-radius: 999px; background: #1e293b; color: #93c5fd; white-space: nowrap; }
    .lhead .go { font-size: 10px; color: #f87171; text-decoration: none; white-space: nowrap; }
    .lhead .go:hover { text-decoration: underline; }
    .videos { border-top: 1px solid #1d2630; padding: 4px 0; }
    .video { display: flex; gap: 8px; align-items: center; padding: 7px 10px; border-bottom: 1px solid #141c25; }
    .video:last-child { border-bottom: 0; }
    .vid { font-size: 10px; color: #64748b; width: 38px; flex: none; font-variant-numeric: tabular-nums; }
    .vtitle { flex: 1; font-size: 11.5px; line-height: 1.3; color: #cbd5e1; }
    .kind { font-size: 9px; padding: 2px 5px; border-radius: 4px; font-weight: 700; letter-spacing: .04em; }
    .kind.youtube { background: #3f1d1d; color: #fca5a5; }
    .kind.bunny { background: #12303a; color: #67e8f9; }
    .kind.hls, .kind.mp4 { background: #1e2a3a; color: #93c5fd; }
    .kind.other, .kind.none { background: #26303a; color: #94a3b8; }
    .vbtn { border: 1px solid #2c3947; background: #141d26; color: #94a3b8; border-radius: 6px; padding: 3px 6px;
      font-size: 9.5px; cursor: pointer; white-space: nowrap; }
    .vbtn:hover { color: #fff; border-color: #475569; }
    .vbtn.play { color: #fca5a5; border-color: #7f1d1d; }
    .empty { text-align: center; color: #64748b; font-size: 12px; padding: 40px 10px; }
    #toast { position: fixed; right: 20px; bottom: 20px; z-index: 2147483647; background: #052e16; color: #bbf7d0;
      border: 1px solid #166534; border-radius: 8px; padding: 8px 12px; font-size: 12px; opacity: 0; transition: opacity .2s;
      pointer-events: none; }
    #toast.show { opacity: 1; }
    #overlay { position: fixed; inset: 0; z-index: 2147483647; background: rgba(0,0,0,.82); display: none;
      align-items: center; justify-content: center; padding: 24px; }
    #overlay.open { display: flex; }
    .modal { width: min(1000px, 96vw); background: #0b0f14; border: 1px solid #27303b; border-radius: 12px; overflow: hidden; }
    .mhd { display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: #111820; border-bottom: 1px solid #27303b; }
    .mhd div { font-size: 12px; color: #e2e8f0; flex: 1; }
    .mhd button { border: 1px solid #33414f; background: #18212b; color: #cbd5e1; border-radius: 8px; padding: 4px 9px;
      font-size: 11px; cursor: pointer; }
    .frame { aspect-ratio: 16 / 9; background: #000; }
    .frame iframe { width: 100%; height: 100%; border: 0; display: block; }
    .mfoot { padding: 8px 12px; display: flex; gap: 8px; }
    .mfoot a { font-size: 11px; color: #f87171; text-decoration: none; }
    .mfoot a:hover { text-decoration: underline; }
  `;

  function build() {
    if (host) return;
    host = document.createElement('div');
    host.id = 'ict-unlock-host';
    (document.body || document.documentElement).appendChild(host);
    root = host.attachShadow({ mode: 'open' });
    root.innerHTML = '<style>' + CSS + '</style>' +
      '<button id="fab">ICT UNLOCK</button>' +
      '<div id="panel"><div class="hd"><h1>ICT UNLOCK</h1><span class="stats"></span>' +
      '<button id="manifest">Manifest</button><button id="close">✕</button></div>' +
      '<div class="bar"><input id="q" placeholder="search lesson / video / course…">' +
      '<button id="scan" class="warn">Rescan access</button></div><div class="body"></div></div>' +
      '<div id="toast"></div><div id="overlay"><div class="modal"><div class="mhd"><div id="mtitle"></div>' +
      '<button id="mclose">Close</button></div><div class="frame" id="mframe"></div>' +
      '<div class="mfoot"><a id="mopen" target="_blank" rel="noopener">open native lesson page ↗</a></div></div></div>';
    bodyEl = root.querySelector('.body');
    toastEl = root.querySelector('#toast');
    root.querySelector('#fab').addEventListener('click', () => toggle());
    root.querySelector('#close').addEventListener('click', () => toggle(false));
    root.querySelector('#manifest').addEventListener('click', () => copy(manifest(), 'manifest copied'));
    root.querySelector('#scan').addEventListener('click', () => scan());
    root.querySelector('#mclose').addEventListener('click', closePlayer);
    root.querySelector('#overlay').addEventListener('click', e => { if (e.target.id === 'overlay') closePlayer(); });
    root.querySelector('#q').addEventListener('input', e => { filter = e.target.value; render(); });
    root.querySelector('.body').addEventListener('click', onBodyClick);
    render();
  }

  function toggle(force) {
    build();
    const panel = root.querySelector('#panel');
    const open = force == null ? !panel.classList.contains('open') : !!force;
    panel.classList.toggle('open', open);
    if (open) render();
  }

  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastEl._t);
    toastEl._t = setTimeout(() => toastEl.classList.remove('show'), 1800);
  }

  function copy(text, msg) {
    const done = () => toast(msg || 'copied');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, () => fallbackCopy(text, done));
    } else fallbackCopy(text, done);
  }

  function fallbackCopy(text, done) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch (e) { /* ignore */ }
    ta.remove(); done();
  }

  function render() {
    if (!bodyEl) return;
    const list = visibleLessons();
    const vids = list.reduce((n, l) => n + (l.videos ? l.videos.length : 0), 0);
    root.querySelector('.stats').textContent = list.length + ' lessons · ' + vids + ' videos';
    if (!list.length) {
      bodyEl.innerHTML = '<div class="empty">No lessons match. Run “Rescan access”.</div>';
      return;
    }
    let html = '';
    let course = null;
    for (const l of list) {
      if (l.course_id !== course) {
        course = l.course_id;
        html += '<div class="course">' + esc(courseLabel(course)) + ' · ' + esc(course) + '</div>';
      }
      const open = expanded.has(Number(l.id));
      html += '<div class="lesson" data-lid="' + l.id + '">' +
        '<div class="lhead" data-act="toggle" data-lid="' + l.id + '">' +
        '<span class="lid">#' + l.id + '</span><span class="ltitle">' + esc(l.title) + '</span>' +
        '<span class="pill">' + (l.videos ? l.videos.length : 0) + ' vids</span>' +
        '<a class="go" href="' + lessonUrl(l.id) + '" target="_blank" rel="noopener" data-act="stop">open ↗</a></div>';
      if (open) {
        html += '<div class="videos">';
        if (!l.videos || !l.videos.length) {
          html += '<div class="video"><span class="vtitle">No video rows in local data. Open the native page.</span></div>';
        } else {
          for (const v of l.videos) {
            const kind = (v.media && v.media.kind) || 'none';
            html += '<div class="video" data-vid="' + v.id + '" data-lid="' + l.id + '">' +
              '<span class="vid">' + v.id + '</span>' +
              '<span class="vtitle">' + esc(v.title) + '</span>' +
              '<span class="kind ' + esc(kind) + '">' + esc(kind) + '</span>' +
              '<button class="vbtn play" data-act="play" data-lid="' + l.id + '" data-vid="' + v.id + '">play</button>' +
              '<button class="vbtn" data-act="ffmpeg" data-lid="' + l.id + '" data-vid="' + v.id + '">ffmpeg</button>' +
              '<button class="vbtn" data-act="ytdlp" data-lid="' + l.id + '" data-vid="' + v.id + '">yt-dlp</button>' +
              '</div>';
          }
        }
        html += '</div>';
      }
      html += '</div>';
    }
    bodyEl.innerHTML = html;
  }

  function findVideo(lid, vid) {
    const l = LESSON_MAP.get(Number(lid));
    if (!l) return {};
    return { lesson: l, video: (l.videos || []).find(v => Number(v.id) === Number(vid)) };
  }

  async function onBodyClick(e) {
    const t = e.target;
    if (!(t instanceof Element)) return;
    const a = t.closest('[data-act]');
    if (!a) return;
    const act = a.getAttribute('data-act');
    if (act === 'stop') return;
    if (act === 'toggle') {
      e.preventDefault();
      const lid = Number(a.getAttribute('data-lid'));
      if (expanded.has(lid)) expanded.delete(lid); else expanded.add(lid);
      render();
      return;
    }
    const lid = Number(a.getAttribute('data-lid'));
    const vid = Number(a.getAttribute('data-vid'));
    const { lesson, video } = findVideo(lid, vid);
    if (!lesson || !video) return;
    if (act === 'play') {
      e.preventDefault();
      try {
        toast('resolving media…');
        await ensureMedia(video);
        playVideo(lesson, video);
      } catch (err) { toast('media failed: ' + err.message); }
    } else if (act === 'ffmpeg') {
      e.preventDefault();
      try {
        await ensureMedia(video);
        const cmd = ffmpegCmd(lesson, video);
        if (cmd) copy(cmd, 'ffmpeg command copied'); else toast('not a Bunny video');
      } catch (err) { toast('resolve failed: ' + err.message); }
    } else if (act === 'ytdlp') {
      e.preventDefault();
      try {
        await ensureMedia(video);
        const cmd = ytdlpCmd(lesson, video);
        if (cmd) copy(cmd, 'yt-dlp command copied'); else toast('not a YouTube video');
      } catch (err) { toast('resolve failed: ' + err.message); }
    }
  }

  function playVideo(lesson, v) {
    build();
    const src = tokenized(v);
    if (!src) { toast('no playable URL'); return; }
    root.querySelector('#mtitle').textContent = 'L' + lesson.id + ' · V' + v.id + ' — ' + v.title;
    root.querySelector('#mframe').innerHTML = '<iframe src="' + esc(src) + '" allow="autoplay; fullscreen; encrypted-media; picture-in-picture" allowfullscreen referrerpolicy="origin"></iframe>';
    root.querySelector('#mopen').href = lessonUrl(lesson.id);
    root.querySelector('#overlay').classList.add('open');
  }

  function closePlayer() {
    if (!root) return;
    root.querySelector('#overlay').classList.remove('open');
    root.querySelector('#mframe').innerHTML = '';
  }

  async function scan() {
    build();
    const btn = root.querySelector('#scan');
    btn.disabled = true;
    const setStatus = msg => { root.querySelector('.stats').textContent = msg; };
    try {
      setStatus('scanning catalogue…');
      const catalogue = await apiJson('/api/lessons');
      const arr = Array.isArray(catalogue) ? catalogue : (catalogue.lessons || []);
      const found = [];
      for (let i = 0; i < arr.length; i++) {
        const l = arr[i];
        setStatus('testing ' + (i + 1) + '/' + arr.length + ' …');
        try {
          const d = await apiJson('/api/lessons/' + l.id);
          const vids = (d.videos || []).map(v => ({ id: v.id, title: v.title, description: v.description || '', media: null }));
          found.push({ id: l.id, title: l.title, description: l.description || '', course_id: l.course_id, price: l.price, videos: vids });
        } catch (e) { /* locked */ }
        await sleep(1050);
      }
      accessIds = new Set(found.map(l => Number(l.id)));
      saveIds();
      try { localStorage.setItem(SCAN_KEY, JSON.stringify(found)); } catch (e) { /* ignore */ }
      for (const l of found) {
        const existing = LESSON_MAP.get(Number(l.id));
        if (existing) { existing.videos = l.videos; }
        else { LESSONS.push(l); LESSON_MAP.set(Number(l.id), l); }
      }
      render();
      setStatus('found ' + found.length + '/' + arr.length + ' accessible');
      toast('scan complete: ' + found.length + ' lessons');
    } catch (err) {
      setStatus('scan failed: ' + err.message);
      toast('scan failed: ' + err.message);
    } finally {
      btn.disabled = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Boot
  // ---------------------------------------------------------------------------

  function boot() {
    build();
    try {
      const id = new URLSearchParams(location.search).get('ict_unlock');
      if (id === '1') toggle(true);
    } catch (e) { /* ignore */ }
    console.log('[ICT Unlock] v1.0.0 armed — ' + LESSONS.length + ' lessons in data, ' + accessIds.size + ' allowed ids');
  }

  if (document.body) boot();
  else document.addEventListener('DOMContentLoaded', boot, { once: true });

  window.__ICT_UNLOCK = {
    version: '1.0.0',
    data: DATA,
    lessons: () => visibleLessons(),
    ids: () => [...accessIds],
    scan,
    panel: () => toggle(true),
    manifest,
    help() {
      console.log('%cICT Unlock', 'color:#dc2626;font-weight:bold', '\n' +
        '__ICT_UNLOCK.lessons()  list visible lessons\n' +
        '__ICT_UNLOCK.ids()      current allowed id set\n' +
        '__ICT_UNLOCK.scan()     re-test every lesson (rate-limited)\n' +
        '__ICT_UNLOCK.panel()    open the panel\n' +
        '__ICT_UNLOCK.manifest() full text manifest (URLs + commands)\n' +
        'Open the panel with the red ICT UNLOCK button, or ?ict_unlock=1');
    }
  };
})();
