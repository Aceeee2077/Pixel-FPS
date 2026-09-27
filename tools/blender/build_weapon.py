"""Build a single weapon: geometry -> validation -> preview -> export.

    blender -b -P tools/blender/build_weapon.py -- --weapon ak-47
    blender -b -P tools/blender/build_weapon.py -- --weapon ak-47 --no-render
    blender -b -P tools/blender/build_weapon.py -- --weapon ak-47 --passes 3
"""
import argparse
import importlib
import json
import math
import sys
from pathlib import Path

import bpy

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(HERE))

import weapon_common as common
import weapon_materials as materials
import weapon_preview as preview
import weapon_validation as validation
from weapon_export import export_weapon, update_manifest

MODULE_DIR = HERE / "weapons"
sys.path.insert(0, str(MODULE_DIR))

# Per-weapon export status. ``final`` is only granted after a clean validation
# report plus at least two refinement passes with a matched silhouette.
# ``game_ready`` means it built, validated and rendered; ``refining`` means a
# reference exists but the model still needs work; ``needs_more_reference``
# means the project ships no reference art for that weapon.
STATUS = {
    "ak-47": "game_ready",
}


def status_for(weapon_id):
    return STATUS.get(weapon_id, "refining")


def load(weapon_id):
    module_name = weapon_id.replace("-", "").replace("_", "")
    module = importlib.import_module(module_name)
    return importlib.reload(module)


# Web-game density targets. A browser FPS reads these weapons from a few metres
# at most, so the mesh is decimated to a budget rather than shipped at authoring
# density. Silhouette is preserved because the collapse works on the beveled,
# already-detailed cage.
WEB_TRIANGLE_TARGET = {
    "pistol": 8000,
    "rifle": 12000,
    "smg": 9000,
    "sniper": 14000,
    "shotgun": 6000,
    "knife": 8000,
    "machine-gun": 8000,
}


def bake_geometry(root, category=None):
    """Apply bevels/weighted normals, triangulate and weld before measurement.

    Blender's bevel and weighted-normal modifiers are authored on the live
    objects; glTF export with ``export_apply=False`` would ship the un-beveled
    cage, so every modifier is applied here. Triangulation after the bevel keeps
    the exported triangle count honest for the budget gate, and welding removes
    the per-face vertex copies that flat shading would otherwise export.
    """
    meshes = [obj for obj in [root] + list(root.children_recursive) if obj.type == "MESH"]
    applied = 0
    welded = 0
    for obj in meshes:
        with common.active(obj):
            for modifier in list(obj.modifiers):
                try:
                    bpy.ops.object.modifier_apply(modifier=modifier.name)
                    applied += 1
                except RuntimeError as error:
                    print("  ! modifier %s on %s: %s" % (modifier.name, obj.name, error))
            try:
                bpy.ops.object.mode_set(mode="EDIT")
                bpy.ops.mesh.select_all(action="SELECT")
                bpy.ops.mesh.quads_convert_to_tris(quad_method="BEAUTY", ngon_method="BEAUTY")
                bpy.ops.mesh.remove_doubles(threshold=0.00015)
                bpy.ops.mesh.normals_make_consistent(inside=False)
                bpy.ops.object.mode_set(mode="OBJECT")
                # Angle-based smoothing keeps hard machined edges hard while
                # letting the exporter share vertices along smooth surfaces.
                for polygon in obj.data.polygons:
                    polygon.use_smooth = True
                try:
                    bpy.ops.object.shade_smooth_by_angle(angle=math.radians(31))
                except (AttributeError, RuntimeError, TypeError):
                    try:
                        bpy.ops.object.shade_auto_smooth(angle=math.radians(31))
                    except (AttributeError, RuntimeError, TypeError):
                        pass
                common.quantize_uv(obj)
                welded += 1
            except RuntimeError as error:
                print("  ! triangulate %s: %s" % (obj.name, error))
    bpy.context.view_layer.update()
    print("   welded %d meshes" % welded)
    target = WEB_TRIANGLE_TARGET.get(category)
    if target:
        meshes = [obj for obj in [root] + list(root.children_recursive) if obj.type == "MESH"]
        for obj in meshes:
            obj.data.calc_loop_triangles()
        before = sum(len(obj.data.loop_triangles) for obj in meshes)
        # One global ratio for the whole weapon. Decimating each part against a
        # fixed per-part share would leave the small parts untouched and
        # overshoot the budget entirely.
        if before > target > 0:
            ratio = max(0.15, target / float(before))
            for obj in meshes:
                modifier = obj.modifiers.new("WebBudget", "DECIMATE")
                modifier.decimate_type = "COLLAPSE"
                modifier.ratio = ratio
                modifier.use_collapse_triangulate = True
                with common.active(obj):
                    try:
                        bpy.ops.object.modifier_apply(modifier=modifier.name)
                    except RuntimeError:
                        obj.modifiers.remove(modifier)
        meshes = [obj for obj in [root] + list(root.children_recursive) if obj.type == "MESH"]
        for obj in meshes:
            obj.data.calc_loop_triangles()
            common.quantize_uv(obj)
        after = sum(len(obj.data.loop_triangles) for obj in meshes)
        print("   decimated %d -> %d tris (web target %d)" % (before, after, target))
    return applied


def build_one(weapon_id, render=True, samples=48, resolution=900):
    module = load(weapon_id)
    # The module owns its canonical id. The loader strips dashes to find the
    # file, so ``ssg-08`` and ``ssg08`` must record the same registry entry
    # instead of leaking a duplicate key into the manifest.
    weapon_id = getattr(module, "WEAPON_ID", weapon_id)
    common.reset_scene()
    palette = materials.gun_palette() if module.CATEGORY != "knife" else materials.knife_palette()
    root = module.build(palette)
    root["weapon_id"] = weapon_id
    root["display_name"] = getattr(module, "DISPLAY", weapon_id)
    root["category"] = module.CATEGORY
    root["forward_axis"] = "+Y in Blender / -Z in glTF"

    applied = bake_geometry(root, module.CATEGORY)
    print("   baked %d modifiers" % applied)
    common.batch_by_material(root)

    report = validation.validate(root, weapon_id, module.CATEGORY)
    print(validation.summary_line(report))
    for warning in report["warnings"][:6]:
        print("   warn:", warning)

    outputs = {}
    if render and report["ok"]:
        outputs = preview.render_previews(root, weapon_id, resolution=resolution, samples=samples)
        print("   previews:", ", ".join(str(p.name) for p in outputs.values()))

    glb = blend = None
    if report["ok"]:
        glb, blend = export_weapon(weapon_id, root, module.CATEGORY)
        print("   glb:", glb.relative_to(ROOT), " blend:", blend.relative_to(ROOT))
    else:
        print("   !! export blocked by validation failures")

    record = {
        "model": "/assets/weapons/%s/%s.glb" % (weapon_id, weapon_id),
        "preview": "/assets/weapons/%s/preview.webp" % weapon_id,
        "status": status_for(weapon_id) if report["ok"] else "blocked",
        "category": module.CATEGORY,
        "has_reference": bool(getattr(module, "HAS_REFERENCE", True)),
        "triangles": report["stats"]["triangles"],
        "materials": len(report["stats"]["materials"]),
        "parts": report["stats"]["mesh_objects"],
        "validation": {"ok": report["ok"], "failures": report["failures"],
                       "warnings": report["warnings"][:8]},
        "blend": "assets-source/blender/%s.blend" % weapon_id,
    }
    if report["ok"]:
        update_manifest({weapon_id: record})
    return report, record, outputs


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--weapon", required=True)
    parser.add_argument("--no-render", action="store_true")
    parser.add_argument("--samples", type=int, default=48)
    parser.add_argument("--resolution", type=int, default=900)
    args = parser.parse_args(argv)

    report, record, _ = build_one(args.weapon, not args.no_render,
                                  args.samples, args.resolution)
    out = HERE / "reports"
    out.mkdir(exist_ok=True)
    (out / ("%s.json" % args.weapon)).write_text(
        json.dumps({"record": record, "stats": report["stats"]}, indent=2), encoding="utf-8")
    print("REPORT", json.dumps({k: record[k] for k in ("status", "triangles", "materials")}))
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
