"""ASCII side elevation dump for a weapon module (debug aid, no render)."""
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

weapon_id = sys.argv[sys.argv.index("--") + 1]
module = importlib.import_module(weapon_id.replace("-", "").replace("_", ""))

common.reset_scene()
palette = materials.gun_palette()
root = module.build(palette)
bpy.context.view_layer.update()

meshes = [o for o in [root] + list(root.children_recursive) if o.type == "MESH"]


def world_points(obj):
    matrix = obj.matrix_world
    return [matrix @ vertex.co for vertex in obj.data.vertices]


# Report per-object extents first so any object placed outside the silhouette
# (a modelling bug) is visible instead of being averaged into the bounds.
ranked = sorted(((max(p.y for p in world_points(obj)), obj.name) for obj in meshes), reverse=True)
print("FORWARD EXTREMES:", [(name, round(value, 4)) for value, name in ranked[:3]])
ranked = sorted(((min(p.y for p in world_points(obj)), obj.name) for obj in meshes))
print("REAR EXTREMES:", [(name, round(value, 4)) for value, name in ranked[:3]])
ranked = sorted(((min(p.z for p in world_points(obj)), obj.name) for obj in meshes))
print("LOWEST EXTREMES:", [(name, round(value, 4)) for value, name in ranked[:3]])
for name in ("ShroudSlot0_0", "ShroudRib0", "ShroudSlot0_2"):
    obj = bpy.data.objects.get(name)
    if obj is not None:
        points = world_points(obj)
        print("  %-16s loc %s rot %s  y %.4f..%.4f  z %.4f..%.4f  x %.4f..%.4f" % (
            name, tuple(round(v, 4) for v in obj.location),
            tuple(round(v, 3) for v in obj.rotation_euler),
            min(p.y for p in points), max(p.y for p in points),
            min(p.z for p in points), max(p.z for p in points),
            min(p.x for p in points), max(p.x for p in points)))

clean = []
for obj in meshes:
    clean.extend(world_points(obj))

ys = [p.y for p in clean]
zs = [p.z for p in clean]
xs = [p.x for p in clean]
print("BOUNDS y %.4f..%.4f  z %.4f..%.4f  x %.4f..%.4f" % (min(ys), max(ys), min(zs), max(zs), min(xs), max(xs)))
print("LENGTH %.4f  HEIGHT %.4f  RATIO %.3f" % (max(ys) - min(ys), max(zs) - min(zs),
                                                (max(ys) - min(ys)) / max(1e-6, max(zs) - min(zs))))
print("MESHES %d  MATERIALS %s" % (len(meshes), sorted({m.name for o in meshes for m in o.data.materials if m})))
print("SOLID TOP Z %.4f  BOTTOM Z %.4f" % (max(zs), min(zs)))
top_profile = sorted(clean, key=lambda p: -p.z)[:1]
print("HIGHEST POINT", tuple(round(v, 4) for v in top_profile[0]))

COLS, ROWS = 110, 40
y0, y1 = min(ys), max(ys)
z0, z1 = min(zs), max(zs)
grid = [[" "] * COLS for _ in range(ROWS)]


def mark(py, pz, char="#"):
    cx = min(COLS - 1, max(0, int((py - y0) / max(1e-9, y1 - y0) * (COLS - 1))))
    cz = min(ROWS - 1, max(0, int((pz - z0) / max(1e-9, z1 - z0) * (ROWS - 1))))
    grid[ROWS - 1 - cz][cx] = char


for obj in meshes:
    if obj.name.startswith("FramePin") or obj.name.startswith("ReceiverRivet"):
        continue
    matrix = obj.matrix_world
    mesh = obj.data
    mesh.calc_loop_triangles()
    for tri in mesh.loop_triangles:
        points = [matrix @ mesh.vertices[i].co for i in tri.vertices]
        for step in range(0, 17):
            t = step / 16.0
            for a, b in ((points[0], points[1]), (points[1], points[2]), (points[2], points[0])):
                point = a.lerp(b, t)
                mark(point.y, point.z)
print("+ y = muzzle ->")
for row in grid:
    print("|" + "".join(row) + "|")

# per-column z extent: proves whether the frame/grip/slide actually touch
columns = {}
for point in clean:
    key = round((point.y - y0) / max(1e-9, y1 - y0) * 40)
    low, high = columns.get(key, (point.z, point.z))
    columns[key] = (min(low, point.z), max(high, point.z))
print("COLUMN z-extents (0 = rear, 40 = muzzle):")
for key in sorted(columns):
    low, high = columns[key]
    print("  %2d  z %+.4f .. %+.4f  (top %.4f, bottom %.4f)" % (
        key, low, high, high, low))

for name in ("Muzzle", "ViewmodelAnchor", "LeftHandIK", "RightHandIK", "MagazineAnchor"):
    obj = bpy.data.objects.get(name)
    if obj is not None:
        print("%-18s world (%.3f, %.3f, %.3f) parent %s" % (
            name, obj.matrix_world.translation.x, obj.matrix_world.translation.y,
            obj.matrix_world.translation.z, obj.parent.name if obj.parent else None))
    else:
        print("%-18s MISSING" % name)
groups = {o.name for o in root.children_recursive if o.type == "EMPTY"}
print("EMPTY NODES", sorted(groups))
