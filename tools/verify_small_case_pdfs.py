from pathlib import Path

from pypdf import PdfReader


ROOT = Path(__file__).resolve().parents[1]
CASES = [
    ("Threshold_Full_Portfolio.pdf", 4, ["THRESHOLD", "What constitutes the", "EXPERIENCE FLOW", "SIX LIFE INDICATORS", "BUILD SNAPSHOT"], None),
    ("Lets_Supermarket_Full_Portfolio.pdf", 6, ["SUPERMARKET", "Five small actions", "The shelf and the price tag", "A store is more than", "Designing a", "A store day to"], "https://github.com/TaoMingxuan/Lets_Supermarket"),
]

for filename, count, required, required_link in CASES:
    pdf = ROOT / "output" / "pdf" / filename
    reader = PdfReader(str(pdf))
    texts = [(page.extract_text() or "").strip() for page in reader.pages]
    sizes = {(round(float(page.mediabox.width), 2), round(float(page.mediabox.height), 2)) for page in reader.pages}
    uris = set()
    for page in reader.pages:
        for ref in page.get("/Annots", []):
            action = ref.get_object().get("/A")
            if action and action.get("/URI"):
                uris.add(str(action["/URI"]))
    joined = "\n".join(texts)
    missing = [term for term in required if term not in joined]
    print(f"{filename}: pages={len(reader.pages)}, sizes={sorted(sizes)}, lengths={[len(t) for t in texts]}, uris={sorted(uris)}, missing={missing}")
    if len(reader.pages) != count or sizes != {(960.0, 540.0)}:
        raise SystemExit(f"Unexpected PDF geometry: {filename}")
    if any(len(text) < 150 for text in texts):
        raise SystemExit(f"Too little extractable text: {filename}")
    if missing or (required_link and required_link not in uris):
        raise SystemExit(f"Missing text or link: {filename}")
