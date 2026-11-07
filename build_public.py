"""Build script: injects env config, auto-versions SW cache, copies to public/."""

import hashlib
import os
import re
from pathlib import Path
from shutil import copy2

ROOT   = Path(__file__).resolve().parent
PUBLIC = ROOT / "public"
PUBLIC.mkdir(exist_ok=True)

# ── 1. Load .env (optional – falls back to environment variables) ──────────
def load_env(path: Path) -> dict[str, str]:
    env: dict[str, str] = {}
    if not path.exists():
        return env
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if "=" in line:
            key, _, val = line.partition("=")
            env[key.strip()] = val.strip()
    return env

env = load_env(ROOT / ".env")
admin_email = env.get("ADMIN_EMAIL") or os.environ.get("ADMIN_EMAIL", "")
admin_code  = env.get("ADMIN_CODE")  or os.environ.get("ADMIN_CODE",  "")

if not admin_email or not admin_code:
    print("⚠  WARNING: ADMIN_EMAIL or ADMIN_CODE not set. Copy .env.example → .env and fill values.")

# ── 2. Build config injection snippet ─────────────────────────────────────
# Injected as a plain <script> BEFORE the firebase-cloud.js module so that
# window.__APP_CONFIG__ is available when the module executes.
config_snippet = f"""<script>
/* injected by build_public.py — do not edit manually */
window.__APP_CONFIG__ = {{
  adminEmail: {repr(admin_email)},
  adminCode:  {repr(admin_code)}
}};
</script>"""

# ── 3. Process index.html — inject config ─────────────────────────────────
html_src = (ROOT / "index.html").read_text(encoding="utf-8")

# Insert the config snippet just before </head>
if "window.__APP_CONFIG__" in html_src:
    # Already injected on a previous build — replace it
    html_src = re.sub(
        r'<script>\s*/\* injected by build_public\.py.*?</script>',
        config_snippet,
        html_src,
        flags=re.DOTALL,
    )
else:
    html_src = html_src.replace("</head>", config_snippet + "\n</head>", 1)

(PUBLIC / "index.html").write_text(html_src, encoding="utf-8")
print("✓  index.html  → public/index.html  (config injected)")

# ── 4. Auto-version sw.js cache name based on shell file hashes ───────────
shell_files = ["index.html", "theme.css", "firebase-cloud.js",
               "assets/mark.svg", "assets/install-qr.svg",
               "assets/icon-192.png", "assets/icon-512.png"]
h = hashlib.sha256()
for name in shell_files:
    p = ROOT / name
    if p.exists():
        h.update(p.read_bytes())
cache_ver = "agazaty-shell-" + h.hexdigest()[:8]

sw_src = (ROOT / "sw.js").read_text(encoding="utf-8")
sw_src = re.sub(r"const SHELL_CACHE = '[^']+';",
                f"const SHELL_CACHE = '{cache_ver}';", sw_src)
(PUBLIC / "sw.js").write_text(sw_src, encoding="utf-8")
print(f"✓  sw.js        → public/sw.js       (cache: {cache_ver})")

# ── 5. Copy remaining files unchanged ─────────────────────────────────────
for name in ("firebase-cloud.js", "theme.css", "manifest.webmanifest"):
    copy2(ROOT / name, PUBLIC / name)
    print(f"✓  {name:<26} → public/{name}")

(PUBLIC / "assets").mkdir(exist_ok=True)
for name in ("mark.svg", "icon-192.png", "icon-512.png", "install-qr.svg", "app-logo.png"):
    src = ROOT / "assets" / name
    if src.exists():
        copy2(src, PUBLIC / "assets" / name)
        print(f"✓  assets/{name}")

print("\n✅ Build complete → public/")
