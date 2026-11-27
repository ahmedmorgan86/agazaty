"""Copy only the browser files into the Firebase Hosting directory."""

from pathlib import Path
from shutil import copy2

ROOT = Path(__file__).resolve().parent
PUBLIC = ROOT / "public"
PUBLIC.mkdir(exist_ok=True)

for name in ("index.html", "firebase-cloud.js", "theme.css", "design.css", "palette.css", "manifest.webmanifest", "sw.js"):
    copy2(ROOT / name, PUBLIC / name)

(PUBLIC / "assets").mkdir(exist_ok=True)
for name in ("app-logo.png", "icon-192.png", "icon-512.png", "agazaty.ico", "install-qr.svg", "windows-qr.svg", "xlsx.full.min.js", "xlsx.LICENSE"):
    copy2(ROOT / "assets" / name, PUBLIC / "assets" / name)

for folder in ("js", "css"):
    (PUBLIC / folder).mkdir(exist_ok=True)
    for stale in (PUBLIC / folder).glob("*"):
        stale.unlink()
    for source in sorted((ROOT / folder).glob("*")):
        copy2(source, PUBLIC / folder / source.name)
