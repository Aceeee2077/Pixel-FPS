"""SIG P250 pattern compact polymer pistol, authored from ``P250.png``.

Clean-room recreation: the reference is used only for silhouette proportions
and colour zoning. Bore axis is ``z = 0`` and the frame datum is the FRONT FACE
OF THE TRIGGER GUARD at ``y = 0``, so the slide runs into positive y and the
grip sits behind the guard in negative y. Every number below is a local
coordinate offset by ``FX``, which places the muzzle at ``y = 0.183``.

Reference calibration (vision report + recovered mask, muzzle to the right):
  183 mm overall, 1.233 length/height, a tall but unusually narrow slide
  standing on a deep polymer frame, a railed dust cover, a short trigger
  guard, a 13-round magazine and a striker-fired flat rear plate.
"""
from weapon_common import (anchor, box, extrude_profile, group, rect_profile,
                           slot_rail, sweep)
from weapon_parts import (closed_body, cylinder, ejection_port, magazine_well,
                          pistol_grip, screw_row, sight_front, sight_rear,
                          stepped_barrel, trigger_group)

WEAPON_ID = "p250"
DISPLAY = "P250"
CATEGORY = "pistol"
TRIANGLE_HINT = 25000

# --- master stations (metres, trigger-guard-front datum) ------------------
LAYOUT = {
    "muzzle": 0.183,
    "slide_front": 0.130,
    "slide_rear": 0.042,
    "slide_top": 0.016,
    "slide_bottom": -0.016,
    "frame_rear": -0.012,
    "guard_front": 0.000,
    "guard_bottom": -0.046,
    "grip_top": -0.024,
    "grip_bottom": -0.106,
    "mag_floor": -0.119,
}
FX = LAYOUT["muzzle"]


def build(palette):
    root = group(WEAPON_ID + "_Root")
    gun = group("P250", root)

    steel = palette["steel"]
    metal = palette["gunmetal"]
    slide_mat = palette["phosphate"]
    frame_mat = palette["polymer_grey"]
    grip_mat = palette["polymer"]
    bright = palette["bright"]

    def at(y):
        """Trigger-guard datum -> world y."""
        return y + FX

    # ---- slide: tall, narrow, near-parallel sides ------------------------
    slide = group("Slide", gun)
    extrude_profile("SlideBody", closed_body([
        (at(0.042), 0.0130, -0.0150),
        (at(0.050), 0.0160, -0.0160),
        (at(0.096), 0.0160, -0.0160),
        (at(0.122), 0.0154, -0.0156),
        (at(0.130), 0.0140, -0.0142),
    ]), 0.0246, slide_mat, slide, smooth=False, bevel=0.0022)

    for index in range(11):
        y = at(0.042 + 0.0044 * index)
        for side in (-1, 1):
            bar = extrude_profile("SlideSerrationRear%d_%d" % (index, side),
                                  rect_profile(y + 0.0015, y + 0.0033, -0.0112, 0.0112),
                                  0.0016, metal, slide, smooth=False, bevel=0.0004)
            bar.location.x = side * 0.0124
    for index in range(6):
        y = at(0.100 + 0.0048 * index)
        for side in (-1, 1):
            bar = extrude_profile("SlideSerrationFront%d_%d" % (index, side),
                                  rect_profile(y + 0.0015, y + 0.0033, -0.0108, 0.0108),
                                  0.0015, metal, slide, smooth=False, bevel=0.0004)
            bar.location.x = side * 0.0124

    ejection_port("EjectionPort", metal, slide, at(0.070), at(0.114), 0.0032, 0.0132, 0.0125)
    box("Extractor", (at(0.066), 0.0125, 0.0078), (0.0160, 0.0038, 0.0042), steel, slide, bevel=0.0006)
    box("StrikerCoverPlate", (at(0.0435), 0, -0.0010), (0.0040, 0.0170, 0.0170), metal, slide, bevel=0.0008)
    box("SlideRailBlock", (at(0.0435), 0, -0.0152), (0.0240, 0.0230, 0.0034), steel, slide, bevel=0.0006)

    sight_rear("RearSight", metal, slide, at(0.052), 0.0160, 0.0094, width=0.0182,
               aperture_material=steel)
    box("RearSightLeaf", (at(0.055), 0, 0.0248), (0.0058, 0.0196, 0.0028), steel, slide, bevel=0.0006)
    sight_front("FrontSight", metal, slide, at(0.118), 0.0152, 0.0076, width=0.0074,
                post_material=bright, wings=False)

    # ---- barrel: short, with a stainless crown ---------------------------
    stepped_barrel("Barrel", metal, gun, [
        (at(0.038), 0.0092), (at(0.080), 0.0086), (at(0.118), 0.0078),
        (at(0.140), 0.0070), (at(0.148), 0.0066),
    ], segments=22)
    cylinder("BarrelCrown", bright, gun, at(0.146), at(0.152), 0.0084, segments=22, bevel=0.0008)
    cylinder("MuzzleBore", bright, gun, at(0.183), at(0.1845), 0.0040, segments=20)

    # ---- deep polymer frame ----------------------------------------------
    extrude_profile("Frame", closed_body([
        (at(-0.012), -0.0125, -0.0370),
        (at(0.008), -0.0105, -0.0395),
        (at(0.040), -0.0105, -0.0420),
        (at(0.078), -0.0112, -0.0435),
        (at(0.120), -0.0125, -0.0380),
        (at(0.164), -0.0140, -0.0300),
    ]), 0.0280, frame_mat, gun, smooth=False, bevel=0.0026)

    extrude_profile("TriggerGuard", [
        (at(-0.026), -0.0125), (at(0.020), -0.0130), (at(0.024), -0.0410),
        (at(0.006), -0.0475), (at(-0.016), -0.0470), (at(-0.030), -0.0350),
    ], 0.0224, frame_mat, gun, smooth=False, bevel=0.0022)
    extrude_profile("TriggerGuardWindow", [
        (at(-0.018), -0.0178), (at(0.012), -0.0182), (at(0.014), -0.0408),
        (at(0.004), -0.0436), (at(-0.014), -0.0432), (at(-0.020), -0.0332),
    ], 0.0244, grip_mat, gun, smooth=False)

    slot_rail("AccessoryRail", at(0.132), at(0.166), -0.0130, 0.0180, 0.0050,
              frame_mat, gun, pitch=0.0132, slot=0.0070, depth=0.0022)
    magazine_well("MagazineWell", frame_mat, gun, at(-0.046), at(0.000),
                  -0.028, -0.044, 0.0276)

    cylinder("FramePin", bright, gun, at(-0.004), at(0.002), 0.0022, segments=18,
             z=-0.0212)
    cylinder("TriggerPin", bright, gun, at(0.032), at(0.038), 0.0020, segments=18,
             z=-0.0212)
    cylinder("TakeDownPin", bright, gun, at(0.084), at(0.090), 0.0024, segments=18,
             z=-0.0212)
    box("SlideStopLever", (at(0.030), 0.0142, -0.0150), (0.0300, 0.0026, 0.0048), steel, gun, bevel=0.0006)
    box("MagazineCatch", (at(0.006), -0.0146, -0.0290), (0.0110, 0.0024, 0.0115), steel, gun, bevel=0.0008)
    box("TakedownLever", (at(0.020), 0, -0.0215), (0.0200, 0.0296, 0.0040), steel, gun, bevel=0.0008)
    box("BeavertailTang", (at(-0.014), 0, -0.0300), (0.0180, 0.0272, 0.0110), frame_mat, gun, bevel=0.0022)

    # ---- grip -------------------------------------------------------------
    pistol_grip("PistolGrip", frame_mat, gun, at(-0.030), -0.026, 0.080, -0.018, 0.0280,
                panels=True, panel_material=grip_mat)
    for index in range(6):
        z = -0.036 - 0.0128 * index
        for side in (-1, 1):
            ridge = extrude_profile("GripRidge%d_%d" % (index, side),
                                    rect_profile(at(-0.048), at(-0.010), z, z + 0.0048, chamfer=0.0012),
                                    0.0018, grip_mat, gun, smooth=False, bevel=0.0004)
            ridge.location.x = side * 0.0142

    # ---- moving parts -----------------------------------------------------
    magazine = group("Magazine", gun)
    mag_centre = at(-0.032)
    sweep("MagazineBody",
          [(mag_centre, -0.030, 0.048), (mag_centre - 0.002, -0.058, 0.048),
           (mag_centre - 0.004, -0.086, 0.048)],
          0.0202, slide_mat, magazine, bevel=0.0022)
    box("MagazineFloorPlate", (mag_centre - 0.006, 0, -0.1090), (0.0570, 0.0290, 0.0165),
        frame_mat, magazine, bevel=0.0024)
    for index, z in enumerate((-0.038, -0.058, -0.078, -0.094)):
        for side in (-1, 1):
            witness = extrude_profile("MagazineWitness%d_%d" % (index, side),
                                      rect_profile(mag_centre - 0.019, mag_centre + 0.019, z, z + 0.0062),
                                      0.0008, bright, magazine, smooth=False)
            witness.location.x = side * 0.0102

    trigger = group("Trigger", gun)
    trigger_group("TriggerBlade", steel, trigger, at(-0.014), -0.0195,
                  guard=False, width=0.0086)

    # ---- anchors ----------------------------------------------------------
    anchor("ViewmodelAnchor", (0.0, at(-0.062), -0.028), root)
    anchor("Muzzle", (0.0, at(0.185), 0.0), root)
    anchor("LeftHandIK", (0.0, at(-0.026), -0.042), root)
    anchor("RightHandIK", (0.0, at(-0.064), -0.056), root)
    anchor("MagazineAnchor", (0.0, mag_centre, -0.064), magazine)
    return root
