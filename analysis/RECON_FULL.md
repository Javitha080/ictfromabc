# RECON_FULL.md — ictfromabc.com complete surface map (build of 2026-11-12)

Sources: `analysis/pretty/*.pretty.js` (36 files, primary), full mirror
`js/current/_app/immutable/**` (241 files; used to verify chunks absent from the
pretty set), `analysis/raw/**` (HTML shells, bunny files, live logs),
`analysis/api_findings_current.json`, `analysis/API_MAP_CURRENT.md`,
`analysis/API_MAP.md`, `analysis/VIDEO_PIPELINE.md`,
`userpannel/ictfromabc-bypass.user.js` (API_MAP array only).

Headline: **202 unique method+path pairs under `/api`** (201 via the wrapper +
1 direct fetch), i.e. the bundles carry 131 `/admin/*` pairs and 71
student/public pairs. No robots/sitemap/health/status/webhook strings exist in
any bundle. Saved `raw/api_*.json` files are all `{"message":"Unauthenticated."}`
placeholders — no response bodies to mine there.

---

## 1. Namespace tables (method · path · auth · notes)

Source shorthand: `gH3D` = pretty/chunks_gH3D-RDX.pretty.js, `AUTH` =
chunks_CD97E9Hu.pretty.js, `STU` = chunks_B_dqzIxx.pretty.js, `PUB` =
chunks_CzfSrzb2.pretty.js, `EVT` = chunks_DWKMon6r.pretty.js, `MP` =
chunks_FiLe4k14.pretty.js, `PS` = chunks_D8xuGZSL.pretty.js, `GT` =
chunks_BoaDJuae.pretty.js, `ADM` = current_o83l1t9V.pretty.js, `js/…` = the
full-mirror chunk under js/current/_app/immutable/.

### auth (4)
| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | /login | public | AUTH:21 — {phoneNumber,password,visitorId,confidenceScore} |
| POST | /login/otp | public | AUTH:29 — +otp |
| POST | /logout | bearer | AUTH:40 |
| POST | /register | public | AUTH:37 — multipart; **absent from both curated maps** |

### otp (9)
| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | /validate-phone-number/{phone} | public | AUTH:4 — enumeration oracle |
| POST | /request-otp-v2/{phone} | public | AUTH:14 |
| POST | /validate-otp-v2/{phone} | public | AUTH:9 — {otp} |
| POST | /forgot-password/request-otp/phone/{phone} | public | AUTH:49 |
| POST | /forgot-password/validate-otp/phone/{phone} | public | AUTH:54 |
| POST | /forgot-password/reset/phone/{phone} | public | AUTH:59 |
| POST | /forgot-password/request-otp/email | public | AUTH:64 |
| POST | /forgot-password/validate-otp/email | public | AUTH:69 |
| POST | /forgot-password/reset/email | public | AUTH:74 |

### user (6)
| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | /user | bearer | STU:8 |
| PUT | /user | bearer | STU:10 — profile update |
| POST | /user | bearer | AUTH:46 — password change {_method:"PATCH"} |
| POST | /user/id | bearer | STU:39 — multipart NIC photo |
| POST | /user/delete | bearer | STU:26 — {password}, destructive |
| GET | /email/resend | bearer | STU:36 |

### courses (7)
GET /courses (PUB:15) · GET /courses/{courseId} (STU:4, js/ DEHBxsXW) ·
GET /courses/grades (PUB:27) · GET /courses/ol-lessons (js/ DEHBxsXW) ·
GET /public/courses/{courseId} (PUB:14) · GET /public/courses/ol-lessons (PUB:10)
· GET /public/tutes (PUB:4). First three bearer-in-practice, `/public/*` public.

### lessons (5)
GET /lessons (STU:5) · GET /lessons/{lessonId} (STU:11) · GET /lessons/allowed
(STU:6) · GET /tutes (js/ wkVuIK41) · GET /tutes/purchased?page={n}
(js/ wkVuIK41, {data,pagination{total,per_page,current_page,last_page,…}}).

### videos (2)
GET /videos/{videoId} (STU:33) · GET /videos/{videoId}/generate-token (GT:4).

### pdfs (2)
GET /pdfs/{idOrType} (js/ DEHBxsXW) — id delivery or type list
(tute|lesson-pp|paper-book); `/api/pdfs/tute` live-observed. ·
GET /files/secure/{a}/{b} (js/ DQn851FC) — blob download.

### papers (11)
GET /papers · GET /papers/leaderboard/{id} · POST /papers/upload/{id} (all js/
Bso1vT72) · GET /model-papers (MP:9) · GET /model-papers/availability (MP:4) ·
POST /model-papers/upload/{id} (MP:14) · GET /practical-sessions (PS:3) ·
GET /practical-sessions/availability (PS:6) · POST /practical-sessions/{id}
(PS:5, null body) · DELETE /practical-sessions/{id} (PS:4) ·
**GET /past-papers/{slug} (js/ nodes/73.BbuEYMhF.js:1 + nodes/89.DpthjYV6.js:7 —
direct `fetch()`, no Bearer, returns `{year:[papers]}`)**.

### events (8)
GET /events (js/ BuvdwmeH — **200 while logged out**, raw/live/browser-api-requests.txt:1) ·
GET /events/{id} (BuvdwmeH) · POST /events/{id}/purchases (EVT:5, {numberOfTickets}
→ {redirect_url}) · POST /events/{id}/purchases/guest (BuvdwmeH) ·
GET /events/{id}/purchases/{ref}/status (BuvdwmeH) · GET /events/{id}/my-purchases
(EVT:6) · GET /student/events (EVT:3) · GET /student/events/{id} (EVT:4).

### purchases (7)
GET /purchases/bands/free-eligibility (js/ CdMOgjNl → .eligibility) ·
POST /purchases/bands/{purchaseId} (CdMOgjNl, {bands:{Name:qty},freeBandType}) ·
POST /purchases/bank-transfer/{lessonId} (STU:14, multipart slip → .data.purchase_id) ·
POST /purchases/bank-transfer/0 (js/ wkVuIK41, slip + tute_ids[]) ·
POST /purchases/online-transfer/{lessonId} (STU:16, null JSON body → {redirect_url}) ·
POST /v2/purchases/online-transfer/{lessonId} (STU:23, {redirect_url,tute_ids?,bands?,freeBandType?}) ·
GET /purchases/tutes (STU:7).

### notifications (4) — js/ chunks/DzAMTzGs.js
GET /notifications → {data:[{id,data:{msg,link},time_elapsed,read_at}],next_page_url} ·
POST /notifications/{id} · POST /notifications/read-all ·
DELETE /notifications/delete-all.

### misc (6)
GET /telegram (PUB:37 — **200 logged out**) · GET /institutes (PUB:17,22; id 6
filtered client-side) · GET /public-reviews (PUB:42) · POST /reviews (STU:42) ·
GET /zoom/{id}/add-registrant (STU:28 → {join_url}) · POST /tutes/delivery-fee
(js/ wkVuIK41, tute_ids[] → {postal_fee,tute_fee}).

### admin (131) — bearer, ADMIN/SUPER_ADMIN role; STUDENT verified 403 on /admin/courses
| Group (file) | Endpoints |
|---|---|
| course/lesson/video/student core (js/ 3C00S3wM, DtAuM1Kv, ADM) | GET /admin/courses · GET /admin/courses/{id} · GET /admin/courses/{id}/students · POST /admin/courses · POST /admin/courses/{id} (_method=PUT) · POST /admin/courses/order · DELETE /admin/courses/{id} · PATCH /admin/courses/{id}/toggle-status-all · GET /admin/lessons · GET /admin/lessons/{id} · GET /admin/lessons/{id}/students · POST /admin/lessons · POST /admin/lessons/{id} · DELETE /admin/lessons/{id} · PATCH /admin/lessons/{id}/toggle-status-all · POST /admin/videos · POST /admin/videos/{id} · DELETE /admin/videos/{id} · PATCH /admin/videos/{id}/toggle-status · GET /admin/user (STU:9) · GET /admin/users/{id} · PATCH /admin/users/{id} · PATCH /admin/users/{id}/reset-password |
| user search / NIC (js/ OgaeRCbo, DtUzyJrk) | GET /admin/users/search/{q} · GET /admin/users/blocked · GET /admin/users/unverified-nic · GET /admin/users/unverified-email · GET /admin/admins/{id} · GET /admin/all-admins · GET /admin/ids/unverified · GET /admin/dashboard |
| verification actions (ADM:31-44,144) | POST /admin/id/{id}/{status} · POST /admin/check/{id}/{status} · POST /admin/applied/{id}/{status} (all {comments:""}) · GET /admin/check/{id} (blob) |
| admins (ADM:21,67,92,99,107) | GET /admin/admins · POST /admin/add-admin (FormData) · POST /admin/admins/{id} (FormData + _method=PUT) · POST /admin/admins/role ({title}) · DELETE /admin/admins/{id} |
| payments (js/ BGBlHn-P) | GET /admin/purchases/{studentId} · GET /admin/purchases/accepted · GET /admin/purchases/online · GET /admin/slips/{status} · POST /admin/purchases/{studentId} (FormData items[]={lesson_id,status} = grant access) |
| tutes (js/ CdvttfmZ) | GET /admin/tutes · GET /admin/tutes/{id} · GET /admin/tutes/{id}/students · GET /admin/tutes/inventory · GET /admin/tutes/inventory/{id} · GET /admin/tutes/packed · GET /admin/tutes/unpacked · POST /admin/tutes · POST /admin/tutes/{id} · POST /admin/tutes/csv · POST /admin/tutes/package · POST /admin/tutes/pdf · POST /admin/tutes/transfer · PATCH /admin/tutes/{id} · DELETE /admin/tutes/{id} |
| model papers (js/ CgEnrGJP) | GET /admin/model-papers/marked · /unmarked · /user/{id} · POST /admin/model-papers · /{id} · /upload/{id} · DELETE /admin/model-papers/{id} · DELETE /admin/model-papers/answered/{id} |
| papers (js/ RB4MXAIS) | GET /admin/papers · POST /admin/papers · POST /admin/papers/{id} · POST /admin/papers/upload/{id} · PATCH /admin/papers/{id} · PATCH /admin/papers/{id}/toggle-answer-script · DELETE /admin/papers/{id} · GET /admin/papers/{id}/marked-submissions · /unmarked-submissions |
| past papers (js/ nodes/31) | GET/POST /admin/past-papers · GET/DELETE /admin/past-papers/{id} |
| tags (js/ DXhKq_RN) | GET/POST /admin/tags · GET/POST/PUT/DELETE /admin/tags/{id} · GET /admin/tags/student/{userId} |
| call responses (js/ CczqVMpR) | GET /admin/call-responses · /{id} · /{id}/students · /active · POST /admin/call-responses · PUT /{id} · PATCH /{id}/toggle-status · POST /admin/student-calls (js/ BN2KxrB7) · GET /admin/users/pending-student-calls (BN2KxrB7) |
| events (js/ B6SKNgqH, Csyafj-i) | GET /admin/events · /{id} · /{id}/purchases · POST /admin/events · /{id} · DELETE /admin/events/{id} · POST /admin/event-purchases/{id}/resend · POST /admin/event-tickets/{code}/check · GET /admin/new-year-purchases · POST /admin/new-year-purchases/{id} · POST /admin/new-year-purchases/resend/{id} |
| practical (js/ nodes/35) | GET/POST /admin/practical-sessions · GET/POST/PATCH/DELETE /admin/practical-sessions/{id} |
| insights (js/ nodes/24) | GET /admin/insights · GET /admin/insights/lapsed-export |
| sms (js/ nodes/39) | GET /admin/sms/sender-options · POST /admin/sms/send · /send-csv · /test |
| tickets (js/ nodes/49) | GET /admin/tickets · GET /admin/tickets/{id} · POST /admin/tickets · PATCH /admin/tickets/{id}/status · GET/POST /admin/ticket-categories |
| reviews (ADM:165,170) | GET /admin/reviews?{status} · PATCH /admin/reviews/{id} ({status}) |
| zoom (ADM:11,62,112) | GET /admin/zoom · POST /admin/zoom/ (**trailing slash literal**) · DELETE /admin/zoom/{id} |
| public-ish (PUB:32) | **GET /admins** (no /admin prefix; admin cards to any visitor — used by register/profile flows) |

---

## 2. WIRINGS (with evidence)

### 2.1 Fetch wrapper — `chunks_gH3D-RDX.pretty.js`
Base (line 29): `const y = "https://ictfromabc.com/api";`
Request builder (39-49): `Accept: application/json` always; optional
Content-Type; `FormData` body passed untouched, everything else
`JSON.stringify` + `application/json`; **`Authorization: Bearer
${localStorage.getItem("token")}` attached only when a token exists**; params →
URLSearchParams, null/"" values dropped; `fetch(\`${y}${e}${l}\`, n)`.
Exports (70): `j=GET a`, `T=DELETE d`, `O=POST p`, `P=PUT c`, `$=PATCH b`,
`A=g` = raw GET to an absolute URL with Bearer (pagination next_page_url).

handleResponse `w` (14-28) — on `!t.ok`, parse body then:
- **302** → `g.set(!0)` (pause writable, `chunks_DwVtshrH.pretty.js:2`, in-memory
  only) + `await h(r.redirect_url)` → SPA-navigates to `/blocked`.
- **401 or 403** → gate `p===true` (line 6, `const p = !0`): **only on 401**
  `localStorage.removeItem("token"); localStorage.removeItem("role");` then
  `await h("/auth/login")`. **403 redirects too but keeps the token.**
- **422/400/429** → no special case; error text = `r.message || r.msg ||
  r.errors[Object.keys(r.errors)[0]][0]`; throws `ApiError{status}`.
- Returns the Response; callers `.json()` themselves (no auto-unwrap).

Pagination (GT:8-14, ADM:156-161): `getCursor/PaginationNextPage(url)` calls
`A(url)` (Bearer GET on the absolute `next_page_url`) → `{data,next_page_url}`.

### 2.2 Session store & roles — `js/current chunks/CWqXeFnL.js`, `BbwfBUtK.js`
`setSession(token,role)` → `localStorage.setItem("token",t);
localStorage.setItem("role",o)` + writable store; `restore()` rehydrates from
those two keys. Roles enum: `ADMIN | SUPER_ADMIN | STUDENT`. Login node routes
by role (nodes_58:756-765): STUDENT → `/dashboard/myLessons`, ADMIN/SUPER_ADMIN
→ `/admin/courses`, else error panel. **No other localStorage/sessionStorage
key is used anywhere in the bundles** (no persisted fingerprint, no `user`
setter — `user` is only *removed*, see §2.5).

### 2.3 Login + fingerprint — `nodes_58_Pv9o42ea.pretty.js:726-822`, `raw/uv04NaUW.js`
```js
const st=Rt.load({apiKey:"rDaS5GdGD0S43aJ8ry6f",region:void 0,
  endpoint:"https://metrics.ictfromabc.com",
  scriptUrlPattern:"https://metrics.ictfromabc.com/web/v<version>/<apiKey>/loader_v<loaderVersion>.js"}),
dt=async()=>{const r=await st,e=await(r?.get());
  return{visitorId:e?.visitorId,confidenceScore:e?.confidence.score}};
export{dt as getFingerprint};
```
FingerprintJS **Pro v3.9.6** proxied through the operator's own subdomain
`metrics.ictfromabc.com` (FPJS default `fpnpmcdn.net` pattern is overridden).
Dynamically imported on the login page only (nodes_58:1,739 with
`__vite__mapDeps(["../chunks/uv04NaUW.js","../chunks/Dl-EBvGR.js"])`).
`visitorId`/`confidenceScore` are sent **only** in `POST /login` and
`POST /login/otp` bodies (AUTH:21,29). Everything else is Bearer-only.
Phone client-validation: `a.length===10 && /^07\d+$/` (nodes_58:819);
`?phone=` query pre-fills the field (nodes_58:740-741).
Video gate hook at login (nodes_58:758): `Ae.ENABLE_VIDEO_GATE &&
I.course_id=="2025-al" && I.skippable==0 || K("/dashboard/myLessons")` — flags
in `chunks_BKeoPcEv.pretty.js` show `ENABLE_VIDEO_GATE:!1` (dormant), alongside
`ENABLE_BAND_PURCHASE:!0` and everything else `false`.

### 2.4 Lesson → video → token playback chain
1. `GET /lessons/allowed` (myLessons) or `GET /courses/{id}` → lesson ids.
2. Videos page `/dashboard/lessons/[lessonID]/videos`
   (`nodes_65_DmKDf32T.pretty.js`): `Promise.all([profile(), lessonVideos(id)])`
   → `GET /lessons/{id}` → **immediately tokenizes every item** via
   `BgTg2qdf.a(videos)`.
3. Tokenizer `chunks_BgTg2qdf.pretty.js`: collects ids of non-YouTube videos,
   for each `BoaDJuae.generateToken(id)` → `GET /videos/{id}/generate-token` →
   `{token,expires}`; in-memory `Map` cache reused while
   `expires > Date.now()/1e3 + 300` (~5 min margin, lines 10-20); URL append
   (lines 6-9): `url + (url.includes("?") ? "&" : "?") + \`token=${n}&expires=${r}\``
   applied to `video_url`, `thumbnail_url`, `preview_url`.
4. Click play (`nodes_65:543-577`): `getVideoLink(id)` = `GET /videos/{id}` →
   `BgTg2qdf.b(video_url, id)` (single-URL token append, skipping YouTube) →
   YouTube branch: `src + "&enablejsapi=1&origin=" + location.origin` with
   `YT.Player`; Bunny branch: raw iframe src + `new playerjs.Player(iframe)`.
5. Player scripts loaded (nodes_65:490-498):
   `//assets.mediadelivery.net/playerjs/player-0.1.0.min.js` and
   `https://www.youtube.com/iframe_api`.
Confirmed end-to-end by `analysis/VIDEO_PIPELINE.md` (embed 403 without token;
pull zone `vz-*.b-cdn.net` needs only `Referer: https://ictfromabc.com/`;
libraries 415489/619330; video 1155 = 617 segments, no AES).

### 2.5 Pause / blocked semantics
`/blocked` node (`js/current nodes/60.e0BIi-sy.js`): onMount — if the pause
writable is false → `b("/auth/login")` (direct URL visit bounces); onDestroy —
`r.set(!1)`, `localStorage.removeItem("token")`,
`localStorage.removeItem("user")` (**removes `user`, never `role`, and `user`
is never set anywhere — legacy cleanup**). Server 302 bodies observed:
`{"redirect_url":"/blocked"}` and `{"token":…,"redirect_url":"/blocked"}`
(API_MAP_CURRENT.md:46-47). Distinguish from the payment `redirect_url`
(HTTP 302 = pause; HTTP 200 = gateway) — API_MAP.md §8.

### 2.6 Purchase flows
- **Bank (lesson)** `chunks_DxjtTLou.pretty.js:247-268`: `uploadPaymentSlip(id,
  file, Number(price)+bandTotal)` → `POST /purchases/bank-transfer/{id}`
  (multipart `file`) → `.data.purchase_id` → if bands selected
  `postBandPurchase(purchase_id, f, freeBandType)` →
  `POST /purchases/bands/{purchaseId}` `{bands:{…},freeBandType}` →
  status `PENDING` (ADM-style approval flow via /admin/check).
- **Online (lesson)** STU:16-25: `onlinePayment(id)` (null JSON body) or
  `onlinePaymentV2(id, redirect_url, tute_ids[], bands{}, freeBandType)` →
  `POST /v2/purchases/online-transfer/{id}`; **both return `redirect_url`**
  and the caller navigates (`window.location.href`, EVT:23-24 pattern).
- **Tutes** js/ wkVuIK41: `POST /purchases/bank-transfer/0` multipart
  (`file` + `tute_ids[]`); `POST /tutes/delivery-fee` (`tute_ids[]`) →
  `{postal_fee,tute_fee}`; purchased list = `GET /tutes/purchased?page=`.
- **Events** EVT:5 / BuvdwmeH: guest + student variants; both funnel through
  `{redirect_url}` gateway hop and `GET …/purchases/{ref}/status` polling.
- Band picker UI (`chunks_DxjtTLou.pretty.js:677-678`): disabled when
  `course_id=="tutes"`, text `Purchased | Free Lesson | Visit`; bands map built
  from `Object.values(be)` (band enum in js/ chunks/sbEMizi9.js).

### 2.7 Notifications UI — js/ chunks/DzAMTzGs.js
`GET /notifications` on mount; unread badge = `data.filter(!read_at).length`;
`next_page_url` → infinite scroll via IntersectionObserver
(`rootMargin:"200px"`) + `BoaDJuae.getCursorPaginationNextPage` (Bearer on the
absolute URL); items are `<a href={data.link}>` — server-controlled absolute
links; mark-one / read-all / delete-all wired to the 3 POST/DELETE pairs.

### 2.8 Direct-fetch bypass of the wrapper (only 2 in the whole build)
`GET https://ictfromabc.com/api/past-papers/{slug.toLowerCase()}` with headers
`{Accept:"application/json"}` **and no Bearer** — js/ nodes/73.BbuEYMhF.js (base
hardcoded `const s="https://ictfromabc.com/api"`) and nodes/89.DpthjYV6.js
(slug = route param, `al|ol`). Both /dashboard/pastPapers/[slug=papers] and
/public-dashboard/papers/[slug=papers] use it. Consequence: public past-paper
index, no auth, not rate-limit-consistent with wrapper traffic.

### 2.9 SvelteKit client plumbing
- `window.fetch` monkey-patched for data-sveltekit-fetched cache
  (js/ chunks/BeM-f5b2.js); updater pings `GET {assets}/_app/version.json`
  with `pragma/cache-control: no-cache` and compares build `1793372044457`.
- Matchers (entry_app:1-8): `paper_class` = `revision|main`, `papers` = `al|ol`.
- HTML shells (raw/login.html, course.html, myLessons.html, viewer.html) are
  plain SPA shells; viewer.html pulls `assets/65.DM11h4-I.css` (videos page).

---

## 3. HIDDEN SURFACE (present in bundles/HTML, not in visible nav)

### 3.1 Full SvelteKit route list — `entry_app_DV6xw9c8.pretty.js:1394-1476`
Layout deps per route: [3]=admin guard, [7]=auth, [8]=blocked, [9]/[10]=dashboard
guards, [11]=paper-class, [12]=public-dashboard.
```
/ [13]                                   /admin [14,[3]]
/admin/allAdmins [15]                    /admin/allAdmins/[adminID] [16]
/admin/courses [17]                      /admin/courses/[courseID] [18]
/admin/courses/[courseID]/[lessonID] [19]/admin/courses/[courseID]/[lessonID]/students [20]
/admin/courses/[courseID]/students [21]  /admin/events [22]
/admin/events/[id] [23]                  /admin/insights [24]
/admin/model-papers [25]                 /admin/new-year-purchases [26]
/admin/new-year-purchases/ticket-check [27]
/admin/paper-class [28,[3,4]]            /admin/paper-class/[slug=paper_class] [29,[3,4]]
/admin/pastPapers [30]                   /admin/pastPapers/[slug] [31]
/admin/payments [32,[3,5]]               /admin/payments/[slug] [33,[3,5]]
/admin/pendingNICs [34]                  /admin/practical-sessions [35]
/admin/profile [36]                      /admin/reviews [37,[3,6]]
/admin/reviews/[slug] [38,[3,6]]         /admin/sms [39]
/admin/students [40]                     /admin/students/[studentID] [41]
/admin/students/[studentID]/model-papers [42]
/admin/students/[studentID]/purchases [43]
/admin/students/[studentID]/tutes [44]
/admin/students/calls [45]               /admin/students/calls/responses [46]
/admin/students/calls/responses/[responsesId] [47]
/admin/tags [48]                         /admin/tickets [49]
/admin/tute-packing [50]                 /admin/tute-packing/packed [51]
/admin/tutes [52]                        /admin/tutes/[tuteId] [53]
/admin/tutes/inventory [54]              /admin/tutes/inventory/[tuteId] [55]
/admin/zoom [56]
/auth/forgot-password [57,[7]]           /auth/login [58,[7]]     /auth/register [59,[7]]
/blocked [60,[8]]
/dashboard/[course] [61]                 /dashboard/all-lessons [62]
/dashboard/documentation [63]            /dashboard/events/[code] [64]
/dashboard/lessons/[lessonID]/videos [65]/dashboard/model-papers [66]
/dashboard/myLessons [67]                /dashboard/ol [68]
/dashboard/paper-class [69,[9,11]]       /dashboard/paper-class/[slug=paper_class] [70]
/dashboard/paper-class/leaderboard [71]  /dashboard/pastPapers [72]
/dashboard/pastPapers/[slug=papers] [73] /dashboard/pdf/[pdf] [74]
/dashboard/practical-sessions [75]       /dashboard/profile [76]
/dashboard/reviews [77]                  /dashboard/rusiri [78]
/dashboard/saga [79]                     /dashboard/tutes [80]
/dashboard/tutes/my-tutes [81]
/public-dashboard [82,[12]]              /public-dashboard/[course] [83]
/public-dashboard/about-us [84]          /public-dashboard/contact-us [85]
/public-dashboard/events/[code] [86]     /public-dashboard/ol [87]
/public-dashboard/our-team [88]          /public-dashboard/papers/[slug=papers] [89]
/public-dashboard/privacy [90]           /public-dashboard/rusiri [91]
/public-dashboard/saga [92]              /public-dashboard/tutes [93]
/public-dashboard/zoom/join-error [94]
/video-gate [95]      ← hidden, no layout, not linked from any nav
```
Not reachable from visible nav (nav builds in nodes_9:1500-1600 +
chunks_BrY_1-xV.pretty.js:54-80 cover only dashboard/admin basics):
`/dashboard/all-lessons` (breadcrumb name exists at BrY:56), `/video-gate`,
`/blocked` (redirect-only), `/dashboard/paper-class/leaderboard`,
`/admin/tute-packing*` (linked via tutes>packing crumbs, BrY:40-42),
`/public-dashboard/events/[code]`, `/public-dashboard/zoom/join-error`.
`/dashboard/rusiri` + `/dashboard/saga` and their public twins exist although
`ENABLE_SAGA/ENABLE_RUSIRI/ENABLE_SAGA_ADMIN/ENABLE_SAGA_QR_SEND` are all
`false` in the flags chunk.

### 3.2 /video-gate (node 95 = old_nodes_82.pretty.js, byte-identical logic)
Hardcoded embed: `const $="131497", ee="353c34cc-db52-4f68-a99f-700295ae9d15"`
→ `https://iframe.mediadelivery.net/embed/131497/353c34cc-db52-4f68-a99f-700295ae9d15?autoplay=true&muted=false&preload=true&playsinline=true&rememberPosition=false&showSpeed=false&showHeatmap=false&loop=false`
(old_nodes_82:97-98,109,173). No API call, **no token** (library 131497 embed
works unsigned). Anti-cheat: `playerjs-latest.min.js` loaded;
`timeupdate` clamps any seek >1.5 s back (`e.setCurrentTime(f)`), auto-routes
`/dashboard/myLessons` on `ended` or within 0.3 s of duration, `contextmenu`
blocked, `scrub-shield` overlay div, controls fade (lines 117-146, 183).
Trigger condition (login, §2.3) is currently disabled by flag.

### 3.3 Non-HTTP-API hosts in the bundles
`metrics.ictfromabc.com` (FPJS ingress + `/web/v<version>/<apiKey>/loader_v<loaderVersion>.js`),
`fpnpmcdn.net` (default FPJS loader pattern, overridden), `assets.mediadelivery.net`
(player-0.1.0.min.js, playerjs-latest.min.js, plyr-plugin-thumbnail.js,
rubik.css), `iframe.mediadelivery.net`, `*.b-cdn.net` pull zones
(`vz-0d705596-3d4`, `vz-842e9805-ddc`; docs example uses `vz-63dcc9a5-af6` /
library 759 — template only, raw/bunny_docs_example.html:755-772),
`www.youtube.com/iframe_api`, `img.youtube.com/vi/{id}/0.jpg` (legacy thumbs),
`lottie.host/embed/04931888-…`, `placehold.co`,
`ictfromabc.com/storage/…` (Laravel files; 301 https→http downgrade —
API_MAP.md §8/§11). Embed HTML (raw/live/embed-619330.html) confirms:
`playlist.m3u8` as `<source type="application/vnd.apple.mpegURL">`,
`thumbnail.jpg` in og:image, seek-thumbnail sprite config
(`pic_num`, 6x6 grid, plyr-plugin-thumbnail.js), title = original mp4 filename
(`video1801365788.mp4`). Bunny embed responses carry wide-open CORS:
`access-control-allow-origin: *`, `allow-credentials: true`,
`cdn-videolibraryid: 131497`, `stream-server: 1223`
(raw/bunny_demo.headers.txt:1-13).

### 3.4 Absent (checked, not found)
No `robots.txt` / `sitemap.xml` / `/health` / `/status` / `/ping` / webhook
strings in any of the 241 current bundle files; no XHR/EventSource/WebSocket/
sendBeacon usage; only the 3 non-wrapper fetches listed in §2.8 +
`_app/version.json`.

---

## 4. DIFF against existing catalogs

Bundle inventory = **202 unique method+path pairs** (201 wrapper calls from
`api_findings_current.json` + the direct `GET /past-papers/{slug}` which that
file lists under `direct`). Note: the file's own headline "201 unique pairs"
is confirmed (its `calls[]` dedupe to 201 pairs; `direct[]` adds the 202nd).

### 4.1 vs `api_findings_current.json`
**Nothing missing.** It is the authoritative extraction; this recon adds only
re-verification against the pretty/raw sets (pretty files cover a subset of the
same build — the hash-named chunks it lacks — 3C00S3wM, B6SKNgqH, BGBlHn-P,
BN2KxrB7, Bso1vT72, BuvdwmeH, CczqVMpR, CdMOgjNl, CdvttfmZ, CgEnrGJP,
Csyafj-i, DEHBxsXW, DQn851FC, DtAuM1Kv, DtUzyJrk, DXhKq_RN, DzAMTzGs, OgaeRCbo,
RB4MXAIS, wkVuIK41 — were verified directly from `js/current/` and match 1:1).

### 4.2 vs `API_MAP_CURRENT.md` (~60 rows) — MISSING list
1. `POST /api/register` (multipart) — chunks/CD97E9Hu.js:37.
2. `GET /api/admins` — public admin cards, chunks/CzfSrzb2.js:32.
3. `GET /api/past-papers/{slug}` — public, no-Bearer direct fetch,
   nodes/73.BbuEYMhF.js + nodes/89.DpthjYV6.js.
4. All **131 `/api/admin/*` pairs** are summarized as "~130 routes" but not
   enumerated — see §1 admin table for the full list (incl. /admin/dashboard,
   /admin/ids/unverified, /admin/insights[/lapsed-export],
   /admin/users/pending-student-calls, /admin/student-calls,
   /admin/call-responses*, /admin/tickets{,/{id},/status},
   /admin/ticket-categories, /admin/purchases/*, /admin/slips/{status},
   /admin/new-year-purchases*, /admin/event-tickets/{code}/check,
   /admin/event-purchases/{id}/resend, /admin/tutes/{csv,package,pdf,transfer},
   /admin/sms/*, /admin/check/{id} blob, /admin/past-papers*,
   /admin/insights/lapsed-export).
5. Minor: `GET /api/pdfs/tute` live-observed call (template /pdfs/{idOrType}
   already covered); `POST /api/admin/zoom/` trailing-slash form.

### 4.3 vs bypass userscript API_MAP (59 rows) — MISSING list
1. `POST /register`.
2. `GET /admins`.
3. `GET /past-papers/{slug}`.
4. All 130 admin pairs except the single `/admin/courses` summary row.
5. Accuracy nits (not missing, wrong): `GET /events` and `GET /telegram` are
   marked `a:true` (bearer) but respond **200 unauthenticated** (live capture
   rows 1, 699 in raw/live/browser-api-requests.txt); `GET /pdfs/{type}` is
   present and correct.

---

## 5. RISKS / SURPRISES

1. **Public past-papers** `GET /api/past-papers/{slug}` needs no Bearer and is
   the only API call in the build that bypasses the auth wrapper (hardcoded
   base, no token) — anonymous full paper index by year.
2. **`GET /admins` and `GET /events`, `GET /telegram` serve unauthenticated** —
   admin roster cards, on-sale events and group links leave the building
   without a token (live 200s logged out).
3. **Fingerprint is client-controlled**: Pro key `rDaS5GdGD0S43aJ8ry6f` +
   `metrics.ictfromabc.com` ingress hardcoded in the bundle; only `visitorId` +
   `confidenceScore` are sent, both freely spoofable at `/login` and
   `/login/otp` (the entire device-lock rests on them).
4. **401 handler wipes only `token` and `role`**; 403 navigates to login but
   keeps the token; `/blocked` onDestroy removes `token` + `user` (a key that
   is never set) — three different teardown semantics across flows.
5. **Pause flag is in-memory only** — reload clears it; the 302 pause body can
   carry a token that the client then treats as a valid session
   (API_MAP_CURRENT.md:47).
6. **`POST /user` is dual-use** (profile update and password change with
   `_method:"PATCH"`), and `POST /admin/admins/{id}` uses the same
   FormData+`_method` spoof — single-endpoint confusion risk.
7. **`POST /api/admin/zoom/` is a trailing-slash literal** — easy to miss when
   fuzzing; Laravel route is registered with the slash.
8. **`GET /admin/tickets${query}` template concatenation** in nodes/49 lacks a
   literal `?` — likely a pagination bug in the admin UI (bundle shows
   `/admin/tickets{param}`).
9. **Video gate is dormant but armed**: hardcoded library 131497 embed with
   anti-scrub clamping, contextmenu kill and scrub-shield; ENABLE_VIDEO_GATE
   flag flips it on per-login for `course_id=="2025-al" && skippable==0`.
10. **Bunny CORS is wide open** (`access-control-allow-origin: *` + allow-
    credentials on the embed host), and the pull zone ignores the
    generate-token entirely (Referer-only gate) — media protection is
    effectively Referer + GUID secrecy (VIDEO_PIPELINE.md §1).
11. **Notification objects carry server-supplied absolute `data.link` hrefs**
    rendered directly as anchors — stored-link injection surface in-app.
12. **`/_app/version.json`** updater and `__sveltekit` cache monkey-patch are
    the only non-/api app endpoints; no health/sitemap/webhook routes exist.
13. Saved `raw/api_*.json` response captures are all
    `{"message":"Unauthenticated."}` — they contribute no response-shape
    evidence; live shapes come from Burp rows documented in
    API_MAP_CURRENT.md.
