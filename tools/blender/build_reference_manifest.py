"""Scan the project for weapon reference art and build the Reference Manifest.

Run: blender -b -P tools/blender/build_reference_manifest.py

Writes ``tools/blender/reference_manifest.json`` (the single source of truth for
every later build step) plus debug masks under ``tools/blender/reference_work/``
so the recovered silhouettes can be eyeballed against the source renders.
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent))

from weapon_reference import ReferenceAnalysis

WORK = Path(__file__).resolve().parent / "reference_work"
MANIFEST_PATH = Path(__file__).resolve().parent / "reference_manifest.json"
VISION_PATH = Path(__file__).resolve().parent / "reference_vision.json"

# weapon id -> reference file names. Ambiguous legacy names are kept as
# ``unassigned`` so nothing is silently attached to the wrong weapon.
REFERENCE_FILES = {
    "ak-47": ["AK-47.png"],
    "m4a4": ["M4A4.png", "M4A4_Asimov.png"],
    "m4a1-s": ["M4A1-S.png"],
    "awp": ["AWP.png"],
    "glock": ["Glock.png"],
    "usp-s": ["usp.png"],
    "deagle": ["Deagle.png"],
    "famas": ["FAMAS.png"],
    "aug": ["AUG.png"],
    "p2000": ["P2000.png"],
    "p250": ["P250.png"],
    "five-seven": ["FN57.png"],
    "tec-9": ["TEC-9.png"],
    "cz75": ["CZ75.png"],
    "mp9": ["MP9.png"],
    "mac-10": ["MAC-10.png"],
    "mp7": ["MP7.png"],
    "pp-bizon": ["PP19.png"],
    "p90": ["P90.png"],
    "knife": ["Knife.png"],
    "butterfly": ["Butterfly_Knife_Emerald.png", "Butterfly_Knife_Fade.png"],
    "karambit": ["Karambit_Emerald.png"],
    "m9": ["M9Bayonet_Ruby.png"],
}
# Deliberately unassigned: legacy names for classes whose ids the registry
# splits (UMP-45.png vs UMP.png, and the three unlabelled ChatGPT renders).
UNASSIGNED = ["UMP-45.png", "UMP.png", "1.png", "2.png", "3.png",
              "structure1.png", "structure2.jpg", "structure3.jpg",
              "ChatGPT 图像 2026年9月25日 10_21_29-2.png",
              "ChatGPT 图像 2026年9月25日 10_21_36-6.png",
              "ChatGPT 图像 2026年9月25日 10_21_38-7.png",
              "ChatGPT 图像 2026年9月25日 10_29_58.png",
              "ChatGPT 图像 2026年9月25日 10_30_03.png",
              "ChatGPT 图像 2026年9月25日 10_30_05.png"]

# Weapon classes still missing reference art entirely.
NO_REFERENCE = ["galil-ar", "sg-553", "ssg-08", "scar-20", "g3sg1", "nova",
                "xm1014", "mag-7", "sawed-off", "m249", "negev", "mp5-sd",
                "dual-berettas", "r8", "ump-45"]


def locate_for(weapon, filename):
    vision = {}
    if VISION_PATH.exists():
        vision = json.loads(VISION_PATH.read_text(encoding="utf-8"))
    entry = vision.get(weapon, {})
    return entry.get("features", {})


def main():
    WORK.mkdir(parents=True, exist_ok=True)
    manifest = {"generated_by": "tools/blender/build_reference_manifest.py",
                "root": str(ROOT).replace("\\", "/"),
                "weapons": {}, "unassigned": [], "missing": {}}
    for weapon, files in REFERENCE_FILES.items():
        images = []
        for filename in files:
            path = ROOT / filename
            if not path.exists():
                print("!! missing file", filename)
                continue
            analysis = ReferenceAnalysis(path, filename, locate_for(weapon, filename))
            analysis.measure()
            stem = Path(filename).stem.lower().replace(" ", "_")
            overlay = analysis.debug_overlay(WORK / ("%s_%s_overlay.png" % (weapon, stem)))
            mask = analysis.mask_png(WORK / ("%s_%s_mask.png" % (weapon, stem)))
            record = {
                "file": filename,
                "source_pixels": [analysis.width, analysis.height],
                "silhouette_coverage": round(analysis.coverage, 4),
                "silhouette_quality": analysis.quality,
                "proportions": analysis.proportions(),
                "column_profile": analysis.column_heights(48),
                "colour_zones": analysis.colors,
                "debug_overlay": str(overlay.relative_to(ROOT)).replace("\\", "/"),
                "debug_mask": str(mask.relative_to(ROOT)).replace("\\", "/"),
            }
            images.append(record)
            print("%-10s %-32s fill %.2f %-8s len/h %.3f  box %s"
                  % (weapon, filename, analysis.fill_fraction,
                     "ok" if analysis.quality["reliable"] else "LOW",
                     analysis.proportions()["length_over_height"],
                     [analysis.proportions()["pixels"][k] for k in ("x0", "y0", "x1", "y1")]))
        manifest["weapons"][weapon] = {
            "images": images,
            "status": "pending" if images else "needs_more_reference",
            "image_count": len(images),
        }
    for filename in UNASSIGNED:
        if (ROOT / filename).exists():
            manifest["unassigned"].append(filename)
    for weapon in NO_REFERENCE:
        manifest["missing"][weapon] = {
            "status": "needs_more_reference",
            "note": "no reference art in the project; authored from class knowledge",
        }
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")
    print("\nWrote", MANIFEST_PATH)
    print("weapons with references:", len([w for w in manifest["weapons"].values() if w["images"]]))
    print("weapons without references:", len(manifest["missing"]))


if __name__ == "__main__":
    main()
