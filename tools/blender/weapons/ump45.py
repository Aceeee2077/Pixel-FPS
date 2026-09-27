"""HK UMP-45 submachine gun, authored from class knowledge.

NO REFERENCE ART: the project ships no ``UMP-45.png``, so every proportion
below comes from the UMP family's published envelope (690 mm with the stock
extended, 260 mm tall over a 25-round magazine, 200 mm barrel) plus the
generic HK layout: a squared polymer receiver, a folding skeleton stock, HK
diopter sights on a full-length top rail, a slim barrel and a squared-off
forend. Silhouette proportions are therefore *class-derived*, not measured.

Datum is the bore axis (``z = 0``) with ``y = 0`` at the receiver front face,
so the muzzle runs into positive ``y`` and the stock into negative ``y``.
"""
import math

from weapon_common import (anchor, arc_profile, box, extrude_profile, group,
                           loft, rect_profile, slot_rail, sweep, tube)
from weapon_parts import (closed_body, curved_magazine, ejection_port,
                          muzzle_device, pistol_grip, sight_front, sight_rear,
                          sling_loop, stepped_barrel)

WEAPON_ID = "ump-45"
DISPLAY = "UMP-45"
CATEGORY = "smg"
TRIANGLE_HINT = 45000
HAS_REFERENCE = False

# --- master stations (metres, bore datum) ---------------------------------
RECEIVER_REAR = -0.132
RECEIVER_FRONT = 0.064
RECEIVER_TOP = 0.046
RECEIVER_BOTTOM = -0.036
RECEIVER_WIDTH = 0.054
HANDGUARD_FRONT = 0.182
BARREL_FRONT = 0.288
MUZZLE_TIP = 0.330
BUTT_REAR = -0.360
RAIL_TOP = 0.058
GRIP_TOP = -0.028
GRIP_DROP = 0.122
MAG_CENTRE = -0.062
MAG_DROP = 0.132


def build(palette):
    root = group(WEAPON_ID + "_Root")
    gun = group("UMP45", root)

    shell = palette["polymer"]
    grey = palette["polymer_grey"]
    metal = palette["anodized"]
    bore_metal = palette["gunmetal"]
    steel = palette["steel"]
    rubber = palette["rubber"]

    # ---- squared polymer receiver ----------------------------------------
    loft("UpperReceiver", [(y, arc_profile(-hw, hw, zb, zt, 0.0060, steps=4))
                           for y, hw, zt, zb in [
                               (RECEIVER_REAR, 0.0200, 0.024, -0.018),
                               (-0.118, 0.0258, 0.040, -0.030),
                               (-0.086, 0.0272, RECEIVER_TOP, RECEIVER_BOTTOM),
                               (-0.010, 0.0272, RECEIVER_TOP, RECEIVER_BOTTOM),
                               (0.036, 0.0268, 0.044, -0.034),
                               (RECEIVER_FRONT, 0.0240, 0.036, -0.026),
                           ]], shell, gun, smooth=False)
    extrude_profile("LowerReceiver", closed_body([
        (-0.116, -0.014, -0.030),
        (-0.100, -0.020, -0.040),
        (-0.040, -0.020, -0.042),
        (0.010, -0.018, -0.040),
        (0.044, -0.012, -0.030),
    ]), 0.048, shell, gun, bevel=0.003, bevel_segments=4)
    extrude_profile("MagwellFlare", closed_body([
        (-0.086, -0.028, -0.044),
        (-0.078, -0.032, -0.052),
        (-0.028, -0.032, -0.052),
        (-0.020, -0.028, -0.044),
    ]), 0.054, metal, gun, bevel=0.0025)

    # ---- squared-off forend ----------------------------------------------
    extrude_profile("Handguard", closed_body([
        (0.056, 0.030, -0.032),
        (0.070, 0.034, -0.040),
        (0.160, 0.034, -0.040),
        (HANDGUARD_FRONT, 0.026, -0.032),
    ]), 0.058, shell, gun, bevel=0.005, bevel_segments=4)
    for index in range(6):
        y = 0.078 + index * 0.017
        box("HandguardRib%d" % index, (y, 0, -0.044), (0.009, 0.0588, 0.010),
            grey, gun, bevel=0.0014)
    for side in (-1, 1):
        box("HandguardVent%d" % side, (0.116, side * 0.0290, -0.008),
            (0.100, 0.008, 0.020), bore_metal, gun, bevel=0.0018)
        box("HandguardSideRail%d" % side, (0.120, side * 0.0300, -0.014),
            (0.092, 0.008, 0.014), metal, gun, bevel=0.0015)
        for index in range(6):
            box("HandguardSideTooth%d_%d" % (index, side),
                (0.080 + index * 0.015, side * 0.0330, -0.014),
                (0.005, 0.008, 0.015), steel, gun, bevel=0.001)
    slot_rail("HandguardRail", 0.070, 0.170, -0.048, 0.020, 0.009, metal, gun,
              pitch=0.0110, slot=0.0052, depth=0.0055)

    # ---- slim barrel and flash hider -------------------------------------
    stepped_barrel("Barrel", bore_metal, gun, [
        (0.040, 0.0132), (0.120, 0.0112), (0.200, 0.0098), (0.262, 0.0090),
        (BARREL_FRONT, 0.0088),
    ], segments=32)
    tube("BarrelNut", [(BARREL_FRONT - 0.014, 0.0114), (BARREL_FRONT, 0.0114)], 32,
         steel, gun).location.z = 0.0
    muzzle_device("FlashHider", metal, gun, BARREL_FRONT - 0.006, MUZZLE_TIP, 0.0116,
                  ports=3, port_material=steel, flare=0.003)
    tube("MuzzleCrown", [(MUZZLE_TIP - 0.005, 0.0078), (MUZZLE_TIP + 0.001, 0.0076)],
         32, steel, gun)
    for index in range(4):
        angle = math.pi * 2 * index / 4 + math.pi / 4
        flute = tube("BarrelFlute%d" % index, [(0.196, 0.0028), (0.276, 0.0028)], 18,
                     steel, gun)
        flute.location = (math.cos(angle) * 0.0078, 0.0, math.sin(angle) * 0.0078)

    # ---- full-length top rail and HK-pattern sights ----------------------
    slot_rail("TopRail", -0.112, 0.056, RECEIVER_TOP, 0.022, 0.012, metal, gun,
              pitch=0.0100, slot=0.0050, depth=0.0065)
    box("RailRoot", (-0.028, 0, RECEIVER_TOP + 0.004), (0.176, 0.034, 0.009), shell, gun,
        bevel=0.002)
    slot_rail("HandguardTopRail", 0.070, 0.174, 0.034, 0.020, 0.010, metal, gun,
              pitch=0.0105, slot=0.0052, depth=0.0055)
    sight_rear("RearSight", metal, gun, -0.098, RAIL_TOP, 0.018, width=0.026,
               aperture_material=steel)
    for side in (-1, 1):
        box("RearSightGuard%d" % side, (-0.098, side * 0.017, 0.070),
            (0.020, 0.006, 0.022), metal, gun, bevel=0.0015)
    sight_front("FrontSight", metal, gun, 0.146, 0.044, 0.024, width=0.021,
                post_material=steel)

    # ---- pistol grip and moulded texture ---------------------------------
    pistol_grip("PistolGrip", shell, gun, -0.062, GRIP_TOP, GRIP_DROP, 0.016,
                0.050, panels=True, panel_material=rubber)
    for index in range(10):
        z = GRIP_TOP - 0.012 - index * 0.0108
        box("GripBand%d" % index, (-0.058 + index * 0.0011, 0, z),
            (0.056, 0.0485, 0.0050), rubber, gun, bevel=0.0012)
    sweep("GripFrontStrap", [
        (-0.032, -0.036, 0.015), (-0.024, -0.062, 0.014), (-0.020, -0.090, 0.014),
        (-0.026, -0.118, 0.014), (-0.036, -0.144, 0.015),
    ], 0.0075, grey, gun, bevel=0.002)
    for side in (-1, 1):
        box("GripCheekPanel%d" % side, (-0.058, side * 0.0245, GRIP_TOP - 0.062),
            (0.052, 0.006, 0.064), grey, gun, bevel=0.002)
    box("GripCap", (-0.052, 0, GRIP_TOP - GRIP_DROP + 0.006), (0.036, 0.052, 0.014),
        shell, gun, bevel=0.002)

    # ---- moving parts (kept separate for reload / fire animation) ---------
    magazine = group("Magazine", gun)
    curved_magazine("MagazineBody", metal, magazine, MAG_CENTRE - 0.018,
                    MAG_CENTRE + 0.018, -0.026, MAG_DROP, 0.0, 0.030, stations=12,
                    ribs=3, floor_material=steel)
    for index in range(9):
        z = -0.046 - index * 0.0140
        for side in (-1, 1):
            box("MagazineWitness%d_%d" % (index, side), (MAG_CENTRE, side * 0.0145, z),
                (0.024, 0.0035, 0.0080), steel, magazine, bevel=0.001)
    for index in range(4):
        box("MagazineFloorRib%d" % index, (MAG_CENTRE, 0, -0.164 - index * 0.009),
            (0.032, 0.032, 0.0050), steel, magazine, bevel=0.001)
    for side in (-1, 1):
        box("MagazineSpine%d" % side, (MAG_CENTRE - 0.017, side * 0.0150, -0.110),
            (0.005, 0.0040, 0.086), steel, magazine, bevel=0.001)
    box("MagazineRelease", (-0.086, 0.028, -0.038), (0.020, 0.010, 0.016), steel, gun,
        bevel=0.0015)

    bolt = group("Bolt", gun)
    box("BoltBody", (0.006, 0, 0.012), (0.120, 0.032, 0.028), steel, bolt, bevel=0.002)
    for index in range(4):
        box("BoltLug%d" % index, (0.040 - index * 0.016, 0, 0.026),
            (0.007, 0.034, 0.009), steel, bolt, bevel=0.0009)
    box("ChargingHandleRail", (0.026, -0.030, 0.014), (0.110, 0.012, 0.018), metal, bolt,
        bevel=0.002)
    box("ChargingHandleKnob", (0.062, -0.034, 0.014), (0.030, 0.024, 0.032), steel, bolt,
        bevel=0.0025)
    for index in range(5):
        box("ChargingHandleGrip%d" % index, (0.050 + index * 0.010, -0.034, 0.014),
            (0.0055, 0.0265, 0.0335), steel, bolt, bevel=0.001)

    trigger = group("Trigger", gun)
    extrude_profile("TriggerBlade", rect_profile(-0.026, -0.014, -0.068, GRIP_TOP + 0.002,
                                                 chamfer=0.003),
                    0.016, steel, trigger, smooth=True, bevel=0.0015)
    sweep("TriggerGuard", [
        (0.018, -0.034, 0.012), (0.028, -0.046, 0.011), (0.030, -0.060, 0.010),
        (0.020, -0.072, 0.009), (0.000, -0.076, 0.009), (-0.018, -0.072, 0.009),
        (-0.030, -0.062, 0.009), (-0.034, -0.048, 0.010), (-0.032, -0.036, 0.011),
    ], 0.0078, shell, trigger, bevel=0.0018)
    for index, y in enumerate((-0.004, -0.020)):
        pin = tube("TriggerPin%d" % index, [(-0.008, 0.0034), (0.008, 0.0034)], 18,
                   steel, trigger)
        pin.rotation_euler = (0, 0, math.pi / 2)
        pin.location = (0.026, y, -0.036)

    # ---- folding skeleton stock, drawn extended to 0.690 m ---------------
    stock = group("Stock", gun)
    box("StockHinge", (RECEIVER_REAR + 0.010, 0, 0.012), (0.030, 0.048, 0.044), metal,
        stock, bevel=0.003)
    hinge = tube("StockHingePin", [(-0.024, 0.0050), (0.024, 0.0050)], 18, steel, stock)
    hinge.rotation_euler = (math.pi / 2, 0, 0)
    hinge.location = (RECEIVER_REAR + 0.010, 0, 0.012)
    for side in (-1, 1):
        box("StockStrut%d" % side, (-0.244, side * 0.024, 0.026), (0.230, 0.011, 0.014),
            metal, stock, bevel=0.0022)
        box("StockStrutLower%d" % side, (-0.244, side * 0.024, -0.008), (0.214, 0.011, 0.012),
            metal, stock, bevel=0.0022)
        box("StockBrace%d" % side, (-0.166, side * 0.024, 0.010), (0.016, 0.024, 0.036),
            steel, stock, bevel=0.002)
        box("StockQD%d" % side, (-0.132, side * 0.030, 0.016), (0.018, 0.008, 0.016),
            steel, stock, bevel=0.0015)
    extrude_profile("StockButt", [
        (-0.350, 0.036), (-0.328, 0.040), (-0.316, 0.030), (-0.314, -0.018),
        (-0.328, -0.028), (-0.352, -0.024), (-0.360, -0.010), (-0.360, 0.022),
    ], 0.052, metal, stock, smooth=False, bevel=0.004)
    extrude_profile("StockButtPad", [
        (-0.356, 0.030), (-0.344, 0.032), (-0.338, 0.022), (-0.338, -0.014),
        (-0.350, -0.020), (-0.360, -0.012),
    ], 0.048, rubber, stock, smooth=False, bevel=0.003)
    box("StockCheek", (-0.294, 0, 0.046), (0.060, 0.040, 0.012), metal, stock, bevel=0.002)
    box("StockLatch", (-0.126, 0, 0.040), (0.020, 0.026, 0.014), steel, stock, bevel=0.002)
    for index in range(6):
        box("StockLightening%d" % index, (-0.226 - index * 0.014, 0, 0.026),
            (0.0055, 0.040, 0.010), steel, stock, bevel=0.0012)
    sling_loop("SlingLoopStock", metal, stock, -0.338, -0.030, 0.011)

    # ---- secondary controls and side furniture ---------------------------
    for side in (-1, 1):
        box("SelectorLever%d" % side, (-0.080, side * 0.032, -0.008), (0.030, 0.010, 0.012),
            steel, gun, bevel=0.0015)
        dial = tube("SelectorHub%d" % side, [(0.0, 0.0088), (0.006, 0.0088)], 22,
                    steel, gun)
        dial.rotation_euler = (0, 0, math.pi / 2)
        dial.location = (side * 0.029, -0.080, -0.008)
        box("QDSocket%d" % side, (RECEIVER_REAR + 0.030, side * 0.030, -0.020),
            (0.016, 0.007, 0.016), steel, gun, bevel=0.0015)
    ejection_port("EjectionPort", metal, gun, 0.006, 0.048, 0.002, 0.026, 0.0272,
                  depth=0.006)
    box("CaseDeflector", (0.010, 0.030, 0.014), (0.036, 0.014, 0.030), metal,
        gun, bevel=0.002)
    bolt_release = tube("BoltRelease", [(0.0, 0.0052), (0.015, 0.0052)], 20, steel, gun)
    bolt_release.rotation_euler = (0, 0, math.pi / 2)
    bolt_release.location = (-0.030, -0.016, -0.032)
    for index in range(9):
        y = -0.112 + index * 0.021
        for side in (-1, 1):
            pin = tube("ReceiverPin%d_%d" % (index, side), [(-0.0032, 0.0030),
                                                            (0.0032, 0.0030)], 18,
                       steel, gun)
            pin.rotation_euler = (0, 0, math.pi / 2)
            pin.location = (side * 0.0272, y, -0.014)
    sling_loop("SlingLoopFront", metal, gun, 0.166, -0.052, 0.011)

    anchor("ViewmodelAnchor", (0.0, 0.040, -0.012), root)
    anchor("Muzzle", (0.0, MUZZLE_TIP + 0.004, 0.0), root)
    anchor("LeftHandIK", (0.0, 0.120, -0.050), root)
    anchor("RightHandIK", (0.0, -0.056, -0.038), root)
    anchor("MagazineAnchor", (0.0, MAG_CENTRE, -0.046), magazine)
    return root
