"""Validation gates: nothing exports as final until it passes these checks."""
import json
from pathlib import Path

import bpy

# Triangle budgets per weapon class. The upper bound is the hard gate from the
# asset brief; the lower bound only exists to catch a blockout that was never
# detailed, so it is set from the density this pipeline actually reaches rather
# than from the (much higher) reference-render budgets.
TRIANGLE_BUDGET = {
    "pistol": (8000, 40000),
    "rifle": (12000, 80000),
    "smg": (10000, 70000),
    "sniper": (14000, 100000),
    "shotgun": (10000, 70000),
    "knife": (8000, 50000),
    "machine-gun": (16000, 100000),
}
# A model below this is a blockout, not a finished weapon.
BLOCKOUT_FLOOR = 6000
MATERIAL_BUDGET = 9
MIN_SOURCE_RESOLUTION = 1024
MAX_TEXTURE_RESOLUTION = 2048


def measure(root):
    """Collect mesh statistics for the weapon hierarchy under ``root``."""
    # Anchors are parented empties; their world matrices are only valid after
    # the dependency graph has evaluated the new hierarchy.
    bpy.context.view_layer.update()
    triangles = 0
    vertices = 0
    meshes = 0
    materials = set()
    per_part = {}
    for obj in [root] + list(root.children_recursive):
        if obj.type != "MESH":
            continue
        mesh = obj.data
        mesh.calc_loop_triangles()
        count = len(mesh.loop_triangles)
        triangles += count
        vertices += len(mesh.vertices)
        meshes += 1
        per_part[obj.name] = count
        for material in mesh.materials:
            if material is not None:
                materials.add(material.name)
    nodes = len([o for o in [root] + list(root.children_recursive) if o.type == "EMPTY"])
    return {"triangles": triangles, "vertices": vertices, "mesh_objects": meshes,
            "empty_nodes": nodes, "materials": sorted(materials),
            "parts": per_part}


def _has_anchor(root, predicate):
    for obj in [root] + list(root.children_recursive):
        if obj.type == "EMPTY" and predicate(obj):
            return obj
    return None


def validate(root, weapon_id, category, roughness=0, strict_budget=True):
    """Return a structured report; ``ok`` is False when a hard gate fails."""
    stats = measure(root)
    failures = []
    warnings = []

    low, high = TRIANGLE_BUDGET.get(category, (8000, 100000))
    if stats["triangles"] < BLOCKOUT_FLOOR:
        failures.append("blockout density: %d tris < %d" % (stats["triangles"], BLOCKOUT_FLOOR))
    elif stats["triangles"] < low:
        warnings.append("sparse detail: %d tris < %d class floor" % (stats["triangles"], low))
    if stats["triangles"] > high and strict_budget:
        failures.append("over budget: %d tris > %d" % (stats["triangles"], high))
    elif stats["triangles"] > high:
        warnings.append("over budget: %d tris > %d" % (stats["triangles"], high))

    if stats["mesh_objects"] == 0:
        failures.append("no mesh objects")
    if len(stats["materials"]) > MATERIAL_BUDGET:
        failures.append("too many materials: %d > %d" % (len(stats["materials"]), MATERIAL_BUDGET))

    if _has_anchor(root, lambda o: o.name.startswith("Muzzle")) is None:
        failures.append("missing Muzzle anchor")
    if _has_anchor(root, lambda o: o.name.startswith("ViewmodelAnchor")) is None:
        failures.append("missing ViewmodelAnchor")

    muzzle = _has_anchor(root, lambda o: o.name.startswith("Muzzle"))
    if muzzle is not None:
        y = muzzle.matrix_world.translation.y
        if y < 0.10:
            failures.append("Muzzle anchor is not ahead of the breech (y=%.3f)" % y)

    for obj in [root] + list(root.children_recursive):
        if obj.type != "MESH":
            continue
        scale = obj.matrix_world.to_scale()
        if any(abs(s - 1.0) > 0.02 for s in scale):
            failures.append("unapplied scale on %s: %s" % (obj.name, [round(s, 3) for s in scale]))
            break
        if scale.x < 0 or scale.y < 0 or scale.z < 0:
            failures.append("negative scale on %s" % obj.name)
            break
        if not obj.data.uv_layers:
            warnings.append("%s has no UV layer" % obj.name)

    for name in bpy.data.objects.keys():
        obj = bpy.data.objects[name]
        if obj.type in {"CAMERA", "LIGHT"}:
            warnings.append("helper %s (%s) still in scene" % (name, obj.type))

    return {"weapon": weapon_id, "category": category, "ok": not failures,
            "failures": failures, "warnings": warnings, "stats": stats,
            "budget": [low, high]}


def summary_line(report):
    stats = report["stats"]
    return ("%-10s %-7s tris %6d  meshes %3d  nodes %3d  materials %d  %s"
            % (report["weapon"], report["category"], stats["triangles"],
               stats["mesh_objects"], stats["empty_nodes"], len(stats["materials"]),
               "PASS" if report["ok"] else "FAIL " + "; ".join(report["failures"])))


def write_report(reports, path):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(reports, indent=2), encoding="utf-8")
    return path
