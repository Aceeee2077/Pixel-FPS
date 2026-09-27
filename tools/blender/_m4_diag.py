"""TEMPORARY diagnostic renderer (high-contrast Workbench views).

Not part of the weapon pipeline: it exists only so the silhouette and the small
mechanical details can be checked at high contrast while authoring. Delete when
the weapon modules are finished.

    blender -b --factory-startup -P tools/blender/_m4_diag.py -- --weapon m4a4
"""
import argparse
import importlib
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE / "weapons"))

import weapon_common as common  # noqa: E402
import weapon_materials as materials  # noqa: E402

OUT = HERE / "previews"


def bounds(objects):
    minimum = Vector((1e9, 1e9, 1e9))
    maximum = Vector((-1e9, -1e9, -1e9))
    for obj in objects:
        if obj.type != "MESH":
            continue
        for corner in obj.bound_box:
            point = obj.matrix_world @ Vector(corner)
            for axis in range(3):
                minimum[axis] = min(minimum[axis], point[axis])
                maximum[axis] = max(maximum[axis], point[axis])
    return minimum, maximum


def aim(camera, target):
    camera.rotation_euler = (Vector(target) - camera.location).to_track_quat("-Z", "Y").to_euler()


def setup(resolution):
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_WORKBENCH"
    shading = scene.display.shading
    shading.light = "STUDIO"
    shading.color_type = "MATERIAL"
    shading.show_object_outline = True
    shading.object_outline_color = (0.02, 0.02, 0.03)
    shading.show_cavity = True
    shading.cavity_type = "BOTH"
    shading.curvature_ridge_factor = 1.5
    shading.curvature_valley_factor = 1.2
    shading.show_shadows = False
    shading.background_type = "VIEWPORT"
    shading.background_color = (0.26, 0.29, 0.33)
    scene.render.resolution_x = resolution
    scene.render.resolution_y = resolution
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = False
    scene.render.image_settings.file_format = "PNG"
    scene.view_settings.view_transform = "Standard"


def repaint(root):
    """Flat light-grey clay so geometry reads instead of the near-black palette."""
    clay = bpy.data.materials.new("DiagClay")
    clay.use_nodes = True
    bsdf = clay.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (0.62, 0.62, 0.60, 1.0)
    bsdf.inputs["Metallic"].default_value = 0.0
    bsdf.inputs["Roughness"].default_value = 0.55
    for obj in [root] + list(root.children_recursive):
        if obj.type != "MESH":
            continue
        obj.data.materials.clear()
        obj.data.materials.append(clay)



def shoot(weapon_id, name, yaw, pitch, centre, span, resolution):
    distance = span * 2.4
    location = (
        centre.x + math.sin(yaw) * distance * math.cos(pitch),
        centre.y - math.cos(yaw) * distance * math.cos(pitch),
        centre.z + math.sin(pitch) * distance,
    )
    data = bpy.data.cameras.new("DiagCamera")
    data.type = "ORTHO"
    data.ortho_scale = span * 1.12
    camera = bpy.data.objects.new("DiagCamera", data)
    bpy.context.collection.objects.link(camera)
    camera.location = location
    aim(camera, centre)
    bpy.context.scene.camera = camera
    path = OUT / ("%s_diag_%s.png" % (weapon_id, name))
    bpy.context.scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(camera, do_unlink=True)
    print("DIAG", path)


def closeup(weapon_id, name, yaw, pitch, centre, span, resolution):
    """Orthographic zoom on one sub-assembly, for reading small mechanics."""
    distance = span * 6.0
    location = (
        centre.x + math.sin(yaw) * distance * math.cos(pitch),
        centre.y - math.cos(yaw) * distance * math.cos(pitch),
        centre.z + math.sin(pitch) * distance,
    )
    data = bpy.data.cameras.new("DetailCamera")
    data.type = "ORTHO"
    data.ortho_scale = span
    camera = bpy.data.objects.new("DetailCamera", data)
    bpy.context.collection.objects.link(camera)
    camera.location = location
    aim(camera, centre)
    bpy.context.scene.camera = camera
    path = OUT / ("%s_diag_%s.png" % (weapon_id, name))
    bpy.context.scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(camera, do_unlink=True)
    print("DIAG", path)


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--weapon", required=True)
    parser.add_argument("--resolution", type=int, default=1000)
    parser.add_argument("--tris", action="store_true")
    args = parser.parse_args(argv)

    module = importlib.reload(importlib.import_module(args.weapon.replace("-", "").replace("_", "")))
    common.reset_scene()
    root = module.build(materials.gun_palette())
    import build_weapon
    import weapon_validation as validation
    build_weapon.bake_geometry(root, module.CATEGORY)
    common.batch_by_material(root)
    print("DIAG", validation.summary_line(validation.validate(root, args.weapon, module.CATEGORY)))
    minimum, maximum = bounds([root] + list(root.children_recursive))
    print("DIAG extents y %.3f .. %.3f   z %.3f .. %.3f   x %.3f .. %.3f"
          % (minimum.y, maximum.y, minimum.z, maximum.z, minimum.x, maximum.x))
    for obj in [root] + list(root.children_recursive):
        if obj.type != "MESH":
            continue
        lo, hi = bounds([obj])
        if abs(hi.x) > 0.034 or lo.y < -0.328:
            print("DIAG wide %-26s x %.3f..%.3f  y %.3f..%.3f z %.3f..%.3f"
                  % (obj.name, lo.x, hi.x, lo.y, hi.y, lo.z, hi.z))
    centre = (minimum + maximum) / 2
    span = max(maximum.x - minimum.x, maximum.y - minimum.y, maximum.z - minimum.z)
    setup(args.resolution)
    repaint(root)
    OUT.mkdir(parents=True, exist_ok=True)
    shoot(args.weapon, "side", math.pi / 2, 0.0, centre, span, args.resolution)
    shoot(args.weapon, "hero", math.pi / 2 + 0.75, 0.34, centre, span, args.resolution)
    shoot(args.weapon, "rear", 0.0, 0.10, centre, span, args.resolution)
    closeup(args.weapon, "lower", math.pi / 2 + 0.35, 0.30,
            Vector((0.0, -0.055, -0.035)), 0.30, args.resolution)
    closeup(args.weapon, "breech", math.pi / 2 + 0.55, 0.32,
            Vector((0.02, 0.010, 0.005)), 0.26, args.resolution)
    closeup(args.weapon, "muzzle", math.pi / 2 + 0.35, 0.28,
            Vector((0.0, span * 0.30, 0.0)), 0.26, args.resolution)
    return 0


if __name__ == "__main__":
    sys.exit(main())
