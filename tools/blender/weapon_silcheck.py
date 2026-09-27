"""Render an orthographic silhouette and dump it as ASCII (self-check aid)."""
import importlib
import sys
from pathlib import Path

import bpy

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE / "weapons"))

import weapon_common as common
import weapon_materials as materials
import weapon_preview as preview

weapon_id = sys.argv[sys.argv.index("--") + 1]
module = importlib.import_module(weapon_id.replace("-", "").replace("_", ""))

common.reset_scene()
root = module.build(materials.gun_palette())
common.reset_world = None
path = preview.render_silhouette(root, weapon_id, resolution=700)
print("SILHOUETTE", path)

image = bpy.data.images.load(str(path))
width, height = image.size
pixels = list(image.pixels)
COLS, ROWS = 108, 38
grid = [[" "] * COLS for _ in range(ROWS)]
filled = 0
for row in range(height):
    for col in range(width):
        index = (row * width + col) * 4
        if pixels[index + 3] > 0.5 and pixels[index] > 0.25:
            filled += 1
            gx = min(COLS - 1, int(col / float(width) * COLS))
            gy = min(ROWS - 1, int(row / float(height) * ROWS))
            grid[gy][gx] = "#"
print("coverage %.4f" % (filled / float(width * height)))
print("+ y = muzzle (left-to-right in the render is -y .. +y) ->")
for row in grid:
    print("|" + "".join(row) + "|")
