"""Galil AR - ``needs_more_reference`` (no reference art ships for this weapon).

Authored from published class proportions: an AK-derived milled receiver with a
rocker magazine, an upward-curving charging handle, a folding tubular stock, a
bottle-nosed barrel and an AR-15 style flash hider. Datum is the bore axis
(``z = 0``) with ``y = 0`` at the receiver front face.
"""
from weapon_common import anchor, extrude_profile, group, tube
from weapon_parts import (charging_handle, curved_magazine, handguard,
                          muzzle_device, pistol_grip, receiver, sight_front,
                          sight_rear, slot_rail, sling_loop, stepped_barrel,
                          trigger_group)

WEAPON_ID = "galil-ar"
DISPLAY = "Galil AR"
CATEGORY = "rifle"
TRIANGLE_HINT = 44000
HAS_REFERENCE = False


def build(palette):
    root = group(WEAPON_ID + "_Root")
    gun = group("GalilAR", root)
    metal = palette["gunmetal"]
    dark = palette["polymer"]
    steel = palette["steel"]

    receiver("Receiver", metal, gun, [
        (-0.070, 0.046, -0.038),
        (0.000, 0.048, -0.040),
        (0.130, 0.050, -0.040),
        (0.230, 0.046, -0.036),
        (0.262, 0.040, -0.032),
    ], 0.046, bevel=0.003)
    # the Galil dust cover carries an AR-15 style rear sight on a raised bridge
    receiver("DustCover", dark, gun, [
        (-0.066, 0.062, 0.030),
        (0.060, 0.066, 0.032),
        (0.190, 0.064, 0.030),
        (0.256, 0.052, 0.022),
    ], 0.044, bevel=0.003)
    charging_handle("ChargingHandle", steel, gun, 0.150, 0.042, 0.10, width=0.030)

    stepped_barrel("Barrel", metal, gun, [
        (0.258, 0.0122), (0.320, 0.0104), (0.380, 0.0090),
        (0.420, 0.0082), (0.452, 0.0076),
    ], segments=22)
    stepped_barrel("GasBlock", metal, gun, [
        (0.352, 0.0148), (0.364, 0.0158), (0.386, 0.0158), (0.396, 0.0142),
    ], segments=20)
    gas_tube = stepped_barrel("GasTube", steel, gun, [
        (0.210, 0.0086), (0.356, 0.0082),
    ], segments=20)
    gas_tube.location.z = 0.026
    muzzle_device("FlashHider", metal, gun, 0.446, 0.478, 0.0125, ports=3,
                  port_material=dark)

    handguard("Handguard", dark, gun, 0.266, 0.350, 0.020, -0.026, 0.050,
              slots=4, slot_material=metal, cap=(0.258, 0.268, -0.028, 0.020),
              cap_material=steel)
    receiver("HandguardTop", dark, gun, [
        (0.266, 0.032, 0.018),
        (0.350, 0.030, 0.016),
    ], 0.044, bevel=0.003)

    sight_front("FrontSight", metal, gun, 0.404, 0.006, 0.058, width=0.022,
                post_material=steel)
    sight_rear("RearSight", dark, gun, 0.120, 0.066, 0.024, width=0.026,
               aperture_material=metal)
    slot_rail("SightRail", 0.060, 0.230, 0.066, 0.030, 0.010, steel, gun)

    # folding tubular stock
    receiver("StockHinge", steel, gun, [
        (-0.140, 0.036, -0.014),
        (-0.062, 0.040, -0.016),
        (-0.058, 0.006, -0.030),
        (-0.140, 0.002, -0.028),
    ], 0.040, bevel=0.003)
    upper = tube("StockTube", [(-0.400, 0.0118), (-0.140, 0.0118)], 22, steel, gun)
    upper.location.z = 0.010
    lower = tube("StockTubeLower", [(-0.386, 0.0105), (-0.150, 0.0105)], 22, steel, gun)
    lower.location.z = -0.016
    extrude_profile("ButtPlate", [
        (-0.412, 0.028), (-0.396, 0.026), (-0.396, -0.036), (-0.412, -0.036),
    ], 0.040, dark, gun, smooth=False, bevel=0.004)

    pistol_grip("PistolGrip", dark, gun, 0.062, -0.040, 0.140, 0.040, 0.032,
                panels=True, panel_material=metal)

    magazine = group("Magazine", gun)
    curved_magazine("MagazineBody", metal, magazine, -0.080, 0.056, -0.038,
                    0.208, 0.030, 0.034, stations=9, ribs=3, floor_material=dark)

    bolt = group("BoltCarrier", gun)
    extrude_profile("BoltCarrier", [
        (-0.010, 0.022), (0.150, 0.022), (0.150, -0.004), (-0.010, -0.004),
    ], 0.024, steel, bolt, smooth=False, bevel=0.002)

    trigger = group("Trigger", gun)
    trigger_group("TriggerAssembly", steel, trigger, 0.024, -0.040,
                  guard_material=metal, blade_material=steel)

    for position in ((0.268, -0.030), (-0.404, -0.030)):
        sling_loop("SlingLoop%d" % int(position[0] * 1000), steel, gun,
                   position[0], position[1], 0.011)

    anchor("ViewmodelAnchor", (0.0, 0.030, -0.020), root)
    anchor("Muzzle", (0.0, 0.482, 0.0), root)
    anchor("LeftHandIK", (0.0, 0.300, -0.040), root)
    anchor("RightHandIK", (0.0, 0.055, -0.050), root)
    anchor("MagazineAnchor", (0.0, 0.000, -0.050), magazine)
    return root
