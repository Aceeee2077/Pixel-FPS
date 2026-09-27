"""Silhouette self-check: compare a rendered model outline with its reference.

This is the automated half of the visual loop. The model is rendered as a flat
orthographic side elevation, the reference PNG's silhouette is recovered with
``weapon_reference``, and the two outlines are scaled into a common frame and
compared. The IoU and column-profile match are reported so a regression in
proportions is caught without a human looking at every render.
"""
import json
import sys
from pathlib import Path

import bpy

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(HERE))

from weapon_preview import render_silhouette
from weapon_reference import ReferenceAnalysis, compare_silhouettes, side_by_side

MANIFEST_PATH = HERE / "reference_manifest.json"
COMPARE_DIR = HERE / "silhouettes"


def reference_for(weapon_id):
    """First reference image registered for a weapon, or None."""
    if not MANIFEST_PATH.exists():
        return None
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    entry = manifest.get("weapons", {}).get(weapon_id)
    if not entry or not entry.get("images"):
        return None
    return ROOT / entry["images"][0]["file"]


def _mask_from_render(path, cutoff=0.35):
    image = bpy.data.images.load(str(path), check_existing=False)
    width, height = image.size
    pixels = list(image.pixels)
    bpy.data.images.remove(image)
    mask = []
    for y in range(height):
        row = []
        base = (height - 1 - y) * width * 4
        for x in range(width):
            row.append(pixels[base + x * 4 + 3] > cutoff)
        mask.append(row)
    return mask


def score_silhouette(objects, weapon_id, tag=None):
    """IoU of the given objects against a weapon's reference silhouette.

    Used by the conversion step to pick the correct facing: a model oriented
    muzzle-forward scores far higher than the same model mirrored. Returns 0.0
    when the weapon has no reference art or the render fails.
    """
    reference = reference_for(weapon_id)
    if reference is None or not reference.exists():
        return 0.0
    meshes = [obj for obj in objects if obj.type == "MESH"]
    if not meshes:
        return 0.0
    # Render the loose parts directly, without needing a weapon root.
    path = render_silhouette(None, tag or ("%s_orient" % weapon_id), objects=meshes)
    model_mask = _mask_from_render(path)
    analysis = ReferenceAnalysis(reference, reference.name).measure()
    return compare_silhouettes(analysis.mask, model_mask)["iou"]


def compare_with_reference(weapon_id, triangles=None, root=None):
    """Render, recover both silhouettes, and score the match.

    Returns a record with ``iou`` (higher is better, 1.0 identical) and
    ``profile_match`` (fraction of the length whose silhouette height agrees
    within 18%). Returns None when the weapon has no reference art.
    """
    reference = reference_for(weapon_id)
    if reference is None or not reference.exists():
        return None
    root = root or bpy.data.objects.get(weapon_id + "_Root")
    if root is None:
        return None
    render_path = render_silhouette(root, weapon_id)
    model_mask = _mask_from_render(render_path)
    analysis = ReferenceAnalysis(reference, reference.name).measure()
    score = compare_silhouettes(analysis.mask, model_mask)
    # A side-by-side artefact (reference | model | overlay) for human review.
    COMPARE_DIR.mkdir(parents=True, exist_ok=True)
    comparison_path = COMPARE_DIR / ("%s_compare.png" % weapon_id)
    try:
        side_by_side(analysis.mask, model_mask, comparison_path)
        score["comparison_image"] = str(comparison_path.relative_to(ROOT)).replace("\\", "/")
    except (IndexError, ValueError) as error:
        print("   ! comparison image skipped: %s" % error)
    score["reference"] = str(reference.relative_to(ROOT)).replace("\\", "/")
    score["mask_quality"] = analysis.quality
    score["reference_aspect"] = analysis.proportions()["length_over_height"]
    score["model_triangles"] = triangles
    score["comparison_image"] = str(comparison_path.relative_to(ROOT)).replace("\\", "/")
    # The reference masks recovered from dark studio renders carry background
    # noise, so the outline score is advisory. Only a confident mask can say a
    # model is "matched"; an unreliable mask can never be used to claim success.
    reliable = analysis.quality["reliable"]
    if score["profile_match"] >= 0.7 and score["iou"] >= 0.45:
        score["verdict"] = "matched" if reliable else "provisional"
    elif score["profile_match"] >= 0.5 or score["iou"] >= 0.35:
        score["verdict"] = "loose"
    else:
        score["verdict"] = "mismatch"
    if not reliable:
        score["verdict"] += " (reference mask low confidence)"
    print("   silhouette: IoU %.3f  profile %.3f  %s"
          % (score["iou"], score["profile_match"], score["verdict"]))
    return score
