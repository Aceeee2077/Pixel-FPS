# Weapon assets

Authored weapon GLBs are published into this directory by:

    npm run build:weapons    # Blender: geometry -> validate -> render -> export
    npm run publish:weapons  # copy staged GLBs here + regenerate src/data/weaponAssets.ts

Until that publish step runs, `manifest.json` lists 29 weapons whose `.glb` files
live only in `tools/blender/dist/weapons/`. The game degrades gracefully: the
viewer falls back to the procedural mesh and the armory keeps showing the
reference render, with a badge on each card telling you which of the two you
are looking at.
