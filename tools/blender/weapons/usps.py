"""USP-S pattern pistol with its long service suppressor, authored from ``usp.png``.

Clean-room recreation: the reference is used only for silhouette proportions
and colour zoning. Bore axis is ``z = 0`` and the frame datum is the FRONT FACE
OF THE TRIGGER GUARD at ``y = 0``, so the slide runs into positive y and the
grip sits behind the guard in negative y. Every number below is a local
coordinate offset by ``FX``, placing the suppressor muzzle at ``y = 0.330``.

Reference calibration (vision report + recovered mask, muzzle to the right):
  pistol 218 mm with a ~120 mm service suppressor fitted, 1.338
  length/height, squared one-piece slide, bobbed (spurless) hammer, railed
  dust cover, 12-round magazine and the HK-pattern blocky grip.
"""
from weapon_common import (anchor, box, extrude_profile, group, rect_profile,
                           slot_rail, sweep)
from weapon_parts import (closed_body, cylinder, ejection_port, magazine_well,
                          pistol_grip, screw_row, sight_front, sight_rear,
                          stepped_barrel, suppressor, trigger_group)

WEAPON_ID = "usp-s"
DISPLAY = "USP-S"
CATEGORY = "pistol"
TRIANGLE_HINT = 26000

# --- master stations (metres, trigger-guard-front datum) ------------------
LAYOUT = {
    "muzzle": 0.330,          # suppressor bore exit; frame datum offset
    "slide_front": 0.196,
    "slide_rear": 0.022,
    "slide_top": 0.014,
    "slide_bottom": -0.016,
    "frame_front": 0.184,
    "frame_rear": -0.016,
    "guard_front": 0.000,
    "guard_bottom": -0.050,
    "grip_top": -0.028,
    "grip_bottom": -0.120,
    "can_rear": 0.170,
    "can_front": 0.330,
    "can_radius": 0.0190,
    "can_over_barrel": 0.088,
}
FX = LAYOUT["muzzle"]


def build(palette):
    root = group(WEAPON_ID + "_Root")
    gun = group("USP", root)

    steel = palette["steel"]
    metal = palette["gunmetal"]
    slide_mat = palette["anodized"]
    frame_mat = palette["polymer_fde"]
    bright = palette["bright"]
    grip_mat = palette["polymer"]

    def at(y):
        """Trigger-guard datum -> world y."""
        return y + FX

    # ---- slide: squared USP block with a slim front -----------------------
    slide = group("Slide", gun)
    extrude_profile("SlideBody", closed_body([
        (at(0.022), 0.0110, -0.0155),
        (at(0.030), 0.0140, -0.0160),
        (at(0.070), 0.0140, -0.0160),
        (at(0.120), 0.0131, -0.0155),
        (at(0.168), 0.0124, -0.0148),
        (at(0.190), 0.0120, -0.0144),
        (at(0.196), 0.0104, -0.0128),
    ]), 0.0280, slide_mat, slide, smooth=False, bevel=0.0024)

    # rear cocking serrations, plus a short forward set on the slide nose
    for index in range(10):
        y = at(0.022 + 0.0048 * index)
        for side in (-1, 1):
            bar = extrude_profile("SlideSerrationRear%d_%d" % (index, side),
                                  rect_profile(y + 0.0016, y + 0.0034, -0.0105, 0.0105),
                                  0.0016, metal, slide, smooth=False, bevel=0.0004)
            bar.location.x = side * 0.0141
    for index in range(6):
        y = at(0.164 + 0.0048 * index)
        for side in (-1, 1):
            bar = extrude_profile("SlideSerrationFront%d_%d" % (index, side),
                                  rect_profile(y + 0.0016, y + 0.0034, -0.0102, 0.0102),
                                  0.0016, metal, slide, smooth=False, bevel=0.0004)
            bar.location.x = side * 0.0139

    ejection_port("EjectionPort", metal, slide, at(0.072), at(0.126), 0.0020, 0.0122, 0.0141)
    box("Extractor", (at(0.068), 0.0141, 0.0072), (0.0170, 0.0042, 0.0044), steel, slide, bevel=0.0006)
    box("RearBreechBlock", (at(0.024), 0, 0.0010), (0.0055, 0.0200, 0.0180), metal, slide, bevel=0.0008)
    box("SlideRailBlock", (at(0.024), 0, -0.0152), (0.0260, 0.0260, 0.0035), steel, slide, bevel=0.0006)

    # ---- sights ----------------------------------------------------------
    sight_rear("RearSight", metal, slide, at(0.036), 0.0140, 0.0096, width=0.0196,
               aperture_material=steel)
    box("RearSightLeaf", (at(0.039), 0, 0.0242), (0.0062, 0.0212, 0.0030), steel, slide, bevel=0.0006)
    sight_front("FrontSight", metal, slide, at(0.182), 0.0136, 0.0074, width=0.0080,
                post_material=bright, wings=False)

    # ---- threaded barrel, fixed barrel nut block and the S suppressor -----
    stepped_barrel("ThreadedBarrel", steel, gun, [
        (at(0.020), 0.0102), (at(0.080), 0.0096), (at(0.150), 0.0088),
        (at(0.200), 0.0080), (at(0.235), 0.0076),
    ], segments=22)
    cylinder("BarrelNut", metal, gun, at(0.176), at(0.188), 0.0116, segments=22, bevel=0.0010)
    suppressor("Suppressor", metal, gun, at(0.235), at(0.330), LAYOUT["can_radius"],
               collar=0.012, rings=3, ring_material=steel, end_cap=0.006)
    # the can's rear collar tube runs back over the barrel toward the slide
    cylinder("SuppressorRearTube", metal, gun, at(0.170), at(0.236), 0.0128,
             segments=22, bevel=0.0010)
    cylinder("MuzzleRing", bright, gun, at(0.330), at(0.3315), 0.0072, segments=22)

    # ---- polymer frame with an HK rail block ------------------------------
    extrude_profile("Frame", closed_body([
        (at(-0.016), -0.0220, -0.0410),
        (at(0.004), -0.0195, -0.0435),
        (at(0.036), -0.0195, -0.0460),
        (at(0.078), -0.0200, -0.0480),
        (at(0.130), -0.0210, -0.0430),
        (at(0.184), -0.0220, -0.0380),
    ]), 0.0300, frame_mat, gun, smooth=False, bevel=0.0028)

    extrude_profile("TriggerGuard", [
        (at(-0.032), -0.0220), (at(0.020), -0.0225), (at(0.024), -0.0430),
        (at(0.012), -0.0505), (at(-0.016), -0.0500), (at(-0.034), -0.0390),
    ], 0.0240, frame_mat, gun, smooth=False, bevel=0.0022)
    extrude_profile("TriggerGuardWindow", [
        (at(-0.026), -0.0262), (at(0.012), -0.0266), (at(0.014), -0.0420),
        (at(0.004), -0.0460), (at(-0.016), -0.0456), (at(-0.028), -0.0370),
    ], 0.0265, grip_mat, gun, smooth=False)

    slot_rail("AccessoryRail", at(0.152), at(0.186), -0.0215, 0.0210, 0.0054,
              frame_mat, gun, pitch=0.0142, slot=0.0074, depth=0.0022)
    magazine_well("MagazineWell", frame_mat, gun, at(-0.052), at(-0.004),
                  -0.032, -0.0470, 0.0296)

    # frame pins, slide stop and the reversible magazine release
    cylinder("FramePin", bright, gun, at(-0.004), at(0.002), 0.0024, segments=18)
    cylinder("TriggerPin", bright, gun, at(0.038), at(0.044), 0.0022, segments=18)
    cylinder("HammerPin", bright, gun, at(0.000), at(0.006), 0.0022, segments=18,
             z=-0.0130)
    cylinder("TakeDownPin", bright, gun, at(0.090), at(0.096), 0.0026, segments=18)
    box("SlideStopLever", (at(0.028), 0.0158, -0.0182), (0.0340, 0.0028, 0.0052), steel, gun, bevel=0.0006)
    box("MagazineCatch", (at(-0.002), -0.0160, -0.0330), (0.0120, 0.0026, 0.0130), steel, gun, bevel=0.0008)
    box("ControlLever", (at(-0.010), 0, -0.0225), (0.0200, 0.0330, 0.0050), steel, gun, bevel=0.0008)

    # ---- grip and backstrap ----------------------------------------------
    pistol_grip("PistolGrip", frame_mat, gun, at(-0.032), -0.032, 0.081, -0.014, 0.0296,
                panels=True, panel_material=grip_mat)
    box("Backstrap", (at(-0.044), 0, -0.0680), (0.0165, 0.0298, 0.0540), grip_mat, gun, bevel=0.0032)
    for index in range(5):
        z = -0.046 - 0.0125 * index
        for side in (-1, 1):
            ridge = extrude_profile("GripRidge%d_%d" % (index, side),
                                    rect_profile(at(-0.052), at(-0.012), z, z + 0.0048, chamfer=0.0012),
                                    0.0018, grip_mat, gun, smooth=False, bevel=0.0004)
            ridge.location.x = side * 0.0152

    # ---- moving parts ----------------------------------------------------
    magazine = group("Magazine", gun)
    mag_centre = at(-0.036)
    sweep("MagazineBody",
          [(mag_centre, -0.034, 0.056), (mag_centre + 0.002, -0.066, 0.056),
           (mag_centre + 0.004, -0.098, 0.056)],
          0.0225, slide_mat, magazine, bevel=0.0022)
    box("MagazineFloorPlate", (mag_centre + 0.008, 0, -0.1215), (0.0630, 0.0330, 0.0170),
        frame_mat, magazine, bevel=0.0024)
    for index, z in enumerate((-0.050, -0.074, -0.098)):
        for side in (-1, 1):
            witness = extrude_profile("MagazineWitness%d_%d" % (index, side),
                                      rect_profile(mag_centre - 0.022, mag_centre + 0.022, z, z + 0.0075),
                                      0.0008, bright, magazine, smooth=False)
            witness.location.x = side * 0.0114
    for index in range(3):
        y = at(0.196 + 0.0060 * index)
        cylinder("SuppressorCollarRing%d" % index, steel, gun, y, y + 0.0022, 0.0136,
                 segments=22, bevel=0.0008)

    trigger = group("Trigger", gun)
    trigger_group("TriggerBlade", steel, trigger, at(-0.016), -0.0225,
                  guard=False, width=0.0092)

    # bobbed USP hammer: a rounded spur, not a full ring
    hammer = group("Hammer", gun)
    extrude_profile("BobbedHammer", [
        (at(0.006), -0.0130), (at(0.016), -0.0110), (at(0.019), -0.0195),
        (at(0.008), -0.0230), (at(0.002), -0.0200),
    ], 0.0110, steel, hammer, smooth=True, bevel=0.0014)

    # ---- anchors ---------------------------------------------------------
    anchor("ViewmodelAnchor", (0.0, at(-0.072), -0.032), root)
    anchor("Muzzle", (0.0, at(0.332), 0.0), root)
    anchor("LeftHandIK", (0.0, at(-0.032), -0.048), root)
    anchor("RightHandIK", (0.0, at(-0.074), -0.064), root)
    anchor("MagazineAnchor", (0.0, mag_centre, -0.074), magazine)
    return root
