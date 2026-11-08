"""Copy only the browser files into the Firebase Hosting directory."""

from pathlib import Path
from shutil import copy2

ROOT = Path(__file__).resolve().parent
PUBLIC = ROOT / "public"
PUBLIC.mkdir(exist_ok=True)

for name in ("index.html", "firebase-cloud.js", "theme.css", "manifest.webmanifest", "sw.js"):
    copy2(ROOT / name, PUBLIC / name)

(PUBLIC / "assets").mkdir(exist_ok=True)
for name in ("app-logo.png", "icon-192.png", "icon-512.png", "agazaty.ico", "install-qr.svg"):
    copy2(ROOT / "assets" / name, PUBLIC / "assets" / name)
