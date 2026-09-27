"""Detail primitives shared by the sniper-rifle modules.

The shared component library (``weapon_parts``) covers the standard firearm
parts, but a sniper rifle needs three things it does not provide: a genuine
through-hole in a moulded stock, a mount ring that is actually visible from the
side, and enough control over tessellation density on the optic that the largest
curved silhouettes on the weapon do not read faceted at preview resolution.

Everything here composes ``weapon_common`` primitives. Nothing in this module
writes to a shared library file: it is a consumer of the pipeline, not a change
to it.
"""
import bpy

from weapon_common import add_bevel, add_weighted_normals, extrude_profile, link
from weapon_common import rect_profile, tube


def centroid(points):
    return (sum(p[0] for p in points) / len(points),
            sum(p[1] for p in points) / len(points))


def hollow_slab(name, outer, hole, stations, material, parent, bevel=0.003,
                bevel_segments=3):
    """Extrude one closed outline through another, leaving a real hole.

    ``extrude_profile`` can only build solid slabs, and welding four separate
    walls around the void would leave the stock looking like scaffolding. This
    builds the double loop Blender's bridge_loops would: front and back faces
    with a bridge across the void, an outer wall, and an inner wall around the
    hole, so a thumbhole is a genuine through-hole in one manifold solid.

    ``stations`` is a list of ``(x, scale, offset_y, offset_z)`` cross-sections
    along the width, which lets the stock taper and swell like a real moulding.
    Both outlines must wind the same way; with (y, z) profiles that means
    clockwise in the profile plane.
    """
    count = len(outer)
    hole_y, hole_z = centroid(hole)
    verts = []
    for x, scale, off_y, off_z in stations:
        for point_y, point_z in outer:
            verts.append((x, point_y + off_y, point_z + off_z))
        for point_y, point_z in hole:
            verts.append((x,
                          hole_y + (point_y - hole_y) * scale + off_y,
                          hole_z + (point_z - hole_z) * scale + off_z))
    total = count * 2
    faces = []
    for index in range(len(stations) - 1):
        outer_a, inner_a = index * total, index * total + count
        outer_b, inner_b = (index + 1) * total, (index + 1) * total + count
        for step in range(count):
            nxt = (step + 1) % count
            faces.append((outer_a + step, outer_b + step, outer_b + nxt, outer_a + nxt))
            faces.append((inner_a + nxt, inner_b + nxt, inner_b + step, inner_a + step))
            faces.append((outer_a + step, outer_a + nxt, inner_a + nxt, inner_a + step))
            faces.append((outer_b + nxt, outer_b + step, inner_b + step, inner_b + nxt))
    data = bpy.data.meshes.new(name + "Mesh")
    data.from_pydata(verts, [], faces)
    data.validate()
    data.update()
    obj = bpy.data.objects.new(name, data)
    link(obj, parent)
    if material is not None:
        obj.data.materials.append(material)
    if bevel:
        add_bevel(obj, bevel, bevel_segments)
    else:
        add_weighted_normals(obj)
    return obj


def flutes(name, material, parent, y0, y1, radius, count, stations=34):
    """Longitudinal barrel flutes: small tapered rods sunk into the barrel wall.

    They read as light-catching channels and keep the barrel from being a plain
    cylinder, without changing the measured silhouette.
    """
    import math
    made = []
    for index in range(count):
        angle = math.tau * index / count
        sections = []
        for step in range(stations):
            t = step / float(stations - 1)
            y = y0 + (y1 - y0) * t
            fade = min(1.0, min(t, 1.0 - t) * 6.0)
            sections.append((y, radius * (0.30 + 0.34 * fade)))
        rod = tube("%s%d" % (name, index), sections, 7, material, parent, smooth=False)
        rod.location = (math.cos(angle) * radius * 0.90, 0.0,
                        math.sin(angle) * radius * 0.90)
        made.append(rod)
    return made


def scope_ring(name, material, parent, y, z_axis, tube_radius, width):
    """Mount ring band clamping the tube onto its mount post."""
    ring = tube(name, [(y - width / 2, tube_radius * 1.22),
                       (y + width / 2, tube_radius * 1.22)], 28, material, parent, smooth=True)
    ring.location.z = z_axis
    return ring


def knurl_ring(name, material, parent, y0, y1, z_axis, radius, teeth, depth):
    """Magnification ring with machined grip teeth around its circumference.

    Both the band and each tooth are placed explicitly in world coordinates:
    ``tube`` lays its sections along Y, so a tooth's local sections run along its
    own axis and the whole tooth is then rotated onto the ring's radial,
    its position being a point on a circle in the x/z plane.
    """
    import math
    band = tube(name, [(y0, radius), (y1, radius)], 32, material, parent, smooth=True)
    band.location.z = z_axis
    made = [band]
    span = y1 - y0
    tooth_length = span * 0.7
    for index in range(teeth):
        angle = math.tau * index / teeth
        tooth = tube("%sTooth%d" % (name, index),
                     [(-tooth_length / 2, depth), (tooth_length / 2, depth)],
                     8, material, parent, smooth=False)
        tooth.rotation_euler = (0, math.pi / 2, angle + math.pi / 2)
        tooth.location = (math.cos(angle) * radius, (y0 + y1) / 2,
                          z_axis + math.sin(angle) * radius)
        made.append(tooth)
    return made


def optic(name, material, parent, y_objective, y_ocular, z_axis, tube_radius,
          bell_radius, ocular_radius, glass_material, turret_material,
          mount_z, ring_stations, segments=44):
    """Telescopic sight with an objective bell, turrets and mount rings.

    ``weapon_parts.scope`` fixes its tube at 24 segments and its mount rings are
    only visible from behind; on a sniper rifle the optic is the tallest and
    most prominent silhouette element, so it is worth tessellating properly.
    """
    bell = bell_radius
    ocular = ocular_radius
    stations = [
        (y_objective, bell * 0.88),
        (y_objective + 0.008, bell * 0.98),
        (y_objective + 0.016, bell),
        (y_objective + 0.042, bell * 0.99),
        (y_objective + 0.058, bell * 0.90),
        (y_objective + 0.070, tube_radius * 1.08),
        (y_objective + 0.080, tube_radius),
        (y_ocular - 0.052, tube_radius),
        (y_ocular - 0.040, ocular * 0.94),
        (y_ocular - 0.020, ocular),
        (y_ocular - 0.008, ocular * 0.98),
        (y_ocular, ocular * 0.88),
    ]
    body = tube(name + "Tube", stations, segments, material, parent, smooth=True)
    body.location.z = z_axis
    made = [body]

    for label, y, radius in (("Objective", y_objective + 0.012, bell * 0.82),
                             ("Ocular", y_ocular - 0.016, ocular * 0.74)):
        lens = tube("%s%sGlass" % (name, label), [(y, radius), (y + 0.004, radius)],
                    32, glass_material, parent, smooth=True)
        lens.location.z = z_axis
        made.append(lens)

    centre = (y_objective + y_ocular) / 2 + 0.02
    elevation = tube(name + "ElevationTurret",
                     [(z_axis + tube_radius - 0.006, tube_radius * 0.56),
                      (z_axis + tube_radius + 0.010, tube_radius * 0.58),
                      (z_axis + tube_radius + 0.028, tube_radius * 0.54)],
                     26, turret_material, parent, smooth=True)
    elevation.rotation_euler = (1.5707963, 0, 0)
    elevation.location.y = centre
    made.append(elevation)
    windage = tube(name + "WindageTurret",
                   [(tube_radius * 0.45, tube_radius * 0.46),
                    (tube_radius * 0.75, tube_radius * 0.48),
                    (tube_radius * 0.98, tube_radius * 0.44)],
                   26, turret_material, parent, smooth=True)
    windage.rotation_euler = (0, 1.5707963, 0)
    windage.location = (0.0, centre, z_axis)
    made.append(windage)

    for index, station in enumerate(ring_stations):
        base = tube("%sRingBase%d" % (name, index),
                    [(station - 0.011, tube_radius * 1.16),
                     (station + 0.011, tube_radius * 1.16)],
                    28, turret_material, parent, smooth=True)
        base.location.z = z_axis
        made.append(base)
        # A mount post narrower than the rail it stands on reads as a floating
        # optical tube in a side elevation, so the post is built wide enough to
        # visibly straddle the rail, with a clamp foot on top of it.
        post = extrude_profile("%sMountPost%d" % (name, index),
                               rect_profile(station - 0.015, station + 0.015,
                                            mount_z, z_axis - tube_radius * 0.50,
                                            chamfer=0.004),
                               0.042, turret_material, parent, smooth=False,
                               bevel=0.0025)
        made.append(post)
        foot = extrude_profile("%sMountFoot%d" % (name, index),
                               rect_profile(station - 0.020, station + 0.020,
                                            mount_z, mount_z + 0.011, chamfer=0.003),
                               0.050, turret_material, parent, smooth=False,
                               bevel=0.0018)
        made.append(foot)
    return made
