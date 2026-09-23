"""BlockStrike BLOCKYARD — Blender (bpy) rebuild/export.

This mirrors the same layout coordinates as tools/build-map-glb.mjs and
src/world/Maps.ts so the exported GLB lines up with the unchanged game
collision, spawns and bot routes. It was authored for the asset pipeline but
was NOT executed here because Blender is not installed in this environment;
treat it as the reproducible source for the .blend workflow.

Run inside Blender (4.x): File > Open this script, or:
    blender --background --python tools/blockyard_bpy.py
It writes public/assets/maps/blockyard_bpy.glb next to this script's parent.
"""
import bpy
import math
from pathlib import Path


def mat(name, color, roughness=0.9, metallic=0.0):
    m = bpy.data.materials.get(name)
    if m is None:
        m = bpy.data.materials.new(name)
        m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    if bsdf is None:
        bsdf = m.node_tree.nodes.new("ShaderNodeBsdfPrincipled")
        m.node_tree.links.new(bsdf.outputs[0], m.node_tree.nodes["Material Output"].inputs[0])
    bsdf.inputs["Base Color"].default_value = color
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    return m


def box(name, x, y, z, w, h, d, material):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x, y + h / 2, z))
    ob = bpy.context.object
    ob.name = name
    ob.scale = (w, h, d)
    ob.data.materials.append(material)
    return ob


def wall(name, x, y, z, w, h, d, material):
    box(name, x, y, z, w, h, d, material)
    cap_h = min(0.22, h * 0.16)
    box(name + "_cap", x, y + h - cap_h / 2, z, w + 0.24, cap_h, d + 0.24, material)


def clear():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for block in (bpy.data.meshes, bpy.data.materials):
        for item in list(block):
            block.remove(item)


clear()
bpy.context.scene.unit_settings.system = "METRIC"
bpy.context.scene.unit_settings.scale_length = 1.0

ground = mat("ground", (0.784, 0.776, 0.678), 0.98, 0.0)
concrete = mat("concrete", (0.529, 0.569, 0.569), 0.9, 0.0)
plaster = mat("plaster", (0.906, 0.902, 0.824), 0.92, 0.0)
roof = mat("roof", (0.243, 0.376, 0.380), 0.82, 0.05)
metal = mat("metal", (0.322, 0.463, 0.451), 0.45, 0.8)
wood = mat("wood", (0.690, 0.533, 0.314), 0.8, 0.0)

box("ground", 0, 0, 0, 176, 0.02, 176, ground)

# Boundary walls.
wall("wall_s", 0, 0, -88, 178, 4, 1.5, concrete)
wall("wall_n", 0, 0, 88, 178, 4, 1.5, concrete)
wall("wall_w", -88, 0, 0, 1.5, 4, 176, concrete)
wall("wall_e", 88, 0, 0, 1.5, 4, 176, concrete)

# Warehouse walls, roof, roof-access stairs and interior props.
wall("warehouse_s", -38, 0, -27, 28, 8, 1, plaster)
wall("warehouse_w", -51.5, 0, -13, 1, 8, 28, plaster)
wall("warehouse_e", -24.5, 0, -13, 1, 8, 28, plaster)
wall("warehouse_n1", -46, 0, 0.5, 11, 8, 1, plaster)
wall("warehouse_n2", -29, 0, 0.5, 10, 8, 1, plaster)
box("warehouse_lintel", -38, 6, 0.5, 7, 2, 1, plaster)
box("warehouse_roof", -38, 8, -13, 29, 0.4, 29, roof)
for i in range(21):
    box(f"warehouse_step_{i}", -57, 0, 2 + i * 1.25, 4, 0.4, 1.25, concrete)
box("warehouse_crate", -44, 0, -19, 4, 2.8, 4, wood)
box("warehouse_crate2", -31, 0, -10, 4, 2.3, 5, wood)

# Tower columns, deck and sky bridge.
for x in (24, 34):
    for z in (-25, -15):
        box(f"tower_col_{x}_{z}", x, 0, z, 1.2, 8, 1.2, metal)
box("tower_deck", 29, 8, -20, 13, 0.4, 13, metal)
box("sky_bridge", -1.5, 8, -20, 47, 0.4, 4, metal)

# Containers (representative layout).
for name, x, z, color, rotate in [
    ("c1", 32, 19, (0.424, 0.620, 0.667), False),
    ("c2", 51, 31, (0.808, 0.545, 0.408), True),
    ("c3", 31, 43, (0.882, 0.733, 0.420), False),
    ("c4", -33, 31, (0.808, 0.506, 0.388), True),
    ("c5", -52, 46, (0.384, 0.580, 0.596), False),
]:
    cm = mat(f"container:{name}", color, 0.6, 0.3)
    w, d = (5, 13) if rotate else (13, 5)
    box(f"container_{name}", x, 0, z, w, 4.2, d, cm)

# Apply transforms so the exported GLB bakes object scale into geometry.
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

out = Path(__file__).resolve().parent.parent / "public" / "assets" / "maps" / "blockyard_bpy.glb"
out.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.export_scene.gltf(filepath=str(out), export_format="GLB", export_yup=False)
print(f"Wrote {out}")
