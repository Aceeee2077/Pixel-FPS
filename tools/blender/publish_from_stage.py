"""Reassemble the staged base64 chunks into the web root.

Used when the build process cannot write into ``public/`` itself. The staging
step (``stage-publish.mjs``) writes plain-text chunks; this script validates and
reassembles them, so a text-only transfer still produces byte-identical GLBs.

    blender -b -P tools/blender/publish_from_stage.py
"""
import base64
import hashlib
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
STAGE = HERE / "stage"


def main():
    records_path = STAGE / "records.json"
    if not records_path.exists():
        print("nothing staged at %s" % records_path)
        return 1
    payload = json.loads(records_path.read_text(encoding="utf-8"))
    written = []
    for record in payload["binaries"]:
        encoded = "".join((STAGE / "chunks" / name).read_text(encoding="utf-8").strip()
                          for name in record["chunks"])
        data = base64.b64decode(encoded, validate=True)
        if len(data) != record["bytes"]:
            print("!! %s: expected %d bytes, decoded %d"
                  % (record["target"], record["bytes"], len(data)))
            return 1
        target = ROOT / record["target"]
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
        written.append((record["target"], len(data),
                        hashlib.sha256(data).hexdigest()[:12]))
    for name, text in payload.get("inline", {}).items():
        target = ROOT / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(text, encoding="utf-8")
        written.append((name, len(text.encode("utf-8")), "text"))
    print("published %d files" % len(written))
    for name, size, digest in written:
        print("  %-52s %8d  %s" % (name, size, digest))
    return 0


if __name__ == "__main__":
    sys.exit(main())
