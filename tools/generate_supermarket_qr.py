from pathlib import Path

from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.graphics.shapes import Drawing
from reportlab.graphics import renderSVG


root = Path(__file__).resolve().parents[1]
output = root / "Image" / "Supermarket_QR_GitHub.svg"
url = "https://github.com/TaoMingxuan/Lets_Supermarket"

code = QrCodeWidget(url, barLevel="M")
drawing = Drawing(110, 110)
drawing.add(code)
drawing.transform = [1, 0, 0, 1, 10, 10]
renderSVG.drawToFile(drawing, str(output))
print(output)
