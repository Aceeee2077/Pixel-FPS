"""Debug the silhouette scorer used for auto-orientation."""
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import bpy
import weapon_silhouette as sil
from weapon_preview import render_silhouette

print("reference_for ak-47 ->", sil.reference_for("ak-47"))
print("reference_for awp    ->", sil.reference_for("awp"))

import importlib
import convert_user_model as conv

for name, weapon in (("csgo_ak47_wild_lotus.glb", "ak-47"),):
    objs = conv.import_source(HERE.parents[1] / name)
    objs = conv.bake_transforms(objs)
    # orient so the barrel runs along +Y first (same as the converter does)
    conv.normalise(objs, 0.880, "bulk", weapon, False)
    print("bulk says muzzle end:", conv.muzzle_end(objs, 1))
    path = render_silhouette(None, "debug_orient", objects=[o for o in objs if o.type == "MESH"])
    print("rendered", path, path.exists(), path.stat().st_size if path.exists() else 0, "bytes")
    mask = sil._mask_from_render(path)
    filled = sum(1 for row in mask for v in row if v)
    print("model mask filled pixels:", filled, "of", len(mask) * len(mask[0]))
    reference = sil.reference_for(weapon)
    from weapon_reference import ReferenceAnalysis
    analysis = ReferenceAnalysis(reference, reference.name).measure()
    print("reference mask filled:", sum(1 for row in analysis.mask for v in row if v),
          "of", len(analysis.mask) * len(analysis.mask[0]))
    print("score:", sil.score_silhouette(objs, weapon, "debug_ak"))
