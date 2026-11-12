# API_MAP_CURRENT.md — ictfromabc.com API map (build of 2026-11-12)

Scope: the student-facing API of the account in this workspace. The admin
namespace is listed for completeness but is not used and not exercised.

- Base URL: `https://ictfromabc.com/api`
- Auth: `Authorization: Bearer <token>` — Laravel Sanctum personal access token
  (`<id>|<40-char-secret>`), stored in `localStorage.token`
- Content type: `application/json`
- Rate limit: `X-Ratelimit-Limit: 60` per minute (observed on authenticated calls)
- CORS: same-origin only; `Vary: Origin`
- API is stateless: no per-request device or fingerprint header. Device binding
  happens only at `/login` (see `DEVICE_LOCK_BYPASS.md`).
- Unknown routes answer `404` with a SvelteKit HTML shell or JSON, depending on
  the `Accept` header.

Extraction sources: current `_app/immutable` bundles (201 unique method/path
pairs, `analysis/api_findings_current.json`), Burp history from a successful
student session (18 Oct 2026), and live unauthenticated probes.

---

## 1. Authentication

### `POST /api/login`

```json
{
  "phoneNumber": "07XXXXXXXX",
  "password": "<password>",
  "visitorId": "<FingerprintJS visitorId>",
  "confidenceScore": 0.97
}
```

Success `200` keys observed: `msg`, `user`, `token`, `role`, `authenticated`,
`skippable`, `course_id`. Current sessions are role `STUDENT`,
course `2027-al`.

Failure modes:

| Status | Body | Meaning |
|---|---|---|
| 401 | `{"message":"..."}` | wrong phone/password |
| 422 | `{"message":"...","errors":{...}}` | validation (password length, phone format) |
| 302 | `{"redirect_url":"/blocked"}` | account on pause (device/network rule tripped) |
| 302 | `{"token":...,"redirect_url":"/blocked"}` | pause response that still carries a token; the client converts it to a session |

The pause branch is implemented in the current bundles; it was not triggered in
this session (doing so risks a staff-only pause), so both variants are handled
defensively by the userscript and the CLI.

**Session rules.** Tokens have **no fixed TTL**. An early "3-minute absolute
TTL" reading (`200` at 170 s, `401` at 180 s) was an artifact: the probe was
sharing the account with a second logging-in client, and the 401 at 180 s was a
cross-login revocation, not expiry. The binding rule is single-session — every
successful login revokes all previously issued tokens for the account (token A
valid at t=1 s, login B at t=3 s, token A `401` at t=3 s, token B `200`).
Verified repeatedly on 2026-11-12 with live token replacements
(1140929 → 1140943 → 1140953) and an uncontended session that stayed valid far
beyond 3 minutes. A client that re-logs in after being replaced therefore kills
the other client's token in a loop, which looks like a random short TTL.

### `POST /api/login/otp`

Same body plus `otp`. Used when the account has OTP enabled. The userscript
rewrites `visitorId`/`confidenceScore` here too.

### `POST /api/logout`

Bearer-authenticated. Invalidates the current token.

### `GET /api/user`

Returns the student profile object. Keys observed: `whatsapp_number`,
`telegram_number`, `birthday`, `course_id`, `medium`, `school`, `institute_id`,
`address`, `nearest_city`, `district`, `id_number`, `first_name`, `last_name`,
`email`, `phone_number`, `last_active_at`, `verified_id`, `verified_email`.
(Values intentionally omitted.)

### `PUT /api/user`, `POST /api/user`, `POST /api/user/id`, `POST /api/user/delete`

Profile update, avatar/ID upload (`file`), account deletion (`password`).

### OTP / password reset

```
POST /api/request-otp-v2/{phone}
POST /api/validate-otp-v2/{phone}                 {otp}
GET  /api/validate-phone-number/{phone}
POST /api/forgot-password/request-otp/phone/{phone}
POST /api/forgot-password/validate-otp/phone/{phone}   {otp}
POST /api/forgot-password/reset/phone/{phone}          {otp,password,password_confirmation}
POST /api/forgot-password/request-otp/email            {email}
POST /api/forgot-password/validate-otp/email           {email,otp}
POST /api/forgot-password/reset/email                  {email,otp,password,password_confirmation}
GET  /api/email/resend
```

---

## 2. Courses, lessons, videos

### `GET /api/courses`

Grouped catalogue:

```json
{
  "al":   [{"id":"2027-al","title":"A/L 2027","type":"al","telegram_link":"..."}],
  "ol":   [{"id":"2025-ol","title":"O/L 2025 (GRADE 10)","type":"ol","telegram_link":null}],
  "pdfs": [{"id":"tute","title":"Lesson Wise Tutes"}]
}
```

### `GET /api/lessons/allowed`

Array of lessons the authenticated account may open. Item keys observed:
`id`, `title`, `description`, `thumbnail_url`, `preview_url`, `created_at`.
This is the entry point for the downloader: it returns lesson IDs, not videos.

### `GET /api/lessons/{lessonId}`

```json
{
  "lesson": {"id": 151, "title": "...", "description": "..."},
  "videos": [
    {
      "id": 1131,
      "title": "...",
      "video_url": "https://iframe.mediadelivery.net/embed/415489/<guid>?preload=false",
      "thumbnail_url": "http://img.youtube.com/vi/<id>/0.jpg",
      "preview_url": null,
      "created_at": "2026-04-07T17:38:15.000000Z"
    }
  ],
  "live": false
}
```

`videos[].video_url` is the player source: a Bunny Stream embed
(`iframe.mediadelivery.net/embed/<library>/<guid>`), a YouTube URL, or an HLS
URL. It carries no media token.

### `GET /api/videos/{videoId}`

```json
{"video_url":"https://iframe.mediadelivery.net/embed/415489/<guid>?preload=false"}
```

### `GET /api/videos/{videoId}/generate-token`

```json
{"message":"Token generated successfully","token":"<64 hex>","expires":1792316664}
```

`expires` is Unix seconds. The token is appended to the embed/thumbnail URLs as
`?token=...&expires=...`; it does not gate the Bunny pull-zone playlist (see
`VIDEO_PIPELINE.md`).

### Live-verified calls (Burp, 12 Nov 2026)

| Request | Status | Notes |
|---|---|---|
| `GET /api/user` | `200` | profile object, account `79787` |
| `GET /api/lessons/allowed` | `200` | 11 lessons |
| `GET /api/lessons/151` | `200` | 8 videos |
| `GET /api/videos/1131` | `200` | embed, library `415489` |
| `GET /api/videos/1155/generate-token` | `200` | 64-hex token, `expires` 24 h out |

Also observed in a live browser session: `GET /api/courses`, `/api/events`,
`/api/telegram`, `/api/notifications`, `/api/model-papers/availability`,
`/api/practical-sessions/availability`, `/api/student/events`, `/api/pdfs/tute`,
`/api/lessons/128`.

Login rate limit is `30` (`X-Ratelimit-Limit`); authenticated calls observed at
`60` per minute.

### Other lesson-adjacent endpoints

```
GET  /api/lessons                     full lesson catalogue (course-filtered)
GET  /api/courses/{courseId}
GET  /api/courses/grades
GET  /api/courses/ol-lessons
GET  /api/public/courses/{courseId}
GET  /api/public/courses/ol-lessons
GET  /api/tutes                       tute catalogue
GET  /api/tutes/purchased?page=N
GET  /api/pdfs/{id}                   PDF delivery (bearer)
GET  /api/files/secure/{a}/{b}        secure file delivery
```

---

## 3. Papers and model papers

```
GET  /api/papers
GET  /api/papers/leaderboard/{paperId}
POST /api/papers/upload/{paperId}      multipart file
GET  /api/model-papers
GET  /api/model-papers/availability    {"availability": true|false}
POST /api/model-papers/upload/{id}     multipart file
GET  /api/practical-sessions
GET  /api/practical-sessions/availability
POST /api/practical-sessions/{id}
DELETE /api/practical-sessions/{id}
```

---

## 4. Events, purchases, notifications

```
GET  /api/events
GET  /api/events/{id}
GET  /api/events/{id}/my-purchases
GET  /api/events/{id}/purchases/{purchaseId}/status
POST /api/events/{id}/purchases            {numberOfTickets}
POST /api/events/{id}/purchases/guest
GET  /api/student/events
GET  /api/student/events/{id}

GET  /api/purchases/bands/free-eligibility
POST /api/purchases/bands/{id}
POST /api/purchases/bank-transfer/{id}     multipart file
POST /api/purchases/bank-transfer/0        multipart file + tute_ids[]
POST /api/purchases/online-transfer/{id}
POST /api/v2/purchases/online-transfer/{id}
POST /api/tutes/delivery-fee               multipart file + tute_ids[]

GET  /api/notifications                    paginated {data, next_page_url}
POST /api/notifications/{id}
POST /api/notifications/read-all
DELETE /api/notifications/delete-all

GET  /api/telegram                         {data, msg, status}
GET  /api/zoom/{id}/add-registrant
POST /api/reviews
GET  /api/public-reviews
GET  /api/institutes
```

---

## 5. Error semantics used by the client

| Status | Client behaviour |
|---|---|
| `401` | removes `token` and `role`, redirects to `/auth/login` |
| `302` | reads `redirect_url`, sets the pause flag, navigates to `/blocked` |
| `403` | shows a generic error; no redirect |
| `422` | renders field errors from `errors` |
| `429` | rate-limited; back off |

The client wrapper is defined in `js/current/_app/immutable/chunks/gH3D-RDX.js`
(base `https://ictfromabc.com/api`). Method map in the bundle:
`j=GET, O=POST, P=PUT, T=DELETE, $=PATCH`.

---

## 6. Admin namespace (not used)

The bundles contain ~130 `/api/admin/*` routes (courses, lessons, videos,
papers, model papers, practical sessions, events, admins, insights, purchases,
call responses). They require an admin role. No admin request is made by this
toolkit, and none should be.

---

## 7. Redaction rules for exports

- Never write `token`, `password`, `otp`, `id_number`, `address`, `phone_number`,
  `email`, or `birthday` into `analysis/` or any committed file.
- The userscript's API log stores method + path + status only, never bodies.
- `ict-toolkit/config/session.local.json` holds the live token by design; keep it
  out of version control and delete it when done.
