"""Combine the three PS projects and the finished MiniQuest case study."""

from __future__ import annotations

from io import BytesIO
from pathlib import Path

from pypdf import PdfReader, PdfWriter, Transformation
from reportlab.lib.colors import HexColor
from reportlab.pdfgen import canvas


WORKSPACE = Path(r"D:\作品集")
SOURCE_DIR = WORKSPACE / "portfolio" / "tmp" / "pdfs" / "edinburgh_refresh"
COVER = WORKSPACE / "pdf" / "Shuhan_Zhang_Portfolio_Cover.pdf"
OUTPUT = SOURCE_DIR / "Shuhan_Zhang_Edinburgh_DDM_Portfolio_20p.pdf"
TOTAL_PAGES = 20

PAGE_W, PAGE_H = 960, 1120
PANEL_X, PANEL_W, PANEL_H = 24, 912, 513
PANEL_Y_LOWER, PANEL_Y_UPPER = 42, 568
SCALE = PANEL_W / 960

SECTIONS = [
    ("CogniStream_Portfolio.pdf", "COGNI-STREAM"),
    ("Revive_Portfolio.pdf", "REVIVE"),
    ("Threshold_Full_Portfolio.pdf", "THRESHOLD / IN DEVELOPMENT"),
    ("MiniQuest_Application_8p.pdf", "MINIQUEST"),
]


def frame(project: str, source_range: str, folio: int) -> object:
    buffer = BytesIO()
    cv = canvas.Canvas(buffer, pagesize=(PAGE_W, PAGE_H), pageCompression=1)
    cv.setFillColor(HexColor("#090b0e"))
    cv.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    cv.setStrokeColor(HexColor("#34383c"))
    cv.setLineWidth(0.4)
    cv.line(PANEL_X, 31, PAGE_W - PANEL_X, 31)
    cv.setFillColor(HexColor("#a6abb0"))
    cv.setFont("Helvetica", 8)
    cv.drawString(PANEL_X, 15, f"{project}  /  {source_range}")
    cv.drawRightString(PAGE_W - PANEL_X, 15, f"{folio:02d} / {TOTAL_PAGES}")
    cv.save()
    buffer.seek(0)
    return PdfReader(buffer).pages[0]


def put_links(writer: PdfWriter, dest: int, source: object, x: float, y: float) -> None:
    for annotation_ref in source.get("/Annots", []):
        annotation = annotation_ref.get_object()
        action = annotation.get("/A")
        if not action or action.get("/S") != "/URI":
            continue
        uri, rect = action.get("/URI"), annotation.get("/Rect")
        if not uri or not rect:
            continue
        writer.add_uri(dest, str(uri), [
            float(rect[0]) * SCALE + x,
            float(rect[1]) * SCALE + y,
            float(rect[2]) * SCALE + x,
            float(rect[3]) * SCALE + y,
        ])


def main() -> None:
    writer = PdfWriter()
    writer.add_page(PdfReader(str(COVER)).pages[0])
    writer.add_outline_item("Cover", 0)
    folio = 2
    for filename, project in SECTIONS:
        reader = PdfReader(str(SOURCE_DIR / filename))
        assert len(reader.pages) % 2 == 0, f"Uneven section: {filename}"
        writer.add_outline_item(project, len(writer.pages))
        for first in range(0, len(reader.pages), 2):
            page = frame(project, f"{first + 1:02d}-{first + 2:02d}", folio)
            placements = [(first, PANEL_Y_UPPER), (first + 1, PANEL_Y_LOWER)]
            for source_index, y in placements:
                page.merge_transformed_page(
                    reader.pages[source_index],
                    Transformation().scale(SCALE).translate(PANEL_X, y),
                    expand=False,
                )
            if "/Annots" in page:
                del page["/Annots"]
            dest = len(writer.pages)
            writer.add_page(page)
            for source_index, y in placements:
                put_links(writer, dest, reader.pages[source_index], PANEL_X, y)
            folio += 1
    assert len(writer.pages) == TOTAL_PAGES, len(writer.pages)
    writer.add_metadata({
        "/Title": "Shuhan Zhang | Edinburgh MSc Design and Digital Media Portfolio",
        "/Author": "Shuhan Zhang",
        "/Subject": "Cogni-Stream, Revive, THRESHOLD and MiniQuest",
    })
    with OUTPUT.open("wb") as stream:
        writer.write(stream)
    print(f"Created {OUTPUT}: {len(writer.pages)} pages, {OUTPUT.stat().st_size / 1048576:.2f} MiB")


if __name__ == "__main__":
    main()
