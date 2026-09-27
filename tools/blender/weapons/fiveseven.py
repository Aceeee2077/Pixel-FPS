"""FN Five-seveN pattern polymer pistol, authored from ``FN57.png``.

Clean-room recreation: the reference is used only for silhouette proportions
and colour zoning. Bore axis is ``z = 0`` and the frame datum is the FRONT FACE
OF THE TRIGGER GUARD at ``y = 0``, so the slide runs into positive y and the
grip sits behind the guard in negative y. Every number below is a local
coordinate offset by ``FX``, which places the muzzle at ``y = 0.208``.

Reference calibration (vision report + recovered mask, muzzle to the right):
  208 mm overall, 1.153 length/height, a long slim slide carrying forward
  cocking serrations, a very low bore axis over a deep polymer frame with a
  pronounced beavertail, adjustable sights and a 20-round magazine.
"""
from weapon_common import (anchor, box, extrude_profile, group, rect_profile,
                           slot_rail, sweep)
from weapon_parts import (closed_body, cylinder, ejection_port, knurl,
                          magazine_well, pistol_grip, screw_row, sight_front,
                          sight_rear, stepped_barrel, trigger_group)

WEAPON_ID = "five-seven"
DISPLAY = "Five-SeveN"
CATEGORY = "pistol"
TRIANGLE_HINT = 27000

# --- master stations (metres, trigger-guard-front datum) ------------------
LAYOUT = {
    "muzzle": 0.208,
    "slide_front": 0.185,
    "slide_rear": 0.032,
    "slide_top": 0.0124,
    "slide_bottom": -0.0132,
    "frame_rear": -0.014,
    "guard_front": 0.000,
    "guard_bottom": -0.046,
    "grip_top": -0.024,
    "grip_bottom": -0.114,
    "mag_floor": -0.127,
}
FX = LAYOUT["muzzle"]


def build(palette):
    root = group(WEAPON_ID + "_Root")
    gun = group("FiveSeven", root)

    steel = palette["steel"]
    metal = palette["gunmetal"]
    slide_mat = palette["anodized"]
    frame_mat = palette["polymer_fde"]
    grip_mat = palette["rubber"]
    bright = palette["bright"]

    def at(y):
        """Trigger-guard datum -> world y."""
        return y + FX

    # ---- slide: long and slim, with a low skyline ------------------------
    slide = group("Slide", gun)
    extrude_profile("SlideBody", closed_body([
        (at(0.032), 0.0100, -0.0122),
        (at(0.040), 0.0124, -0.0132),
        (at(0.106), 0.0124, -0.0132),
        (at(0.158), 0.0118, -0.0128),
        (at(0.178), 0.0104, -0.0118),
        (at(0.185), 0.0090, -0.0106),
    ]), 0.0250, slide_mat, slide, smooth=False, bevel=0.0022)

    # forward serrations are the Five-seveN's signature; the rear set is finer
    for index in range(11):
        y = at(0.032 + 0.0040 * index)
        for side in (-1, 1):
            bar = extrude_profile("SlideSerrationRear%d_%d" % (index, side),
                                  rect_profile(y + 0.0014, y + 0.0032, -0.0092, 0.0092),
                                  0.0016, metal, slide, smooth=False, bevel=0.0004)
            bar.location.x = side * 0.0126
    for index in range(12):
        y = at(0.126 + 0.0048 * index)
        for side in (-1, 1):
            bar = extrude_profile("SlideSerrationFront%d_%d" % (index, side),
                                  rect_profile(y + 0.0018, y + 0.0040, -0.0098, 0.0098),
                                  0.0018, metal, slide, smooth=False, bevel=0.0004)
            bar.location.x = side * 0.0126

    # scalloped lightening cut above the trigger on both flanks
    for side in (-1, 1):
        cut = extrude_profile("SlideScallop%s" % ("L" if side < 0 else "R"),
                              rect_profile(at(0.104), at(0.134), -0.0060, 0.0088, chamfer=0.0028),
                              0.0018, metal, slide, smooth=False, bevel=0.0006)
        cut.location.x = side * 0.0126

    ejection_port("EjectionPort", metal, slide, at(0.062), at(0.108), 0.0016, 0.0104, 0.0126)
    box("Extractor", (at(0.058), 0.0126, 0.0062), (0.0160, 0.0038, 0.0040), steel, slide, bevel=0.0006)
    box("StrikerCoverPlate", (at(0.0340), 0, -0.0010), (0.0036, 0.0172, 0.0150), metal, slide, bevel=0.0008)
    box("SlideRailBlock", (at(0.0340), 0, -0.0126), (0.0240, 0.0234, 0.0032), steel, slide, bevel=0.0006)

    # ---- adjustable sights -----------------------------------------------
    sight_rear("RearSight", metal, slide, at(0.042), 0.0124, 0.0082, width=0.0188,
               aperture_material=steel)
    box("RearSightAdjuster", (at(0.046), 0, 0.0170), (0.0120, 0.0205, 0.0048), steel, slide, bevel=0.0008)
    for side in (-1, 1):
        wing = extrude_profile("RearSightWing%s" % ("L" if side < 0 else "R"),
                               rect_profile(at(0.034), at(0.050), 0.0168, 0.0224),
                               0.0028, metal, slide, smooth=False, bevel=0.0006)
        wing.location.x = side * 0.0112
    sight_front("FrontSight", metal, slide, at(0.172), 0.0100, 0.0072, width=0.0072,
                post_material=bright, wings=False)

    # ---- barrel: low bore axis, slim profile -----------------------------
    stepped_barrel("Barrel", steel, gun, [
        (at(0.028), 0.0088), (at(0.090), 0.0082), (at(0.150), 0.0076),
        (at(0.184), 0.0070), (at(0.196), 0.0066),
    ], segments=22)
    cylinder("BarrelCrown", metal, gun, at(0.190), at(0.200), 0.0080, segments=22, bevel=0.0008)
    cylinder("MuzzleBore", bright, gun, at(0.208), at(0.2095), 0.0038, segments=20)

    # ---- frame with a pronounced beavertail ------------------------------
    extrude_profile("Frame", closed_body([
        (at(-0.014), -0.0142, -0.0346),
        (at(0.006), -0.0122, -0.0372),
        (at(0.038), -0.0122, -0.0400),
        (at(0.076), -0.0130, -0.0416),
        (at(0.120), -0.0140, -0.0362),
        (at(0.164), -0.0152, -0.0286),
    ]), 0.0268, frame_mat, gun, smooth=False, bevel=0.0024)

    extrude_profile("TriggerGuard", [
        (at(-0.028), -0.0142), (at(0.022), -0.0146), (at(0.026), -0.0400),
        (at(0.008), -0.0468), (at(-0.016), -0.0462), (at(-0.032), -0.0340),
    ], 0.0216, frame_mat, gun, smooth=False, bevel=0.0022)
    extrude_profile("TriggerGuardWindow", [
        (at(-0.020), -0.0192), (at(0.014), -0.0196), (at(0.016), -0.0396),
        (at(0.006), -0.0428), (at(-0.014), -0.0422), (at(-0.022), -0.0320),
    ], 0.0234, grip_mat, gun, smooth=False)

    slot_rail("AccessoryRail", at(0.132), at(0.168), -0.0148, 0.0176, 0.0050,
              frame_mat, gun, pitch=0.0130, slot=0.0068, depth=0.0022)
    magazine_well("MagazineWell", frame_mat, gun, at(-0.046), at(0.000),
                  -0.026, -0.042, 0.0264)

    cylinder("FramePin", bright, gun, at(-0.004), at(0.002), 0.0022, segments=18,
             z=-0.0202)
    cylinder("TriggerPin", bright, gun, at(0.034), at(0.040), 0.0020, segments=18,
             z=-0.0202)
    cylinder("TakeDownPin", bright, gun, at(0.086), at(0.092), 0.0024, segments=18,
             z=-0.0202)
    box("SlideStopLever", (at(0.034), 0.0138, -0.0146), (0.0330, 0.0026, 0.0046), steel, gun, bevel=0.0006)
    box("MagazineCatch", (at(0.000), -0.0142, -0.0272), (0.0105, 0.0024, 0.0110), steel, gun, bevel=0.0008)
    box("BeavertailTang", (at(-0.014), 0, -0.0282), (0.0200, 0.0262, 0.0150), frame_mat, gun, bevel=0.0024)
    box("SafetyLever", (at(0.008), 0, -0.0198), (0.0190, 0.0290, 0.0044), steel, gun, bevel=0.0008)
    box("TakedownLever", (at(0.024), 0, -0.0192), (0.0200, 0.0280, 0.0042), steel, gun, bevel=0.0008)
    box("SlideStopNotch", (at(0.056), 0, -0.0148), (0.0140, 0.0250, 0.0030), metal, gun, bevel=0.0006)

    # ---- grip -------------------------------------------------------------
    pistol_grip("PistolGrip", frame_mat, gun, at(-0.030), -0.026, 0.086, -0.016, 0.0272,
                panels=True, panel_material=grip_mat)
    knurl("GripCheckering", at(-0.048), at(-0.008), -0.0560, 0.0138, 0.0044, 6,
          grip_mat, gun, depth=0.0240)

    # ---- moving parts -----------------------------------------------------
    magazine = group("Magazine", gun)
    mag_centre = at(-0.030)
    sweep("MagazineBody",
          [(mag_centre, -0.032, 0.048), (mag_centre - 0.002, -0.062, 0.048),
           (mag_centre - 0.004, -0.092, 0.048)],
          0.0196, slide_mat, magazine, bevel=0.0022)
    box("MagazineFloorPlate", (mag_centre - 0.006, 0, -0.1175), (0.0580, 0.0284, 0.0165),
        frame_mat, magazine, bevel=0.0024)
    for index, z in enumerate((-0.044, -0.070, -0.092)):
        for side in (-1, 1):
            witness = extrude_profile("MagazineWitness%d_%d" % (index, side),
                                      rect_profile(mag_centre - 0.019, mag_centre + 0.019, z, z + 0.0065),
                                      0.0008, bright, magazine, smooth=False)
            witness.location.x = side * 0.0099

    trigger = group("Trigger", gun)
    trigger_group("TriggerBlade", steel, trigger, at(-0.012), -0.0210,
                  guard=False, width=0.0084)

    # ---- anchors ----------------------------------------------------------
    anchor("ViewmodelAnchor", (0.0, at(-0.064), -0.028), root)
    anchor("Muzzle", (0.0, at(0.210), 0.0), root)
    anchor("LeftHandIK", (0.0, at(-0.026), -0.042), root)
    anchor("RightHandIK", (0.0, at(-0.066), -0.056), root)
    anchor("MagazineAnchor", (0.0, mag_centre, -0.068), magazine)
    return root
