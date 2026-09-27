"""Preview rendering for the visual self-check loop.

Every weapon is rendered in a consistent studio: dark charcoal backdrop, three
quarter hero view, soft key light, cool rim light, neutral orthographic camera.
A second orthographic side elevation is rendered with a black silhouette so the
model outline can be compared numerically against the reference silhouette.
"""
import math
from pathlib import Path

import bpy

ROOT = Path(__file__).resolve().parents[2]
PREVIEW_DIR = Path(__file__).resolve().parent / "previews"
SILHOUETTE_DIR = Path(__file__).resolve().parent / "silhouettes"


def _object_bounds(objects):
    from mathutils import Vector
    minimum = Vector((1e9, 1e9, 1e9))
    maximum = Vector((-1e9, -1e9, -1e9))
    for obj in objects:
        if obj.type != "MESH":
            continue
        for corner in obj.bound_box:
            point = obj.matrix_world @ Vector(corner)
            for i in range(3):
                minimum[i] = min(minimum[i], point[i])
                maximum[i] = max(maximum[i], point[i])
    if minimum.x > maximum.x:
        return Vector((-0.5, -0.5, -0.5)), Vector((0.5, 0.5, 0.5))
    return minimum, maximum


def _gradient_backdrop(strength=0.16):
    """Dark charcoal studio: a large curved plane behind the subject."""
    bpy.ops.mesh.primitive_plane_add(size=8, location=(0, 0, -2.2))
    floor = bpy.context.object
    floor.name = "__backdrop"
    material = bpy.data.materials.new("StudioBackdrop")
    material.use_nodes = True
    bsdf = material.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (0.035, 0.037, 0.040, 1)
    bsdf.inputs["Roughness"].default_value = 0.72
    bsdf.inputs["Metallic"].default_value = 0.0
    floor.data.materials.append(material)

    bpy.ops.mesh.primitive_plane_add(size=14, location=(0, -3.5, 0), rotation=(math.pi / 2, 0, 0))
    wall = bpy.context.object
    wall.name = "__wall"
    wall_material = bpy.data.materials.new("StudioWall")
    wall_material.use_nodes = True
    wall_bsdf = wall_material.node_tree.nodes["Principled BSDF"]
    wall_bsdf.inputs["Base Color"].default_value = (0.022, 0.024, 0.028, 1)
    wall_bsdf.inputs["Roughness"].default_value = 0.9
    wall.data.materials.append(wall_material)
    return floor, wall


def _lights():
    key = bpy.data.lights.new("KeyLight", type="AREA")
    key.energy = 260.0
    key.size = 2.6
    key.color = (1.0, 0.96, 0.90)
    key_object = bpy.data.objects.new("KeyLight", key)
    bpy.context.collection.objects.link(key_object)
    key_object.location = (-1.5, -1.6, 1.9)
    key_object.rotation_euler = (math.radians(48), 0, math.radians(-38))

    rim = bpy.data.lights.new("RimLight", type="AREA")
    rim.energy = 180.0
    rim.size = 1.6
    rim.color = (0.68, 0.86, 1.0)
    rim_object = bpy.data.objects.new("RimLight", rim)
    bpy.context.collection.objects.link(rim_object)
    rim_object.location = (1.9, 1.5, 1.1)
    rim_object.rotation_euler = (math.radians(62), 0, math.radians(128))

    fill = bpy.data.lights.new("FillLight", type="AREA")
    fill.energy = 60.0
    fill.size = 3.0
    fill.color = (0.82, 0.88, 0.92)
    fill_object = bpy.data.objects.new("FillLight", fill)
    bpy.context.collection.objects.link(fill_object)
    fill_object.location = (0.2, -2.4, 0.2)
    fill_object.rotation_euler = (math.radians(86), 0, math.radians(4))
    return key_object, rim_object, fill_object


def _camera(location, look_at, ortho_scale=None, lens=62.0, clip_span=None):
    camera_data = bpy.data.cameras.new("PreviewCamera")
    camera_data.lens = lens
    if ortho_scale:
        camera_data.type = "ORTHO"
        camera_data.ortho_scale = ortho_scale
    if clip_span:
        # A converted third-party import can be kilometres long before it is
        # normalised; the default 100 m far plane would clip it away entirely.
        camera_data.clip_start = max(0.01, clip_span * 0.001)
        camera_data.clip_end = clip_span * 12.0
    camera = bpy.data.objects.new("PreviewCamera", camera_data)
    bpy.context.collection.objects.link(camera)
    camera.location = location
    _aim(camera, look_at)
    bpy.context.scene.camera = camera
    return camera


def _aim(camera, target):
    from mathutils import Vector
    direction = Vector(target) - camera.location
    camera.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def setup_studio(resolution=1200, samples=48):
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = samples
    scene.cycles.use_denoising = True
    try:
        scene.cycles.device = "CPU"
    except (AttributeError, TypeError):
        pass
    scene.render.resolution_x = resolution
    scene.render.resolution_y = resolution
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = False
    # AgX keeps highlight rolloff without crushing the dark gunmetal palette.
    available = [item.identifier for item in scene.view_settings.bl_rna.properties["view_transform"].enum_items]
    for candidate in ("AgX", "Filmic", "Standard"):
        if candidate in available:
            scene.view_settings.view_transform = candidate
            break
    scene.view_settings.look = "None"
    scene.view_settings.exposure = 0.45
    scene.world = bpy.data.worlds.new("StudioWorld") if scene.world is None else scene.world
    scene.world.use_nodes = True
    background = scene.world.node_tree.nodes.get("Background")
    if background:
        background.inputs[0].default_value = (0.012, 0.013, 0.016, 1)
        background.inputs[1].default_value = 0.55
    return scene


def render_previews(root, weapon_id, resolution=1200, samples=48, angles=None):
    """Render the hero 3/4 preview plus supporting views."""
    PREVIEW_DIR.mkdir(parents=True, exist_ok=True)
    objects = [root] + list(root.children_recursive)
    minimum, maximum = _object_bounds(objects)
    centre = (minimum + maximum) / 2
    size = maximum - minimum
    span = max(size.x, size.y, size.z)

    setup_studio(resolution, samples)
    _gradient_backdrop()
    _lights()

    angles = angles or {
        "preview": (1.05, 0.42),
        "side": (0.0, 0.0),
        "front": (math.pi / 2, 0.0),
    }
    outputs = {}
    for name, (yaw, pitch) in angles.items():
        distance = span * 2.1
        location = (
            centre.x + math.sin(yaw) * distance * math.cos(pitch),
            centre.y - math.cos(yaw) * distance * math.cos(pitch),
            centre.z + math.sin(pitch) * distance + span * 0.06,
        )
        camera = _camera(location, centre)
        path = PREVIEW_DIR / ("%s_%s.png" % (weapon_id, name))
        bpy.context.scene.render.filepath = str(path)
        bpy.ops.render.render(write_still=True)
        outputs[name] = path
        bpy.data.objects.remove(camera, do_unlink=True)
    return outputs


def render_silhouette(root, weapon_id, resolution=1024, objects=None):
    """Flat white-on-black orthographic side elevation for outline scoring.

    Pass ``objects`` to render loose parts that are not under a weapon root yet,
    which is what the conversion step needs while it is still choosing a facing.
    """
    SILHOUETTE_DIR.mkdir(parents=True, exist_ok=True)
    if objects is None:
        if root is None:
            raise ValueError("render_silhouette needs a root or an object list")
        objects = [root] + list(root.children_recursive)
    minimum, maximum = _object_bounds(objects)
    centre = (minimum + maximum) / 2
    size = maximum - minimum
    span = max(size.x, size.y, size.z)

    scene = bpy.context.scene
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.display.shading.light = "FLAT"
    scene.display.shading.color_type = "SINGLE"
    scene.display.shading.single_color = (1, 1, 1)
    scene.render.resolution_x = resolution
    scene.render.resolution_y = resolution
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"

    distance = span * 2.2
    # Reference art is a LEFT-side elevation with the muzzle to the right.
    # Viewing from -X puts +Y (the muzzle) on screen-right, so the rendered
    # outline lines up with the reference without mirroring.
    camera = _camera((centre.x - distance, centre.y, centre.z), centre,
                     ortho_scale=span * 1.18, clip_span=span)
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = span * 1.18
    path = SILHOUETTE_DIR / ("%s_silhouette.png" % weapon_id)
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(camera, do_unlink=True)
    return path
