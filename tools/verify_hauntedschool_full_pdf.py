from pathlib import Path
import sys

from pypdf import PdfReader


pdf_path = Path(sys.argv[1])
reader = PdfReader(str(pdf_path))
texts = [(page.extract_text() or "").strip() for page in reader.pages]
sizes = {(round(float(page.mediabox.width), 2), round(float(page.mediabox.height), 2)) for page in reader.pages}
uris = set()
for page in reader.pages:
    for ref in page.get("/Annots", []):
        action = ref.get_object().get("/A")
        if action and action.get("/URI"):
            uris.add(str(action["/URI"]))

required = [
    "The player’s voice", "A school that", "The haunting has", "Borrow the",
    "Design first", "Make the fear", "From the story’s logic",
]
joined = "\n".join(texts)
missing = [item for item in required if item not in joined]
expected_repo = "https://github.com/em05niper/Group-Project-Repository"

print(f"pages={len(reader.pages)}")
print(f"page_sizes={sorted(sizes)}")
print(f"text_lengths={[len(text) for text in texts]}")
print(f"uris={sorted(uris)}")
print(f"missing_text={missing}")

if len(reader.pages) != 8:
    raise SystemExit("Unexpected page count")
if sizes != {(960.0, 540.0)}:
    raise SystemExit("Unexpected page size")
if any(len(text) < 180 for text in texts):
    raise SystemExit("A page has too little extractable text")
if missing:
    raise SystemExit("Expected headings are missing")
if expected_repo not in uris:
    raise SystemExit("Repository link is missing")
