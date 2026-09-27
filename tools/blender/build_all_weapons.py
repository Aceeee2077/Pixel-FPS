"""Build every weapon in the priority order from the asset brief.

    blender -b -P tools/blender/build_all_weapons.py
    blender -b -P tools/blender/build_all_weapons.py -- --only ak-47 awp --no-render
    blender -b -P tools/blender/build_all_weapons.py -- --skip-render

Each weapon runs the full pipeline: build -> bake modifiers -> validate ->
render previews -> silhouette compare against the reference -> export GLB +
.blend -> record in the manifest. Regenerating ``src/data/weaponAssets.ts`` and
copying into ``public/`` is a separate publish step (see publish_assets.mjs).
"""
import argparse
import json
import sys
import traceback
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE / "weapons"))

import build_weapon
import weapon_validation as validation
from weapon_silhouette import compare_with_reference, reference_for

# Priority order from the brief: rifles and pistols first, then knives.
BATCH_ONE = ["ak-47", "m4a4", "m4a1-s", "awp", "glock", "usp-s", "deagle"]
BATCH_TWO = ["famas", "galil-ar", "aug", "sg-553", "ssg-08", "scar-20", "g3sg1"]
BATCH_THREE = ["butterfly", "karambit", "m9", "knife"]
BATCH_FOUR = ["p2000", "p250", "five-seven", "tec-9", "cz75",
              "mp9", "mac-10", "mp7", "pp-bizon", "p90", "ump-45"]
ALL = BATCH_ONE + BATCH_TWO + BATCH_THREE + BATCH_FOUR


def run(weapon_id, render=True, resolution=900, samples=40, strict=True):
    result = {"weapon": weapon_id}
    try:
        report, record, outputs = build_weapon.build_one(
            weapon_id, render=render, samples=samples, resolution=resolution)
        result["record"] = record
        result["stats"] = report["stats"]
        result["ok"] = report["ok"]
        # Silhouette scoring is advisory: a low reference-mask quality must never
        # silently mark a weapon as finished, but it must not block a good model.
        comparison = compare_with_reference(weapon_id, report["stats"]["triangles"])
        if comparison:
            result["silhouette"] = comparison
            record["silhouette"] = comparison
    except Exception as error:  # keep the whole batch alive
        result["ok"] = False
        result["error"] = "%s: %s" % (type(error).__name__, error)
        result["traceback"] = traceback.format_exc()
        print("!! %s failed: %s" % (weapon_id, error))
        print(result["traceback"])
    return result


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--only", nargs="*", default=None)
    parser.add_argument("--no-render", action="store_true")
    parser.add_argument("--resolution", type=int, default=900)
    parser.add_argument("--samples", type=int, default=40)
    args = parser.parse_args(argv)

    queue = args.only if args.only else ALL
    results = []
    for weapon_id in queue:
        if not (HERE / "weapons" / (weapon_id.replace("-", "") + ".py")).exists():
            print("-- %-10s no module yet, skipped" % weapon_id)
            results.append({"weapon": weapon_id, "ok": False, "error": "module missing"})
            continue
        print("\n=== %s ===" % weapon_id)
        results.append(run(weapon_id, not args.no_render, args.resolution, args.samples))

    out = HERE / "reports"
    out.mkdir(exist_ok=True)
    (out / "build_all.json").write_text(json.dumps(results, indent=2), encoding="utf-8")

    print("\n================ WEAPON BUILD SUMMARY ================")
    good = 0
    for result in results:
        record = result.get("record") or {}
        silhouette = result.get("silhouette") or {}
        if result.get("ok"):
            good += 1
        detail = result.get("error", "")
        line = "%-12s %-8s tris %7s  mats %2s  %s" % (
            result["weapon"], record.get("status", "missing"),
            record.get("triangles", "-"), record.get("materials", "-"),
            "OK" if result.get("ok") else "FAIL " + detail)
        if silhouette:
            line += "  silhouette IoU %s" % silhouette.get("iou")
        print(line)
    print("built %d / %d" % (good, len(results)))
    print("reports:", (out / "build_all.json").relative_to(HERE.parents[1]))


if __name__ == "__main__":
    main()
