# ictfromabc.com - Device-Fingerprint Lock ("Account on Pause") Deep Dive

**Method:** static analysis only of local JS bundles in `D:\Pentesting\ictfromabc\js\` (399 files across `js\`, `js\nodes\`, `js\all\`, `js\current\`, `js\current_login\`, `js\live\`). No live requests were made. Two builds are covered: **old** (`js\nodes\`, `js\all\`, route dict `js\app.js`) and **current** (`js\current\_app\immutable\`, route dict `entry\app.DV6xw9c8.js`).

---

## 1. Login flow

### 1.1 Old build - `/auth/login` = node 51
Route dict `js\app.js:1`: `"/auth/login":[51,[6]]`, `"/blocked":[53,[7]]`.
File `D:\Pentesting\ictfromabc\js\nodes\51.CEQOU_dp.js` is a single-line file (**L1**).

- onMount lazily imports the fingerprint chunk and reads `?phone=`:
```js
Pe(async()=>{
  _=(await Se(()=>import("../chunks/Boci2IdA.js"),[],import.meta.url)).getFingerprint;
  const g=Ce(Ge).url.searchParams.get("phone");
  g&&t(0,l=g), setTimeout(()=>{t(4,e=!0)},3e4)   // forgot-password link after 30 s
});
```
- Submit handler (same line, L1):
```js
async function $(){
  try{ if(a&&i){
      t(5,s=!0);
      const o=await _(),                // getFingerprint()
 b=await Be.login(l,i,o);   // POST /login
      localStorage.setItem("token",b.token),
      localStorage.setItem("role",b.role),
      b.role===qe.STUDENT
        ? (He.ENABLE_VIDEO_GATE&&b.course_id=="2025-al"&&b.skippable==0||Z("/dashboard/myLessons"))
        : Z("/admin/courses")
  }}catch{ t(3,r=!0),... } finally{ t(5,s=!1) }
}
```
- Client-side validation is phone-only: `a = l.length===10 && /^07\d+$/.test(l)` (L1). **No client-side validation of `visitorId`/`confidenceScore`** - any value is forwarded to the API layer.
- Feature gates are client-side: `js\flags.js:1` -> `const E={ENABLE_BAND_PURCHASE:!1,...,ENABLE_VIDEO_GATE:!1,...}` (all false).

### 1.2 Auth API (old) - `js\all\_authapi.js:1` (= `chunks/B7ab6jJc.js`)
```js
login:async(o,a,s)=>{
  const n=s.visitorId, t=s.confidenceScore,
  e=await r("/login",{phoneNumber:o,password:a,visitorId:n,confidenceScore:t},"application/json");
  if(!e.ok)throw new Error("Failed to login");
  return await e.json()
}
```
This is the **only** old-build endpoint carrying `visitorId`/`confidenceScore`. A sweep of `visitorId` across all 399 files hits only: `_authapi.js`, `chunks/B7ab6jJc.js`, the fingerprint libs (`_fp.js`, `uv04NaUW.js`), and the current auth API (`CD97E9Hu.js`).

### 1.3 Current build - `/auth/login` = node 58
Route dict `js\current\_app\immutable\entry\app.DV6xw9c8.js:1`: `"/auth/login":[58,[7]]`, `"/blocked":[60,[8]]`.
File `D:\Pentesting\ictfromabc\js\current\_app\immutable\nodes\58.Pv9o42ea.js` has 2 lines (L1 = `__vite__mapDeps`; logic on **L2**).

- State machine `CREDENTIALS | OTP | AUTHENTICATED`; onMount imports `../chunks/uv04NaUW.js` -> `getFingerprint` (same 30 s timer, same `/^07\d+$/` + length-10 check).
- First step (L2):
```js
const k=await D(), I=await de.login(a,n,k);            // D = getFingerprint
if(I.otp_required){ t(2,s=I), t(8,b="otp"), t(7,c=!1); return }   // -> OTP step
ce(I.token,I.role), I.role===Z.STUDENT ? ...K("/dashboard/myLessons")
                                      : I.role===Z.ADMIN ? K("/admin/courses") : (error flash)
```
- OTP step `E()` (L2) - 6-digit input, then a **fresh** fingerprint:
```js
async function E(){
  if(c||o.length!==6)return; t(7,c=!0);
  const k=await D();
  try{ const I=await de.loginWithOTP(a,n,o,k);
       I&&(I.role===Z.SUPER_ADMIN||I.role===Z.ADMIN) ? (ce(I.token,I.role), K("/admin/courses"))
                                                       : (error flash) }
  finally{ t(7,c=!1) }
}
```
Note: the OTP completion branch only accepts `ADMIN`/`SUPER_ADMIN`; a student completing OTP gets the generic error flash (client/server logic mismatch worth flagging).

### 1.4 Auth API (current) - `js\current\_app\immutable\chunks\CD97E9Hu.js:1`
```js
login:async(o,a,s)=>{ const n=s.visitorId,t=s.confidenceScore,
  e=await r("/login",{phoneNumber:o,password:a,visitorId:n,confidenceScore:t},"application/json"),
  i=await e.json(); if(!e.ok)throw new Error(i.msg||"Failed to verify OTP"); return i },
loginWithOTP:async(o,a,s,n)=>{ const t=n.visitorId,e=n.confidenceScore,
  i=await r("/login/otp",{phoneNumber:o,password:a,otp:s,visitorId:t,confidenceScore:e},"application/json"),
  w=await i.json(); if(!i.ok)throw new Error(w.msg||"Failed to verify OTP"); return w }
```
- Session persistence (current): `js\current\_app\immutable\chunks\CWqXeFnL.js:1`
```js
function d(t,o){ localStorage.setItem("token",t), localStorage.setItem("role",o),
                 e.set({token:t,role:o,isAuthenticated:!0}) }   // exported `s`, imported as `ce` in node 58
```
The store also holds derived flags `{isAuthenticated}`, `role===SUPER_ADMIN`, `role in (ADMIN,SUPER_ADMIN)` and an init function that rehydrates from `localStorage.token`/`localStorage.role`.

### 1.5 Fingerprint acquisition
- Old: `js\all\_fp.js:1` - `var Re="3.12.15"` (loader version), sentinel `k="9319"`:
```js
const Rn=fn.load({apiKey:"rDaS5GdGD0S43aJ8ry6f", region:void 0,
  endpoint:"https://metrics.ictfromabc.com",
  scriptUrlPattern:"https://metrics.ictfromabc.com/web/v<version>/<apiKey>/loader_v<loaderVersion>.js"}),
En=async()=>{ const e=await Rn, t=await(e?.get()), i=t?.visitorId, o=t?.confidence.score;
  return{visitorId:i,confidenceScore:o} };
export{En as getFingerprint};
```
- Current: `js\current\_app\immutable\chunks\uv04NaUW.js:1` - identical config, `nt="3.9.6"`, sentinel `y="9319"`, `st=Rt.load({...})`, `export{dt as getFingerprint}` -> `{visitorId, confidenceScore:e.confidence.score}`.
- Consequence: `confidenceScore` is always present in the login body when FP resolves; if `metrics.ictfromabc.com` is blocked the keys become `undefined` and `JSON.stringify` **omits them** -> server 422 (see 3.1).

---

## 2. Pause mechanism ("Account on Pause")

### 2.1 The flag store - `js\all\_app_immutable_chunks_D4Q2u0Xm.js:1` (current twin: `chunks\CR18yOJo.js`)
```js
import{w as e}from"./C1AHEmgY.js";                 // e = Svelte writable()
const s=e(!1), c=e(!1), t=e(""), r=e(!1),
n=()=>{s.update(()=>!0)}, d=()=>{s.update(()=>!1)}, p=a=>{t.update(()=>a)};
export{s as a, p as b, d as c, n as o, t as s, r as t, c as w};
```
Four stores: `s` = sidenav open, `t` = global search string, `r` = "app init", **`c` exported as `w` = the PAUSE flag**.

**Correction to the earlier report:** ~18 nodes import this shared module, but they import the *sidenav/search* exports (`s as X`, `t`), not the pause flag. A pattern scan of `{w as ...}from".../D4Q2u0Xm.js|.../CR18yOJo.js"` matches **exactly two files**: `js\nodes\53.D8Yrkq-u.js:1` and `js\current\_app\immutable\nodes\60.e0BIi-sy.js:1`. Only the fetch wrapper sets it; only the `/blocked` page reads/resets it.

### 2.2 Who sets it - the fetch wrapper
Old `js\all\_app_immutable_chunks_L4WPQHn8.js:1` (byte-identical logic in current `js\current\_app\immutable\chunks\gH3D-RDX.js:1`):
```js
import{b as p}from"./CPwLOqZt.js";   // p = gate flag, file: const r=!0;export{r as b};  (CPwLOqZt.js:1, hard-coded true)
import{g as h}from"./IW6k_RM6.js";   // h = goto (SvelteKit router; IW6k_RM6.js:1 exports cn as g)
import{w as g}from"./D4Q2u0Xm.js";   // g = PAUSE flag store

class i extends Error{ ... this.status=o ... }
async function w(t){
  if(!t.ok){
    let e="Unknown error occurred";
    try{
      const r=await t.json();
      t.status===302 && (g.set(!0), await h(r.redirect_url)),                 // <-- PAUSE
      (t.status===401||t.status===403) && (p&&t.status===401&&(localStorage.removeItem("token"),localStorage.removeItem("role")), await h("/auth/login")),
      e=r.message||r.msg||r.errors[Object.keys(r.errors)[0]][0]||e
    }catch(r){ console.error(...) }
    throw new i(e,t.status)
  }
}
const y="https://ictfromabc.com/api";
```
Request builder (same file): `Accept: application/json`, optional `Content-Type: application/json`, body `JSON.stringify(r)` (FormData passthrough), `Authorization: Bearer <localStorage.token>` if present, then `fetch(`${y}${path}${query}`, n)` -> `await w(u)` (error classifier) -> return raw `Response`.

**302 handling:** status 302 + JSON body `{redirect_url, ...}` -> set pause flag **in memory only** + client-side `goto(r.redirect_url)`. Because `fetch` uses default `redirect:"follow"`, the fact that the client ever observes status 302 means the server sends **302 without a usable `Location`** (otherwise the browser would follow it and the client would see the final status).

### 2.3 The `/blocked` page
Old: `js\nodes\53.D8Yrkq-u.js` (6 lines). Imports (L1): `import{w as r}from"../chunks/D4Q2u0Xm.js"; import{g as b}from"../chunks/IW6k_RM6.js";` (`r` = pause flag, `b` = goto).
Current: `js\current\_app\immutable\nodes\60.e0BIi-sy.js` (6 lines) - same pattern with `CR18yOJo.js` / `CPkiEbDf.js`.
Lifecycle (both, **L6**):
```js
function w(a,s,e){ let t;
  return m(a,r,o=>e(0,t=o)),                       // subscribe to pause flag (component_subscribe)
         v(()=>{ t||b("/auth/login") }),           // onMount: flag false -> goto /auth/login
         f(()=>{ r.set(!1),
                 localStorage.removeItem("token"),
                 localStorage.removeItem("user") }),// onDestroy: reset flag, drop token+user (NOT role)
         [t] }
```
`v` = `onMount`, `f` = `onDestroy` (BitTBVkN exports `o`=onMount, `a4`=onDestroy - see `IW6k_RM6.js:1` mapping `onMount:ce, onDestroy:he`).

Page copy (L1-L2): **"Account on Pause (Easy Fix!)" / "We noticed sign-ins from more than one device, so we've put a gentle pause on your account to keep it secure. This is easy to sort out. Our staff can unblock your account any time, as many times as you need. For the smoothest experience, please stick to one device at a time going forward."** followed by a Sinhala translation of the same message (L2) and the support link (L2): `<a href="tel:0714555513" ...>Call 071 455 5513</a>`.

**Important:** the pause flag lives in JS memory (Svelte store). It is not persisted; a page reload resets it to `false` until the next API call returns 302 again. The `/blocked` page is also self-guarding (`onMount` bounces to login if the flag is off).

---

## 3. Server-side validation points (inferred from client evidence)

### 3.1 `POST /api/login` field validation (422)
Recorded response bodies `D:\Pentesting\ictfromabc\login_bad.json` and `D:\Pentesting\ictfromabc\login_retest.json` (identical):
```json
{"message":"Phone number is required (and 3 more errors)","errors":{
 "phoneNumber":["Phone number is required"],
 "password":["Password is required"],
 "visitorId":["Check Your Browser. If Nothing works contact Support Staff"],
 "confidenceScore":["Check Your Browser. If Nothing works contact Support Staff"]}}
```
So the server (Laravel-style validator) **requires `visitorId` and `confidenceScore`** and attaches a custom anti-bot message to both - i.e. these two fields are validated server-side, not merely logged. `js\nodes\51.CEQOU_dp.js:1` never checks them client-side, so this is the first enforcement point.

### 3.2 Device comparison -> HTTP 302 (the lock)
The wrapper only reacts to 302 by setting the pause flag and navigating to `r.redirect_url` (default `/blocked`) - `js\all\_app_immutable_chunks_L4WPQHn8.js:1`. This implies: when credentials are correct **but the submitted `visitorId` does not match the device(s) previously bound to the account**, the API answers `302 {redirect_url, message...}` instead of `{token, role}`. Correct device + correct credentials -> 200 `{token, role}` (handled in node 51/58). Evidence chain: same credentials succeed on the enrolled device and yield 302 -> `/blocked` from a different device (per prior report `DEVICELOCK_ictfromabc_2026-09-11.md`).

### 3.3 Session invalidation -> 401/403
`(401||403)` -> if 401 (and gate `p`, hard-coded `true` in `CPwLOqZt.js:1`) remove `token`+`role`, then `goto("/auth/login")`; 403 just bounces to login (token kept). Message extraction: `r.message || r.msg || r.errors[firstKey][0]`.

### 3.4 Endpoints the server must validate (client-confirmed inventory)
- `/login`, `/login/otp` - **only** endpoints receiving `visitorId` + `confidenceScore` (grep across all 399 files: `visitorId` occurs solely in `_authapi.js`, `B7ab6jJc.js`, `CD97E9Hu.js`, `_fp.js`, `uv04NaUW.js`).
- All other API calls are token-only: `GET/POST/PUT/PATCH/DELETE https://ictfromabc.com/api/*` with `Authorization: Bearer <token>` and **no fingerprint material at all**.
- Admin read APIs: `js\current\_app\immutable\chunks\OgaeRCbo.js:1` -> `GET /admin/users/search/{q}`, `GET /admin/users/blocked`, `GET /admin/users/unverified-nic`, `GET /admin/users/unverified-email`, `GET /admin/admins/{id}`.
- **Negative sweep:** no `/api/device*`, `/fingerprint`, `/unlock`, `/unblock`, `/unpause`, `/reset`, `/session*`, `/trust` or similar route exists in any bundle (regex over string literals: no matches). Unlocking is **not** offered through the web client - only by staff (phone call).

### 3.5 Server-known per-user data shown in the admin UI
`js\nodes\34.D0pZm0ml.js:1` (= `js\current\...\nodes\41.UQXjw9da.js`) renders a login-records table with `visitor_id`, `confidence_score`, `logged_on` (and a "No login records found." empty state, plus a `blocked` field elsewhere in the same node). This confirms the backend persists **one or more `visitor_id`s per user with confidence and timestamp**, and a `blocked` flag - the data the 302 decision is made against.

---

## 4. Token mechanics

- **Storage:** `localStorage` keys `token`, `role` (written in `js\nodes\51.CEQOU_dp.js:1` via `setItem`, and in `CWqXeFnL.js:1` via `d(token,role)`); the auth store shape is `{token, role, isAuthenticated}` (old twin `sIZO2TiX`-style store; current `js\current\_app\immutable\chunks\CWqXeFnL.js:1`). `/blocked` onDestroy also removes `user` (`nodes\53...:6`, `nodes\60...:6`) - `user` is written elsewhere, not by node 51.
- **Attachment:** every wrapper call reads `localStorage.getItem("token")` and, if present, sets `Authorization: Bearer <token>` (`L4WPQHn8.js:1`, `gH3D-RDX.js:1`). **No request ever attaches `visitorId`, `confidenceScore`, or any device data alongside the token.**
- **FingerprintJS also persists its own state:** `${apiKey}_t` visitorToken in localStorage (agent internals in `_fp.js:1` / `uv04NaUW.js:1`); it is never sent to ictfromabc's API by app code.
- **Logout:** `POST /logout` with `{}` JSON (`_authapi.js:1`); client then clears stores. 401 clears `token`+`role` only.
- **Rehydration:** on app boot the auth store re-reads `token`/`role` from localStorage (`CWqXeFnL.js:1` `u()` / old `i()`), so a surviving `role` key restores UI state even after `/blocked` wiped `token`.
- **Pause does not kill the session server-side (client evidence):** the 302 branch does not call `/logout` or clear the token - only the `/blocked` page's `onDestroy` clears it client-side. Nothing in the bundles shows a server-side token revocation on pause.

---

## 5. Privacy-policy wording (as shipped in the app)

`js\nodes\78.Bqz51-pr.js:4` (8-line file; byte-identical text in current `js\current\_app\immutable\nodes\90.ZOPcW29x.js:4`), section header "Device Identification and App Stores":

> "We do not use third-party services to identify or track you across other applications. Within our mobile apps, we rely securely on standard, operating system-provided device identifiers. **For users accessing our website, we use FingerprintJS locally to identify if you are returning from the same device to help maintain security.** The platforms hosting our App (Apple App Store and Google Play Store) and necessary infrastructure providers may still collect standard diagnostic data as governed by their respective privacy policies."

Mismatch worth noting: the text says "locally", but the agent is loaded from `https://metrics.ictfromabc.com/web/v<version>/<apiKey>/loader_v<loaderVersion>.js` with `endpoint:"https://metrics.ictfromabc.com"` (`_fp.js:1`, `uv04NaUW.js:1`) - i.e. FingerprintJS Pro **cloud API key `rDaS5GdGD0S43aJ8ry6f`**, so identification signals leave the browser and are stored server-side per account (see `visitor_id` in the admin UI). The policy also never mentions multi-device pause, staff unblocking, or retention of login records.

---

## 6. Bypass vectors

Ordered roughly by practical impact. All are derived from static evidence above; none were tested live.

1. **Replay a trusted `visitorId` (spoof the enrolled device).** `visitorId` is an unauthenticated, unsigned string inside the `/login` JSON body (`_authapi.js:1`, `CD97E9Hu.js:1`). Capture it once (devtools on the enrolled device, proxy, XSS, or malware) and POST it from any machine with the victim's credentials. There is no signature, nonce, IP binding, or proof-of-possession - the server only compares stored ids. `confidenceScore` is likewise attacker-chosen (`e.confidence.score` is just a number the client reports).

2. **No device binding after login.** Every token-authenticated request carries only `Authorization: Bearer` (`L4WPQHn8.js:1`). A token stolen from the enrolled device works verbatim anywhere; the lock only gates the *login* exchange. Session hijack bypasses the entire feature.

3. **The pause is client-enforced presentation.** The 302 branch does `g.set(!0); goto(r.redirect_url)` in the SPA (`L4WPQHn8.js:1`). Anyone using curl/Postman simply reads `{redirect_url, message}` and continues - the flag, `/blocked` page, and `goto` are UX, not enforcement. The only real enforcement is the server *withholding* `{token, role}` on mismatch.

4. **Pause flag is volatile memory + easy to clear.** It is a non-persisted Svelte store (`D4Q2u0Xm.js:1`); reload resets it. `nodes\53...:6` / `nodes\60...:6` even reset it (`r.set(!1)`) when the user navigates away from `/blocked`. Deleting the flag / never visiting `/blocked` leaves `token` in localStorage untouched (server-side revocation is not evidenced anywhere in the bundles).

5. **`role` survives the "wipe".** `/blocked` onDestroy removes only `token` and `user`, **not `role`** (`nodes\53...:6`, `nodes\60...:6`), while the 401 branch removes `token`+`role` (`L4WPQHn8.js:1`). The surviving `role` rehydrates the auth store on next boot (`CWqXeFnL.js:1`) and reveals account type + admin/feature gating (UI-level info leak / role confusion).

6. **No client validation of `visitorId`.** `js\nodes\51.CEQOU_dp.js:1` and node 58 validate only `/^07\d+$/` length-10 phone. Any string (dummy, empty-but-present, old capture) is accepted by the client and evaluated only server-side - enabling cheap oracle probing: **422** ("Check Your Browser...") = field missing/invalid; **302** = credentials OK but device mismatch; **200** = success. That 3-way oracle confirms valid credentials independently of the device check.

7. **Missing fingerprint vs mismatched fingerprint behave differently.** Blocking `metrics.ictfromabc.com` yields `undefined` values -> keys dropped by `JSON.stringify` -> 422 (account *not* paused). So the lock only triggers when a *real-looking* but non-enrolled id is submitted; an attacker who suppresses FP gets a clean failure without burning the pause state.

8. **OTP path (`/login/otp`) re-sends fingerprint but adds no binding.** `CD97E9Hu.js:1` posts `{phoneNumber,password,otp,visitorId,confidenceScore}`; the 6-digit OTP and 120 s countdown are client-side only (`nodes\58...:2`) - brute force depends entirely on server rate limits (not visible in bundles). Also, the completion branch only accepts ADMIN/SUPER_ADMIN roles; students who reach OTP end in an error flash (logic bug).

9. **Admin/unblock surface.** No self-service unlock exists (grep: no `/unlock|/unblock|/device|/reset|/session` routes) - by design you must call 071 455 5513. But `GET /admin/users/blocked` + admin role UI (`OgaeRCbo.js:1`, `nodes\34...:1` showing `visitor_id`, `confidence_score`, `logged_on`, `blocked`) means **any stolen admin token fully controls unblocking and sees every enrolled fingerprint** - the admin panel is the highest-value bypass target. Client-side role checks (`role===ADMIN` redirects) are cosmetic; the server must re-check.

10. **Fingerprint provider surface.** Agent served from `metrics.ictfromabc.com` with public key `rDaS5GdGD0S43aJ8ry6f` (`_fp.js:1`); the agent even has `Not available for this origin` origin-locking machinery, but that protects *agent loading*, not the API - replaying a captured `visitorId` needs no agent at all. Conversely, FP's `visitorToken` (`${apiKey}_t`) persists in localStorage and is a stable device handle on disk.

11. **Race/TOCTOU:** fingerprint is fetched fresh at each submit (`await _()` / `await D()`), so two near-simultaneous logins from different devices each present valid, distinct ids; whichever the server enrolls last wins, and the loser is paused - an attacker with credentials can intentionally churn devices to lock the victim out (denial-of-service via the pause feature itself).

12. **Client-only gates elsewhere:** `js\flags.js:1` (all `ENABLE_*` false) and the STUDENT redirect logic in node 51/58 are UI-only decisions; manipulating them changes navigation, not authorization.

---

## Appendix - key file inventory (absolute paths)

| Purpose | File | Line(s) |
|---|---|---|
| Old login page (fingerprint + token/role store) | `D:\Pentesting\ictfromabc\js\nodes\51.CEQOU_dp.js` | L1 |
| Old auth API (login body) | `D:\Pentesting\ictfromabc\js\all\_authapi.js` (= `chunks\B7ab6jJc.js`) | L1 |
| Fetch wrapper, 302/401/403 handling (old) | `D:\Pentesting\ictfromabc\js\all\_app_immutable_chunks_L4WPQHn8.js` | L1 |
| Fetch wrapper (current) | `D:\Pentesting\ictfromabc\js\current\_app\immutable\chunks\gH3D-RDX.js` | L1 |
| Pause flag store (old) / current twin | `D:\Pentesting\ictfromabc\js\all\_app_immutable_chunks_D4Q2u0Xm.js` / `...\chunks\CR18yOJo.js` | L1 |
| 401 gate `const r=!0` | `D:\Pentesting\ictfromabc\js\all\_app_immutable_chunks_CPwLOqZt.js` | L1 |
| `/blocked` page (old / current) | `D:\Pentesting\ictfromabc\js\nodes\53.D8Yrkq-u.js` / `D:\Pentesting\ictfromabc\js\current\_app\immutable\nodes\60.e0BIi-sy.js` | L1, L2, L6 |
| Route dicts | `D:\Pentesting\ictfromabc\js\app.js` / `D:\Pentesting\ictfromabc\js\current\_app\immutable\entry\app.DV6xw9c8.js` | L1 |
| Fingerprint loader (old / current) | `D:\Pentesting\ictfromabc\js\all\_fp.js` / `D:\Pentesting\ictfromabc\js\current\_app\immutable\chunks\uv04NaUW.js` | L1 |
| Current login + OTP node | `D:\Pentesting\ictfromabc\js\current\_app\immutable\nodes\58.Pv9o42ea.js` | L2 |
| Current auth API (`/login`, `/login/otp`) | `D:\Pentesting\ictfromabc\js\current\_app\immutable\chunks\CD97E9Hu.js` | L1 |
| Auth store (current) | `D:\Pentesting\ictfromabc\js\current\_app\immutable\chunks\CWqXeFnL.js` | L1 |
| Privacy policy node (old / current) | `D:\Pentesting\ictfromabc\js\nodes\78.Bqz51-pr.js` / `D:\Pentesting\ictfromabc\js\current\_app\immutable\nodes\90.ZOPcW29x.js` | L4 |
| Admin login-records UI (`visitor_id`...) | `D:\Pentesting\ictfromabc\js\nodes\34.D0pZm0ml.js` | L1 |
| Admin user APIs | `D:\Pentesting\ictfromabc\js\current\_app\immutable\chunks\OgaeRCbo.js` | L1 |
| Client feature flags | `D:\Pentesting\ictfromabc\js\flags.js` | L1 |
| Recorded 422 bodies | `D:\Pentesting\ictfromabc\login_bad.json`, `D:\Pentesting\ictfromabc\login_retest.json` | - |
| Prior findings | `D:\Pentesting\ictfromabc\DEVICELOCK_ictfromabc_2026-09-11.md` | - |
