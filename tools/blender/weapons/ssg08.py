"""SSG 08 (Steyr Scout derivative), authored from class knowledge.

NO REFERENCE ART: there is no rendered art for this weapon in the repository, so
every number below comes from the published dimensions of the class of rifle it
belongs to -- a 1.07 m bolt-action scout rifle -- rather than from a measured
reference sheet. It should be treated as an authored interpretation, and it is
deliberately lighter and sleeker than the AWP: a slimmer stock, a smaller
objective, a lighter free-floating barrel and a shorter action.

Datum is the same as every other module: bore axis at ``z = 0``, ``y = 0`` at the
receiver front face, +Y toward the muzzle.

Distinctive features: tapered barrel with a slotted muzzle brake, slim polymer
thumbhole stock with an adjustable cheekpiece, 10-round box magazine ahead of
the trigger, smooth (non-fluted) bolt handle with a round knob, and a light
synthetic chassis.
"""
import math

from weapon_common import (anchor, box, extrude_profile, group, rect_profile,
                           slot_rail, sweep, tube)
from weapon_detail import (flutes, hollow_slab, knurl_ring, optic, scope_ring)
from weapon_parts import (bolt_handle, cylinder, ejection_port, magazine_well,
                          muzzle_device, pistol_grip, receiver, sling_loop,
                          stepped_barrel, trigger_group)

WEAPON_ID = "ssg-08"
DISPLAY = "SSG 08"
CATEGORY = "sniper"
TRIANGLE_HINT = 62000

# --- master stations (metres, bore datum) ---------------------------------
RECEIVER_REAR = -0.176
RECEIVER_FRONT = 0.008
RECEIVER_TOP = 0.032
RECEIVER_BOTTOM = -0.030
RECEIVER_WIDTH = 0.042
RAIL_TOP = 0.046
BARREL_FRONT = 0.396
MUZZLE_TIP = 0.538
FOREND_FRONT = 0.118
BUTT_REAR = -0.532
SCOPE_AXIS = 0.062
SCOPE_OBJECTIVE = 0.026
SCOPE_OCULAR = -0.302
STOCK_WIDTH = 0.040

# Slim thumbhole stock: clockwise in (y, z) so outward normals face +X.
STOCK_OUTER = [
    (-0.026, -0.034),   # A
    (-0.046, -0.112),   # B
    (-0.064, -0.148),   # C
    (-0.092, -0.176),   # D
    (-0.170, -0.190),   # E
    (-0.290, -0.192),   # F
    (-0.420, -0.190),   # G
    (-0.512, -0.178),   # H
    (-0.540, -0.152),   # I
    (-0.534, -0.024),   # J
    (-0.498, -0.020),   # K
    (-0.404, -0.048),   # L
    (-0.336, -0.056),   # M
    (-0.268, -0.050),   # N
    (-0.206, -0.036),   # O
    (-0.120, -0.024),   # P
    (-0.052, -0.018),   # Q
]
STOCK_HOLE = [
    (-0.244, -0.058),   # a
    (-0.278, -0.056),   # b
    (-0.312, -0.070),   # c
    (-0.344, -0.092),   # d
    (-0.342, -0.124),   # e
    (-0.310, -0.144),   # f
    (-0.272, -0.148),   # g
    (-0.246, -0.114),   # h
]
STOCK_STATIONS = [
    (-STOCK_WIDTH * 0.500, 1.000, 0.000, 0.000),
    (-STOCK_WIDTH * 0.470, 1.012, -0.001, 0.001),
    (-STOCK_WIDTH * 0.400, 1.026, -0.002, 0.002),
    (-STOCK_WIDTH * 0.280, 1.034, -0.003, 0.003),
    (-STOCK_WIDTH * 0.120, 1.038, -0.003, 0.003),
    (STOCK_WIDTH * 0.080, 1.037, -0.003, 0.003),
    (STOCK_WIDTH * 0.240, 1.032, -0.002, 0.002),
    (STOCK_WIDTH * 0.380, 1.020, -0.001, 0.001),
    (STOCK_WIDTH * 0.470, 1.006, 0.000, 0.000),
    (STOCK_WIDTH * 0.500, 1.000, 0.000, 0.000),
]


def build(palette):
    root = group(WEAPON_ID + "_Root")
    gun = group(DISPLAY, root)

    metal = palette["gunmetal"]        # barrel, brake, rail
    action = palette["phosphate"]      # parkerized receiver and bolt shroud
    shell = palette["polymer"]         # black synthetic chassis
    glass = palette["glass"]
    steel = palette["steel"]           # bolt, screws, swivels

    # ---- receiver: slim round-bottomed action with a flat top -------------
    receiver("Action", action, gun, [
        (RECEIVER_REAR, RECEIVER_TOP, RECEIVER_BOTTOM),
        (RECEIVER_REAR + 0.016, RECEIVER_TOP + 0.002, RECEIVER_BOTTOM - 0.002),
        (-0.150, RECEIVER_TOP + 0.002, RECEIVER_BOTTOM - 0.003),
        (-0.112, RECEIVER_TOP + 0.002, RECEIVER_BOTTOM - 0.003),
        (-0.074, RECEIVER_TOP + 0.002, RECEIVER_BOTTOM - 0.003),
        (-0.036, RECEIVER_TOP + 0.001, RECEIVER_BOTTOM - 0.003),
        (-0.010, RECEIVER_TOP, RECEIVER_BOTTOM - 0.002),
        (RECEIVER_FRONT, RECEIVER_TOP - 0.006, RECEIVER_BOTTOM + 0.004),
    ], RECEIVER_WIDTH, bevel=0.0025)

    slot_rail("Rail", -0.162, RECEIVER_FRONT, RECEIVER_TOP, RECEIVER_WIDTH * 0.84,
              0.013, metal, gun, pitch=0.021, slot=0.011, depth=0.008)

    cylinder("BarrelTenon", metal, gun, -0.028, 0.018, 0.0175, segments=44, bevel=0.0015)
    cylinder("BoltShroud", action, gun, RECEIVER_REAR - 0.022, RECEIVER_REAR + 0.012, 0.0155,
             z=0.006, segments=32, bevel=0.002)

    ejection_port("EjectionPort", palette["anodized"], gun, 0.030, 0.104, -0.008, 0.020,
                  RECEIVER_WIDTH * 0.5 + 0.001, depth=0.005)
    box("MarkingsPanel", (-0.120, RECEIVER_WIDTH * 0.5 + 0.0015, -0.004),
        (0.058, 0.003, 0.016), steel, gun, bevel=0.0012)
    for index in range(2):
        screw = cylinder("ActionScrew%d" % index, steel, gun, -0.150 + index * 0.072,
                         -0.150 + index * 0.072, 0.006, z=-0.016, segments=16)
        screw.rotation_euler = (0, math.pi / 2, 0)
        screw.location.x = RECEIVER_WIDTH * 0.52

    # ---- barrel: light, tapered, free-floating ----------------------------
    stepped_barrel("Barrel", metal, gun, [
        (-0.014, 0.0168), (-0.002, 0.0166), (0.014, 0.0162), (0.032, 0.0156),
        (0.052, 0.0150), (0.074, 0.0144), (0.098, 0.0138), (0.124, 0.0132),
        (0.152, 0.0127), (0.182, 0.0123), (0.214, 0.0120), (0.248, 0.0118),
        (0.284, 0.0116), (0.320, 0.0115), (0.358, 0.0114), (BARREL_FRONT, 0.0113),
    ], segments=64)
    flutes("BarrelFlute", metal, gun, 0.070, 0.360, 0.0130, 8, stations=34)

    # slotted muzzle brake: the SSG 08's three-slot baffle stack
    muzzle_device("MuzzleBrake", metal, gun, BARREL_FRONT - 0.008, MUZZLE_TIP - 0.006,
                  0.0165, ports=3, port_material=palette["anodized"], flare=0.004)
    cylinder("MuzzleCrown", palette["anodized"], gun, MUZZLE_TIP - 0.012, MUZZLE_TIP,
             0.0128, segments=32, bevel=0.0015)
    for index in range(3):
        y = MUZZLE_TIP - 0.098 + index * 0.030
        box("BrakeSlot%d" % index, (y, 0, 0), (0.008, 0.030, 0.046),
            palette["anodized"], gun, bevel=0.0015)

    # ---- chassis: light forend and slim thumbhole stock -------------------
    receiver("Forend", shell, gun, [
        (RECEIVER_FRONT - 0.022, 0.030, -0.046),
        (-0.006, 0.032, -0.050),
        (0.020, 0.033, -0.051),
        (0.052, 0.031, -0.050),
        (0.088, 0.026, -0.044),
        (FOREND_FRONT, 0.016, -0.032),
    ], 0.052, bevel=0.003)
    slot_rail("ForendRail", 0.020, 0.104, -0.056, 0.022, 0.008, metal, gun,
              pitch=0.024, slot=0.011, depth=0.005)
    sling_loop("SlingSwivelFront", steel, gun, 0.036, -0.056, 0.009)

    hollow_slab("Stock", STOCK_OUTER, STOCK_HOLE, STOCK_STATIONS, shell, gun,
                bevel=0.004, bevel_segments=4)

    extrude_profile("ButtPad", [
        (-0.526, -0.024), (-0.536, -0.034), (-0.536, -0.164), (-0.524, -0.152),
    ], STOCK_WIDTH * 1.08, palette["rubber"], gun, smooth=False, bevel=0.0045)
    extrude_profile("CheekRiser", [
        (-0.348, -0.026), (-0.370, -0.020), (-0.408, -0.024), (-0.448, -0.032),
        (-0.476, -0.036), (-0.464, -0.050), (-0.412, -0.044), (-0.366, -0.038),
        (-0.352, -0.040),
    ], STOCK_WIDTH * 0.62, shell, gun, smooth=False, bevel=0.0035)
    for index in range(2):
        knob = cylinder("CheekScrew%d" % index, steel, gun, -0.386 - index * 0.056,
                        -0.386 - index * 0.056, 0.006, z=-0.054, segments=16)
        knob.rotation_euler = (0, math.pi / 2, 0)
        knob.location.x = STOCK_WIDTH * 0.32
    sling_loop("SlingSwivelRear", steel, gun, -0.494, -0.170, 0.010)

    # ---- optic: compact 40 mm objective on tall rings --------------------
    optic("Scope", action, gun, SCOPE_OBJECTIVE, SCOPE_OCULAR, SCOPE_AXIS, 0.0150,
          0.0210, 0.0168, glass, palette["anodized"], RAIL_TOP - 0.002,
          (-0.140, -0.030), segments=40)
    scope_ring("ScopeClampRing", palette["anodized"], gun, -0.140, SCOPE_AXIS, 0.0150, 0.014)
    scope_ring("ScopeClampRing2", palette["anodized"], gun, -0.030, SCOPE_AXIS, 0.0150, 0.014)
    knurl_ring("MagnificationRing", steel, gun, SCOPE_OCULAR - 0.040, SCOPE_OCULAR - 0.028,
               SCOPE_AXIS, 0.0176, 12, 0.0020)

    # ---- moving parts (kept separate for reload / fire animation) --------
    magazine = group("Magazine", gun)
    sweep("MagazineBody", [
        (0.176, -0.040, 0.086), (0.174, -0.058, 0.086), (0.172, -0.076, 0.085),
        (0.170, -0.094, 0.085), (0.168, -0.112, 0.084), (0.166, -0.130, 0.083),
        (0.164, -0.148, 0.082), (0.162, -0.166, 0.080), (0.160, -0.184, 0.078),
        (0.158, -0.202, 0.076),
    ], 0.032, steel, magazine, bevel=0.0022)
    extrude_profile("MagazineFloor", rect_profile(0.112, 0.208, -0.216, -0.202, chamfer=0.005),
                    0.066, action, magazine, smooth=False, bevel=0.0025)
    extrude_profile("MagazineSpine", rect_profile(0.118, 0.202, -0.190, -0.044, chamfer=0.004),
                    0.009, action, magazine, smooth=False, bevel=0.0015)
    box("MagazineCatch", (0.130, 0, -0.036), (0.020, 0.044, 0.012), steel, magazine, bevel=0.002)
    magazine_well("MagazineWell", action, gun, 0.124, 0.212, RECEIVER_BOTTOM,
                  RECEIVER_BOTTOM - 0.016, RECEIVER_WIDTH * 1.06)

    bolt = group("BoltCarrier", gun)
    cylinder("BoltBody", steel, bolt, -0.058, 0.128, 0.0118, segments=44, bevel=0.0015)
    bolt_handle("BoltHandle", steel, bolt, -0.122, -0.026, 0.132, knob_radius=0.014,
                angle=-2.392)
    knob = tube("BoltKnob",
                [(-0.013, 0.005), (-0.011, 0.009), (-0.006, 0.0125), (0.0, 0.0138),
                 (0.006, 0.0125), (0.011, 0.009), (0.013, 0.005)],
                30, steel, bolt, smooth=True)
    knob.rotation_euler = (0, math.pi / 2, 0)
    knob.location = (0.0, 0.238, 0.020)

    trigger = group("Trigger", gun)
    trigger_group("TriggerAssembly", steel, trigger, 0.212, -0.052,
                  guard_material=action, blade_material=steel, width=0.026)

    pistol_grip("PistolGrip", shell, gun, -0.262, -0.188, 0.100, -0.026, 0.036,
                panels=True, panel_material=palette["anodized"])

    anchor("ViewmodelAnchor", (0.0, 0.060, -0.012), root)
    anchor("Muzzle", (0.0, MUZZLE_TIP + 0.004, 0.0), root)
    anchor("LeftHandIK", (0.0, 0.132, -0.048), root)
    anchor("RightHandIK", (0.0, -0.212, -0.104), root)
    anchor("MagazineAnchor", (0.0, 0.166, -0.048), magazine)
    return root
