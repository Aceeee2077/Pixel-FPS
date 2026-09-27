"""Temporary diagnostic probe for the knife modules (deleted after use)."""
import sys
from pathlib import Path

import bpy

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE / "weapons"))

import build_weapon
import weapon_common as common
import weapon_materials as materials
import weapon_validation as validation

weapon_id = sys.argv[sys.argv.index("--") + 1]


def total(tag, root=None):
    root = root or bpy.data.objects[weapon_id + "_Root"]
    stats = validation.measure(root)
    print("  %-22s TOTAL %-6d meshes %d" % (tag, stats["triangles"], stats["mesh_objects"]))


original_bake = build_weapon.bake_geometry
original_batch = common.batch_by_material
original_build = None


def traced_bake(root):
    print("   [enter bake]")
    total("before bake")
    result = original_bake(root)
    total("after bake")
    return result


def traced_batch(root):
    result = original_batch(root)
    total("after batch")
    return result


build_weapon.bake_geometry = traced_bake
common.batch_by_material = traced_batch

module = build_weapon.load(weapon_id)
print("   CATEGORY:", repr(module.CATEGORY), "DISPLAY:", repr(getattr(module, "DISPLAY", None)))
report, record, _ = build_weapon.build_one(weapon_id, render=False)
total("final")
