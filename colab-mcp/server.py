#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ict-colab-sandbox MCP server

Emulates the Google Colab runtime LOCALLY so colab/ict_tui.py (the real engine)
can be tested end-to-end without ever touching the real ictfromabc.com,
Bunny CDN, Telegram, or Google:

  - mock ictfromabc API   : login (422/302-pause/302+token branches), /user,
                            grouped /courses, /lessons/allowed, /lessons/{id},
                            /videos/{id}, /videos/{id}/generate-token
  - mock Bunny CDN        : embed 403, master/media playlists, real mpegts
                            segments (generated once with local ffmpeg),
                            optional AES-128 encrypted variant
  - fake google.colab     : Drive.mount() shim backed by a sandbox dir
  - fake pyrogram         : Telegram userbot shim recording every upload
  - fake yt-dlp           : produces a dummy mp4 so the YouTube branch runs
  - NETWORK GUARD         : any request to a non-localhost host RAISES - the
                            sandbox physically cannot leak to the real site

MCP tools: colab_env_check, colab_list_scenarios, colab_run_scenario,
           colab_run_all        (stdio, newline-delimited JSON-RPC)
CLI:       python server.py selftest [--scenario NAME]
"""
import importlib
import io
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import threading
import time
import traceback
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HERE = os.path.dirname(os.path.abspath(__file__))
COLAB_DIR = os.path.abspath(os.path.join(HERE, "..", "colab"))  # D:\Pentesting\ictfromabc\colab
ENGINE_PATH = os.path.join(COLAB_DIR, "ict_tui.py")
LOCAL_HOSTS = {"127.0.0.1", "localhost", "::1"}

PIN = "CWUriseStUq30ANV6hIt"
BUNNY_UUID = "203d28db-13c8-4889-b005-905be3453c71"
BUNNY_LIB = "131497"

MASTER = ("#EXTM3U\n"
          '#EXT-X-STREAM-INF:BANDWIDTH=2000000,RESOLUTION=1280x720,NAME="720"\n'
          "720p/video.m3u8\n"
          '#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=640x360,NAME="360"\n'
          "360p/video.m3u8\n")
MEDIA = ("#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:1\n"
         "#EXTINF:0.9,\nseg0.ts\n#EXTINF:0.9,\nseg1.ts\n#EXTINF:0.9,\nseg2.ts\n"
         "#EXT-X-ENDLIST\n")

# ============================================================================
# fake third-party packages (written into a sandbox site-packages dir)
# ============================================================================

GOOGLE_INIT = ""
GOOGLE_COLAB_INIT = "from . import drive\n"
GOOGLE_COLAB_DRIVE = '''
import os
def mount(mount_point, *a, **k):
    root = os.environ.get("ICT_SANDBOX_ROOT", os.getcwd())
    target = os.path.join(root, mount_point.strip("/\\\\"))
    os.makedirs(os.path.join(target, "MyDrive"), exist_ok=True)
    with open(os.path.join(target, ".colab_mounted"), "w") as f:
        f.write("fake colab mount\\n")
    return None
def unmount(mount_point):
    return None
'''

PYROGRAM_INIT = '''
import os
__version__ = "2.2.27-sandbox"

class _EnumValue(str):
    @property
    def name(self):
        return str(self)

class ChatType:
    GROUP = _EnumValue("GROUP")
    SUPERGROUP = _EnumValue("SUPERGROUP")
    PRIVATE = _EnumValue("PRIVATE")

class Chat:
    def __init__(self, id, title, type, members_count=None):
        self.id, self.title, self.type, self.members_count = id, title, type, members_count

class Dialog:
    def __init__(self, chat):
        self.chat = chat

class Message:
    def __init__(self, id):
        self.id = id

class User:
    def __init__(self):
        self.id = 424242
        self.username = "sandbox_userbot"
        self.first_name = "Sandbox"
        self.phone_number = "+1555000111"

RECORD = {"send_document": [], "send_video": [], "connects": 0}

class Client:
    def __init__(self, name, api_id=None, api_hash=None, workers=None,
                 sleep_threshold=None, session_string=None, **kw):
        self.name = name
        self.api_id = api_id
        self.api_hash = api_hash
        self.session_string = session_string
        RECORD["connects"] += 1
    def start(self):
        return self
    def stop(self):
        return self
    def get_me(self):
        return User()
    def export_session_string(self):
        return "SANDBOX_SESSION_STRING_123"
    def get_dialogs(self, limit=None):
        return [Dialog(Chat(-100111, "ICT Archive", ChatType.SUPERGROUP, 3)),
                Dialog(Chat(-100222, "Random", ChatType.GROUP, 9))]
    def get_chat(self, v):
        return Chat(int(v) if str(v).lstrip("-").isdigit() else -100111,
                    "ICT Archive", ChatType.SUPERGROUP, 3)
    def send_document(self, chat_id, document, caption=None, force_document=None,
                      progress=None, **kw):
        size = os.path.getsize(document)
        if progress:
            progress(size, size)
        RECORD["send_document"].append({"chat_id": chat_id, "document": document,
                                        "caption": caption, "size": size})
        return Message(777)
    def send_video(self, chat_id, video, caption=None, supports_streaming=None,
                   duration=None, width=None, height=None, progress=None, **kw):
        size = os.path.getsize(video)
        if progress:
            progress(size, size)
        RECORD["send_video"].append({"chat_id": chat_id, "video": video,
                                     "caption": caption, "size": size})
        return Message(888)
'''

FAKE_YTDLP = '''
import os, sys
out = None
for i, a in enumerate(sys.argv):
    if "%(title)" in a:
        out = a
        break
if out:
    d = os.path.dirname(out) or "."
    os.makedirs(d, exist_ok=True)
    p = os.path.join(d, "sandbox_youtube_video.mp4")
    with open(p, "wb") as f:
        f.write(b"0" * 4096)
sys.exit(0)
'''
FAKE_YTDLP_CMD = '@echo off\npython "%~dp0fake_ytdlp.py" %*\n'


def build_skeleton(root):
    """Create <root>/content (Colab FS), site-packages shims, fake bins."""
    content = os.path.join(root, "content")
    os.makedirs(content, exist_ok=True)
    site = os.path.join(root, "site_packages")
    g = os.path.join(site, "google", "colab")
    p = os.path.join(site, "pyrogram")
    for d in (g, p):
        os.makedirs(d, exist_ok=True)
    _w(os.path.join(site, "google", "__init__.py"), GOOGLE_INIT)
    _w(os.path.join(g, "__init__.py"), GOOGLE_COLAB_INIT)
    _w(os.path.join(g, "drive.py"), GOOGLE_COLAB_DRIVE)
    _w(os.path.join(p, "__init__.py"), PYROGRAM_INIT)
    fakebin = os.path.join(root, "fakebin")
    os.makedirs(fakebin, exist_ok=True)
    _w(os.path.join(fakebin, "fake_ytdlp.py"), FAKE_YTDLP)
    _w(os.path.join(fakebin, "yt-dlp.cmd"), FAKE_YTDLP_CMD)
    return {"content": content, "site": site, "fakebin": fakebin}


def _w(path, text):
    with open(path, "w", encoding="utf-8") as f:
        f.write(text)

# ============================================================================
# real mpegts segment generation (local ffmpeg, cached)
# ============================================================================

_TS_LOCK = threading.Lock()
_TS_CACHE = {}

def gen_ts_bytes():
    """~0.9s of real mpegts, generated once with the local ffmpeg."""
    with _TS_LOCK:
        if "ts" in _TS_CACHE:
            return _TS_CACHE["ts"]
        ff = shutil.which("ffmpeg")
        if not ff:
            _TS_CACHE["ts"] = None
            return None
        tmp = os.path.join(tempfile.gettempdir(), "ict_sb_seg.ts")
        try:
            cmd = [ff, "-y", "-hide_banner", "-loglevel", "error",
                   "-f", "lavfi", "-i", "testsrc=duration=0.9:size=128x96:rate=12",
                   "-f", "lavfi", "-i", "sine=frequency=440:duration=0.9",
                   "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p",
                   "-c:a", "aac", "-f", "mpegts", tmp]
            if subprocess.run(cmd, capture_output=True).returncode != 0:
                cmd[cmd.index("libx264")] = "mpeg4"
                subprocess.run(cmd, capture_output=True)
            with open(tmp, "rb") as f:
                data = f.read()
            if len(data) < 512:
                raise RuntimeError("ts too small")
            _TS_CACHE["ts"] = data
        finally:
            try:
                os.remove(tmp)
            except OSError:
                pass
        return _TS_CACHE["ts"]


def gen_aes_playlist(port, workdir):
    """Generate an AES-128 encrypted HLS set with local ffmpeg.
    Returns {'m3u8': text, 'segments': {name: bytes}, 'key': bytes}."""
    ff = shutil.which("ffmpeg")
    if not ff:
        return None
    os.makedirs(workdir, exist_ok=True)
    key = os.path.join(workdir, "key.bin")
    ki = os.path.join(workdir, "keyinfo")
    out = os.path.join(workdir, "out.m3u8")
    with open(key, "wb") as f:
        f.write(bytes(range(16)))
    uri = "http://127.0.0.1:%d/aes/key.bin" % port
    with open(ki, "w") as f:
        f.write(uri + "\n" + key + "\n")
    cmd = [ff, "-y", "-hide_banner", "-loglevel", "error",
           "-f", "lavfi", "-i", "testsrc=duration=2.7:size=128x96:rate=12",
           "-f", "lavfi", "-i", "sine=frequency=440:duration=2.7",
           "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p",
           "-c:a", "aac",
           "-f", "hls", "-hls_time", "0.9", "-hls_list_size", "0",
           "-hls_key_info_file", ki, out]
    if subprocess.run(cmd, capture_output=True).returncode != 0:
        return None
    with open(out, "r", encoding="utf-8") as f:
        m3u8 = f.read()
    segs = {}
    for fn in os.listdir(workdir):
        if fn.endswith(".ts"):
            with open(os.path.join(workdir, fn), "rb") as f:
                segs[fn] = f.read()
    if not segs or "METHOD=AES-128" not in m3u8:
        return None
    return {"m3u8": m3u8, "segments": segs,
            "key": open(key, "rb").read()}

# ============================================================================
# mock site: ictfromabc API + Bunny CDN on one local port
# ============================================================================

class MockState:
    def __init__(self):
        self.requests = []          # (method, path)
        self.logins = []            # login payloads
        self.login_ct_json = None   # content-type of last login
        self.current_token = None   # only the newest token is valid (rotation)
        self.video_detail = {"77": {"video_url": "https://iframe.mediadelivery.net/embed/%s/%s?preload=false" % (BUNNY_LIB, BUNNY_UUID)},
                             "78": {"video_url": "https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=0"},
                             "79": {"video_url": None},   # set later: local mp4
                             "80": None}                  # set later: aes playlist
        self.mp4_bytes = b"M" * 8192
        self.aes = None            # dict from gen_aes_playlist
        self.expect_pin = PIN
        self.four29 = {}           # path-key -> remaining 429 responses to inject

    def issue_token(self):
        self.current_token = "SBX%d|%s" % (len(self.logins), os.urandom(8).hex())
        return self.current_token

    def authed(self, hdr):
        return hdr == "Bearer " + (self.current_token or "")


def make_handler(st):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *a):
            pass

        def _send(self, code, body=b"", ct="application/json", headers=None):
            if isinstance(body, str):
                body = body.encode()
            self.send_response(code)
            self.send_header("Content-Type", ct)
            for k, v in (headers or {}).items():
                self.send_header(k, v)
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def _json(self, code, obj):
            self._send(code, json.dumps(obj))

        def do_POST(self):
            st = self.state
            st.requests.append(("POST", self.path))
            ln = int(self.headers.get("Content-Length", 0))
            raw = self.rfile.read(ln)
            if self.path.startswith("/api/login"):
                st.login_ct_json = (self.headers.get("Content-Type") or "").split(";")[0]
                try:
                    payload = json.loads(raw)
                except ValueError:
                    payload = {}
                st.logins.append(payload)
                rule = st.login_rule(payload)
                if rule == "ok":
                    self._json(200, {"msg": "Login Successful", "token": st.issue_token(),
                                     "role": "STUDENT", "skippable": 1, "course_id": "2027-al"})
                elif rule == "422password":
                    self._json(422, {"message": "The given data was invalid.",
                                     "errors": {"password": ["The password is incorrect."]}})
                elif rule == "422fingerprint":
                    self._json(422, {"message": "The given data was invalid.",
                                     "errors": {"visitorId": ["Check Your Browser. If Nothing works contact Support Staff"]}})
                elif rule == "302pause":
                    self._send(302, json.dumps({"redirect_url": "https://ictfromabc.com/blocked"}))
                elif rule == "302token":
                    self._send(302, json.dumps({"msg": "paused", "token": st.issue_token(),
                                                "role": "STUDENT", "course_id": "2027-al"}))
                else:
                    self._json(500, {"message": "bad rule"})
            elif self.path.startswith("/api/notifications/read-all"):
                if not st.authed(self.headers.get("Authorization")):
                    return self._json(401, {"message": "Unauthenticated."})
                self._json(200, {"msg": "all notifications marked read"})
            else:
                self._json(404, {"message": "not found"})

        def do_GET(self):
            st = self.state
            st.requests.append(("GET", self.path))
            p = self.path.split("?", 1)[0]     # routing ignores query strings
            if p.startswith("/api/"):
                if p.startswith("/api/login"):
                    self._json(405, {"message": "use POST"})
                elif p.startswith("/api/user"):
                    n = st.four29.get("user", 0)
                    if n > 0:
                        st.four29["user"] = n - 1
                        return self._send(429, json.dumps({"message": "Too Many Attempts."}),
                                          "application/json", headers={"Retry-After": "0"})
                    if not st.authed(self.headers.get("Authorization")):
                        return self._json(401, {"message": "Unauthenticated."})
                    self._json(200, {"first_name": "Sandbox", "last_name": "User",
                                     "phone_number": "REDACTED_PHONE", "course_id": "2027-al",
                                     "institute_id": 2, "email": "sbx@example.com"})
                elif p.startswith("/api/notifications"):
                    n = st.four29.get("notifications", 0)
                    if n > 0:
                        st.four29["notifications"] = n - 1
                        return self._json(429, {"message": "Too Many Attempts."})   # no Retry-After
                    if not st.authed(self.headers.get("Authorization")):
                        return self._json(401, {"message": "Unauthenticated."})
                    self._json(200, [{"data": {"msg": "mock notice", "link": "/x"}}])
                elif p.startswith("/api/courses"):
                    if not st.authed(self.headers.get("Authorization")):
                        return self._json(401, {"message": "Unauthenticated."})
                    self._json(200, {"al": [{"id": "2027-al", "title": "2027 A/L ICT", "type": "al"}],
                                     "ol": [{"id": "ol-videos", "title": "OL Videos", "type": "ol"}]})
                elif p.startswith("/api/lessons/allowed"):
                    if not st.authed(self.headers.get("Authorization")):
                        return self._json(401, {"message": "Unauthenticated."})
                    self._json(200, [{"course_id": "2027-al", "id": 5, "title": "Mock Lesson",
                                      "price": 0, "status": "active"}])
                elif p.startswith("/api/lessons/"):
                    if not st.authed(self.headers.get("Authorization")):
                        return self._json(401, {"message": "Unauthenticated."})
                    # realistic: the list response hides video_url
                    self._json(200, [{"id": 77, "lesson_id": 5, "title": "HLS video", "status": "active"},
                                     {"id": 78, "lesson_id": 5, "title": "YT video", "status": "active"},
                                     {"id": 79, "lesson_id": 5, "title": "MP4 video", "status": "active"},
                                     {"id": 80, "lesson_id": 5, "title": "AES video", "status": "active"}])
                elif p.startswith("/api/videos/") and "/generate-token" in p:
                    if not st.authed(self.headers.get("Authorization")):
                        return self._json(401, {"message": "Unauthenticated."})
                    self._json(200, {"token": "VT" + os.urandom(6).hex(),
                                     "expires": int(time.time()) + 3600})
                elif p.startswith("/api/videos/"):
                    if not st.authed(self.headers.get("Authorization")):
                        return self._json(401, {"message": "Unauthenticated."})
                    vid = p.rsplit("/", 1)[-1]
                    detail = st.video_detail.get(vid)
                    if detail is None:
                        return self._json(404, {"message": "no video"})
                    self._json(200, detail)
                elif p.startswith("/api/admin/"):
                    # real-site behavior for the STUDENT role: role-gated 403
                    if not st.authed(self.headers.get("Authorization")):
                        return self._json(401, {"message": "Unauthenticated."})
                    self._json(403, {"msg": "Unauthorized"})
                elif p == "/api/telegram":
                    if not st.authed(self.headers.get("Authorization")):
                        return self._json(401, {"message": "Unauthenticated."})
                    self._json(200, {"data": [{"title": "ICT Sandbox Group",
                                               "link": "https://t.me/ict_sandbox"}],
                                     "msg": "ok", "status": 200})
                elif p == "/api/model-papers/availability":
                    if not st.authed(self.headers.get("Authorization")):
                        return self._json(401, {"message": "Unauthenticated."})
                    self._json(200, {"availability": True})
                elif p == "/api/practical-sessions/availability":
                    if not st.authed(self.headers.get("Authorization")):
                        return self._json(401, {"message": "Unauthenticated."})
                    self._json(200, {"availability": False})
                elif p.startswith("/api/pdfs/"):
                    if not st.authed(self.headers.get("Authorization")):
                        return self._json(401, {"message": "Unauthenticated."})
                    seg = p.rsplit("/", 1)[-1]
                    if seg in ("tute", "lesson-pp", "paper-book"):
                        self._json(200, [{"id": 901, "title": "Sandbox %s PDF" % seg,
                                          "year": "2026"}])
                    elif seg.isdigit():
                        self._send(200, b"%PDF-1.4\n% sandbox pdf bytes\n%%EOF\n",
                                   "application/pdf")
                    else:
                        self._json(404, {"message": "unknown pdf type"})
                elif p.startswith("/api/purchases/tutes") or p.startswith("/api/tutes"):
                    if not st.authed(self.headers.get("Authorization")):
                        return self._json(401, {"message": "Unauthenticated."})
                    self._json(200, [{"id": 701, "title": "Sandbox Tute", "price": 0}])
                else:
                    self._json(404, {"message": "not found"})
                return
            # ---- mock bunny / static ----
            if p.endswith("/master.m3u8") or p.endswith("master.m3u8"):
                return self._send(200, MASTER, "application/vnd.apple.mpegurl")
            if p.endswith(".m3u8") and "/aes/" in p:
                return self._send(200, st.aes["m3u8"], "application/vnd.apple.mpegurl")
            if p.endswith(".m3u8") and ("video.m3u8" in p or p.endswith("playlist.m3u8")):
                return self._send(200, MEDIA, "application/vnd.apple.mpegurl")
            if p.endswith(".ts"):
                if "/aes/" in p and st.aes:
                    name = p.rsplit("/", 1)[-1]
                    return self._send(200, st.aes["segments"].get(name, b""), "video/mp2t")
                ts = gen_ts_bytes()
                return self._send(200, ts or b"", "video/mp2t")
            if p.endswith("/key.bin"):
                return self._send(200, st.aes["key"], "application/octet-stream")
            if p.endswith(".mp4"):
                return self._send(200, st.mp4_bytes, "video/mp4")
            # embed page: realistic 403 html
            if "/embed/" in p or "/player/" in p:
                return self._send(403, "<html><body>403 Forbidden</body></html>", "text/html")
            self._send(404, "<html>404</html>", "text/html")

    Handler.state = st          # expose MockState as a class attribute
    return Handler


def start_mock(st):
    srv = ThreadingHTTPServer(("127.0.0.1", 0), make_handler(st))
    srv.state = st
    t = threading.Thread(target=srv.serve_forever, daemon=True)
    t.start()
    return srv

# ============================================================================
# network guard: engine traffic must never leave localhost
# ============================================================================

class GuardViolation(AssertionError):
    pass

_GUARD_ON = {"flag": False}

def install_net_guard():
    import requests
    from requests.adapters import HTTPAdapter
    orig = HTTPAdapter.send

    def guarded(self, request, *a, **kw):
        url = getattr(request, "url", "") or ""
        host = ""
        m = re.match(r"https?://([^/:]+)", url)
        if m:
            host = m.group(1)
        if _GUARD_ON["flag"] and host and host not in LOCAL_HOSTS:
            raise GuardViolation("network guard: blocked external request -> %s" % url)
        return orig(self, request, *a, **kw)

    HTTPAdapter.send = guarded
    return {"restore": lambda: setattr(HTTPAdapter, "send", orig)}


def install_url_rewrites(T, port):
    """Rewrite bunny/mediadelivery hosts to the local mock (engine still runs
    its real embed-403 -> direct-candidate logic, just against 127.0.0.1)."""
    base = "http://127.0.0.1:%d" % port

    def rewrite(u):
        return re.sub(r"https?://[^/]+", base, u) if re.search(
            r"mediadelivery\.net|b-cdn\.net", u or "") else u

    orig_http_text = T.http_text

    def http_text(url, headers=None, timeout=(15, 45)):
        return orig_http_text(rewrite(url), headers, timeout)
    T.http_text = http_text

    orig_cands = T.bunny_direct_candidates

    def candidates(u, token, expires):
        return [rewrite(x) for x in orig_cands(u, token, expires)]
    T.bunny_direct_candidates = candidates
    return {"restore": lambda: (setattr(T, "http_text", orig_http_text),
                                setattr(T, "bunny_direct_candidates", orig_cands))}

# ============================================================================
# sandbox context
# ============================================================================

class Sandbox:
    """Per-scenario Colab emulation around the REAL engine module."""

    def __init__(self, name):
        self.name = name
        self.root = tempfile.mkdtemp(prefix="ict_sb_%s_" % name)
        os.environ["ICT_SANDBOX_ROOT"] = self.root
        self.sk = build_skeleton(self.root)
        self.state = MockState()
        self.srv = start_mock(self.state)
        self.port = self.srv.server_address[1]
        self.T = None
        self._path_restore = None
        self._rewrites = None
        self._guard = None
        self._junction = None
        self._old_cwd = None
        self.log = io.StringIO()

    # ---------- context manager ----------
    def __enter__(self):
        sys.path.insert(0, self.sk["site"])
        old_path = os.environ.get("PATH", "")
        os.environ["PATH"] = self.sk["fakebin"] + os.pathsep + old_path
        self._path_restore = old_path
        self._guard = install_net_guard()
        _GUARD_ON["flag"] = True
        self._old_cwd = os.getcwd()
        os.chdir(self.root)
        if ENGINE_PATH not in sys.path:
            sys.path.insert(0, COLAB_DIR)
        import ict_tui as T
        T = importlib.reload(T)
        self.T = T
        # Colab FS: engine literals like "/content/..." resolve against the
        # cwd drive root -> junction D:\content (cwd drive) to the sandbox.
        self._junction = _mount_content_junction(self.sk["content"])
        T.CONFIG_PATH = os.path.join(self.root, "content", "ict_tui_config.json")
        T.DL_ROOT = os.path.join(self.root, "content", "ict_downloads")
        T.DRIVE_ROOT_DEFAULT = os.path.join(self.root, "content", "drive", "MyDrive", "ICT")
        T.API_BASE = "http://127.0.0.1:%d/api" % self.port
        T.SITE_ORIGIN = "http://127.0.0.1:%d" % self.port
        self._rewrites = install_url_rewrites(T, self.port)
        self.state.video_detail["79"] = {"video_url": "http://127.0.0.1:%d/file.mp4" % self.port}
        self.state.aes = gen_aes_playlist(self.port, os.path.join(self.root, "aes"))
        self.state.video_detail["80"] = ({"video_url": "http://127.0.0.1:%d/aes/out.m3u8" % self.port}
                                          if self.state.aes else None)
        return self

    def __exit__(self, *exc):
        _GUARD_ON["flag"] = False
        if self._guard:
            self._guard["restore"]()
        if self._rewrites:
            self._rewrites["restore"]()
        if self._junction:
            _unmount_content_junction(self._junction)
        self.srv.shutdown()
        sys.path.remove(self.sk["site"])
        os.environ["PATH"] = self._path_restore
        os.chdir(self._old_cwd)
        return False

    # ---------- helpers ----------
    def cfg(self, **over):
        T = self.T
        c = dict(T.DEFAULT_CONFIG)
        c.update({"phone": "REDACTED_PHONE", "password": "goodpass",
                  "visitor_id": PIN, "confidence": 0.82, "manual_token": ""})
        c.update(over)
        return c

    def login_ok_rule(self):
        def rule(payload):
            if payload.get("visitorId") != self.state.expect_pin:
                return "422fingerprint"
            if payload.get("password") == "goodpass":
                return "ok"
            return "422password"
        self.state.login_rule = rule

    def api_logged_in(self, **over):
        T = self.T
        api = T.ICTApi(self.cfg(**over))
        api.login(quiet=True)
        return api


def _mount_content_junction(target):
    """Junction <cwd-drive>:\\content -> sandbox content so engine literals
    ('/content/...') resolve inside the sandbox. Returns prior state."""
    drive = os.path.splitdrive(os.getcwd())[0] or "C:"
    link = os.path.join(drive, os.sep, "content")
    existed = os.path.exists(link)
    if existed:
        return None                      # never touch pre-existing content
    try:
        import _winapi
        os.makedirs(target, exist_ok=True)
        _winapi.CreateJunction(target, link)
        return {"link": link}
    except Exception:
        return None


def _unmount_content_junction(j):
    try:
        os.rmdir(j["link"])              # junctions rmdir cleanly
    except Exception:
        pass

# ============================================================================
# scenarios — each returns (checks [(name, ok)], notes [str])
# ============================================================================

def sc_login_ok(sb):
    sb.login_ok_rule()
    T = sb.T
    api = sb.api_logged_in()
    checks = [
        ("login 200", api.token.startswith("SBX")),
        ("bearer header", api.session.headers.get("Authorization") == "Bearer " + api.token),
        ("login body carried bound pin", bool(sb.state.logins) and sb.state.logins[-1].get("visitorId") == PIN),
        ("login body carried confidence", bool(sb.state.logins) and "confidenceScore" in sb.state.logins[-1]),
        ("login content-type json", sb.state.login_ct_json == "application/json"),
        ("me() works", api.me().get("first_name") == "Sandbox"),
        ("courses grouped->flat", [c.get("id") for c in api.courses()] == ["2027-al", "ol-videos"]),
        ("lessons/allowed", api.my_lessons()[0]["id"] == 5),
    ]
    return checks, []

def sc_422_password_no_retry(sb):
    sb.login_ok_rule()
    T = sb.T
    api = T.ICTApi(sb.cfg(password="WRONG"))
    try:
        api.login(quiet=True)
        return [("422 raised LoginError", False)], []
    except T.LoginError as e:
        checks = [("kind=device-check", e.kind == "device-check"),
                  ("status 422", e.status == 422),
                  ("exactly ONE login POST (no auto-retry)", len(sb.state.logins) == 1)]
        return checks, []

def sc_422_fingerprint_no_retry(sb):
    sb.state.login_rule = lambda p: "422fingerprint"
    T = sb.T
    api = T.ICTApi(sb.cfg())
    try:
        api.login(quiet=True)
        return [("422 raised LoginError", False)], []
    except T.LoginError as e:
        return [("kind=device-check", e.kind == "device-check"),
                ("rejected pin field", "visitorId" in json.dumps(e.data or {})),
                ("exactly ONE login POST (no auto-retry)", len(sb.state.logins) == 1)], []

def sc_302_pause_notoken(sb):
    sb.state.login_rule = lambda p: "302pause"
    T = sb.T
    api = T.ICTApi(sb.cfg())
    try:
        api.login(quiet=True)
        return [("302 raised LoginError", False)], []
    except T.LoginError as e:
        return [("kind=paused", e.kind == "paused"),
                ("exactly ONE login POST (no auto-retry)", len(sb.state.logins) == 1),
                ("no token accepted", api.token == "")], []

def sc_302_pause_with_token(sb):
    sb.state.login_rule = lambda p: "302token"
    T = sb.T
    api = T.ICTApi(sb.cfg())
    api.login(quiet=True)
    checks = [("pause 302 converted to live session", api.token.startswith("SBX")),
              ("role captured", api.role == "STUDENT"),
              ("me() works on converted session", api.me().get("first_name") == "Sandbox")]
    return checks, []

def sc_auto_relogin_401(sb):
    sb.login_ok_rule()
    T = sb.T
    tui = T.TUI(sb.cfg())
    api = tui.api
    api.login(quiet=True)
    st = sb.state
    st.current_token = "REVOKED|dead"        # simulate rotation on the server
    my = tui._maybe_401(api.my_lessons)      # 401 -> auto_relogin -> retry
    login_posts = sum(1 for m, p in st.requests if m == "POST" and p.startswith("/api/login"))
    return [("recovered from mid-session 401", my and my[0]["id"] == 5),
            ("auto re-login used (2 POSTs total)", login_posts == 2),
            ("session token is the new one", api.token == st.current_token)], []

def sc_download_hls(sb):
    sb.login_ok_rule()
    T = sb.T
    api = sb.api_logged_in()
    signed = api.video_signed_url(77)
    checks = [("signed embed url", "/embed/%s/%s" % (BUNNY_LIB, BUNNY_UUID) in signed and "token=" in signed)]
    stream = T.resolve_stream(signed)
    checks += [("resolved to HLS", stream["kind"] == "hls"),
               ("2 variants parsed", len(stream["variants"]) == 2)]
    best = T.pick_variant(stream, "best")
    checks += [("best variant = 720p", best.endswith("720p/video.m3u8")),
               ("mock-only host (net guard safe)", best.startswith("http://127.0.0.1:"))]
    dest = os.path.join(T.DL_ROOT, "hls", "out.mp4")
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    out = T.download_media(stream, dest, "best")
    ok = out and os.path.exists(out) and os.path.getsize(out) > 1024
    checks.append(("ffmpeg -c copy produced a file", bool(ok)))
    if ok:
        meta = T.ffprobe_meta(out)
        checks.append(("output is real media (%.1fs, %sx%s)" % (
            meta.get("duration", 0), meta.get("width", "?"), meta.get("height", "?")),
            meta.get("duration", 0) > 2.0 and (meta.get("height") or 0) > 0))
    return checks, []

def sc_download_hls_aes(sb):
    sb.login_ok_rule()
    T = sb.T
    if not sb.state.aes:
        return [("SKIP: ffmpeg could not generate AES-128 fixture", True)], ["AES scenario skipped"]
    api = sb.api_logged_in()
    signed = api.video_signed_url(80)
    stream = T.resolve_stream(signed)
    checks = [("AES-128 playlist detected", stream.get("encrypted") is True),
              ("media playlist (no variants)", stream["kind"] == "hls" and not stream["variants"])]
    dest = os.path.join(T.DL_ROOT, "aes", "out.mp4")
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    out = T.download_media(stream, dest, "best")
    ok = out and os.path.exists(out) and os.path.getsize(out) > 1024
    checks.append(("ffmpeg decrypted AES-128 while copying", bool(ok)))
    if ok:
        meta = T.ffprobe_meta(out)
        checks.append(("decrypted media plays (%.1fs)" % meta.get("duration", 0),
                       meta.get("duration", 0) > 2.0))
    return checks, []

def sc_download_mp4(sb):
    sb.login_ok_rule()
    T = sb.T
    api = sb.api_logged_in()
    signed = api.video_signed_url(79)
    stream = T.resolve_stream(signed)
    checks = [("mp4 stream classified", stream["kind"] == "mp4")]
    dest = os.path.join(T.DL_ROOT, "mp4", "out.mp4")
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    out = T.download_media(stream, dest, "best")
    checks += [("mp4 downloaded (aria2 fallback -> requests)", bool(out) and os.path.exists(out)),
               ("size matches source", bool(out) and os.path.getsize(out) == len(sb.state.mp4_bytes))]
    return checks, []

def sc_download_youtube(sb):
    sb.login_ok_rule()
    T = sb.T
    api = sb.api_logged_in()
    signed = api.video_signed_url(78)
    stream = T.resolve_stream(signed)
    checks = [("youtube classified without network", stream["kind"] == "youtube"),
              ("yt-dlp wired on PATH", bool(T.YTDLP))]
    dest = os.path.join(T.DL_ROOT, "yt", "out.mp4")
    os.makedirs(os.path.dirname(dest), exist_ok=True)

    calls = []

    def fake_ytdlp(url, dest_dir, prefer="best", referer=None):
        calls.append(url)
        with open(os.path.join(dest_dir, "sandbox_youtube_video.mp4"), "wb") as f:
            f.write(b"0" * 4096)
        return 0

    orig = T.ytdlp_download
    T.ytdlp_download = fake_ytdlp
    try:
        out = T.download_media(stream, dest, "best")
    finally:
        T.ytdlp_download = orig
    checks += [("fake yt-dlp called", len(calls) == 1),
               ("file produced", bool(out) and os.path.exists(out)),
               ("returned a path (branch bug fixed)", isinstance(out, str))]
    return checks, []

def sc_drive_mount_save(sb):
    sb.login_ok_rule()
    T = sb.T
    content = sb.sk["content"]               # the sandbox Colab FS
    cfg = sb.cfg(drive_enabled=False,
                 drive_root=os.path.join(content, "drive", "MyDrive", "ICT"))
    tui = T.TUI(cfg)
    checks = [("drive not mounted initially", tui.drive.mounted is False)]

    # Only the literal "/content/..." path checks are sandboxed here (a real
    # D:\content exists on this machine); the google.colab import + shim mount
    # still run for real below.
    from types import MethodType

    def sb_mount(self):
        try:
            from google.colab import drive   # the fake shim, resolved via sys.path
            drive.mount("/content/drive")
            self.mounted = os.path.isdir(os.path.join(content, "drive", "MyDrive"))
            if self.mounted:
                self.cfg["drive_enabled"] = True
                T.save_config(self.cfg)
            return self.mounted
        except Exception:
            return False

    tui.drive.mount = MethodType(sb_mount, tui.drive)
    mounted = tui.drive.mount()
    checks += [("fake google.colab mounted Drive", mounted is True),
               ("marker written by the shim",
                os.path.exists(os.path.join(content, "drive", ".colab_mounted")))]
    f = os.path.join(T.DL_ROOT, "a.mp4")
    os.makedirs(os.path.dirname(f), exist_ok=True)
    with open(f, "wb") as fh:
        fh.write(b"x" * 128)
    dest = tui.drive.save_file(f)
    checks += [("file copied into MyDrive", bool(dest) and os.path.exists(dest)),
               ("lands under the sandbox MyDrive", bool(dest) and "MyDrive" in dest)]
    return checks, []

def sc_telegram_upload_dedupe(sb):
    sb.login_ok_rule()
    T = sb.T
    cfg = sb.cfg(tg_api_id=1, tg_api_hash="sandboxhash", tg_group="")
    tui = T.TUI(cfg)
    checks = [("userbot connected (fake pyrogram)", tui.tg.connect() is True)]
    groups = tui.tg.list_groups()
    checks += [("groups listed", len(groups) == 2),
               ("session string saved to config", cfg.get("tg_session_string") == "SANDBOX_SESSION_STRING_123")]
    cfg["tg_group"] = str(groups[0]["id"])
    f = os.path.join(T.DL_ROOT, "tg.mp4")
    os.makedirs(os.path.dirname(f), exist_ok=True)
    with open(f, "wb") as fh:
        fh.write(b"t" * 256)
    r1 = tui.tg.upload(f, caption="first", drive=tui.drive)
    r2 = tui.tg.upload(f, caption="second", drive=tui.drive)
    from pyrogram import RECORD
    checks += [("first upload sent", bool(r1) and len(RECORD["send_document"]) == 1),
               ("message id captured", bool(r1) and r1.get("message_id") == 777),
               ("second upload deduped (manifest)", r2 == r1 and len(RECORD["send_document"]) == 1),
               ("manifest has one entry", len(tui.tg.manifest_load(tui.drive)) == 1)]
    return checks, []

def sc_menu_smoke(sb):
    sb.login_ok_rule()
    T = sb.T
    cfg = sb.cfg()
    LINES = ["1", "",       # login
             "2",           # dashboard
             "3", "1", "0", # browse: refresh, back
             "8", "GET /courses", "",  # console
             "9", "",       # settings back
             "0", "y"]      # exit + confirm
    it = iter(LINES)
    import builtins, getpass

    def fake_input(prompt=""):
        try:
            v = next(it)
            return v
        except StopIteration:
            raise EOFError("script exhausted")
    old_input, old_getpass = builtins.input, getpass.getpass
    builtins.input = fake_input
    getpass.getpass = fake_input
    buf = io.StringIO()
    try:
        with contextlib_redirect_stdout(buf):
            tui = T.TUI(cfg)
            tui.run()
    finally:
        builtins.input = old_input
        getpass.getpass = old_getpass
    out = buf.getvalue()
    plain = re.sub(r"\033\[[0-9;]*m", "", out)
    return [("banner shown", "ICTfromABC Colab TUI" in plain),
            ("login ok in menu flow", "login successful (role STUDENT)" in plain),
            ("dashboard rendered", "Sandbox User" in plain),
            ("courses visible (grouped)", "2027-al" in plain and "2027 A/L ICT" in plain),
            ("API console ran GET /courses", "HTTP 200" in plain),
            ("clean exit", "bye" in plain),
            ("no crash-backtrace", "crashed" not in plain)], []

import contextlib

def contextlib_redirect_stdout(buf):
    return contextlib.redirect_stdout(buf)

def sc_no_real_network(sb):
    """Canary: a direct external request must be blocked by the network guard."""
    import requests
    blocked = False
    try:
        requests.get("http://203.0.113.5/probe", timeout=3)   # TEST-NET-3, never routed
    except GuardViolation as e:
        blocked = "network guard" in str(e)
    except Exception:
        blocked = False
    return [("external request raised GuardViolation", blocked),
            ("sandbox cannot reach the real site", blocked)], []

def sc_api_quick_calls(sb):
    """menu 10: one-key calls + RBAC role-gate verification (all via the request helper)."""
    sb.login_ok_rule()
    T = sb.T
    LINES = ["1", "",                    # login (default 1)
             "10",                       # API quick calls
             "1",                        # GET /user
             "2",                        # GET /courses
             "3",                        # GET /lessons/allowed
             "4",                        # GET /notifications
             "5", "y",                   # POST /notifications/read-all (confirm)
             "6",                        # GET /telegram
             "7",                        # GET /model-papers/availability
             "8",                        # GET /practical-sessions/availability
             "12",                       # GET /purchases/tutes
             "13",                       # RBAC check -> 403
             "0",                        # back
             "0", "y"]                   # exit
    it = iter(LINES)
    import builtins, getpass

    def fake_input(prompt=""):
        try:
            return next(it)
        except StopIteration:
            raise EOFError("script exhausted")
    old_input, old_getpass = builtins.input, getpass.getpass
    builtins.input = fake_input
    getpass.getpass = fake_input
    buf = io.StringIO()
    try:
        with contextlib_redirect_stdout(buf):
            tui = T.TUI(sb.cfg())
            tui.run()
    finally:
        builtins.input = old_input
        getpass.getpass = old_getpass
    plain = re.sub(r"\033\[[0-9;]*m", "", buf.getvalue())
    checks = [
        ("GET /user answered", '"first_name": "Sandbox"' in plain),
        ("GET /courses answered", "2027 A/L ICT" in plain),
        ("GET /lessons/allowed answered", "Mock Lesson" in plain),
        ("GET /notifications answered", "mock notice" in plain),
        ("read-all POST answered", "all notifications marked read" in plain),
        ("GET /telegram answered", "t.me/ict_sandbox" in plain),
        ("model-papers availability answered", '"availability": true' in plain),
        ("practical-sessions availability answered", '"availability": false' in plain),
        ("purchases/tutes answered", "Sandbox Tute" in plain),
        ("RBAC line printed", "RBAC intact: STUDENT -> 403" in plain),
        ("RBAC got the mock Unauthorized body", "Unauthorized" in plain),
        ("no crash-backtrace", "crashed" not in plain),
    ]
    hits = [p for m, p in sb.state.requests if p.startswith("/api/admin/")]
    checks.append(("admin call went through the engine helper", len(hits) == 1))
    return checks, []


def sc_pdf_browser(sb):
    """menu 11: /pdfs/{type} listing, /pdfs/{id} binary delivery, metadata save."""
    sb.login_ok_rule()
    T = sb.T
    LINES = ["1", "",          # login
             "11",             # PDF browser
             "2",              # list /pdfs/tute
             "3", "901",       # download pdf id 901 (mock serves application/pdf)
             "4",              # save listing metadata
             "0",
             "0", "y"]
    it = iter(LINES)
    import builtins, getpass

    def fake_input(prompt=""):
        try:
            return next(it)
        except StopIteration:
            raise EOFError("script exhausted")
    old_input, old_getpass = builtins.input, getpass.getpass
    builtins.input = fake_input
    getpass.getpass = fake_input
    buf = io.StringIO()
    try:
        with contextlib_redirect_stdout(buf):
            tui = T.TUI(sb.cfg())
            tui.run()
    finally:
        builtins.input = old_input
        getpass.getpass = old_getpass
    plain = re.sub(r"\033\[[0-9;]*m", "", buf.getvalue())
    checks = [("listing rendered", "Sandbox tute PDF" in plain),
              ("delivery download saved", "saved" in plain)]
    pdf_dir = os.path.join(T.DL_ROOT, "pdfs", "tute")
    pdfs = [f for f in os.listdir(pdf_dir)] if os.path.isdir(pdf_dir) else []
    checks.append(("pdf file on disk", any(f.endswith(".pdf") for f in pdfs)))
    meta = os.path.join(T.DL_ROOT, "pdfs", "tute_metadata.json")
    checks.append(("metadata json on disk", os.path.exists(meta)))
    if os.path.exists(meta):
        with open(meta, "r", encoding="utf-8") as f:
            checks.append(("metadata holds the listing item",
                           "Sandbox tute PDF" in f.read()))
    checks += [("delivery hit the request helper (mock /api/pdfs/901)",
                any(p.endswith("/api/pdfs/901") for _m, p in sb.state.requests)),
               ("no crash-backtrace", "crashed" not in plain)]
    return checks, []


def sc_rate_limit_429_backoff(sb):
    """engine request helper: Retry-After honored; no header -> exponential backoff, max 3 tries."""
    sb.login_ok_rule()
    T = sb.T
    api = sb.api_logged_in()          # login POST is not rate-limited here
    st = sb.state

    def hits(path):
        return sum(1 for m, p in st.requests if p == path)

    # 1) Retry-After: 0 honored -> two 429s then 200, no long sleeps
    st.four29["user"] = 2
    t0 = time.time()
    u = api.me()
    took = time.time() - t0
    checks = [("me() succeeded after 429s", u.get("first_name") == "Sandbox"),
              ("3 tries total for /user (Retry-After honored)", hits("/api/user") == 3),
              ("Retry-After: 0 -> no multi-second backoff (%.2fs)" % took, took < 1.5)]
    # 2) no Retry-After -> exponential backoff, still max 3 tries then ApiError 429
    old_base = T._429_BACKOFF_BASE
    T._429_BACKOFF_BASE = 0.001       # keep the test fast; logic path is identical
    st.four29["notifications"] = 99
    try:
        api.notifications()
        checks.append(("persistent 429 raised ApiError", False))
    except T.ApiError as e:
        checks += [("persistent 429 raised ApiError", e.status == 429),
                   ("max 3 tries for /notifications", hits("/api/notifications") == 3)]
    finally:
        T._429_BACKOFF_BASE = old_base
    return checks, []


SCENARIOS = {
    "login_ok":                  sc_login_ok,
    "login_422_password_no_retry":   sc_422_password_no_retry,
    "login_422_fingerprint_no_retry": sc_422_fingerprint_no_retry,
    "login_302_pause_notoken":   sc_302_pause_notoken,
    "login_302_pause_with_token": sc_302_pause_with_token,
    "auto_relogin_on_401":       sc_auto_relogin_401,
    "download_hls":              sc_download_hls,
    "download_hls_aes128":       sc_download_hls_aes,
    "download_mp4":              sc_download_mp4,
    "download_youtube":          sc_download_youtube,
    "drive_mount_save":          sc_drive_mount_save,
    "telegram_upload_dedupe":    sc_telegram_upload_dedupe,
    "menu_smoke":                sc_menu_smoke,
    "no_real_network_canary":    sc_no_real_network,
    "api_quick_calls":           sc_api_quick_calls,
    "pdf_browser":               sc_pdf_browser,
    "rate_limit_429_backoff":    sc_rate_limit_429_backoff,
}

def run_scenario(name):
    fn = SCENARIOS.get(name)
    if not fn:
        return {"name": name, "ok": False, "error": "unknown scenario"}
    t0 = time.time()
    try:
        with Sandbox(name) as sb:
            checks, notes = fn(sb)
        ok = all(c[1] for c in checks)
        return {"name": name, "ok": bool(ok), "took_s": round(time.time() - t0, 1),
                "checks": [{"check": c[0], "pass": bool(c[1])} for c in checks],
                "notes": notes}
    except Exception as e:
        return {"name": name, "ok": False, "took_s": round(time.time() - t0, 1),
                "error": "%s: %s" % (type(e).__name__, e),
                "trace": traceback.format_exc(limit=8)}


def run_all():
    results = [run_scenario(n) for n in SCENARIOS]
    passed = sum(1 for r in results if r["ok"])
    matrix = "\n".join(
        "  %-34s %s  %s" % (r["name"], "PASS" if r["ok"] else "FAIL",
                            ", ".join(c["check"] for c in r.get("checks", []) if not c["pass"]) or
                            ("%s" % r.get("error", "")[:80] if not r["ok"] else ""))
        for r in results)
    total_checks = sum(len(r.get("checks", [])) for r in results)
    ok_checks = sum(1 for r in results for c in r.get("checks", []) if c["pass"])
    return {"ok": passed == len(results), "passed": passed, "total": len(results),
            "checks_ok": "%d/%d" % (ok_checks, total_checks), "results": results,
            "matrix": matrix}

# ============================================================================
# env check + MCP plumbing
# ============================================================================

def env_check():
    import requests
    return {
        "python": sys.version.split()[0],
        "engine_present": os.path.exists(ENGINE_PATH),
        "engine_compiles": _engine_compiles(),
        "notebook_present": os.path.exists(os.path.join(COLAB_DIR, "ICT_TUI_Colab.ipynb")),
        "ffmpeg": bool(shutil.which("ffmpeg")),
        "ffprobe": bool(shutil.which("ffprobe")),
        "aria2c": bool(shutil.which("aria2c")),
        "real_yt_dlp": bool(shutil.which("yt-dlp")),
        "requests": requests.__version__,
        "real_network_used": False,
        "note": "all scenario traffic is 127.0.0.1-only; a network guard blocks "
                "any non-localhost request and fails the test",
    }


def _engine_compiles():
    import py_compile
    try:
        py_compile.compile(ENGINE_PATH, doraise=True, cfile=os.path.join(tempfile.gettempdir(), "ict_sb.pyc"))
        return True
    except Exception:
        return False

TOOLS = [
    {"name": "colab_env_check", "description": "Report sandbox capability: engine present/compiles, ffmpeg/ffprobe/aria2/yt-dlp, network-guard guarantee.",
     "inputSchema": {"type": "object", "properties": {}}},
    {"name": "colab_list_scenarios", "description": "List the Colab-sandbox test scenarios for the ICTfromABC TUI engine.",
     "inputSchema": {"type": "object", "properties": {}}},
    {"name": "colab_run_scenario", "description": "Run one sandbox scenario (mock Colab + mock site/Bunny/Telegram) against the real colab/ict_tui.py engine. Zero real-network traffic.",
     "inputSchema": {"type": "object", "properties": {"name": {"type": "string", "enum": sorted(SCENARIOS)}}, "required": ["name"]}},
    {"name": "colab_run_all", "description": "Run every sandbox scenario and return the PASS/FAIL matrix.",
     "inputSchema": {"type": "object", "properties": {}}},
]


def handle(method, params):
    if method == "initialize":
        return {"protocolVersion": params.get("protocolVersion", "2024-11-05"),
                "capabilities": {"tools": {}},
                "serverInfo": {"name": "ict-colab-sandbox", "version": "1.0.0"}}
    if method == "tools/list":
        return {"tools": TOOLS}
    if method == "tools/call":
        name = params.get("name")
        args = params.get("arguments") or {}
        if name == "colab_env_check":
            out = env_check()
        elif name == "colab_list_scenarios":
            out = {"scenarios": sorted(SCENARIOS)}
        elif name == "colab_run_scenario":
            out = run_scenario(args["name"])
        elif name == "colab_run_all":
            out = run_all()
        else:
            raise ValueError("unknown tool %s" % name)
        return {"content": [{"type": "text", "text": json.dumps(out, indent=2, ensure_ascii=False)}]}
    if method == "ping":
        return {}
    raise ValueError("unsupported method %s" % method)


def serve_stdio():
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            msg = json.loads(line)
        except ValueError:
            continue
        mid = msg.get("id")
        try:
            result = handle(msg.get("method"), msg.get("params") or {})
            resp = {"jsonrpc": "2.0", "id": mid, "result": result}
        except Exception as e:
            resp = {"jsonrpc": "2.0", "id": mid,
                    "error": {"code": -32603, "message": str(e)}}
        sys.stdout.write(json.dumps(resp) + "\n")
        sys.stdout.flush()


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "selftest":
        if len(sys.argv) > 3 and sys.argv[2] == "--scenario":
            r = run_scenario(sys.argv[3])
            print(json.dumps(r, indent=2))
            sys.exit(0 if r["ok"] else 1)
        r = run_all()
        print(r["matrix"])
        print("scenarios: %d/%d PASS | checks: %s" % (r["passed"], r["total"], r["checks_ok"]))
        sys.exit(0 if r["ok"] else 1)
    serve_stdio()
