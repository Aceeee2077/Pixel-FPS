"""Dump the object graph the knife conversion sees, to find the real parents."""
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import bpy
from mathutils import Vector
import convert_user_model as conv

source = HERE.parents[1] / "csgo-styled_butterfly_knife.glb"
print("### RAW IMPORT")
conv.common.reset_scene()
bpy.ops.import_scene.gltf(filepath=str(source))
for obj in bpy.data.objects:
    print("   %-52s %-6s parent=%-46s children=%d"
          % (obj.name, obj.type, obj.parent.name if obj.parent else "-", len(obj.children)))

objects = [o for o in bpy.data.objects if o.type == "MESH"]
objects = conv.bake_transforms(objects)
conv.normalise(objects, 0.240, "auto", "butterfly", False)
conv.recentre_grip(objects, "butterfly", "knife")
root, body = conv.build_hierarchy(objects, "butterfly", "knife")

print("### BEFORE convert_orientations")
for obj in bpy.data.objects:
    world = obj.matrix_world.to_scale()
    print("   %-52s %-6s parent=%-30s children=%d scale=[%.4g %.4g %.4g]"
          % (obj.name, obj.type, obj.parent.name if obj.parent else "-",
             len(obj.children), world.x, world.y, world.z))

print("### name matching")
for obj in bpy.data.objects:
    if obj.type != "EMPTY":
        continue
    low = obj.name.lower()
    print("   EMPTY %-52s blade=%s handle=%s grip=%s"
          % (obj.name, "blade" in low, "base_handle" in low, "grip" in low))
