"""ASCII rasteriser for preview PNGs: shows what the render actually contains."""
import sys
from pathlib import Path

import bpy

path = Path(sys.argv[sys.argv.index("--") + 1]).resolve()
image = bpy.data.images.load(str(path))
width, height = image.size
pixels = list(image.pixels)
COLS, ROWS = 100, 34
grid = [[" "] * COLS for _ in range(ROWS)]
occupied = []
for row in range(height):
    for col in range(width):
        index = (row * width + col) * 4
        r, g, b, a = pixels[index:index + 4]
        lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
        if a > 0.5 and lum > 0.075:
            occupied.append((col, row, lum))
if not occupied:
    print("EMPTY IMAGE", width, height)
    raise SystemExit
xs = [c for c, r, l in occupied]
ys = [r for c, r, l in occupied]
print("file %s  size %dx%d  ink cols %d..%d rows %d..%d  fill %.3f" % (
    path.name, width, height, min(xs), max(xs), min(ys), max(ys), len(occupied) / float(width * height)))
print("content aspect (w/h) = %.3f" % ((max(xs) - min(xs) + 1) / float(max(ys) - min(ys) + 1)))
for col, row, lum in occupied:
    gx = min(COLS - 1, int(col / float(width) * COLS))
    gy = min(ROWS - 1, int(row / float(height) * ROWS))
    grid[gy][gx] = "#" if lum > 0.06 else "."
for row in grid:
    print("|" + "".join(row) + "|")
