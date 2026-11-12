# API_MAP.md — Complete ictfromabc.com API surface
**Date:** 2026-11-12 · **Method:** static extraction from local bundle mirrors (`js/` legacy, `js/current/` live build) + `api_paths_full.txt`, `auth_endpoints.txt`, `wayback_api.txt`, `access_control.txt`
**Base URL:** `https://ictfromabc.com/api` · **Auth:** `Authorization: Bearer <id>|<secret>` (Sanctum-style PAT in `localStorage.token`) · **No cookies.**
**Wrapper:** current build = `chunks/gH3D-RDX.js` (legacy = `chunks/L4WPQHn8.js`). All paths below are relative to `/api`.

Legend: **[C]** confirmed verbatim in bundle · **[W]** in Wayback capture · **[P]** prior pentest evidence (`access_control.txt`) · **[F]** LinkFinder/routes file, not runtime-verified.
Auth column: **PUB** = no token · **STU** = student token (401 anon / 403 admin-only confirmed for the marked ones) · **ADM** = admin token.

---

## 1. Auth & account lifecycle — `chunks/CD97E9Hu.js` (current) / `B7ab6jJc.js` (legacy) **[C]**

| Method | Path | Body / params | Auth | Notes |
|---|---|---|---|---|
| GET | `/validate-phone-number/{phone}` | — | PUB | V1 enumeration oracle (`{"exists":bool}`); throttle Limit 20 **[P]** |
| POST | `/request-otp-v2/{phone}` | — | PUB | OTP send (rate-limited) |
| POST | `/validate-otp-v2/{phone}` | `{otp}` | PUB | |
| POST | `/login` | `{phoneNumber, password, visitorId, confidenceScore}` | PUB | **Device-lock checkpoint.** 200 `{msg,token,role,skippable,course_id}`; 422 with `visitorId/confidenceScore: "Check Your Browser…"`; 302 `{redirect_url:"…/blocked"}` when paused |
| POST | `/login/otp` | `{phoneNumber, password, otp, visitorId, confidenceScore}` | PUB | OTP login — also carries fingerprint |
| POST | `/register` | `multipart/form-data` | PUB | |
| POST | `/logout` | `{}` | STU | |
| POST | `/user` | `{oldPassword,newPassword,newPassword_confirmation,_method:"PATCH"}` | STU | method-override PATCH |
| POST | `/forgot-password/request-otp/phone/{phone}` | — | PUB | |
| POST | `/forgot-password/validate-otp/phone/{phone}` | `{otp}` | PUB | |
| POST | `/forgot-password/reset/phone/{phone}` | `{otp, password, …}` | PUB | |

**Every login-shaped endpoint (`/login`, `/login/otp`) is a fingerprint choke point** — `visitorId` + `confidenceScore` (FingerprintJS Pro, key `rDaS5GdGD0S43aJ8ry6f`, ingress `metrics.ictfromabc.com`) are sent *only* here. All other calls carry just the Bearer token.

## 2. Student / profile / lessons — `chunks/B_dqzIxx.js` **[C]**

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/user` | STU | profile; 401 anon (auth-first ordering) **[P]** |
| POST | `/user` | STU | update profile (JSON) |
| POST | `/user/delete` | STU | `{password}` — self-delete, destructive |
| POST | `/user/id` | STU | upload NIC photo (multipart) |
| GET | `/email/resend` | STU | |
| GET | `/lessons` | STU | all lessons |
| GET | `/lessons/allowed` | STU | **my purchased lessons** (main content feed) |
| GET | `/lessons/{id}` | STU | videos for lesson |
| GET | `/courses/{id}` | STU | lessons by course |
| GET | `/purchases/tutes` | STU | my tutes |
| GET | `/videos/{id}` | STU | `{video_url,…}` — then token-append (§5) |
| GET | `/videos/{id}/generate-token` | STU | → `{token,expires}` for CDN URL signing |
| GET | `/zoom/{id}/add-registrant` | STU | Zoom join link |
| GET | `/email/resend` | STU | |
| POST | `/purchases/bank-transfer/{lessonId}` | STU | multipart `file` = payment slip |
| POST | `/purchases/online-transfer/{lessonId}` | STU | JSON, null body |
| POST | `/v2/purchases/online-transfer/{lessonId}` | STU | `{redirect_url, tute_ids[], bands{}, freeBandType}` |
| POST | `/reviews` | STU | `{…}` submit review |

## 3. Public (no auth) — `chunks/CzfSrzb2.js`, `DEHBxsXW.js`, `wkVuIK41.js` **[C]**

| Method | Path | Notes |
|---|---|---|
| GET | `/courses` | course list |
| GET | `/courses/{id}` | course lessons (also used authed) |
| GET | `/courses/ol-lessons` | O/L lessons |
| GET | `/courses/grades` | grades |
| GET | `/public/courses/{id}` | public course view |
| GET | `/public/courses/ol-lessons` | |
| GET | `/public/tutes` | tutes catalog |
| GET | `/tutes` | tutes catalog (authed variant) |
| GET | `/tutes/purchased?page=` | my tute purchases (paginated) |
| POST | `/tutes/delivery-fee` | multipart `tute_ids[]` |
| GET | `/pdfs/{id}` | PDFs |
| GET | `/institutes` | institute list (id 6 filtered client-side) |
| GET | `/admins` | admin cards |
| GET | `/telegram` | telegram links → `.data` **[W 200]** |
| GET | `/public-reviews` | reviews |
| GET | `/papers` | papers **[C]** |
| GET | `/practical-sessions` | list |
| GET | `/practical-sessions/availability` | |
| POST | `/practical-sessions/{id}` | book |
| DELETE | `/practical-sessions/{id}` | cancel |
| GET | `/events` | events on sale |
| GET | `/events/{id}` | event detail |
| POST | `/events/{id}/purchases/guest` | guest purchase → `{redirect_url}` (payment gateway) |
| GET | `/events/{id}/purchases/{ref}/status` | purchase status |

## 4. Student extras — `DWKMon6r.js`, `Bso1vT72.js`, `FiLe4k14.js`, `DQn851FC.js` **[C]**

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/student/events` · `/student/events/{id}` | STU | student event view |
| POST | `/events/{id}/purchases` | STU | `{numberOfTickets}` → `{redirect_url}` |
| GET | `/events/{id}/my-purchases` | STU | |
| POST | `/papers/upload/{id}` | STU | multipart paper submission |
| GET | `/papers/leaderboard/{id}` | STU | |
| GET | `/model-papers` | STU | model papers |
| GET | `/model-papers/availability` | STU | |
| POST | `/model-papers/upload/{id}` | STU | multipart upload answers |
| GET | `/files/secure/{id}/{filename}` | STU | **secure file download** → blob |
| GET | `/notifications` | STU | 401 anon **[P]** |

## 5. Video-token flow (media access) — `BoaDJuae.js` + `BgTg2qdf.js` **[C]**

```
GET /videos/{id}                  → { video_url, thumbnail_url, preview_url, … }
GET /videos/{id}/generate-token   → { token, expires }   (cached in-memory 5 min)
url + (url.includes('?') ? '&' : '?') + `token=${token}&expires=${expires}`
```
- YouTube URLs (`youtube.com`/`youtu.be`) are **skipped** (no token appended, not downloadable).
- Signed URLs point at Bunny CDN (`*.b-cdn.net`, `iframe.mediadelivery.net/embed/{libraryId}/{videoId}`); embed player from `assets.mediadelivery.net/playerjs/player-0.1.0.min.js`.
- A valid Bearer token ⇒ working video URLs. **This is the token-reuse path for other devices.**

## 6. Admin API (ADM only) — extracted chunks **[C]**

Access verified: STUDENT on `/admin/courses` = **403** **[P]**. Grouped by chunk:

**Courses/lessons/students** (`3C00S3wM.js`, `DtAuM1Kv.js`, `o83l1t9V.js`):
`GET/POST /admin/courses` · `GET /admin/courses/{id}` · `GET /admin/courses/{id}/students` · `POST /admin/courses/order` · `GET /admin/lessons` · `GET /admin/lessons/{id}` · `GET /admin/lessons/{id}/students` · `POST/PUT /admin/lessons`, `/admin/lessons/{id}` · `GET /admin/students…` **[F]**

**Users/NIC/payment checks** (`OgaeRCbo.js`, `o83l1t9V.js`):
`GET /admin/users/search/{q}` · `/admin/users/blocked` · `/admin/users/unverified-nic` · `/admin/users/unverified-email` · `GET /admin/users/{id}` · `GET /admin/admins/{id}` · `/admin/all-admins` · `POST /admin/id/{id}/{status}` · `POST /admin/check/{id}/{status}` · `POST /admin/applied/{id}/{status}` (all `{comments:""}`)

**Payments** (`BGBlHn-P.js`, `CYNsMASf.js`):
`GET /admin/purchases/accepted` · `/admin/purchases/online` · `/admin/slips/{status}` · `/admin/purchases/{studentId}` · `POST /admin/purchases/{studentId}` (FormData `items[] = {lesson_id,status}` — grant access) · `/admin/payments/pending|accepted|requests` **[F]**

**Tutes** (`CdvttfmZ.js`): `GET /admin/tutes` · `POST/PUT /admin/tutes` · `/admin/tutes/{id}` · `/admin/tutes/transfer` · `/admin/tutes/inventory[/{id}]` · `PATCH /admin/tutes/{id}` (toggle) · `DELETE /admin/tutes/{id}` · `/admin/tutes/{id}/students` · `/admin/tutes/unpacked|packed`

**Model papers** (`CgEnrGJP.js`): `/admin/model-papers/unmarked|marked|user/{id}` · `POST /admin/model-papers` · `/admin/model-papers/upload/{id}` · `PUT/DELETE /admin/model-papers/{id}` · `DELETE /admin/model-papers/answered/{id}`

**Papers** (`RB4MXAIS.js`): `GET/POST /admin/papers` · `PUT/DELETE /admin/papers/{id}` · `POST /admin/papers/{id}` (toggle) · `…/toggle-answer-script` · `POST /admin/papers/upload/{id}` · `GET /admin/papers/{id}/unmarked-submissions|marked-submissions`

**Past papers** (`nodes/31`): `GET/POST /admin/past-papers` · `GET/DELETE /admin/past-papers/{id}` (GET returns `{year:[papers]}`)

**Tags** (`DXhKq_RN.js`): `GET/POST /admin/tags` · `GET/PUT/DELETE /admin/tags/{id}` · `GET /admin/tags/student/{userId}`

**Call responses** (`CczqVMpR.js`): `GET /admin/call-responses[/{id}]` · `/active` · `POST` · `PUT /{id}` · `GET /{id}/students` · `POST /{id}/toggle-status` · plus `/admin/students/calls/responses[/{id}]` **[F]**

**Events (admin)** (`B6SKNgqH.js`, `Csyafj-i.js`): `GET/POST /admin/events` · `GET/PUT/DELETE /admin/events/{id}` · `GET /admin/events/{id}/purchases` · `POST /admin/event-purchases/{id}/resend` · `POST /admin/event-tickets/{code}/check` · `GET /admin/new-year-purchases[/{ref}]` · `POST /admin/new-year-purchases/resend/{id}`

**Misc admin**: `GET /admin/user` (admin profile) · `GET /admin/zoom` · `POST /admin/zoom/` · `GET /admin/dashboard` **[W 302]** · `GET /admin/sms/send|send-csv|sender-options|test` **[F]** · `GET /admin/tickets[/{id}]` + `PUT /admin/tickets/{id}/status` **[F]** · `GET /admin/reviews[/{id}]` · `/admin/tags` · `GET /admin/students/calls` **[F]** · `GET /admin/pendingNICs` · `GET /admin/new-year-purchases/ticket-check` **[F]** · `GET /admin/practical-sessions[/{id}]` **[F]** · `/admin/paper-class/{slug}` route **[F]** · `GET /admin/insights` **[F]**

## 7. Wrapper semantics — `gH3D-RDX.js` (current) / `L4WPQHn8.js` (legacy) **[C]**

- Base `https://ictfromabc.com/api`; `GET(path, params)` / `POST(path, body, contentType)` / `DELETE` / `PATCH` helpers; `FormData` ⇒ no content-type override.
- Reads `localStorage.token`, sends `Authorization: Bearer …` + `Accept: application/json`.
- Error classifier (throws, aborting the caller): **status 302 ⇒ set pause flag (Svelte writable, *in-memory only* — not persisted; reload resets it) + `goto(redirect_url)`** → SPA route `/blocked`. Server sends 302 **without a usable `Location`** (client uses default `redirect:"follow"` yet observes 302).
- **401 (gate hard-coded true) ⇒ remove `token`+`role`, then `goto("/auth/login")`; 403 ⇒ `goto("/auth/login")`, token kept.**
- `/blocked` (old node 53 / current node 60 — the *only* consumers of the pause flag): `onMount` bounces to `/auth/login` if flag off; `onDestroy` resets flag + removes `token`+`user` — **NOT `role`** (role survives and rehydrates the auth store on next boot).
- Error unpack order: `message` → `msg` → `errors[field][0]`.
- Pagination everywhere: `{data, next_page_url, total}` cursor style; `getCursorPaginationNextPage(url)` follows absolute next-page URLs (token attached).
- CORS: `Access-Control-Allow-Origin` echoed only for `https://www.ictfromabc.com`; `Origin: evil` ⇒ no ACAO **[P]**.

## 8. Non-API HTTP surfaces

- **FingerprintJS Pro:** `metrics.ictfromabc.com` (ingress), client key `rDaS5GdGD0S43aJ8ry6f`.
- **CDN/media:** `assets.mediadelivery.net/playerjs/player-0.1.0.min.js`, `iframe.mediadelivery.net/embed/{lib}/{vid}`, `*.b-cdn.net` playlists; `youtube.com/iframe_api` (dual player injection).
- **Storage (Laravel):** `https://ictfromabc.com/storage/…` — 301 downgrades to `http://` **[P]** (V2).
- **Payments:** external gateway redirect via `redirect_url` returned by `/purchases/online-transfer/*` and event purchases (event guest purchase also uses `{redirect_url}` — **distinct from the pause redirect_url; distinguish by HTTP status: pause = 302, payment = 200**).

## 9. Known response shapes

```jsonc
// POST /api/login 200
{"msg":"Login Successful","token":"1023295|GJEm…","role":"STUDENT","skippable":1,"course_id":"2027-al"}
// POST /api/login 422 (fingerprint rejection)
{"message":"Phone number is required (and 3 more errors)","errors":{"phoneNumber":["…"],"password":["…"],
 "visitorId":["Check Your Browser. If Nothing works contact Support Staff"],
 "confidenceScore":["Check Your Browser. If Nothing works contact Support Staff"]}}
// Paused account: HTTP 302, body {"redirect_url":"https://ictfromabc.com/blocked"}
```

## 10. Access-control summary (from prior active tests) **[P]**

| Endpoint | Anon | STUDENT |
|---|---|---|
| `/api/user`, `/api/notifications` | 401 | 200 |
| `/api/admin/courses` (any `/admin/*`) | 401/302 | **403** |
| `/api/login` wrong method | 405 `Allow: POST` | — |
| `/api/validate-phone-number/{n}` | 200 oracle | — |
| Login rate limit | `X-RateLimit: 30` | — |
| TRACE | 405 via Cloudflare | — |

## 11. Gaps / not extracted (honest inventory)

- No server route manifest is exposed; Laravel routes not enumerable from JS — endpoints only reachable by the calling chunks exist in this map.
- `wayback_api.txt` shows 302s for `/admin/courses`, `/admin/dashboard`, `/notifications` on unauthenticated Wayback fetches (likely redirect-to-login captured as 302 — consistent with §7).
- `/api` and `/storage` **301 https→http** downgrade seen live (V2) — Bearer leakage risk when following redirects.
- WebSocket/SSE endpoints: none found in bundles.
- `node 53.D8Yrkq-u.js` (legacy `/blocked` logic) and legacy `BitTBVkN.js`/`B7ab6jJc.js` mirror the current chunks; where they differ, **the `js/current/` build is authoritative**.
- Endpoints marked **[F]** come from LinkFinder/routes files only; HTTP behavior not re-verified in this pass.
