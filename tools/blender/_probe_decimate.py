"""Measure how authored density maps to survivors after the web-budget collapse."""
import importlib
import sys
from pathlib import Path

import bpy

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE / "weapons"))

import weapon_common as common
import weapon_materials as materials
import build_weapon

weapon_id = sys.argv[sys.argv.index("--") + 1]
module = importlib.import_module(weapon_id.replace("-", "").replace("_", ""))

common.reset_scene()
root = module.build(materials.gun_palette())
meshes = [o for o in [root] + list(root.children_recursive) if o.type == "MESH"]
for obj in meshes:
    with common.active(obj):
        for modifier in list(obj.modifiers):
            try:
                bpy.ops.object.modifier_apply(modifier=modifier.name)
            except RuntimeError:
                pass
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="SELECT")
        bpy.ops.mesh.quads_convert_to_tris(quad_method="BEAUTY", ngon_method="BEAUTY")
        bpy.ops.object.mode_set(mode="OBJECT")

for obj in meshes:
    obj.data.calc_loop_triangles()
authored = [(len(obj.data.loop_triangles), obj.name) for obj in meshes]
total_authored = sum(item[0] for item in authored)
print("authored total %d over %d meshes" % (total_authored, len(meshes)))

for ratio in (0.9, 0.6, 0.4, 0.25, 0.15, 0.08):
    survivors = 0
    for obj in meshes:
        copy = obj.data.copy()
        probe = bpy.data.objects.new("probe", copy)
        bpy.context.collection.objects.link(probe)
        copy.calc_loop_triangles()
        start = len(copy.loop_triangles)
        modifier = probe.modifiers.new("p", "DECIMATE")
        modifier.decimate_type = "COLLAPSE"
        modifier.ratio = ratio
        modifier.use_collapse_triangulate = True
        with common.active(probe):
            try:
                bpy.ops.object.modifier_apply(modifier=modifier.name)
            except RuntimeError:
                pass
        copy.calc_loop_triangles()
        survivors += len(copy.loop_triangles)
        bpy.data.objects.remove(probe, do_unlink=True)
        bpy.data.meshes.remove(copy, do_unlink=True)
    print("ratio %.2f -> survivors %d (%.0f%% of authored)" % (ratio, survivors, 100.0 * survivors / total_authored))
