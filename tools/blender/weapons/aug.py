"""AUG, authored from ``AUG.png``.

Bullpup with an integrated optic in the carry handle and a rotating bolt, so the
scope sits INSIDE the handle rather than on a rail. Datum is the bore axis
(``z = 0``) with ``y = 0`` at the receiver front face.

Reference calibration (AUG.png + recovered mask): overall 0.79 m, a
semi-transparent waffle magazine behind the grip, a thumbhole trigger hand and a
folding vertical foregrip ahead of the trigger.
"""
from weapon_common import anchor, extrude_profile, group, rect_profile, tube
from weapon_parts import (curved_magazine, handguard, muzzle_device,
                          pistol_grip, receiver, scope, sight_front,
                          slot_rail, sling_loop, stepped_barrel, trigger_group)

WEAPON_ID = "aug"
DISPLAY = "AUG"
CATEGORY = "rifle"
TRIANGLE_HINT = 50000
HAS_REFERENCE = True


def build(palette):
    root = group(WEAPON_ID + "_Root")
    gun = group("AUG", root)

    metal = palette["gunmetal"]
    shell = palette["polymer_green"]
    dark = palette["polymer"]
    steel = palette["steel"]

    # ---- one-piece polymer shell from buttplate to muzzle collar ---------
    receiver("Shell", shell, gun, [
        (-0.395, 0.062, -0.070),   # buttplate
        (-0.290, 0.070, -0.074),
        (-0.160, 0.070, -0.070),
        (-0.040, 0.068, -0.062),
        (0.040, 0.058, -0.046),
        (0.110, 0.044, -0.030),
        (0.180, 0.030, -0.018),
    ], 0.060, bevel=0.006)

    # the AUG carry handle is a squared arch containing the optic
    receiver("CarryHandle", shell, gun, [
        (-0.210, 0.086, 0.056),
        (-0.070, 0.094, 0.058),
        (0.060, 0.094, 0.058),
        (0.130, 0.086, 0.054),
        (0.142, 0.056, 0.048),
    ], 0.034, bevel=0.004)
    receiver("HandleFrontPost", shell, gun, [
        (0.096, 0.090, 0.040),
        (0.124, 0.090, 0.040),
        (0.138, 0.044, 0.044),
    ], 0.032, bevel=0.003)
    receiver("HandleRearPost", shell, gun, [
        (-0.222, 0.088, 0.040),
        (-0.200, 0.092, 0.040),
        (-0.184, 0.058, 0.044),
    ], 0.032, bevel=0.003)

    # integrated optic (donut reticle) inside the handle
    scope("IntegratedOptic", dark, gun, -0.116, 0.062, 0.072, 0.0142,
          bell_radius=0.0175, ocular_radius=0.0152,
          tube_material=dark, glass_material=palette["glass"],
          turrets=False, rings=[])

    # ---- barrel ----------------------------------------------------------
    stepped_barrel("Barrel", metal, gun, [
        (0.060, 0.0110), (0.130, 0.0100), (0.230, 0.0086),
        (0.330, 0.0076), (0.394, 0.0070),
    ], segments=22)
    muzzle_device("MuzzleDevice", metal, gun, 0.392, 0.424, 0.0112, ports=3,
                  port_material=dark)
    stepped_barrel("GasBlock", metal, gun, [
        (0.224, 0.0138), (0.236, 0.0148), (0.262, 0.0148), (0.272, 0.0134),
    ], segments=20)

    # ---- furniture -------------------------------------------------------
    handguard("Forend", shell, gun, 0.150, 0.248, 0.022, -0.026, 0.050,
              vents=4, vent_material=dark, top_rail=True, rail_material=steel)
    # folding vertical foregrip, the AUG's most recognisable front feature
    pistol_grip("VerticalGrip", dark, gun, 0.204, -0.030, 0.130, 0.016, 0.030,
                panels=False)

    # thumbhole trigger housing
    receiver("TriggerHousing", dark, gun, [
        (-0.020, 0.024, -0.058),
        (0.086, 0.020, -0.062),
        (0.104, -0.008, -0.074),
        (-0.014, -0.012, -0.068),
    ], 0.048, bevel=0.004)
    receiver("ThumbholeWeb", shell, gun, [
        (-0.070, 0.020, -0.056),
        (-0.020, 0.022, -0.058),
        (-0.020, -0.010, -0.066),
        (-0.070, -0.014, -0.062),
    ], 0.044, bevel=0.004)
    pistol_grip("PistolGrip", dark, gun, 0.062, -0.058, 0.146, 0.034, 0.032,
                panels=True, panel_material=shell)

    # ---- moving parts ----------------------------------------------------
    magazine = group("Magazine", gun)
    curved_magazine("MagazineBody", dark, magazine, -0.210, -0.110, -0.060,
                    0.204, 0.008, 0.034, stations=9, ribs=0, floor_material=shell)
    for index in range(6):
        tube("MagazineRib%d" % index,
             [(-0.196 + index * 0.018 - 0.004, 0.0175), (-0.196 + index * 0.018 + 0.004, 0.0175)],
             22, shell, magazine).rotation_euler = (0, 1.5707963, 0)

    bolt = group("BoltCarrier", gun)
    extrude_profile("BoltCarrier", [
        (-0.150, 0.020), (0.020, 0.024), (0.020, -0.006), (-0.150, -0.010),
    ], 0.028, steel, bolt, smooth=False, bevel=0.002)
    tube("ChargingHandle", [(-0.170, 0.0080), (-0.100, 0.0080)], 22, steel, bolt) \
        .rotation_euler = (0.85, 0, 0)

    trigger = group("Trigger", gun)
    trigger_group("TriggerAssembly", steel, trigger, 0.030, -0.058,
                  guard_material=dark, blade_material=steel)

    sight_front("FrontSight", dark, gun, 0.268, 0.026, 0.044, width=0.018,
                post_material=steel, wings=False)

    for position in ((0.176, -0.030), (-0.388, -0.048)):
        sling_loop("SlingLoop%d" % int(position[0] * 1000), steel, gun,
                   position[0], position[1], 0.011)

    anchor("ViewmodelAnchor", (0.0, 0.040, -0.030), root)
    anchor("Muzzle", (0.0, 0.428, 0.0), root)
    anchor("LeftHandIK", (0.0, 0.190, -0.070), root)
    anchor("RightHandIK", (0.0, 0.060, -0.070), root)
    anchor("MagazineAnchor", (0.0, -0.160, -0.070), magazine)
    return root
