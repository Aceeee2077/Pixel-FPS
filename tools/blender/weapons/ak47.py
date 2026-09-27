"""AK-47 / AKM pattern rifle, authored from ``AK-47.png``.

Clean-room recreation: the reference is used only for silhouette proportions
and colour zoning. Datum is the bore axis (``z = 0``) with ``y = 0`` at the
receiver front face, so every number below reads directly off the reference.

Reference calibration (vision report + recovered mask, muzzle to the right):
  full length 0.895 m, receiver top to magazine floor 0.375 m, stock drop
  0.09 m, 30-round banana magazine with a 0.075 m forward sweep, wood
  furniture on a stamped black receiver.
"""
from weapon_common import (anchor, arc_profile, box, extrude_profile, group,
                           rect_profile, tube, sweep)
from weapon_parts import (bolt_handle, charging_handle, curved_magazine,
                          cylinder, handguard, muzzle_device, pistol_grip,
                          receiver, sight_front, sight_rear, sling_loop,
                          stepped_barrel, trigger_group)

WEAPON_ID = "ak-47"
DISPLAY = "AK-47"
CATEGORY = "rifle"
TRIANGLE_HINT = 52000

# --- master stations (metres, bore datum) ---------------------------------
RECEIVER_FRONT = 0.280
RECEIVER_REAR = -0.055
RECEIVER_TOP = 0.048
RECEIVER_BOTTOM = -0.036
RECEIVER_WIDTH = 0.044
BARREL_FRONT = 0.452
MUZZLE_TIP = 0.510
BUTT_REAR = -0.385
SIGHT_HEIGHT = 0.062


def build(palette):
    root = group(WEAPON_ID + "_Root")
    gun = group("AK47", root)

    metal = palette["gunmetal"]
    cover = palette["anodized"]
    wood = palette["wood"]
    wood_dark = palette["wood_dark"]
    steel = palette["steel"]

    # ---- receiver: stamped lower + dust cover + rear sight block ----------
    receiver("Receiver", cover, gun, [
        (-0.050, 0.040, -0.030),
        (0.010, 0.044, -0.036),
        (0.090, 0.046, -0.036),
        (0.170, 0.046, -0.036),
        (0.240, 0.044, -0.034),
        (0.280, 0.038, -0.032),
    ], RECEIVER_WIDTH, bevel=0.0025)

    receiver("DustCover", metal, gun, [
        (-0.048, RECEIVER_TOP - 0.004, 0.020),
        (0.010, RECEIVER_TOP + 0.004, 0.022),
        (0.120, RECEIVER_TOP + 0.006, 0.022),
        (0.215, RECEIVER_TOP + 0.001, 0.020),
        (0.268, RECEIVER_TOP - 0.008, 0.012),
    ], RECEIVER_WIDTH * 1.03, bevel=0.0025)

    # rear sight block sits on the trunnion, in front of the dust cover
    receiver("RearSightBlock", cover, gun, [
        (-0.075, 0.052, -0.010),
        (-0.058, 0.058, -0.012),
        (-0.030, 0.056, -0.012),
        (-0.018, 0.040, 0.000),
    ], RECEIVER_WIDTH * 1.12, bevel=0.002)

    # magazine well / front trunnion reinforces the receiver front
    receiver("FrontTrunnion", cover, gun, [
        (0.236, 0.044, -0.034),
        (0.262, 0.046, -0.036),
        (0.288, 0.044, -0.034),
    ], RECEIVER_WIDTH * 1.06, bevel=0.002)

    # ---- barrel and gas system -------------------------------------------
    stepped_barrel("Barrel", metal, gun, [
        (0.276, 0.0125), (0.300, 0.0118), (0.360, 0.0092),
        (0.386, 0.0088), (0.440, 0.0078), (BARREL_FRONT, 0.0072),
    ], segments=20)

    stepped_barrel("GasBlock", metal, gun, [
        (0.352, 0.0155), (0.360, 0.0165), (0.384, 0.0165), (0.392, 0.0150),
    ], segments=16)
    # gas block shoulder rises to meet the gas tube, as on the AKM
    box("GasBlockShoulder", (0.372, 0, 0.020), (0.040, 0.030, 0.030), metal, gun, bevel=0.002)

    stepped_barrel("GasTube", steel, gun, [
        (0.196, 0.0092), (0.352, 0.0088),
    ], segments=14)
    tube("GasTubeRib", [(0.200, 0.0104), (0.348, 0.0100)], 14, metal, gun).location.z = 0.021

    # cleaning rod under the barrel
    stepped_barrel("CleaningRod", steel, gun, [
        (0.300, 0.0032), (BARREL_FRONT + 0.010, 0.0030),
    ], segments=10)

    sight_front("FrontSight", metal, gun, 0.400, 0.004, SIGHT_HEIGHT,
                width=0.024, post_material=steel)

    muzzle_device("MuzzleBrake", metal, gun, MUZZLE_TIP - 0.052, MUZZLE_TIP,
                  0.0135, ports=2, port_material=palette["anodized"], flare=0.004)

    # ---- furniture --------------------------------------------------------
    handguard("LowerHandguard", wood, gun, 0.278, 0.368, 0.014, -0.030, 0.052,
              slots=4, slot_material=wood_dark, cap=(0.272, 0.282, -0.032, 0.016),
              cap_material=metal)
    handguard("UpperHandguard", wood, gun, 0.276, 0.356, 0.044, 0.016, 0.044,
              slots=5, slot_material=wood_dark, cap=(0.270, 0.280, 0.014, 0.046),
              cap_material=metal)

    receiver("RetainerRing", metal, gun, [
        (0.262, 0.020, -0.034),
        (0.278, 0.024, -0.036),
        (0.292, 0.020, -0.034),
    ], 0.056, bevel=0.002)

    # buttstock with the AK's characteristic drop
    stock = extrude_profile("Stock", [
        (-0.030, 0.019), (-0.120, 0.010), (-0.240, -0.012), (-0.352, -0.036),
        (-0.385, -0.042), (-0.385, -0.076), (-0.330, -0.074), (-0.240, -0.070),
        (-0.140, -0.062), (-0.030, -0.058),
    ], 0.040, wood, gun, smooth=False, bevel=0.006)
    extrude_profile("ButtPlate", [
        (-0.380, -0.028), (-0.396, -0.034), (-0.396, -0.084), (-0.380, -0.078),
    ], 0.044, palette["rubber"], gun, smooth=False, bevel=0.004)
    extrude_profile("StockTangs", [
        (-0.045, 0.014), (-0.320, -0.034), (-0.320, -0.052), (-0.045, -0.052),
    ], 0.012, metal, gun, smooth=False, bevel=0.002)

    pistol_grip("PistolGrip", wood, gun, 0.072, -0.034, 0.168, 0.052, 0.036,
                panels=True, panel_material=wood_dark)

    # ---- moving parts (kept separate for reload / fire animation) ---------
    magazine = group("Magazine", gun)
    curved_magazine("MagazineBody", metal, magazine, 0.070, 0.190, -0.030,
                    0.212, 0.078, 0.036, stations=9, ribs=3,
                    floor_material=palette["anodized"])
    box("MagazineCatch", (0.062, 0, -0.038), (0.020, 0.036, 0.012), metal, magazine, bevel=0.002)

    bolt = group("BoltCarrier", gun)
    box("BoltCarrierBody", (0.170, 0, 0.024), (0.190, 0.026, 0.026), steel, bolt, bevel=0.003)
    charging_handle("ChargingHandle", steel, bolt, 0.150, 0.030, 0.09, width=0.030)

    trigger = group("Trigger", gun)
    trigger_group("TriggerAssembly", steel, trigger, 0.128, -0.030,
                  guard_material=metal, blade_material=steel)

    safety = group("SafetyLever", gun)
    extrude_profile("SafetyLever", [
        (0.030, 0.010), (0.150, 0.004), (0.168, -0.016), (0.140, -0.020),
        (0.032, -0.012),
    ], 0.008, steel, safety, smooth=False, bevel=0.0015)
    safety.children[0].location.x = 0.024

    box("RearSightLeaf", (0.126, 0, RECEIVER_TOP + 0.010), (0.070, 0.030, 0.012), metal, gun, bevel=0.002)
    sight_rear("RearSight", metal, gun, 0.126, RECEIVER_TOP + 0.012, 0.022,
               width=0.026, aperture_material=palette["anodized"])

    for position in ((-0.058, -0.006), (0.286, -0.006)):
        sling_loop("SlingLoop%d" % int(position[0] * 1000), metal, gun, position[0], position[1], 0.012)

    box("Selector", (0.150, 0, -0.014), (0.090, 0.046, 0.010), steel, gun, bevel=0.0015)
    for index in range(4):
        y = 0.020 + index * 0.062
        rivet = tube("ReceiverRivet%d" % index, [(y - 0.003, 0.0055), (y + 0.003, 0.0055)], 10,
                     steel, gun)
        rivet.rotation_euler = (0, 1.5707963, 0)

    anchor("ViewmodelAnchor", (0.0, 0.060, -0.010), root)
    anchor("Muzzle", (0.0, MUZZLE_TIP + 0.004, 0.0), root)
    anchor("LeftHandIK", (0.0, 0.330, -0.040), root)
    anchor("RightHandIK", (0.0, 0.062, -0.030), root)
    anchor("MagazineAnchor", (0.0, 0.130, -0.040), magazine)
    return root
