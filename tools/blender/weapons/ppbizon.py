"""PP-19 Bizon submachine gun, authored from ``PP19.png``.

Clean-room recreation: the reference is used only for silhouette proportions
and colour zoning. Datum is the bore axis (``z = 0``) with ``y = 0`` at the
receiver front face, so every number below reads directly off the reference.

Reference calibration (vision report + recovered mask, muzzle to the right):
  0.425 m with the skeleton stock folded, a Kalashnikov-pattern stamped
  receiver and furniture, a slim barrel with a small muzzle device, and the
  signature 64-round helical magazine: a real cylinder slung under the barrel
  with a helical rib wound round it.
"""
import math

from weapon_common import (TAU, anchor, box, extrude_profile, group,
                           rect_profile, sweep, tube)
from weapon_parts import (closed_body, ejection_port, muzzle_device, pistol_grip,
                          sight_front, sight_rear, sling_loop, stepped_barrel)

WEAPON_ID = "pp-bizon"
DISPLAY = "PP-19 Bizon"
CATEGORY = "smg"
TRIANGLE_HINT = 42000

# --- master stations (metres, bore datum) ---------------------------------
RECEIVER_REAR = -0.170
RECEIVER_FRONT = 0.014
RECEIVER_TOP = 0.040
RECEIVER_BOTTOM = -0.040
RECEIVER_WIDTH = 0.042
MUZZLE_TIP = 0.245
BUTT_REAR = -0.180
MAG_AXIS_Z = -0.046
MAG_RADIUS = 0.032
MAG_REAR = 0.020
MAG_FRONT = 0.184
HELIX_PITCH = 0.052


def build(palette):
    root = group(WEAPON_ID + "_Root")
    gun = group("Bizon", root)

    stamped = palette["phosphate"]
    metal = palette["anodized"]
    bore_metal = palette["gunmetal"]
    steel = palette["steel"]
    wood = palette["wood_dark"]
    polymer = palette["polymer"]

    # ---- Kalashnikov-pattern stamped receiver -----------------------------
    extrude_profile("Receiver", closed_body([
        (RECEIVER_REAR, 0.028, -0.028),
        (-0.158, 0.038, -0.038),
        (-0.110, RECEIVER_TOP, RECEIVER_BOTTOM),
        (-0.010, RECEIVER_TOP, RECEIVER_BOTTOM),
        (0.016, 0.038, -0.036),
        (0.030, 0.030, -0.028),
    ]), RECEIVER_WIDTH, stamped, gun, bevel=0.0035, bevel_segments=4)
    extrude_profile("DustCover", closed_body([
        (-0.164, 0.036, 0.030),
        (-0.150, 0.046, 0.032),
        (-0.060, 0.048, 0.034),
        (0.006, 0.044, 0.032),
        (0.026, 0.034, 0.026),
    ]), RECEIVER_WIDTH * 0.98, metal, gun, bevel=0.003, bevel_segments=4)
    extrude_profile("RearSightBlock", closed_body([
        (-0.196, 0.048, 0.006),
        (-0.184, 0.056, 0.002),
        (-0.166, 0.056, 0.002),
        (-0.156, 0.042, 0.008),
    ]), RECEIVER_WIDTH * 1.08, stamped, gun, bevel=0.002)
    extrude_profile("FrontTrunnion", closed_body([
        (-0.006, 0.040, -0.040),
        (0.010, 0.042, -0.042),
        (0.028, 0.038, -0.038),
    ]), RECEIVER_WIDTH * 1.05, stamped, gun, bevel=0.002)

    # ---- slim barrel with a small muzzle device --------------------------
    stepped_barrel("Barrel", bore_metal, gun, [
        (0.004, 0.0122), (0.040, 0.0100), (0.090, 0.0090), (0.150, 0.0084),
        (0.200, 0.0080), (0.226, 0.0078),
    ], segments=32)
    muzzle_device("MuzzleDevice", metal, gun, 0.222, MUZZLE_TIP, 0.0100,
                  ports=2, port_material=steel, flare=0.002)
    tube("MuzzleCrown", [(MUZZLE_TIP - 0.004, 0.0068), (MUZZLE_TIP + 0.001, 0.0066)],
         32, steel, gun)
    sight_front("FrontSight", stamped, gun, 0.196, 0.008, 0.042, width=0.024,
                post_material=steel)

    # ---- polymer upper handguard riding over the helical magazine --------
    extrude_profile("UpperHandguard", closed_body([
        (0.018, 0.020, -0.014),
        (0.030, 0.026, -0.018),
        (0.120, 0.026, -0.018),
        (0.138, 0.018, -0.012),
    ]), 0.038, polymer, gun, bevel=0.004, bevel_segments=4)
    for index in range(6):
        y = 0.034 + index * 0.017
        box("HandguardRib%d" % index, (y, 0, 0.023), (0.007, 0.0385, 0.008),
            polymer, gun, bevel=0.0012)
    for side in (-1, 1):
        box("HandguardVent%d" % side, (0.078, side * 0.0185, 0.004),
            (0.086, 0.007, 0.016), bore_metal, gun, bevel=0.0015)

    # ---- AK furniture ----------------------------------------------------
    pistol_grip("PistolGrip", wood, gun, -0.084, -0.036, 0.100, 0.030, 0.036,
                panels=True, panel_material=polymer)
    sweep("TriggerGuard", [
        (0.012, -0.040, 0.015), (0.021, -0.050, 0.014), (0.019, -0.064, 0.013),
        (0.006, -0.073, 0.013), (-0.012, -0.073, 0.013), (-0.026, -0.067, 0.013),
        (-0.035, -0.055, 0.014), (-0.038, -0.042, 0.015),
    ], 0.0115, stamped, gun, bevel=0.002)
    extrude_profile("TriggerBlade", rect_profile(-0.018, -0.008, -0.064, -0.036, chamfer=0.002),
                    0.013, steel, gun, smooth=True, bevel=0.0015)
    extrude_profile("SelectorLever", [
        (0.028, -0.014), (-0.024, -0.010), (-0.070, -0.006), (-0.076, -0.018),
        (-0.028, -0.024), (0.030, -0.026),
    ], 0.008, steel, gun, smooth=False, bevel=0.0015)
    # AK side-mount optic rail on the left receiver wall
    box("SideMountBase", (-0.070, -0.026, 0.006), (0.086, 0.010, 0.030), metal, gun,
        bevel=0.002)
    box("SideMountRail", (-0.070, -0.030, 0.014), (0.080, 0.008, 0.012), steel, gun,
        bevel=0.0015)
    for index in range(6):
        box("SideMountTooth%d" % index, (-0.104 + index * 0.014, -0.030, 0.014),
            (0.005, 0.009, 0.013), steel, gun, bevel=0.001)

    sight_rear("RearSight", stamped, gun, -0.174, 0.056, 0.018, width=0.026,
               aperture_material=steel)

    # ---- moving parts (kept separate for reload / fire animation) ---------
    # The 64-round helical magazine: a real cylinder under the barrel with a
    # helical rib wound round it, plus a second, thinner winding seam.
    magazine = group("Magazine", gun)
    tube("HelicalDrum", [(MAG_REAR, MAG_RADIUS * 0.80), (MAG_REAR + 0.008, MAG_RADIUS),
                         (0.060, MAG_RADIUS), (0.130, MAG_RADIUS),
                         (MAG_FRONT - 0.010, MAG_RADIUS),
                         (MAG_FRONT, MAG_RADIUS * 0.86)],
         48, metal, magazine).location.z = MAG_AXIS_Z
    tube("DrumFrontCap", [(MAG_FRONT - 0.002, MAG_RADIUS * 0.88),
                          (MAG_FRONT + 0.008, MAG_RADIUS * 0.80),
                          (MAG_FRONT + 0.016, MAG_RADIUS * 0.52)],
         48, stamped, magazine).location.z = MAG_AXIS_Z
    tube("DrumRearCap", [(MAG_REAR - 0.006, MAG_RADIUS * 0.74),
                         (MAG_REAR + 0.002, MAG_RADIUS * 0.86)],
         48, stamped, magazine).location.z = MAG_AXIS_Z
    for index in range(3):
        y = 0.044 + index * 0.048
        tube("DrumBand%d" % index, [(y, MAG_RADIUS * 1.012), (y + 0.004, MAG_RADIUS * 1.012)],
             48, steel, magazine).location.z = MAG_AXIS_Z
    _helix("HelicalRib", magazine, steel, MAG_REAR + 0.008, MAG_FRONT - 0.008,
           60, MAG_RADIUS, 0.0090, 0.0210, 0.0060, bevel=0.0016)
    _helix("HelicalSeam", magazine, metal, MAG_REAR + 0.016, MAG_FRONT - 0.014,
           40, MAG_RADIUS * 1.008, 0.0034, 0.0075, 0.0042, bevel=0.0)
    for index in range(8):
        angle = TAU * index / 8
        tooth = box("DrumRatchet%d" % index, (MAG_REAR + 0.014, MAG_RADIUS * 0.94, 0.0),
                    (0.012, 0.010, 0.010), steel, magazine, bevel=0.0012)
        tooth.rotation_euler = (0, -angle, 0)
        tooth.location = (0.0, 0.0, MAG_AXIS_Z)
    box("MagazineLatch", (0.030, 0, MAG_AXIS_Z), (0.026, 0.036, 0.022), stamped, magazine,
        bevel=0.002)
    # feed interface: the drum has to visibly grow out of the receiver, not
    # hang under it, so a tower and a front collar tie it to the trunnion and
    # to the barrel respectively
    box("FeedTower", (0.030, 0, -0.024), (0.062, 0.048, 0.044), stamped, magazine,
        bevel=0.003)
    box("FeedTowerMount", (0.036, 0, -0.004), (0.048, 0.040, 0.030), metal, magazine,
        bevel=0.002)
    tube("DrumFeedCollar", [(0.006, MAG_RADIUS * 1.01), (0.026, MAG_RADIUS * 1.01)], 40,
         steel, magazine).location.z = MAG_AXIS_Z
    box("DrumFrontBracket", (MAG_FRONT - 0.006, 0, -0.018), (0.028, 0.032, 0.034),
        metal, magazine, bevel=0.002)
    tube("DrumBarrelCollar", [(MAG_FRONT - 0.012, 0.0126), (MAG_FRONT + 0.004, 0.0126)],
         32, steel, magazine)

    bolt = group("Bolt", gun)
    box("BoltCarrierBody", (-0.040, 0, 0.018), (0.130, 0.026, 0.024), steel, bolt,
        bevel=0.002)
    for index in range(5):
        box("BoltLug%d" % index, (0.010 - index * 0.016, 0, 0.030),
            (0.007, 0.028, 0.008), steel, bolt, bevel=0.0009)
    box("ChargingHandleRail", (-0.062, 0.024, 0.004), (0.100, 0.010, 0.016), metal, bolt,
        bevel=0.002)
    knob = tube("ChargingHandleKnob", [(-0.030, 0.0095), (-0.008, 0.0095)], 24, steel, bolt)
    knob.rotation_euler = (0, 0, math.pi / 2)
    knob.location = (0.034, -0.030, 0.004)
    for index in range(5):
        ring = tube("ChargingHandleRing%d" % index, [(-0.0035, 0.0108), (0.0035, 0.0108)],
                    24, steel, bolt)
        ring.rotation_euler = (0, 0, math.pi / 2)
        ring.location = (0.030 + index * 0.0028, -0.032, 0.004)

    trigger = group("Trigger", gun)
    trigger_body = box("TriggerAssembly", (-0.010, 0, -0.044), (0.030, 0.026, 0.020),
                       steel, trigger, bevel=0.002)
    for index in range(3):
        pin = tube("TriggerPin%d" % index, [(-0.008, 0.0030), (0.008, 0.0030)], 18,
                   steel, trigger)
        pin.rotation_euler = (0, 0, math.pi / 2)
        pin.location = (0.014, 0.004 - index * 0.016, -0.044)

    # ---- AK side-folding skeleton stock, stowed along the receiver --------
    stock = group("Stock", gun)
    box("StockHinge", (RECEIVER_REAR + 0.010, 0.016, 0.020), (0.026, 0.034, 0.040),
        metal, stock, bevel=0.003)
    pivot = tube("StockPivot", [(-0.018, 0.0046), (0.018, 0.0046)], 18, steel, stock)
    pivot.rotation_euler = (math.pi / 2, 0, 0)
    pivot.location = (RECEIVER_REAR + 0.010, 0.032, 0.020)
    for index, z in enumerate((0.044, 0.026)):
        box("StockStrut%d" % index, (-0.070, 0.032, z), (0.150, 0.010, 0.011), metal,
            stock, bevel=0.0018)
    extrude_profile("StockButt", [
        (0.014, 0.052), (0.034, 0.048), (0.040, 0.036), (0.040, 0.006),
        (0.030, -0.004), (0.014, 0.000),
    ], 0.014, stamped, stock, smooth=False, bevel=0.003, x_offset=0.032)
    box("StockButtPad", (0.026, 0.032, 0.026), (0.010, 0.042, 0.052), polymer,
        stock, bevel=0.003)
    box("StockLatch", (-0.140, 0.032, 0.036), (0.016, 0.014, 0.040), steel, stock,
        bevel=0.002)

    # ---- shell deflector, rivets and sling furniture ----------------------
    ejection_port("EjectionPort", metal, gun, -0.030, 0.000, 0.004, 0.024, 0.0212,
                  depth=0.006)
    box("ShellDeflector", (-0.034, 0.024, -0.002), (0.024, 0.012, 0.020), stamped, gun,
        bevel=0.002)
    for index in range(9):
        y = -0.156 + index * 0.021
        for side in (-1, 1):
            rivet = tube("ReceiverRivet%d_%d" % (index, side), [(-0.0035, 0.0032),
                                                               (0.0035, 0.0032)], 18,
                         steel, gun)
            rivet.rotation_euler = (0, 0, math.pi / 2)
            rivet.location = (side * 0.0212, y, -0.030)
    sling_loop("SlingLoopRear", metal, gun, RECEIVER_REAR + 0.006, -0.006, 0.011)
    sling_loop("SlingLoopFront", metal, gun, 0.026, -0.030, 0.010)

    anchor("ViewmodelAnchor", (0.0, 0.020, -0.012), root)
    anchor("Muzzle", (0.0, MUZZLE_TIP + 0.004, 0.0), root)
    anchor("LeftHandIK", (0.0, 0.096, -0.052), root)
    anchor("RightHandIK", (0.0, -0.070, -0.044), root)
    anchor("MagazineAnchor", (0.0, 0.100, MAG_AXIS_Z), magazine)
    return root


def _helix(name, parent, material, y0, y1, count, radius, thickness, width, length,
           bevel=0.0014):
    """Wind a real helical rib round the magazine's Y axis.

    Each segment is placed on the drum surface and spun about the bore axis, so
    the rib climbs the cylinder instead of reading as a stack of rings.
    """
    made = []
    span = y1 - y0
    for index in range(count):
        t = index / float(count - 1)
        y = y0 + span * t
        angle = TAU * (y - y0) / HELIX_PITCH
        segment = box("%s%d" % (name, index), (y, radius, 0.0),
                      (length, thickness, width), material, parent, bevel=bevel)
        segment.rotation_euler = (0, -angle, 0)
        segment.location = (0.0, 0.0, MAG_AXIS_Z)
        made.append(segment)
    return made
