from pathlib import Path

from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.graphics.shapes import Drawing
from reportlab.graphics import renderSVG


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "Image" / "HauntedSchool_QR_GitHub.svg"
URL = "https://github.com/em05niper/Group-Project-Repository"

code = QrCodeWidget(URL, barLevel="M")
x0, y0, x1, y1 = code.getBounds()
size = x1 - x0
drawing = Drawing(110, 110)
drawing.add(code)
drawing.transform = [1, 0, 0, 1, 10, 10]
renderSVG.drawToFile(drawing, str(OUTPUT))
print(OUTPUT)
