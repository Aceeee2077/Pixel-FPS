"""Export a validated weapon: .blend source plus a game-ready .glb.

Builds are staged under ``tools/blender/dist`` and published into
``public/assets/weapons`` and ``assets-source/blender`` by
``tools/blender/publish_assets.py``. Staging keeps the build itself free of any
assumption about where the web root lives.
"""
import json
from pathlib import Path

import bpy

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
GLB_DIR = HERE / "dist" / "weapons"
SOURCE_DIR = HERE / "dist" / "blender"
PUBLIC_DIR = ROOT / "public" / "assets" / "weapons"
MANIFEST_PATH = GLB_DIR / "manifest.json"


def _apply_all_transforms(root):
    """Bake rotation/scale on every mesh so glTF carries no loose transforms."""
    bpy.ops.object.select_all(action="DESELECT")
    meshes = [o for o in [root] + list(root.children_recursive) if o.type == "MESH"]
    for obj in meshes:
        obj.select_set(True)
    if not meshes:
        return
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    bpy.ops.object.select_all(action="DESELECT")


def _strip_helpers():
    for obj in list(bpy.data.objects):
        if obj.type in {"CAMERA", "LIGHT"} or obj.name.startswith("__"):
            bpy.data.objects.remove(obj, do_unlink=True)


def export_weapon(weapon_id, root, category, stats=None, name=None):
    """Write ``public/assets/weapons/<name>/<name>.glb`` and the .blend source.

    ``name`` overrides the directory/file stem, which lets a third-party skin be
    published as its own asset (``ak-47/wildlotus.glb``) instead of colliding
    with the weapon it is a finish for.
    """
    # The module owns its canonical id (``ssg08.py`` exports weapon ``ssg-08``),
    # so the output directory must come from the root, not the module filename.
    weapon_id = root.get("weapon_id", weapon_id)
    if name:
        weapon_id = name
    _strip_helpers()
    _apply_all_transforms(root)
    root.location = (0, 0, 0)
    root.rotation_euler = (0, 0, 0)
    root.scale = (1, 1, 1)

    output_dir = GLB_DIR / weapon_id
    output_dir.mkdir(parents=True, exist_ok=True)
    glb_path = output_dir / ("%s.glb" % weapon_id)

    bpy.ops.object.select_all(action="DESELECT")
    for obj in [root] + list(root.children_recursive):
        obj.select_set(True)
    bpy.context.view_layer.objects.active = root

    bpy.ops.export_scene.gltf(
        filepath=str(glb_path),
        export_format="GLB",
        use_selection=True,
        export_yup=True,
        export_apply=False,
        export_materials="EXPORT",
        export_cameras=False,
        export_lights=False,
        export_extras=True,
        export_normals=True,
        export_tangents=False,
        export_texcoords=True,
        export_animations=True,
        # Draco is what keeps a 25-weapon library shippable on the web: it takes
        # a ~280 KB authored mesh down to a few tens of KB with no visible loss
        # at the quantisation levels below. ``WeaponAssetLoader`` wires the
        # matching DRACOLoader decoder from /draco/.
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=7,
        export_draco_position_quantization=14,
        export_draco_normal_quantization=10,
        export_draco_texcoord_quantization=12,
        export_draco_color_quantization=10,
        export_draco_generic_quantization=12,
    )
    SOURCE_DIR.mkdir(parents=True, exist_ok=True)
    blend_path = SOURCE_DIR / ("%s.blend" % weapon_id)
    bpy.ops.wm.save_as_mainfile(filepath=str(blend_path), copy=True)
    return glb_path, blend_path


def update_manifest(entries):
    """Merge per-weapon asset records into the runtime manifest.

    Keeps the flat ``{"id": "/assets/weapons/<id>/<id>.glb"}`` contract used by
    ``WeaponAssetLoader`` while adding rich records under ``assets``.
    """
    manifest = {}
    if MANIFEST_PATH.exists():
        try:
            manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            manifest = {}
    for weapon_id, record in entries.items():
        manifest[weapon_id] = record["model"]
    detail = manifest.setdefault("assets", {})
    for weapon_id, record in entries.items():
        detail[weapon_id] = record
    MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")
    return MANIFEST_PATH


def manifest_view():
    """Path of the staged manifest; publish_assets copies it into the web root."""
    return MANIFEST_PATH
