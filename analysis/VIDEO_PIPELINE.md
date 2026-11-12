# VIDEO_PIPELINE.md — lesson video resolution and download

## 1. Chain

```
GET /api/lessons/{lessonId}
  -> videos[]            each item: id, title, video_url, thumbnail_url
GET /api/videos/{videoId}
  -> { video_url }       Bunny embed or YouTube URL
GET /api/videos/{videoId}/generate-token
  -> { token, expires }  expires = Unix seconds
player (playerjs) -> Bunny iframe -> HLS master -> variant playlist -> TS segments
```

`video_url` for the current course is a Bunny Stream embed:

```
https://iframe.mediadelivery.net/embed/415489/<guid>?preload=false
```

- Library: `415489`
- Pull zone: `vz-0d705596-3d4.b-cdn.net`
- Master: `https://vz-0d705596-3d4.b-cdn.net/<guid>/playlist.m3u8`

Lesson 151 spans two libraries, so the pull zone cannot be hard-coded:

| Library | Pull zone | Known videos |
|---|---|---|
| `415489` | `vz-0d705596-3d4.b-cdn.net` | 1131 (and others) |
| `619330` | `vz-842e9805-ddc.b-cdn.net` | 1155, 1156, 1157 |

The signed embed page names its own pull zone in the `<source src="...">` tag.
`ensureHls` reads it, verifies the playlist starts with `#EXTM3U`, and caches
`library -> zone` in `config/pullzones.local.json`.

The embed page itself is signed: opening it without `?token=...&expires=...`
returns `403`. The pull zone is **not** signed. It accepts the playlist and
segments with only a `Referer: https://ictfromabc.com/` header:

| Request | Result |
|---|---|
| `GET /<guid>/playlist.m3u8` with `Referer: https://ictfromabc.com/` | `200 application/vnd.apple.mpegurl` |
| same without `Referer` | `403` Bunny HTML |
| `GET /<guid>/360p/video.m3u8` with `Referer` | `200` |
| `GET /<guid>/720p/video0.ts` with `Referer` | `200` |
| same with `Referer` but no token | `200` — the pull zone ignores the token |

So a valid Bearer token is only needed to **discover** the GUID through
`/api/videos/{id}` and `/api/lessons/{id}`. Once the GUID is known, the CDN
serves the media to anyone who sends the site's Referer. This is why the CLI can
download with no token when given a playlist URL directly.

Observed for video `1131` (`<guid>` = `203d28db-…`): 4 variants
(720/480/360/240), 1569 segments on 360p (~4 s each), MPEG-TS, `#EXT-X-KEY:
METHOD=NONE` — no AES, no DRM.

## 2. Tokens

`GET /api/videos/{id}/generate-token` returns a 64-hex token and `expires` in
Unix seconds (about 24 h out in the captured session). The web client appends it
to the embed and to thumbnail/preview URLs:

```
https://iframe.mediadelivery.net/embed/415489/<guid>?preload=false&token=<hex>&expires=<unix>
https://vz-0d705596-3d4.b-cdn.net/<guid>/thumbnail.jpg?token=<hex>&expires=<unix>
https://vz-0d705596-3d4.b-cdn.net/<guid>/preview.webp?token=<hex>&expires=<unix>
```

The bundle caches generated tokens for ~5 minutes before expiry. The token is
not required for the playlist or segments; it only unlocks the signed embed page
and the image derivatives on the pull zone.

YouTube-hosted lessons use a normal YouTube embed. They are not on the Bunny
pull zone; download them with `yt-dlp`.

## 3. Download paths

### A. Userscript (browser)

1. Install `ict-toolkit/userscript/ict-suite.user.js`.
2. Open the lesson page (`/lessons/<id>` or `/myLessons/<id>`).
3. `Alt+I` → **Videos** → **[Scan lesson]**.
   The suite calls `/api/lessons/{id}`, then `/generate-token` + `/api/videos/{id}`
   for each item.
4. Per video: **[DL]** (720p), **[DL 1080]**, **[HLS]** (copy playlist URL), or
   **[ffmpeg]** (copy a ready command).
5. If the pull zone is not cached yet, open the player once; the frame sniffer
   relays the `.m3u8` URL to the panel under **Captured media**.

The in-browser downloader fetches the master, picks the requested height,
downloads 4 segments at a time with retries, supports AES-128 if it ever
appears, concatenates to `.ts`, and saves through a Blob. It falls back from
`fetch` to `GM_xmlhttpRequest` when CORS blocks a request.

### B. CLI

```powershell
cd D:\Pentesting\ictfromabc

# One video by API id (needs a session token)
node ict-toolkit\cli\ict.mjs download 1131 --quality 720 --ffmpeg

# A whole lesson
node ict-toolkit\cli\ict.mjs download-lesson 151 --quality 720 --ffmpeg

# A playlist URL captured from the player (no token needed)
node ict-toolkit\cli\ict.mjs download-url `
  https://vz-0d705596-3d4.b-cdn.net/<guid>/playlist.m3u8 `
  --quality 720 --ffmpeg

# Resolve only (embed, signed embed, HLS candidate)
node ict-toolkit\cli\ict.mjs resolve 1131
```

Flags: `--out <dir|file>`, `--quality <height>`, `--ffmpeg` (remux to MP4 with
`-c copy`), `--keep-ts`, `--limit <n>` (first n segments, for testing),
`--dry-run`.

Output naming: `<videoId> - <title>.ts` (or `.mp4` after remux), one directory
per lesson for `download-lesson`.

Progress, retries, and failures are per segment; a failed segment retries four
times, then the video fails without deleting the other results.

`download-lesson` resolves every video first (embed + HLS URL) and only then
starts downloading. Segments do not need the Bearer token, so a login takeover
during the download phase does not stop the remaining videos.

### C. Raw ffmpeg

```powershell
ffmpeg -y `
  -headers "Referer: https://ictfromabc.com/`r`nOrigin: https://ictfromabc.com`r`n" `
  -i "https://vz-0d705596-3d4.b-cdn.net/<guid>/playlist.m3u8" `
  -c copy -bsf:a aac_adtstoasc "lesson.mp4"
```

`-c copy` keeps the original H.264/AAC; no re-encode.

### D. Validated end-to-end (12 Nov 2026)

- `resolve 1155` now follows the signed embed and returns its HLS URL.
- `download 1155 --limit 2 --ffmpeg` produced a 1.3 MB MP4 from 2 TS segments.
  `ffprobe`: H.264 1280x720 + AAC, 8.0 s.
- The 619330 720p variant lists 617 segments; no AES key, no DRM.
- Burp `GET /api/videos/1155/generate-token` returned `200` with a 64-hex token.

## 4. Quality selection

The master lists variants as `RESOLUTION` + `BANDWIDTH`; observed heights are
240/360/480/720. `--quality 720` picks exactly 720; if missing it picks the
highest height at or below the request, else the top variant. The userscript
defaults to 720 and the panel exposes 1080 (falls back the same way).

## 5. Failure modes

| Symptom | Cause | Fix |
|---|---|---|
| `403` from `b-cdn.net` | missing/wrong `Referer` | send `Referer: https://ictfromabc.com/` |
| `403` from `iframe.mediadelivery.net` | embed opened without token | call `generate-token`, append `token`/`expires` |
| `401` from `/api/videos/...` | a newer login replaced the Bearer token (one active session) | log in again on this device |
| `generate-token` 200 but no token | video not on Bunny or not entitled | inspect `video_url`; YouTube uses yt-dlp |
| playlist 404 | wrong GUID or pull zone | resolve the video again; open the player once |
| truncated `.ts` | segments failed midway | rerun with `--limit` to isolate, check retries |

## 6. Evidence files

- `analysis/raw/` — current JS chunks that implement the flow
  (`BgTg2qdf.js` video API, `BoaDJuae.js` lesson page, `uv04NaUW.js` fingerprint).
- Burp history — `GET /api/lessons/151`, `GET /api/videos/1131`,
  `GET /api/videos/1131/generate-token`, `GET /<guid>/playlist.m3u8`,
  thumbnail/preview requests.
- `ict-toolkit/tests/` — harness and real-origin rewrite test.
