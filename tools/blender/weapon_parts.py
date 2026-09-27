"""Parametric firearm component library.

Every component is described by numbers that describe the *silhouette* first:
profile stations along the bore axis, then cross-section widths, then the small
mechanical features. Weapon modules compose these into a real hierarchy with
animatable parts separated out (bolt, charging handle, magazine, trigger).
"""
import math

from weapon_common import (anchor, apply_mirror, arc_profile, bore, box, extrude_profile,
                           group, half_profile, knurl, loft, rect_profile, slot_rail,
                           sweep, tube)

BORE = 0.0  # bore axis height in the weapon-local frame


# --------------------------------------------------------------------------
# profiles
# --------------------------------------------------------------------------
def body_profile(stations):
    """stations: list of (y, z_top, z_bottom). Returns open top/bottom lists."""
    top = [(y, zt) for y, zt, _ in stations]
    bottom = [(y, zb) for y, _, zb in stations]
    return top, bottom


def closed_body(stations):
    """Closed polygon outline for extruded receivers, handguards and stocks."""
    stations = sorted(stations, key=lambda s: s[0])
    top = [(y, zt) for y, zt, _ in stations]
    bottom = [(y, zb) for y, _, zb in reversed(stations)]
    return top + bottom


def symmetric_body(stations, axis=0.0):
    """Top half only; mirrored into a closed outline around ``axis``."""
    return half_profile([(y, z) for y, z, _ in stations], axis)


# --------------------------------------------------------------------------
# components
# --------------------------------------------------------------------------
def receiver(name, material, parent, stations, width, bevel=0.003,
             smooth=False, taper=None):
    """Machined receiver/upper+tower body from a closed silhouette."""
    outline = closed_body(stations)
    obj = extrude_profile(name, outline, width, material, parent, smooth=smooth, bevel=bevel)
    if taper:
        _taper_width(obj, width, taper)
    return obj


def _taper_width(obj, width, factor):
    """Squeeze the far flank so the cross-section is not a plain slab."""
    target = width * factor
    for vertex in obj.data.vertices:
        if vertex.co.x > 0:
            vertex.co.x = target / 2
    obj.data.update()


def cylinder(name, material, parent, y0, y1, radius, z=BORE, segments=20,
             radius_end=None, bevel=0.0, smooth=True):
    return tube(name, [(y0, radius, radius), (y1, radius if radius_end is None else radius_end,
                                             radius if radius_end is None else radius_end)],
                segments, material, parent, smooth=smooth, bevel=bevel)


def stepped_barrel(name, material, parent, stations, segments=20, z=BORE):
    """stations: list of (y, radius) making a real tapered profile."""
    obj = tube(name, [(y, r) for y, r in stations], segments, material, parent, smooth=True)
    obj.location.z = z
    return obj


def suppressor(name, material, parent, y0, y1, radius, z=BORE, segments=22,
               collar=None, rings=0, ring_material=None, end_cap=0.0):
    """Cylindrical can with a mounting collar and optional machined rings."""
    stations = [(y0, radius * 0.94)]
    if collar:
        stations += [(y0 + collar, radius * 0.94), (y0 + collar, radius)]
    stations += [(y1 - (end_cap or 0.0), radius)]
    if end_cap:
        stations += [(y1, radius * 0.86)]
    can = tube(name, stations, segments, material, parent, smooth=True)
    can.location.z = z
    made = [can]
    if rings and ring_material is not None:
        span = y1 - y0 - (collar or 0.0)
        for index in range(rings):
            y = y0 + (collar or 0.0) + span * (index + 0.7) / (rings + 0.4)
            groove = tube("%sGroove%d" % (name, index), [(y - 0.004, radius * 1.01), (y + 0.004, radius * 1.01)],
                          24, ring_material, parent, smooth=True)
            groove.location.z = z
            made.append(groove)
    return can


def muzzle_device(name, material, parent, y0, y1, radius, z=BORE, ports=3,
                  port_material=None, flare=0.0):
    """Slant brake / flash hider with slot ports cut by inset blocks."""
    stations = [(y0, radius * 0.92), (y0 + 0.006, radius)]
    if flare:
        stations += [(y1 - flare, radius), (y1, radius * (1 + flare * 12))]
    else:
        stations += [(y1, radius * 0.98)]
    body = tube(name, stations, 20, material, parent, smooth=True)
    body.location.z = z
    made = [body]
    if ports:
        for index in range(ports):
            y = y0 + (y1 - y0) * (index + 1) / (ports + 1)
            for side in (-1, 1):
                if port_material is None:
                    continue
                slot = extrude_profile("%sPort%d_%d" % (name, index, side),
                                       rect_profile(y - 0.006, y + 0.006, z - 0.003, z + 0.003),
                                       radius * 0.24, port_material, parent, smooth=False)
                slot.location.x = side * radius * 0.92
            # vertical top ports read as the slant brake
            vent = extrude_profile("%sVent%d" % (name, index),
                                   rect_profile(y - 0.005, y + 0.005, z - radius * 1.05, z + radius * 1.05),
                                   radius * 0.22, port_material or material, parent, smooth=False)
            vent.location.x = 0.0
    return body


def curved_magazine(name, material, parent, y_back, y_front, z_top, drop,
                    forward_curve, width, stations=9, floor_material=None,
                    ribs=0, rib_material=None, base_plate=True, rake=0.0):
    """Banana/box magazine swept along a real curve.

    ``forward_curve`` is how far the magazine's body shifts forward over its
    full drop, which is what separates an AK banana mag from a STANAG box.
    """
    depth = abs(y_front - y_back)
    centre_y = (y_back + y_front) / 2
    path = []
    for index in range(stations):
        t = index / float(stations - 1)
        # centreline sweeps forward as it drops, like a real banana mag
        y = centre_y + forward_curve * (0.5 - t * t * 0.5) + rake * t
        z = z_top - drop * t - depth * 0.5
        slope = forward_curve * t / max(drop, 1e-6)
        path.append((y, z, depth, -math.atan(slope)))
    body = sweep(name, path, width / 2, material, parent, bevel=0.0025)
    made = [body]
    if base_plate:
        floor_material = floor_material or material
        last_y, last_z, last_depth, angle = path[-1]
        plate_profile = rect_profile(last_y - last_depth / 2 - 0.004,
                                     last_y + last_depth / 2 + 0.004,
                                     last_z - 0.018, last_z - 0.008, chamfer=0.004)
        floor = extrude_profile(name + "FloorPlate",
                                [(py - last_y, pz - last_z) for py, pz in plate_profile],
                                width * 1.06, floor_material, parent, smooth=False, bevel=0.002)
        floor.rotation_euler = (angle, 0, 0)
        floor.location = (0.0, last_y, last_z)
        made.append(floor)
    for index in range(ribs):
        t = (index + 1) / (ribs + 1)
        y = centre_y + forward_curve * (0.5 - t * t * 0.5) + rake * t
        z = z_top - drop * t - depth * 0.5
        for side in (-1, 1):
            rib = extrude_profile("%sRib%d_%d" % (name, index, side),
                                  rect_profile(y - depth * 0.34, y + depth * 0.34,
                                               z - width * 0.30, z + width * 0.30),
                                  width * 0.07, rib_material or material, parent, smooth=False)
            rib.location.x = side * (width / 2 - width * 0.018)
            made.append(rib)
    return body


def pistol_grip(name, material, parent, y, z_top, drop, rake, width,
                back_offset=0.0, panels=True, panel_material=None, swell=0.012):
    """Grip with a realistic rake angle (top further forward than the heel)."""
    points = [
        (y - 0.016, z_top),
        (y + 0.030, z_top),
        (y + 0.030 + rake * 0.35, z_top - drop * 0.5),
        (y + 0.008 + rake, z_top - drop),
        (y - 0.030 + rake, z_top - drop - 0.006),
        (y - 0.030 - rake * 0.2, z_top - drop * 0.45),
    ]
    grip = extrude_profile(name, points, width, material, parent, smooth=False, bevel=0.004)
    made = [grip]
    if panels:
        for side in (-1, 1):
            panel = extrude_profile("%sPanel%s" % (name, "L" if side < 0 else "R"),
                                    [(px + 0.0, pz - 0.004) for px, pz in
                                     [(y - 0.010, z_top - 0.014), (y + 0.024, z_top - 0.014),
                                      (y + 0.020 + rake * 0.5, z_top - drop * 0.62),
                                      (y - 0.004 + rake * 0.85, z_top - drop * 0.9),
                                      (y - 0.024 + rake * 0.8, z_top - drop * 0.86)]],
                                    0.006, panel_material or material, parent, smooth=False)
            panel.location.x = side * (width / 2 - 0.001)
            if swell:
                panel.scale.x = 1.0
            made.append(panel)
    return grip


def trigger_group(name, material, parent, y, z_top, guard_material=None,
                  blade_material=None, guard=True, width=0.030):
    made = []
    blade = extrude_profile(name + "Blade",
                            rect_profile(y - 0.004, y + 0.004, z_top - 0.036, z_top, chamfer=0.002),
                            width, blade_material or material, parent, smooth=True, bevel=0.002)
    made.append(blade)
    if guard:
        guard_profile = [
            (y - 0.030, z_top + 0.004),
            (y + 0.038, z_top + 0.004),
            (y + 0.042, z_top - 0.024),
            (y + 0.030, z_top - 0.044),
            (y - 0.018, z_top - 0.046),
            (y - 0.034, z_top - 0.028),
            (y - 0.036, z_top - 0.012),
        ]
        hole = [(y - 0.022, z_top - 0.004), (y + 0.030, z_top - 0.004),
                (y + 0.030, z_top - 0.030), (y - 0.020, z_top - 0.032)]
        guard_obj = extrude_profile(name + "Guard", guard_profile, width * 0.55,
                                    guard_material or material, parent, smooth=False, bevel=0.0015)
        made.append(guard_obj)
    return blade


def stock_fixed(name, material, parent, stations, width, butt=None, cheek=None,
                butt_material=None, comb_material=None):
    """Fixed wooden/polymer buttstock built from (y, z_top, z_bottom) stations."""
    outline = closed_body(stations)
    obj = extrude_profile(name, outline, width, material, parent, smooth=False, bevel=0.006)
    made = [obj]
    if butt:
        plate = extrude_profile(name + "ButtPad",
                                rect_profile(butt[0], butt[1], butt[2], butt[3], chamfer=0.006),
                                width * 1.06, butt_material or material, parent, smooth=False, bevel=0.004)
        made.append(plate)
    if cheek:
        pad = extrude_profile(name + "CheekRest",
                              rect_profile(cheek[0], cheek[1], cheek[2], cheek[3], chamfer=0.005),
                              width * 1.12, comb_material or material, parent, smooth=False, bevel=0.004)
        made.append(pad)
    return obj


def stock_tube(name, material, parent, y0, y1, radius, z, butt_material=None,
               butt_length=0.09, butt_height=0.10, cheek=None, tube_material=None):
    """CAR-15 / collapsible buffer tube stock."""
    made = []
    body = tube(name + "Tube", [(y0, radius), (y1, radius * 1.04)], 24,
                tube_material or material, parent, smooth=True)
    body.location.z = z
    made.append(body)
    sleeve = extrude_profile(name + "Sleeve",
                             arc_profile(y0 + 0.035, y1 - 0.006, z - radius * 2.1, z + radius * 2.1,
                                         0.012, steps=3),
                             radius * 2.5, material, parent, smooth=True, bevel=0.004)
    made.append(sleeve)
    butt = extrude_profile(name + "Butt",
                           [(y1 - butt_length, z + butt_height * 0.45),
                            (y1 + 0.004, z + butt_height * 0.4),
                            (y1 + 0.006, z - butt_height * 0.64),
                            (y1 - butt_length * 0.7, z - butt_height * 0.6),
                            (y1 - butt_length, z - butt_height * 0.1)],
                           radius * 2.9, butt_material or material, parent, smooth=False, bevel=0.004)
    made.append(butt)
    if cheek:
        riser = extrude_profile(name + "Cheek",
                                rect_profile(cheek[0], cheek[1], cheek[2], cheek[3], chamfer=0.006),
                                radius * 3.1, butt_material or material, parent, smooth=False, bevel=0.004)
        made.append(riser)
    return body


def handguard(name, material, parent, y0, y1, z_top, z_bottom, width,
              vents=0, vent_material=None, cap=None, cap_material=None,
              slots=0, slot_material=None, top_rail=False, rail_material=None):
    """Vented handguard/forend with optional heat-shield slots."""
    outline = closed_body([(y0, z_top, z_bottom), ((y0 + y1) / 2, z_top + 0.002, z_bottom - 0.002),
                           (y1, z_top - 0.006, z_bottom + 0.006)])
    body = extrude_profile(name, outline, width, material, parent, smooth=False, bevel=0.005)
    made = [body]
    if vents:
        for index in range(vents):
            y = y0 + (y1 - y0) * (index + 0.8) / (vents + 0.6)
            for side in (-1, 1):
                vent = extrude_profile("%sVent%d_%d" % (name, index, side),
                                       rect_profile(y - 0.012, y + 0.012, z_bottom + 0.012, z_top - 0.012),
                                       width * 0.12, vent_material or material, parent, smooth=False)
                vent.location.x = side * (width / 2 - width * 0.03)
        made.append(body)
    if slots:
        for index in range(slots):
            y = y0 + (y1 - y0) * (index + 1) / (slots + 1)
            slot = extrude_profile("%sSlot%d" % (name, index),
                                   rect_profile(y - 0.014, y + 0.014, z_bottom + 0.004, z_top - 0.010),
                                   width * 1.04, slot_material or material, parent, smooth=False)
            made.append(slot)
    if cap:
        cap_obj = extrude_profile(name + "Cap",
                                  rect_profile(cap[0], cap[1], cap[2], cap[3], chamfer=0.004),
                                  width * 1.06, cap_material or material, parent, smooth=False, bevel=0.003)
        made.append(cap_obj)
    if top_rail:
        slot_rail(name + "Rail", y0 + 0.01, y1 - 0.01, z_top, width * 0.8, 0.012,
                  rail_material or material, parent)
    return body


def sight_front(name, material, parent, y, base_z, height, width=0.026,
                post_material=None, hooded=True, wings=True):
    made = []
    base = extrude_profile(name + "Base",
                           rect_profile(y - 0.016, y + 0.016, base_z, base_z + 0.018, chamfer=0.004),
                           width * 1.6, material, parent, smooth=False, bevel=0.003)
    made.append(base)
    tower = extrude_profile(name + "Tower",
                            rect_profile(y - 0.010, y + 0.010, base_z + 0.014, base_z + height),
                            width, material, parent, smooth=False, bevel=0.002)
    made.append(tower)
    if wings:
        for side in (-1, 1):
            wing = extrude_profile("%sWing%s" % (name, "L" if side < 0 else "R"),
                                   rect_profile(y - 0.008, y + 0.008, base_z + 0.016, base_z + height + 0.008),
                                   0.006, material, parent, smooth=False, bevel=0.0015)
            wing.location.x = side * width * 0.75
            made.append(wing)
    post = extrude_profile(name + "Post",
                           rect_profile(y - 0.004, y + 0.004, base_z + 0.02, base_z + height - 0.002),
                           0.005, post_material or material, parent, smooth=False, bevel=0.001)
    made.append(post)
    return base


def sight_rear(name, material, parent, y, base_z, height, width=0.030,
               aperture=True, aperture_material=None, drum=False):
    made = []
    base = extrude_profile(name + "Base",
                           rect_profile(y - 0.020, y + 0.020, base_z, base_z + 0.012, chamfer=0.003),
                           width * 1.8, material, parent, smooth=False, bevel=0.0025)
    made.append(base)
    if drum:
        body = tube(name + "Drum", [(y - 0.014, 0.012), (y + 0.014, 0.012)], 24,
                    material, parent, smooth=True)
        body.location.z = base_z + 0.022
        body.rotation_euler = (0, math.pi / 2, 0)
        made.append(body)
    else:
        body = extrude_profile(name + "Leaf",
                               rect_profile(y - 0.012, y + 0.012, base_z + 0.010, base_z + height),
                               width, material, parent, smooth=False, bevel=0.002)
        made.append(body)
    if aperture:
        hole = [(y - 0.004, base_z + height - 0.018), (y + 0.004, base_z + height - 0.018),
                (y + 0.004, base_z + height - 0.008), (y - 0.004, base_z + height - 0.008)]
        # an inset dark disc reads as the aperture at game distances
        disc = extrude_profile(name + "Aperture", hole, width * 0.55,
                               aperture_material or material, parent, smooth=True, bevel=0.001)
        made.append(disc)
    return base


def scope(name, material, parent, y_objective, y_ocular, z_axis, tube_radius,
          bell_radius=None, ocular_radius=None, tube_material=None,
          glass_material=None, turrets=True, turret_material=None, rings=None,
          ring_material=None, mount_z=None):
    """Telescopic sight with objective bell, ocular flake and turret stack."""
    bell = bell_radius or tube_radius * 1.9
    ocular = ocular_radius or tube_radius * 1.06
    body_material = tube_material or material
    stations = [
        (y_objective, bell * 0.86),
        (y_objective + 0.012, bell),
        (y_objective + 0.052, bell * 0.97),
        (y_objective + 0.062, tube_radius),
        (y_ocular - 0.045, tube_radius),
        (y_ocular - 0.030, ocular * 0.96),
        (y_ocular - 0.008, ocular),
        (y_ocular, ocular * 0.9),
    ]
    tube_obj = tube(name + "Tube", stations, 24, body_material, parent, smooth=True)
    tube_obj.location.z = z_axis
    made = [tube_obj]
    glass_front = tube(name + "ObjectiveGlass",
                       [(y_objective + 0.006, bell * 0.80), (y_objective + 0.010, bell * 0.80)],
                       24, glass_material or material, parent, smooth=True)
    glass_front.location.z = z_axis
    glass_rear = tube(name + "OcularGlass",
                      [(y_ocular - 0.014, ocular * 0.72), (y_ocular - 0.010, ocular * 0.72)],
                      24, glass_material or material, parent, smooth=True)
    glass_rear.location.z = z_axis
    made += [glass_front, glass_rear]
    if turrets:
        material_used = turret_material or body_material
        elevation = tube(name + "ElevationTurret",
                         [(z_axis + tube_radius - 0.004, tube_radius * 0.52),
                          (z_axis + tube_radius + 0.024, tube_radius * 0.50)], 20,
                         material_used, parent, smooth=True)
        elevation.rotation_euler = (math.pi / 2, 0, 0)
        elevation.location.y = (y_objective + y_ocular) / 2 + 0.01
        made.append(elevation)
        windage = tube(name + "WindageTurret",
                       [(tube_radius * 0.4, tube_radius * 0.42), (tube_radius * 0.9, tube_radius * 0.40)],
                       20, material_used, parent, smooth=True)
        windage.rotation_euler = (0, math.pi / 2, 0)
        windage.location.y = (y_objective + y_ocular) / 2 + 0.01
        windage.location.z = z_axis
        made.append(windage)
    if rings:
        mount = mount_z if mount_z is not None else z_axis - tube_radius - 0.032
        for y in rings:
            ring_a = tube(name + "Ring%d" % len(str(y)),
                          [(y - 0.010, tube_radius * 1.16), (y + 0.010, tube_radius * 1.16)],
                          20, ring_material or body_material, parent, smooth=True)
            ring_a.location.z = z_axis
            made.append(ring_a)
            post = extrude_profile(name + "Mount%d" % int(y * 1000),
                                   rect_profile(y - 0.014, y + 0.014, mount, z_axis - tube_radius * 0.6),
                                   0.030, ring_material or body_material, parent, smooth=False, bevel=0.003)
            made.append(post)
    return tube_obj


def bolt_handle(name, material, parent, y, z, length, knob_radius=0.013,
                angle=math.radians(35), ball=True):
    arm = tube(name + "Arm", [(0.0, 0.007), (length, 0.007)], 20, material, parent, smooth=True)
    arm.rotation_euler = (math.radians(78), 0, 0)
    arm.location = (0.0, y, z)
    knob = tube(name + "Knob", [(0.0, knob_radius * 0.7), (0.02, knob_radius)], 24,
                material, parent, smooth=True)
    knob.rotation_euler = (math.radians(78), 0, 0)
    knob.location = (0.0, y - length * 0.18, z - length * 0.9)
    return arm


def charging_handle(name, material, parent, y, z, travel, width=0.05):
    made = []
    latch = extrude_profile(name + "Latch",
                            rect_profile(y, y + 0.028, z - 0.012, z + 0.012, chamfer=0.003),
                            width, material, parent, smooth=False, bevel=0.002)
    made.append(latch)
    paddle = extrude_profile(name + "Paddle",
                             rect_profile(y - 0.006, y + 0.006, z - 0.020, z + 0.010, chamfer=0.003),
                             width * 1.7, material, parent, smooth=False, bevel=0.002)
    made.append(paddle)
    return latch


def screw_row(name, material, parent, y_start, y_end, count, z, radius=0.005,
              side=0.0, axis="x"):
    made = []
    for index in range(count):
        y = y_start + (y_end - y_start) * index / max(1, count - 1)
        pin = tube("%s%d" % (name, index), [(y - radius, radius * 0.9), (y + radius, radius * 0.9)], 20, material, parent, smooth=True)
        pin.rotation_euler = (0, math.pi / 2, 0)
        pin.location = (side, 0, z)
        pin.location.y = y
        made.append(pin)
    return made


def trigger_guard_loop(name, material, parent, y_front, y_back, z_top, z_bottom, width):
    profile = [
        (y_front, z_top),
        (y_back, z_top),
        (y_back, z_bottom),
        (y_front, z_bottom),
    ]
    return extrude_profile(name, profile, width, material, parent, smooth=False, bevel=0.002)


def sling_loop(name, material, parent, y, z, radius=0.012):
    loop = tube(name, [(0.0, radius * 0.75), (0.008, radius * 0.75)], 22, material, parent, smooth=True)
    loop.rotation_euler = (0, math.pi / 2, 0)
    loop.location = (0.0, y, z)
    return loop


def bipod(name, material, parent, y_pivot, y_tip, z_pivot, z_tip, width=0.020,
          leg_material=None, foot=True, coil=True):
    """Folded forward bipod: two angled legs plus a coiled spring section."""
    made = []
    for side in (-1, 1):
        leg = extrude_profile("%sLeg%s" % (name, "L" if side < 0 else "R"),
                              [(y_pivot, z_pivot + 0.008), (y_pivot + 0.02, z_pivot),
                               (y_tip + 0.012, z_tip + 0.006), (y_tip, z_tip - 0.004)],
                              width, leg_material or material, parent, smooth=False, bevel=0.002)
        leg.location.x = side * width * 0.6
        made.append(leg)
    if foot:
        for side in (-1, 1):
            foot_obj = extrude_profile("%sFoot%s" % (name, "L" if side < 0 else "R"),
                                       rect_profile(y_tip - 0.004, y_tip + 0.014, z_tip - 0.010, z_tip),
                                       width * 1.2, leg_material or material, parent, smooth=False, bevel=0.002)
            foot_obj.location.x = side * width * 0.6
            made.append(foot_obj)
    if coil:
        for index in range(6):
            turn = tube("%sCoil%d" % (name, index),
                        [(y_pivot + 0.03 + index * 0.008, width * 0.62), (y_pivot + 0.036 + index * 0.008, width * 0.62)], 22, leg_material or material, parent, smooth=True)
            turn.location.z = z_pivot - width * 0.9
            made.append(turn)
    return made[0]


def hand_stop(name, material, parent, y, z, height=0.03, width=0.020):
    return extrude_profile(name, rect_profile(y - 0.008, y + 0.008, z, z + height),
                           width, material, parent, smooth=False, bevel=0.002)


def magazine_well(name, material, parent, y0, y1, z_top, z_bottom, width):
    return extrude_profile(name, rect_profile(y0, y1, z_bottom, z_top, chamfer=0.004),
                           width, material, parent, smooth=False, bevel=0.003)


def ejection_port(name, material, parent, y0, y1, z0, z1, side, depth=0.004):
    port = extrude_profile(name, rect_profile(y0, y1, z0, z1, chamfer=0.003),
                           depth, material, parent, smooth=False, bevel=0.001)
    port.location.x = side
    return port


def rivets(name, material, parent, positions, radius=0.0045):
    made = []
    for index, (y, z) in enumerate(positions):
        pin = tube("%s%d" % (name, index), [(y - 0.002, radius), (y + 0.002, radius)], 20,
                   material, parent, smooth=True)
        pin.rotation_euler = (0, math.pi / 2, 0)
        pin.location = (0.0, 0.0, z)
        pin.location.y = y
        made.append(pin)
    return made
