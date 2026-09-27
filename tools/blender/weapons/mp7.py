"""HK MP7 personal defence weapon, authored from ``MP7.png``.

Clean-room recreation: the reference is used only for silhouette proportions
and colour zoning. Datum is the bore axis (``z = 0``) with ``y = 0`` at the
receiver front face, so every number below reads directly off the reference.

Reference calibration (vision report + recovered mask, muzzle to the right):
  0.415 m with the stock extended, a slim rectangular polymer shell barely
  taller than the magazine that hangs out of it, a pronounced full-length top
  rail, a deployed folding foregrip under the nose, a telescoping stock and a
  30-round magazine carried *inside* the pistol grip.
"""
import math

from weapon_common import (anchor, arc_profile, box, extrude_profile, group,
                           loft, rect_profile, slot_rail, sweep, tube)
from weapon_parts import (closed_body, curved_magazine, ejection_port,
                          muzzle_device, pistol_grip, sight_front, sight_rear,
                          sling_loop, stepped_barrel)

WEAPON_ID = "mp7"
DISPLAY = "MP7"
CATEGORY = "smg"
TRIANGLE_HINT = 42000

# --- master stations (metres, bore datum) ---------------------------------
BODY_REAR = -0.112
BODY_FRONT = 0.128
NOSE_FRONT = 0.186
MUZZLE_TIP = 0.235
BODY_TOP = 0.040
BODY_BOTTOM = -0.026
RAIL_TOP = 0.052
GRIP_TOP = -0.024
GRIP_DROP = 0.100
MAG_CENTRE = -0.046
MAG_DROP = 0.108
STOCK_REAR = -0.180


def build(palette):
    root = group(WEAPON_ID + "_Root")
    gun = group("MP7", root)

    shell = palette["polymer"]
    metal = palette["anodized"]
    bore_metal = palette["gunmetal"]
    steel = palette["steel"]
    grey = palette["polymer_grey"]
    rubber = palette["rubber"]

    # ---- slim rectangular polymer shell ----------------------------------
    loft("UpperShell", [(y, arc_profile(-hw, hw, zb, zt, 0.0050, steps=4))
                        for y, hw, zt, zb in [
                            (BODY_REAR, 0.0170, 0.018, -0.012),
                            (-0.102, 0.0235, 0.031, -0.019),
                            (-0.078, 0.0268, 0.037, -0.023),
                            (-0.020, 0.0282, BODY_TOP, -0.026),
                            (0.038, 0.0282, BODY_TOP, -0.026),
                            (0.078, 0.0272, 0.038, -0.024),
                            (0.106, 0.0250, 0.034, -0.021),
                            (BODY_FRONT, 0.0212, 0.026, -0.015),
                        ]], shell, gun, smooth=False)
    # slim nose shroud that the barrel runs out of
    loft("NoseShroud", [(y, arc_profile(-hw, hw, zb, zt, 0.0042, steps=4))
                        for y, hw, zt, zb in [
                            (BODY_FRONT - 0.004, 0.0212, 0.026, -0.015),
                            (0.148, 0.0194, 0.025, -0.013),
                            (0.168, 0.0168, 0.021, -0.010),
                            (NOSE_FRONT, 0.0132, 0.016, -0.007),
                        ]], shell, gun, smooth=False)

    # lower housing: fire control, magwell mouth and the trigger housing
    extrude_profile("LowerHousing", closed_body([
        (-0.086, -0.010, -0.026),
        (-0.070, -0.015, -0.034),
        (-0.020, -0.015, -0.036),
        (0.010, -0.013, -0.034),
        (0.030, -0.008, -0.026),
    ]), 0.044, shell, gun, bevel=0.003, bevel_segments=4)
    extrude_profile("MagwellFlare", closed_body([
        (-0.070, -0.024, -0.040),
        (-0.064, -0.028, -0.046),
        (-0.026, -0.028, -0.046),
        (-0.020, -0.024, -0.040),
    ]), 0.050, metal, gun, bevel=0.0025)

    # ---- barrel and small muzzle device ----------------------------------
    stepped_barrel("Barrel", bore_metal, gun, [
        (0.090, 0.0118), (0.132, 0.0100), (0.170, 0.0090), (0.205, 0.0084),
    ], segments=32)
    tube("BarrelNut", [(0.170, 0.0112), (0.178, 0.0112)], 32, steel, gun).location.z = 0.0
    muzzle_device("MuzzleDevice", metal, gun, 0.208, MUZZLE_TIP, 0.0098,
                  ports=2, port_material=steel, flare=0.002)
    tube("MuzzleCrown", [(MUZZLE_TIP - 0.004, 0.0068), (MUZZLE_TIP + 0.001, 0.0066)],
         32, steel, gun)

    # ---- pronounced full-length top rail ---------------------------------
    slot_rail("TopRail", -0.074, 0.118, BODY_TOP, 0.021, 0.012, metal, gun,
              pitch=0.0100, slot=0.0050, depth=0.0065)
    box("RailRoot", (-0.020, 0, BODY_TOP + 0.004), (0.150, 0.030, 0.009), shell, gun,
        bevel=0.002)
    slot_rail("LowerRail", 0.052, 0.118, -0.032, 0.017, 0.009, metal, gun,
              pitch=0.0105, slot=0.0052, depth=0.0055)

    # ---- flip-up sights at the ends of the rail ---------------------------
    sight_rear("RearSight", metal, gun, -0.062, RAIL_TOP, 0.013, width=0.023,
               aperture_material=steel)
    for side in (-1, 1):
        box("RearSightGuard%d" % side, (-0.062, side * 0.0155, 0.060),
            (0.017, 0.005, 0.016), metal, gun, bevel=0.0015)
    sight_front("FrontSight", metal, gun, 0.100, RAIL_TOP, 0.013, width=0.019,
                post_material=steel)

    # ---- left-side cocking handle track (handle is in the Bolt group) -----
    box("CockingTrack", (-0.086, -0.026, 0.024), (0.048, 0.012, 0.018), metal, gun,
        bevel=0.002)
    for index in range(9):
        box("CockingTrackTooth%d" % index, (-0.106 + index * 0.0054, -0.026, 0.033),
            (0.0028, 0.012, 0.005), steel, gun, bevel=0.0008)

    # ---- deployed folding foregrip ---------------------------------------
    box("ForegripHinge", (0.062, 0, -0.040), (0.024, 0.028, 0.018), metal, gun,
        bevel=0.002)
    sweep("ForegripBody", [
        (0.058, -0.050, 0.026), (0.052, -0.064, 0.025), (0.046, -0.076, 0.024),
        (0.045, -0.088, 0.023), (0.049, -0.098, 0.022),
    ], 0.0165, grey, gun, bevel=0.003)
    for index in range(4):
        box("ForegripRib%d" % index, (0.052 - index * 0.0018, 0, -0.070 - index * 0.0095),
            (0.030, 0.0336, 0.0055), rubber, gun, bevel=0.0011)
    box("ForegripLatch", (0.070, 0, -0.044), (0.012, 0.022, 0.020), steel, gun,
        bevel=0.002)

    # ---- pistol grip and moulded texture ---------------------------------
    pistol_grip("PistolGrip", shell, gun, -0.046, GRIP_TOP, GRIP_DROP, 0.012,
                0.044, panels=True, panel_material=rubber)
    for index in range(9):
        z = GRIP_TOP - 0.011 - index * 0.0105
        box("GripBand%d" % index, (-0.043 + index * 0.0006, 0, z),
            (0.050, 0.0425, 0.0048), rubber, gun, bevel=0.0012)
    for side in (-1, 1):
        box("GripCheekPanel%d" % side, (-0.042, side * 0.0215, GRIP_TOP - 0.055),
            (0.044, 0.006, 0.056), grey, gun, bevel=0.002)
    box("GripCap", (-0.038, 0, GRIP_TOP - GRIP_DROP + 0.006), (0.032, 0.048, 0.014),
        shell, gun, bevel=0.002)

    # ---- moving parts (kept separate for reload / fire animation) ---------
    magazine = group("Magazine", gun)
    curved_magazine("MagazineBody", metal, magazine, MAG_CENTRE - 0.015,
                    MAG_CENTRE + 0.015, -0.022, MAG_DROP, 0.0, 0.024, stations=12,
                    ribs=3, floor_material=steel)
    for index in range(12):
        z = -0.036 - index * 0.0098
        for side in (-1, 1):
            box("MagazineWitness%d_%d" % (index, side), (MAG_CENTRE, side * 0.0115, z),
                (0.020, 0.0035, 0.0068), steel, magazine, bevel=0.001)
    for index in range(4):
        box("MagazineFloorRib%d" % index, (MAG_CENTRE, 0, -0.152 - index * 0.008),
            (0.026, 0.026, 0.0048), steel, magazine, bevel=0.001)
    box("MagazineRelease", (-0.068, -0.024, -0.026), (0.018, 0.010, 0.014), steel, gun,
        bevel=0.0015)

    bolt = group("Bolt", gun)
    box("BoltBody", (0.020, 0, 0.010), (0.070, 0.030, 0.026), steel, bolt, bevel=0.002)
    for index in range(3):
        box("BoltLug%d" % index, (0.046 - index * 0.013, 0, 0.022),
            (0.006, 0.032, 0.008), steel, bolt, bevel=0.0009)
    box("CockingHandleBar", (-0.086, -0.028, 0.024), (0.032, 0.014, 0.016), steel, bolt,
        bevel=0.002)
    box("CockingHandleKnob", (-0.094, -0.030, 0.024), (0.026, 0.020, 0.026), steel, bolt,
        bevel=0.0025)
    for index in range(4):
        box("CockingHandleGrip%d" % index, (-0.104 + index * 0.008, -0.030, 0.024),
            (0.0045, 0.0225, 0.0275), steel, bolt, bevel=0.001)

    trigger = group("Trigger", gun)
    extrude_profile("TriggerBlade", rect_profile(-0.022, -0.011, -0.064, GRIP_TOP + 0.002,
                                                 chamfer=0.003),
                    0.014, steel, trigger, smooth=True, bevel=0.0015)
    sweep("TriggerGuard", [
        (0.020, -0.030, 0.011), (0.028, -0.040, 0.010), (0.030, -0.052, 0.009),
        (0.021, -0.062, 0.008), (0.004, -0.066, 0.008), (-0.010, -0.063, 0.008),
        (-0.020, -0.054, 0.008), (-0.024, -0.043, 0.009), (-0.022, -0.033, 0.010),
    ], 0.0088, shell, trigger, bevel=0.0015)

    # ---- telescoping stock, drawn extended to the full 0.415 m ------------
    stock = group("Stock", gun)
    box("StockHousing", (BODY_REAR + 0.006, 0, 0.014), (0.026, 0.038, 0.030), metal,
        stock, bevel=0.003)
    for side in (-1, 1):
        box("StockRail%d" % side, (-0.146, side * 0.0195, 0.016), (0.078, 0.009, 0.012),
            metal, stock, bevel=0.0018)
        box("StockRailInner%d" % side, (-0.078, side * 0.0175, 0.016), (0.070, 0.007, 0.010),
            steel, stock, bevel=0.0015)
        box("StockGuide%d" % side, (-0.116, side * 0.020, 0.016), (0.020, 0.014, 0.020),
            steel, stock, bevel=0.002)
    extrude_profile("StockButt", [
        (-0.166, 0.030), (-0.146, 0.032), (-0.136, 0.024), (-0.136, -0.012),
        (-0.150, -0.020), (-0.170, -0.018), (-0.178, -0.006), (-0.178, 0.020),
    ], 0.046, metal, stock, smooth=False, bevel=0.004)
    extrude_profile("StockButtPad", [
        (-0.176, 0.026), (-0.166, 0.028), (-0.162, 0.020), (-0.162, -0.010),
        (-0.170, -0.014), (-0.180, -0.008),
    ], 0.042, rubber, stock, smooth=False, bevel=0.003)
    box("StockCheek", (-0.150, 0, 0.034), (0.048, 0.036, 0.012), metal, stock, bevel=0.002)
    box("StockLatch", (-0.104, 0, 0.032), (0.018, 0.024, 0.014), steel, stock, bevel=0.002)
    for index in range(4):
        box("StockSlot%d" % index, (-0.132 - index * 0.008, 0, 0.016),
            (0.0045, 0.040, 0.009), steel, stock, bevel=0.001)

    # ---- secondary controls and side furniture ---------------------------
    for side in (-1, 1):
        box("SelectorLever%d" % side, (-0.058, side * 0.030, -0.010), (0.026, 0.010, 0.010),
            steel, gun, bevel=0.0015)
        dial = tube("SelectorHub%d" % side, [(0.0, 0.0082), (0.006, 0.0082)], 22,
                    steel, gun)
        dial.rotation_euler = (0, 0, math.pi / 2)
        dial.location = (side * 0.027, -0.058, -0.010)
        box("SlingSocket%d" % side, (BODY_REAR + 0.026, side * 0.029, -0.018),
            (0.014, 0.006, 0.014), steel, gun, bevel=0.0015)
        box("QDTab%d" % side, (0.086, side * 0.029, -0.020), (0.016, 0.006, 0.012),
            steel, gun, bevel=0.0015)
    ejection_port("EjectionPort", metal, gun, 0.006, 0.044, 0.000, 0.022, 0.0272,
                  depth=0.006)
    ejection_port("BoltCoverSeam", metal, gun, -0.024, 0.006, 0.004, 0.020, 0.0262,
                  depth=0.005)
    bolt_release = tube("BoltRelease", [(0.0, 0.0050), (0.014, 0.0050)], 20, steel, gun)
    bolt_release.rotation_euler = (0, 0, math.pi / 2)
    bolt_release.location = (-0.026, -0.014, -0.030)
    for index in range(7):
        y = -0.090 + index * 0.022
        for side in (-1, 1):
            pin = tube("ReceiverPin%d_%d" % (index, side), [(-0.0030, 0.0028),
                                                            (0.0030, 0.0028)], 18,
                       metal, gun)
            pin.rotation_euler = (0, 0, math.pi / 2)
            pin.location = (side * 0.0272, y, -0.014)

    sling_loop("SlingLoopRear", metal, gun, BODY_REAR + 0.002, -0.024, 0.010)
    sling_loop("SlingLoopFront", metal, gun, 0.100, -0.030, 0.009)

    anchor("ViewmodelAnchor", (0.0, 0.030, -0.010), root)
    anchor("Muzzle", (0.0, MUZZLE_TIP + 0.004, 0.0), root)
    anchor("LeftHandIK", (0.0, 0.058, -0.046), root)
    anchor("RightHandIK", (0.0, -0.038, -0.032), root)
    anchor("MagazineAnchor", (0.0, MAG_CENTRE, -0.040), magazine)
    return root
