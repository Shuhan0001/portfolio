"""Losslessly deduplicate and recompress the compiled Edinburgh PDF."""

from __future__ import annotations

from collections import Counter
from hashlib import sha256
from pathlib import Path
import sys
import zlib

from pypdf import PdfReader, PdfWriter
from pypdf.generic import IndirectObject, StreamObject


ROOT = Path(r"D:\作品集")
SOURCE = ROOT / "pdf" / "Shuhan_Zhang_Edinburgh_DDM_Portfolio_20p.pdf"
STAGING = ROOT / "portfolio" / "tmp" / "pdfs" / "edinburgh_refresh"


def inspect(reader: PdfReader) -> None:
    streams = []
    for generation, objects in reader.xref.items():
        for identifier in objects:
            obj = reader.get_object(IndirectObject(identifier, generation, reader))
            if isinstance(obj, StreamObject):
                data = obj._data
                streams.append((len(data), str(obj.get("/Subtype", "other")), str(obj.get("/Filter", "none")), sha256(data).digest()))
    by_type = Counter()
    for length, subtype, _, _ in streams:
        by_type[subtype] += length
    duplicates = sum(length * (count - 1) for (length, _), count in Counter((length, digest) for length, _, _, digest in streams).items() if count > 1)
    print("encoded streams", len(streams), "MiB by subtype", {key: round(value / 1048576, 2) for key, value in by_type.items()})
    print("identical encoded-stream copies", round(duplicates / 1048576, 2), "MiB")
    for length, subtype, compression, _ in sorted(streams, reverse=True)[:16]:
        print("largest", round(length / 1048576, 3), "MiB", subtype, compression)


def main() -> None:
    mode = sys.argv[1] if len(sys.argv) > 1 else "inspect"
    reader = PdfReader(str(SOURCE))
    print("source", SOURCE.stat().st_size, "bytes", len(reader.pages), "pages")
    inspect(reader)
    if mode == "inspect":
        return
    if mode not in ("dedup", "reflate", "maxflate"):
        raise ValueError(mode)
    writer = PdfWriter()
    writer.clone_document_from_reader(reader)
    if mode in ("reflate", "maxflate"):
        for page in writer.pages:
            page.compress_content_streams(level=9)
    if mode == "maxflate":
        count = saved = 0
        for obj in writer._objects:
            if not isinstance(obj, StreamObject) or str(obj.get("/Filter")) != "/FlateDecode":
                continue
            try:
                rebuilt = zlib.compress(zlib.decompress(obj._data), level=9)
            except zlib.error:
                continue
            if len(rebuilt) < len(obj._data):
                saved += len(obj._data) - len(rebuilt)
                obj._data = rebuilt
                count += 1
        print("level-9 Flate replacements", count, "bytes saved", saved)
    writer.compress_identical_objects(remove_duplicates=True, remove_unreferenced=True)
    output = STAGING / f"Shuhan_Zhang_Edinburgh_DDM_Portfolio_20p_{mode}.pdf"
    with output.open("wb") as stream:
        writer.write(stream)
    restored = PdfReader(str(output))
    if len(restored.pages) != len(reader.pages):
        raise AssertionError("Page count changed")
    for index, (original, result) in enumerate(zip(reader.pages, restored.pages, strict=True)):
        if original.extract_text() != result.extract_text():
            raise AssertionError(f"Text changed on page {index + 1}")
        if original.mediabox != result.mediabox:
            raise AssertionError(f"Page size changed on page {index + 1}")
    print("output", output, output.stat().st_size, "bytes")


if __name__ == "__main__":
    main()
