"""FN P90 personal defence weapon, authored from ``P90.png``.

Clean-room recreation: the reference is used only for silhouette proportions
and colour zoning. Datum is the bore axis (``z = 0``) with ``y = 0`` at the
receiver front face, so every number below reads directly off the reference.

Reference calibration (vision report + recovered mask, muzzle to the right):
  0.500 m buttplate to muzzle, a single large rounded polymer shell with a real
  thumbhole grip, the 50-round magazine lying horizontally *on top* of the
  shell with its stack of rounds visible through the side windows, a downward
  ejection port, the P90 muzzle device and an integral low-power ring sight.
"""
import math

from weapon_common import (anchor, arc_profile, box, extrude_profile, group,
                           loft, rect_profile, slot_rail, sweep, tube)
from weapon_parts import (closed_body, muzzle_device, sling_loop, stepped_barrel)

WEAPON_ID = "p90"
DISPLAY = "P90"
CATEGORY = "smg"
TRIANGLE_HINT = 45000

# --- master stations (metres, bore datum) ---------------------------------
SHELL_REAR = -0.238
SHELL_FRONT = 0.192
BARREL_FRONT = 0.216
MUZZLE_TIP = 0.250
BUTT_REAR = -0.250
MAG_REAR = -0.068
MAG_FRONT = 0.146
MAG_AXIS_Z = 0.066
GRIP_BOTTOM = -0.116


def build(palette):
    root = group(WEAPON_ID + "_Root")
    gun = group("P90", root)

    shell_poly = palette["polymer"]
    grey = palette["polymer_grey"]
    metal = palette["anodized"]
    steel = palette["steel"]
    brass = palette["brass"]
    glass = palette["glass"]

    # ---- the one-piece rounded shell -------------------------------------
    loft("Shell", [(y, arc_profile(-hw, hw, zb, zt, 0.0140, steps=6))
                   for y, hw, zt, zb in [
                       (SHELL_REAR, 0.0170, 0.014, -0.016),
                       (-0.230, 0.0244, 0.030, -0.028),
                       (-0.216, 0.0276, 0.038, -0.034),
                       (-0.190, 0.0292, 0.043, -0.037),
                       (-0.130, 0.0300, 0.046, -0.038),
                       (-0.060, 0.0300, 0.046, -0.038),
                       (0.020, 0.0298, 0.046, -0.038),
                       (0.090, 0.0292, 0.044, -0.036),
                       (0.140, 0.0280, 0.042, -0.032),
                       (0.172, 0.0256, 0.036, -0.026),
                       (SHELL_FRONT, 0.0212, 0.028, -0.018),
                   ]], shell_poly, gun)
    # moulded side panels: the parting seam and the cheek bulges that give the
    # P90 its "electric shaver" read
    for side in (-1, 1):
        box("ShellSeam%d" % side, (-0.030, side * 0.0300, 0.004),
            (0.400, 0.0040, 0.0055), grey, gun, bevel=0.0009)
        box("ShellCheek%d" % side, (-0.150, side * 0.0300, 0.006),
            (0.150, 0.0055, 0.046), grey, gun, bevel=0.0025)
        for index in range(4):
            box("ShellVent%d_%d" % (index, side), (0.052 + index * 0.020, side * 0.0292, -0.020),
                (0.012, 0.0055, 0.020), grey, gun, bevel=0.0012)
    # rear cap and the buttplate
    extrude_profile("ButtCap", [
        (-0.244, 0.024), (-0.232, 0.028), (-0.228, 0.010), (-0.230, -0.016),
        (-0.238, -0.020), (-0.246, -0.014),
    ], 0.038, metal, gun, smooth=False, bevel=0.004)
    extrude_profile("ButtPad", [
        (-0.250, 0.026), (-0.242, 0.030), (-0.238, 0.012), (-0.240, -0.014),
        (-0.248, -0.018), (-0.252, -0.012),
    ], 0.034, grey, gun, smooth=False, bevel=0.003)

    # ---- barrel and the P90 muzzle device --------------------------------
    stepped_barrel("Barrel", metal, gun, [
        (0.098, 0.0112), (0.150, 0.0096), (0.190, 0.0088), (BARREL_FRONT, 0.0084),
    ], segments=32)
    tube("BarrelNut", [(0.186, 0.0116), (BARREL_FRONT, 0.0116)], 32, steel, gun).location.z = 0.0
    muzzle_device("MuzzleDevice", metal, gun, BARREL_FRONT - 0.004, MUZZLE_TIP, 0.0112,
                  ports=3, port_material=steel, flare=0.003)
    for side in (-1, 1):
        box("MuzzlePortWing%d" % side, (0.234, side * 0.0118, 0.0), (0.024, 0.0075, 0.013),
            steel, gun, bevel=0.0012)
    tube("MuzzleCrown", [(MUZZLE_TIP - 0.005, 0.0076), (MUZZLE_TIP + 0.001, 0.0074)],
         32, steel, gun)

    # ---- thumbhole grip: three straps forming a real opening --------------
    sweep("GripFrontStrap", [
        (-0.070, -0.044, 0.028), (-0.080, -0.064, 0.026), (-0.090, -0.082, 0.025),
        (-0.102, -0.094, 0.024), (-0.114, -0.100, 0.023),
    ], 0.0135, shell_poly, gun, bevel=0.003)
    sweep("GripBottom", [
        (-0.114, -0.100, 0.024), (-0.132, -0.102, 0.024), (-0.150, -0.100, 0.024),
        (-0.168, -0.094, 0.024), (-0.184, -0.088, 0.024),
    ], 0.0135, shell_poly, gun, bevel=0.003)
    sweep("GripRearStrap", [
        (-0.184, -0.088, 0.026), (-0.196, -0.074, 0.028), (-0.202, -0.060, 0.030),
        (-0.204, -0.048, 0.030),
    ], 0.0135, shell_poly, gun, bevel=0.003)
    for index in range(4):
        z = -0.062 - index * 0.0105
        box("GripRib%d" % index, (-0.202 + index * 0.0022, 0, z),
            (0.032, 0.0282, 0.0042), grey, gun, bevel=0.0011)
    for side in (-1, 1):
        box("GripPanel%d" % side, (-0.176, side * 0.0142, -0.080),
            (0.056, 0.006, 0.060), grey, gun, bevel=0.0025)
    # safety lever inside the loop, as on the P90
    extrude_profile("SafetyLever", [
        (-0.122, -0.056), (-0.110, -0.054), (-0.106, -0.068), (-0.116, -0.074),
    ], 0.010, steel, gun, smooth=False, bevel=0.0015)
    sweep("TriggerBlade", [
        (-0.100, -0.050, 0.014), (-0.102, -0.058, 0.014), (-0.104, -0.066, 0.014),
        (-0.104, -0.072, 0.014),
    ], 0.0075, steel, gun, bevel=0.0018)
    box("TriggerShoe", (-0.103, 0, -0.076), (0.028, 0.018, 0.014), steel, gun,
        bevel=0.002)

    # ---- downward ejection port and its cover ----------------------------
    box("EjectionPortFrame", (-0.024, 0, -0.040), (0.052, 0.040, 0.007), metal, gun,
        bevel=0.0015)
    box("EjectionPortHole", (-0.024, 0, -0.042), (0.032, 0.024, 0.004), steel, gun,
        bevel=0.001)
    box("EjectionChute", (-0.024, 0.018, -0.044), (0.034, 0.014, 0.011), metal, gun,
        bevel=0.002)

    # ---- integral low-power ring sight above the magazine ----------------
    box("SightBridge", (0.128, 0, 0.094), (0.080, 0.034, 0.016), metal, gun, bevel=0.002)
    extrude_profile("SightHousing", closed_body([
        (0.096, 0.130, 0.090),
        (0.106, 0.136, 0.090),
        (0.158, 0.136, 0.090),
        (0.168, 0.122, 0.090),
    ]), 0.046, metal, gun, bevel=0.003, bevel_segments=4)
    for side in (-1, 1):
        box("SightPost%d" % side, (0.130, side * 0.0188, 0.112), (0.058, 0.008, 0.044),
            metal, gun, bevel=0.002)
    tube("SightRing", [(0.122, 0.0168), (0.132, 0.0168)], 28, steel, gun).location.z = 0.110
    tube("SightRingGlass", [(0.125, 0.0136), (0.128, 0.0136)], 28, glass, gun).location.z = 0.110
    for index in range(5):
        box("SightBridgeRib%d" % index, (0.104 + index * 0.013, 0, 0.100),
            (0.006, 0.036, 0.012), steel, gun, bevel=0.001)

    # ---- moving parts (kept separate for reload / fire animation) ---------
    magazine = group("Magazine", gun)
    loft("MagazineTop", [(y, arc_profile(-hw, hw, 0.074, 0.092, 0.0055, steps=4))
                         for y, hw in [(MAG_REAR, 0.0204), (MAG_REAR + 0.014, 0.0250),
                                       (MAG_FRONT - 0.014, 0.0250), (MAG_FRONT, 0.0204)]],
         grey, magazine)
    loft("MagazineBottom", [(y, arc_profile(-hw, hw, 0.042, 0.054, 0.0055, steps=4))
                            for y, hw in [(MAG_REAR, 0.0204), (MAG_REAR + 0.014, 0.0250),
                                          (MAG_FRONT - 0.014, 0.0250), (MAG_FRONT, 0.0204)]],
         grey, magazine)
    extrude_profile("MagazineRearCap", closed_body([
        (MAG_REAR - 0.012, 0.094, 0.040),
        (MAG_REAR, 0.094, 0.040),
        (MAG_REAR, 0.072, 0.048),
    ]), 0.052, metal, magazine, bevel=0.002)
    extrude_profile("MagazineFrontCap", closed_body([
        (MAG_FRONT, 0.094, 0.040),
        (MAG_FRONT + 0.014, 0.084, 0.044),
        (MAG_FRONT + 0.014, 0.072, 0.042),
    ]), 0.052, metal, magazine, bevel=0.002)
    # the 50-round stack, visible through the open sides of the magazine body
    for index in range(50):
        y = MAG_REAR + 0.006 + index * 0.0040
        round_obj = tube("MagazineRound%d" % index,
                         [(-0.0225, 0.00510), (0.0225, 0.00510)], 12, brass, magazine)
        round_obj.rotation_euler = (0, 0, math.pi / 2)
        round_obj.location = (0.0, y, MAG_AXIS_Z)
    for index in range(20):
        y = MAG_REAR + 0.009 + index * 0.0100
        for side in (-1, 1):
            box("MagazineRib%d_%d" % (index, side), (y, side * 0.0250, MAG_AXIS_Z),
                (0.0055, 0.0042, 0.048), steel, magazine, bevel=0.0010)
    slot_rail("MagazineRail", MAG_REAR + 0.004, MAG_FRONT - 0.004, 0.092, 0.018, 0.008,
              metal, magazine, pitch=0.0110, slot=0.0052, depth=0.0045)

    bolt = group("Bolt", gun)
    box("BoltBody", (-0.150, 0, -0.002), (0.090, 0.040, 0.036), steel, bolt, bevel=0.002)
    for index in range(3):
        box("BoltLug%d" % index, (-0.104 + index * 0.014, 0, 0.018),
            (0.007, 0.042, 0.010), steel, bolt, bevel=0.001)
    box("ChargingHandleBar", (-0.176, -0.030, 0.006), (0.044, 0.014, 0.018), steel, bolt,
        bevel=0.002)
    box("ChargingHandleKnob", (-0.196, -0.032, 0.006), (0.028, 0.022, 0.030), steel, bolt,
        bevel=0.0025)
    for index in range(4):
        box("ChargingHandleGrip%d" % index, (-0.206 + index * 0.009, -0.032, 0.006),
            (0.0050, 0.0245, 0.0315), steel, bolt, bevel=0.001)

    trigger = group("Trigger", gun)
    box("TriggerBody", (-0.096, 0, -0.062), (0.030, 0.026, 0.032), steel, trigger,
        bevel=0.002)
    box("TriggerLever", (-0.074, 0, -0.056), (0.024, 0.020, 0.014), steel, trigger,
        bevel=0.0018)
    for index in range(3):
        pin = tube("TriggerPin%d" % index, [(-0.008, 0.0032), (0.008, 0.0032)], 18,
                   steel, trigger)
        pin.rotation_euler = (0, 0, math.pi / 2)
        pin.location = (0.014, -0.086 - index * 0.014, -0.062)

    # The P90's shell is one moulding, so the "stock" is the buttplate group
    # that the reload and deploy animations drive.
    stock = group("Stock", gun)
    extrude_profile("StockBody", [
        (-0.250, 0.026), (-0.238, 0.030), (-0.230, 0.014), (-0.232, -0.014),
        (-0.242, -0.020), (-0.252, -0.014),
    ], 0.036, metal, stock, smooth=False, bevel=0.004)
    for index in range(5):
        box("StockRib%d" % index, (-0.246, 0, 0.016 - index * 0.010),
            (0.010, 0.034, 0.0050), grey, stock, bevel=0.0012)
    sling_loop("SlingLoopStock", steel, stock, -0.234, -0.024, 0.010)

    # ---- sling furniture and hardware ------------------------------------
    for side in (-1, 1):
        box("QDTab%d" % side, (0.150, side * 0.026, -0.014), (0.020, 0.007, 0.014),
            steel, gun, bevel=0.0015)
        box("ShellBolt%d" % side, (-0.196, side * 0.0296, -0.014), (0.026, 0.005, 0.016),
            metal, gun, bevel=0.0015)
    sling_loop("SlingLoopFront", steel, gun, 0.158, -0.020, 0.010)
    for index in range(8):
        y = -0.200 + index * 0.022
        for side in (-1, 1):
            pin = tube("ShellPin%d_%d" % (index, side), [(-0.0030, 0.0028), (0.0030, 0.0028)],
                       18, steel, gun)
            pin.rotation_euler = (0, 0, math.pi / 2)
            pin.location = (side * 0.0296, y, -0.030)

    anchor("ViewmodelAnchor", (0.0, 0.020, -0.008), root)
    anchor("Muzzle", (0.0, MUZZLE_TIP + 0.004, 0.0), root)
    anchor("LeftHandIK", (0.0, 0.062, -0.052), root)
    anchor("RightHandIK", (0.0, -0.166, -0.070), root)
    anchor("MagazineAnchor", (0.0, 0.040, MAG_AXIS_Z + 0.020), magazine)
    return root
