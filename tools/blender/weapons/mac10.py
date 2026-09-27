"""Ingram MAC-10 machine pistol, authored from ``MAC-10.png``.

Clean-room recreation: the reference is used only for silhouette proportions
and colour zoning. Datum is the bore axis (``z = 0``) with ``y = 0`` at the
receiver front face, so every number below reads directly off the reference.

Reference calibration (vision report + recovered mask, muzzle to the right):
  0.269 m overall with the wire stock collapsed and 0.264 m from the top of
  the stock yoke to the magazine floor, i.e. length/height 0.98 -- the only
  weapon here that is as tall as it is long. Square-fronted stamped box
  receiver, prominent perforated barrel shroud, 30-round magazine through the
  grip, top-mounted cocking handle and a side selector.
"""
import math

from weapon_common import (anchor, box, extrude_profile, group, rect_profile,
                           sweep, tube)
from weapon_parts import (closed_body, curved_magazine, ejection_port,
                          muzzle_device, sight_front, sight_rear, sling_loop,
                          stepped_barrel)

WEAPON_ID = "mac-10"
DISPLAY = "MAC-10"
CATEGORY = "smg"
TRIANGLE_HINT = 40000

# --- master stations (metres, bore datum) ---------------------------------
RECEIVER_REAR = -0.104
RECEIVER_FRONT = 0.040
RECEIVER_TOP = 0.030
RECEIVER_BOTTOM = -0.036
RECEIVER_WIDTH = 0.044
BARREL_FRONT = 0.150
MUZZLE_TIP = 0.165
SHROUD_RADIUS = 0.0208
GRIP_FRONT = 0.006
GRIP_REAR = -0.058
GRIP_TOP = -0.028
GRIP_BOTTOM = -0.140
MAG_CENTRE = -0.026
STOCK_TOP = 0.052


def build(palette):
    root = group(WEAPON_ID + "_Root")
    gun = group("MAC10", root)

    stamped = palette["phosphate"]
    metal = palette["anodized"]
    bore_metal = palette["gunmetal"]
    steel = palette["steel"]
    polymer = palette["polymer"]

    # ---- stamped box receiver with its square front face ------------------
    extrude_profile("Receiver", closed_body([
        (RECEIVER_REAR, 0.024, -0.028),
        (-0.096, 0.029, -0.034),
        (-0.060, RECEIVER_TOP, RECEIVER_BOTTOM),
        (0.010, RECEIVER_TOP, RECEIVER_BOTTOM),
        (0.032, 0.029, -0.034),
        (RECEIVER_FRONT, 0.026, -0.030),
    ]), RECEIVER_WIDTH, stamped, gun, bevel=0.004, bevel_segments=4)
    box("ReceiverFrontPlate", (RECEIVER_FRONT + 0.004, 0, -0.004),
        (0.012, RECEIVER_WIDTH * 1.06, 0.062), metal, gun, bevel=0.003)
    box("ReceiverRearPlate", (RECEIVER_REAR - 0.003, 0, -0.004),
        (0.010, RECEIVER_WIDTH * 1.04, 0.056), metal, gun, bevel=0.003)
    # welded seam ribs that give the stamping its hard edges
    for side in (-1, 1):
        box("ReceiverWeldSeam%d" % side, (-0.034, side * (RECEIVER_WIDTH / 2 - 0.001), -0.020),
            (0.130, 0.004, 0.006), steel, gun, bevel=0.001)
        box("ReceiverSideRib%d" % side, (-0.034, side * (RECEIVER_WIDTH / 2 - 0.001), 0.014),
            (0.126, 0.004, 0.005), steel, gun, bevel=0.001)
    # top cocking slot (the handle itself lives in the Bolt group)
    box("CockingSlot", (-0.026, 0, RECEIVER_TOP + 0.006), (0.132, 0.013, 0.014),
        metal, gun, bevel=0.002)
    for index in range(7):
        box("CockingSlotTooth%d" % index, (-0.084 + index * 0.019, 0, RECEIVER_TOP + 0.013),
            (0.004, 0.013, 0.005), steel, gun, bevel=0.0008)

    # ---- very short barrel inside a prominent perforated shroud ----------
    stepped_barrel("Barrel", bore_metal, gun, [
        (0.030, 0.0118), (0.062, 0.0106), (0.096, 0.0098), (0.128, 0.0092),
        (BARREL_FRONT, 0.0088),
    ], segments=22)
    stepped_barrel("BarrelShroud", metal, gun, [
        (0.046, SHROUD_RADIUS * 0.94), (0.056, SHROUD_RADIUS), (0.118, SHROUD_RADIUS * 0.98),
        (0.132, SHROUD_RADIUS * 0.82),
    ], segments=22)
    for index in range(4):
        y = 0.060 + index * 0.0195
        for step in range(10):
            angle = math.pi * 2 * step / 10 + math.pi / 10 + index * 0.16
            hole = tube("ShroudHole%d_%d" % (index, step),
                        [(0.0, 0.0032), (0.0075, 0.0032)], 18, bore_metal, gun)
            hole.rotation_euler = (angle, 0, -math.pi / 2)
            hole.location = (math.cos(angle) * 0.0145, y, math.sin(angle) * 0.0145)
    for index in range(3):
        y = 0.056 + index * 0.026
        tube("ShroudCollar%d" % index, [(y, SHROUD_RADIUS * 1.03), (y + 0.004, SHROUD_RADIUS * 1.03)],
             48, steel, gun).location.z = 0.0
    muzzle_device("MuzzleCollar", metal, gun, BARREL_FRONT - 0.006, MUZZLE_TIP,
                  0.0098, ports=2, port_material=steel)
    tube("MuzzleThread", [(BARREL_FRONT - 0.002, 0.0084), (BARREL_FRONT + 0.006, 0.0084)],
         32, steel, gun).location.z = 0.0
    tube("MuzzleCrown", [(MUZZLE_TIP - 0.005, 0.0072), (MUZZLE_TIP + 0.001, 0.0070)],
         28, steel, gun)

    # ---- grip / magazine housing, one machined block ---------------------
    extrude_profile("GripHousing", closed_body([
        (GRIP_REAR, -0.026, -0.132),
        (GRIP_REAR + 0.008, GRIP_TOP, GRIP_BOTTOM),
        (GRIP_FRONT - 0.006, GRIP_TOP, GRIP_BOTTOM + 0.004),
        (GRIP_FRONT, -0.026, -0.126),
    ]), 0.042, stamped, gun, bevel=0.004, bevel_segments=4)
    box("GripHousingBrace", (-0.026, 0, -0.034), (0.056, 0.048, 0.014), metal, gun,
        bevel=0.002)
    for index in range(11):
        z = GRIP_TOP - 0.011 - index * 0.0104
        box("GripBand%d" % index, (-0.026, 0, z), (0.049, 0.0405, 0.0048), polymer, gun,
            bevel=0.0012)
    for side in (-1, 1):
        box("GripPlate%d" % side, (-0.028, side * 0.022, -0.082), (0.044, 0.006, 0.100),
            polymer, gun, bevel=0.0025)
    sweep("GripFrontStrap", [
        (0.004, -0.032, 0.014), (0.009, -0.056, 0.013), (0.011, -0.082, 0.013),
        (0.008, -0.110, 0.013), (0.002, -0.134, 0.014),
    ], 0.0098, polymer, gun, bevel=0.002)
    box("GripButt", (-0.026, 0, GRIP_BOTTOM - 0.002), (0.056, 0.048, 0.014),
        metal, gun, bevel=0.002)
    for index in range(7):
        z = GRIP_TOP - 0.018 - index * 0.0155
        box("GripSerration%d" % index, (0.011, 0, z), (0.0055, 0.0442, 0.009),
            polymer, gun, bevel=0.001)
    for side in (-1, 1):
        box("GripSideRib%d" % side, (-0.026, side * 0.0235, -0.084),
            (0.016, 0.006, 0.104), metal, gun, bevel=0.0015)

    # ---- moving parts (kept separate for reload / fire animation) ---------
    magazine = group("Magazine", gun)
    curved_magazine("MagazineBody", stamped, magazine, MAG_CENTRE - 0.015,
                    MAG_CENTRE + 0.015, GRIP_TOP + 0.002, 0.156, 0.0, 0.026,
                    stations=12, ribs=3, floor_material=metal)
    for index in range(9):
        z = -0.056 - index * 0.017
        for side in (-1, 1):
            box("MagazineWitness%d_%d" % (index, side), (MAG_CENTRE, side * 0.0125, z),
                (0.022, 0.0035, 0.009), steel, magazine, bevel=0.001)
    for index in range(4):
        box("MagazineFloorRib%d" % index, (MAG_CENTRE, 0, -0.170 - index * 0.010),
            (0.028, 0.028, 0.005), metal, magazine, bevel=0.001)
    box("MagazineRelease", (-0.062, 0.020, -0.048), (0.016, 0.010, 0.016), steel, gun,
        bevel=0.0015)

    bolt = group("Bolt", gun)
    box("BoltBody", (-0.010, 0, 0.008), (0.100, 0.026, 0.028), steel, bolt, bevel=0.002)
    for index in range(4):
        box("BoltLug%d" % index, (0.026 - index * 0.014, 0, 0.024),
            (0.006, 0.030, 0.008), steel, bolt, bevel=0.0009)
    box("CockingHandleKnob", (-0.062, 0, RECEIVER_TOP + 0.022), (0.026, 0.020, 0.016),
        steel, bolt, bevel=0.002)
    knob = tube("CockingHandleGrip", [(-0.072, 0.0105), (-0.050, 0.0105)], 26,
                steel, bolt)
    knob.location.z = RECEIVER_TOP + 0.030
    for index in range(5):
        box("CockingHandleTooth%d" % index, (-0.070 + index * 0.009, 0, RECEIVER_TOP + 0.030),
            (0.004, 0.024, 0.020), steel, bolt, bevel=0.001)

    trigger = group("Trigger", gun)
    extrude_profile("TriggerBlade", rect_profile(0.018, 0.028, -0.062, -0.034, chamfer=0.003),
                    0.013, steel, trigger, smooth=True, bevel=0.0015)
    sweep("TriggerGuard", [
        (0.042, -0.036, 0.011), (0.046, -0.050, 0.010), (0.040, -0.062, 0.009),
        (0.026, -0.068, 0.008), (0.010, -0.068, 0.008), (0.000, -0.062, 0.009),
        (-0.004, -0.050, 0.010), (-0.002, -0.040, 0.011),
    ], 0.0060, stamped, trigger, bevel=0.0015)

    # ---- sliding wire stock, collapsed over the receiver top --------------
    stock = group("Stock", gun)
    for side in (-1, 1):
        box("StockYoke%d" % side, (-0.066, side * 0.014, STOCK_TOP - 0.004),
            (0.062, 0.006, 0.006), steel, stock, bevel=0.0012)
        rod = tube("StockRod%d" % side, [(-0.024, 0.0052), (0.006, 0.0052)], 20,
                   steel, stock)
        rod.rotation_euler = (0, 0, math.pi / 2)
        rod.location = (side * 0.011, -0.046, STOCK_TOP - 0.004)
        box("StockGuide%d" % side, (-0.016, side * 0.014, STOCK_TOP - 0.010),
            (0.020, 0.012, 0.016), metal, stock, bevel=0.002)
    box("StockShoulder", (-0.098, 0, STOCK_TOP - 0.026),
        (0.010, 0.052, 0.048), steel, stock, bevel=0.004)
    box("StockShoulderPad", (-0.101, 0, STOCK_TOP - 0.026),
        (0.006, 0.048, 0.044), palette["rubber"], stock, bevel=0.003)
    box("StockLatch", (-0.040, 0, STOCK_TOP + 0.002), (0.032, 0.030, 0.010), metal, stock,
        bevel=0.002)

    # ---- sights and small controls ---------------------------------------
    sight_rear("RearSight", metal, gun, RECEIVER_REAR + 0.012, RECEIVER_TOP + 0.014,
               0.014, width=0.026, drum=True, aperture_material=steel)
    sight_front("FrontSight", metal, gun, 0.030, RECEIVER_TOP + 0.014, 0.014,
                width=0.018, post_material=steel)
    for side in (-1, 1):
        box("SelectorLever%d" % side, (-0.078, side * 0.026, -0.014), (0.026, 0.010, 0.010),
            steel, gun, bevel=0.0015)
        dial = tube("SelectorHub%d" % side, [(0.0, 0.0080), (0.006, 0.0080)], 20,
                    steel, gun)
        dial.rotation_euler = (0, 0, math.pi / 2)
        dial.location = (side * 0.023, -0.078, -0.014)
    ejection_port("EjectionPort", metal, gun, -0.030, 0.006, -0.006, 0.018, 0.0215,
                  depth=0.006)
    for index in range(9):
        y = -0.096 + index * 0.017
        for side in (-1, 1):
            spot = tube("SpotWeld%d_%d" % (index, side), [(-0.004, 0.0032), (0.004, 0.0032)],
                        18, steel, gun)
            spot.rotation_euler = (0, 0, math.pi / 2)
            spot.location = (side * (RECEIVER_WIDTH / 2 - 0.001), y, -0.030)
            weld = tube("SpotWeldTop%d_%d" % (index, side),
                        [(-0.004, 0.0030), (0.004, 0.0030)], 18, steel, gun)
            weld.rotation_euler = (0, 0, math.pi / 2)
            weld.location = (side * (RECEIVER_WIDTH / 2 - 0.001), y, 0.026)
    sling_loop("SlingLoopRear", metal, gun, RECEIVER_REAR + 0.003, -0.030, 0.011)
    sling_loop("SlingLoopFront", metal, gun, 0.030, -0.032, 0.009)
    box("StrapHanger", (RECEIVER_REAR - 0.008, 0.024, 0.004), (0.006, 0.010, 0.030),
        metal, gun, bevel=0.0015)

    anchor("ViewmodelAnchor", (0.0, 0.030, -0.014), root)
    anchor("Muzzle", (0.0, MUZZLE_TIP + 0.004, 0.0), root)
    anchor("LeftHandIK", (0.0, 0.096, -0.034), root)
    anchor("RightHandIK", (0.0, -0.026, -0.040), root)
    anchor("MagazineAnchor", (0.0, MAG_CENTRE, -0.040), magazine)
    return root
