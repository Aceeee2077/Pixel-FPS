"""SG 553 - ``needs_more_reference`` (no reference art ships for this weapon).

Authored from published class proportions: a short-stroke gas piston carbine in
the SG 550 family, with the family's tall cocking tube over the barrel, a
side-folding skeleton stock, a translucent 30-round magazine, a squared receiver
and a compact flash hider. Datum is the bore axis (``z = 0``) with ``y = 0`` at
the receiver front face.
"""
from weapon_common import anchor, extrude_profile, group, tube
from weapon_parts import (charging_handle, curved_magazine, handguard,
                          muzzle_device, pistol_grip, receiver, sight_front,
                          sight_rear, slot_rail, sling_loop, stepped_barrel,
                          trigger_group)

WEAPON_ID = "sg-553"
DISPLAY = "SG 553"
CATEGORY = "rifle"
TRIANGLE_HINT = 42000
HAS_REFERENCE = False


def build(palette):
    root = group(WEAPON_ID + "_Root")
    gun = group("SG553", root)
    metal = palette["gunmetal"]
    dark = palette["polymer"]
    grey = palette["polymer_grey"]
    steel = palette["steel"]

    receiver("Receiver", dark, gun, [
        (-0.060, 0.044, -0.036),
        (0.000, 0.046, -0.038),
        (0.110, 0.046, -0.038),
        (0.180, 0.042, -0.034),
        (0.208, 0.034, -0.028),
    ], 0.048, bevel=0.003)
    receiver("TubeRearBlock", metal, gun, [
        (0.100, 0.048, 0.024),
        (0.132, 0.048, 0.022),
    ], 0.036, bevel=0.003)
    # the SG 550 family's signature cocking tube riding above the barrel
    cocking = stepped_barrel("CockingTube", metal, gun, [
        (0.120, 0.0110), (0.230, 0.0104), (0.286, 0.0096),
    ], segments=22)
    cocking.location.z = 0.034

    stepped_barrel("Barrel", metal, gun, [
        (0.204, 0.0106), (0.250, 0.0092), (0.300, 0.0082), (0.336, 0.0074),
    ], segments=22)
    muzzle_device("FlashHider", metal, gun, 0.332, 0.362, 0.0118, ports=3,
                  port_material=dark)

    handguard("Handguard", dark, gun, 0.212, 0.302, 0.020, -0.024, 0.048,
              slots=5, slot_material=grey, cap=(0.204, 0.214, -0.026, 0.020),
              cap_material=steel)
    slot_rail("TopRail", -0.030, 0.180, 0.046, 0.030, 0.011, steel, gun)

    sight_front("FrontSight", metal, gun, 0.312, 0.026, 0.038, width=0.018,
                post_material=steel, wings=False)
    sight_rear("RearSight", dark, gun, 0.060, 0.048, 0.022, width=0.024,
               aperture_material=metal)

    # side-folding skeleton stock
    receiver("StockHinge", steel, gun, [
        (-0.120, 0.034, -0.010),
        (-0.058, 0.038, -0.012),
        (-0.054, 0.008, -0.028),
        (-0.120, 0.004, -0.026),
    ], 0.038, bevel=0.003)
    spine = tube("StockSpine", [(-0.340, 0.0092), (-0.130, 0.0092)], 22, steel, gun)
    spine.location.z = 0.008
    for side in (-1, 1):
        rail = extrude_profile("StockArm%s" % ("L" if side < 0 else "R"), [
            (-0.330, 0.012), (-0.150, 0.014), (-0.150, -0.028), (-0.330, -0.024),
        ], 0.008, steel, gun, smooth=False, bevel=0.002)
        rail.location.x = side * 0.014
    extrude_profile("ButtPlate", [
        (-0.352, 0.020), (-0.336, 0.018), (-0.336, -0.036), (-0.352, -0.036),
    ], 0.036, dark, gun, smooth=False, bevel=0.004)

    pistol_grip("PistolGrip", dark, gun, 0.046, -0.038, 0.132, 0.036, 0.032,
                panels=True, panel_material=metal)

    magazine = group("Magazine", gun)
    curved_magazine("MagazineBody", grey, magazine, -0.066, 0.052, -0.036,
                    0.186, 0.008, 0.032, stations=9, ribs=4, floor_material=dark)

    bolt = group("BoltCarrier", gun)
    extrude_profile("BoltCarrier", [
        (0.010, 0.020), (0.160, 0.020), (0.160, -0.004), (0.010, -0.004),
    ], 0.022, steel, bolt, smooth=False, bevel=0.002)
    charging_handle("ChargingHandle", steel, bolt, 0.180, 0.038, 0.06, width=0.026)

    trigger = group("Trigger", gun)
    trigger_group("TriggerAssembly", steel, trigger, 0.012, -0.038,
                  guard_material=dark, blade_material=steel)

    for position in ((0.216, -0.026), (-0.344, -0.026)):
        sling_loop("SlingLoop%d" % int(position[0] * 1000), steel, gun,
                   position[0], position[1], 0.010)

    anchor("ViewmodelAnchor", (0.0, 0.025, -0.020), root)
    anchor("Muzzle", (0.0, 0.366, 0.0), root)
    anchor("LeftHandIK", (0.0, 0.250, -0.036), root)
    anchor("RightHandIK", (0.0, 0.045, -0.046), root)
    anchor("MagazineAnchor", (0.0, 0.000, -0.048), magazine)
    return root
