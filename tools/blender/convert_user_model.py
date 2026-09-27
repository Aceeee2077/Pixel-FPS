"""Convert a third-party GLB into this project's weapon contract.

    blender -b -P tools/blender/convert_user_model.py -- \
        --source csgo_ak47_wild_lotus.glb --weapon ak-47 --variant wildlotus \
        --target-length 0.88 --orientation auto

Sketchfab exports are authored for viewing, not for a first-person rig: they are
tens of metres long, their geometry is far from the origin, and they carry none
of the anchors the game reads. This step normalises them:

  * scale to a real-world length,
  * orient the muzzle toward +Y (auto-detected by scoring both directions
    against the project's own reference silhouette),
  * move the origin to the grip,
  * add ``Muzzle``, ``ViewmodelAnchor``, ``LeftHandIK``, ``RightHandIK``,
  * turn the knife's handle nodes into real ``PivotLeft``/``PivotRight`` pivots.

It does not generate geometry and does not claim the model is original work:
provenance and licence are recorded in the asset manifest and CREDITS.md.
"""
import argparse
import json
import math
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(HERE))

import bpy
from mathutils import Matrix, Vector

import weapon_common as common
import weapon_preview as preview
import weapon_silhouette
import weapon_validation as validation
from weapon_export import GLB_DIR, SOURCE_DIR, export_weapon, update_manifest

# id -> (target length in metres, category, whether the blade family needs pivots)
TARGETS = {
    "ak-47": (0.880, "rifle"),
    "awp": (1.240, "sniper"),
    "butterfly": (0.240, "knife"),
}

PROVENANCE = {
    "csgo_ak47_wild_lotus.glb": {
        "author": "WoodenManufacturing",
        "source": "https://sketchfab.com/3d-models/csgo-ak47-wild-lotus-0af74d693a014c4d9fe5538b99dc0355",
        "licence": "CC-BY-4.0",
    },
    "csgo_weapon_awp_gungnir.glb": {
        "author": "WoodenManufacturing",
        "source": "https://sketchfab.com/3d-models/csgo-weapon-awp-gungnir-e1d6a40dc1f1499c8b960b05d13e7f6c",
        "licence": "CC-BY-4.0",
    },
    "csgo-styled_butterfly_knife.glb": {
        "author": "Aslady",
        "source": "https://sketchfab.com/3d-models/csgo-styled-butterfly-knife-6f023e5fb12947e18ce2d93d38e13cfd",
        "licence": "CC-BY-4.0",
    },
}


def import_source(path):
    common.reset_scene()
    # A factory-startup scene still has a Cube/Camera/Light; they would otherwise
    # be imported *and* exported, and they pollute the bounding box.
    for obj in list(bpy.data.objects):
        if obj.type in {"MESH", "CAMERA", "LIGHT"} and not obj.data.users > 0:
            bpy.data.objects.remove(obj, do_unlink=True)
    bpy.ops.import_scene.gltf(filepath=str(path))
    for obj in list(bpy.data.objects):
        if obj.type in {"CAMERA", "LIGHT"}:
            bpy.data.objects.remove(obj, do_unlink=True)
    meshes = [obj for obj in bpy.data.objects if obj.type == "MESH"]
    if not meshes:
        raise SystemExit("no mesh imported from %s" % path)
    return meshes


def _debug_scales(label, objects):
    """Temporary instrumentation while the transform pipeline is being verified."""
    parts = []
    for obj in objects:
        world = obj.matrix_world.to_scale()
        local = obj.scale
        parts.append("%s world=[%.4g %.4g %.4g] local=[%.4g %.4g %.4g] parent=%s"
                     % (obj.name, world.x, world.y, world.z,
                        local.x, local.y, local.z,
                        obj.parent.name if obj.parent else "-"))
    print("   scales %s: %s" % (label, " | ".join(parts)))


def _scale_matrix(scale):
    """Uniform scale matrix, with [3][3] left at 1 so it stays a scale matrix."""
    matrix = Matrix.Identity(4)
    matrix[0][0] = scale
    matrix[1][1] = scale
    matrix[2][2] = scale
    return matrix


def _translate_matrix(delta):
    return Matrix.Translation(delta)


def apply_transform(objects):
    """Bake each mesh's *world* matrix into its vertices, then reset the object.

    ``bpy.ops.object.transform_apply`` bakes the local transform only, so a mesh
    parented under a scaled glTF node (the Sketchfab exports sit under a 100x
    node) keeps that scale and inflates on reparenting. Writing world-space
    vertices directly sidesteps the operator entirely.
    """
    meshes = [obj for obj in objects if obj.type == "MESH"]
    if not meshes:
        return objects
    bpy.context.view_layer.update()
    for obj in meshes:
        world = obj.matrix_world.copy()
        for vertex in obj.data.vertices:
            vertex.co = world @ vertex.co
        obj.data.update()
        obj.matrix_world = Matrix.Identity(4)
    bpy.context.view_layer.update()
    return objects


def bake_transforms(meshes):
    """Unparent meshes from scaled glTF nodes, then bake their transforms."""
    for obj in meshes:
        if obj.parent is not None and obj.parent.type == "MESH":
            world = obj.matrix_world.copy()
            obj.parent = None
            obj.matrix_world = world
    bpy.context.view_layer.update()
    return apply_transform(meshes)


def bounds(objects):
    minimum = Vector((1e18, 1e18, 1e18))
    maximum = Vector((-1e18, -1e18, -1e18))
    for obj in objects:
        for corner in obj.bound_box:
            point = obj.matrix_world @ Vector(corner)
            for i in range(3):
                minimum[i] = min(minimum[i], point[i])
                maximum[i] = max(maximum[i], point[i])
    return minimum, maximum


def _rotations_for_axis(axis):
    """Rotations that map a source axis onto +Y, with a 180 degree variant."""
    return {
        0: [(0, 0, math.radians(-90)), (0, 0, math.radians(90))],
        1: [(0, 0, 0), (0, 0, math.radians(180))],
        2: [(math.radians(-90), 0, 0), (math.radians(90), 0, 0)],
    }[axis]


GUESS_FLIP = {0: True, 1: True, 2: True}


def apply_rotation(objects, euler):
    """Rotate about the world origin so the parts keep their relative layout."""
    from mathutils import Euler
    rotation = Euler(euler, "XYZ").to_matrix().to_4x4()
    for obj in objects:
        obj.matrix_world = rotation @ obj.matrix_world
    bpy.context.view_layer.update()


def muzzle_end(objects, axis=1):
    """Which end of the long axis is the muzzle, by cross-section bulk.

    A rifle's receiver/stock end carries far more bulk than its barrel end, and
    a knife's blade tapers to a point while its handle does not. Summing the
    cross-axis magnitude of the vertices in each quarter of the length gives a
    cheap, dependency-free signal.
    """
    minimum, maximum = bounds(objects)
    span = maximum[axis] - minimum[axis] or 1.0
    other = [i for i in range(3) if i != axis]
    low = high = 0.0
    for obj in objects:
        matrix = obj.matrix_world
        for vertex in obj.data.vertices:
            point = matrix @ vertex.co
            t = (point[axis] - minimum[axis]) / span
            cross = abs(point[other[0]]) + abs(point[other[1]])
            if t < 0.25:
                low += cross
            elif t > 0.75:
                high += cross
    # the bulkier end is the receiver/handle, so the muzzle is the slimmer one
    return ("high" if high < low else "low"), low, high


def normalise(objects, target_length, orientation="auto", weapon_id=None, flip=False):
    """Scale to ``target_length`` and orient the muzzle toward +Y."""
    minimum, maximum = bounds(objects)
    size = maximum - minimum
    axis = max(range(3), key=lambda i: size[i])
    candidates = _rotations_for_axis(axis)
    if flip:
        candidates = list(reversed(candidates))

def normalise(objects, target_length, orientation="auto", weapon_id=None, flip=False):
    """Scale to ``target_length`` and orient the muzzle toward +Y.

    Each candidate rotation is scaled to the final length *before* it is scored,
    because the silhouette renderer frames the model and a 3.7 km-long import
    would sit far outside the camera's clip range.
    """
    minimum, maximum = bounds(objects)
    size = maximum - minimum
    axis = max(range(3), key=lambda i: size[i])
    candidates = _rotations_for_axis(axis)
    if flip:
        candidates = list(reversed(candidates))

    best = None
    for index, euler in enumerate(candidates):
        trial = [(obj, obj.matrix_world.copy()) for obj in objects]
        apply_rotation(objects, euler)
        # scale to the final size first so any measurement is at game scale
        minimum, maximum = bounds(objects)
        size = maximum - minimum
        raw_length = max(size)
        scale = target_length / raw_length if raw_length else 1.0
        for obj in objects:
            obj.matrix_world = obj.matrix_world.copy() @ _scale_matrix(scale)
        apply_transform(objects)
        bpy.context.view_layer.update()

        end, low, high = muzzle_end(objects)
        bulk = 1.0 if end == "high" else 0.0
        silhouette = 0.0
        if orientation == "auto" and weapon_id:
            silhouette = _silhouette_score(objects, weapon_id, "%s_orient%d" % (weapon_id, index))
        # Prefer the reference-outline match when it is informative; otherwise
        # fall back to which end of the weapon carries the bulk.
        score = silhouette if silhouette > 0.08 else bulk
        print("   orientation try %d %s -> silhouette %.4f bulk %.0f (muzzle at %s, %.1f vs %.1f)"
              % (index, tuple(round(math.degrees(v), 1) for v in euler), silhouette, bulk, end, low, high))
        if best is None or score > best["score"]:
            best = {"score": score, "euler": euler, "length": raw_length,
                    "silhouette": silhouette, "bulk": end, "scale": scale,
                    "method": "silhouette" if silhouette > 0.08 else "bulk"}
        # rewind geometry so the next candidate starts from the original pose
        for obj, matrix in trial:
            obj.matrix_world = matrix
        bpy.context.view_layer.update()

    apply_rotation(objects, best["euler"])
    apply_transform(objects)
    minimum, maximum = bounds(objects)
    size = maximum - minimum
    length = max(size)
    scale = target_length / length if length else 1.0
    for obj in objects:
        obj.matrix_world = obj.matrix_world.copy() @ _scale_matrix(scale)
    apply_transform(objects)
    bpy.context.view_layer.update()
    print("   oriented %s by %s (silhouette %.4f, muzzle at %s), scaled x%.6f (%.3f m -> %.3f m)"
          % (best["euler"], best["method"], best["silhouette"], best["bulk"],
             scale, best["length"], target_length))
    return best["euler"], scale


def _translate_matrix(delta):
    from mathutils import Matrix
    return Matrix.Translation(delta)


def _silhouette_score(objects, weapon_id, tag):
    """IoU of this orientation against the project's reference silhouette."""
    try:
        meshes = [obj for obj in objects if obj.type == "MESH"]
        score = weapon_silhouette.score_silhouette(meshes, weapon_id, tag)
        if score <= 0.0:
            print("   ! silhouette score 0 for %s (%d meshes) - falling back to bulk"
                  % (tag, len(meshes)))
        return score
    except Exception as error:  # noqa: BLE001 - scoring must never abort a build
        print("   ! silhouette scoring unavailable: %r" % (error,))
        return 0.0


def recentre_grip(objects, weapon_id, category):
    """Move the origin to the grip so the first-person mount lands correctly."""
    minimum, maximum = bounds(objects)
    size = maximum - minimum
    y_min, y_max = minimum.y, maximum.y
    length = max(size)
    if category == "knife":
        # origin at the blade/handle junction: keep the handle slightly behind it
        origin_y = y_min + length * 0.42
    else:
        # origin at the receiver front, roughly a third back from the muzzle
        origin_y = y_max - length * 0.34
    offset = Vector((0.0, origin_y, 0.0))
    for obj in objects:
        obj.matrix_world = _translate_matrix(-offset) @ obj.matrix_world
    apply_transform(objects)
    print("   origin moved to grip (y=%.3f, model %.3f m)" % (origin_y, length))
    return offset


def build_hierarchy(objects, weapon_id, category):
    """Reparent everything under a weapon root and add the game's anchors."""
    root = common.group("%s_Root" % weapon_id)
    body = common.group(weapon_id.upper().replace("-", ""), root)
    for obj in objects:
        matrix = obj.matrix_world.copy()
        obj.parent = body
        obj.matrix_parent_inverse = body.matrix_world.inverted()
        obj.matrix_world = matrix
    bpy.context.view_layer.update()
    return root, body


def convert_orientations(weapon_id, root, body, objects):
    """Give the butterfly knife real pivots so KnifeAnimationController can drive it.

    ``bake_transforms`` flattens the imported node graph (every mesh becomes a
    direct child), so the parts are located by their mesh names rather than by
    walking the original empties. Each handle gets a pivot at the end nearest the
    blade, which is where the real pivot pin sits.
    """
    if weapon_id != "butterfly":
        return
    meshes = [obj for obj in objects if obj.type == "MESH"]
    blade = [obj for obj in meshes if "blade_mat" in obj.name.lower() or obj.name.lower().startswith("blade")]
    for obj in blade:
        obj.name = "Blade"
    handles = []
    for obj in meshes:
        low = obj.name.lower()
        if obj in blade:
            continue
        if "base_handle" in low or "grip" in low:
            handles.append(obj)
    if not handles:
        print("   ! no handle meshes matched; knife pivots not created")
        return
    # group the handle meshes by which handle they belong to
    groups = {}
    for obj in handles:
        low = obj.name.lower()
        key = "left" if "base_handle" in low else "right"
        groups.setdefault(key, []).append(obj)
    for index, (key, members) in enumerate(sorted(groups.items())):
        minimum = Vector((1e18, 1e18, 1e18))
        maximum = Vector((-1e18, -1e18, -1e18))
        for member in members:
            for corner in member.bound_box:
                point = member.matrix_world @ Vector(corner)
                for i in range(3):
                    minimum[i] = min(minimum[i], point[i])
                    maximum[i] = max(maximum[i], point[i])
        if minimum.x > 1e17:
            print("   ! handle %s has no usable bounds; skipped" % key)
            continue
        pivot_world = (minimum + maximum) / 2
        pivot_world.y = maximum.y
        pivot = common.group("PivotLeft" if index == 0 else "PivotRight", body,
                             location=(0, 0, 0))
        pivot.matrix_world = _translate_matrix(pivot_world)
        bpy.context.view_layer.update()
        for member in members:
            world = member.matrix_world.copy()
            member.parent = pivot
            member.matrix_world = world
        print("   %s at [%.4f %.4f %.4f] holding %d mesh(es) %s"
              % (pivot.name, pivot_world.x, pivot_world.y, pivot_world.z, len(members),
                 ", ".join(m.name for m in members)))
    bpy.context.view_layer.update()
    # Remove the now-empty imported node graph: it carries a 100x scale and would
    # otherwise be exported alongside the baked meshes.
    for obj in list(bpy.data.objects):
        if obj.type == "EMPTY" and obj not in (root, body) and not obj.name.startswith("Pivot"):
            bpy.data.objects.remove(obj, do_unlink=True)
    bpy.context.view_layer.update()


def add_anchors(root, weapon_id, category, objects):
    minimum, maximum = bounds(objects)
    size = maximum - minimum
    y_max, y_min = maximum.y, minimum.y
    length = y_max - y_min
    common.anchor("Muzzle", (0.0, y_max + 0.004, 0.0), root)
    if category == "knife":
        common.anchor("ViewmodelAnchor", (0.0, y_min + length * 0.10, 0.0), root)
        common.anchor("HandsAnchor", (0.0, y_min + length * 0.10, 0.0), root)
        common.anchor("LeftHandIK", (0.0, y_min + length * 0.06, -0.02), root)
        common.anchor("RightHandIK", (0.0, y_min + length * 0.18, -0.02), root)
    else:
        common.anchor("ViewmodelAnchor", (0.0, 0.0, 0.0), root)
        common.anchor("LeftHandIK", (0.0, length * 0.22, -0.05), root)
        common.anchor("RightHandIK", (0.0, -length * 0.06, -0.06), root)
    root["weapon_id"] = weapon_id
    root["source_model"] = True


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True)
    parser.add_argument("--weapon", required=True)
    parser.add_argument("--variant", required=True)
    parser.add_argument("--target-length", type=float)
    parser.add_argument("--orientation", default="auto", choices=["auto", "bulk"])
    parser.add_argument("--flip", action="store_true")
    parser.add_argument("--resolution", type=int, default=700)
    parser.add_argument("--samples", type=int, default=32)
    parser.add_argument("--no-render", action="store_true")
    args = parser.parse_args(argv)

    source = (ROOT / args.source) if not Path(args.source).is_absolute() else Path(args.source)
    if not source.exists():
        raise SystemExit("source model not found: %s" % source)

    target = TARGETS.get(args.weapon, (None, "rifle"))
    target_length = args.target_length or target[0]
    category = target[1]
    if not target_length:
        raise SystemExit("no target length for %s; pass --target-length" % args.weapon)

    print("converting %s -> weapon '%s' variant '%s' (%s, %.3f m)"
          % (source.name, args.weapon, args.variant, category, target_length))

    objects = import_source(source)
    objects = bake_transforms(objects)
    print("   imported %d mesh objects (transforms baked)" % len(objects))
    _debug_scales("after import", objects)
    normalise(objects, target_length, args.orientation, args.weapon, args.flip)
    _debug_scales("after normalise", objects)
    recentre_grip(objects, args.weapon, category)
    _debug_scales("after recentre", objects)
    root, body = build_hierarchy(objects, args.weapon, category)
    _debug_scales("after hierarchy", objects)
    convert_orientations(args.weapon, root, body, objects)
    add_anchors(root, args.weapon, category, objects)
    _debug_scales("after anchors", objects)

    # Record provenance so attribution survives into the manifest.
    provenance = PROVENANCE.get(source.name, {})
    for key, value in provenance.items():
        root["credit_%s" % key] = value

    report = validation.validate(root, args.weapon, category)
    print(validation.summary_line(report))
    for warning in report["warnings"][:5]:
        print("   warn:", warning)
    if not report["ok"]:
        raise SystemExit("converted model failed validation")

    if not args.no_render:
        # Named after the variant so publish_assets.mjs picks the preview up.
        outputs = preview.render_previews(root, args.variant, resolution=args.resolution,
                                          samples=args.samples)
        print("   previews:", ", ".join(p.name for p in outputs.values()))

    glb, blend = export_weapon(args.weapon, root, category, name=args.variant)
    print("   glb:", glb.relative_to(ROOT), " blend:", blend.relative_to(ROOT))

    stats = {"triangles": report["stats"]["triangles"],
             "materials": len(report["stats"]["materials"]),
             "parts": report["stats"]["mesh_objects"],
             "validation": {"ok": True, "failures": [], "warnings": report["warnings"][:6]},
             "provenance": provenance,
             "source_file": source.name,
             "variant": args.variant,
             "weapon": args.weapon,
             "target_length_m": target_length,
             "origin": "third_party_converted",
             "model": "/assets/weapons/%s/%s.glb" % (args.variant, args.variant),
             "status": "third_party",
             "blend": "assets-source/blender/%s.blend" % args.variant}
    update_manifest({args.variant: stats})
    (HERE / "reports").mkdir(exist_ok=True)
    (HERE / "reports" / ("%s_%s.json" % (args.weapon, args.variant))).write_text(
        json.dumps(stats, indent=2), encoding="utf-8")
    print("CONVERTED %s / %s -> %d tris, %d materials, %.3f m"
          % (args.weapon, args.variant, stats["triangles"], stats["materials"], target_length))
    print("staged under tools/blender/dist; run publish_assets.mjs to copy into public/")
    return 0


if __name__ == "__main__":
    sys.exit(main())
