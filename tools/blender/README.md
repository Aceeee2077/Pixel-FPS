# Weapon asset pipeline

Clean-room weapon modeling: every weapon GLB in `public/assets/weapons/` is
generated from numeric descriptions in this directory, using the project's own
reference images for silhouette, proportion and colour-zone calibration. No
Valve/CS2 model is downloaded or extracted, no Source 2 mesh is imported, and no
reference PNG is ever projected onto geometry as a flat card.

```
project reference PNGs
        |
        v  build_reference_manifest.py     scan + recover silhouettes
reference_manifest.json  (+ reference_work/*.png debug masks)
        |
        v  weapons/<id>.py                 authored per-weapon geometry
        |   weapon_common.py               loft / sweep / tube / profiles
        |   weapon_parts.py                receiver, barrel, stock, magazine, scope...
        |   weapon_materials.py            PBR material library
        v  build_weapon.py / build_all_weapons.py
        |      bake modifiers -> weld -> angle-smooth -> decimate to web budget
        |      -> batch by material -> validate -> render -> silhouette compare
        v  dist/weapons/<id>/<id>.glb      Draco-compressed, game-ready
        |  dist/blender/<id>.blend         editable source
        |  previews/<id>_preview.png       hero render for the visual loop
        |  silhouettes/<id>_compare.png    reference | model | overlay
        v  publish_assets.mjs
public/assets/weapons/<id>/<id>.glb + manifest.json
assets-source/blender/<id>.blend
src/data/weaponAssets.ts  (generated registry)
```

## Commands

```bash
npm run build:references   # rescan reference images, rebuild reference_manifest.json
npm run build:weapons      # build every weapon: geometry -> validate -> render -> export
npm run build:weapon -- --weapon ak-47        # one weapon
npm run publish:weapons    # copy staged GLBs into public/ and regenerate the registry
npm run assets:registry    # regenerate src/data/weaponAssets.ts only
```

Blender is located automatically (`BLENDER_PATH`, then `blender` on `PATH`, then
`C:\Program Files\Blender Foundation\Blender*\blender.exe`, newest first). If it
is missing the wrapper prints every path it tried. Verified against Blender 5.2.

Useful per-weapon flags:

```bash
node tools/blender/run-blender.mjs build_weapon.py -- --weapon ak-47 --no-render
node tools/blender/run-blender.mjs build_weapon.py -- --weapon ak-47 --resolution 700 --samples 24
node tools/blender/run-blender.mjs build_all_weapons.py -- --only ak-47 awp --no-render
```

## Conventions

* Metres, 1 unit = 1 m, real-world weapon length.
* **+Y is the muzzle direction**, +Z is up, +X is right.
* Firearms: `y = 0` at the receiver front face; the bore axis is `z = 0`, so the
  action sits above the axis and the magazine/grip below it.
* Knives: `y = 0` at the blade/handle junction, blade toward +Y (matching
  `src/weapons/KnifeAnimationController.ts`).
* `export_yup=True` turns +Y-into-muzzle into glTF -Z-forward, which is the
  convention `src/weapons/WeaponModel.ts` already uses.

Every weapon is a real hierarchy, never one welded mesh:

```
<weapon>_Root
├── ViewmodelAnchor     (empty)  first-person placement reference
├── Muzzle              (empty)  muzzle flash + tracer origin
├── LeftHandIK / RightHandIK (empty)
├── <Weapon>            (empty)  static body, batched by material
├── Magazine            (empty)  + MagazineAnchor
├── Bolt / BoltCarrier  (empty)
├── ChargingHandle      (empty)
├── Trigger             (empty)
└── Slide / Hammer / PivotLeft / PivotRight / Blade / FingerRing / Latch (as applicable)
```

`WeaponAssetLoader` reads the `Muzzle` and `ViewmodelAnchor` empties out of the
GLB and exposes them as `model.userData.muzzle` / `.viewmodelAnchor`, so the
game never hard-codes barrel offsets.

## Materials

`weapon_materials.py` provides the reusable PBR library:
`create_gunmetal`, `create_black_anodized_metal`, `create_phosphate_steel`,
`create_polymer_black`, `create_polymer_green`, `create_polymer_fde`,
`create_polymer_grey`, `create_wood`, `create_wood_dark`,
`create_brushed_steel`, `create_stainless_bright`, `create_scope_glass`,
`create_rubber`, `create_brass`, plus the knife skin slots.

Each is a Principled BSDF carrying real Base Color / Metallic / Roughness values
and a subtle noise-to-bump chain for micro surface variation. Worn edges come
from real geometry bevels, never from a painted image. Default finishes stay
close to factory: no exaggerated wear, no wasteland weathering.

Knife gem finishes (Emerald / Fade / Ruby) are generated procedurally at runtime
by `src/weapons/skins/KnifeMaterialFactory.ts` and applied to whichever material
slot the Blender module named as a blade / grip / inlay slot. The reference PNG
is never used as a diffuse map.

## Budgets and gates

`weapon_validation.py` blocks an export that would ship something unusable:

| check | rule |
| --- | --- |
| triangle floor | `< 6000` = blockout, refused |
| triangle ceiling | per class, hard fail above (pistol 40k … sniper 100k) |
| materials | max 9 per weapon |
| anchors | `Muzzle` and `ViewmodelAnchor` required, muzzle ahead of the breech |
| transforms | no unapplied scale, no negative scale |
| UVs | every part unwrapped (warning only) |

After the gates the mesh is collapsed to a web budget (`WEB_TRIANGLE_TARGET` in
`build_weapon.py`): rifle 12k, sniper 14k, SMG 9k, pistol 8k, knife 8k. Then it
is welded, angle-smooth shaded, batched per material and Draco-compressed, which
takes a typical weapon from ~1.9 MB of uncompressed glTF to ~60–90 KB.

## Visual self-check loop

Each build renders a hero 3/4 preview, a side elevation and a front view, then
scores the side elevation against the reference silhouette
(`weapon_silhouette.py`) and writes `silhouettes/<id>_compare.png` showing
reference | model | overlay. The reported `iou` and `profile_match` are advisory:
the reference masks are recovered from dark studio renders and carry background
noise, so a low-confidence mask can never mark a weapon as finished, and a good
model is never blocked by a noisy mask. `mask_quality.reliable` records which
regime a score came from.

Refinement is driven by that loop: build → render → compare → adjust →
re-render.

## What is authored from what

29 weapons have GLBs. Reference art exists for 23 of them (see
`reference_manifest.json`); the rest are marked `has_reference: false` in the
manifest and are authored from published class proportions instead, with
`needs_more_reference` recorded in the report:

`galil-ar`, `sg-553`, `ump-45` (no reference PNG in the project).

Weapons that still have no module at all are listed in
`reference_manifest.json` under `missing` and remain on the procedural fallback
in game: `nova`, `xm1014`, `mag-7`, `sawed-off`, `m249`, `negev`, `mp5-sd`,
`dual-berettas`, `r8`.

## Publishing under a restricted file sandbox

`build_all_weapons.py` stages into `tools/blender/dist/` and `publish_assets.mjs`
copies into `public/` and `src/`. That keeps the build independent of the web
root layout. If a sandbox denies writes under `public/`, run the publish step
from a normal terminal:

```bash
npm run build:weapons && npm run publish:weapons
```

`tools/blender/stage-publish.mjs` + `publish_from_stage.py` are the fallback for
an environment where even that is blocked: they serialise the staged binaries as
base64 text chunks so a text-only transfer can reassemble byte-identical files.
