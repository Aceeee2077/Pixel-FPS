"""Per-part triangle report for one weapon module, measured after baking.

    blender -b --factory-startup -P tools/blender/tri_report.py -- --weapon awp
"""
import argparse
import sys
from pathlib import Path

import bpy

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import build_weapon as builder  # noqa: E402
import weapon_common as common  # noqa: E402
import weapon_materials as materials  # noqa: E402
import weapon_validation as validation  # noqa: E402


def report(weapon_id, top=24):
    module = builder.load(weapon_id)
    common.reset_scene()
    root = module.build(materials.gun_palette())
    builder.bake_geometry(root)
    common.batch_by_material(root)
    stats = validation.measure(root)
    print("TRIS %s  total=%d  meshes=%d  materials=%d"
          % (weapon_id, stats["triangles"], stats["mesh_objects"], len(stats["materials"])))
    print("  materials: %s" % ", ".join(stats["materials"]))
    for name, count in sorted(stats["parts"].items(), key=lambda kv: -kv[1])[:top]:
        print("   %-34s %6d" % (name, count))
    return stats


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--weapon", required=True)
    parser.add_argument("--top", type=int, default=24)
    args = parser.parse_args(argv)
    report(args.weapon, args.top)
    return 0


if __name__ == "__main__":
    sys.exit(main())
