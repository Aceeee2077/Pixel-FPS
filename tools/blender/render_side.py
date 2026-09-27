"""Orthographic side elevation of one weapon, for the visual self-check loop.

``weapon_preview.py`` renders the hero 3/4 view, a "side" view that actually
looks along the bore axis, and a front view. None of those show the silhouette
the reference art is calibrated against, so this helper renders a true profile:
camera on the weapon's +X axis, pitched slightly down, so the muzzle points to
the right of frame exactly like the reference sheets (mirrored).

    blender -b --factory-startup -P tools/blender/render_side.py -- --weapon awp
"""
import argparse
import math
import sys
from pathlib import Path

import bpy

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import build_weapon as builder  # noqa: E402  (needs the sys.path entry)
import weapon_common as common  # noqa: E402
import weapon_materials as materials  # noqa: E402
import weapon_preview as preview  # noqa: E402

OUT_DIR = HERE / "previews"


def render_profile(weapon_id, resolution=900, samples=32, pitch=0.05, flat=False,
                   width=None):
    module = builder.load(weapon_id)
    common.reset_scene()
    palette = materials.gun_palette() if module.CATEGORY != "knife" else materials.knife_palette()
    root = module.build(palette)
    builder.bake_geometry(root)

    objects = [root] + list(root.children_recursive)
    minimum, maximum = preview._object_bounds(objects)
    centre = (minimum + maximum) / 2
    size = maximum - minimum
    span = max(size.x, size.y, size.z)

    if flat:
        # Near-white matte clay on a light backdrop: the outline, the thickness
        # and every bevel read clearly, which is what a visual self-check needs.
        clay = bpy.data.materials.new("InspectClay")
        clay.use_nodes = True
        bsdf = clay.node_tree.nodes.get("Principled BSDF")
        bsdf.inputs["Base Color"].default_value = (0.82, 0.83, 0.85, 1.0)
        bsdf.inputs["Roughness"].default_value = 0.42
        bsdf.inputs["Metallic"].default_value = 0.0
        for obj in objects:
            if obj.type == "MESH":
                obj.data.materials.clear()
                obj.data.materials.append(clay)
        scene = bpy.context.scene
        scene.render.engine = "BLENDER_WORKBENCH"
        scene.display.shading.light = "STUDIO"
        scene.display.shading.studio_light = "Default"
        scene.display.shading.color_type = "MATERIAL"
        scene.display.shading.show_shadows = False
        scene.display.shading.show_cavity = False
        scene.display.shading.show_object_outline = True
        scene.display.shading.object_outline_color = (0.06, 0.06, 0.07)
        scene.display.shading.background_type = "VIEWPORT"
        scene.display.shading.background_color = (0.90, 0.91, 0.93)
        scene.render.resolution_x = resolution
        scene.render.resolution_y = int(resolution * 0.42) if width is None else resolution
        scene.render.resolution_percentage = 100
        scene.render.film_transparent = False
        scene.render.image_settings.file_format = "PNG"
    else:
        preview.setup_studio(resolution, samples)
        preview._gradient_backdrop()
        preview._lights()

    distance = span * 2.4
    camera = preview._camera(
        (centre.x + distance * math.cos(pitch),
         centre.y - distance * math.sin(pitch) * 0.35,
         centre.z + distance * math.sin(pitch)),
        centre, ortho_scale=span * 1.04)
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = span * 1.04

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    suffix = "flat" if flat else "profile"
    path = OUT_DIR / ("%s_%s.png" % (weapon_id, suffix))
    bpy.context.scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)
    print("PROFILE", path)
    return path


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--weapon", required=True)
    parser.add_argument("--resolution", type=int, default=900)
    parser.add_argument("--samples", type=int, default=32)
    parser.add_argument("--flat", action="store_true")
    args = parser.parse_args(argv)
    render_profile(args.weapon, args.resolution, args.samples, flat=args.flat)
    return 0


if __name__ == "__main__":
    sys.exit(main())
