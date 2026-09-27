"""Measure one weapon's triangles before and after each bake step."""
import sys
from pathlib import Path

import bpy

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import build_weapon as builder  # noqa: E402
import weapon_common as common  # noqa: E402
import weapon_materials as materials  # noqa: E402

module = builder.load(sys.argv[-1])
common.reset_scene()
root = module.build(materials.gun_palette())


def total(label):
    bpy.context.view_layer.update()
    tris = 0
    verts = 0
    for obj in [root] + list(root.children_recursive):
        if obj.type != "MESH":
            continue
        obj.data.calc_loop_triangles()
        tris += len(obj.data.loop_triangles)
        verts += len(obj.data.vertices)
    print("STEP %-22s tris %7d  verts %7d  objects %d" % (label, tris, verts,
          len([o for o in [root] + list(root.children_recursive) if o.type == "MESH"])))
    return tris


mods = {}
for obj in [root] + list(root.children_recursive):
    if obj.type == "MESH":
        for m in obj.modifiers:
            mods[m.type] = mods.get(m.type, 0) + 1
print("MODIFIERS", mods)
print("BEVEL width sample", [ (o.name, [round(m.width,4) for m in o.modifiers if m.type=="BEVEL"]) for o in [root]+list(root.children_recursive) if o.type=="MESH" and any(m.type=="BEVEL" for m in o.modifiers)][:4])
total("authored (no modifiers)")
baked = total("after bake_geometry")
common.batch_by_material(root)
total("after batch")
print("STEPS modifiers_applied=%d" % baked)
