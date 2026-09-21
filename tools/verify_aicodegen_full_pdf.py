from pathlib import Path
import sys

from pypdf import PdfReader


def main() -> None:
    pdf_path = Path(sys.argv[1])
    reader = PdfReader(str(pdf_path))
    page_sizes = {
        (round(float(page.mediabox.width), 2), round(float(page.mediabox.height), 2))
        for page in reader.pages
    }
    text_by_page = [(page.extract_text() or "").strip() for page in reader.pages]
    uris = []
    for page in reader.pages:
        for annotation_ref in page.get("/Annots", []):
            annotation = annotation_ref.get_object()
            action = annotation.get("/A")
            if action and action.get("/URI"):
                uris.append(str(action["/URI"]))

    expected_terms = [
        "EVALUATING AI-ASSISTED GAME CODE",
        "WHAT BREAKS WHEN THE MODEL",
        "FROM HAND-WRITTEN BASELINE",
        "A WORKING DEMO",
        "THE COLLISION WORKED",
        "THE ALL-WALL MAP",
        "ONE EXPLICIT BOUNDARY",
        "WHAT IMPROVED",
        "ON MAP06",
        "WHAT THIS STUDY CHANGED",
        "THE DEVELOPER DID NOT DISAPPEAR",
    ]
    joined_text = "\n".join(text_by_page).upper()
    missing_terms = [term for term in expected_terms if term not in joined_text]

    print(f"pages={len(reader.pages)}")
    print(f"page_sizes={sorted(page_sizes)}")
    print(f"text_lengths={[len(text) for text in text_by_page]}")
    print(f"uris={sorted(set(uris))}")
    print(f"missing_terms={missing_terms}")

    if len(reader.pages) != 11:
        raise SystemExit("Unexpected page count")
    if page_sizes != {(960.0, 540.0)}:
        raise SystemExit("Unexpected page size")
    if any(len(text) < 120 for text in text_by_page):
        raise SystemExit("A page has unexpectedly little extractable text")
    if missing_terms:
        raise SystemExit("Expected text is missing")
    expected_uris = {
        "https://shuhan0001.github.io/portfolio/v6_scene_music_system.html",
        "https://github.com/Shuhan0001/Evaluating-AI--Assisted-Game-Code",
    }
    if not expected_uris.issubset(set(uris)):
        raise SystemExit("Expected PDF links are missing")


if __name__ == "__main__":
    main()
