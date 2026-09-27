"""Shared geometry and scene helpers for the clean-room weapon pipeline.

Conventions (all weapons):
  * Blender units are metres and the model is authored at 1 unit = 1 m.
  * +Y is the muzzle direction, +Z is up. ``export_yup`` turns that into
    glTF +Y up with the muzzle pointing down -Z, matching the Three.js
    viewmodel convention used by ``src/weapons/WeaponModel.ts``.
  * Every weapon gets a ``ViewmodelAnchor`` at the bore/breech reference point
    and a ``Muzzle`` empty at the bore exit, so the game can place muzzle flash
    and tracers without hard-coding offsets.

Nothing here reads or imports third-party game assets: all geometry is
generated from numeric descriptions in ``tools/blender/weapons/*.py``.
"""
import math
from contextlib import contextmanager

import bmesh
import bpy
from mathutils import Matrix, Vector

TAU = math.pi * 2


# --------------------------------------------------------------------------
# scene
# --------------------------------------------------------------------------
def reset_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for block in (bpy.data.meshes, bpy.data.curves, bpy.data.materials,
                  bpy.data.images, bpy.data.cameras, bpy.data.lights):
        for item in list(block):
            if item.users == 0:
                block.remove(item)


@contextmanager
def active(obj):
    """Make ``obj`` the active object without relying on the mouse/UI."""
    previous = bpy.context.view_layer.objects.active
    bpy.context.view_layer.objects.active = obj
    try:
        yield obj
    finally:
        try:
            bpy.context.view_layer.objects.active = previous
        except ReferenceError:
            bpy.context.view_layer.objects.active = None


def link(obj, parent=None, keep_transform=True):
    bpy.context.collection.objects.link(obj)
    if parent is not None:
        obj.parent = parent
        if keep_transform:
            obj.matrix_parent_inverse = parent.matrix_world.inverted()
    return obj


def group(name, parent=None, location=(0, 0, 0)):
    node = bpy.data.objects.new(name, None)
    node.empty_display_type = "PLAIN_AXES"
    node.empty_display_size = 0.02
    node.location = location
    link(node, parent)
    return node


def anchor(name, location, parent=None):
    node = bpy.data.objects.new(name, None)
    node.empty_display_type = "ARROWS"
    node.empty_display_size = 0.03
    node.location = location
    link(node, parent)
    return node


@contextmanager
def edit_mode(obj):
    with active(obj):
        bpy.ops.object.mode_set(mode="EDIT")
        try:
            yield
        finally:
            bpy.ops.object.mode_set(mode="OBJECT")


# --------------------------------------------------------------------------
# 2D profiles: the silhouette currency of this pipeline
# --------------------------------------------------------------------------
def rect_profile(x0, x1, z0, z1, chamfer=0.0, chamfer_bottom=None, chamfer_top=None):
    """Closed polygon for an axis-aligned box with optional per-corner chamfers.

    ``x`` runs along the barrel, ``z`` is height. Chamfer values are absolute
    metres; corners are cut symmetrically unless a per-edge value is given.
    """
    cb = chamfer if chamfer_bottom is None else chamfer_bottom
    ct = chamfer if chamfer_top is None else chamfer_top
    ct = min(ct, (x1 - x0) / 2, (z1 - z0) / 2)
    cb = min(cb, (x1 - x0) / 2, (z1 - z0) / 2)
    if ct:
        points = [(x0 + ct, z1), (x1 - ct, z1), (x1, z1 - ct)]
    else:
        points = [(x0, z1), (x1, z1)]
    if cb:
        points += [(x1, z0 + cb), (x1 - cb, z0), (x0 + cb, z0), (x0, z0 + cb)]
    else:
        points += [(x1, z0), (x0, z0)]
    return points


def arc_profile(x0, x1, z0, z1, r, steps=4, corners=15):
    """Rectangle with rounded corners, sampled as a closed polygon."""
    r = min(r, (x1 - x0) / 2, (z1 - z0) / 2)
    cx = [x1 - r, x0 + r, x0 + r, x1 - r]
    cz = [z1 - r, z1 - r, z0 + r, z0 + r]
    start = [0, 90, 180, 270]
    points = []
    for centre_x, centre_z, base in zip(cx, cz, start):
        for i in range(steps + 1):
            a = math.radians(base + 90 * i / steps)
            points.append((centre_x + math.cos(a) * r, centre_z + math.sin(a) * r))
    return points


def half_profile(points, axis=0.0):
    """Mirror the given upper-half points into a closed symmetric polygon.

    Points must be ordered front->back along the top; the result runs forward
    along the top and back along the mirrored bottom.
    """
    lower = [(x, 2 * axis - z) for x, z in reversed(points)]
    return list(points) + lower


def scale_profile(points, sx, sz, origin=(0.0, 0.0)):
    return [(origin[0] + (x - origin[0]) * sx, origin[1] + (z - origin[1]) * sz)
            for x, z in points]


# --------------------------------------------------------------------------
# mesh construction
# --------------------------------------------------------------------------
def _mesh_from_pydata(name, verts, faces, material, parent, smooth):
    mesh = bpy.data.meshes.new(name + "Mesh")
    mesh.from_pydata(verts, [], faces)
    mesh.validate()
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    link(obj, parent)
    if material is not None:
        obj.data.materials.append(material)
    if smooth:
        for polygon in mesh.polygons:
            polygon.use_smooth = True
    return obj


def _ring_indices(count):
    return [(i, (i + 1) % count) for i in range(count)]


# Tessellation density: enough segments that silhouette edges read as curves at
# game distance without pushing past the per-class triangle budget.
DEFAULT_SEGMENTS = 22
DEFAULT_BEVEL_SEGMENTS = 2


def loft(name, sections, material=None, parent=None, smooth=True,
         cap_start=True, cap_end=True, bevel=0.0, bevel_segments=3, shade_auto=True):
    """Bridge equally-sized 2D sections placed at increasing ``y`` into a solid.

    ``sections`` is a list of ``(y, [(axis, height), ...])`` rings. Ring point
    counts must match, which keeps the resulting mesh quad-only and clean.
    """
    if len(sections) < 2:
        raise ValueError("loft '%s' needs at least two sections" % name)
    count = len(sections[0][1])
    for y, ring in sections:
        if len(ring) != count:
            raise ValueError("loft '%s': ring at y=%s has %d points, expected %d"
                             % (name, y, len(ring), count))
    verts = []
    for y, ring in sections:
        for axis, height in ring:
            verts.append((axis, y, height))
    faces = []
    for s in range(len(sections) - 1):
        base_a, base_b = s * count, (s + 1) * count
        ring_edges = _ring_indices(count)
        for i, j in ring_edges:
            faces.append((base_a + i, base_a + j, base_b + j, base_b + i))
    if cap_start:
        faces.append(tuple(range(count - 1, -1, -1)))
    if cap_end:
        base = (len(sections) - 1) * count
        faces.append(tuple(range(base, base + count)))
    obj = _mesh_from_pydata(name, verts, faces, material, parent, smooth)
    if bevel:
        add_bevel(obj, bevel, bevel_segments)
    elif shade_auto:
        add_weighted_normals(obj)
    return obj


def extrude_profile(name, points, depth, material=None, parent=None,
                    x_offset=0.0, smooth=False, bevel=0.0, bevel_segments=3,
                    taper=0.0):
    """Extrude a 2D ``(axis, height)`` profile sideways into a solid slab.

    ``taper`` shrinks the far face for a forged, wedge-like cross-section.
    """
    count = len(points)
    half = depth / 2
    verts = [(x, y, z) for x in (-half, half) for y, z in points]
    if taper:
        verts = [(x * (1 - taper if x > 0 else 1 - taper), y, z) for x, y, z in verts]
    faces = [tuple(range(count - 1, -1, -1)), tuple(range(count, 2 * count))]
    faces += [(i, (i + 1) % count, (i + 1) % count + count, i + count) for i in range(count)]
    if x_offset:
        verts = [(x + x_offset, y, z) for x, y, z in verts]
    obj = _mesh_from_pydata(name, verts, faces, material, parent, smooth)
    if bevel:
        add_bevel(obj, bevel, bevel_segments)
    else:
        add_weighted_normals(obj)
    return obj


def tube(name, sections, segments=DEFAULT_SEGMENTS, material=None, parent=None, smooth=True,
         bevel=0.0, taper_caps=True, cap_start=True, cap_end=True):
    """Revolved tube: ``sections`` is ``(y, radius)`` or ``(y, radius_x, radius_z)``.

    Produces the barrel/suppressor/scope-tube primitives and, with a varying
    radius, real tapers instead of stacked cylinders.
    """
    rings = []
    for section in sections:
        if len(section) == 2:
            y, radius = section
            radius_x = radius_z = radius
        else:
            y, radius_x, radius_z = section
        if radius_x <= 0 or radius_z <= 0:
            rings.append((y, [(0.0, 0.0)] * segments))
            continue
        ring = []
        for i in range(segments):
            a = TAU * i / segments
            ring.append((math.cos(a) * radius_x, math.sin(a) * radius_z))
        rings.append((y, ring))
    verts = []
    for y, ring in rings:
        for axis, height in ring:
            verts.append((axis, y, height))
    faces = []
    for s in range(len(rings) - 1):
        base_a, base_b = s * segments, (s + 1) * segments
        for i in range(segments):
            j = (i + 1) % segments
            faces.append((base_a + i, base_a + j, base_b + j, base_b + i))
    if cap_start:
        faces.append(tuple(range(segments - 1, -1, -1)))
    if cap_end:
        base = (len(rings) - 1) * segments
        faces.append(tuple(range(base, base + segments)))
    obj = _mesh_from_pydata(name, verts, faces, material, parent, smooth)
    if bevel:
        add_bevel(obj, bevel, DEFAULT_BEVEL_SEGMENTS)
    else:
        add_weighted_normals(obj)
    return obj


def sweep(name, path, half_width, material=None, parent=None, chamfer=0.004,
          smooth=False, bevel=0.002, cap_start=True, cap_end=True, segments=1):
    """Sweep a rectangular cross-section along a ``(y, z, depth[, angle])`` path.

    Stations carry their own fore-aft depth and an optional tangent angle in
    radians, which is how curved magazines, raked grips and angled forends get
    real geometry with correctly rotated cross-sections instead of stacked boxes.
    """
    if len(path) < 2:
        raise ValueError("sweep '%s' needs at least two stations" % name)
    ring = [(0, 1), (1, 1), (1, -1), (0, -1)]
    stations = []
    for station in path:
        if len(station) == 4:
            y, z, depth, angle = station
        else:
            y, z, depth = station
            angle = 0.0
        stations.append((y, z, depth, angle))
    # interpolate so a curved path keeps a smooth banana profile
    expanded = []
    for index in range(len(stations) - 1):
        a, b = stations[index], stations[index + 1]
        for step in range(segments):
            t = step / float(segments)
            expanded.append(tuple(a[i] + (b[i] - a[i]) * t for i in range(4)))
    expanded.append(stations[-1])

    verts = []
    for y, z, depth, angle in expanded:
        back, front = -depth / 2, depth / 2
        cos_a, sin_a = math.cos(angle), math.sin(angle)
        for along, side in ring:
            local_y = back + (front - back) * along
            local_z = side * half_width
            # rotate the cross-section onto the path tangent (around X)
            verts.append((local_z, y + local_y * cos_a - local_z * sin_a,
                          z + local_y * sin_a + local_z * cos_a))
    faces = []
    count = len(expanded)
    for s in range(count - 1):
        base_a, base_b = s * 4, (s + 1) * 4
        for i in range(4):
            j = (i + 1) % 4
            faces.append((base_a + i, base_a + j, base_b + j, base_b + i))
    if cap_start:
        faces.append((3, 2, 1, 0))
    if cap_end:
        base = (count - 1) * 4
        faces.append((base, base + 1, base + 2, base + 3))
    obj = _mesh_from_pydata(name, verts, faces, material, parent, smooth)
    if bevel:
        add_bevel(obj, bevel, DEFAULT_BEVEL_SEGMENTS)
    else:
        add_weighted_normals(obj)
    return obj


def bore(name, y0, y1, z, radius, segments=DEFAULT_SEGMENTS, material=None, parent=None,
         radius_start=None, radius_end=None):
    """Convenience axis-aligned tube at height ``z``."""
    if y0 > y1:
        y0, y1 = y1, y0
    r0 = radius if radius_start is None else radius_start
    r1 = radius if radius_end is None else radius_end
    return tube(name, [(y0, r0), (y1, r1)], segments, material, parent)


def bolt_ring(name, y, z, count, radius, material, parent, inner=0.75, angle=0.0):
    """Ring of small cylinders (suppressor ports, cooling holes, rivets)."""
    made = []
    for i in range(count):
        a = angle + TAU * i / count
        made.append(tube(name + str(i),
                         [(y - radius * 0.5, radius * (1 - inner)), (y + radius * 0.5, radius * (1 - inner))],
                         10, material, parent))
        made[-1].rotation_euler = (math.pi / 2, 0, 0)
        made[-1].location = (0, 0, 0)
    return made


def slot_rail(name, y0, y1, z, width, height, material, parent, pitch=0.021,
              slot=0.011, depth=0.008):
    """Picatinny-style rail: a base bar with transverse recoil slots."""
    span = y1 - y0
    bar = extrude_profile(name, rect_profile(y0, y1, z, z + height, chamfer=0.003),
                          width, material, parent, smooth=False, bevel=0.0015)
    slots = []
    position = y0 + pitch * 0.5
    while position + slot < y1 - 0.004:
        slots.append(extrude_profile(name + "Slot%d" % len(slots),
                                     rect_profile(position, position + slot, z + height - depth, z + height + 0.0005),
                                     width * 1.001, material, parent, smooth=False))
        position += pitch
    return bar, slots


def knurl(name, y0, y1, z, half_width, tooth, count, material, parent, depth=0.006):
    """Machined grip ribs on both flanks (or teeth when ``half_width`` is 0)."""
    made = []
    span = (y1 - y0)
    for i in range(count):
        y = y0 + span * (i + 0.5) / count
        for side in (-1, 1):
            if half_width == 0 and side < 0:
                continue
            rib = extrude_profile("%s%d_%d" % (name, i, side),
                                  rect_profile(y - tooth / 2, y + tooth / 2, z - depth / 2, z + depth / 2),
                                  0.004, material, parent, smooth=False)
            rib.location.x = side * half_width
            made.append(rib)
    return made


def apply_mirror(obj):
    with active(obj):
        modifier = obj.modifiers.new("Symmetry", "MIRROR")
        modifier.use_axis = (True, False, False)
        modifier.use_clip = True
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    return obj


def add_bevel(obj, width, segments=DEFAULT_BEVEL_SEGMENTS, angle=35.0, clamp=True):
    modifier = obj.modifiers.new("Machined bevel", "BEVEL")
    modifier.width = width
    modifier.segments = segments
    modifier.limit_method = "ANGLE"
    modifier.angle_limit = math.radians(angle)
    modifier.use_clamp_overlap = clamp
    return modifier


def add_weighted_normals(obj, keep_sharp=True):
    if "WEIGHTED_NORMAL" not in {item.type for item in obj.modifiers}:
        modifier = obj.modifiers.new("Weighted normals", "WEIGHTED_NORMAL")
        modifier.keep_sharp = keep_sharp
    return obj


def apply_modifiers(obj):
    with active(obj):
        for modifier in list(obj.modifiers):
            try:
                bpy.ops.object.modifier_apply(modifier=modifier.name)
            except RuntimeError as error:
                print("  ! modifier %s on %s: %s" % (modifier.name, obj.name, error))
    return obj


def box(name, centre, dimensions, material, parent=None, bevel=0.004, smooth=False):
    y, x, z = centre
    dy, dx, dz = dimensions
    return extrude_profile(name,
                           rect_profile(y - dy / 2, y + dy / 2, z - dz / 2, z + dz / 2),
                           dx, material, parent, smooth=smooth, bevel=bevel)


def uv_unwrap(obj, blend=0.35, margin=0.006):
    """Angle-based unwrap so every exported part carries usable UVs."""
    with active(obj):
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="SELECT")
        try:
            bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=margin)
        except RuntimeError:
            bpy.ops.uv.smart_project(island_margin=margin)
        bpy.ops.object.mode_set(mode="OBJECT")
    return obj


def triangulate(obj):
    with active(obj):
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="SELECT")
        bpy.ops.mesh.quads_convert_to_tris(quad_method="BEAUTY", ngon_method="BEAUTY")
        bpy.ops.object.mode_set(mode="OBJECT")
    return obj


def weld(obj, distance=0.00015):
    """Merge coincident vertices so shared corners are stored once.

    Flat-shaded and beveled parts otherwise export one copy of every vertex per
    face, which roughly triples the position/normal/UV payload in the GLB.
    """
    before = len(obj.data.vertices)
    with active(obj):
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="SELECT")
        bpy.ops.mesh.remove_doubles(threshold=distance)
        bpy.ops.mesh.normals_make_consistent(inside=False)
        bpy.ops.object.mode_set(mode="OBJECT")
    after = len(obj.data.vertices)
    return before - after


def quantize_uv(obj, levels=65535.0):
    """Store UVs as 16-bit-normalised floats: identical look, half the bytes."""
    mesh = obj.data
    for layer in mesh.uv_layers:
        for datum in layer.data:
            datum.uv[0] = round(datum.uv[0] * levels) / levels
            datum.uv[1] = round(datum.uv[1] * levels) / levels
    return obj


def decimate(obj, target_triangles):
    """Collapse a mesh down to a web-appropriate triangle budget.

    The authored profiles are dense enough to survive a ratio collapse without
    losing the silhouette, and a browser FPS is far better served by a 6k-tri
    weapon than a 20k-tri one. Collapse is skipped when the mesh is already at
    or under the target.
    """
    current = len(obj.data.loop_triangles) if obj.data.loop_triangles else 0
    if not current:
        obj.data.calc_loop_triangles()
        current = len(obj.data.loop_triangles)
    if current <= target_triangles or current == 0:
        return current
    ratio = target_triangles / float(current)
    modifier = obj.modifiers.new("WebBudget", "DECIMATE")
    modifier.decimate_type = "COLLAPSE"
    modifier.ratio = max(0.05, min(1.0, ratio))
    modifier.use_collapse_triangulate = True
    with active(obj):
        try:
            bpy.ops.object.modifier_apply(modifier=modifier.name)
        except RuntimeError:
            obj.modifiers.remove(modifier)
            return current
    obj.data.calc_loop_triangles()
    return len(obj.data.loop_triangles)


def counts(obj):
    mesh = obj.data
    mesh.calc_loop_triangles()
    return len(mesh.loop_triangles), len(mesh.vertices)


# Sub-trees that must stay independently transformable for animation. Their
# contents are batched internally but never merged into the static body.
ANIMATABLE = ("Magazine", "Trigger", "Bolt", "Slide", "ChargingHandle", "Stock",
              "SafetyLever", "Hammer", "PivotLeft", "PivotRight", "HandleLeft",
              "HandleRight", "Blade", "FingerRing", "Latch")


def _preserved(node):
    """True when this object or an ancestor is an independently animated part."""
    current = node
    while current is not None:
        name = current.name
        if any(name == part or name.startswith(part) for part in ANIMATABLE):
            return True
        current = current.parent
    return False


def batch_by_material(root):
    """Merge sibling meshes that share a material into one object per slot.

    A weapon authored as ~70 small parts exports as ~70 glTF primitives, which
    costs both file size and one draw call each in the browser. Batching per
    (parent group, material) cuts that to a handful of primitives while keeping
    every animatable sub-tree (magazine, bolt, trigger, ...) separate.
    """
    merged_count = 0
    removed = 0
    # Snapshot the groups first: removing child meshes invalidates the live
    # children_recursive iterator mid-walk.
    groups = [node for node in [root] + list(root.children_recursive) if node.type == "EMPTY"]
    for group_node in groups:
        batch = {}
        for child in list(group_node.children):
            if child.type != "MESH" or _preserved(child) or not child.data.materials:
                continue
            batch.setdefault(child.data.materials[0].name, []).append(child)
        for material_name, members in batch.items():
            if len(members) < 2:
                continue
            bpy.context.view_layer.update()
            material = bpy.data.materials[material_name]
            vertices, faces = [], []
            smooth = False
            for member in members:
                matrix = member.matrix_world
                offset = len(vertices)
                for vertex in member.data.vertices:
                    point = matrix @ vertex.co
                    vertices.append((point.x, point.y, point.z))
                for polygon in member.data.polygons:
                    if polygon.use_smooth:
                        smooth = True
                    faces.append(tuple(offset + index for index in polygon.vertices))
            name = members[0].name + "_Batched"
            mesh = bpy.data.meshes.new(name + "Mesh")
            mesh.from_pydata(vertices, [], faces)
            mesh.validate()
            mesh.update()
            batched = bpy.data.objects.new(name, mesh)
            link(batched, group_node)
            batched.data.materials.append(material)
            if smooth:
                for polygon in mesh.polygons:
                    polygon.use_smooth = True
            uv_unwrap(batched, margin=0.004)
            for member in members:
                bpy.data.objects.remove(member, do_unlink=True)
                removed += 1
            merged_count += 1
    bpy.context.view_layer.update()
    if merged_count:
        print("   batched %d material groups (%d objects merged)"
              % (merged_count, removed))
    return merged_count


def set_origin(obj, point, keep_world=True):
    """Move the object origin to ``point`` without moving the geometry."""
    point = Vector(point)
    mesh = obj.data
    for vertex in mesh.vertices:
        vertex.co -= point
    obj.location += point
    return obj
