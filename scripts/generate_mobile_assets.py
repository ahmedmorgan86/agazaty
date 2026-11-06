"""Generate install icons and the QR code for the deployed app URL."""

from pathlib import Path

from PIL import Image
from reportlab.graphics.barcode import qr
from reportlab.graphics.shapes import Drawing, Group
from reportlab.graphics import renderSVG


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
APP_URL = "https://agazaty-git-codex-rebuild-secure-theme-ahmedmorgan86s-projects.vercel.app/"

source = Image.open(ASSETS / "app-logo.png").convert("RGB")
for size in (192, 512):
    source.resize((size, size), Image.Resampling.LANCZOS).save(ASSETS / f"icon-{size}.png", optimize=True)

code = qr.QrCodeWidget(APP_URL, barLevel="M")
x1, y1, x2, y2 = code.getBounds()
size = 240
drawing = Drawing(size, size)
group = Group()
group.add(code)
group.transform = (size / (x2 - x1), 0, 0, size / (y2 - y1), 0, 0)
drawing.add(group)
renderSVG.drawToFile(drawing, str(ASSETS / "install-qr.svg"))
