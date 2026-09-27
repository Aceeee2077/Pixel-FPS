"""CZ75-Auto, authored from ``CZ75.png``.

Clean-room recreation following the same conventions as the other pistols:
Blender metres, bore axis at ``z = 0``, and ``y = 0`` at the FRONT OF THE
TRIGGER GUARD so the muzzle sits at a positive y (the validator requires the
Muzzle anchor ahead of the breech). +Y is the muzzle direction.

Reference calibration (CZ75.png + recovered mask): overall 0.207 m, a very tall
squared slide that overhangs the frame, near-parallel slide sides with a full
length of rear cocking serrations, a polymer frame with an accessory rail and a
pronounced beavertail, a squared trigger guard, and a short crowned barrel.
"""
from weapon_common import (anchor, box, extrude_profile, group, rect_profile,
                           slot_rail, sweep)
from weapon_parts import (closed_body, cylinder, ejection_port, magazine_well,
                          pistol_grip, screw_row, sight_front, sight_rear,
                          stepped_barrel, trigger_group)

WEAPON_ID = "cz75"
DISPLAY = "CZ75-Auto"
CATEGORY = "pistol"
TRIANGLE_HINT = 26000
HAS_REFERENCE = True

# --- master stations (metres, trigger-guard-front datum) ------------------
LAYOUT = {
    "muzzle": 0.207,
    "slide_front": 0.150,
    "slide_rear": -0.052,
    "slide_top": 0.0172,
    "slide_bottom": -0.0180,
    "frame_rear": -0.022,
    "guard_front": 0.000,
    "guard_bottom": -0.050,
    "grip_top": -0.026,
    "grip_bottom": -0.112,
    "mag_floor": -0.126,
}
FX = LAYOUT["muzzle"]


def build(palette):
    root = group(WEAPON_ID + "_Root")
    gun = group("CZ75Auto", root)

    steel = palette["steel"]
    metal = palette["gunmetal"]
    slide_mat = palette["anodized"]
    frame_mat = palette["polymer_grey"]
    grip_mat = palette["polymer"]
    bright = palette["bright"]

    def at(y):
        """Trigger-guard datum -> world y."""
        return y + FX

    # ---- slide: tall, squared, overhanging the frame at the rear ---------
    slide = group("Slide", gun)
    extrude_profile("SlideBody", closed_body([
        (at(LAYOUT["slide_rear"]), 0.0162, -0.0168),
        (at(-0.030), 0.0170, -0.0176),
        (at(0.040), 0.0172, -0.0180),
        (at(0.112), 0.0170, -0.0178),
        (at(0.140), 0.0160, -0.0168),
        (at(LAYOUT["slide_front"]), 0.0142, -0.0150),
    ]), 0.0268, slide_mat, slide, smooth=False, bevel=0.0024)

    # full-length cocking serrations, front and rear (the CZ75 signature)
    for block, start, count in (("Rear", -0.046, 12), ("Front", 0.058, 9)):
        for index in range(count):
            y = at(start + 0.0042 * index)
            for side in (-1, 1):
                bar = extrude_profile("SlideSerration%s%d_%d" % (block, index, side),
                                      rect_profile(y + 0.0014, y + 0.0032, -0.0126, 0.0126),
                                      0.0018, metal, slide, smooth=False, bevel=0.0004)
                bar.location.x = side * 0.0135
    # slide top flat with a slight bevel, plus a rear sight dovetail
    extrude_profile("SlideTop", rect_profile(at(-0.048), at(0.146), 0.0160, 0.0174, chamfer=0.0035),
                    0.0240, metal, slide, smooth=False, bevel=0.0018)
    ejection_port("EjectionPort", metal, gun, at(0.020), at(0.096), 0.0028, 0.0140, 0.0136,
                  depth=0.0032)
    box("Extractor", (at(0.098), 0.0136, 0.0076), (0.030, 0.0036, 0.0090), steel, slide, bevel=0.001)
    box("BreechFace", (at(0.030), 0.0, 0.0), (0.020, 0.0214, 0.0300), metal, slide, bevel=0.0015)

    # ---- frame: dust cover with a rail, squared guard, beavertail --------
    extrude_profile("Frame", closed_body([
        (at(LAYOUT["frame_rear"]), 0.0060, -0.0300),
        (at(-0.004), 0.0090, -0.0330),
        (at(0.062), 0.0092, -0.0340),
        (at(0.116), 0.0076, -0.0320),
        (at(0.142), 0.0040, -0.0290),
    ]), 0.0244, frame_mat, gun, smooth=False, bevel=0.0022)
    slot_rail("AccessoryRail", at(0.070), at(0.148), -0.0332, 0.0196, 0.0052, metal, gun,
              pitch=0.0126, slot=0.0062, depth=0.0034)
    # squared trigger guard, cut as two rails so the loop is genuinely open
    for side in (-1, 1):
        guard = extrude_profile("TriggerGuard%s" % ("L" if side < 0 else "R"), [
            (at(-0.030), -0.0240), (at(0.052), -0.0250),
            (at(0.056), -0.0500), (at(-0.028), -0.0492),
        ], 0.0036, frame_mat, gun, smooth=False, bevel=0.0012)
        guard.location.x = side * 0.0112
    extrude_profile("GuardFront", rect_profile(at(0.050), at(0.058), -0.0500, -0.0240, chamfer=0.004),
                    0.0248, frame_mat, gun, smooth=False, bevel=0.0016)
    extrude_profile("Beavertail", [
        (at(-0.022), -0.0200), (at(-0.056), -0.0260), (at(-0.062), -0.0320), (at(-0.020), -0.0296),
    ], 0.0230, frame_mat, gun, smooth=False, bevel=0.0018)

    pistol_grip("PistolGrip", grip_mat, gun, at(-0.040), -0.0270, 0.0860, 0.0210, 0.0232,
                panels=True, panel_material=frame_mat)
    box("GripTexture", (at(-0.052), 0.0, -0.0870), (0.046, 0.0250, 0.0036), metal, gun, bevel=0.0008)

    # ---- controls: ambi safety, slide stop, mag release, select fire -----
    for side in (-1, 1):
        lever = extrude_profile("SafetyLever%s" % ("L" if side < 0 else "R"), [
            (at(-0.030), -0.0060), (at(0.006), -0.0076), (at(0.006), -0.0136), (at(-0.030), -0.0120),
        ], 0.0034, steel, gun, smooth=False, bevel=0.0010)
        lever.location.x = side * 0.0132
    for side in (-1, 1):
        stop = extrude_profile("SlideStop%s" % ("L" if side < 0 else "R"), [
            (at(0.006), -0.0196), (at(0.030), -0.0200), (at(0.030), -0.0272), (at(0.006), -0.0268),
        ], 0.0034, steel, gun, smooth=False, bevel=0.0010)
        stop.location.x = side * 0.0130
    extrude_profile("MagazineRelease", rect_profile(at(-0.014), at(0.004), -0.0352, -0.0288, chamfer=0.003),
                    0.0292, steel, gun, smooth=False, bevel=0.0014)
    # select-fire switch: the CZ75-Auto's distinguishing external control
    extrude_profile("FireSelector", rect_profile(at(-0.062), at(-0.040), -0.0216, -0.0104, chamfer=0.004),
                    0.0072, steel, gun, smooth=False, bevel=0.0012)
    screw_row("FramePin", metal, gun, at(-0.024), at(0.020), 2, -0.0236, radius=0.0040, side=0.0)
    screw_row("HammerPin", metal, gun, at(-0.026), at(-0.026), 1, -0.0080, radius=0.0036, side=0.0)

    # ---- barrel + muzzle crown ------------------------------------------
    stepped_barrel("Barrel", bright, gun, [
        (at(0.116), 0.0110), (at(0.160), 0.0096), (at(0.190), 0.0090),
        (at(0.202), 0.0086), (at(0.207), 0.0082),
    ], segments=24)
    cylinder("BarrelCrown", bright, gun, at(0.198), at(0.208), 0.0092, 0.0, segments=24)
    tube_bore = cylinder("Bore", metal, gun, at(0.200), at(0.209), 0.0044, 0.0, segments=16)

    # ---- sights ---------------------------------------------------------
    sight_rear("RearSight", metal, gun, at(-0.040), 0.0172, 0.0058, width=0.0220,
               aperture_material=palette["anodized"])
    sight_front("FrontSight", metal, gun, at(0.134), 0.0166, 0.0086, width=0.0088,
                post_material=bright, wings=False)

    # ---- magazine -------------------------------------------------------
    magazine = group("Magazine", gun)
    magazine_well("MagazineWell", frame_mat, magazine, at(-0.070), at(-0.008), -0.0320, -0.0120, 0.0232)
    extrude_profile("MagazineBody", closed_body([
        (at(-0.070), -0.0330, -0.1240),
        (at(-0.012), -0.0336, -0.1250),
        (at(-0.010), -0.0276, -0.0360),
        (at(-0.068), -0.0276, -0.0360),
    ]), 0.0212, metal, magazine, smooth=False, bevel=0.0020)
    extrude_profile("MagazineFloorPlate", rect_profile(at(-0.074), at(-0.008), -0.1292, -0.1236, chamfer=0.003),
                    0.0236, steel, magazine, smooth=False, bevel=0.0016)
    for index in range(4):
        y = at(-0.064 + index * 0.0130)
        for side in (-1, 1):
            witness = extrude_profile("MagazineWitness%d_%d" % (index, side),
                                      rect_profile(y, y + 0.0062, -0.1080, -0.1010),
                                      0.0016, steel, magazine, smooth=False, bevel=0.0004)
            witness.location.x = side * 0.0106

    trigger = group("Trigger", gun)
    trigger_group("TriggerAssembly", steel, trigger, at(0.008), -0.0300,
                  guard_material=frame_mat, blade_material=steel)

    hammer = group("Hammer", gun)
    extrude_profile("HammerSpur", [
        (at(-0.030), -0.0050), (at(-0.052), -0.0140), (at(-0.048), -0.0196), (at(-0.026), -0.0120),
    ], 0.0104, steel, hammer, smooth=False, bevel=0.0012)

    anchor("ViewmodelAnchor", (0.0, at(0.02), -0.016), root)
    anchor("Muzzle", (0.0, at(0.209), 0.0), root)
    anchor("LeftHandIK", (0.0, at(0.010), -0.062), root)
    anchor("RightHandIK", (0.0, at(-0.044), -0.060), root)
    anchor("MagazineAnchor", (0.0, at(-0.040), -0.084), magazine)
    return root
