"""M4A1-S, authored from ``M4A1-S.png``.

The M4A1-S is the same carbine as the M4A4 with two configuration changes that
define its silhouette: a fat integral suppressor on a shortened barrel, and a
shorter 20-round STANAG magazine. The receiver, furniture and controls are
reused from ``m4a4`` so the two rifles stay mechanically consistent, while the
front end and magazine are rebuilt to the M4A1-S reference.

Reference calibration (M4A1-S.png + recovered mask): overall 0.905 m including
the suppressor, receiver top (carry-handle bridge) to magazine floor 0.36 m.
"""
from weapon_common import anchor, box, extrude_profile, group, rect_profile, tube
from weapon_parts import stepped_barrel

import m4a4

WEAPON_ID = "m4a1-s"
DISPLAY = "M4A1-S"
CATEGORY = "rifle"
TRIANGLE_HINT = 52000
HAS_REFERENCE = True

# --- M4A1-S specific geometry ---------------------------------------------
# The suppressor replaces the last stretch of barrel plus the birdcage hider.
BARREL_FRONT = 0.318
SUPPRESSOR_START = 0.300
MUZZLE_TIP = 0.632
SUPPRESSOR_RADIUS = 0.0212
FRONT_SIGHT_Y = 0.286
MAG_DROP = 0.130
WITNESS_ROWS = 3


def front_end(gun, m, barrel_front, muzzle_tip):
    """Short barrel with a quick-detach suppressor and the A2 sight base."""
    phosphate = m["phosphate"]
    steel = m["steel"]
    anodized = m["anodized"]
    gunmetal = m["gunmetal"]

    stepped_barrel("Barrel", phosphate, gun, [
        (0.046, 0.0156), (0.072, 0.0140), (0.140, 0.0110), (0.220, 0.0102),
        (0.280, 0.0100), (BARREL_FRONT, 0.0098),
    ], segments=40)
    tube("GasTube", [(0.084, 0.0040), (0.286, 0.0036)], 22, steel, gun,
         smooth=True).location.z = 0.0135

    # A2 front sight base keeps the M4A1-S identifiable from the M4A4
    m4a4._front_sight_base("FrontSightBase", phosphate, steel, gun, FRONT_SIGHT_Y)
    m4a4._swivel("FrontSwivel", steel, gun, FRONT_SIGHT_Y, -0.052, 0.009)

    # integral suppressor: mounting collar, knurled body, heat-shield rings
    collar = tube("SuppressorCollar", [(SUPPRESSOR_START - 0.014, 0.0150),
                                       (SUPPRESSOR_START + 0.006, 0.0192)],
                  36, gunmetal, gun, smooth=True)
    body = tube("Suppressor", [(SUPPRESSOR_START, SUPPRESSOR_RADIUS * 0.94),
                               (SUPPRESSOR_START + 0.010, SUPPRESSOR_RADIUS),
                               (muzzle_tip - 0.024, SUPPRESSOR_RADIUS),
                               (muzzle_tip - 0.014, SUPPRESSOR_RADIUS * 1.02),
                               (muzzle_tip - 0.006, SUPPRESSOR_RADIUS * 0.90),
                               (muzzle_tip, SUPPRESSOR_RADIUS * 0.74)],
                36, anodized, gun, smooth=True)
    for index in range(9):
        y = SUPPRESSOR_START + 0.026 + index * 0.031
        ring = tube("SuppressorRing%d" % index,
                    [(y - 0.0045, SUPPRESSOR_RADIUS * 1.03),
                     (y + 0.0045, SUPPRESSOR_RADIUS * 1.03)],
                    36, gunmetal, gun, smooth=True)
        ring.location.z = 0.0
    tube("SuppressorBore", [(muzzle_tip - 0.020, 0.0092), (muzzle_tip + 0.002, 0.0092)],
         24, steel, gun, smooth=True)
    tube("SuppressorCollarRing", [(SUPPRESSOR_START - 0.010, 0.0166),
                                  (SUPPRESSOR_START - 0.004, 0.0166)],
         32, steel, gun, smooth=True)
    extrude_profile("SuppressorIndex", rect_profile(SUPPRESSOR_START + 0.004,
                                                    SUPPRESSOR_START + 0.030,
                                                    -0.006, 0.006, chamfer=0.002),
                    0.048, steel, gun, smooth=False, bevel=0.0015)
    return body


def build(palette):
    root = group(WEAPON_ID + "_Root")
    gun = group(DISPLAY, root)

    magazine = group("Magazine", gun)
    bolt = group("BoltCarrier", gun)
    charging = group("ChargingHandle", gun)
    trigger = group("Trigger", gun)

    m4a4.receiver_bank(gun, palette)
    m4a4.furniture(gun, palette)
    front_end(gun, palette, BARREL_FRONT, MUZZLE_TIP)
    m4a4.controls(gun, palette, bolt, charging, trigger, magazine,
                  mag_drop=MAG_DROP, witness_rows=WITNESS_ROWS)
    # A flat-top carbine keeps the M4A4 rail; the M4A1-S adds a rail-mounted
    # rear backup sight because the carry handle is gone on the S variant.
    m4a4.box("RearBackupSight", (0.030, 0.0, 0.096), (0.036, 0.030, 0.020),
             palette["anodized"], gun, bevel=0.002)

    anchor("ViewmodelAnchor", (0.0, 0.058, -0.012), root)
    anchor("Muzzle", (0.0, MUZZLE_TIP + 0.004, 0.0), root)
    anchor("LeftHandIK", (0.0, 0.192, -0.046), root)
    anchor("RightHandIK", (0.0, -0.116, -0.058), root)
    anchor("MagazineAnchor", (0.0, -0.014, -0.040), magazine)
    return root
