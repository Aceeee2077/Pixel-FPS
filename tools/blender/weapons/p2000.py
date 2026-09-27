"""HK P2000 pattern polymer service pistol, authored from ``P2000.png``.

Clean-room recreation: the reference is used only for silhouette proportions
and colour zoning. Bore axis is ``z = 0`` and the frame datum is the FRONT FACE
OF THE TRIGGER GUARD at ``y = 0``, so the slide runs into positive y and the
grip sits behind the guard in negative y. Every number below is a local
coordinate offset by ``FX``, which places the muzzle at ``y = 0.204``.

Reference calibration (vision report + recovered mask, muzzle to the right):
  204 mm overall, 1.211 length/height, a squared slide that steps down to a
  slim nose, deep rear cocking serrations, a railed dust cover, an LEM-style
  flat trigger, a 13-round magazine and a rear-mounted decocking button.
"""
from weapon_common import (anchor, box, extrude_profile, group, rect_profile,
                           slot_rail, sweep)
from weapon_parts import (closed_body, cylinder, ejection_port, magazine_well,
                          pistol_grip, screw_row, sight_front, sight_rear,
                          stepped_barrel, trigger_group)

WEAPON_ID = "p2000"
DISPLAY = "P2000"
CATEGORY = "pistol"
TRIANGLE_HINT = 26000

# --- master stations (metres, trigger-guard-front datum) ------------------
LAYOUT = {
    "muzzle": 0.204,
    "slide_front": 0.186,
    "slide_rear": 0.028,
    "slide_top": 0.014,
    "slide_bottom": -0.014,
    "frame_front": 0.172,
    "frame_rear": -0.014,
    "guard_front": 0.000,
    "guard_bottom": -0.048,
    "grip_top": -0.026,
    "grip_bottom": -0.116,
    "mag_floor": -0.129,
}
FX = LAYOUT["muzzle"]


def build(palette):
    root = group(WEAPON_ID + "_Root")
    gun = group("P2000", root)

    steel = palette["steel"]
    metal = palette["gunmetal"]
    slide_mat = palette["anodized"]
    frame_mat = palette["polymer"]
    bright = palette["bright"]
    grip_mat = palette["polymer_grey"]

    def at(y):
        """Trigger-guard datum -> world y."""
        return y + FX

    # ---- slide: square rear block stepping down to a slim nose -----------
    slide = group("Slide", gun)
    extrude_profile("SlideBody", closed_body([
        (at(0.028), 0.0105, -0.0135),
        (at(0.036), 0.0145, -0.0145),
        (at(0.098), 0.0145, -0.0145),
        (at(0.146), 0.0132, -0.0140),
        (at(0.166), 0.0118, -0.0130),
        (at(0.180), 0.0110, -0.0126),
        (at(0.186), 0.0098, -0.0116),
    ]), 0.0262, slide_mat, slide, smooth=False, bevel=0.0022)

    # deep rear serrations (the P2000's signature) and a short front set
    for index in range(11):
        y = at(0.028 + 0.0050 * index)
        for side in (-1, 1):
            bar = extrude_profile("SlideSerrationRear%d_%d" % (index, side),
                                  rect_profile(y + 0.0016, y + 0.0034, -0.0105, 0.0105),
                                  0.0018, metal, slide, smooth=False, bevel=0.0004)
            bar.location.x = side * 0.0132
    for index in range(5):
        y = at(0.160 + 0.0050 * index)
        for side in (-1, 1):
            bar = extrude_profile("SlideSerrationFront%d_%d" % (index, side),
                                  rect_profile(y + 0.0016, y + 0.0034, -0.0098, 0.0098),
                                  0.0016, metal, slide, smooth=False, bevel=0.0004)
            bar.location.x = side * 0.0131

    # front and rear slanted slide cuts, unique to this pistol
    for index, y in enumerate((at(0.036), at(0.150))):
        for side in (-1, 1):
            cut = extrude_profile("SlideCut%d_%d" % (index, side),
                                  rect_profile(y - 0.0090, y + 0.0090, 0.0044, 0.0126, chamfer=0.0022),
                                  0.0018, metal, slide, smooth=False, bevel=0.0006)
            cut.location.x = side * 0.0132

    ejection_port("EjectionPort", metal, slide, at(0.078), at(0.128), 0.0024, 0.0120, 0.0132)
    box("Extractor", (at(0.074), 0.0132, 0.0070), (0.0165, 0.0040, 0.0042), steel, slide, bevel=0.0006)
    box("BreechPlate", (at(0.0295), 0, -0.0020), (0.0040, 0.0180, 0.0140), metal, slide, bevel=0.0008)
    box("SlideRailBlock", (at(0.0295), 0, -0.0138), (0.0250, 0.0245, 0.0034), steel, slide, bevel=0.0006)

    # ---- sights ----------------------------------------------------------
    sight_rear("RearSight", metal, slide, at(0.040), 0.0145, 0.0088, width=0.0186,
               aperture_material=steel)
    box("RearSightLeaf", (at(0.043), 0, 0.0228), (0.0060, 0.0200, 0.0030), steel, slide, bevel=0.0006)
    box("BreechBlockPin", (at(0.033), 0, -0.0146), (0.0150, 0.0230, 0.0030), steel, slide, bevel=0.0006)
    sight_front("FrontSight", metal, slide, at(0.172), 0.0116, 0.0072, width=0.0076,
                post_material=bright, wings=False)

    # ---- barrel ----------------------------------------------------------
    stepped_barrel("Barrel", steel, gun, [
        (at(0.024), 0.0096), (at(0.080), 0.0090), (at(0.140), 0.0084),
        (at(0.176), 0.0076), (at(0.190), 0.0070),
    ], segments=22)
    cylinder("BarrelCrown", metal, gun, at(0.186), at(0.197), 0.0092, segments=22, bevel=0.0010)
    cylinder("MuzzleBore", bright, gun, at(0.204), at(0.2055), 0.0044, segments=20)

    # ---- frame ------------------------------------------------------------
    extrude_profile("Frame", closed_body([
        (at(-0.014), -0.0170, -0.0400),
        (at(0.006), -0.0150, -0.0420),
        (at(0.038), -0.0150, -0.0445),
        (at(0.080), -0.0158, -0.0465),
        (at(0.128), -0.0168, -0.0410),
        (at(0.172), -0.0178, -0.0345),
    ]), 0.0286, frame_mat, gun, smooth=False, bevel=0.0026)

    extrude_profile("TriggerGuard", [
        (at(-0.030), -0.0170), (at(0.022), -0.0175), (at(0.026), -0.0435),
        (at(0.008), -0.0505), (at(-0.018), -0.0500), (at(-0.034), -0.0390),
    ], 0.0228, frame_mat, gun, smooth=False, bevel=0.0022)
    extrude_profile("TriggerGuardWindow", [
        (at(-0.022), -0.0225), (at(0.014), -0.0228), (at(0.016), -0.0432),
        (at(0.005), -0.0464), (at(-0.016), -0.0458), (at(-0.024), -0.0372),
    ], 0.0250, grip_mat, gun, smooth=False)

    slot_rail("AccessoryRail", at(0.140), at(0.174), -0.0182, 0.0198, 0.0052,
              frame_mat, gun, pitch=0.0136, slot=0.0072, depth=0.0022)
    magazine_well("MagazineWell", frame_mat, gun, at(-0.050), at(-0.002),
                  -0.030, -0.046, 0.0282)

    cylinder("FramePin", bright, gun, at(-0.004), at(0.002), 0.0024, segments=18)
    cylinder("TriggerPin", bright, gun, at(0.034), at(0.040), 0.0022, segments=18)
    cylinder("TakeDownPin", bright, gun, at(0.084), at(0.090), 0.0026, segments=18)
    box("SlideStopLever", (at(0.026), 0.0150, -0.0165), (0.0320, 0.0028, 0.0052), steel, gun, bevel=0.0006)
    # HK paddle magazine release at the rear of the guard
    box("MagazineReleasePaddle", (at(-0.028), 0, -0.0300), (0.0170, 0.0312, 0.0075), steel, gun, bevel=0.0010)
    box("DecockButton", (at(-0.008), 0, -0.0250), (0.0090, 0.0270, 0.0060), steel, gun, bevel=0.0008)
    box("BackstrapInsert", (at(-0.044), 0, -0.0620), (0.0165, 0.0288, 0.0540), grip_mat, gun, bevel=0.0030)

    # ---- grip -------------------------------------------------------------
    pistol_grip("PistolGrip", frame_mat, gun, at(-0.032), -0.028, 0.088, -0.015, 0.0288,
                panels=True, panel_material=grip_mat)
    for index in range(5):
        z = -0.040 - 0.0140 * index
        for side in (-1, 1):
            ridge = extrude_profile("GripRidge%d_%d" % (index, side),
                                    rect_profile(at(-0.052), at(-0.012), z, z + 0.0052, chamfer=0.0012),
                                    0.0018, grip_mat, gun, smooth=False, bevel=0.0004)
            ridge.location.x = side * 0.0146

    # ---- moving parts -----------------------------------------------------
    magazine = group("Magazine", gun)
    mag_centre = at(-0.034)
    sweep("MagazineBody",
          [(mag_centre, -0.032, 0.050), (mag_centre + 0.002, -0.064, 0.050),
           (mag_centre + 0.004, -0.096, 0.050)],
          0.0208, slide_mat, magazine, bevel=0.0022)
    box("MagazineFloorPlate", (mag_centre + 0.008, 0, -0.1195), (0.0600, 0.0300, 0.0170),
        frame_mat, magazine, bevel=0.0024)
    for index, z in enumerate((-0.048, -0.072, -0.094)):
        for side in (-1, 1):
            witness = extrude_profile("MagazineWitness%d_%d" % (index, side),
                                      rect_profile(mag_centre - 0.020, mag_centre + 0.020, z, z + 0.0070),
                                      0.0008, bright, magazine, smooth=False)
            witness.location.x = side * 0.0105

    trigger = group("Trigger", gun)
    # LEM trigger: a straight, flat-faced blade with a short travel
    extrude_profile("TriggerBlade",
                    [(at(-0.020), -0.0210), (at(-0.014), -0.0212), (at(-0.011), -0.0400),
                     (at(-0.017), -0.0412), (at(-0.022), -0.0260)],
                    0.0090, steel, trigger, smooth=False, bevel=0.0012)

    hammer = group("Hammer", gun)
    extrude_profile("BobbedHammer", [
        (at(0.012), -0.0120), (at(0.021), -0.0105), (at(0.023), -0.0185),
        (at(0.012), -0.0215), (at(0.007), -0.0180),
    ], 0.0100, steel, hammer, smooth=True, bevel=0.0012)

    # ---- anchors ----------------------------------------------------------
    anchor("ViewmodelAnchor", (0.0, at(-0.068), -0.030), root)
    anchor("Muzzle", (0.0, at(0.206), 0.0), root)
    anchor("LeftHandIK", (0.0, at(-0.030), -0.046), root)
    anchor("RightHandIK", (0.0, at(-0.070), -0.060), root)
    anchor("MagazineAnchor", (0.0, mag_centre, -0.072), magazine)
    return root
