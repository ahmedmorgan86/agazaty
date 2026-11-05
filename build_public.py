"""Copy only the browser files into the Firebase Hosting directory."""

from pathlib import Path
from shutil import copy2

ROOT = Path(__file__).resolve().parent
PUBLIC = ROOT / "public"
PUBLIC.mkdir(exist_ok=True)

for name in ("index.html", "firebase-cloud.js"):
    copy2(ROOT / name, PUBLIC / name)

(PUBLIC / "assets").mkdir(exist_ok=True)
copy2(ROOT / "assets" / "app-logo.png", PUBLIC / "assets" / "app-logo.png")
