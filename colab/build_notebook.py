# -*- coding: utf-8 -*-
"""Builds ICT_TUI_Colab.ipynb from ict_tui.py (keeps notebook and module in sync)."""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "ict_tui.py")
OUT = os.path.join(HERE, "ICT_TUI_Colab.ipynb")

def md(text):
    return {"cell_type": "markdown", "metadata": {}, "source": text.splitlines(keepends=True)}

def code(text):
    return {"cell_type": "code", "metadata": {}, "execution_count": None,
            "outputs": [], "source": text.splitlines(keepends=True)}

CELLS = [
    md("""# ICTfromABC — Colab TUI

Drives **ictfromabc.com** entirely from this notebook: login → dashboard → lessons → **fast video download** (Colab bandwidth) → **Google Drive** → **Telegram group backup**.

## Pipeline
```
[Colab TUI] --login (bound fingerprint)--> ictfromabc API
     |                                        |
     |---- lessons / videos / pdfs ----------/
     |---- Bunny HLS --> ffmpeg -c copy --> .mp4  (fastest, no re-encode)
     |---- mp4 ---------> aria2c / requests
     |---- YouTube -----> yt-dlp
     v
Google Drive (archive)  +  Telegram group (backup storage, kurigram userbot, 2 GB/file)
```

## One-time setup (do this before running)

**1. Fingerprint pair (the login bypass).** The server binds one FingerprintJS `visitorId`
per account. On **a device that currently logs in fine** (your PC):
`F12 → Network → log in → click POST .../api/login → Request Payload` → copy
`visitorId` and `confidenceScore` (e.g. `0.995`). Colab is a datacenter IP — that's fine:
*known fingerprint + any network = allowed*. Put both in **Cell 3**.

⚠ Rules (avoid the "Account on Pause" server-side lock):
- never retry a login that returned **422** (retry → 302 pause → staff unlock only);
  this TUI **refuses to auto-retry** for you.
- log in only from suite-equipped browsers; the **Median app rebinds the fingerprint** — don't use it.
- if you ever see the 302 pause: call staff (071 455 5513), unlock, re-capture, continue.

**2. Telegram backup.** Create your backup group (e.g. "ICT Archive"), add your own account
to it. Get `api_id` + `api_hash` at https://my.telegram.org → *API development tools* → put in **Cell 3**.
First connect (menu 6→1) asks for phone + login code in the output cell — normal MTProto login.
After that the session string is saved into the config, so later sessions skip the code.
(Bot-API fallback works too but caps at **50 MB/file** — userbot is the real backup path.)

**3. Google Drive.** Menu 5 → 1 to mount; files land in `MyDrive/ICT/<course>/<lesson>/`.

## Run order
**Cell 2** (installs) → **Cell 3** (edit config) → **Cell 4** (engine) → **Cell 5** (`tui.run()`).

Menus: `1` login (+ keepalive toggle) · `2` dashboard · `3` lessons browser · `4` downloads ·
`5` drive · `6` telegram · `7` auto pipeline · `8` API console · `9` settings ·
`10` API quick calls (/user, /lessons/allowed, /notifications, /telegram, availabilities,
/pdfs listings, RBAC 403 check) · `11` PDF browser (listings + /pdfs/{id} download).
"""),
    code("""# ---- Cell 2: installs + environment check ----
!pip -q install "kurigram[fast]" hachoir yt-dlp
!apt-get -qq -y install aria2 > /dev/null 2>&1

# Colab's yt-dlp needs a JS runtime (deno) + remote EJS challenge components
# for YouTube extraction (some lessons are YouTube embeds): without them the
# n-challenge fails and "-f best" finds no pre-merged format.
import os, shutil, subprocess
if not shutil.which("deno"):
    subprocess.run("curl -fsSL https://deno.land/install.sh | sh -s -- -y", shell=True,
                   capture_output=True, text=True, timeout=180)
    if os.path.exists("/root/.deno/bin/deno"):
        os.environ["PATH"] = "/root/.deno/bin:" + os.environ["PATH"]
_cfg = os.path.expanduser("~/.config/yt-dlp/config")
os.makedirs(os.path.dirname(_cfg), exist_ok=True)
if not os.path.exists(_cfg):
    with open(_cfg, "w") as f:
        f.write("--remote-components ejs:github\\n")

import sys
print("python   ", sys.version.split()[0])
print("ffmpeg   ", shutil.which("ffmpeg"))
print("deno     ", shutil.which("deno"))
print("yt-dlp   ", shutil.which("yt-dlp"))
print("aria2c   ", shutil.which("aria2c"))
try:
    import pyrogram; print("kurigram ", pyrogram.__version__)
except ImportError:
    print("kurigram NOT installed - telegram menu will need the pip line above")
print("ready.")"""),
    code("""# ---- Cell 3: CONFIG (edit once; re-runs keep your menu edits) ----
import json, pathlib

CONFIG = {
    # -- site login: the account-bound fingerprint pair (bypass) --
    "phone": "",     # J.S. account
    "password": "",
    "visitor_id": "CWUriseStUq30ANV6hIt",   # bound device pair, verified live 2026-11-12 (2x LOGIN OK)
    "confidence": 0.82,        # live FingerprintJS confidence at the successful logins (session file's 0.97 is stale)

    # -- telegram backup (userbot) --
    "tg_api_id": 0,            # my.telegram.org > API development tools
    "tg_api_hash": "",
    "tg_group": "",            # group id (-100...) or @name; or pick via menu 6 > 3

    # -- behaviour --
    "drive_enabled": False,    # set True to auto-mount Google Drive
    "prefer_quality": "best",  # best | 1080 | 720 | 480 | 360
    "auto_drive": True,        # after each download -> copy to Drive
    "auto_telegram": True,     # after each download -> upload to TG group
    "delete_after_upload": False,
    "tg_as_document": True,    # True = raw file backup; False = streamable video
}

p = pathlib.Path("/content/ict_tui_config.json")
saved = json.loads(p.read_text()) if p.exists() else {}
saved.update({k: v for k, v in CONFIG.items() if v not in ("", 0, None)})
p.write_text(json.dumps(saved, indent=2))
print("config ready ->", p)"""),
    code("""# ---- Cell 4: engine (auto-generated from colab/ict_tui.py v1.0.0) ----"""),
    code("""# ---- Cell 5: run ----
tui = TUI()
tui.run()"""),
]

with open(SRC, "r", encoding="utf-8") as f:
    engine = f.read()

# paste the module under cell 4's header (version kept in sync with ict_tui.py)
m = re.search(r'__version__\s*=\s*"([^"]+)"', engine)
ver = m.group(1) if m else "?"
CELLS[3]["source"] = ("# ---- Cell 4: engine (auto-generated from colab/ict_tui.py v%s) ----\n"
                      % ver).splitlines(keepends=True)
CELLS[3]["source"] = CELLS[3]["source"] + engine.splitlines(keepends=True)

nb = {
    "cells": CELLS,
    "metadata": {
        "colab": {"name": "ICT_TUI_Colab.ipynb", "provenance": []},
        "kernelspec": {"name": "python3", "display_name": "Python 3"},
        "language_info": {"name": "python"},
    },
    "nbformat": 4,
    "nbformat_minor": 5,
}

with open(OUT, "w", encoding="utf-8", newline="\n") as f:
    json.dump(nb, f, indent=1, ensure_ascii=False)

# verify the notebook itself compiles as a set of code cells (ignoring ! magics)
import ast
bad = []
for i, c in enumerate(nb["cells"]):
    if c["cell_type"] == "code":
        src = "\n".join(l for l in "".join(c["source"]).splitlines()
                        if not l.lstrip().startswith("!"))
        try:
            ast.parse(src)
        except SyntaxError as e:
            bad.append((i, str(e)))
print("written:", OUT, os.path.getsize(OUT), "bytes")
print("cells  :", [c["cell_type"] for c in nb["cells"]])
print("syntax :", "OK" if not bad else bad)
