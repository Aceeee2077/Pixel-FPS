"""SCAR-20 / Mk 20 SSR, authored from class knowledge.

NO REFERENCE ART: there is no rendered art for this weapon in the repository, so
the proportions below are an authored interpretation of the class (a 1.05 m
semi-automatic marksman rifle) rather than measurements off a reference sheet.
The AR-style receiver layout, the long vented handguard and the side-folding
skeleton stock are all stated design intent, not recovered data.

Datum is the same as every other module: bore axis at ``z = 0``, ``y = 0`` at the
receiver front face, +Y toward the muzzle.

Distinctive features: FDE/tan polymer furniture, a long vented handguard with a
full-length top rail, a side-folding skeleton stock with a triangular cut-out, a
20-round box magazine, a large scope on the receiver rail, a front gas block,
and a squared-off monolithic receiver.
"""
import math

from weapon_common import (anchor, arc_profile, box, extrude_profile, group,
                           rect_profile, slot_rail, sweep, tube)
from weapon_detail import (flutes, hollow_slab, knurl_ring, optic, scope_ring)
from weapon_parts import (bolt_handle, charging_handle, cylinder, ejection_port,
                          magazine_well, muzzle_device, pistol_grip, receiver,
                          sight_front, sling_loop, stepped_barrel, trigger_group)

WEAPON_ID = "scar-20"
DISPLAY = "SCAR-20"
CATEGORY = "sniper"
TRIANGLE_HINT = 66000

# --- master stations (metres, bore datum) ---------------------------------
RECEIVER_REAR = -0.156
RECEIVER_FRONT = 0.058
RECEIVER_TOP = 0.048
RECEIVER_BOTTOM = -0.040
RECEIVER_WIDTH = 0.062
RAIL_TOP = 0.066
BARREL_FRONT = 0.462
MUZZLE_TIP = 0.525
HANDGUARD_FRONT = 0.286
BUTT_REAR = -0.520
STOCK_WIDTH = 0.046
SCOPE_AXIS = 0.092
SCOPE_OBJECTIVE = 0.046
SCOPE_OCULAR = -0.262

# Skeleton stock outline: clockwise in (y, z) so outward normals face +X.
STOCK_OUTER = [
    (-0.148, 0.004),    # A hinge / comb front
    (-0.262, 0.014),    # B comb
    (-0.382, 0.006),    # C
    (-0.452, -0.004),   # D
    (-0.514, -0.018),   # E heel
    (-0.520, -0.092),   # F toe
    (-0.470, -0.084),   # G
    (-0.402, -0.072),   # H stock bottom
    (-0.330, -0.062),   # I
    (-0.258, -0.062),   # J
    (-0.186, -0.074),   # K
    (-0.148, -0.090),   # L butt of the lower rail
]
STOCK_HOLE = [
    (-0.252, -0.010),   # a
    (-0.330, -0.014),   # b
    (-0.412, -0.024),   # c
    (-0.452, -0.040),   # d
    (-0.430, -0.062),   # e
    (-0.348, -0.056),   # f
    (-0.268, -0.050),   # g
    (-0.240, -0.030),   # h
]
STOCK_STATIONS = [
    (-STOCK_WIDTH * 0.500, 1.000, 0.000, 0.000),
    (-STOCK_WIDTH * 0.460, 1.010, -0.001, 0.001),
    (-STOCK_WIDTH * 0.380, 1.022, -0.002, 0.002),
    (-STOCK_WIDTH * 0.260, 1.030, -0.003, 0.003),
    (-STOCK_WIDTH * 0.100, 1.034, -0.003, 0.003),
    (STOCK_WIDTH * 0.100, 1.032, -0.003, 0.003),
    (STOCK_WIDTH * 0.260, 1.026, -0.002, 0.002),
    (STOCK_WIDTH * 0.380, 1.016, -0.001, 0.001),
    (STOCK_WIDTH * 0.460, 1.006, 0.000, 0.000),
    (STOCK_WIDTH * 0.500, 1.000, 0.000, 0.000),
]


def build(palette):
    root = group(WEAPON_ID + "_Root")
    gun = group(DISPLAY, root)

    metal = palette["gunmetal"]        # barrel, gas block, muzzle device
    dark = palette["anodized"]         # monolithic receiver, rail, mounts, optic
    fde = palette["polymer_fde"]       # tan furniture
    glass = palette["glass"]
    steel = palette["steel"]           # bolt carrier, charging handle, screws
    rubber = palette["rubber"]         # recoil pad

    # ---- squared-off monolithic receiver ----------------------------------
    receiver("Upper", dark, gun, [
        (RECEIVER_REAR, RECEIVER_TOP, -0.024),
        (RECEIVER_REAR + 0.016, RECEIVER_TOP + 0.002, -0.028),
        (-0.108, RECEIVER_TOP + 0.002, -0.030),
        (-0.052, RECEIVER_TOP + 0.002, -0.030),
        (0.002, RECEIVER_TOP + 0.002, -0.030),
        (0.042, RECEIVER_TOP + 0.001, -0.028),
        (RECEIVER_FRONT, RECEIVER_TOP - 0.004, -0.024),
    ], RECEIVER_WIDTH, bevel=0.003)
    receiver("Lower", fde, gun, [
        (RECEIVER_REAR + 0.010, -0.022, RECEIVER_BOTTOM),
        (-0.108, -0.024, RECEIVER_BOTTOM - 0.004),
        (-0.030, -0.024, RECEIVER_BOTTOM - 0.004),
        (0.028, -0.022, RECEIVER_BOTTOM - 0.002),
        (RECEIVER_FRONT - 0.004, -0.018, RECEIVER_BOTTOM + 0.006),
    ], RECEIVER_WIDTH * 0.96, bevel=0.0025)
    # monolithic top rail runs the whole receiver plus the handguard
    slot_rail("ReceiverRail", -0.150, RECEIVER_FRONT, RECEIVER_TOP, RECEIVER_WIDTH * 0.74,
              0.018, dark, gun, pitch=0.021, slot=0.011, depth=0.010)
    slot_rail("HandguardRail", RECEIVER_FRONT - 0.004, HANDGUARD_FRONT, RAIL_TOP - 0.002,
              RECEIVER_WIDTH * 0.70, 0.016, dark, gun, pitch=0.021, slot=0.011, depth=0.009)

    ejection_port("EjectionPort", palette["phosphate"], gun, 0.086, 0.176, 0.000, 0.028,
                  RECEIVER_WIDTH * 0.5 + 0.002, depth=0.006)
    box("MarkingsPanel", (-0.100, RECEIVER_WIDTH * 0.5 + 0.002, -0.008),
        (0.070, 0.003, 0.018), steel, gun, bevel=0.0012)
    for index in range(3):
        pin = cylinder("TakeDownPin%d" % index, steel, gun, -0.140 + index * 0.084,
                       -0.140 + index * 0.084, 0.007, z=-0.020, segments=16)
        pin.rotation_euler = (0, math.pi / 2, 0)
        pin.location.x = RECEIVER_WIDTH * 0.50

    # ---- barrel and gas system -------------------------------------------
    stepped_barrel("Barrel", metal, gun, [
        (0.020, 0.0165), (0.040, 0.0160), (0.070, 0.0154), (0.104, 0.0148),
        (0.142, 0.0142), (0.184, 0.0136), (0.230, 0.0130), (0.278, 0.0124),
        (0.330, 0.0119), (0.386, 0.0114), (0.430, 0.0110), (BARREL_FRONT, 0.0108),
    ], segments=56)
    flutes("BarrelFlute", metal, gun, 0.100, 0.400, 0.0124, 6, stations=30)

    # front gas block with a piston housing and a folding front sight
    receiver("GasBlock", metal, gun, [
        (0.334, 0.022, -0.020), (0.352, 0.026, -0.024), (0.386, 0.026, -0.024),
        (0.402, 0.020, -0.018),
    ], 0.040, bevel=0.0025)
    cylinder("GasPiston", steel, gun, 0.320, 0.338, 0.009, z=0.020, segments=26)
    sight_front("FrontSight", dark, gun, 0.368, 0.022, 0.030, width=0.022,
                post_material=steel)
    muzzle_device("MuzzleBrake", metal, gun, BARREL_FRONT, MUZZLE_TIP, 0.0175,
                  ports=3, port_material=palette["anodized"], flare=0.005)
    cylinder("MuzzleCrown", dark, gun, MUZZLE_TIP - 0.010, MUZZLE_TIP + 0.002,
             0.0130, segments=32, bevel=0.0015)

    # ---- long vented handguard -------------------------------------------
    receiver("Handguard", fde, gun, [
        (RECEIVER_FRONT - 0.006, RAIL_TOP - 0.004, -0.044),
        (0.074, RAIL_TOP - 0.003, -0.048),
        (0.148, RAIL_TOP - 0.004, -0.048),
        (0.222, RAIL_TOP - 0.008, -0.044),
        (HANDGUARD_FRONT, RAIL_TOP - 0.016, -0.034),
    ], 0.074, bevel=0.004)
    for index in range(5):
        y = 0.070 + index * 0.044
        for side in (-1, 1):
            vent = extrude_profile("HandguardVent%d_%d" % (index, side),
                                   arc_profile(y - 0.016, y + 0.016, -0.038, 0.016, 0.006,
                                               steps=2),
                                   0.008, dark, gun, smooth=True)
            vent.location.x = side * 0.037
    for index in range(4):
        y = 0.056 + index * 0.056
        extrude_profile("HandguardRib%d" % index,
                        arc_profile(y - 0.004, y + 0.004, -0.044, RAIL_TOP - 0.008,
                                    0.010, steps=3),
                        0.078, fde, gun, smooth=True, bevel=0.0015)
    sling_loop("SlingSwivelFront", steel, gun, 0.090, -0.052, 0.009)

    # ---- side-folding skeleton stock --------------------------------------
    hollow_slab("SkeletonStock", STOCK_OUTER, STOCK_HOLE, STOCK_STATIONS, fde, gun,
                bevel=0.004, bevel_segments=4)
    box("StockHinge", (-0.150, 0, -0.040), (0.026, 0.052, 0.048), dark, gun, bevel=0.003)
    cylinder("HingePin", steel, gun, -0.150, -0.142, 0.0075, z=-0.052, segments=20)
    extrude_profile("ButtPad", [
        (-0.514, -0.022), (-0.524, -0.032), (-0.524, -0.100), (-0.512, -0.090),
    ], STOCK_WIDTH * 1.06, rubber, gun, smooth=False, bevel=0.004)
    extrude_profile("CheekRiser", [
        (-0.272, 0.010), (-0.296, 0.016), (-0.336, 0.014), (-0.376, 0.006),
        (-0.404, 0.000), (-0.392, -0.012), (-0.340, -0.006), (-0.290, -0.004),
        (-0.274, -0.006),
    ], STOCK_WIDTH * 0.64, fde, gun, smooth=False, bevel=0.0035)
    for index in range(2):
        knob = cylinder("CheekScrew%d" % index, steel, gun, -0.310 - index * 0.058,
                        -0.310 - index * 0.058, 0.006, z=-0.008, segments=16)
        knob.rotation_euler = (0, math.pi / 2, 0)
        knob.location.x = STOCK_WIDTH * 0.32
    sling_loop("SlingSwivelRear", steel, gun, -0.470, -0.086, 0.010)

    # ---- optic ------------------------------------------------------------
    optic("Scope", dark, gun, SCOPE_OBJECTIVE, SCOPE_OCULAR, SCOPE_AXIS, 0.0190,
          0.0325, 0.0215, glass, palette["anodized"], RAIL_TOP - 0.002,
          (-0.118, 0.010), segments=44)
    scope_ring("ScopeClampRing", dark, gun, -0.118, SCOPE_AXIS, 0.0190, 0.015)
    scope_ring("ScopeClampRing2", dark, gun, 0.010, SCOPE_AXIS, 0.0190, 0.015)
    knurl_ring("MagnificationRing", steel, gun, SCOPE_OCULAR - 0.044, SCOPE_OCULAR - 0.030,
               SCOPE_AXIS, 0.0222, 14, 0.0022)

    # ---- moving parts (kept separate for reload / fire animation) --------
    magazine = group("Magazine", gun)
    sweep("MagazineBody", [
        (0.096, -0.046, 0.104), (0.094, -0.070, 0.104), (0.092, -0.094, 0.103),
        (0.090, -0.118, 0.103), (0.088, -0.142, 0.102), (0.086, -0.166, 0.101),
        (0.084, -0.190, 0.100), (0.082, -0.214, 0.098), (0.080, -0.238, 0.096),
        (0.078, -0.260, 0.094),
    ], 0.040, palette["phosphate"], magazine, bevel=0.0025)
    extrude_profile("MagazineFloor", rect_profile(0.022, 0.134, -0.274, -0.258, chamfer=0.005),
                    0.084, dark, magazine, smooth=False, bevel=0.0028)
    extrude_profile("MagazineSpine", rect_profile(0.028, 0.128, -0.246, -0.050, chamfer=0.004),
                    0.010, dark, magazine, smooth=False, bevel=0.0015)
    box("MagazineCatch", (0.044, 0, -0.042), (0.024, 0.056, 0.014), steel, magazine, bevel=0.002)
    magazine_well("MagazineWell", dark, gun, 0.036, 0.140, RECEIVER_BOTTOM,
                  RECEIVER_BOTTOM - 0.020, RECEIVER_WIDTH * 0.98)

    bolt = group("BoltCarrier", gun)
    box("BoltCarrierBody", (-0.050, 0, 0.008), (0.170, 0.030, 0.028), steel, bolt, bevel=0.003)
    charging_handle("ChargingHandle", steel, bolt, -0.020, 0.032, 0.070, width=0.036)
    cylinder("BoltCam", steel, bolt, 0.100, 0.136, 0.011, z=0.008, segments=28)

    trigger = group("Trigger", gun)
    trigger_group("TriggerAssembly", steel, trigger, 0.170, -0.066,
                  guard_material=dark, blade_material=steel, width=0.030)
    box("BoltRelease", (0.030, 0.038, -0.014), (0.030, 0.012, 0.018), dark, trigger, bevel=0.002)
    box("MagRelease", (0.056, 0.036, -0.036), (0.026, 0.010, 0.014), steel, trigger, bevel=0.002)

    pistol_grip("PistolGrip", fde, gun, -0.196, -0.062, 0.112, 0.020, 0.040,
                panels=True, panel_material=dark)

    anchor("ViewmodelAnchor", (0.0, 0.070, -0.020), root)
    anchor("Muzzle", (0.0, MUZZLE_TIP + 0.004, 0.0), root)
    anchor("LeftHandIK", (0.0, 0.212, -0.052), root)
    anchor("RightHandIK", (0.0, -0.150, -0.104), root)
    anchor("MagazineAnchor", (0.0, 0.086, -0.052), magazine)
    return root
