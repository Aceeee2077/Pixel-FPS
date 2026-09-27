"""Glock 18C pattern machine pistol, authored from ``Glock.png``.

Clean-room recreation: the reference is used only for silhouette proportions
and colour zoning. Bore axis is ``z = 0`` and the frame datum is the FRONT FACE
OF THE TRIGGER GUARD at ``y = 0``, so the slide/barrel run into positive y and
the grip sits behind the guard in negative y. Every number below is a local
coordinate offset by ``FX`` (see ``LAYOUT``), which places the muzzle at
``y = 0.174`` while the slide nose stops at ``y = 0.145``.

Reference calibration (vision report + recovered mask, muzzle to the right):
  186 mm overall, 125 mm tall, 1.157 length/height, squared slide with a low
  skyline and a slim nose, 20-round double-stack magazine, no external hammer,
  U-shaped rear sight behind a post front sight, and a ported compensator.
"""
from weapon_common import (anchor, box, extrude_profile, group, rect_profile,
                           slot_rail, sweep)
from weapon_parts import (closed_body, cylinder, ejection_port, magazine_well,
                          muzzle_device, pistol_grip, screw_row, sight_front,
                          sight_rear, stepped_barrel)

WEAPON_ID = "glock"
DISPLAY = "Glock 18C"
CATEGORY = "pistol"
TRIANGLE_HINT = 26000

# --- master stations (metres, trigger-guard-front datum) ------------------
LAYOUT = {
    "guard": 0.035,           # guard front, measured from the frame datum
    "muzzle": 0.174,          # bore exit; frame datum offset for every part
    "slide_front": 0.145,
    "slide_rear": 0.030,
    "slide_top": 0.013,
    "slide_bottom": -0.013,
    "frame_front": 0.135,
    "frame_rear": -0.012,
    "guard_front": 0.035,
    "guard_bottom": -0.048,
    "grip_front": -0.004,
    "grip_back": -0.060,
    "grip_bottom": -0.118,
    "grip_top": -0.026,
    "mag_floor": -0.131,
}
FX = LAYOUT["muzzle"]
GUARD = LAYOUT["guard"]


def build(palette):
    root = group(WEAPON_ID + "_Root")
    gun = group("Glock", root)

    metal = palette["gunmetal"]
    slide_mat = palette["anodized"]
    frame_mat = palette["polymer_grey"]
    steel = palette["steel"]
    bright = palette["bright"]
    grip_mat = palette["rubber"]

    def at(y):
        """Frame datum -> world y."""
        return y + FX

    def gd(y):
        """Trigger-guard datum -> frame datum offset."""
        return y + GUARD

    # ---- slide: squared Glock profile with a chamfered forward block ------
    slide = group("Slide", gun)
    extrude_profile("SlideBody", closed_body([
        (at(0.030), 0.0115, -0.0125),
        (at(0.034), 0.0126, -0.0128),
        (at(0.038), 0.0130, -0.0130),
        (at(0.058), 0.0130, -0.0130),
        (at(0.084), 0.0130, -0.0130),
        (at(0.106), 0.0130, -0.0130),
        (at(0.128), 0.0130, -0.0130),
        (at(0.138), 0.0128, -0.0128),
        (at(0.145), 0.0108, -0.0108),
    ]), 0.0255, slide_mat, slide, smooth=False, bevel=0.0022)

    # rear cocking serrations: raised bars, not painted lines
    for index in range(9):
        y = at(0.031 + 0.0050 * index)
        for side in (-1, 1):
            bar = extrude_profile("SlideSerrationRear%d_%d" % (index, side),
                                  rect_profile(y + 0.0016, y + 0.0034, -0.0092, 0.0092),
                                  0.0016, metal, slide, smooth=False, bevel=0.0004)
            bar.location.x = side * 0.0128
    # front serrations ahead of the ejection port
    for index in range(5):
        y = at(0.114 + 0.0050 * index)
        for side in (-1, 1):
            bar = extrude_profile("SlideSerrationFront%d_%d" % (index, side),
                                  rect_profile(y + 0.0016, y + 0.0034, -0.0088, 0.0088),
                                  0.0014, metal, slide, smooth=False, bevel=0.0004)
            bar.location.x = side * 0.0128

    # ejection port, extractor and striker/firing-pin plate on the rear face
    ejection_port("EjectionPort", metal, slide, at(0.082), at(0.124), 0.0022, 0.0112, 0.0129)
    box("Extractor", (at(0.078), 0.0129, 0.0062), (0.0150, 0.0040, 0.0042), steel, slide, bevel=0.0006)
    box("StrikerPlate", (at(0.0315), 0, -0.0030), (0.0032, 0.0165, 0.0125), steel, slide, bevel=0.0008)
    # slide-stop notch and the frame-to-slide rail interface
    box("SlideRailBlock", (at(0.0315), 0, -0.0125), (0.0280, 0.0240, 0.0035), steel, slide, bevel=0.0006)

    # ---- sights, owned by the Slide group so they travel with it ---------
    sight_rear("RearSight", metal, slide, at(0.040), 0.0130, 0.0094, width=0.0194,
               aperture_material=steel)
    box("RearSightLeaf", (at(0.043), 0, 0.0230), (0.0062, 0.0208, 0.0030), steel, slide, bevel=0.0006)
    sight_front("FrontSight", metal, slide, at(0.133), 0.0130, 0.0074, width=0.0078,
                post_material=bright, wings=False)
    # lightening cuts on the slide flanks give the decimator real geometry to
    # work with instead of collapsing a bare box
    for index in range(4):
        y = at(0.050 + 0.0175 * index)
        for side in (-1, 1):
            cut = extrude_profile("SlideLighteningCut%d_%d" % (index, side),
                                  rect_profile(y - 0.0060, y + 0.0060, -0.0044, 0.0070,
                                               chamfer=0.0020),
                                  0.0016, metal, slide, smooth=False, bevel=0.0006)
            cut.location.x = side * 0.0128

    # ---- barrel and the ported compensator of the 18C --------------------
    stepped_barrel("Barrel", steel, gun, [
        (at(0.020), 0.0100), (at(0.040), 0.0097), (at(0.060), 0.0094),
        (at(0.080), 0.0091), (at(0.100), 0.0088), (at(0.120), 0.0083),
        (at(0.138), 0.0078), (at(0.150), 0.0072),
    ], segments=26)
    cylinder("CompensatorCollar", steel, gun, at(0.143), at(0.151), 0.0114,
             segments=24, bevel=0.0008)
    muzzle_device("Compensator", metal, gun, at(0.150), at(0.174), 0.0106,
                  ports=3, port_material=steel, flare=0.0)
    cylinder("MuzzleBore", bright, gun, at(0.174), at(0.1755), 0.0044, segments=20)

    # ---- polymer frame ----------------------------------------------------
    extrude_profile("Frame", closed_body([
        (at(-0.012), -0.0200, -0.0410),   # beavertail tang
        (at(-0.002), -0.0186, -0.0420),
        (at(0.004), -0.0175, -0.0430),
        (at(0.018), -0.0178, -0.0452),
        (at(0.030), -0.0180, -0.0475),
        (at(0.045), -0.0186, -0.0492),
        (at(0.060), -0.0192, -0.0505),
        (at(0.080), -0.0194, -0.0470),
        (at(0.100), -0.0196, -0.0435),
        (at(0.118), -0.0198, -0.0382),
        (at(0.135), -0.0200, -0.0330),    # accessory rail nose
    ]), 0.0290, frame_mat, gun, smooth=False, bevel=0.0028)

    # trigger guard as a real closed loop, so the opening stays open
    extrude_profile("TriggerGuard", [
        (at(gd(-0.040)), -0.0196), (at(gd(-0.026)), -0.0199), (at(gd(-0.014)), -0.0204),
        (at(gd(-0.004)), -0.0202), (at(gd(0.012)), -0.0205), (at(gd(0.024)), -0.0207),
        (at(gd(0.030)), -0.0208), (at(gd(0.033)), -0.0310), (at(gd(0.034)), -0.0455),
        (at(gd(0.024)), -0.0500), (at(gd(0.012)), -0.0525), (at(gd(-0.002)), -0.0524),
        (at(gd(-0.016)), -0.0520), (at(gd(-0.028)), -0.0470), (at(gd(-0.038)), -0.0400),
    ], 0.0235, frame_mat, gun, smooth=False, bevel=0.0022)
    # dark liner inside the guard opening; reads as the open window
    extrude_profile("TriggerGuardWindow", [
        (at(gd(-0.031)), -0.0252), (at(gd(-0.014)), -0.0254), (at(gd(0.006)), -0.0256),
        (at(gd(0.018)), -0.0258), (at(gd(0.022)), -0.0260), (at(gd(0.0235)), -0.0360),
        (at(gd(0.024)), -0.0448), (at(gd(0.016)), -0.0466), (at(gd(0.008)), -0.0482),
        (at(gd(-0.004)), -0.0480), (at(gd(-0.014)), -0.0476), (at(gd(-0.022)), -0.0430),
        (at(gd(-0.029)), -0.0360),
    ], 0.0256, grip_mat, gun, smooth=False)

    # accessory rail under the dust cover
    slot_rail("AccessoryRail", at(0.098), at(0.133), -0.0200, 0.0195, 0.0052,
              frame_mat, gun, pitch=0.0134, slot=0.0070, depth=0.0022)

    # interchangeable backstrap, magazine well flare and the Glock's pins
    extrude_profile("Backstrap",
                    rect_profile(at(-0.046), at(-0.036), -0.096, -0.030, chamfer=0.004),
                    0.0292, grip_mat, gun, smooth=False, bevel=0.0022)
    magazine_well("MagazineWell", frame_mat, gun, at(-0.052), at(-0.002),
                  -0.030, -0.048, 0.0286)
    screw_row("BackstrapPin", bright, gun, at(-0.044), at(-0.038), 2, -0.0440, radius=0.0022)
    cylinder("FramePin", bright, gun, at(-0.004), at(0.002), 0.0022, segments=18)
    cylinder("LockingBlockPin", bright, gun, at(0.036), at(0.042), 0.0022, segments=18)

    # slide stop lever, takedown lever and reversible magazine catch
    box("SlideStopLever", (at(0.030), 0.0148, -0.0165), (0.0300, 0.0026, 0.0050), steel, gun, bevel=0.0006)
    box("TakedownLever", (at(0.016), 0, -0.0235), (0.0220, 0.0320, 0.0042), steel, gun, bevel=0.0008)
    box("LockingBlock", (at(0.034), 0, -0.0250), (0.0170, 0.0230, 0.0060), metal, gun, bevel=0.0008)
    box("MagazineCatch", (at(-0.002), -0.0150, -0.0320), (0.0125, 0.0024, 0.0125), steel, gun, bevel=0.0008)
    extrude_profile("MagazineCatchButton",
                    rect_profile(at(-0.0035), at(0.0065), -0.0315, -0.0208, chamfer=0.0016),
                    0.0330, steel, gun, smooth=False, bevel=0.0008)

    # Glock 18C fire-selector lever on the rear left flank
    selector = extrude_profile("FireSelector",
                               [(at(-0.004), -0.0192), (at(0.018), -0.0182),
                                (at(0.020), -0.0236), (at(-0.002), -0.0252)],
                               0.0032, steel, gun, smooth=False, bevel=0.0006)
    selector.location.x = -0.0154

    # ---- grip -------------------------------------------------------------
    pistol_grip("PistolGrip", frame_mat, gun, at(-0.032), -0.028, 0.090, -0.018, 0.0300,
                panels=True, panel_material=grip_mat)
    for index in range(5):
        z = -0.040 - 0.0155 * index
        for side in (-1, 1):
            ridge = extrude_profile("GripRidge%d_%d" % (index, side),
                                    rect_profile(at(-0.052), at(-0.014), z, z + 0.0055, chamfer=0.0012),
                                    0.0018, grip_mat, gun, smooth=False, bevel=0.0004)
            ridge.location.x = side * 0.0152

    # ---- moving parts -----------------------------------------------------
    magazine = group("Magazine", gun)
    mag_centre = at(-0.034)
    sweep("MagazineBody",
          [(mag_centre, -0.030, 0.054), (mag_centre - 0.001, -0.038, 0.054),
           (mag_centre - 0.002, -0.046, 0.054), (mag_centre - 0.004, -0.062, 0.054),
           (mag_centre - 0.005, -0.070, 0.054), (mag_centre - 0.007, -0.086, 0.054),
           (mag_centre - 0.009, -0.096, 0.054)],
          0.0210, slide_mat, magazine, bevel=0.0022, segments=3)
    extrude_profile("MagazineFloorPlate",
                    rect_profile(mag_centre - 0.019, mag_centre + 0.043, -0.1370, -0.1205,
                                 chamfer=0.0026),
                    0.0325, frame_mat, magazine, smooth=False, bevel=0.0024)
    for index, z in enumerate((-0.048, -0.072, -0.096)):
        for side in (-1, 1):
            witness = extrude_profile("MagazineWitness%d_%d" % (index, side),
                                      rect_profile(mag_centre - 0.020, mag_centre + 0.020, z, z + 0.008),
                                      0.0008, bright, magazine, smooth=False)
            witness.location.x = side * 0.0106

    trigger = group("Trigger", gun)
    extrude_profile("TriggerBlade",
                    rect_profile(at(-0.010), at(0.000), -0.0455, -0.0235, chamfer=0.0018),
                    0.0092, steel, trigger, smooth=False, bevel=0.0012)
    box("TriggerSafety", (at(-0.0050), 0, -0.0340), (0.0054, 0.0044, 0.0140), bright, trigger, bevel=0.0005)

    # ---- anchors ----------------------------------------------------------
    anchor("ViewmodelAnchor", (0.0, at(-0.070), -0.030), root)
    anchor("Muzzle", (0.0, at(0.176), 0.0), root)
    anchor("LeftHandIK", (0.0, at(-0.030), -0.045), root)
    anchor("RightHandIK", (0.0, at(-0.070), -0.062), root)
    anchor("MagazineAnchor", (0.0, mag_centre - 0.006, -0.070), magazine)
    return root
