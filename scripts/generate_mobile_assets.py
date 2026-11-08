"""Generate install icons and the QR code for the deployed app URL."""

from pathlib import Path

from PIL import Image
from reportlab.graphics.barcode import qr
from reportlab.graphics.shapes import Drawing, Group
from reportlab.graphics import renderSVG


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
DOWNLOADS = {
    "install-qr.svg": "https://agazaty-am.vercel.app/apk?v=1.3.1",
    "windows-qr.svg": "https://agazaty-am.vercel.app/windows?v=1.3.1",
}

source = Image.open(ASSETS / "app-logo.png").convert("RGB")
for size in (192, 512):
    source.resize((size, size), Image.Resampling.LANCZOS).save(ASSETS / f"icon-{size}.png", optimize=True)
source.save(ASSETS / "agazaty.ico", format="ICO", sizes=[(16, 16), (32, 32), (48, 48), (256, 256)])

for filename, url in DOWNLOADS.items():
    code = qr.QrCodeWidget(url, barLevel="M")
    x1, y1, x2, y2 = code.getBounds()
    size = 240
    drawing = Drawing(size, size)
    group = Group()
    group.add(code)
    group.transform = (size / (x2 - x1), 0, 0, size / (y2 - y1), 0, 0)
    drawing.add(group)
    renderSVG.drawToFile(drawing, str(ASSETS / filename))
