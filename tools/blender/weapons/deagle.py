"""Desert Eagle pattern gas-operated magnum pistol, authored from ``Deagle.png``.

Clean-room recreation: the reference is used only for silhouette proportions
and colour zoning. Bore axis is ``z = 0`` and the frame datum is the FRONT FACE
OF THE TRIGGER GUARD at ``y = 0``, so the slide/barrel run into positive y and
the grip sits behind the guard in negative y. Every number below is a local
coordinate offset by ``FX``, placing the muzzle at ``y = 0.193``.

Reference calibration (vision report + recovered mask, muzzle to the right):
  270 mm overall, 1.276 length/height, a slide that towers over the frame with
  a full-length barrel rib, a triangular forward profile, a large gas block
  under the barrel, a bolt-mounted ambidextrous safety and a 7-round magazine.
"""
from weapon_common import (anchor, box, extrude_profile, group, rect_profile,
                           slot_rail, sweep)
from weapon_parts import (closed_body, cylinder, ejection_port, knurl,
                          magazine_well, pistol_grip, screw_row, sight_front,
                          sight_rear, stepped_barrel, trigger_group)

WEAPON_ID = "deagle"
DISPLAY = "Desert Eagle"
CATEGORY = "pistol"
TRIANGLE_HINT = 30000

# --- master stations (metres, trigger-guard-front datum) ------------------
LAYOUT = {
    "muzzle": 0.193,
    "slide_front": 0.155,
    "slide_rear": -0.058,
    "slide_top": 0.026,
    "slide_bottom": -0.028,
    "rib_top": 0.040,
    "frame_rear": -0.052,
    "guard_front": 0.000,
    "guard_bottom": -0.056,
    "grip_front": -0.004,
    "grip_back": -0.056,
    "grip_top": -0.036,
    "grip_bottom": -0.129,
    "mag_floor": -0.142,
}
FX = LAYOUT["muzzle"]


def build(palette):
    root = group(WEAPON_ID + "_Root")
    gun = group("Deagle", root)

    steel = palette["steel"]
    metal = palette["gunmetal"]
    slide_mat = palette["steel"]
    bright = palette["bright"]
    frame_mat = palette["polymer_grey"]
    grip_mat = palette["polymer"]

    def at(y):
        """Trigger-guard datum -> world y."""
        return y + FX

    # ---- slide: a tall slab with a full-length rib and a wedge nose -------
    slide = group("Slide", gun)
    extrude_profile("SlideBody", closed_body([
        (at(-0.058), 0.0170, -0.0280),
        (at(-0.034), 0.0250, -0.0290),
        (at(0.038), 0.0260, -0.0290),
        (at(0.104), 0.0246, -0.0290),
        (at(0.134), 0.0210, -0.0275),
        (at(0.148), 0.0158, -0.0246),
        (at(0.155), 0.0128, -0.0220),
    ]), 0.0345, slide_mat, slide, smooth=False, bevel=0.0030)

    # the Mk XIX rib: a raised spine with fine recessed lightening cuts, not
    # a rail - the vents sit INSIDE the rib so the top edge stays smooth
    extrude_profile("BarrelRib", closed_body([
        (at(-0.020), 0.0310, 0.0226),
        (at(0.020), 0.0316, 0.0226),
        (at(0.096), 0.0308, 0.0226),
        (at(0.132), 0.0256, 0.0210),
        (at(0.150), 0.0194, 0.0180),
    ]), 0.0150, metal, slide, smooth=False, bevel=0.0018)
    for index in range(11):
        y = at(-0.010 + 0.0150 * index)
        extrude_profile("RibVent%d" % index,
                        rect_profile(y - 0.0042, y + 0.0042, 0.0252, 0.0300, chamfer=0.0012),
                        0.0122, slide_mat, slide, smooth=False, bevel=0.0006)

    # triangular flank facets that give the Eagle its wedge silhouette
    for side in (-1, 1):
        facet = extrude_profile("SlideFacet%s" % ("L" if side < 0 else "R"),
                                [(at(0.030), -0.0060), (at(0.100), -0.0040), (at(0.100), 0.0170),
                                 (at(0.040), 0.0230), (at(0.026), 0.0150)],
                                0.0016, metal, slide, smooth=False, bevel=0.0004)
        facet.location.x = side * 0.0184

    # rear cocking serrations on both flanks
    for index in range(11):
        y = at(-0.056 + 0.0058 * index)
        for side in (-1, 1):
            bar = extrude_profile("SlideSerration%d_%d" % (index, side),
                                  rect_profile(y + 0.0018, y + 0.0040, -0.0150, 0.0150),
                                  0.0018, metal, slide, smooth=False, bevel=0.0004)
            bar.location.x = side * 0.0175

    # very large ejection port, bolt face and extractor on the right flank
    ejection_port("EjectionPort", metal, slide, at(-0.030), at(0.056), 0.0060, 0.0205, 0.0176)
    box("Extractor", (at(-0.038), 0.0176, 0.0112), (0.0210, 0.0046, 0.0055), steel, slide, bevel=0.0008)
    box("BoltFace", (at(-0.050), 0, 0.0000), (0.0080, 0.0240, 0.0330), steel, slide, bevel=0.0010)

    # ---- ambidextrous safety: a lever on both flanks ----------------------
    for side in (-1, 1):
        lever = extrude_profile("SafetyLever%s" % ("L" if side < 0 else "R"),
                                [(at(-0.048), 0.0020), (at(-0.012), -0.0020),
                                 (at(-0.008), -0.0120), (at(-0.046), -0.0130)],
                                0.0034, steel, slide, smooth=False, bevel=0.0008)
        lever.location.x = side * 0.0180

    # ---- sights ----------------------------------------------------------
    sight_rear("RearSight", steel, slide, at(-0.044), 0.0310, 0.0084, width=0.0226,
               aperture_material=metal)
    box("RearSightLeaf", (at(-0.036), 0, 0.0408), (0.0080, 0.0270, 0.0032), steel, slide, bevel=0.0008)
    sight_front("FrontSight", steel, gun, at(0.140), 0.0232, 0.0105, width=0.0094,
                post_material=bright, wings=False)

    # ---- barrel, gas block and the big muzzle -----------------------------
    stepped_barrel("Barrel", metal, gun, [
        (at(-0.050), 0.0165), (at(0.000), 0.0158), (at(0.070), 0.0148),
        (at(0.120), 0.0132), (at(0.172), 0.0122),
    ], segments=22)
    # gas block / bolt carrier housing under the barrel
    extrude_profile("GasBlock", closed_body([
        (at(0.040), -0.0090, -0.0300),
        (at(0.130), -0.0090, -0.0300),
        (at(0.176), -0.0120, -0.0260),
    ]), 0.0300, metal, gun, smooth=False, bevel=0.0026)
    extrude_profile("GasCylinder", rect_profile(at(0.060), at(0.140), -0.0345, -0.0280, chamfer=0.0022),
                    0.0190, steel, gun, smooth=True, bevel=0.0022)
    cylinder("BarrelBushing", steel, gun, at(0.166), at(0.178), 0.0170, segments=22, bevel=0.0014)
    extrude_profile("MuzzleCrown", rect_profile(at(0.176), at(0.193), -0.0130, 0.0130, chamfer=0.0055),
                    0.0390, metal, gun, smooth=False, bevel=0.0030)
    cylinder("MuzzleBore", bright, gun, at(0.193), at(0.1945), 0.0088, segments=22)

    # ---- frame ------------------------------------------------------------
    extrude_profile("Frame", closed_body([
        (at(-0.052), -0.0300, -0.0460),
        (at(-0.020), -0.0300, -0.0480),
        (at(0.020), -0.0300, -0.0500),
        (at(0.076), -0.0300, -0.0530),
        (at(0.140), -0.0300, -0.0470),
        (at(0.170), -0.0300, -0.0380),
    ]), 0.0330, frame_mat, gun, smooth=False, bevel=0.0028)

    extrude_profile("TriggerGuard", [
        (at(-0.038), -0.0300), (at(0.030), -0.0305), (at(0.034), -0.0500),
        (at(0.016), -0.0595), (at(-0.020), -0.0590), (at(-0.040), -0.0480),
    ], 0.0265, frame_mat, gun, smooth=False, bevel=0.0024)
    extrude_profile("TriggerGuardWindow", [
        (at(-0.030), -0.0355), (at(0.022), -0.0358), (at(0.024), -0.0505),
        (at(0.012), -0.0552), (at(-0.018), -0.0546), (at(-0.032), -0.0450),
    ], 0.0290, grip_mat, gun, smooth=False)

    slot_rail("AccessoryRail", at(0.126), at(0.168), -0.0302, 0.0230, 0.0052,
              frame_mat, gun, pitch=0.0150, slot=0.0078, depth=0.0022)
    magazine_well("MagazineWell", frame_mat, gun, at(-0.058), at(0.006),
                  -0.040, -0.056, 0.0325)

    # frame pins, slide stop and magazine release behind the guard
    cylinder("FramePin", bright, gun, at(-0.004), at(0.002), 0.0026, segments=18,
             z=-0.0355)
    cylinder("TriggerPin", bright, gun, at(0.052), at(0.058), 0.0024, segments=18,
             z=-0.0355)
    cylinder("HammerPin", bright, gun, at(-0.052), at(-0.046), 0.0030, segments=18,
             z=-0.0240)
    cylinder("SlideStopPin", bright, gun, at(0.104), at(0.110), 0.0024, segments=18,
             z=-0.0355)
    box("SlideStopLever", (at(-0.006), 0.0180, -0.0250), (0.0400, 0.0030, 0.0060), steel, gun, bevel=0.0008)
    box("MagazineCatch", (at(-0.006), -0.0180, -0.0430), (0.0150, 0.0030, 0.0165), steel, gun, bevel=0.0010)

    # ---- pronounced grip --------------------------------------------------
    pistol_grip("PistolGrip", frame_mat, gun, at(-0.030), -0.040, 0.095, -0.014, 0.0350,
                panels=True, panel_material=grip_mat)
    box("Backstrap", (at(-0.048), 0, -0.0700), (0.0200, 0.0352, 0.0620), grip_mat, gun, bevel=0.0034)
    knurl("GripCheckering", at(-0.050), at(-0.008), -0.0620, 0.0174, 0.0050, 5,
          grip_mat, gun, depth=0.0300)

    # ---- moving parts -----------------------------------------------------
    magazine = group("Magazine", gun)
    mag_centre = at(-0.028)
    sweep("MagazineBody",
          [(mag_centre, -0.042, 0.052), (mag_centre + 0.004, -0.076, 0.052),
           (mag_centre + 0.008, -0.110, 0.052)],
          0.0240, slide_mat, magazine, bevel=0.0022)
    box("MagazineFloorPlate", (mag_centre + 0.012, 0, -0.1330), (0.0640, 0.0350, 0.0180),
        frame_mat, magazine, bevel=0.0026)
    for index, z in enumerate((-0.052, -0.078, -0.104)):
        for side in (-1, 1):
            witness = extrude_profile("MagazineWitness%d_%d" % (index, side),
                                      rect_profile(mag_centre - 0.022, mag_centre + 0.022, z, z + 0.0080),
                                      0.0009, bright, magazine, smooth=False)
            witness.location.x = side * 0.0121

    trigger = group("Trigger", gun)
    trigger_group("TriggerBlade", steel, trigger, at(-0.012), -0.0270,
                  guard=False, width=0.0105)

    # the Eagle's exposed ring hammer behind the slide
    hammer = group("Hammer", gun)
    cylinder("HammerPin", steel, hammer, at(-0.052), at(-0.044), 0.0034, segments=18)
    extrude_profile("HammerSpur", [
        (at(-0.096), -0.0100), (at(-0.070), -0.0140), (at(-0.062), -0.0300),
        (at(-0.076), -0.0420), (at(-0.098), -0.0350), (at(-0.104), -0.0180),
    ], 0.0125, steel, hammer, smooth=True, bevel=0.0016)

    # ---- anchors ----------------------------------------------------------
    anchor("ViewmodelAnchor", (0.0, at(-0.086), -0.038), root)
    anchor("Muzzle", (0.0, at(0.195), 0.0), root)
    anchor("LeftHandIK", (0.0, at(-0.034), -0.054), root)
    anchor("RightHandIK", (0.0, at(-0.088), -0.074), root)
    anchor("MagazineAnchor", (0.0, mag_centre, -0.085), magazine)
    return root
