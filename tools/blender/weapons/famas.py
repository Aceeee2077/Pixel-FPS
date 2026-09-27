"""FAMAS, authored from ``FAMAS.png``.

Bullpup layout: the action and magazine sit BEHIND the pistol grip and the
carry handle doubles as the sight bridge. Datum is the bore axis (``z = 0``)
with ``y = 0`` at the receiver's front face.

Reference calibration (FAMAS.png + recovered mask): overall 0.757 m bullpup,
receiver top to magazine floor 0.34 m, barrel protrudes only 0.30 m ahead of
the receiver face, and the magazine sits ~0.14 m behind the grip.
"""
from weapon_common import extrude_profile, group, rect_profile, tube, anchor
from weapon_parts import (curved_magazine, cylinder, handguard, muzzle_device,
                          pistol_grip, receiver, sight_front, sling_loop,
                          stepped_barrel, trigger_group)

WEAPON_ID = "famas"
DISPLAY = "FAMAS"
CATEGORY = "rifle"
TRIANGLE_HINT = 46000
HAS_REFERENCE = True

BORE = 0.0


def build(palette):
    root = group(WEAPON_ID + "_Root")
    gun = group("FAMAS", root)

    metal = palette["gunmetal"]
    dark = palette["polymer"]
    grey = palette["polymer_grey"]
    steel = palette["steel"]

    # ---- one-piece shell: barrel shroud, receiver and buttplate -----------
    receiver("Shell", dark, gun, [
        (-0.430, 0.052, -0.080),   # buttplate
        (-0.300, 0.056, -0.076),
        (-0.150, 0.050, -0.070),
        (0.000, 0.048, -0.062),    # receiver front
        (0.120, 0.036, -0.030),    # barrel shroud
        (0.230, 0.030, -0.014),
        (0.296, 0.026, -0.010),
    ], 0.062, bevel=0.006)

    # the FAMAS carry handle is a tall arch with the rear sight inside it
    receiver("CarryHandle", dark, gun, [
        (-0.180, 0.092, 0.050),
        (-0.060, 0.100, 0.052),
        (0.040, 0.104, 0.052),
        (0.096, 0.092, 0.048),
        (0.104, 0.062, 0.044),
    ], 0.030, bevel=0.004)
    receiver("HandleRearPost", dark, gun, [
        (-0.190, 0.096, 0.038),
        (-0.168, 0.100, 0.038),
        (-0.150, 0.052, 0.040),
    ], 0.030, bevel=0.003)
    receiver("HandleFrontPost", dark, gun, [
        (0.070, 0.100, 0.040),
        (0.092, 0.100, 0.040),
        (0.104, 0.044, 0.042),
    ], 0.030, bevel=0.003)

    # ---- barrel + grenade-launcher style muzzle --------------------------
    stepped_barrel("Barrel", metal, gun, [
        (0.010, 0.0115), (0.060, 0.0102), (0.150, 0.0086),
        (0.230, 0.0078), (0.296, 0.0070),
    ], segments=22)
    muzzle_device("MuzzleDevice", metal, gun, 0.300, 0.330, 0.0105,
                  ports=2, port_material=dark, flare=0.003)
    # the FAMAS flash hider is a slim slotted tube
    stepped_barrel("FlashHider", metal, gun, [
        (0.292, 0.0125), (0.324, 0.0120), (0.332, 0.0110),
    ], segments=20)

    # ---- furniture -------------------------------------------------------
    handguard("Handguard", grey, gun, 0.118, 0.232, 0.024, -0.028, 0.052,
              vents=4, vent_material=dark, top_rail=True, rail_material=steel)
    receiver("TriggerFrame", dark, gun, [
        (-0.030, 0.020, -0.062),
        (0.056, 0.016, -0.066),
        (0.070, -0.010, -0.078),
        (-0.024, -0.014, -0.072),
    ], 0.046, bevel=0.004)
    pistol_grip("PistolGrip", dark, gun, 0.038, -0.052, 0.150, 0.030, 0.034,
                panels=True, panel_material=grey)
    # MAGPUL-style foregrip ahead of the trigger
    pistol_grip("Foregrip", dark, gun, 0.170, -0.030, 0.116, 0.012, 0.030,
                panels=False)

    # ---- moving parts ----------------------------------------------------
    magazine = group("Magazine", gun)
    curved_magazine("MagazineBody", metal, magazine, -0.196, -0.104, -0.062,
                    0.196, 0.008, 0.032, stations=9, ribs=3,
                    floor_material=dark)
    extruded_mount = extrude_profile("MagWell", [
        (-0.210, -0.052), (-0.090, -0.052), (-0.090, -0.070), (-0.210, -0.070),
    ], 0.052, dark, gun, smooth=False, bevel=0.003)

    bolt = group("BoltCarrier", gun)
    extruded_mount = extrude_profile("BoltCarrier", [
        (-0.150, 0.006), (-0.010, 0.010), (-0.010, -0.020), (-0.150, -0.024),
    ], 0.026, steel, bolt, smooth=False, bevel=0.002)
    tube("ChargingHandle", [(-0.100, 0.0075), (-0.056, 0.0075)], 20, steel, bolt) \
        .rotation_euler = (0.9, 0, 0)

    trigger = group("Trigger", gun)
    trigger_group("TriggerAssembly", steel, trigger, 0.014, -0.058,
                  guard_material=dark, blade_material=steel)

    sight_rear_bit = extrude_profile("RearSight", [
        (-0.150, 0.098), (-0.106, 0.098), (-0.106, 0.078), (-0.150, 0.078),
    ], 0.024, dark, gun, smooth=False, bevel=0.002)
    sight_front("FrontSight", dark, gun, 0.086, 0.050, 0.056, width=0.020,
                post_material=steel)

    for position in ((0.116, -0.036), (-0.424, -0.052)):
        sling_loop("SlingLoop%d" % int(position[0] * 1000), steel, gun,
                   position[0], position[1], 0.011)
    for index in range(4):
        tube("ShellRivet%d" % index,
             [(-0.330 + index * 0.070 - 0.0025, 0.0045), (-0.330 + index * 0.070 + 0.0025, 0.0045)],
             12, steel, gun).rotation_euler = (0, 1.5707963, 0)

    anchor("ViewmodelAnchor", (0.0, 0.040, -0.030), root)
    anchor("Muzzle", (0.0, 0.334, 0.0), root)
    anchor("LeftHandIK", (0.0, 0.180, -0.070), root)
    anchor("RightHandIK", (0.0, 0.040, -0.070), root)
    anchor("MagazineAnchor", (0.0, -0.150, -0.070), magazine)
    return root
