from pathlib import Path

from PIL import Image
from reportlab.graphics import renderPDF
from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.graphics.shapes import Drawing
from reportlab.lib.colors import white
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[1]
SCREENSHOT = ROOT / "tools" / "assets" / "index_home_clean_hover.png"
OUTPUT = ROOT / "output" / "pdf" / "Shuhan_Zhang_Portfolio_Cover.pdf"
PAGE_WIDTH = 960
PAGE_HEIGHT = 540


def draw_qr(pdf, url, x, y, size):
    qr = QrCodeWidget(url, barLevel="M")
    x0, y0, x1, y1 = qr.getBounds()
    quiet = 5.5
    scale = (size - 2 * quiet) / (x1 - x0)
    pdf.setFillColor(white)
    pdf.rect(x, y, size, size, stroke=0, fill=1)
    drawing = Drawing(size, size)
    drawing.add(qr)
    drawing.transform = [scale, 0, 0, scale, x - x0 * scale + quiet, y - y0 * scale + quiet]
    renderPDF.draw(drawing, pdf, 0, 0)
    pdf.linkURL(url, (x, y, x + size, y + size), relative=0, thickness=0)


with Image.open(SCREENSHOT) as screenshot:
    if screenshot.size != (1280, 720):
        raise ValueError(f"Unexpected screenshot dimensions: {screenshot.size}")

OUTPUT.parent.mkdir(parents=True, exist_ok=True)
pdf = canvas.Canvas(str(OUTPUT), pagesize=(PAGE_WIDTH, PAGE_HEIGHT), pageCompression=1)
pdf.setTitle("Shuhan Zhang | Portfolio Cover")
pdf.setAuthor("Shuhan Zhang")
pdf.drawImage(ImageReader(str(SCREENSHOT)), 0, 0, PAGE_WIDTH, PAGE_HEIGHT)

# The original homepage is captured with its title in a genuine :hover state.
# The QR/link groups sit in the existing lower-corner negative space.
qr_size = 64.5
left_x = 37.5
right_x = PAGE_WIDTH - 37.5 - qr_size
bottom_y = 30.0
portfolio = "https://shuhan0001.github.io/portfolio/"
github = "https://github.com/Shuhan0001"
draw_qr(pdf, portfolio, left_x, bottom_y, qr_size)
draw_qr(pdf, github, right_x, bottom_y, qr_size)

pdf.setFillColor(white)
pdf.setFont("Helvetica-Bold", 9)
pdf.drawString(115, 76, "PORTFOLIO WEBSITE")
pdf.setFont("Helvetica", 8.1)
pdf.drawString(115, 57, "shuhan0001.github.io/portfolio/")
pdf.linkURL(portfolio, (111, 48, 311, 87), relative=0, thickness=0)

pdf.setFont("Helvetica-Bold", 9)
pdf.drawRightString(845, 76, "GITHUB")
pdf.setFont("Helvetica", 8.1)
pdf.drawRightString(845, 57, "github.com/Shuhan0001")
pdf.linkURL(github, (681, 48, 849, 87), relative=0, thickness=0)

pdf.showPage()
pdf.save()
print(OUTPUT)
