"""Silhouette self-check on the FINAL (post-decimation) geometry."""
import importlib
import sys
from pathlib import Path

import bpy
from mathutils import Vector

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE / "weapons"))

import weapon_common as common
import weapon_materials as materials
import build_weapon

weapon_id = sys.argv[sys.argv.index("--") + 1]
module = importlib.import_module(weapon_id.replace("-", "").replace("_", ""))

common.reset_scene()
root = module.build(materials.gun_palette())
build_weapon.bake_geometry(root, module.CATEGORY)
common.batch_by_material(root)

meshes = [o for o in [root] + list(root.children_recursive) if o.type == "MESH"]
points = []
for obj in meshes:
    matrix = obj.matrix_world
    points.extend(matrix @ v.co for v in obj.data.vertices)
ys = [p.y for p in points]
zs = [p.z for p in points]
xs = [p.x for p in points]
tris = 0
for obj in meshes:
    obj.data.calc_loop_triangles()
    tris += len(obj.data.loop_triangles)
print("FINAL tris %d  meshes %d" % (tris, len(meshes)))
print("BOUNDS y %.4f..%.4f z %.4f..%.4f x %.4f..%.4f" % (min(ys), max(ys), min(zs), max(zs), min(xs), max(xs)))
print("LENGTH %.4f HEIGHT %.4f RATIO %.3f" % (max(ys) - min(ys), max(zs) - min(zs),
                                              (max(ys) - min(ys)) / max(1e-6, max(zs) - min(zs))))

COLS, ROWS = 104, 34
y0, y1, z0, z1 = min(ys), max(ys), min(zs), max(zs)
grid = [[" "] * COLS for _ in range(ROWS)]


def mark(py, pz):
    cx = min(COLS - 1, max(0, int((py - y0) / max(1e-9, y1 - y0) * (COLS - 1))))
    cz = min(ROWS - 1, max(0, int((pz - z0) / max(1e-9, z1 - z0) * (ROWS - 1))))
    grid[ROWS - 1 - cz][cx] = "#"


for obj in meshes:
    matrix = obj.matrix_world
    mesh = obj.data
    mesh.calc_loop_triangles()
    for tri in mesh.loop_triangles:
        pts = [matrix @ mesh.vertices[i].co for i in tri.vertices]
        for step in range(0, 13):
            t = step / 12.0
            for a, b in ((pts[0], pts[1]), (pts[1], pts[2]), (pts[2], pts[0])):
                point = a.lerp(b, t)
                mark(point.y, point.z)
print("+ y = muzzle ->")
for row in grid:
    print("|" + "".join(row) + "|")
