"""Verify the required hierarchy contract for sniper modules.

Checks, per weapon: a root group, a child group named after DISPLAY, the three
animatable child groups, the five required anchors, and the muzzle anchor's
world position.
"""
import sys
from pathlib import Path

import bpy

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import build_weapon as builder  # noqa: E402
import weapon_common as common  # noqa: E402
import weapon_materials as materials  # noqa: E402

WEAPONS = ("awp", "ssg08", "scar20", "g3sg1")
REQUIRED_GROUPS = ("Magazine", "BoltCarrier", "Trigger")
REQUIRED_ANCHORS = ("ViewmodelAnchor", "Muzzle", "LeftHandIK", "RightHandIK", "MagazineAnchor")

failures = []
for weapon_id in WEAPONS:
    module = builder.load(weapon_id)
    common.reset_scene()
    root = module.build(materials.gun_palette())
    bpy.context.view_layer.update()

    named = {obj.name: obj for obj in [root] + list(root.children_recursive)}
    problems = []

    if root.name != module.WEAPON_ID + "_Root":
        problems.append("root named %s" % root.name)
    display = named.get(module.DISPLAY)
    if display is None:
        problems.append("missing static group %r" % module.DISPLAY)
    elif display.parent is not root:
        problems.append("static group not parented to root")
    for group_name in REQUIRED_GROUPS:
        node = named.get(group_name)
        if node is None:
            problems.append("missing group %r" % group_name)
        elif node.parent is not display:
            problems.append("group %r parented to %s" % (group_name,
                                                         node.parent.name if node.parent else None))
    for anchor_name in REQUIRED_ANCHORS:
        node = named.get(anchor_name)
        if node is None:
            problems.append("missing anchor %r" % anchor_name)
    magazine_anchor = named.get("MagazineAnchor")
    magazine = named.get("Magazine")
    if magazine_anchor is not None and magazine is not None and magazine_anchor.parent is not magazine:
        problems.append("MagazineAnchor not parented to Magazine")

    muzzle = named.get("Muzzle")
    muzzle_y = muzzle.matrix_world.translation.y if muzzle else float("nan")
    if muzzle_y <= 0.15:
        problems.append("Muzzle y=%.3f not > 0.15" % muzzle_y)

    modules_with_groups = sum(1 for name in REQUIRED_GROUPS if name in named)
    print("%-8s %-9s groups %d/3  anchors %d/5  Muzzle y=%+.3f  %s"
          % (weapon_id, module.DISPLAY, modules_with_groups,
             sum(1 for n in REQUIRED_ANCHORS if n in named), muzzle_y,
             "OK" if not problems else "PROBLEM: " + "; ".join(problems)))
    if module.TRIANGLE_HINT <= 0 or module.CATEGORY != "sniper":
        problems.append("metadata")
    failures.extend("%s: %s" % (weapon_id, p) for p in problems)

print("HIERARCHY", "PASS" if not failures else "FAIL " + " | ".join(failures))
