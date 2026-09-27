"""Record the subject crop rectangle for every reference render.

The reference PNGs are 1254x1254 studio renders whose subject sits inside a
large margin of empty backdrop. Used raw as card art, the weapon reads as a
hairline in a field of grey. This step measures the tight silhouette band and
writes it into ``reference_manifest.json`` as a normalised crop rectangle, which
``src/ui/ReferenceArt.ts`` applies on a canvas at runtime.

    blender -b -P tools/blender/report_reference_bands.py
"""
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(HERE))

from weapon_reference import ReferenceAnalysis

MARGIN = 0.06


def subject_crop(height, width, tops, bottoms, x0, x1, scale, margin=MARGIN):
    """Normalised ``[x, y, w, h]`` crop of the subject, clamped to the image."""
    count = len(tops)
    if not count:
        return None
    top = tops[int(count * 0.04)] * scale
    bottom = bottoms[int(count * 0.96)] * scale
    left = x0 * scale
    right = x1 * scale
    pad_x = (right - left) * margin
    pad_y = (bottom - top) * margin
    left = max(0.0, left - pad_x)
    right = min(width, right + pad_x)
    top = max(0.0, top - pad_y)
    bottom = min(height, bottom + pad_y)
    return [round(left / width, 5), round(top / height, 5),
            round((right - left) / width, 5), round((bottom - top) / height, 5)]


def main():
    manifest_path = HERE / "reference_manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    updated = 0
    for weapon, entry in manifest["weapons"].items():
        for image in entry.get("images", []):
            name = image["file"]
            analysis = ReferenceAnalysis(ROOT / name, name).measure()
            tops = sorted(c[0] for c in analysis.columns if c[0] is not None)
            bottoms = sorted(c[1] for c in analysis.columns if c[1] is not None)
            x0, _, x1, _ = analysis.bounds
            crop = subject_crop(analysis.height, analysis.width, tops, bottoms,
                                x0, x1, analysis.scale)
            if crop is None:
                continue
            image["subject_crop"] = crop
            image["subject_crop_note"] = ("normalised x,y,w,h of the weapon inside the "
                                          "render, margin %.0f%%" % (MARGIN * 100))
            updated += 1
            print("%-12s %-30s crop x %.3f y %.3f  w %.3f h %.3f"
                  % (weapon, name, crop[0], crop[1], crop[2], crop[3]))
    manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")
    print("\nrecorded subject crops for %d images" % updated)
    return 0


if __name__ == "__main__":
    sys.exit(main())
