"""G3SG1, authored from class knowledge.

NO REFERENCE ART: there is no rendered art for this weapon in the repository, so
the proportions below are an authored interpretation of the class (a 1.13 m
roller-delayed blowback semi-automatic sniper rifle) rather than measurements
off a reference sheet.

Datum is the same as every other module: bore axis at ``z = 0``, ``y = 0`` at the
receiver front face, +Y toward the muzzle.

Distinctive features: black stamped receiver, the G3's characteristic wide
ribbed handguard, a cocking tube running above the barrel with its cocking
handle, a telescoping stock, a 20-round magazine, a large scope on claw mounts,
and a slim tapered barrel with a flash hider.
"""
import math

from weapon_common import (anchor, arc_profile, box, extrude_profile, group,
                           rect_profile, slot_rail, sweep, tube)
from weapon_detail import (flutes, knurl_ring, optic, scope_ring)
from weapon_parts import (bolt_handle, cylinder, ejection_port, magazine_well,
                          muzzle_device, pistol_grip, receiver, sight_front,
                          sight_rear, sling_loop, stepped_barrel, stock_tube,
                          trigger_group)

WEAPON_ID = "g3sg1"
DISPLAY = "G3SG1"
CATEGORY = "sniper"
TRIANGLE_HINT = 64000

# --- master stations (metres, bore datum) ---------------------------------
RECEIVER_REAR = -0.202
RECEIVER_FRONT = 0.040
RECEIVER_TOP = 0.046
RECEIVER_BOTTOM = -0.038
RECEIVER_WIDTH = 0.056
RAIL_TOP = 0.050
BARREL_FRONT = 0.494
MUZZLE_TIP = 0.565
HANDGUARD_FRONT = 0.240
COCKING_TUBE_FRONT = 0.330
BUTT_REAR = -0.565
SCOPE_AXIS = 0.096
SCOPE_OBJECTIVE = 0.022
SCOPE_OCULAR = -0.286
HANDGUARD_WIDTH = 0.068


def build(palette):
    root = group(WEAPON_ID + "_Root")
    gun = group("G3SG1", root)

    metal = palette["gunmetal"]        # barrel, cocking tube, flash hider
    stamped = palette["phosphate"]     # stamped sheet-metal receiver
    shell = palette["polymer"]         # handguard, grip and stock furniture
    dark = palette["anodized"]         # claw mounts, optic body, magazine
    glass = palette["glass"]
    steel = palette["steel"]           # bolt, charging handle, hardware

    # ---- stamped receiver -------------------------------------------------
    receiver("Receiver", stamped, gun, [
        (RECEIVER_REAR, RECEIVER_TOP, RECEIVER_BOTTOM),
        (RECEIVER_REAR + 0.020, RECEIVER_TOP + 0.002, RECEIVER_BOTTOM - 0.003),
        (-0.164, RECEIVER_TOP + 0.002, RECEIVER_BOTTOM - 0.004),
        (-0.118, RECEIVER_TOP + 0.003, RECEIVER_BOTTOM - 0.004),
        (-0.070, RECEIVER_TOP + 0.003, RECEIVER_BOTTOM - 0.004),
        (-0.020, RECEIVER_TOP + 0.002, RECEIVER_BOTTOM - 0.003),
        (0.018, RECEIVER_TOP + 0.001, RECEIVER_BOTTOM - 0.002),
        (RECEIVER_FRONT, RECEIVER_TOP - 0.006, RECEIVER_BOTTOM + 0.004),
    ], RECEIVER_WIDTH, bevel=0.0028)
    box("ReceiverTop", (-0.080, 0, RECEIVER_TOP + 0.002),
        (0.232, RECEIVER_WIDTH * 0.94, 0.008), stamped, gun, bevel=0.002)
    box("Trunnion", (0.010, 0, 0.010), (0.040, RECEIVER_WIDTH * 1.02, 0.062),
        stamped, gun, bevel=0.003)
    ejection_port("EjectionPort", palette["anodized"], gun, 0.008, 0.100, -0.004, 0.030,
                  RECEIVER_WIDTH * 0.5 + 0.002, depth=0.006)
    box("MarkingsPanel", (-0.150, RECEIVER_WIDTH * 0.5 + 0.002, -0.006),
        (0.062, 0.003, 0.018), steel, gun, bevel=0.0012)
    for index in range(3):
        pin = cylinder("ReceiverPin%d" % index, steel, gun, -0.176 + index * 0.076,
                       -0.176 + index * 0.076, 0.0065, z=-0.018, segments=16)
        pin.rotation_euler = (0, math.pi / 2, 0)
        pin.location.x = RECEIVER_WIDTH * 0.50

    # ---- barrel, cocking tube and flash hider -----------------------------
    stepped_barrel("Barrel", metal, gun, [
        (0.030, 0.0158), (0.052, 0.0152), (0.080, 0.0145), (0.112, 0.0138),
        (0.148, 0.0131), (0.186, 0.0125), (0.228, 0.0119), (0.272, 0.0114),
        (0.318, 0.0109), (0.366, 0.0105), (0.416, 0.0101), (0.456, 0.0099),
        (BARREL_FRONT, 0.0098),
    ], segments=56)
    flutes("BarrelFlute", metal, gun, 0.090, 0.440, 0.0112, 6, stations=30)

    # the G3's cocking tube rides above the barrel and ends in a support collar
    cocking = tube("CockingTube",
                   [(COCKING_TUBE_FRONT, 0.0105),
                    (COCKING_TUBE_FRONT - 0.020, 0.0118),
                    (RECEIVER_FRONT, 0.0125)],
                   36, metal, gun, smooth=True)
    cocking.location.z = 0.021
    cylinder("CockingTubeCollar", metal, gun, COCKING_TUBE_FRONT - 0.006,
             COCKING_TUBE_FRONT + 0.010, 0.0145, z=0.021, segments=32, bevel=0.0015)
    handle = tube("CockingHandle",
                  [(0.0, 0.0065), (0.030, 0.0075), (0.034, 0.005)],
                  22, steel, gun, smooth=True)
    handle.rotation_euler = (0, math.pi / 2, 0)
    handle.location = (-0.070, 0.0, 0.032)

    muzzle_device("FlashHider", metal, gun, BARREL_FRONT, MUZZLE_TIP, 0.0155,
                  ports=3, port_material=palette["anodized"], flare=0.003)
    for index in range(4):
        y = BARREL_FRONT + 0.014 + index * 0.014
        ring = cylinder("FlashHiderRing%d" % index, palette["anodized"], gun,
                        y, y + 0.005, 0.0160, segments=30)
    sight_front("FrontSight", stamped, gun, 0.430, 0.026, 0.036, width=0.024,
                post_material=steel)

    # ---- wide ribbed handguard --------------------------------------------
    receiver("Handguard", shell, gun, [
        (RECEIVER_FRONT - 0.008, 0.044, -0.048),
        (0.072, 0.046, -0.054),
        (0.148, 0.045, -0.054),
        (0.206, 0.042, -0.050),
        (HANDGUARD_FRONT, 0.034, -0.042),
    ], HANDGUARD_WIDTH, bevel=0.005)
    for index in range(5):
        y = 0.062 + index * 0.040
        extrude_profile("HandguardRib%d" % index,
                        arc_profile(y - 0.008, y + 0.008, -0.050, 0.040, 0.010, steps=4),
                        HANDGUARD_WIDTH * 1.06, shell, gun, smooth=True, bevel=0.0018)
    for index in range(4):
        y = 0.086 + index * 0.044
        for side in (-1, 1):
            vent = extrude_profile("HandguardVent%d_%d" % (index, side),
                                   arc_profile(y - 0.014, y + 0.014, -0.042, 0.026, 0.007,
                                               steps=2),
                                   0.008, steel, gun, smooth=True)
            vent.location.x = side * HANDGUARD_WIDTH * 0.52
    sling_loop("SlingSwivelFront", steel, gun, 0.116, -0.058, 0.010)

    # receiver-mounted claw mount base: the G3SG1's optic is not on a rail
    extrude_profile("ClawMountBase", [
        (RECEIVER_REAR + 0.014, RECEIVER_TOP + 0.006), (-0.024, RECEIVER_TOP + 0.008),
        (-0.010, RECEIVER_TOP + 0.020), (-0.052, RECEIVER_TOP + 0.024),
        (-0.140, RECEIVER_TOP + 0.022), (RECEIVER_REAR + 0.020, RECEIVER_TOP + 0.018),
    ], 0.052, dark, gun, smooth=False, bevel=0.0025)
    for index in range(2):
        box("ClawFoot%d" % index, (-0.034 - index * 0.074, 0, RECEIVER_TOP + 0.024),
            (0.026, 0.056, 0.008), steel, gun, bevel=0.0015)

    # ---- telescoping stock ------------------------------------------------
    # The buffer tube carries a sliding sleeve and butt. The shared
    # ``stock_tube`` helper emits a sleeve far larger than the tube it is meant
    # to slide on, so the three parts are built explicitly here.
    buffer_tube = tube("BufferTube",
                       [(RECEIVER_REAR + 0.004, 0.0175),
                        (-0.330, 0.0172),
                        (BUTT_REAR + 0.062, 0.0170)],
                       32, steel, gun, smooth=True)
    buffer_tube.location.z = -0.014
    sleeve = tube("StockSleeve",
                  [(BUTT_REAR + 0.070, 0.0230), (-0.470, 0.0234),
                   (-0.400, 0.0228), (-0.330, 0.0210)],
                  36, shell, gun, smooth=True)
    sleeve.location.z = -0.014
    extrude_profile("StockButt", [
        (BUTT_REAR + 0.086, 0.026), (-0.500, 0.030), (BUTT_REAR + 0.004, 0.016),
        (BUTT_REAR + 0.002, -0.062), (-0.500, -0.078), (BUTT_REAR + 0.086, -0.066),
        (BUTT_REAR + 0.098, -0.030),
    ], 0.050, shell, gun, smooth=False, bevel=0.004)
    extrude_profile("ButtPad", [
        (BUTT_REAR + 0.008, 0.012), (BUTT_REAR - 0.004, -0.004), (BUTT_REAR - 0.006, -0.076),
        (BUTT_REAR + 0.006, -0.064),
    ], 0.054, palette["rubber"], gun, smooth=False, bevel=0.004)
    extrude_profile("StockCheek", [
        (-0.396, 0.006), (-0.420, 0.012), (-0.470, 0.010), (-0.504, -0.002),
        (-0.494, -0.016), (-0.440, -0.012), (-0.404, -0.012),
    ], 0.032, shell, gun, smooth=False, bevel=0.003)
    receiver("StockFrame", shell, gun, [
        (RECEIVER_REAR + 0.004, 0.006, -0.052),
        (-0.250, 0.008, -0.056),
        (-0.360, 0.002, -0.052),
        (-0.430, -0.010, -0.044),
    ], 0.036, bevel=0.003)
    box("StockLatch", (-0.238, 0, -0.036), (0.030, 0.042, 0.020), steel, gun, bevel=0.002)
    sling_loop("SlingSwivelRear", steel, gun, -0.492, -0.052, 0.010)

    # ---- optic on claw mounts ---------------------------------------------
    optic("Scope", dark, gun, SCOPE_OBJECTIVE, SCOPE_OCULAR, SCOPE_AXIS, 0.0190,
          0.0320, 0.0215, glass, palette["anodized"], RECEIVER_TOP + 0.024,
          (-0.132, -0.016), segments=44)
    scope_ring("ScopeClampRing", dark, gun, -0.132, SCOPE_AXIS, 0.0190, 0.015)
    scope_ring("ScopeClampRing2", dark, gun, -0.016, SCOPE_AXIS, 0.0190, 0.015)
    knurl_ring("MagnificationRing", steel, gun, SCOPE_OCULAR - 0.044, SCOPE_OCULAR - 0.030,
               SCOPE_AXIS, 0.0222, 14, 0.0022)

    # rear drum sight sits behind the claw mount on the receiver bridge
    sight_rear("RearSight", stamped, gun, RECEIVER_REAR + 0.048, RECEIVER_TOP + 0.004,
               0.024, width=0.030, aperture_material=palette["anodized"], drum=True)

    # ---- moving parts (kept separate for reload / fire animation) --------
    magazine = group("Magazine", gun)
    sweep("MagazineBody", [
        (0.196, -0.052, 0.110), (0.192, -0.078, 0.110), (0.188, -0.104, 0.109),
        (0.184, -0.130, 0.108), (0.180, -0.156, 0.107), (0.176, -0.182, 0.106),
        (0.172, -0.208, 0.104), (0.168, -0.232, 0.102),
    ], 0.044, stamped, magazine, bevel=0.0025)
    extrude_profile("MagazineFloor", rect_profile(0.112, 0.232, -0.244, -0.228, chamfer=0.005),
                    0.088, dark, magazine, smooth=False, bevel=0.0028)
    extrude_profile("MagazineSpine", rect_profile(0.118, 0.226, -0.218, -0.056, chamfer=0.004),
                    0.011, dark, magazine, smooth=False, bevel=0.0015)
    box("MagazineCatch", (0.132, 0, -0.048), (0.026, 0.058, 0.014), steel, magazine, bevel=0.002)
    magazine_well("MagazineWell", stamped, gun, 0.124, 0.238, RECEIVER_BOTTOM,
                  RECEIVER_BOTTOM - 0.020, RECEIVER_WIDTH * 0.98)

    bolt = group("BoltCarrier", gun)
    box("BoltCarrierBody", (-0.120, 0, 0.004), (0.140, 0.034, 0.030), steel, bolt, bevel=0.003)
    cylinder("BoltHead", steel, bolt, 0.020, 0.056, 0.0155, segments=32, bevel=0.0015)
    charging = extrude_profile("CockingHandleLatch", [
        (-0.086, 0.030), (-0.040, 0.032), (-0.036, 0.014), (-0.078, 0.012),
    ], 0.014, steel, bolt, smooth=False, bevel=0.002)
    charging.location.x = 0.026

    trigger = group("Trigger", gun)
    trigger_group("TriggerAssembly", steel, trigger, 0.252, -0.062,
                  guard_material=stamped, blade_material=steel, width=0.030)
    box("MagRelease", (0.132, 0.026, -0.034), (0.026, 0.012, 0.014), dark, trigger, bevel=0.002)

    pistol_grip("PistolGrip", shell, gun, -0.238, -0.196, 0.118, -0.028, 0.044,
                panels=True, panel_material=steel)

    anchor("ViewmodelAnchor", (0.0, 0.080, -0.018), root)
    anchor("Muzzle", (0.0, MUZZLE_TIP + 0.004, 0.0), root)
    anchor("LeftHandIK", (0.0, 0.196, -0.056), root)
    anchor("RightHandIK", (0.0, -0.192, -0.110), root)
    anchor("MagazineAnchor", (0.0, 0.184, -0.058), magazine)
    return root
