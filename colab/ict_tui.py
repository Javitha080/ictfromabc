#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ICTfromABC — Google Colab TUI (v1.1.0)

Drives ictfromabc.com from a Google Colab notebook:
  - login with the account-bound FingerprintJS identity (visitorId + confidenceScore),
    so any device / any network (incl. Colab datacenter IPs) logs in as the bound device
  - browse Dashboard + Lessons through the JSON API (Bearer token)
  - fast video/PDF downloading (Bunny Stream HLS via ffmpeg, mp4 via aria2/requests, YouTube via yt-dlp)
  - save to Google Drive
  - backup-upload to a Telegram group (kurigram userbot = 2 GB files, bot-API fallback = 50 MB)
  - API quick calls (menu 10): /user /courses /lessons/allowed /notifications /telegram,
    model-papers + practical-sessions availability, /pdfs listings, RBAC role-gate check
  - PDF browser (menu 11): /pdfs/{type} listings + /pdfs/{id} delivery download
  - robust session handling: 429 honors Retry-After / exponential backoff (max 3 tries),
    401 -> one bound-fingerprint auto re-login, 302-pause classified, optional keepalive

Quickstart (in Colab):
    CONFIG = {...}                      # cell 3 - edit once
    tui = TUI()                         # cell 5
    tui.run()                           # numbered menus in the cell output

One-time data you must capture from a device that already logs in fine (see README):
    visitor_id, confidence  ->  F12 > Network > POST /api/login payload
    tg_api_id, tg_api_hash  ->  https://my.telegram.org  (API development tools)
"""

import datetime
import getpass
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import threading
import time
from urllib.parse import quote, urljoin, urlparse

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

__version__ = "1.1.0"

API_BASE = "https://ictfromabc.com/api"
SITE_ORIGIN = "https://www.ictfromabc.com"
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")

CONFIG_PATH = "/content/ict_tui_config.json"
DL_ROOT = "/content/ict_downloads"
DRIVE_ROOT_DEFAULT = "/content/drive/MyDrive/ICT"

DEFAULT_CONFIG = {
    # ---- site account (the bypass: bound fingerprint on every login) ----
    "phone": "",
    "password": "",
    "visitor_id": "",          # visitorId from a working login (F12 > Network > POST /api/login)
    "confidence": 0.995,       # confidenceScore from the same payload
    "manual_token": "",        # optional: paste a Bearer token (e.g. from the browser suite backup)
    # ---- telegram backup ----
    "tg_api_id": 0,            # from my.telegram.org
    "tg_api_hash": "",
    "tg_session_string": "",   # saved automatically after first userbot login
    "tg_group": "",            # group id (-100...) or @username of the backup group
    "tg_bot_token": "",        # optional bot fallback (< 50 MB files only)
    # ---- behaviour ----
    "drive_enabled": False,    # mount + save into Google Drive
    "drive_root": DRIVE_ROOT_DEFAULT,
    "auto_drive": True,        # after each download, copy to Drive
    "auto_telegram": True,     # after each download, upload to the TG group
    "delete_after_upload": False,
    "prefer_quality": "best",  # best | 1080 | 720 | 480 | 360
    "tg_as_document": True,    # True = raw file (backup-safe), False = streamable video
    "keepalive": False,        # optional: ping /user every keepalive_interval s (menu 1 > 6 / Settings 15)
    "keepalive_interval": 600, # keepalive period in seconds
}

# 429 handling in ICTApi.request: honor Retry-After, else exponential backoff, max 3 tries.
_429_MAX_TRIES = 3
_429_BACKOFF_BASE = 2.0       # seconds -> waits 2s, 4s across the retries

FFMPEG = shutil.which("ffmpeg")
FFPROBE = shutil.which("ffprobe")
ARIA2 = shutil.which("aria2c")
YTDLP = shutil.which("yt-dlp") or shutil.which("yt-dlp")

# ============================================================================
# small ANSI UI helpers (Colab renders ANSI in output cells)
# ============================================================================

def _c(s, code):
    return "\033[%sm%s\033[0m" % (code, s)

def bold(s):    return _c(s, "1")
def dim(s):     return _c(s, "2")
def red(s):     return _c(s, "91")
def green(s):   return _c(s, "92")
def yellow(s):  return _c(s, "93")
def blue(s):    return _c(s, "94")
def magenta(s): return _c(s, "95")
def cyan(s):    return _c(s, "96")

def banner():
    print(cyan("=" * 64))
    print(cyan("  ICTfromABC Colab TUI") + dim("  v%s" % __version__))
    print(cyan("=" * 64))

def head(title):
    print()
    print(bold(cyan("== " + title + " " + "=" * max(0, 58 - len(title)))))

def ok(msg):    print("  " + green("[OK] ") + str(msg))
def warn(msg):  print("  " + yellow("[!] ") + str(msg))
def err(msg):   print("  " + red("[X] ") + str(msg))
def note(msg):  print("  " + dim(str(msg)))

def ask(prompt, default="", secret=False, required=False):
    while True:
        suffix = dim((" [%s]" % default) if default else "")
        if secret:
            v = getpass.getpass("  " + prompt + suffix + ": ")
        else:
            v = input("  " + prompt + suffix + ": ").strip()
        if v:
            return v
        if default:
            return default
        if not required:
            return ""
        print(red("    value required"))

def ask_int(prompt, default=0):
    raw = ask(prompt, str(default) if default else "")
    try:
        return int(raw)
    except (TypeError, ValueError):
        return default

def confirm(prompt, default_yes=False):
    d = "Y/n" if default_yes else "y/N"
    v = ask(prompt + " (" + d + ")", "")
    return (v or ("y" if default_yes else "n")).lower().startswith("y")

def fsize(n):
    n = float(n or 0)
    for unit in ("B", "KB", "MB", "GB", "TB"):
        if n < 1024 or unit == "TB":
            return ("%.1f %s" % (n, unit)) if unit != "B" else ("%d B" % n)
        n /= 1024.0
    return "%.1f TB" % n

def sanitize_filename(s, maxlen=150):
    s = re.sub(r'[\\/:*?"<>|]+', "_", str(s or "file"))
    s = re.sub(r"\s+", " ", s).strip(" .")
    return s[:maxlen] or "file"

def progress_bar(pct, width=28):
    pct = max(0.0, min(100.0, pct))
    fill = int(width * pct / 100.0)
    return cyan("[" + "#" * fill + dim("·" * (width - fill)) + "] %5.1f%%" % pct)

# ============================================================================
# config
# ============================================================================

def load_config():
    cfg = dict(DEFAULT_CONFIG)
    if os.path.exists(CONFIG_PATH):
        try:
            with open(CONFIG_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
            for k in DEFAULT_CONFIG:
                if k in data and data[k] not in (None, ""):
                    cfg[k] = data[k]
        except Exception as e:
            warn("config load failed (%s) - using defaults" % e)
    return cfg

def save_config(cfg):
    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(cfg, f, indent=2)
    try:
        os.chmod(CONFIG_PATH, 0o600)
    except OSError:
        pass  # Windows/FAT has no chmod semantics
    note("config saved -> " + CONFIG_PATH)

def config_missing(cfg):
    need = []
    if not (cfg["manual_token"] or (cfg["phone"] and cfg["password"])):
        need.append("login credentials (phone+password) or manual_token")
    if not cfg["visitor_id"]:
        need.append("visitor_id (+confidence) captured from a working login")
    return need

# ============================================================================
# API client (login bypass + endpoint map)
# ============================================================================

class ApiError(Exception):
    def __init__(self, status, body, data=None):
        super().__init__("HTTP %s" % status)
        self.status = status
        self.body = body or ""
        self.data = data

class LoginError(ApiError):
    """kind: credentials | device-check | paused | network | otp"""
    def __init__(self, kind, status=0, body="", data=None):
        super().__init__(status, body, data)
        self.kind = kind

def ensure_list(x):
    """Normalize the API's response shapes:
    list | {"data":[...]} | {"lessons":[...]} | grouped {"al":[...],"ol":[...]} | single dict"""
    if isinstance(x, list):
        return x
    if isinstance(x, dict):
        for key in ("data", "lessons", "videos", "items", "results", "tutes", "courses"):
            v = x.get(key)
            if isinstance(v, list):
                return v
            if isinstance(v, dict):
                return [v]
        vals = list(x.values())
        if vals and all(isinstance(v, list) for v in vals):
            out = []
            for lst in vals:
                out.extend(lst)
            return out  # /courses -> {"al": [...], "ol": [...]}
        return [x]
    return []

def _retry_after_secs(r):
    """Retry-After header -> seconds (delta-seconds or HTTP-date), else None. Clamped to 120 s."""
    v = r.headers.get("Retry-After") if r is not None else None
    if not v:
        return None
    v = str(v).strip()
    if re.fullmatch(r"\d+", v):
        return min(float(v), 120.0)
    try:
        dt = datetime.datetime.strptime(v, "%a, %d %b %Y %H:%M:%S %Z").replace(
            tzinfo=datetime.timezone.utc)
        wait = (dt - datetime.datetime.now(datetime.timezone.utc)).total_seconds()
        return max(0.0, min(wait, 120.0))
    except (ValueError, TypeError):
        return None


class ICTApi:
    def __init__(self, cfg):
        self.cfg = cfg
        self.token = cfg.get("manual_token") or ""
        self.role = ""
        self.course_id = ""
        self.user = None
        self._fp_cache = {}           # video_id -> {token, expires}
        self._auto_logins = 0
        self.session = requests.Session()
        # NOTE: 429 is handled explicitly in request() (Retry-After / backoff);
        # only transport-ish 5xx go through the urllib3 adapter retry.
        retry = Retry(total=3, backoff_factor=0.4,
                      status_forcelist=(500, 502, 503, 504),
                      allowed_methods=frozenset(["GET", "HEAD"]))
        self.session.mount("https://", HTTPAdapter(max_retries=retry, pool_maxsize=32))
        self.session.headers.update({
            "User-Agent": UA,
            "Accept": "application/json",
            "Origin": SITE_ORIGIN,
            "Referer": SITE_ORIGIN + "/",
        })
        if self.token:
            self.session.headers["Authorization"] = "Bearer " + self.token

    # -------------------------------------------------- low level
    def request(self, method, path, body=None, form=None, raw=None,
                auth=True, allow_redirects=False, timeout=(15, 60)):
        """auth=False sends WITHOUT the Authorization header (login must not carry one).
        429 -> honor Retry-After, else exponential backoff, max 3 tries total
        (never auto-retries 401/422 - those raise immediately)."""
        url = path if path.startswith("http") else API_BASE + (path if path.startswith("/") else "/" + path)
        headers = {}
        if body is not None or isinstance(raw, str):
            headers["Content-Type"] = "application/json"
        saved = self.session.headers.pop("Authorization", None)
        if auth and saved:
            self.session.headers["Authorization"] = saved
        try:
            for attempt in range(_429_MAX_TRIES):
                r = self.session.request(method, url, json=body, data=raw or form,
                                         headers=headers, auth=None,
                                         allow_redirects=allow_redirects, timeout=timeout)
                if r.status_code != 429 or attempt >= _429_MAX_TRIES - 1:
                    break
                wait = _retry_after_secs(r)
                if wait is None:
                    wait = _429_BACKOFF_BASE * (2 ** attempt)   # 2s, 4s
                if wait > 0:
                    warn("429 rate-limited - waiting %.0fs before retry %d/%d"
                         % (wait, attempt + 1, _429_MAX_TRIES - 1))
                    time.sleep(wait)
        finally:
            if not auth and saved:
                self.session.headers["Authorization"] = saved
        if r.status_code == 401:
            raise ApiError(401, r.text)
        return r

    def parse(self, r):
        try:
            return r.json()
        except ValueError:
            return r.text

    def call(self, method, path, body=None, form=None, raw=None, auth=True):
        r = self.request(method, path, body=body, form=form, raw=raw, auth=auth)
        data = self.parse(r)
        if r.status_code >= 400:
            raise ApiError(r.status_code, r.text, data if isinstance(data, (dict, list)) else None)
        return data

    def get(self, path):
        return self.call("GET", path)

    # -------------------------------------------------- login (the bypass)
    def login(self, phone=None, password=None, visitor_id=None, confidence=None, quiet=False):
        phone = phone or self.cfg["phone"]
        password = password or self.cfg["password"]
        visitor_id = visitor_id or self.cfg["visitor_id"]
        confidence = float(confidence if confidence is not None else self.cfg["confidence"] or 0.995)
        if not phone or not password:
            raise LoginError("credentials", body="phone/password missing from config")
        payload = {"phoneNumber": phone, "password": password,
                   "visitorId": visitor_id, "confidenceScore": confidence}
        if not quiet:
            note("POST /api/login  (visitorId %s / %.3f)"
                 % ((visitor_id or "")[:8] + "..." if visitor_id else "<device-own>", confidence))
        try:
            r = self.request("POST", "/login", raw=json.dumps(payload),
                             auth=False, allow_redirects=False, timeout=(15, 30))
        except requests.RequestException as e:
            raise LoginError("network", body=str(e))
        except ApiError as e:
            raise LoginError("credentials" if e.status in (400, 401) else "unknown",
                             e.status, e.body)
        # 302 = "Account on Pause" redirect; the body MAY still carry a token
        # (client bug we exploit) - same conversion the browser suite does.
        if r.status_code in (301, 302, 303, 307, 308):
            try:
                j = r.json()
            except ValueError:
                j = {}
            if isinstance(j, dict) and j.get("token"):
                if not quiet:
                    ok("pause redirect 302 carried a token -> converted to a live session")
                self._accept_login(j)
                return j
            raise LoginError("paused", r.status_code, json.dumps(j), j)
        data = self.parse(r)
        if r.status_code == 200 and isinstance(data, dict) and data.get("token"):
            self._accept_login(data)
            if not quiet:
                ok("login successful (role %s)" % data.get("role", "?"))
            return data
        if r.status_code == 422:
            raise LoginError("device-check", 422, r.text if isinstance(r.text, str) else json.dumps(data), data)
        if r.status_code in (400, 401):
            raise LoginError("credentials", r.status_code, r.text if isinstance(r.text, str) else json.dumps(data), data)
        raise LoginError("unknown", r.status_code,
                         r.text[:400] if isinstance(r.text, str) else json.dumps(data), data)

    def _accept_login(self, data):
        self.token = data["token"]
        self.role = data.get("role", "")
        self.course_id = data.get("course_id", "")
        self.session.headers["Authorization"] = "Bearer " + self.token
        self._auto_logins = 0
        self.cfg["manual_token"] = self.token
        save_config(self.cfg)

    def ensure_login(self):
        if self.token:
            return
        need = config_missing(self.cfg)
        if need:
            raise LoginError("credentials", body="; ".join(need))
        self.login()

    def auto_relogin(self):
        if self._auto_logins >= 2 or not (self.cfg["phone"] and self.cfg["password"]):
            return False
        try:
            self._auto_logins += 1
            self.login(quiet=True)
            ok("session restored automatically (bound fingerprint login)")
            return True
        except LoginError as e:
            err("auto re-login failed (%s) - not retrying again this session" % e.kind)
            return False

    # -------------------------------------------------- endpoint map
    def me(self):
        data = ensure_list(self.get("/user"))
        self.user = data[0] if data else {}
        return self.user

    def notifications(self):
        return ensure_list(self.get("/notifications"))

    def courses(self):
        return ensure_list(self.get("/courses"))

    def course_lessons(self, cid):
        return ensure_list(self.get("/courses/%s" % quote(str(cid))))

    def my_lessons(self):
        return ensure_list(self.get("/lessons/allowed"))

    def all_lessons(self):
        return ensure_list(self.get("/lessons"))

    def my_tutes(self):
        return ensure_list(self.get("/purchases/tutes"))

    def lesson_videos(self, lesson_id):
        return ensure_list(self.get("/lessons/%s" % quote(str(lesson_id))))

    def video_token(self, video_id):
        vid = str(video_id)
        tok = self._fp_cache.get(vid)
        if tok and tok.get("expires", 0) > time.time() + 300:
            return tok
        j = self.get("/videos/%s/generate-token" % quote(vid))
        if isinstance(j, dict) and j.get("token"):
            self._fp_cache[vid] = {"token": j["token"], "expires": j.get("expires", 0)}
            return self._fp_cache[vid]
        raise ApiError(500, "generate-token gave no token: %s" % json.dumps(j)[:200])

    def video_signed_url(self, video_id):
        """GET /videos/{id} -> video_url, then ?token=&expires= (site does the same)."""
        vid = str(video_id)
        j = self.get("/videos/%s" % quote(vid))
        if not isinstance(j, dict) or not j.get("video_url"):
            raise ApiError(404, "no video_url for video %s: %s" % (vid, json.dumps(j)[:200]))
        return sign_url(j["video_url"], self.video_token(vid))

    def console(self, method, path, body_text=""):
        body = None
        if body_text.strip() and method not in ("GET", "HEAD", "DELETE"):
            body = json.loads(body_text)
        r = self.request(method, path, body=body, allow_redirects=False)
        data = self.parse(r)
        return r.status_code, data

# ============================================================================
# Bunny Stream URL handling + stream resolution
# ============================================================================

def sign_url(video_url, tok):
    sep = "&" if "?" in video_url else "?"
    return "%s%stoken=%s&expires=%s" % (video_url, sep, tok["token"], tok["expires"])

def is_youtube(u):
    return "youtube.com" in u or "youtu.be" in u

def bunny_direct_candidates(video_url, token, expires):
    """If video_url is an embed (iframe.mediadelivery.net/embed/{lib}/{vid}),
    derive direct-CDN playlist candidates. Bunny signed direct format:
        https://video-{lib}.mediadelivery.net/{vid}/{token}/master.m3u8
    """
    m = re.search(r"mediadelivery\.net/(?:embed|player)/([0-9]+)/([0-9a-f-]{20,})", video_url, re.I)
    if not m:
        return []
    lib, vid = m.group(1), m.group(2)
    host = "https://video-%s.mediadelivery.net" % lib
    cands = []
    for name in ("master.m3u8", "playlist.m3u8"):
        cands.append("%s/%s/%s/%s" % (host, vid, token, name))
        cands.append("%s/%s/%s?token=%s&expires=%s" % (host, vid, token, token, expires))
    return cands

def http_text(url, headers=None, timeout=(15, 45)):
    h = {"User-Agent": UA, "Referer": SITE_ORIGIN + "/"}
    if headers:
        h.update(headers)
    r = requests.get(url, headers=h, timeout=timeout, allow_redirects=True)
    return r.status_code, r.text, r.headers.get("content-type", ""), r.url

def parse_m3u8(text, base_url):
    """Return dict: master(media playlist) with variants / parts / duration / encryption."""
    lines = [l.strip() for l in text.splitlines()]
    if not any(l.startswith("#EXTM3U") for l in lines[:2]):
        return None
    variants = []
    i = 0
    while i < len(lines):
        l = lines[i]
        if l.startswith("#EXT-X-STREAM-INF"):
            res = re.search(r"RESOLUTION=(\d+)x(\d+)", l)
            bw = re.search(r"BANDWIDTH=(\d+)", l)
            name = re.search(r'NAME="?([^",]+)"?', l)
            codecs = re.search(r'CODECS="?([^",]+)"?', l)
            url = ""
            for k in range(i + 1, len(lines)):
                if lines[k] and not lines[k].startswith("#"):
                    url = urljoin(base_url, lines[k])
                    i = k
                    break
            variants.append({
                "url": url,
                "height": int(res.group(2)) if res else 0,
                "width": int(res.group(1)) if res else 0,
                "bandwidth": int(bw.group(1)) if bw else 0,
                "name": name.group(1) if name else "",
                "codecs": codecs.group(1) if codecs else "",
            })
        i += 1
    duration = 0.0
    for l in lines:
        if l.startswith("#EXTINF"):
            try:
                duration += float(re.search(r"#EXTINF:([\d.]+)", l).group(1))
            except (AttributeError, ValueError):
                pass
    encrypted = bool(re.search(r"#EXT-X-KEY:METHOD=(?!NONE)", text))
    drm = bool(re.search(r"#EXT-X-KEY:METHOD=(SAMPLE-AES|FAIRPLAY)", text)) or \
          bool(re.search(r"#EXT-X-(?:SESSION-)?KEY:.*URIS=", text))
    kind = "master" if variants else "media"
    return {"kind": kind, "variants": variants, "duration": duration,
            "encrypted": encrypted, "drm": drm, "url": base_url}

def resolve_stream(signed_url, api=None):
    """signed_url -> {kind, url, variants, duration, encrypted, drm}
    Order: 1) fetch the URL itself  2) if embed page HTML, regex playlist out
           3) bunny direct candidates (token-in-path)"""
    if is_youtube(signed_url):
        return {"kind": "youtube", "url": signed_url, "variants": [], "duration": 0.0,
                "encrypted": False, "drm": False}
    st, body, ctype, final = http_text(signed_url)
    if st == 200:
        if "#EXTM3U" in body[:4096]:
            p = parse_m3u8(body, str(final))
            if p:
                return {"kind": "hls", "url": str(final), "variants": p["variants"],
                        "duration": p["duration"], "encrypted": p["encrypted"], "drm": p["drm"]}
        ct = (ctype or "").lower()
        if "mpegurl" in ct or "mp2t" in ct:
            p = parse_m3u8(body, str(final))
            if p:
                return {"kind": "hls", "url": str(final), "variants": p["variants"],
                        "duration": p["duration"], "encrypted": p["encrypted"], "drm": p["drm"]}
        if "video/" in ct or "octet-stream" in ct or urlparse(str(final)).path.lower().endswith(".mp4"):
            return {"kind": "mp4", "url": str(final), "variants": [], "duration": 0.0,
                    "encrypted": False, "drm": False}
        if "html" in ct or "<html" in body[:512].lower():
            found = re.findall(r'https?://[^"\'\s\\<>]+?\.(?:m3u8|mp4)[^"\'\s\\<>]*', body)
            if found:
                u = found[0]
                if u.endswith(".m3u8"):
                    return resolve_stream(u, api)
                return {"kind": "mp4", "url": u, "variants": [], "duration": 0.0,
                        "encrypted": False, "drm": False}
    # embed page blocked / no stream found -> try direct bunny patterns
    m = re.search(r"[?&]token=([^&]+)&expires=([^&]+)", signed_url)
    if m:
        for cand in bunny_direct_candidates(signed_url, m.group(1), m.group(2)):
            try:
                st2, body2, ct2, final2 = http_text(cand)
            except requests.RequestException:
                continue
            if st2 == 200 and "#EXTM3U" in body2[:4096]:
                p = parse_m3u8(body2, str(final2))
                if p:
                    return {"kind": "hls", "url": str(final2), "variants": p["variants"],
                            "duration": p["duration"], "encrypted": p["encrypted"], "drm": p["drm"]}
    return {"kind": "unknown", "url": signed_url, "variants": [], "duration": 0.0,
            "encrypted": False, "drm": False}

def pick_variant(stream, prefer):
    vs = stream.get("variants") or []
    if not vs:
        return stream["url"]
    vs = sorted(vs, key=lambda v: (v["height"] or 0, v["bandwidth"] or 0), reverse=True)
    if prefer in (None, "", "best"):
        return vs[0]["url"]
    want = int(re.sub(r"\D", "", str(prefer)) or 0)
    if not want:
        return vs[0]["url"]
    fit = [v for v in vs if v["height"] and v["height"] <= want]
    return (fit[0] if fit else vs[-1])["url"]

# ============================================================================
# download engine
# ============================================================================

def aria2_download(url, dest, headers=None):
    cmd = [ARIA2, "-q", "-x", "16", "-s", "16", "-k", "4M", "--file-allocation=none",
           "--max-tries=5", "--retry-wait=3", "-d", os.path.dirname(dest) or ".",
           "-o", os.path.basename(dest), "--referer=%s/" % SITE_ORIGIN, "--user-agent=" + UA]
    for k, v in (headers or {}).items():
        cmd.append("--header=%s: %s" % (k, v))
    cmd.append(url)
    return subprocess.call(cmd)

def requests_download(url, dest, headers=None, resume=True):
    h = {"User-Agent": UA, "Referer": SITE_ORIGIN + "/"}
    if headers:
        h.update(headers)
    done = 0
    if resume and os.path.exists(dest):
        done = os.path.getsize(dest)
        h["Range"] = "bytes=%d-" % done
    mode = "ab" if done else "wb"
    total = None
    with requests.get(url, headers=h, stream=True, timeout=(15, 90)) as r:
        if resume and r.status_code not in (200, 206):
            r.close()
            return requests_download(url, dest, headers, resume=False)
        clen = r.headers.get("content-length")
        if clen:
            total = int(clen) + done
        with open(dest, mode) as f:
            t0 = time.time()
            last = 0.0
            for chunk in r.iter_content(chunk_size=1 << 23):  # 8 MB
                if chunk:
                    f.write(chunk)
                    done += len(chunk)
                    now = time.time()
                    if now - last > 0.7:
                        last = now
                        speed = done / max(0.001, now - t0)
                        pct = (done / total * 100) if total else 0
                        print("\r    " + progress_bar(pct) + " %s @ %s/s   " %
                              (fsize(done), fsize(speed)), end="", flush=True)
    print()
    return 0

def ffprobe_meta(path):
    if not FFPROBE:
        return {}
    try:
        out = subprocess.run([FFPROBE, "-v", "error", "-print_format", "json",
                              "-show_format", "-show_streams", path],
                             capture_output=True, text=True, timeout=60).stdout
        j = json.loads(out)
        meta = {}
        if j.get("format", {}).get("duration"):
            meta["duration"] = float(j["format"]["duration"])
        for s in j.get("streams", []):
            if s.get("codec_type") == "video":
                meta["width"] = s.get("width")
                meta["height"] = s.get("height")
                break
        return meta
    except Exception:
        return {}

def ffmpeg_hls_download(playlist_url, dest, duration=0.0, headers=None):
    if not FFMPEG:
        err("ffmpeg not available in this environment")
        return 1
    hdr = "Referer: %s/\r\nUser-Agent: %s\r\n" % (SITE_ORIGIN, UA)
    for k, v in (headers or {}).items():
        hdr += "%s: %s\r\n" % (k, v)
    prog = dest + ".progress"
    cmd = [FFMPEG, "-y", "-hide_banner", "-nostats", "-loglevel", "error",
           "-progress", prog, "-headers", hdr,
           "-protocol_whitelist", "file,http,https,tcp,tls,crypto",
           "-allowed_extensions", "ALL", "-i", playlist_url,
           "-map", "0", "-c", "copy", "-movflags", "+faststart", dest]
    proc = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)

    def watch():
        t0 = time.time()
        last = 0.0
        while proc.poll() is None:
            try:
                with open(prog, "r") as f:
                    txt = f.read()
                m = re.search(r"out_time_ms=(\d+)", txt)
                if m:
                    secs = int(m.group(1)) / 1e6
                    now = time.time()
                    if now - last > 0.7:
                        last = now
                        if duration > 0:
                            pct = min(100.0, secs / duration * 100)
                            speed = secs / max(0.001, now - t0)
                            print("\r    " + progress_bar(pct) +
                                  " %s / %s @ %.1fx   " % (fmt_secs(secs), fmt_secs(duration), speed),
                                  end="", flush=True)
                        else:
                            print("\r    " + "processed " + fmt_secs(secs) + "   ", end="", flush=True)
            except OSError:
                pass
            time.sleep(0.5)
        try:
            os.remove(prog)
        except OSError:
            pass

    th = threading.Thread(target=watch, daemon=True)
    th.start()
    _, stderr = proc.communicate()
    th.join(timeout=2)
    print()
    if proc.returncode != 0 and stderr:
        err("ffmpeg: " + stderr.decode("utf-8", "replace")[-800:])
    return proc.returncode

def fmt_secs(s):
    s = int(s)
    return "%02d:%02d:%02d" % (s // 3600, (s % 3600) // 60, s % 60)

def ytdlp_download(url, dest_dir, prefer="best", referer=SITE_ORIGIN):
    if not YTDLP:
        err("yt-dlp not available")
        return None
    fmt = "bestvideo[height<=%s]+bestaudio/best" % prefer if str(prefer).isdigit() else "best"
    cmd = [YTDLP, "-f", fmt, "--merge-output-format", "mp4",
           "--referer", referer, "--user-agent", UA,
           "-o", os.path.join(dest_dir, "%(title).80s.%(ext)s"), url]
    r = subprocess.run(cmd)
    return r.returncode

def download_media(stream, dest, prefer_quality="best"):
    """stream = resolve_stream() result -> downloads to dest (str path)."""
    if stream["kind"] == "unknown":
        err("could not resolve a downloadable stream (token expired? DRM? YouTube?)")
        return None
    if stream["kind"] == "youtube":
        d = os.path.dirname(dest) or "."
        before = set(os.listdir(d)) if os.path.isdir(d) else set()
        rc = ytdlp_download(stream["url"], d, prefer_quality)
        if rc == 0:
            for fn in sorted(set(os.listdir(d)) - before):
                if fn.endswith((".mp4", ".mkv", ".webm", ".mov")):
                    return os.path.join(d, fn)
        return None
    if stream["kind"] == "mp4":
        url = stream["url"]
        try:
            rc = aria2_download(url, dest) if ARIA2 else 1
            if rc != 0:
                rc = requests_download(url, dest)
        except FileNotFoundError:
            rc = requests_download(url, dest)
        return dest if rc == 0 and os.path.exists(dest) else None
    if stream["kind"] == "hls":
        if stream.get("drm"):
            err("DRM-protected HLS (SAMPLE-AES/FairPlay) - download in browser with the suite instead")
            return None
        if stream.get("encrypted"):
            warn("AES-128 HLS - ffmpeg decrypts automatically (keys are served with the manifest)")
        url = pick_variant(stream, prefer_quality)
        rc = ffmpeg_hls_download(url, dest, duration=stream.get("duration", 0.0))
        if rc != 0 and YTDLP:
            warn("ffmpeg failed - retrying with yt-dlp ...")
            ytdlp_download(url, os.path.dirname(dest) or ".", prefer_quality)
        return dest if os.path.exists(dest) and os.path.getsize(dest) > 1024 else None
    return None

def collect_pdfs(obj, out=None):
    """Scan any API JSON for .pdf URLs (lesson responses carry PDFs sometimes)."""
    out = out if out is not None else set()
    if isinstance(obj, dict):
        for k, v in obj.items():
            if isinstance(v, str) and v.lower().endswith(".pdf") and v.startswith("http"):
                out.add(v)
            else:
                collect_pdfs(v, out)
    elif isinstance(obj, list):
        for v in obj:
            collect_pdfs(v, out)
    return sorted(out)

# ============================================================================
# Google Drive
# ============================================================================

class Drive:
    def __init__(self, cfg):
        self.cfg = cfg
        self.mounted = os.path.isdir("/content/drive/MyDrive")

    def mount(self):
        if self.mounted:
            ok("Drive already mounted at /content/drive")
            return True
        try:
            from google.colab import drive  # noqa
            drive.mount("/content/drive")
            self.mounted = os.path.isdir("/content/drive/MyDrive")
            if self.mounted:
                self.cfg["drive_enabled"] = True
                save_config(self.cfg)
                ok("Drive mounted")
            return self.mounted
        except Exception as e:
            err("Drive mount failed: %s" % e)
            return False

    def root(self):
        r = self.cfg.get("drive_root") or DRIVE_ROOT_DEFAULT
        return r

    def save_file(self, src, rel_under_dl_root=None):
        if not self.mounted:
            warn("Drive not mounted - skipping")
            return None
        if rel_under_dl_root and rel_under_dl_root.startswith(DL_ROOT):
            rel = os.path.relpath(rel_under_dl_root, DL_ROOT)
        else:
            rel = os.path.relpath(src, DL_ROOT) if src.startswith(DL_ROOT) \
                else os.path.basename(src)
        dest = os.path.join(self.root(), rel)
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        shutil.copy2(src, dest)
        ok("Drive: %s  (%s)" % (rel, fsize(os.path.getsize(dest))))
        return dest

    def save_tree(self, folder):
        if not self.mounted:
            warn("Drive not mounted - skipping")
            return 0
        n = 0
        base = folder if folder.startswith(DL_ROOT) else os.path.join(DL_ROOT, os.path.basename(folder))
        for dirpath, _dirs, files in os.walk(folder):
            for fn in files:
                src = os.path.join(dirpath, fn)
                rel = os.path.relpath(src, base)
                dest = os.path.join(self.root(), os.path.basename(base), rel)
                os.makedirs(os.path.dirname(dest), exist_ok=True)
                shutil.copy2(src, dest)
                n += 1
        ok("Drive: %d files -> %s/%s" % (n, self.root(), os.path.basename(base)))
        return n

    def sync_state(self, files):
        if not self.mounted:
            return
        for f in files:
            if os.path.exists(f):
                shutil.copy2(f, os.path.join(self.root(), os.path.basename(f)))

# ============================================================================
# Telegram backup (kurigram userbot + bot API fallback)
# ============================================================================

class Telegram:
    def __init__(self, cfg):
        self.cfg = cfg
        self.app = None
        self.me_obj = None

    # ---------------- manifest (dedupe across sessions)
    def manifest_path(self, drive=None):
        if drive and drive.mounted:
            return os.path.join(drive.root(), "telegram_manifest.json")
        return os.path.join(DL_ROOT, "telegram_manifest.json")

    def manifest_load(self, drive=None):
        try:
            with open(self.manifest_path(drive), "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {}

    def manifest_save(self, man, drive=None):
        p = self.manifest_path(drive)
        os.makedirs(os.path.dirname(p), exist_ok=True)
        with open(p, "w", encoding="utf-8") as f:
            json.dump(man, f, indent=1)

    @staticmethod
    def manifest_key(path):
        st = os.stat(path)
        return "%s|%d" % (hashlib.sha1(path.encode()).hexdigest()[:16], st.st_size)

    # ---------------- userbot (kurigram / pyrogram API)
    def connect(self):
        if not self.cfg.get("tg_api_id") or not self.cfg.get("tg_api_hash"):
            warn("tg_api_id / tg_api_hash missing (my.telegram.org > API development tools)")
            return False
        try:
            from pyrogram import Client  # kurigram installs the `pyrogram` package name
        except ImportError:
            err("kurigram not installed - run:  !pip -q install 'kurigram[fast]'")
            return False
        kwargs = dict(api_id=int(self.cfg["tg_api_id"]), api_hash=self.cfg["tg_api_hash"],
                      workers=8, sleep_threshold=30)
        if self.cfg.get("tg_session_string"):
            kwargs["session_string"] = self.cfg["tg_session_string"]
        try:
            self.app = Client("ictbackup", **kwargs)
            self.app.start()
            self.me_obj = self.app.get_me()
            try:
                ss = self.app.export_session_string()
                if ss != self.cfg.get("tg_session_string"):
                    self.cfg["tg_session_string"] = ss
                    save_config(self.cfg)
            except Exception:
                pass
            ok("connected as @%s (%s)" % (self.me_obj.username or self.me_obj.first_name,
                                          self.me_obj.phone_number or "no-phone"))
            return True
        except Exception as e:
            err("userbot connect failed: %s" % e)
            self.app = None
            return False

    def disconnect(self):
        if self.app:
            try:
                self.app.stop()
            except Exception:
                pass
            self.app = None
            self.me_obj = None

    def list_groups(self):
        if not self.app:
            warn("not connected")
            return []
        out = []
        for d in self.app.get_dialogs(limit=100):
            ch = d.chat
            if ch and ch.type.name in ("GROUP", "SUPERGROUP"):
                out.append({"id": ch.id, "title": ch.title,
                            "members": getattr(ch, "members_count", None)})
        return out

    def resolve_target(self, value=None):
        v = str(value or self.cfg.get("tg_group") or "").strip()
        if not v:
            return None
        try:
            return self.app.get_chat(int(v)) if v.lstrip("-").isdigit() else self.app.get_chat(v)
        except Exception:
            return None

    def _progress(self, path, tag):
        t0 = time.time()
        def cb(cur, total):
            now = time.time()
            if total and (now - t0 > 0 or cur == total) and now - getattr(cb, "last", 0) > 0.8:
                cb.last = now
                pct = cur / total * 100
                speed = cur / max(0.001, now - t0)
                print("\r    " + progress_bar(pct) + " %s @ %s/s   " % (fsize(cur), fsize(speed)),
                      end="", flush=True)
        cb.last = 0.0
        return cb

    def upload(self, path, caption="", as_document=None, drive=None):
        if not self.app:
            warn("userbot not connected")
            return None
        path = os.path.abspath(path)
        if not os.path.exists(path):
            err("file not found: " + path)
            return None
        man = self.manifest_load(drive)
        key = self.manifest_key(path)
        if key in man:
            ok("already in Telegram (skipped): %s" % os.path.basename(path))
            return man[key]
        caption = caption or os.path.basename(path)
        as_doc = self.cfg["tg_as_document"] if as_document is None else bool(as_document)
        target = self.resolve_target()
        if target is None:
            err("no upload target set (Settings > tg_group, or pick from Groups menu)")
            return None
        t0 = time.time()
        sent = None
        try:
            if as_doc:
                sent = self.app.send_document(target.id, document=path, caption=caption,
                                              force_document=True, progress=self._progress(path, "doc"))
            else:
                meta = ffprobe_meta(path)
                sent = self.app.send_video(target.id, video=path, caption=caption,
                                           supports_streaming=True,
                                           duration=int(meta.get("duration") or 0) or None,
                                           width=meta.get("width"), height=meta.get("height"),
                                           progress=self._progress(path, "vid"))
        except Exception as e:
            err("upload failed: %s" % e)
            print()
            return None
        took = time.time() - t0
        avg = os.path.getsize(path) / max(0.001, took)
        print()
        ok("uploaded %s  (%s avg/s, %.0fs)" % (os.path.basename(path), fsize(avg), took))
        man[key] = {"file": os.path.basename(path), "size": os.path.getsize(path),
                    "chat": target.id, "message_id": getattr(sent, "id", None),
                    "date": time.strftime("%Y-%m-%d %H:%M")}
        self.manifest_save(man, drive)
        if drive and drive.mounted:
            drive.sync_state([self.manifest_path(drive)])
        return man[key]

    def upload_tree(self, folder, drive=None, prefix=""):
        n = up = 0
        for dirpath, _dirs, files in sorted(os.walk(folder)):
            for fn in sorted(files):
                p = os.path.join(dirpath, fn)
                if fn.endswith((".progress", ".json")):
                    continue
                n += 1
                rel = os.path.relpath(p, folder)
                cap = ("%s | %s" % (prefix, rel.replace(os.sep, " / "))).strip(" |")
                r = self.upload(p, caption=cap, drive=drive)
                if r:
                    up += 1
                    if self.cfg.get("delete_after_upload"):
                        try:
                            os.remove(p)
                            note("deleted local copy: " + fn)
                        except OSError:
                            pass
        ok("telegram: %d/%d files uploaded from %s" % (up, n, os.path.basename(folder)))
        return up, n

    # ---------------- bot API fallback (< 50 MB)
    def bot_upload(self, path, caption="", chat=None):
        tok = self.cfg.get("tg_bot_token")
        chat = chat or self.cfg.get("tg_group")
        if not tok or not chat:
            warn("bot fallback needs tg_bot_token + tg_group")
            return False
        size = os.path.getsize(path)
        if size > 49 * 1024 * 1024:
            warn("bot API limit is 50 MB (%s) - use the userbot for this file" % fsize(size))
            return False
        url = "https://api.telegram.org/bot%s/sendDocument" % tok
        with open(path, "rb") as f:
            r = requests.post(url, data={"chat_id": chat, "caption": caption},
                              files={"document": f}, timeout=(30, 600))
        j = r.json()
        if j.get("ok"):
            ok("bot upload OK (%s)" % os.path.basename(path))
            return True
        err("bot upload failed: %s" % j.get("description"))
        return False

# ============================================================================
# the TUI
# ============================================================================

class TUI:
    def __init__(self, cfg=None):
        self.cfg = cfg or load_config()
        self.api = ICTApi(self.cfg)
        self.drive = Drive(self.cfg)
        self.tg = Telegram(self.cfg)
        self.courses = []          # catalog [{id,title,...}]
        self.my = []               # allowed lessons
        self.course = None         # selected course id
        self.lesson = None         # selected lesson id
        self.videos = []           # videos of selected lesson
        self.last_file = None
        self._keepalive = None
        self._ka_dead = threading.Event()
        self._lessons_by_course = {}
        self.pdf_type = "tute"     # current /pdfs/{type} listing (tute | lesson-pp | paper-book)
        self.pdf_items = []        # last listing result

    # -------------------------------------------------- shared helpers
    def _require_login(self):
        try:
            self.api.ensure_login()
            return True
        except LoginError as e:
            err("not logged in: %s" % e)
            if e.kind == "device-check":
                print(red("""
    The server replied 422 (device/network check). DO NOT retry blindly:
    retry -> 302 "Account on Pause" -> server-side lock (staff unlock only).
    Fix instead: check visitor_id/confidence in Settings, or capture the pair
    from the device the account is bound to (README)."""))
            return False
        except ApiError as e:
            err("login failed: HTTP %s %s" % (e.status, e.body[:200]))
            return False

    def _maybe_401(self, fn, *a, **kw):
        """run an API call; on 401 try one automatic re-login, then retry once."""
        try:
            return fn(*a, **kw)
        except ApiError as e:
            if e.status == 401 and self.api.auto_relogin():
                return fn(*a, **kw)
            raise

    def _course_title(self, cid):
        for c in self.courses:
            if str(c.get("id")) == str(cid):
                return c.get("title") or str(cid)
        return str(cid)

    def _group_my_lessons(self):
        self._lessons_by_course = {}
        for l in self.my:
            self._lessons_by_course.setdefault(str(l.get("course_id")), []).append(l)

    def _refresh_data(self, quiet=False):
        self._require_login()
        self.courses = self._maybe_401(self.api.courses)
        self.my = self._maybe_401(self.api.my_lessons)
        self._group_my_lessons()
        if not quiet:
            ok("courses: %d | allowed lessons: %d" % (len(self.courses), len(self.my)))

    def _start_keepalive(self):
        """Optional session keepalive: GET /user every keepalive_interval seconds
        through the engine's request helper (so mocks/guards see it). Default off."""
        if self._keepalive or not self.cfg.get("keepalive"):
            return
        self._ka_dead = threading.Event()   # fresh flag so a stopped loop can be restarted
        gap = int(self.cfg.get("keepalive_interval") or 600)

        def loop():
            while not self._ka_dead.wait(gap):
                if not self.api.token:
                    continue
                try:
                    self.api.request("GET", "/user", timeout=(15, 30))
                    note("keepalive: session alive")
                except ApiError as e:
                    if e.status == 401:
                        warn("keepalive: token dead - one auto re-login (bound fingerprint)")
                        self.api.auto_relogin()
                    else:
                        note("keepalive: HTTP %s" % e.status)
                except requests.RequestException:
                    pass
        self._keepalive = threading.Thread(target=loop, daemon=True)
        self._keepalive.start()
        note("keepalive: pinging /user every %d s" % gap)

    def _stop_keepalive(self):
        if self._keepalive:
            self._ka_dead.set()
            self._keepalive = None

    def _after_download(self, path, label=""):
        """post-download chain: Drive -> Telegram -> optional delete."""
        self.last_file = path
        if not path or not os.path.exists(path):
            return
        if self.cfg.get("auto_drive") and self.drive.mounted:
            try:
                self.drive.save_file(path)
            except Exception as e:
                err("drive copy failed: %s" % e)
        if self.cfg.get("auto_telegram") and (self.tg.app or self.cfg.get("tg_group")):
            if self.tg.app is None and self.cfg.get("tg_api_id") and self.cfg.get("tg_api_hash"):
                warn("auto-telegram: connecting userbot ...")
                if not self.tg.connect():
                    return
            cap = (label or os.path.basename(path)).replace(os.sep, " | ")
            r = self.tg.upload(path, caption=cap, drive=self.drive)
            if r and self.cfg.get("delete_after_upload"):
                try:
                    os.remove(path)
                    note("deleted local copy after upload")
                except OSError:
                    pass

    def _download_video(self, v, quality=None):
        vid = v.get("id") or v.get("video_id")
        title = v.get("title") or ("video-%s" % vid)
        course = self.course or (str(v.get("course_id")) if v.get("course_id") else "misc")
        lesson = self.lesson or (str(v.get("lesson_id")) if v.get("lesson_id") else "misc")
        folder = os.path.join(DL_ROOT, sanitize_filename(self._course_title(course), 60),
                              sanitize_filename(str(lesson) + " " + self._lesson_title(lesson), 60))
        os.makedirs(folder, exist_ok=True)
        dest = os.path.join(folder, sanitize_filename("%s - %s" % (lesson, title)) + ".mp4")
        print(bold("    video %s - %s" % (vid, title)))
        if v.get("video_url") and is_youtube(v.get("video_url", "")):
            stream = {"kind": "youtube", "url": v["video_url"]}
        else:
            try:
                signed = self._maybe_401(self.api.video_signed_url, vid)
            except ApiError as e:
                err("cannot sign video %s: HTTP %s %s" % (vid, e.status, e.body[:150]))
                return None
            stream = resolve_stream(signed, self.api)
            if stream["kind"] != "youtube" and stream["kind"] != "unknown" and stream.get("variants"):
                vs = sorted(stream["variants"], key=lambda x: (x["height"] or 0, x["bandwidth"] or 0), reverse=True)
                note("qualities: " + ", ".join(("%s%s" % (v["height"] or v["bandwidth"] // 1000,
                                                          "p" if v["height"] else "kbps")) for v in vs))
        q = quality or self.cfg.get("prefer_quality", "best")
        out = download_media(stream, dest, q)
        if out and os.path.exists(out):
            ok("saved %s  %s" % (out, fsize(os.path.getsize(out))))
            self._after_download(out, "%s | %s | %s" % (self._course_title(course), lesson, title))
            return out
        err("download failed: %s" % title)
        return None

    def _lesson_title(self, lesson_id):
        for l in self.my:
            if str(l.get("id")) == str(lesson_id):
                return l.get("title") or ""
        return ""

    def _download_lesson(self, lesson_id):
        try:
            vids = self._maybe_401(self.api.lesson_videos, lesson_id)
        except ApiError as e:
            err("lesson %s: HTTP %s %s" % (lesson_id, e.status, e.body[:150]))
            return
        self.lesson = lesson_id
        print(bold("    lesson %s - %d items" % (lesson_id, len(vids))))
        pdfs = collect_pdfs(vids)
        for i, v in enumerate(vids, 1):
            self._download_video(v)
        for i, u in enumerate(pdfs, 1):
            folder = os.path.join(DL_ROOT, sanitize_filename(self._course_title(self.course or "misc"), 60),
                                  sanitize_filename(str(lesson_id), 60))
            os.makedirs(folder, exist_ok=True)
            dest = os.path.join(folder, "PDF %d.pdf" % i)
            note("pdf %d/%d: %s" % (i, len(pdfs), u[:90]))
            if ARIA2:
                rc = aria2_download(u, dest)
            else:
                rc = requests_download(u, dest)
            if rc == 0 and os.path.exists(dest):
                self._after_download(dest, "%s | %s | pdf" % (self._course_title(self.course or "misc"), lesson_id))

    def _download_course(self, cid):
        self.course = cid
        self._refresh_data(quiet=True)
        lessons = self._lessons_by_course.get(str(cid))
        if lessons is None:
            try:
                lessons = self._maybe_401(self.api.course_lessons, cid)
            except ApiError as e:
                err("course %s: HTTP %s" % (cid, e.status))
                return
        print(bold("    course %s - %d lessons" % (cid, len(lessons))))
        for i, l in enumerate(lessons, 1):
            print(dim("    --- lesson %d/%d: %s ---" % (i, len(lessons), l.get("title"))))
            self._download_lesson(l.get("id"))

    # -------------------------------------------------- screens
    def run(self):
        banner()
        self._start_keepalive()
        if not self.cfg.get("password"):
            note("tip: edit the CONFIG cell (or menu 9) first - phone, password, visitor_id, telegram")
        eof = 0
        while True:
            self._main()
            try:
                self._main_menu()
                eof = 0
            except (KeyboardInterrupt, EOFError):
                print()
                eof += 1
                if eof >= 3:
                    print(dim("input closed - bye"))
                    return
                if not confirm("Quit the TUI?", default_yes=False):
                    continue
                print(dim("bye"))
                return

    def _main(self):
        user = self.api.user or {}
        who = " ".join(filter(None, [user.get("first_name"), user.get("last_name")])) or "-"
        parts = [
            bold("ICT TUI"),
            "user: " + (green(who) if self.api.token else red("not logged in")),
            "course: " + cyan(str(self.course or "-")),
            "quality: " + cyan(str(self.cfg.get("prefer_quality"))),
            "drive: " + (green("on") if self.drive.mounted else dim("off")),
            "tg: " + (green("userbot") if self.tg.app else
                      (yellow("bot") if self.cfg.get("tg_bot_token") else dim("off"))),
        ]
        print(dim("  |  ").join(parts))

    def _main_menu(self):
        print()
        print(bold("MAIN"))
        print("   1  Login / session            6  Telegram backup")
        print("   2  Dashboard                  7  Auto pipeline (course)")
        print("   3  Lessons browser            8  API console")
        print("   4  Downloads                  9  Settings / config")
        print("   5  Google Drive              10  API quick calls")
        print("  11  PDF browser / tutes        0  exit")
        c = ask("menu", "")
        if c == "1": self._screen(self.scr_login)
        elif c == "2": self._screen(self.scr_dashboard)
        elif c == "3": self._screen(self.scr_browse)
        elif c == "4": self._screen(self.scr_downloads)
        elif c == "5": self._screen(self.scr_drive)
        elif c == "6": self._screen(self.scr_telegram)
        elif c == "7": self._screen(self.scr_pipeline)
        elif c == "8": self._screen(self.scr_console)
        elif c == "9": self._screen(self.scr_settings)
        elif c == "10": self._screen(self.scr_quick)
        elif c == "11": self._screen(self.scr_pdfs)
        elif c == "0":
            raise KeyboardInterrupt

    def _screen(self, fn):
        """one screen = one crash-proof menu action"""
        try:
            fn()
        except (KeyboardInterrupt, EOFError):
            raise
        except Exception as e:
            err("%s crashed: %r" % (getattr(fn, "__name__", fn), e))
            note("back to main menu")

    # ---------------- 1 login
    def scr_login(self):
        head("Login / session")
        print("   1  login now (config values)")
        print("   2  login with entered values")
        print("   3  paste manual Bearer token (from the browser suite backup)")
        print("   4  show session")
        print("   5  logout")
        print("   6  session keepalive (ping /user) -> %s" %
              (green("on") if self.cfg.get("keepalive") else dim("off")))
        c = ask("menu", "1")
        if c == "1":
            need = config_missing(self.cfg)
            if need:
                warn("missing: " + "; ".join(need))
                if confirm("enter missing values now?"):
                    self._cfg_login_fields()
            try:
                self.api.login()
                self._maybe_401(self.api.me)
                ok("logged in as %s (course %s)" % (
                    (self.api.user or {}).get("first_name", "?"), self.api.course_id))
                self._refresh_data(quiet=True)
            except LoginError as e:
                self._login_error_ui(e)
            except ApiError as e:
                err("login failed: HTTP %s %s" % (e.status, e.body[:200]))
        elif c == "2":
            self._cfg_login_fields()
            try:
                self.api.login()
                self._maybe_401(self.api.me)
                ok("logged in as %s" % (self.api.user or {}).get("first_name", "?"))
                self._refresh_data(quiet=True)
            except LoginError as e:
                self._login_error_ui(e)
            except ApiError as e:
                err("login failed: HTTP %s %s" % (e.status, e.body[:200]))
        elif c == "3":
            tok = ask("token (id|secret)", secret=True)
            if tok:
                self.api.token = tok.strip()
                self.api.session.headers["Authorization"] = "Bearer " + self.api.token
                self.cfg["manual_token"] = self.api.token
                save_config(self.cfg)
                try:
                    self._maybe_401(self.api.me)
                    ok("token works - user loaded")
                    self._refresh_data(quiet=True)
                except ApiError as e:
                    err("token rejected: HTTP %s" % e.status)
        elif c == "4":
            self._show_session()
        elif c == "5":
            self.api.token = ""
            self.api.session.headers.pop("Authorization", None)
            self.cfg["manual_token"] = ""
            save_config(self.cfg)
            ok("logged out (local only)")
        elif c == "6":
            want = confirm("enable session keepalive (GET /user every %s s)?"
                           % (self.cfg.get("keepalive_interval") or 600),
                           default_yes=bool(self.cfg.get("keepalive")))
            self.cfg["keepalive"] = bool(want)
            save_config(self.cfg)
            if want:
                self._start_keepalive()
                ok("keepalive running (interval %s s)" % (self.cfg.get("keepalive_interval") or 600))
            else:
                self._stop_keepalive()
                ok("keepalive stopped")

    def _cfg_login_fields(self):
        self.cfg["phone"] = ask("phone (07xxxxxxxx)", self.cfg["phone"])
        self.cfg["password"] = ask("password", secret=True) or self.cfg["password"]
        self.cfg["visitor_id"] = ask("visitorId (bound fingerprint)", self.cfg["visitor_id"])
        conf = ask("confidenceScore", str(self.cfg["confidence"]))
        try:
            self.cfg["confidence"] = float(conf)
        except ValueError:
            pass
        save_config(self.cfg)

    def _login_error_ui(self, e):
        if e.kind == "paused":
            err("SERVER-SIDE PAUSE (302, no token in body). No client fix.")
            note("call 071 455 5513 to unlock, then re-capture fingerprint and login once here.")
        elif e.kind == "device-check":
            err("422 device/network check - STOP, do not retry (retry -> pause -> lock)")
            print(red("""
    The bound visitorId was not accepted. Check:
      - visitor_id copied exactly from a WORKING login payload (F12 > Network)
      - confidenceScore matches the same payload
      - one-char change of visitorId is enough to trigger this
    Then retry ONCE here. If it still 422s, capture the pair again."""))
        elif e.kind == "credentials":
            err("wrong phone/password")
        else:
            err("login failed (%s): %s" % (e.kind, (e.body or "")[:200]))

    def _show_session(self):
        t = self.api.token
        head("Session")
        print("  token : " + ((dim(t[:10] + "..." + t[-4:]) + " role " + cyan(self.api.role or "?"))
                              if t else red("none")))
        u = self.api.user or {}
        if u:
            print("  user  : %s  phone %s  course %s  institute %s" %
                  (" ".join(filter(None, [u.get("first_name"), u.get("last_name")])),
                   u.get("phone_number"), u.get("course_id"), u.get("institute_id")))
        print("  fp    : visitorId %s  conf %.3f" %
              ((self.cfg["visitor_id"] or "-")[:10], float(self.cfg.get("confidence") or 0)))

    # ---------------- 2 dashboard
    def scr_dashboard(self):
        head("Dashboard")
        if not self._require_login():
            return
        try:
            u = self._maybe_401(self.api.me)
        except ApiError as e:
            err("HTTP %s" % e.status)
            return
        u = self.api.user or {}
        rows = [
            ("name", " ".join(filter(None, [u.get("first_name"), u.get("last_name")]))),
            ("phone", u.get("phone_number")), ("email", u.get("email")),
            ("course", u.get("course_id")), ("medium", u.get("medium")),
            ("school", u.get("school")), ("institute id", u.get("institute_id")),
            ("district", u.get("district")), ("id verified", u.get("verified_id")),
            ("email verified", u.get("verified_email")), ("last active", u.get("last_active_at")),
        ]
        for k, v in rows:
            print("  %-14s %s" % (cyan(str(k)), v if v not in (None, "") else dim("-")))
        try:
            nots = self._maybe_401(self.api.notifications)
            print(bold("  notifications (%d):" % len(nots)))
            for n in nots[:8]:
                d = n.get("data", {}) if isinstance(n, dict) else {}
                print("   - %s %s" % (d.get("msg", ""), dim(str(d.get("link", ""))[:60])))
        except ApiError as e:
            note("notifications: HTTP %s" % e.status)
        try:
            self.my = self._maybe_401(self.api.my_lessons)
            self._group_my_lessons()
            print(bold("  my lessons:"))
            for cid in sorted(self._lessons_by_course):
                ls = self._lessons_by_course[cid]
                print("   - %s  %s  (%d lessons)" % (cyan(cid), self._course_title(cid), len(ls)))
        except ApiError as e:
            note("lessons/allowed: HTTP %s" % e.status)

    # ---------------- 3 lessons browser
    def scr_browse(self):
        head("Lessons browser")
        if not self._require_login():
            return
        if not self.my:
            self._refresh_data()
        while True:
            print()
            print("   1  refresh (courses + allowed lessons)")
            print("   2  pick course            -> %s" % cyan(self.course or "-"))
            print("   3  list lessons of course")
            print("   4  open lesson (videos)   -> %s" % cyan(self.lesson or "-"))
            print("   5  show API map")
            print("   6  list my allowed lessons (GET /lessons/allowed)")
            print("   0  back")
            c = ask("menu", "0")
            if c == "0":
                return
            elif c == "1":
                self._refresh_data()
            elif c == "2":
                self._pick_course()
            elif c == "3":
                self._list_lessons()
            elif c == "4":
                self._open_lesson()
            elif c == "5":
                self._api_map()
            elif c == "6":
                self._list_allowed()

    def _pick_course(self):
        if not self.my:
            self._refresh_data(quiet=True)
        ids = sorted(self._lessons_by_course.keys())
        if not ids:
            warn("no allowed lessons yet (purchases pending?)")
            return
        for i, cid in enumerate(ids, 1):
            print("   %2d  %-12s %s  (%d lessons)" %
                  (i, cyan(cid), self._course_title(cid), len(self._lessons_by_course[cid])))
        i = ask_int("course #", 0)
        if 1 <= i <= len(ids):
            self.course = ids[i - 1]
            ok("course -> %s" % self.course)

    def _list_lessons(self):
        if not self.course:
            warn("pick a course first")
            return
        ls = self._lessons_by_course.get(str(self.course))
        if ls is None:
            try:
                ls = self._maybe_401(self.api.course_lessons, self.course)
            except ApiError as e:
                err("HTTP %s" % e.status)
                return
        for i, l in enumerate(ls, 1):
            print("   %3d  id %-8s %-42s price %-6s status %s" %
                  (i, dim(str(l.get("id"))), (l.get("title") or "")[:42],
                   l.get("price", "-"), l.get("status", "-")))

    def _list_allowed(self):
        """direct view of GET /lessons/allowed (all owned lessons, ungrouped)."""
        if not self.my:
            self._refresh_data(quiet=True)
        print(bold("    allowed lessons (%d):" % len(self.my)))
        for l in self.my:
            print("   - id %-8s %-44s course %s" %
                  (dim(str(l.get("id"))), (l.get("title") or "")[:44], l.get("course_id", "-")))

    def _open_lesson(self):
        if not self.course:
            warn("pick a course first")
            return
        lid = ask("lesson id", str(self.lesson or ""))
        if not lid:
            return
        try:
            vids = self._maybe_401(self.api.lesson_videos, lid)
        except ApiError as e:
            err("HTTP %s %s" % (e.status, e.body[:150]))
            return
        self.lesson = lid
        self.videos = vids
        print(bold("    lesson %s - %d videos" % (lid, len(vids))))
        for i, v in enumerate(vids, 1):
            u0 = v.get("video_url") or ""
            kind = "YT" if is_youtube(u0) else ("Bunny" if u0 else "?")
            print("   %2d  video %-6s [%s] %-42s status %s" %
                  (i, dim(str(v.get("id"))), kind, (v.get("title") or "")[:42], v.get("status", "-")))
        pdfs = collect_pdfs(vids)
        if pdfs:
            print(bold("    pdfs (%d):" % len(pdfs)))
            for u in pdfs:
                print("     - %s" % dim(u[:100]))

    @staticmethod
    def _api_map():
        head("API map (verified in bundles)")
        rows = [
            ("POST /login", "{phoneNumber,password,visitorId,confidenceScore} -> {token id|secret,role,skippable,course_id}"),
            ("GET  /user", "own profile (Bearer)"),
            ("GET  /notifications", "bell data (POST /notifications/read-all clears)"),
            ("GET  /courses", "course catalog (course_id like 2027-al)"),
            ("GET  /courses/{id}", "lessons of a course"),
            ("GET  /lessons", "all lessons"),
            ("GET  /lessons/allowed", "my purchased lessons"),
            ("GET  /lessons/{id}", "videos of a lesson"),
            ("GET  /videos/{id}", "{video_url} (Bunny embed / mp4 / YouTube)"),
            ("GET  /videos/{id}/generate-token", "{token,expires} -> append ?token=&expires="),
            ("GET  /pdfs/{type}", "pdf listings: tute | lesson-pp | paper-book"),
            ("GET  /pdfs/{id}", "pdf delivery (Bearer); /files/secure/{a}/{b} follows"),
            ("GET  /model-papers/availability", '{"availability": true|false}'),
            ("GET  /practical-sessions/availability", '{"availability": true|false}'),
            ("GET  /purchases/tutes", "tute purchases"),
            ("GET  /telegram", "site telegram invites"),
            ("GET  /zoom/{id}/add-registrant", "zoom links"),
            ("POST /purchases/online-transfer/{id}", "payment flows"),
            ("GET  /admin/courses", "role gate - STUDENT must get 403 (RBAC check, menu 10 > 13)"),
        ]
        for m, d in rows:
            print("  %s  %s" % (cyan(m), dim(d)))
        note("full map: 217 endpoints in analysis/api_findings_current.json (browser console tab too)")

    # ---------------- 4 downloads
    def scr_downloads(self):
        head("Downloads")
        print("   1  single video (needs lesson open or id)")
        print("   2  whole lesson")
        print("   3  whole course")
        print("   4  everything allowed (all my lessons)")
        print("   5  last downloaded file -> drive/tg now")
        print("   0  back")
        c = ask("menu", "0")
        if c == "0":
            return
        if not self._require_login():
            return
        if not self.my:
            self._refresh_data()
        if c == "1":
            vid = ask("video id", "")
            if vid:
                self._download_video({"id": vid, "title": "video-%s" % vid})
        elif c == "2":
            lid = ask("lesson id", str(self.lesson or ""))
            if lid:
                self._download_lesson(lid)
        elif c == "3":
            self._pick_course()
            if self.course:
                self._download_course(self.course)
        elif c == "4":
            self._refresh_data(quiet=True)
            for cid in sorted(self._lessons_by_course):
                self._download_course(cid)
        elif c == "5" and self.last_file:
            self._after_download(self.last_file, os.path.basename(self.last_file))

    # ---------------- 5 drive
    def scr_drive(self):
        head("Google Drive")
        print("   1  mount Drive")
        print("   2  save last download")
        print("   3  save whole download folder")
        print("   4  sync config + manifest to Drive")
        print("   5  load config from Drive (if saved there)")
        print("   0  back")
        c = ask("menu", "0")
        if c == "1":
            self.drive.mount()
        elif c == "2" and self.last_file:
            self.drive.save_file(self.last_file)
        elif c == "3":
            if self.drive.mounted:
                self.drive.save_tree(DL_ROOT)
            else:
                warn("mount first")
        elif c == "4":
            self.drive.sync_state([CONFIG_PATH])
            ok("state synced")
        elif c == "5":
            src = os.path.join(self.drive.root(), os.path.basename(CONFIG_PATH))
            if os.path.exists(src):
                shutil.copy2(src, CONFIG_PATH)
                self.cfg = load_config()
                self.api.cfg = self.cfg
                self.drive.cfg = self.cfg
                self.tg.cfg = self.cfg
                ok("config loaded from Drive")
            else:
                warn("no config in Drive yet")

    # ---------------- 6 telegram
    def scr_telegram(self):
        head("Telegram backup")
        print("   1  connect userbot (kurigram - up to 2 GB per file)")
        print("   2  who am i")
        print("   3  list my groups / pick backup group")
        print("   4  upload a file")
        print("   5  upload whole download folder (dedup by manifest)")
        print("   6  bot API fallback (files < 50 MB)")
        print("   0  back")
        c = ask("menu", "0")
        if c == "1":
            self.tg.connect()
        elif c == "2":
            if self.tg.me_obj:
                m = self.tg.me_obj
                ok("@%s id %s phone %s" % (m.username, m.id, m.phone_number))
            else:
                warn("not connected")
        elif c == "3":
            if not self.tg.app and not self.tg.connect():
                return
            groups = self.tg.list_groups()
            for i, g in enumerate(groups, 1):
                print("   %2d  %-14s %-40s %s" % (i, dim(str(g["id"])), g["title"],
                                                 (str(g["members"]) + " members") if g["members"] else ""))
            i = ask_int("group # (0 = keep current)", 0)
            if 1 <= i <= len(groups):
                self.cfg["tg_group"] = str(groups[i - 1]["id"])
                save_config(self.cfg)
                ok("backup group -> %s (%s)" % (groups[i - 1]["title"], self.cfg["tg_group"]))
        elif c == "4":
            p = ask("file path", self.last_file or "")
            if p and os.path.exists(p):
                self.tg.upload(p, caption=os.path.basename(p), drive=self.drive)
            else:
                err("file not found")
        elif c == "5":
            folder = ask("folder", DL_ROOT)
            if os.path.isdir(folder):
                self.tg.upload_tree(folder, drive=self.drive)
            else:
                err("folder not found")
        elif c == "6":
            if not self.cfg.get("tg_bot_token"):
                self.cfg["tg_bot_token"] = ask("bot token", secret=True)
                save_config(self.cfg)
            p = ask("file path", self.last_file or "")
            if p and os.path.exists(p):
                self.tg.bot_upload(p, caption=os.path.basename(p))

    # ---------------- 7 pipeline
    def scr_pipeline(self):
        head("Auto pipeline: download -> Drive -> Telegram")
        flags = [("auto_drive", "save to Drive"), ("auto_telegram", "upload to Telegram group"),
                 ("delete_after_upload", "delete local after TG upload")]
        for k, d in flags:
            print("   %-20s %s  (%s)" % (d, green("ON") if self.cfg.get(k) else dim("off"), k))
        note("toggles live in Settings (9). Telegram needs the userbot connected or group id set.")
        if not self._require_login():
            return
        self._refresh_data()
        self._pick_course()
        if not self.course:
            return
        cid = self.course
        title = self._course_title(cid)
        print(bold("    pipeline: course %s (%s)  quality %s" % (cid, title, self.cfg.get("prefer_quality"))))
        if not confirm("start full course download?", default_yes=True):
            return
        self._download_course(cid)
        if self.drive.mounted and confirm("push the whole course folder to Drive now?"):
            self.drive.save_tree(os.path.join(DL_ROOT, sanitize_filename(title, 60)))
        if self.cfg.get("auto_telegram") and confirm("upload the course folder to the Telegram group now?"):
            if self.tg.app is None:
                self.tg.connect()
            self.tg.upload_tree(os.path.join(DL_ROOT, sanitize_filename(title, 60)),
                                drive=self.drive, prefix=title)

    # ---------------- 8 console
    def _print_api_result(self, st, data, limit=4000):
        """pretty-print an api result; tokens are redacted."""
        text = json.dumps(data, indent=2, ensure_ascii=False) if not isinstance(data, str) else data
        if isinstance(data, dict) and data.get("token"):
            text = re.sub(r'"token"\s*:\s*"([^"]{4})[^"]*"', r'"token":"\1..."', text)
        print(dim("HTTP %s" % st))
        print(text[:limit] + (dim("\n... (truncated)") if len(text) > limit else ""))

    def scr_console(self):
        head("API console (raw /api calls with your Bearer)")
        if not self._require_login():
            return
        print(dim("  method path [JSON body]   e.g.  GET /courses"))
        print(dim("  empty line = back | 'map' = endpoint map | one-key calls in menu 10"))
        while True:
            line = ask("call", "").strip()
            if not line:
                return
            if line.lower() == "map":
                self._api_map()
                continue
            m = re.match(r"^(GET|POST|PUT|PATCH|DELETE)\s+(\S+)(?:\s+(.*))?$", line, re.I)
            if not m:
                warn("format: METHOD /path [json]")
                continue
            method, path, body = m.group(1).upper(), m.group(2), (m.group(3) or "").strip()
            try:
                st, data = self.api.console(method, path, body)
            except (ApiError, ValueError, requests.RequestException) as e:
                err("call failed: %s" % e)
                continue
            self._print_api_result(st, data)

    # ---------------- 10 API quick calls
    QUICK_CALLS = [
        ("1",  "GET",  "/user", "profile"),
        ("2",  "GET",  "/courses", "catalog incl. pdf groups"),
        ("3",  "GET",  "/lessons/allowed", "my lessons"),
        ("4",  "GET",  "/notifications", "bell"),
        ("5",  "POST", "/notifications/read-all", "mark all read"),
        ("6",  "GET",  "/telegram", "site group links"),
        ("7",  "GET",  "/model-papers/availability", ""),
        ("8",  "GET",  "/practical-sessions/availability", ""),
        ("9",  "GET",  "/pdfs/tute", "listing"),
        ("10", "GET",  "/pdfs/lesson-pp", "listing"),
        ("11", "GET",  "/pdfs/paper-book", "listing"),
        ("12", "GET",  "/purchases/tutes", "my tutes"),
        ("13", "GET",  "/admin/courses", "RBAC check - expect 403"),
    ]

    def scr_quick(self):
        head("API quick calls (one-key, Bearer-auth, via the engine request helper)")
        if not self._require_login():
            return
        while True:
            print()
            for n, m, p, d in self.QUICK_CALLS:
                print("   %-3s %-9s %-36s %s" % (n, cyan(m), p, dim(d)))
            print("   0   back")
            c = ask("call #", "0")
            if c == "0":
                return
            row = next((r for r in self.QUICK_CALLS if r[0] == c), None)
            if row is None:
                warn("unknown option")
                continue
            _n, method, path, _d = row
            if path == "/notifications/read-all" and not confirm("mark ALL notifications read?"):
                continue
            if path == "/admin/courses":
                self._rbac_check()
                continue
            self._quick_call(method, path)

    def _quick_call(self, method, path):
        try:
            st, data = self._maybe_401(lambda: self.api.console(method, path))
        except (ApiError, ValueError, requests.RequestException) as e:
            err("call failed: %s" % e)
            return
        self._print_api_result(st, data, limit=3000)

    def _rbac_check(self):
        """VERIFICATION, not an attack: the STUDENT token must get 403 on /admin/*."""
        try:
            st, data = self._maybe_401(lambda: self.api.console("GET", "/admin/courses"))
        except (ApiError, ValueError, requests.RequestException) as e:
            err("rbac check failed: %s" % e)
            return
        body = data if isinstance(data, dict) else {}
        if st == 403:
            ok("RBAC intact: STUDENT -> 403 (%s)" % (body.get("msg") or json.dumps(body)[:40] or "-"))
        elif st == 200:
            err("RBAC BROKEN: student token reached /admin/courses (HTTP 200)!")
            note("do not explore - report it and log out")
        else:
            warn("unexpected status %s from /admin/courses (expected 403)" % st)
            self._print_api_result(st, data, limit=500)

    # ---------------- 11 PDF browser
    PDF_TYPES = ("tute", "lesson-pp", "paper-book")

    def scr_pdfs(self):
        head("PDF browser (GET /pdfs/{type} listings + /pdfs/{id} delivery)")
        if not self._require_login():
            return
        while True:
            print()
            print("   1  listing type            -> %s" % cyan(self.pdf_type))
            print("   2  list PDFs               (GET /pdfs/{type})")
            print("   3  download PDF by id      (GET /pdfs/{id}, Bearer)")
            print("   4  save listing metadata   (JSON only, no download)")
            print("   0  back")
            c = ask("menu", "0")
            if c == "0":
                return
            elif c == "1":
                for i, t in enumerate(self.PDF_TYPES, 1):
                    print("   %d  %s" % (i, t))
                i = ask_int("type #", 1)
                if 1 <= i <= len(self.PDF_TYPES):
                    self.pdf_type = self.PDF_TYPES[i - 1]
                    ok("pdf listing type -> %s" % self.pdf_type)
            elif c == "2":
                self._pdf_list()
            elif c == "3":
                self._pdf_download()
            elif c == "4":
                self._pdf_save_meta()

    def _pdf_list(self):
        try:
            st, data = self._maybe_401(lambda: self.api.console("GET", "/pdfs/%s" % quote(self.pdf_type)))
        except (ApiError, ValueError, requests.RequestException) as e:
            err("pdf listing failed: %s" % e)
            return
        if st != 200:
            err("HTTP %s for /pdfs/%s" % (st, self.pdf_type))
            self._print_api_result(st, data, limit=500)
            return
        items = ensure_list(data)
        self.pdf_items = items
        print(bold("    /pdfs/%s - %d items" % (self.pdf_type, len(items))))
        for i, it in enumerate(items, 1):
            if isinstance(it, dict):
                print("   %2d  id %-10s %s" % (i, dim(str(it.get("id", "-"))),
                                              (it.get("title") or "")[:56]))
            else:
                print("   %2d  %s" % (i, dim(str(it)[:66])))

    def _pdf_dest(self, pid):
        folder = os.path.join(DL_ROOT, "pdfs", sanitize_filename(self.pdf_type, 40))
        os.makedirs(folder, exist_ok=True)
        return os.path.join(folder, sanitize_filename("pdf-%s" % pid) + ".pdf")

    def _pdf_download(self):
        pid = ask("pdf id", "")
        if not pid:
            return
        try:
            r = self.api.request("GET", "/pdfs/%s" % quote(pid))
        except (ApiError, requests.RequestException) as e:
            err("pdf fetch failed: %s" % e)
            return
        if r.status_code != 200:
            err("HTTP %s for pdf %s" % (r.status_code, pid))
            return
        ctype = (r.headers.get("content-type") or "").lower()
        dest = self._pdf_dest(pid)
        if "json" in ctype:
            # delivery returned a payload, not bytes -> find the file link
            # (documented: /pdfs/{id} delivery + /files/secure/{a}/{b} secure files)
            data = self.api.parse(r)
            url = ""
            if isinstance(data, dict):
                for k in ("url", "file", "file_url", "pdf_url", "download_url",
                          "secure_url", "path"):
                    if isinstance(data.get(k), str) and data[k]:
                        url = data[k]
                        break
            if not url:
                found = collect_pdfs(data)
                url = found[0] if found else ""
            if not url:
                err("pdf %s: JSON without a file link - saving metadata only" % pid)
                self._pdf_save_raw(pid, data)
                return
            note("pdf %s -> %s" % (pid, url[:100]))
            if url.startswith("http"):
                hdr = {"Authorization": "Bearer " + self.api.token} if self.api.token else None
                if ARIA2:
                    rc = aria2_download(url, dest, headers=hdr)
                else:
                    rc = requests_download(url, dest, headers=hdr)
                if rc == 0 and os.path.exists(dest) and os.path.getsize(dest) > 0:
                    ok("saved %s  (%s)" % (dest, fsize(os.path.getsize(dest))))
                    self._after_download(dest, "%s | pdf %s" % (self.pdf_type, pid))
                else:
                    err("download failed for pdf %s" % pid)
            else:
                # relative path (e.g. files/secure/{a}/{b}) -> Bearer fetch via the helper
                try:
                    r2 = self.api.request("GET", "/" + str(url).lstrip("/"))
                except (ApiError, requests.RequestException) as e:
                    err("secure file fetch failed: %s" % e)
                    return
                if r2.status_code == 200 and r2.content:
                    with open(dest, "wb") as f:
                        f.write(r2.content)
                    ok("saved %s  (%s)" % (dest, fsize(len(r2.content))))
                    self._after_download(dest, "%s | pdf %s" % (self.pdf_type, pid))
                else:
                    err("secure file HTTP %s for pdf %s" % (r2.status_code, pid))
        elif r.content:
            with open(dest, "wb") as f:
                f.write(r.content)
            ok("saved %s  (%s)" % (dest, fsize(len(r.content))))
            self._after_download(dest, "%s | pdf %s" % (self.pdf_type, pid))
        else:
            err("pdf %s: empty response" % pid)

    def _pdf_save_meta(self):
        try:
            st, data = self._maybe_401(lambda: self.api.console("GET", "/pdfs/%s" % quote(self.pdf_type)))
        except (ApiError, ValueError, requests.RequestException) as e:
            err("pdf listing failed: %s" % e)
            return
        if st != 200:
            err("HTTP %s - metadata not saved" % st)
            return
        folder = os.path.join(DL_ROOT, "pdfs")
        os.makedirs(folder, exist_ok=True)
        dest = os.path.join(folder, "%s_metadata.json" % sanitize_filename(self.pdf_type, 40))
        with open(dest, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        ok("listing metadata saved -> %s" % dest)

    def _pdf_save_raw(self, pid, data):
        """fallback when delivery is JSON-shaped and no link was recognized."""
        folder = os.path.join(DL_ROOT, "pdfs")
        os.makedirs(folder, exist_ok=True)
        dest = os.path.join(folder, "pdf-%s_response.json" % sanitize_filename(str(pid), 40))
        with open(dest, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        note("delivery shape unknown - raw response saved to %s (open it, then use menu 4 / manual console)" % dest)

    # ---------------- 9 settings
    def scr_settings(self):
        head("Settings")
        rows = [
            ("1", "phone", self.cfg["phone"]),
            ("2", "password", "********" if self.cfg["password"] else ""),
            ("3", "visitor_id", (self.cfg["visitor_id"] or "")[:12] + "..." if self.cfg["visitor_id"] else ""),
            ("4", "confidence", self.cfg["confidence"]),
            ("5", "prefer_quality", self.cfg["prefer_quality"]),
            ("6", "tg_api_id", self.cfg["tg_api_id"]),
            ("7", "tg_api_hash", (self.cfg["tg_api_hash"] or "")[:6] + "..."),
            ("8", "tg_group", self.cfg["tg_group"]),
            ("9", "tg_bot_token", (self.cfg["tg_bot_token"] or "")[:8] + "..."),
            ("10", "tg_as_document", self.cfg["tg_as_document"]),
            ("11", "drive_root", self.cfg["drive_root"]),
            ("12", "auto_drive", self.cfg["auto_drive"]),
            ("13", "auto_telegram", self.cfg["auto_telegram"]),
            ("14", "delete_after_upload", self.cfg["delete_after_upload"]),
            ("15", "keepalive", self.cfg["keepalive"]),
            ("16", "export config JSON (copy to another session)"),
            ("17", "import config JSON (paste)"),
            ("18", "reload config from disk"),
            ("19", "keepalive_interval (s)", self.cfg.get("keepalive_interval", 600)),
        ]
        for r in rows:
            print("   %-3s %-22s %s" % (r[0], cyan(r[1]), dim(str(r[2])) if len(r) > 2 else ""))
        c = ask("edit # (0 back)", "0")
        if c == "0":
            return
        if c == "1": self.cfg["phone"] = ask("phone", self.cfg["phone"])
        elif c == "2": self.cfg["password"] = ask("password", secret=True) or self.cfg["password"]
        elif c == "3":
            self.cfg["visitor_id"] = ask("visitorId", self.cfg["visitor_id"])
            self.cfg["confidence"] = float(ask("confidenceScore", str(self.cfg["confidence"])) or self.cfg["confidence"])
        elif c == "4": self.cfg["confidence"] = float(ask("confidenceScore", str(self.cfg["confidence"])) or 0.995)
        elif c == "5": self.cfg["prefer_quality"] = ask("quality best|1080|720|480|360", self.cfg["prefer_quality"])
        elif c == "6": self.cfg["tg_api_id"] = ask_int("api_id", self.cfg["tg_api_id"])
        elif c == "7": self.cfg["tg_api_hash"] = ask("api_hash", secret=True) or self.cfg["tg_api_hash"]
        elif c == "8": self.cfg["tg_group"] = ask("group id or @name", self.cfg["tg_group"])
        elif c == "9": self.cfg["tg_bot_token"] = ask("bot token", secret=True) or self.cfg["tg_bot_token"]
        elif c == "10": self.cfg["tg_as_document"] = not self.cfg["tg_as_document"]
        elif c == "11": self.cfg["drive_root"] = ask("drive root", self.cfg["drive_root"])
        elif c == "12": self.cfg["auto_drive"] = not self.cfg["auto_drive"]
        elif c == "13": self.cfg["auto_telegram"] = not self.cfg["auto_telegram"]
        elif c == "14": self.cfg["delete_after_upload"] = not self.cfg["delete_after_upload"]
        elif c == "15":
            self.cfg["keepalive"] = not self.cfg["keepalive"]
            if self.cfg["keepalive"]:
                self._start_keepalive()
            else:
                self._stop_keepalive()
        elif c == "16":
            export = dict(self.cfg)
            export["password"] = "***set***" if export.get("password") else ""
            print(json.dumps(export, indent=2))
            note("password redacted in the export above")
            return
        elif c == "17":
            raw = ask("paste config JSON", secret=True)
            try:
                j = json.loads(raw)
                for k in DEFAULT_CONFIG:
                    if k in j and j[k] not in (None, "") and j[k] != "***set***":
                        self.cfg[k] = j[k]
                save_config(self.cfg)
                self.api = ICTApi(self.cfg)
                self.drive = Drive(self.cfg)
                self.tg = Telegram(self.cfg)
                ok("config imported")
            except (ValueError, TypeError) as e:
                err("bad JSON: %s" % e)
            return
        elif c == "18":
            self.cfg = load_config()
            self.api = ICTApi(self.cfg)
            self.drive = Drive(self.cfg)
            self.tg = Telegram(self.cfg)
            ok("reloaded (keepalive keeps running against the reloaded session)")
            return
        elif c == "19":
            self.cfg["keepalive_interval"] = max(60, ask_int("interval seconds (>=60)",
                                                             int(self.cfg.get("keepalive_interval") or 600)))
            if self._keepalive:
                self._stop_keepalive()
                self._start_keepalive()
                note("keepalive restarted with the new interval")
        save_config(self.cfg)
        self.api.cfg = self.cfg
        self.drive.cfg = self.cfg
        self.tg.cfg = self.cfg
        ok("saved")


def make_tui():
    return TUI()


if __name__ == "__main__":
    tui = TUI()
    try:
        tui.run()
    except KeyboardInterrupt:
        print(dim("\nbye"))
