"""Forged-knife geometry shared by the four knife modules.

Knife frame (deliberately different from the firearm modules):

  * ``+Y`` is blade-forward, ``+Z`` is up, ``+X`` is right.
  * The blade's flat faces look along ``+-X``, so the cutting edge and the spine
    separate along ``Z``. A blade here is a real forging swept from
    cross-sections: a nearly sharp edge apex, a secondary bevel, the primary
    grind, the flat, an optional fuller and a rounded spine. The spine is many
    times thicker than the edge, which is what makes the silhouette read as a
    knife instead of an extruded plane.
  * Handles occupy negative ``Y`` and the blade positive ``Y``, matching the
    runtime ``KnifeAnimationController`` and ``weaponHands()``.

Every cross-section is wound clockwise in ``(x, t)``, and every solid is swept
along its own path, so curved parts (the karambit claw, the balisong channels)
get correctly rotated sections rather than stacked boxes. Nothing here projects
a reference image: the four supplied PNGs only set proportions, and every
colour is a runtime material slot.
"""
import math

import bmesh
import bpy
from mathutils import Matrix

import weapon_materials as library
from weapon_common import add_bevel, add_weighted_normals, tube

TAU = math.pi * 2.0

# --------------------------------------------------------------------------
# runtime skin slots
# --------------------------------------------------------------------------
# ``KnifeMaterialFactory`` resolves a gem finish from the *object* name
# (``Blade`` / ``Inlay*`` / ``Grip``). The asset loader's slot convention is a
# ``SkinSlot`` material-name substring; ``knife_palette()`` already spells its
# slots ``*_SkinSlot``, and the copies below carry the fully qualified
# ``SkinSlot_<slot>`` spelling as well so either rule resolves. PBR values are
# the shared library's, untouched.
SLOT_NAMES = {
    "blade": "M_SkinSlot_Blade_Polished",
    "grip": "M_SkinSlot_Grip_Charcoal",
    "inlay": "M_SkinSlot_Inlay_Gem",
}


def slots(palette):
    """Rename the three knife skin slots so both runtime rules match."""
    resolved = dict(palette)
    for slot, name in SLOT_NAMES.items():
        material = palette[slot].copy()
        material.name = name
        resolved[slot] = material
    return resolved


def fittings():
    """Non-skinned extras: recessed steel for sockets, a rubber wrap."""
    return {
        "recess": library.pbr("M_KnifeRecess", (0.014, 0.015, 0.017), 0.55, 0.60),
        "wrap": library.pbr("M_KnifeWrap", (0.032, 0.033, 0.031), 0.05, 0.82),
    }


# --------------------------------------------------------------------------
# cross-sections: all clockwise in (x, t)
# --------------------------------------------------------------------------
def _arc(cx, ct, r, a0, a1, steps):
    """``steps`` samples from ``a0`` towards ``a1``, excluding ``a1``."""
    return [(cx + r * math.cos(a0 + (a1 - a0) * i / steps),
             ct + r * math.sin(a0 + (a1 - a0) * i / steps)) for i in range(steps)]


def mirrored_ring(ring):
    """Mirror a clockwise section across ``x = 0`` while keeping the winding."""
    return [(-x, t) for x, t in reversed(ring)]


def rounded_ring(width, height, radius, steps=4, channel=None):
    """Clockwise rounded rectangle, optionally channelled on the ``-x`` face.

    ``channel`` is ``(low, high, depth, wall)`` in metres along the height
    axis; it cuts a real trough with chamfered walls, which is what gives a
    balisong handle its machined look instead of a plain slab.
    """
    half_w, half_h = width / 2.0, height / 2.0
    r = min(radius, half_w * 0.9, half_h * 0.9)
    ring = []
    ring += _arc(half_w - r, half_h - r, r, math.pi / 2, 0.0, steps)
    ring += _arc(half_w - r, -half_h + r, r, 0.0, -math.pi / 2, steps)
    ring += _arc(-half_w + r, -half_h + r, r, -math.pi / 2, -math.pi, steps)
    if channel is not None:
        low, high, depth, wall = channel
        ring.append((-half_w, low - wall))
        ring.append((-half_w + depth, low))
        ring.append((-half_w + depth, high))
        ring.append((-half_w, high + wall))
    ring += _arc(-half_w + r, half_h - r, r, math.pi, math.pi / 2, steps)
    return ring


def blade_profile(grind=0.22, ratio=0.82, spine=0.115, secondary=0.055,
                  fuller=None, scale=1.0):
    """``(thickness fraction, position fraction)`` pairs, spine first.

    Position runs ``0`` at the cutting edge to ``1`` at the spine crest. The
    returned polyline is a full forging sequence: edge apex, secondary bevel,
    primary grind, flat, a machined fuller or blood groove, spine shoulder,
    upper spine and crest.

    The fuller is a real channel with near-vertical shoulders rather than a
    shallow dip, so it survives the pipeline's angle-based smoothing as a crisp
    groove with two visible rails. ``scale`` fades it out towards the tip
    without collapsing the section into degenerate faces.
    """
    edge = 1.0 - spine
    points = [(0.55, 1.0), (0.93, 1.0 - spine * 0.22), (0.995, edge)]
    if fuller is not None:
        low, high, floor = fuller
        depth = max((0.995 - floor) * scale, 0.02)
        shoulder = 0.028
        points += [(0.995, high),
                   (0.995 - depth, high - shoulder),
                   (0.995 - depth, low + shoulder),
                   (0.995, low)]
    points.append((ratio, grind))
    points.append((ratio * 0.30, secondary))
    points.append((0.0, 0.0))
    return points


def blade_ring(width, thickness, shape):
    """Closed blade section: ``width`` across the blade, ``thickness`` through."""
    half_thick, half_width = thickness / 2.0, width / 2.0
    right = [(half_thick * ft, -half_width + fp * width) for ft, fp in shape]
    # the edge apex sits on x = 0, so it is shared by both flanks
    return right + [(-x, t) for x, t in reversed(right[:-1])]


def panel_ring(width, height, radius, steps=3):
    """Thin rounded slab used for inlay scales and grip panels."""
    return rounded_ring(width, height, radius, steps)


def station(cy, cz, angle, ring):
    """One swept station: centre in the ``YZ`` plane plus its section."""
    return {"cy": cy, "cz": cz, "angle": math.radians(angle), "ring": ring}


def straight(rows):
    """Insert a zero sweep angle into ``(cy, cz, width, thickness[, fade])``."""
    return [(row[0], row[1], 0.0) + tuple(row[2:]) for row in rows]


def resample(rows, count):
    """Catmull-Rom resample of control rows onto ``count`` even stations.

    Authoring a blade from a dozen hand-placed stations and then evaluating a
    spline through them is what separates a forged silhouette from a chain of
    straight facets.
    """
    if count <= len(rows):
        return [tuple(row) for row in rows]
    span = len(rows) - 1
    extended = [rows[0]] + list(rows) + [rows[-1]]
    made = []
    for index in range(count):
        u = index / float(count - 1) * span
        segment = min(int(u), span - 1)
        t = u - segment
        p0, p1, p2, p3 = extended[segment:segment + 4]
        row = []
        for k in range(len(rows[0])):
            a, b, c, d = p0[k], p1[k], p2[k], p3[k]
            row.append(0.5 * (2.0 * b + (c - a) * t
                              + (2.0 * a - 5.0 * b + 4.0 * c - d) * t * t
                              + (3.0 * b - a - 3.0 * c + d) * t * t * t))
        made.append(tuple(row))
    return made


def blade(rows, fuller=None, count=None, **profile):
    """Turn ``(cy, cz, angle, width, thickness[, fuller fade])`` into stations."""
    if count:
        rows = resample(rows, count)
    made = []
    for row in rows:
        cy, cz, angle, width, thickness = row[:5]
        fade = max(0.0, min(1.0, row[5] if len(row) > 5 else 1.0))
        section = blade_profile(fuller=fuller, scale=fade, **profile)
        made.append(station(cy, cz, angle, blade_ring(width, thickness, section)))
    return made


# --------------------------------------------------------------------------
# mesh construction
# --------------------------------------------------------------------------
def box_uv(obj, scale=7.0):
    """Cheap triplanar UV so the runtime procedural skin has coordinates."""
    mesh = obj.data
    uv = mesh.uv_layers.new(name="KnifeUV")
    for polygon in mesh.polygons:
        normal = polygon.normal
        axis = max(range(3), key=lambda i: abs(normal[i]))
        for loop in polygon.loop_indices:
            co = mesh.vertices[mesh.loops[loop].vertex_index].co
            pair = ((co.y, co.z), (co.x, co.z), (co.x, co.y))[axis]
            uv.data[loop].uv = (pair[0] * scale + 0.5, pair[1] * scale + 0.5)
    return obj


def mark_sharp(obj, angle=24.0, count=None):
    """Split normals only where the surface really creases.

    With ``count`` set (the swept section size) only edges that run *along* the
    sweep are considered, which is exactly what keeps a forged grind line crisp
    for its whole length while the transverse facets stay smooth. Without it the
    test is purely angular, which is what the machined hardware wants.

    ``bake_geometry`` re-runs ``shade_smooth_by_angle`` with ``keep_sharp_edges``
    enabled, so these creases survive the rest of the pipeline.
    """
    mesh = obj.data
    limit = math.radians(angle)
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bm.normal_update()
    bm.verts.index_update()
    for edge in bm.edges:
        if count is not None:
            first, second = edge.verts
            if (first.index % count) != (second.index % count):
                continue
        faces = edge.link_faces
        if len(faces) != 2:
            edge.smooth = False
            continue
        try:
            edge.smooth = faces[0].normal.angle(faces[1].normal) < limit
        except ValueError:
            edge.smooth = False
    bm.to_mesh(mesh)
    bm.free()
    mesh.update()
    return obj


def signed_volume(mesh):
    mesh.calc_loop_triangles()
    total = 0.0
    for triangle in mesh.loop_triangles:
        a, b, c = (mesh.vertices[i].co for i in triangle.vertices)
        total += a.dot(b.cross(c))
    return total / 6.0


def ensure_outward(obj):
    """Flip a closed solid whose winding came out inside-out."""
    if signed_volume(obj.data) < 0.0:
        mesh = obj.data
        bm = bmesh.new()
        bm.from_mesh(mesh)
        bmesh.ops.reverse_faces(bm, faces=bm.faces)
        bm.to_mesh(mesh)
        bm.free()
        mesh.update()
    return obj


def local(obj):
    """Anchor an object's transform to its parent's local space.

    Knife geometry is always authored in its parent's frame, so the pivot
    empties that drive ``flipOpen`` / ``flipClose`` can be moved without a
    parent-inverse silently cancelling the offset.
    """
    obj.matrix_parent_inverse = Matrix.Identity(4)
    return obj


def solid(name, verts, faces, material, parent, smooth=True):
    mesh = bpy.data.meshes.new(name + "Mesh")
    mesh.from_pydata(verts, [], faces)
    mesh.validate(verbose=False)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    if parent is not None:
        obj.parent = parent
    if material is not None:
        obj.data.materials.append(material)
    if smooth:
        for polygon in mesh.polygons:
            polygon.use_smooth = True
    return obj


def forged(name, stations, material, parent, bevel=0.00035, bevel_segments=2,
           smooth_angle=24.0, smooth=True, caps=True, x_offset=0.0,
           bevel_angle=34.0):
    """Sweep a list of sections along its own path into a closed solid.

    Sections are rotated onto the local tangent, so a curved claw keeps a
    correctly oriented grind instead of shearing, which is what makes the
    karambit and the balisong handle read as machined forgings. Pass
    ``smooth=False`` for a blade: a forging is flat-ground, and flat shading is
    what makes the secondary bevel, the grind line and the fuller read as real
    facets rather than a soft gradient.
    """
    if len(stations) < 2:
        raise ValueError("forged '%s' needs at least two stations" % name)
    count = len(stations[0]["ring"])
    for item in stations:
        if len(item["ring"]) != count:
            raise ValueError("forged '%s': section sizes differ (%d vs %d)"
                             % (name, len(item["ring"]), count))
    verts = []
    for item in stations:
        angle = item["angle"]
        sin_a, cos_a = math.sin(angle), math.cos(angle)
        for x, t in item["ring"]:
            verts.append((x + x_offset, item["cy"] - t * sin_a, item["cz"] + t * cos_a))
    faces = []
    for index in range(len(stations) - 1):
        base_a, base_b = index * count, (index + 1) * count
        for i in range(count):
            j = (i + 1) % count
            faces.append((base_a + i, base_a + j, base_b + j, base_b + i))
    if caps:
        faces.append(tuple(range(count - 1, -1, -1)))
        base = (len(stations) - 1) * count
        faces.append(tuple(range(base, base + count)))
    obj = solid(name, verts, faces, material, parent, smooth)
    if bevel:
        add_bevel(obj, bevel, bevel_segments, angle=bevel_angle)
    add_weighted_normals(obj)
    mark_sharp(obj, smooth_angle, count=count)
    box_uv(obj)
    return ensure_outward(obj)


# --------------------------------------------------------------------------
# turned hardware
# --------------------------------------------------------------------------
def _turn(name, sections, segments, material, parent, at, axis="x",
          bevel=0.0002, angle=40.0):
    """Revolve a section list and place it with its axis along ``axis``."""
    sections = sorted(sections, key=lambda item: item[0])
    obj = tube(name, sections, segments, material, parent, smooth=True, bevel=bevel)
    if axis == "x":
        obj.rotation_euler = (0.0, 0.0, -math.pi / 2)
    elif axis == "z":
        obj.rotation_euler = (math.pi / 2, 0.0, 0.0)
    obj.location = at
    local(obj)
    mark_sharp(obj, angle)
    box_uv(obj)
    return obj


def pin(name, at, radius, length, material, parent, segments=22, head=0.0,
        head_radius=1.0, socket=None, socket_material=None):
    """Pivot pin / sex bolt: shank, domed heads on both ends, hex sockets.

    A knife pivot is a two-sided fastener, so both flanks of the handle get a
    head and a socket rather than one blind stud.
    """
    half = length / 2.0
    if head:
        sections = [(-half, radius * 0.88),
                    (-half + head * 0.14, radius * head_radius),
                    (-half + head * 0.55, radius * head_radius * 0.86),
                    (-half + head, radius * 0.96),
                    (half - head, radius * 0.96),
                    (half - head * 0.55, radius * head_radius * 0.86),
                    (half - head * 0.14, radius * head_radius),
                    (half, radius * 0.88)]
    else:
        sections = [(-half, radius * 0.94), (half, radius * 0.94)]
    made = _turn(name, sections, segments, material, parent, at)
    if socket:
        depth = head * socket if head else radius * 0.4
        for sign, label in ((-1, "Inner"), (1, "Outer")):
            _turn("%sSocket%s" % (name, label),
                  [(sign * (half - depth), radius * head_radius * 0.50),
                   (sign * (half + 0.0002), radius * head_radius * 0.56)],
                  6, socket_material or material, parent, at, bevel=0.0)
    return made


def washer(name, at, radius, thickness, material, parent, segments=22):
    """Thin turned collar: pivot washers, ferrules, lanyard tubes."""
    half = thickness / 2.0
    return _turn(name, [(-half, radius * 0.90), (-half * 0.6, radius),
                        (half * 0.6, radius), (half, radius * 0.90)],
                 segments, material, parent, at, bevel=0.00012)


def collar(name, at, radius, length, material, parent, segments=22, flare=1.16):
    """Barrel-shaped collar used for guards, ferrules and the karambit choil."""
    half = length / 2.0
    return _turn(name, [(-half, radius * 0.86), (-half * 0.65, radius),
                        (half * 0.65, radius), (half, radius * 0.86)],
                 segments, material, parent, at, bevel=0.0003)


def ring_body(name, at, major, minor, material, parent, major_segments=22,
              minor_segments=14, axis="x"):
    """Torus for a finger ring or a bayonet muzzle ring, plus its flat lands."""
    bpy.ops.mesh.primitive_torus_add(major_segments=major_segments,
                                     minor_segments=minor_segments,
                                     major_radius=major, minor_radius=minor)
    obj = bpy.context.object
    obj.name = name
    obj.data.name = name + "Mesh"
    obj.data.materials.append(material)
    if axis == "x":
        obj.rotation_euler = (0.0, math.pi / 2, 0.0)
    elif axis == "y":
        obj.rotation_euler = (math.pi / 2, 0.0, 0.0)
    obj.location = at
    obj.parent = parent
    local(obj)
    mark_sharp(obj, 24.0)
    box_uv(obj)
    return obj


def tooth(name, at, length, width, height, rake, material, parent, segments=3):
    """One spine serration: a real raked wedge, swept along the blade axis."""
    stations = []
    steps = 5
    for index in range(steps):
        t = index / float(steps - 1)
        shrink = 1.0 - 0.80 * t * t
        stations.append(station(at[1] + length * t, at[2] + rake * t * t, 0.0,
                                rounded_ring(width * shrink, height * shrink,
                                             width * 0.22 * shrink, segments)))
    return forged(name, stations, material, parent, bevel=0.00018,
                  bevel_segments=2, x_offset=at[0])
