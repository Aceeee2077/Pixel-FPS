"""AWP (Accuracy International Arctic Warfare Police), authored from ``AWP.png``.

Clean-room recreation: the reference is used only for silhouette proportions and
colour zoning. Datum is the bore axis (``z = 0``) with ``y = 0`` at the receiver
front face, so every number below reads directly off the reference.

Reference calibration (vision report, muzzle to the LEFT, 1254 px canvas,
total length 1.24 m -> 0.0009 m/px, receiver front at px 620, bore at py 494):
  muzzle brake px 20-138 (diameter 46 px), exposed barrel px 140-470,
  forend tip px 473, receiver px 738-976, rail top py 528, action bottom py 596,
  scope objective front px 608, bell 87 px, tube 45 px, ocular rear px 1016,
  elevation turret py 393, magazine px 770-876 / py 664-730,
  trigger blade px 915, thumbhole void px 962-1032 / py 655-748,
  folded bipod px 222-560 / py 553-606 with a coil, stock rear px 1234.

The rifle is a two-tone build: black metal (barrel, action, muzzle brake, bolt,
magazine, bipod, buttpad, rail, mounts) on an olive-green polymer chassis with a
real thumbhole cut through the stock, a long free-floating barrel, a large
objective bell and a ball-ended bolt handle.
"""
import math

from weapon_common import (anchor, box, extrude_profile, group, rect_profile,
                           slot_rail, sweep, tube)
from weapon_detail import (flutes, hollow_slab, knurl_ring, optic, scope_ring)
from weapon_parts import (bipod, bolt_handle, cylinder, ejection_port,
                          magazine_well, muzzle_device, pistol_grip, receiver,
                          sling_loop, stepped_barrel)

WEAPON_ID = "awp"
DISPLAY = "AWP"
CATEGORY = "sniper"
TRIANGLE_HINT = 72000

# --- master stations (metres, bore datum) ---------------------------------
# Calibrated from the reference; y = 0 is the receiver front face.
RECEIVER_REAR = -0.216
RECEIVER_FRONT = 0.006
RECEIVER_TOP = 0.039
RECEIVER_BOTTOM = -0.014
RECEIVER_WIDTH = 0.048
RAIL_TOP = 0.054
BARREL_FRONT = 0.420
MUZZLE_TIP = 0.538
BUTT_REAR = -0.610
FOREND_FRONT = 0.132
SCOPE_AXIS = 0.050
SCOPE_OBJECTIVE = 0.011
SCOPE_OCULAR = -0.351

# Stock outline: clockwise in the (y, z) plane so face normals point outward.
STOCK_OUTER = [
    (-0.034, -0.024),   # A receiver bottom / wrist front
    (-0.052, -0.120),   # B
    (-0.070, -0.162),   # C small of the grip
    (-0.100, -0.196),   # D
    (-0.190, -0.209),   # E belly of the thumbhole stock
    (-0.330, -0.210),   # F grip heel
    (-0.470, -0.205),   # G
    (-0.580, -0.194),   # H butt bottom
    (-0.610, -0.172),   # I toe
    (-0.604, -0.028),   # J heel
    (-0.560, -0.020),   # K butt comb
    (-0.452, -0.058),   # L
    (-0.380, -0.066),   # M
    (-0.300, -0.058),   # N
    (-0.240, -0.042),   # O
    (-0.172, -0.026),   # P
    (-0.080, -0.014),   # Q
]
# Thumbhole void, same winding as the outline. The reference void is 63 x 84 mm
# at px 962-1032 / 655-748, i.e. y -0.314 .. -0.250 and z -0.059 .. -0.142.
STOCK_HOLE = [
    (-0.268, -0.054),   # a hole top front
    (-0.316, -0.051),   # b
    (-0.358, -0.070),   # c
    (-0.396, -0.098),   # d hole rear
    (-0.394, -0.134),   # e
    (-0.354, -0.158),   # f
    (-0.304, -0.162),   # g hole bottom front
    (-0.272, -0.114),   # h
]
STOCK_WIDTH = 0.046
# Cross-sections along the width: the flanks swell at the wrist and the butt and
# stay slimmer through the thumbhole, which is the AWP's moulded side profile.
STOCK_STATIONS = [
    (-STOCK_WIDTH * 0.500, 1.000, 0.000, 0.000),
    (-STOCK_WIDTH * 0.488, 1.004, 0.000, 0.000),
    (-STOCK_WIDTH * 0.470, 1.009, -0.001, 0.000),
    (-STOCK_WIDTH * 0.430, 1.018, -0.001, 0.001),
    (-STOCK_WIDTH * 0.370, 1.027, -0.002, 0.002),
    (-STOCK_WIDTH * 0.300, 1.033, -0.002, 0.003),
    (-STOCK_WIDTH * 0.220, 1.037, -0.003, 0.003),
    (-STOCK_WIDTH * 0.140, 1.039, -0.003, 0.003),
    (-STOCK_WIDTH * 0.060, 1.040, -0.003, 0.003),
    (STOCK_WIDTH * 0.020, 1.040, -0.003, 0.003),
    (STOCK_WIDTH * 0.100, 1.038, -0.003, 0.003),
    (STOCK_WIDTH * 0.190, 1.035, -0.003, 0.003),
    (STOCK_WIDTH * 0.280, 1.030, -0.002, 0.002),
    (STOCK_WIDTH * 0.360, 1.024, -0.002, 0.002),
    (STOCK_WIDTH * 0.430, 1.016, -0.001, 0.001),
    (STOCK_WIDTH * 0.480, 1.006, 0.000, 0.000),
    (STOCK_WIDTH * 0.500, 1.000, 0.000, 0.000),
]


# --------------------------------------------------------------------------
# local detail helpers
# --------------------------------------------------------------------------
def _hex_bolt(name, material, parent, centre_y, centre_z, radius, length, x=0.0):
    """Hex-head action screw: a six-sided head on a short shank."""
    head = tube(name, [(-radius * 0.6, radius * 0.5), (radius * 0.6, radius)],
                6, material, parent, smooth=False)
    head.rotation_euler = (0, math.pi / 2, 0)
    head.location = (x, centre_y, centre_z)
    shank = tube(name + "Shank", [(-length, radius * 0.42), (0.0, radius * 0.42)],
                 10, material, parent, smooth=True)
    shank.rotation_euler = (0, math.pi / 2, 0)
    shank.location = (x, centre_y, centre_z)
    return head


def _coil(name, material, parent, y, z, turns, turn_radius, wire_radius, x=0.0):
    """Coiled spring section, drawn as a stack of rings around the leg axis."""
    made = []
    for index in range(turns):
        turn = tube("%s%d" % (name, index), [(0.0, wire_radius), (turn_radius, wire_radius)],
                    14, material, parent, smooth=True)
        turn.rotation_euler = (0, math.pi / 2, 0)
        turn.location = (x, y, z)
        made.append(turn)
    return made


def _flat_tube(name, material, parent, sections, segments, flat, z):
    """Tube squashed on Z, for the flattened bipod leg collars. The squash is
    built into the section radii so the object keeps a unit scale."""
    obj = tube(name, [(y, radius, radius * flat) for y, radius in sections],
               segments, material, parent, smooth=True)
    obj.location.z = z
    return obj


# --------------------------------------------------------------------------
# build
# --------------------------------------------------------------------------
def build(palette):
    root = group(WEAPON_ID + "_Root")
    gun = group("AWP", root)

    metal = palette["gunmetal"]           # barrel, brake, bolt, magazine, rail
    action = palette["anodized"]          # action, bipod and receiver furniture
    olive = palette["polymer_green"]      # chassis polymer (stock/forend/grip)
    scope_body = palette["phosphate"]     # olive scope tube and its mounts
    glass = palette["glass"]
    rubber = palette["rubber"]            # recoil pad
    steel = palette["steel"]              # bright small parts and the bolt knob

    # ---- receiver: folded action with an integral flat top ----------------
    receiver("Action", action, gun, [
        (RECEIVER_REAR, RECEIVER_TOP, RECEIVER_BOTTOM),
        (RECEIVER_REAR + 0.018, RECEIVER_TOP + 0.002, RECEIVER_BOTTOM - 0.002),
        (-0.196, RECEIVER_TOP + 0.003, RECEIVER_BOTTOM - 0.003),
        (-0.162, RECEIVER_TOP + 0.003, RECEIVER_BOTTOM - 0.003),
        (-0.124, RECEIVER_TOP + 0.003, RECEIVER_BOTTOM - 0.004),
        (-0.084, RECEIVER_TOP + 0.003, RECEIVER_BOTTOM - 0.004),
        (-0.046, RECEIVER_TOP + 0.002, RECEIVER_BOTTOM - 0.004),
        (-0.012, RECEIVER_TOP + 0.001, RECEIVER_BOTTOM - 0.003),
        (RECEIVER_FRONT - 0.016, RECEIVER_TOP, RECEIVER_BOTTOM - 0.002),
        (RECEIVER_FRONT, RECEIVER_TOP - 0.008, RECEIVER_BOTTOM + 0.006),
    ], RECEIVER_WIDTH, bevel=0.003)

    # barrel tenon / recoil lug ahead of the action face
    cylinder("BarrelTenon", metal, gun, -0.034, 0.020, 0.0195, segments=48, bevel=0.0015)
    cylinder("RecoilLug", action, gun, -0.038, -0.018, 0.0235, z=-0.014, segments=22)

    # picatinny top rail: base bar plus transverse recoil slots
    slot_rail("Rail", -0.200, RECEIVER_FRONT, RECEIVER_TOP, RECEIVER_WIDTH * 0.86,
              0.015, metal, gun, pitch=0.021, slot=0.011, depth=0.009)

    # receiver markings panel and the action screws
    box("MarkingsPanel", (-0.150, RECEIVER_WIDTH * 0.5 + 0.0015, -0.002),
        (0.076, 0.003, 0.020), steel, gun, bevel=0.0012)
    for index in range(3):
        _hex_bolt("ActionScrew%d" % index, steel, gun, -0.196 + index * 0.082, -0.010,
                  0.0075, 0.006, x=RECEIVER_WIDTH * 0.50)

    # ejection port on the right flank (right is +X)
    ejection_port("EjectionPort", palette["anodized"], gun, 0.040, 0.132, -0.004, 0.026,
                  RECEIVER_WIDTH * 0.5 + 0.001, depth=0.005)

    # bolt shroud, cocking indicator and the bolt-release button at the rear
    cylinder("BoltShroud", metal, gun, RECEIVER_REAR - 0.026, RECEIVER_REAR + 0.014, 0.017,
             z=0.010, segments=36, bevel=0.002)
    cylinder("CockingIndicator", steel, gun, RECEIVER_REAR - 0.034, RECEIVER_REAR - 0.024,
             0.006, z=0.010, segments=20)
    cylinder("BoltRelease", steel, gun, RECEIVER_REAR - 0.016, RECEIVER_REAR - 0.006, 0.0075,
             z=-0.024, segments=20, bevel=0.001)

    # ---- barrel: long, free-floating, heavy at the tenon ------------------
    stepped_barrel("Barrel", metal, gun, [
        (-0.020, 0.0175), (-0.007, 0.01745), (0.006, 0.0174), (0.019, 0.0173),
        (0.032, 0.0172), (0.045, 0.0170), (0.058, 0.0169), (0.071, 0.0167),
        (0.084, 0.0165), (0.097, 0.0162), (0.110, 0.0160), (0.125, 0.0157),
        (0.140, 0.0154), (0.155, 0.0151), (0.170, 0.0149), (0.185, 0.0147),
        (0.200, 0.0146), (0.215, 0.0144), (0.230, 0.0143), (0.245, 0.0141),
        (0.260, 0.0140), (0.275, 0.0138), (0.290, 0.0136), (0.305, 0.0134),
        (0.320, 0.0133), (0.335, 0.0131), (0.350, 0.0130), (0.365, 0.0128),
        (0.380, 0.0127), (0.400, 0.0125), (BARREL_FRONT, 0.0124),
    ], segments=80)
    flutes("BarrelFlute", metal, gun, 0.060, 0.400, 0.0150, 10, stations=40)

    muzzle_device("MuzzleBrake", metal, gun, BARREL_FRONT, MUZZLE_TIP, 0.0207,
                  ports=3, port_material=palette["anodized"], flare=0.006)
    # muzzle crown ring so the bore does not read as a flat cap
    cylinder("MuzzleCrown", palette["anodized"], gun, MUZZLE_TIP - 0.004, MUZZLE_TIP + 0.002,
             0.0150, segments=22)
    # under-barrel accessory rail on the forend
    slot_rail("ForendRail", 0.028, 0.118, -0.036, 0.026, 0.010, metal, gun,
              pitch=0.022, slot=0.011, depth=0.006)

    # ---- chassis: forend and thumbhole stock ------------------------------
    receiver("Forend", olive, gun, [
        (RECEIVER_FRONT - 0.026, 0.038, -0.030),
        (-0.010, 0.040, -0.033),
        (0.026, 0.041, -0.034),
        (0.062, 0.040, -0.034),
        (0.098, 0.036, -0.032),
        (FOREND_FRONT, 0.030, -0.026),
    ], 0.062, bevel=0.004)
    # aluminium chassis side plates
    receiver("ForendPlate", action, gun, [
        (0.006, 0.030, -0.028),
        (0.046, 0.031, -0.030),
        (0.086, 0.030, -0.030),
        (0.124, 0.024, -0.022),
    ], 0.068, bevel=0.003)
    sling_loop("SlingSwivelFront", steel, gun, 0.040, -0.042, 0.010)

    hollow_slab("Stock", STOCK_OUTER, STOCK_HOLE, STOCK_STATIONS, olive, gun,
                 bevel=0.004, bevel_segments=4)

    # recoil pad (the pad hangs below the stock line on a real AW) and the
    # adjustable cheekpiece further back on the comb
    extrude_profile("ButtPad", [
        (-0.606, -0.024), (-0.618, -0.032), (-0.624, -0.046), (-0.622, -0.206),
        (-0.614, -0.216), (-0.604, -0.196),
    ], STOCK_WIDTH * 1.06, rubber, gun, smooth=False, bevel=0.005)
    extrude_profile("CheekRiser", [
        (-0.412, -0.020), (-0.432, -0.014), (-0.470, -0.017), (-0.510, -0.022),
        (-0.540, -0.026), (-0.530, -0.040), (-0.494, -0.036), (-0.448, -0.031),
        (-0.418, -0.034),
    ], STOCK_WIDTH * 0.64, olive, gun, smooth=False, bevel=0.004)
    for index in range(2):
        knob = cylinder("CheekScrew%d" % index, steel, gun, -0.444 - index * 0.066,
                        -0.436 - index * 0.066, 0.0065, z=-0.048, segments=16)
        knob.rotation_euler = (0, math.pi / 2, 0)
        knob.location.x = STOCK_WIDTH * 0.34
    # rear sling swivel through the toe of the stock
    sling_loop("SlingSwivelRear", steel, gun, -0.560, -0.186, 0.011)

    # ---- folded forward bipod with a coil spring section ------------------
    # Deployed at px 222-560 / py 553-606 in the reference: the legs hang just
    # clear of the barrel and the coil section sits at the forward end.
    bipod("Bipod", action, gun, 0.066, 0.360, -0.058, -0.086, width=0.026,
          leg_material=metal, foot=True, coil=False)
    box("BipodHinge", (0.058, 0, -0.062), (0.040, 0.052, 0.020), action, gun, bevel=0.004)
    for index, station in enumerate((0.150, 0.238, 0.326)):
        _flat_tube("BipodCollar%d" % index, metal, gun,
                   [(station - 0.009, 0.0130), (station + 0.009, 0.0130)], 24, 0.55, -0.070)
    _coil("BipodCoil", steel, gun, 0.352, -0.070, 7, 0.0125, 0.0034)

    # ---- optic: large objective bell, turrets, rings on the rail ----------
    optic("Scope", scope_body, gun, SCOPE_OBJECTIVE, SCOPE_OCULAR, SCOPE_AXIS, 0.0225,
           0.039, 0.0245, glass, palette["anodized"], RAIL_TOP - 0.002,
           (-0.176, -0.062), segments=44)
    cylinder("ScopeRingFront", metal, gun, SCOPE_OBJECTIVE + 0.004, SCOPE_OBJECTIVE + 0.016,
             0.0385, z=SCOPE_AXIS, segments=44, bevel=0.0015)
    cylinder("ScopeRingMid", metal, gun, SCOPE_OBJECTIVE + 0.030, SCOPE_OBJECTIVE + 0.040,
             0.0370, z=SCOPE_AXIS, segments=44, bevel=0.0015)
    cylinder("MagRing", metal, gun, SCOPE_OCULAR - 0.032, SCOPE_OCULAR - 0.014, 0.0265,
             z=SCOPE_AXIS, segments=44, bevel=0.0015)
    cylinder("Dioptre", palette["anodized"], gun, SCOPE_OCULAR - 0.014, SCOPE_OCULAR + 0.004,
             0.0245, z=SCOPE_AXIS, segments=44, bevel=0.0015)
    for index, station in enumerate((-0.176, -0.062)):
        scope_ring("ScopeClampRing%d" % index, palette["anodized"], gun, station,
                    SCOPE_AXIS, 0.0225, 0.0155)
    knurl_ring("MagnificationRing", steel, gun, SCOPE_OCULAR - 0.044, SCOPE_OCULAR - 0.032,
                SCOPE_AXIS, 0.0262, 14, 0.0022)

    # ---- moving parts (kept separate for reload / fire animation) ---------
    magazine = group("Magazine", gun)
    sweep("MagazineBody", [
        (0.196, -0.056, 0.098), (0.194, -0.076, 0.098), (0.192, -0.096, 0.098),
        (0.190, -0.116, 0.097), (0.188, -0.136, 0.097), (0.186, -0.156, 0.096),
        (0.184, -0.176, 0.095), (0.180, -0.196, 0.094),
    ], 0.038, metal, magazine, bevel=0.0025)
    extrude_profile("MagazineFloor", rect_profile(0.132, 0.234, -0.216, -0.202, chamfer=0.005),
                    0.078, action, magazine, smooth=False, bevel=0.003)
    extrude_profile("MagazineSpine", rect_profile(0.138, 0.228, -0.196, -0.060, chamfer=0.004),
                    0.010, action, magazine, smooth=False, bevel=0.0015)
    box("MagazineCatch", (0.148, 0, -0.052), (0.024, 0.052, 0.014), steel, magazine, bevel=0.002)
    magazine_well("MagazineWell", action, gun, 0.144, 0.238, RECEIVER_BOTTOM,
                  RECEIVER_BOTTOM - 0.020, RECEIVER_WIDTH * 1.06)

    bolt = group("BoltCarrier", gun)
    cylinder("BoltBody", steel, bolt, -0.070, 0.150, 0.0132, segments=48, bevel=0.0015)
    bolt_handle("BoltHandle", steel, bolt, -0.150, -0.028, 0.150, knob_radius=0.016,
                angle=-2.392)
    knob = tube("BoltKnob",
                [(-0.016, 0.006), (-0.014, 0.011), (-0.008, 0.0155), (0.0, 0.017),
                 (0.008, 0.0155), (0.014, 0.011), (0.016, 0.006)],
                32, steel, bolt, smooth=True)
    knob.rotation_euler = (0, math.pi / 2, 0)
    knob.location = (0.0, 0.290, 0.022)

    trigger = group("Trigger", gun)
    extrude_profile("TriggerBlade", rect_profile(0.236, 0.246, -0.090, -0.048, chamfer=0.002),
                    0.010, steel, trigger, smooth=True, bevel=0.0012)
    extrude_profile("TriggerGuard", [
        (0.216, -0.040), (0.260, -0.038), (0.304, -0.040), (0.316, -0.060),
        (0.312, -0.094), (0.276, -0.098), (0.236, -0.098), (0.220, -0.070),
    ], 0.014, action, trigger, smooth=False, bevel=0.0015)
    box("TriggerShoe", (0.241, 0, -0.058), (0.020, 0.026, 0.012), action, trigger, bevel=0.0015)

    pistol_grip("PistolGrip", olive, gun, -0.290, -0.206, 0.108, -0.030, 0.040,
                panels=True, panel_material=palette["polymer_grey"])

    anchor("ViewmodelAnchor", (0.0, 0.070, -0.014), root)
    anchor("Muzzle", (0.0, MUZZLE_TIP + 0.004, 0.0), root)
    anchor("LeftHandIK", (0.0, 0.150, -0.046), root)
    anchor("RightHandIK", (0.0, -0.240, -0.118), root)
    anchor("MagazineAnchor", (0.0, 0.186, -0.062), magazine)
    return root
