"""Intratec TEC-9 pattern blowback pistol, authored from ``TEC-9.png``.

Clean-room recreation: the reference is used only for silhouette proportions
and colour zoning. Bore axis is ``z = 0`` and the frame datum is the FRONT FACE
OF THE TRIGGER GUARD at ``y = 0``, so the receiver/muzzle run into positive y
and the grip sits behind the guard in negative y. Every number below is a local
coordinate offset by ``FX``, which places the muzzle at ``y = 0.252``.

Reference calibration (vision report + recovered mask, muzzle to the right):
  241 mm overall, 1.112 length/height, a very boxy stamped receiver, a
  perforated sheet-metal barrel shroud running to a threaded muzzle with a
  barrel nut, a top-mounted charging handle, and a magazine that inserts
  through the grip.
"""
import math

from weapon_common import (anchor, box, extrude_profile, group, rect_profile,
                           slot_rail, sweep, tube)
from weapon_parts import (closed_body, cylinder, ejection_port, magazine_well,
                          pistol_grip, screw_row, sight_front, sight_rear,
                          stepped_barrel, trigger_group)

WEAPON_ID = "tec-9"
DISPLAY = "TEC-9"
CATEGORY = "pistol"
TRIANGLE_HINT = 30000

# --- master stations (metres, trigger-guard-front datum) ------------------
LAYOUT = {
    "muzzle": 0.252,
    "receiver_front": 0.207,
    "receiver_rear": 0.049,
    "receiver_top": 0.024,
    "receiver_bottom": -0.014,
    "shroud_front": 0.234,
    "frame_top": -0.034,
    "frame_bottom": -0.050,
    "frame_rear": -0.048,
    "guard_front": 0.000,
    "guard_bottom": -0.050,
    "grip_top": -0.036,
    "grip_bottom": -0.124,
    "mag_floor": -0.138,
}
FX = LAYOUT["muzzle"]


def build(palette):
    root = group(WEAPON_ID + "_Root")
    gun = group("TEC9", root)

    metal = palette["gunmetal"]
    slide_mat = palette["anodized"]
    frame_mat = palette["polymer"]
    steel = palette["steel"]
    bright = palette["bright"]

    def at(y):
        """Trigger-guard datum -> world y."""
        return y + FX

    # ---- boxy stamped upper receiver -------------------------------------
    slide = group("Slide", gun)
    extrude_profile("ReceiverBody", closed_body([
        (at(0.049), 0.0240, -0.0140),
        (at(0.056), 0.0245, -0.0145),
        (at(0.150), 0.0245, -0.0145),
        (at(0.196), 0.0238, -0.0140),
        (at(0.207), 0.0212, -0.0122),
    ]), 0.0390, slide_mat, slide, smooth=False, bevel=0.0022)
    # flat top cover with the TEC-9's squared-off sight rib
    extrude_profile("TopRib", rect_profile(at(0.052), at(0.202), 0.0240, 0.0286, chamfer=0.0022),
                    0.0240, metal, slide, smooth=False, bevel=0.0016)
    for index in range(6):
        y = at(0.070 + 0.0210 * index)
        extrude_profile("RibSlot%d" % index,
                        rect_profile(y - 0.0060, y + 0.0060, 0.0252, 0.0296, chamfer=0.0014),
                        0.0248, slide_mat, slide, smooth=False, bevel=0.0006)

    # rear cocking serrations on the receiver flanks
    for index in range(6):
        y = at(0.056 + 0.0058 * index)
        for side in (-1, 1):
            bar = extrude_profile("ReceiverSerration%d_%d" % (index, side),
                                  rect_profile(y + 0.0016, y + 0.0036, -0.0090, 0.0165),
                                  0.0018, metal, slide, smooth=False, bevel=0.0004)
            bar.location.x = side * 0.0196

    # ejection port on the right flank, plus a full-length bolt track
    ejection_port("EjectionPort", metal, slide, at(0.096), at(0.156), -0.0010, 0.0128, 0.0196)
    box("Extractor", (at(0.090), 0.0196, 0.0050), (0.0200, 0.0042, 0.0046), steel, slide, bevel=0.0006)
    box("BoltTrack", (at(0.150), -0.0196, 0.0040), (0.1100, 0.0026, 0.0050), steel, slide, bevel=0.0006)

    # top-mounted charging handle in its slot
    extrude_profile("ChargingSlot", rect_profile(at(0.062), at(0.176), 0.0286, 0.0310, chamfer=0.0040),
                    0.0090, slide_mat, slide, smooth=False)
    extrude_profile("ChargingHandle", [
        (at(0.062), 0.0288), (at(0.084), 0.0288), (at(0.081), 0.0382),
        (at(0.069), 0.0392), (at(0.059), 0.0334),
    ], 0.0130, steel, slide, smooth=False, bevel=0.0016)
    extrude_profile("ChargingHandleGrip", rect_profile(at(0.066), at(0.080), 0.0378, 0.0408, chamfer=0.0018),
                    0.0165, frame_mat, slide, smooth=False, bevel=0.0012)

    # ---- rear and front sights, mounted on the receiver rib --------------
    sight_rear("RearSight", metal, slide, at(0.046), 0.0286, 0.0080, width=0.0196,
               aperture_material=steel)
    sight_front("FrontSight", metal, slide, at(0.196), 0.0286, 0.0120, width=0.0092,
                post_material=bright, wings=True)

    # ---- perforated barrel shroud: a real sleeve with milled slots -------
    shroud_rear, shroud_front = at(0.190), at(0.234)
    shroud_mid = (shroud_rear + shroud_front) * 0.5
    shroud_span = shroud_front - shroud_rear
    tube("BarrelShroud", [(shroud_rear, 0.0148), (shroud_front, 0.0144)], 28,
         metal, gun, smooth=True)
    # Radial slot rows: each slot is authored around its own origin and then
    # rotated about the barrel axis (X), so the sleeve axis stays centred.
    for index in range(4):
        y = -shroud_span * 0.30 + 0.0098 * index
        for k in range(8):
            angle = math.pi * 2 * k / 8 + math.pi / 8
            slot = extrude_profile("ShroudSlot%d_%d" % (index, k),
                                   rect_profile(y - 0.0034, y + 0.0034, 0.0126, 0.0198, chamfer=0.0018),
                                   0.0050, slide_mat, gun, smooth=False)
            slot.rotation_euler = (angle, 0, 0)
            slot.location = (0.0, shroud_mid, 0.0)
    # longitudinal shroud ribs stiffen the sleeve and break up the silhouette
    for k in range(4):
        angle = math.pi / 2 * k + math.pi / 4
        rib = extrude_profile("ShroudRib%d" % k,
                              rect_profile(-shroud_span * 0.5 + 0.002, shroud_span * 0.5 - 0.002,
                                           0.0138, 0.0166),
                              0.0044, steel, gun, smooth=False)
        rib.rotation_euler = (angle, 0, 0)
        rib.location = (0.0, shroud_mid, 0.0)

    # barrel inside the shroud, then the threaded muzzle and barrel nut
    stepped_barrel("Barrel", steel, gun, [
        (at(0.160), 0.0104), (at(0.200), 0.0098), (at(0.236), 0.0092),
        (at(0.244), 0.0088),
    ], segments=22)
    cylinder("BarrelNut", slide_mat, gun, at(0.238), at(0.250), 0.0122, segments=22, bevel=0.0012)
    for index in range(3):
        y = at(0.240 + 0.0034 * index)
        cylinder("BarrelNutFlat%d" % index, bright, gun, y, y + 0.0012, 0.0128, segments=22)
    cylinder("MuzzleBore", bright, gun, at(0.252), at(0.2535), 0.0048, segments=20)

    # ---- lower receiver: trigger housing, guard and grip -----------------
    extrude_profile("LowerReceiver", closed_body([
        (at(-0.048), -0.0300, -0.0430),
        (at(-0.020), -0.0300, -0.0480),
        (at(0.040), -0.0300, -0.0500),
        (at(0.096), -0.0306, -0.0460),
        (at(0.150), -0.0320, -0.0360),
    ]), 0.0330, metal, gun, smooth=False, bevel=0.0024)
    # the TEC-9's tall magazine/takedown tower between receiver and grip
    extrude_profile("MagazineTower", closed_body([
        (at(-0.040), -0.0140, -0.0300),
        (at(0.010), -0.0140, -0.0300),
        (at(0.022), -0.0200, -0.0300),
    ]), 0.0350, slide_mat, gun, smooth=False, bevel=0.0020)

    extrude_profile("TriggerGuard", [
        (at(-0.034), -0.0300), (at(0.028), -0.0305), (at(0.032), -0.0490),
        (at(0.012), -0.0575), (at(-0.020), -0.0568), (at(-0.036), -0.0450),
    ], 0.0270, metal, gun, smooth=False, bevel=0.0022)
    extrude_profile("TriggerGuardWindow", [
        (at(-0.026), -0.0352), (at(0.020), -0.0356), (at(0.022), -0.0488),
        (at(0.010), -0.0528), (at(-0.018), -0.0522), (at(-0.028), -0.0420),
    ], 0.0292, palette["rubber"], gun, smooth=False)

    magazine_well("MagazineWell", metal, gun, at(-0.044), at(0.004),
                  -0.036, -0.052, 0.0340)
    slot_rail("AccessoryRail", at(0.108), at(0.148), -0.0308, 0.0250, 0.0048,
              metal, gun, pitch=0.0140, slot=0.0074, depth=0.0020)

    # selector, magazine catch and the stamped receiver rivets
    extrude_profile("FireSelector", [
        (at(-0.006), -0.0352), (at(0.022), -0.0344), (at(0.024), -0.0408),
        (at(-0.004), -0.0426),
    ], 0.0034, steel, gun, smooth=False, bevel=0.0006).location.x = -0.0182
    box("MagazineCatch", (at(-0.030), -0.0186, -0.0380), (0.0160, 0.0030, 0.0160), steel, gun, bevel=0.0010)
    box("TakeDownPin", (at(0.046), 0, -0.0350), (0.0075, 0.0360, 0.0068), bright, gun, bevel=0.0010)
    cylinder("ReceiverRivet", bright, gun, at(0.064), at(0.070), 0.0024, segments=18,
             z=-0.0360)
    cylinder("ReceiverRivet2", bright, gun, at(0.126), at(0.132), 0.0024, segments=18,
             z=-0.0360)
    cylinder("ReceiverRivet3", bright, gun, at(0.184), at(0.190), 0.0024, segments=18,
             z=-0.0360)

    # ---- grip -------------------------------------------------------------
    pistol_grip("PistolGrip", frame_mat, gun, at(-0.026), -0.036, 0.076, -0.010, 0.0300,
                panels=True, panel_material=palette["rubber"])
    for index in range(5):
        z = -0.048 - 0.0130 * index
        for side in (-1, 1):
            ridge = extrude_profile("GripRidge%d_%d" % (index, side),
                                    rect_profile(at(-0.048), at(-0.006), z, z + 0.0050, chamfer=0.0012),
                                    0.0020, palette["rubber"], gun, smooth=False, bevel=0.0004)
            ridge.location.x = side * 0.0152

    # ---- moving parts -----------------------------------------------------
    magazine = group("Magazine", gun)
    mag_centre = at(-0.026)
    sweep("MagazineBody",
          [(mag_centre, -0.042, 0.056), (mag_centre - 0.002, -0.082, 0.056),
           (mag_centre - 0.004, -0.120, 0.056)],
          0.0230, slide_mat, magazine, bevel=0.0022)
    box("MagazineFloorPlate", (mag_centre - 0.006, 0, -0.1425), (0.0660, 0.0340, 0.0175),
        frame_mat, magazine, bevel=0.0024)

    trigger = group("Trigger", gun)
    trigger_group("TriggerBlade", steel, trigger, at(-0.010), -0.0300,
                  guard=False, width=0.0090)

    # ---- anchors ----------------------------------------------------------
    anchor("ViewmodelAnchor", (0.0, at(-0.078), -0.036), root)
    anchor("Muzzle", (0.0, at(0.254), 0.0), root)
    anchor("LeftHandIK", (0.0, at(-0.028), -0.052), root)
    anchor("RightHandIK", (0.0, at(-0.080), -0.070), root)
    anchor("MagazineAnchor", (0.0, mag_centre, -0.086), magazine)
    return root
