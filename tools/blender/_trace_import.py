"""Trace how the glTF importer's hierarchy affects object scale."""
import bpy
from mathutils import Vector

PATH = r"D:\Codex Project\Pixel FPS\csgo_ak47_wild_lotus.glb"
bpy.ops.import_scene.gltf(filepath=PATH)


def dump(label):
    print("---", label)
    for obj in bpy.data.objects:
        parent = obj.parent.name if obj.parent else "-"
        scale = obj.matrix_world.to_scale()
        print("   %-42s type=%-6s parent=%-28s scale=[%.5f %.5f %.5f] loc=[%.2f %.2f %.2f]"
              % (obj.name, obj.type, parent, scale.x, scale.y, scale.z,
                 obj.matrix_world.translation.x, obj.matrix_world.translation.y,
                 obj.matrix_world.translation.z))


dump("as imported")

meshes = [o for o in bpy.data.objects if o.type == "MESH"]
# flatten: detach every mesh (and its mesh descendants) from the empty chain
for obj in meshes:
    world = obj.matrix_world.copy()
    obj.parent = None
    obj.matrix_world = world
bpy.context.view_layer.update()
dump("after unparenting meshes")

bpy.ops.object.select_all(action="DESELECT")
for obj in meshes:
    obj.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
bpy.context.view_layer.update()
dump("after transform_apply")

mn = Vector((1e18,) * 3)
mx = Vector((-1e18,) * 3)
for obj in meshes:
    for corner in obj.bound_box:
        point = obj.matrix_world @ Vector(corner)
        for i in range(3):
            mn[i] = min(mn[i], point[i])
            mx[i] = max(mx[i], point[i])
print("SIZE", [round(v, 3) for v in (mx - mn)])
print("LOCAL_SCALE", [tuple(round(v, 6) for v in o.scale) for o in meshes])
