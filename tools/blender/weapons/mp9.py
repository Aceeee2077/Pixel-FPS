"""Steyr TMP / B&T MP9 machine pistol, authored from ``MP9.png``.

Clean-room recreation: the reference is used only for silhouette proportions
and colour zoning. Datum is the bore axis (``z = 0``) with ``y = 0`` at the
receiver front face, so every number below reads directly off the reference.

Reference calibration (vision report + recovered mask, muzzle to the right):
  0.303 m muzzle to butt with the stock folded and 0.231 m from the top of the
  rear sight to the magazine floor, i.e. length/height 1.31 -- the shortest and
  by far the tall-to-long of the six. 30-round magazine carried *inside* the
  pistol grip, rotating barrel inside a short slotted shroud, top-mounted
  cocking handle, integral top rail and a skeleton stock folded forward along
  the right shoulder.
"""
import math

from weapon_common import (anchor, arc_profile, box, extrude_profile, group,
                           loft, rect_profile, slot_rail, sweep, tube)
from weapon_parts import (closed_body, curved_magazine, ejection_port,
                          muzzle_device, pistol_grip, sight_front, sight_rear,
                          sling_loop, stepped_barrel)

WEAPON_ID = "mp9"
DISPLAY = "MP9"
CATEGORY = "smg"
TRIANGLE_HINT = 40000

# --- master stations (metres, bore datum) ---------------------------------
BODY_REAR = -0.128
BODY_FRONT = 0.052
NOSE_FRONT = 0.112
MUZZLE_TIP = 0.175
BODY_TOP = 0.036
BODY_BOTTOM = -0.028
RAIL_TOP = 0.046
GRIP_TOP = -0.026
GRIP_DROP = 0.108
MAG_CENTRE = -0.039
MAG_DROP = 0.100


def build(palette):
    root = group(WEAPON_ID + "_Root")
    gun = group("MP9", root)

    shell = palette["polymer"]
    metal = palette["anodized"]
    bore_metal = palette["gunmetal"]
    steel = palette["steel"]
    rubber = palette["rubber"]
    mag_metal = palette["phosphate"]

    # ---- polymer upper: one moulding wrapping the bore --------------------
    # Lofted rather than extruded: the MP9 shell rounds off at every corner and
    # necks down towards the nose, which is what keeps it off "brick" reads.
    loft("UpperShell", [(y, arc_profile(-hw, hw, zb, zt, 0.0042, steps=3))
                        for y, hw, zt, zb in [
                            (BODY_REAR, 0.0140, 0.010, -0.012),
                            (-0.122, 0.0190, 0.024, -0.018),
                            (-0.112, 0.0214, 0.031, -0.024),
                            (-0.088, 0.0228, 0.034, -0.027),
                            (-0.048, 0.0230, BODY_TOP, BODY_BOTTOM),
                            (-0.004, 0.0230, BODY_TOP, BODY_BOTTOM),
                            (0.028, 0.0226, 0.034, -0.026),
                            (0.046, 0.0216, 0.032, -0.024),
                            (0.062, 0.0202, 0.028, -0.021),
                            (0.080, 0.0190, 0.026, -0.023),
                            (0.098, 0.0176, 0.023, -0.019),
                            (NOSE_FRONT, 0.0138, 0.014, -0.012),
                        ]], shell, gun, smooth=False)

    # lower housing that carries the fire control and the magwell mouth
    extrude_profile("LowerHousing", closed_body([
        (-0.104, -0.012, -0.030),
        (-0.088, -0.017, -0.039),
        (-0.030, -0.017, -0.041),
        (0.008, -0.015, -0.039),
        (0.040, -0.009, -0.030),
    ]), 0.038, shell, gun, bevel=0.003, bevel_segments=4)
    extrude_profile("MagwellFlare", closed_body([
        (-0.062, -0.026, -0.044),
        (-0.056, -0.030, -0.050),
        (-0.016, -0.030, -0.050),
        (-0.010, -0.026, -0.044),
    ]), 0.046, metal, gun, bevel=0.0025)

    # ---- rotating barrel inside its shroud --------------------------------
    # A single corrugated revolve: the machined cooling rings are part of the
    # shroud surface instead of separately floating discs laid over it.
    stepped_barrel("BarrelShroud", metal, gun, [
        (0.056, 0.0180), (0.066, 0.0194), (0.070, 0.0202), (0.074, 0.0190),
        (0.078, 0.0202), (0.082, 0.0190), (0.086, 0.0202), (0.090, 0.0190),
        (0.094, 0.0202), (0.098, 0.0192), (0.106, 0.0152),
    ], segments=56)
    stepped_barrel("Barrel", bore_metal, gun, [
        (0.024, 0.0132), (0.052, 0.0122), (0.062, 0.0108), (0.098, 0.0098),
        (0.128, 0.0090), (0.152, 0.0086),
    ], segments=22)
    tube("BarrelNut", [(0.100, 0.0134), (0.108, 0.0134)], 22, steel, gun).location.z = 0.0
    for side in (-1, 1):
        box("ShroudPort%d" % side, (0.088, side * 0.0178, 0.0), (0.026, 0.007, 0.013),
            bore_metal, gun, bevel=0.001)
    muzzle_device("MuzzleDevice", metal, gun, 0.148, MUZZLE_TIP, 0.0102,
                  ports=2, port_material=steel, flare=0.002)
    tube("MuzzleCrown", [(MUZZLE_TIP - 0.004, 0.0074), (MUZZLE_TIP + 0.001, 0.0072)],
         36, steel, gun)
    # flutes machined along the exposed barrel section past the shroud
    for index in range(4):
        angle = math.pi * 2 * index / 4 + math.pi / 4
        flute = tube("BarrelFlute%d" % index, [(0.110, 0.0026), (0.144, 0.0026)], 18,
                     steel, gun)
        flute.location = (math.cos(angle) * 0.0072, 0.0, math.sin(angle) * 0.0072)

    # ---- integral top rail with real recoil slots -------------------------
    slot_rail("TopRail", -0.076, 0.048, BODY_TOP, 0.019, 0.010, metal, gun,
              pitch=0.0115, slot=0.0058, depth=0.0055)
    box("RailRoot", (-0.014, 0, BODY_TOP + 0.003), (0.128, 0.026, 0.008), shell, gun,
        bevel=0.002)

    # ---- flip-up sights at both ends of the rail --------------------------
    sight_rear("RearSight", metal, gun, -0.062, RAIL_TOP, 0.014, width=0.024,
               aperture_material=steel)
    for side in (-1, 1):
        box("RearSightGuard%d" % side, (-0.062, side * 0.016, 0.061),
            (0.018, 0.005, 0.018), metal, gun, bevel=0.0015)
    sight_front("FrontSight", metal, gun, 0.038, RAIL_TOP, 0.014, width=0.019,
                post_material=steel)

    # ---- cocking handle track (the handle itself lives in the Bolt group) --
    box("CockingTrack", (-0.100, 0, BODY_TOP + 0.009), (0.054, 0.013, 0.018),
        metal, gun, bevel=0.002)
    for index in range(12):
        box("CockingTrackTooth%d" % index, (-0.122 + index * 0.0078, 0, BODY_TOP + 0.018),
            (0.0032, 0.013, 0.005), steel, gun, bevel=0.0008)

    # ---- bottom accessory rail and stowed foregrip ------------------------
    slot_rail("LowerRail", 0.048, 0.108, -0.032, 0.016, 0.008, metal, gun,
              pitch=0.0110, slot=0.0052, depth=0.005)
    box("ForegripHinge", (0.052, 0, -0.040), (0.022, 0.026, 0.020), metal, gun,
        bevel=0.002)
    sweep("ForegripBody", [
        (0.046, -0.058, 0.020), (0.028, -0.060, 0.019), (0.010, -0.060, 0.018),
        (-0.008, -0.058, 0.017), (-0.020, -0.054, 0.016),
    ], 0.0158, shell, gun, bevel=0.003)
    for index in range(3):
        box("ForegripRib%d" % index, (0.034 - index * 0.015, 0, -0.060),
            (0.0048, 0.0332, 0.0210), rubber, gun, bevel=0.001)
    box("ForegripLatch", (-0.024, 0, -0.048), (0.014, 0.020, 0.022), steel, gun,
        bevel=0.002)

    # ---- pistol grip with moulded and rubberised texture ------------------
    pistol_grip("PistolGrip", shell, gun, -0.040, GRIP_TOP, GRIP_DROP, 0.014,
                0.042, panels=True, panel_material=rubber)
    for index in range(10):
        z = GRIP_TOP - 0.012 - index * 0.0115
        box("GripBand%d" % index, (-0.036 + index * 0.0009, 0, z),
            (0.050, 0.0405, 0.0050), rubber, gun, bevel=0.0012)
    sweep("GripFrontStrap", [
        (-0.008, -0.030, 0.013), (-0.002, -0.052, 0.012), (0.002, -0.075, 0.012),
        (-0.004, -0.100, 0.012), (-0.012, -0.128, 0.013),
    ], 0.0064, rubber, gun, bevel=0.002)
    for side in (-1, 1):
        box("GripCheekPanel%d" % side, (-0.036, side * 0.0205, GRIP_TOP - 0.058),
            (0.044, 0.006, 0.058), rubber, gun, bevel=0.002)
    box("GripCap", (-0.032, 0, GRIP_TOP - GRIP_DROP + 0.006), (0.032, 0.046, 0.014),
        shell, gun, bevel=0.002)

    # ---- moving parts (kept separate for reload / fire animation) ---------
    magazine = group("Magazine", gun)
    curved_magazine("MagazineBody", mag_metal, magazine, MAG_CENTRE - 0.014,
                    MAG_CENTRE + 0.014, -0.028, MAG_DROP, 0.0, 0.026, stations=12,
                    ribs=3, floor_material=metal)
    for index in range(11):
        z = -0.040 - index * 0.0108
        for side in (-1, 1):
            box("MagazineWitness%d_%d" % (index, side), (MAG_CENTRE, side * 0.0125, z),
                (0.020, 0.0035, 0.0072), steel, magazine, bevel=0.001)
    for index in range(3):
        box("MagazineFloorRib%d" % index, (MAG_CENTRE, 0, -0.124 - index * 0.008),
            (0.028, 0.028, 0.0045), metal, magazine, bevel=0.001)
    box("MagazineRelease", (-0.060, 0.020, -0.036), (0.016, 0.010, 0.014), steel, gun,
        bevel=0.0015)

    bolt = group("Bolt", gun)
    box("BoltBody", (0.014, 0, 0.012), (0.058, 0.030, 0.026), steel, bolt, bevel=0.002)
    for index in range(3):
        box("BoltLug%d" % index, (0.038 - index * 0.012, 0, 0.024),
            (0.006, 0.032, 0.008), steel, bolt, bevel=0.0009)
    box("CockingHandleBar", (-0.086, 0, BODY_TOP + 0.018), (0.036, 0.018, 0.016),
        steel, bolt, bevel=0.002)
    box("CockingHandleKnob", (-0.078, 0, BODY_TOP + 0.032), (0.030, 0.024, 0.014),
        steel, bolt, bevel=0.0025)
    for index in range(3):
        box("CockingHandleGrip%d" % index, (-0.088 + index * 0.010, 0, BODY_TOP + 0.032),
            (0.0045, 0.0250, 0.0155), steel, bolt, bevel=0.001)

    trigger = group("Trigger", gun)
    extrude_profile("TriggerBlade", rect_profile(-0.016, -0.005, -0.062, GRIP_TOP + 0.002,
                                                 chamfer=0.003),
                    0.014, steel, trigger, smooth=True, bevel=0.0015)
    sweep("TriggerGuard", [
        (0.022, -0.034, 0.011), (0.031, -0.044, 0.010), (0.033, -0.056, 0.009),
        (0.024, -0.066, 0.008), (0.006, -0.070, 0.008), (-0.008, -0.067, 0.008),
        (-0.017, -0.057, 0.008), (-0.021, -0.046, 0.009), (-0.019, -0.036, 0.010),
    ], 0.0072, shell, trigger, bevel=0.0015)
    for index, y in enumerate((0.004, -0.012)):
        pin = tube("TriggerPin%d" % index, [(-0.007, 0.0032), (0.007, 0.0032)], 18,
                   steel, trigger)
        pin.rotation_euler = (0, 0, math.pi / 2)
        pin.location = (0.023, y, -0.031)

    # ---- skeleton stock, folded forward along the right shoulder ----------
    stock = group("Stock", gun)
    box("StockHinge", (BODY_REAR + 0.012, 0, 0.020), (0.026, 0.038, 0.032), metal, stock,
        bevel=0.003)
    pivot = tube("StockPivotPin", [(-0.016, 0.0044), (0.016, 0.0044)], 18, steel, stock)
    pivot.rotation_euler = (0, 0, math.pi / 2)
    pivot.location = (0.027, BODY_REAR + 0.012, 0.020)
    for index, z in enumerate((0.019, 0.041)):
        box("StockArm%d" % index, (-0.070, 0.031, z), (0.104, 0.010, 0.009), metal, stock,
            bevel=0.0018)
    box("StockSpacer", (-0.114, 0.026, 0.030), (0.022, 0.016, 0.028), metal, stock,
        bevel=0.002)
    extrude_profile("StockButtPlate", [
        (-0.028, 0.042), (-0.004, 0.040), (0.002, 0.030), (0.002, 0.014),
        (-0.006, 0.006), (-0.028, 0.005),
    ], 0.013, rubber, stock, smooth=False, bevel=0.003)
    box("StockButtPlateSpine", (-0.016, 0.031, 0.024), (0.026, 0.016, 0.006), metal,
        stock, bevel=0.0015)
    box("StockLatch", (-0.116, 0.031, 0.031), (0.016, 0.014, 0.026), steel, stock,
        bevel=0.002)

    # ---- secondary controls and side furniture ---------------------------
    for side in (-1, 1):
        box("SelectorLever%d" % side, (-0.058, side * 0.026, -0.008), (0.024, 0.009, 0.009),
            steel, gun, bevel=0.0015)
        dial = tube("SelectorHub%d" % side, [(0.0, 0.0078), (0.006, 0.0078)], 22,
                    steel, gun)
        dial.rotation_euler = (0, 0, math.pi / 2)
        dial.location = (side * 0.024, -0.058, -0.008)
        box("TriggerPinBoss%d" % side, (0.004, side * 0.022, -0.031), (0.022, 0.004, 0.013),
            metal, gun, bevel=0.0012)
        box("SlingSocket%d" % side, (BODY_REAR + 0.030, side * 0.025, -0.020),
            (0.014, 0.006, 0.014), steel, gun, bevel=0.0015)

    ejection_port("EjectionPort", metal, gun, -0.002, 0.030, -0.002, 0.020,
                  0.0232, depth=0.006)
    ejection_port("ChamberWindow", metal, gun, 0.032, 0.054, -0.004, 0.014,
                  0.0212, depth=0.005)
    bolt_release = tube("BoltRelease", [(0.0, 0.0048), (0.014, 0.0048)], 20, steel, gun)
    bolt_release.rotation_euler = (0, 0, math.pi / 2)
    bolt_release.location = (0.0215, -0.030, -0.024)
    for index in range(8):
        y = -0.116 + index * 0.019
        for side in (-1, 1):
            pin = tube("ReceiverPin%d_%d" % (index, side), [(-0.0028, 0.0028),
                                                            (0.0028, 0.0028)], 18,
                       metal, gun)
            pin.rotation_euler = (0, 0, math.pi / 2)
            pin.location = (side * 0.0238, y, -0.016)

    sling_loop("SlingLoopRear", metal, gun, BODY_REAR + 0.004, -0.026, 0.010)
    sling_loop("SlingLoopFront", metal, gun, 0.062, -0.028, 0.009)

    anchor("ViewmodelAnchor", (0.0, 0.040, -0.012), root)
    anchor("Muzzle", (0.0, MUZZLE_TIP + 0.004, 0.0), root)
    anchor("LeftHandIK", (0.0, 0.086, -0.036), root)
    anchor("RightHandIK", (0.0, -0.030, -0.034), root)
    anchor("MagazineAnchor", (0.0, MAG_CENTRE, -0.044), magazine)
    return root
