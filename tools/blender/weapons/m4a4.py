"""M4A4 carbine, authored from ``M4A4.png``.

Clean-room recreation: the reference is used only for silhouette proportions
and colour zoning. Datum is the bore axis (``z = 0``) with ``y = 0`` at the
receiver front face, so every number below reads directly off the reference.

Reference calibration (vision report + recovered mask, muzzle to the right):
  0.840 m overall with the stock extended, muzzle tip +0.520, buttplate
  -0.320, receiver 0.154 m long, ribbed M4 handguard over the barrel section
  that ends at the A2 front sight base (y = 0.302), 30-round STANAG magazine
  dropping 0.198 m out of the magwell, CAR-15 collapsible buffer-tube stock,
  and a flat-top receiver carrying an integral A-frame carry handle with the
  rear aperture inside it.

``receiver_bank``, ``furniture`` and ``controls`` are shared verbatim with
``m4a1s.py``: the two carbines differ only in the muzzle assembly and the
magazine, exactly as the real weapons do.
"""
import math

from weapon_common import (anchor, arc_profile, box, extrude_profile, group,
                           loft, rect_profile, slot_rail, tube)
from weapon_parts import (curved_magazine, ejection_port, knurl, pistol_grip,
                          receiver, sight_rear, stepped_barrel)

WEAPON_ID = "m4a4"
DISPLAY = "M4A4"
CATEGORY = "rifle"
TRIANGLE_HINT = 55000

# --- master stations (metres, bore datum) ---------------------------------
RECEIVER_FRONT = 0.062
RECEIVER_REAR = -0.092
RECEIVER_TOP = 0.026
RECEIVER_BOTTOM = -0.030
RECEIVER_WIDTH = 0.038
RAIL_TOP = 0.038
HANDLE_OPEN = 0.062
HANDLE_TOP = 0.082
BARREL_FRONT = 0.470
MUZZLE_TIP = 0.520
BUTT_REAR = -0.320
HANDGUARD_REAR = 0.092
HANDGUARD_FRONT = 0.302
FRONT_SIGHT_Y = 0.302
MAG_FRONT = 0.024
MAG_BACK = -0.052
MAG_TOP = -0.011
MAG_DROP = 0.172
STOCK_FRONT = -0.158


# --------------------------------------------------------------------------
# small shared helpers
# --------------------------------------------------------------------------
def _swivel(name, material, parent, y, z, radius=0.010, thickness=0.0042, width=0.008):
    """Sling loop built from four bars so the hole reads all the way through."""
    bars = {
        "Top": (-thickness / 2, thickness / 2, radius - thickness, radius),
        "Bottom": (-thickness / 2, thickness / 2, -radius, -radius + thickness),
        "Front": (radius - thickness, radius, -radius + thickness, radius - thickness),
        "Rear": (-radius, -radius + thickness, -radius + thickness, radius - thickness),
    }
    for tag, (y0, y1, z0, z1) in bars.items():
        bar = extrude_profile("%s%s" % (name, tag),
                              rect_profile(y0, y1, z0, z1, chamfer=0.0009),
                              width, material, parent, smooth=False, bevel=0.0009)
        bar.location = (0.0, y, z)


def _guard(name, material, parent, y_back, y_front, z_top, z_bottom, width,
           thickness=0.0055):
    """Trigger guard as an open U, so the trigger sits inside a real loop."""
    arch = [
        (y_back, z_top), (y_back, z_bottom), (y_front, z_bottom), (y_front, z_top),
        (y_front - thickness, z_top), (y_front - thickness, z_bottom + thickness),
        (y_back + thickness, z_bottom + thickness), (y_back + thickness, z_top),
    ]
    return extrude_profile(name, arch, width, material, parent, smooth=False,
                           bevel=0.0018)


def _trigger(name, material, parent, y, z_top, z_bottom, width):
    """Curved trigger blade with a squared tip."""
    return extrude_profile(name, [
        (y - 0.0045, z_top), (y + 0.0040, z_top), (y + 0.0055, z_top - 0.016),
        (y + 0.0025, z_bottom), (y - 0.0035, z_bottom),
    ], width, material, parent, smooth=False, bevel=0.0015)


def _birdcage(name, material, bore_material, parent, y0, y1, radius):
    """M16A2 flash hider as an open cage: collar, five prongs, front ring.

    The slots are real gaps between forged prongs, wide enough to survive the
    silhouette at gameplay distance instead of painted-on decals.
    """
    tube(name + "Collar", [(y0, radius * 0.74), (y0 + 0.005, radius),
                           (y0 + 0.014, radius)], 56, material, parent, smooth=True)
    tube(name + "Ring", [(y1 - 0.013, radius), (y1 - 0.005, radius),
                         (y1, radius * 0.86)], 56, material, parent, smooth=True)
    for index in range(5):
        phi = -math.pi / 2 + math.tau * index / 5.0
        prong = extrude_profile(
            "%sProng%d" % (name, index),
            rect_profile(y0 + 0.012, y1 - 0.011, -0.0021, 0.0021, chamfer=0.0009),
            0.0055, material, parent, smooth=False, bevel=0.0012)
        prong.rotation_euler = (0, math.pi / 2 - phi, 0)
        prong.location = (math.cos(phi) * radius * 0.90, 0.0,
                          math.sin(phi) * radius * 0.90)
    tube(name + "Bore", [(y0, radius * 0.34), (y1 - 0.013, radius * 0.30)],
         32, bore_material, parent, smooth=True)


def _front_sight_base(name, material, post_material, parent, y):
    """A2 triangular front sight base: forged collar, tower, ears and post."""
    extrude_profile(name + "Collar",
                    rect_profile(y - 0.022, y + 0.022, -0.024, 0.012, chamfer=0.006),
                    0.034, material, parent, smooth=False, bevel=0.0025)
    extrude_profile(name + "Tower", [
        (y - 0.022, 0.004), (y + 0.022, 0.004), (y + 0.018, 0.024),
        (y + 0.010, 0.054), (y - 0.010, 0.054), (y - 0.018, 0.024),
    ], 0.026, material, parent, smooth=False, bevel=0.002)
    for side in (-1, 1):
        ear = extrude_profile("%sEar%s" % (name, "L" if side < 0 else "R"),
                              rect_profile(y - 0.0085, y + 0.0085, 0.030, 0.074,
                                           chamfer=0.0035),
                              0.0060, material, parent, smooth=False, bevel=0.0015)
        ear.location.x = side * 0.0100
    extrude_profile(name + "Post",
                    rect_profile(y - 0.0022, y + 0.0022, 0.028, 0.070, chamfer=0.001),
                    0.0044, post_material or material, parent, smooth=False, bevel=0.0008)


# --------------------------------------------------------------------------
# shared carbine banks
# --------------------------------------------------------------------------
def receiver_bank(gun, m):
    """Upper + lower receiver, flat-top rail, carry handle and iron sights.

    Shared verbatim by ``m4a1s.py`` so both carbines carry the same receiver.
    """
    anodized = m["anodized"]
    phosphate = m["phosphate"]
    steel = m["steel"]
    gunmetal = m["gunmetal"]

    # ---- upper receiver: forged flat top, tapered front -------------------
    receiver("UpperReceiver", anodized, gun, [
        (RECEIVER_REAR, 0.004, -0.022),
        (-0.082, 0.018, -0.027),
        (-0.052, 0.024, -0.029),
        (0.000, 0.026, -0.030),
        (0.038, 0.026, -0.030),
        (0.054, 0.022, -0.026),
        (RECEIVER_FRONT, 0.010, -0.019),
    ], RECEIVER_WIDTH, bevel=0.003)

    # charging-handle raceway along the top of the receiver spine
    receiver("HandleRace", gunmetal, gun, [
        (-0.098, 0.020, 0.012),
        (-0.072, 0.022, 0.014),
        (-0.038, 0.022, 0.014),
    ], 0.016, bevel=0.0015)

    # ---- lower receiver: magwell, trigger housing, grip tower -------------
    receiver("LowerReceiver", anodized, gun, [
        (0.040, -0.020, -0.034),
        (0.024, -0.026, -0.058),
        (-0.026, -0.028, -0.060),
        (-0.048, -0.028, -0.056),
        (-0.070, -0.026, -0.048),
        (-0.104, -0.022, -0.044),
        (-0.132, -0.016, -0.038),
    ], RECEIVER_WIDTH * 0.96, bevel=0.0025)

    # flared magwell lip so the magazine reads as seated rather than glued on
    receiver("MagwellLip", gunmetal, gun, [
        (0.030, -0.048, -0.062),
        (-0.032, -0.050, -0.066),
    ], RECEIVER_WIDTH * 1.06, bevel=0.002)

    # ---- flat-top picatinny rail: base bar plus transverse recoil slots ---
    slot_rail("TopRail", -0.088, 0.056, RECEIVER_TOP, 0.030, RAIL_TOP - RECEIVER_TOP,
              anodized, gun, pitch=0.0155, slot=0.0075, depth=0.0060)

    # ---- carry handle: two rail feet plus a genuinely open A-frame arch ---
    for tag, y0, y1 in (("Rear", -0.062, -0.042), ("Front", 0.040, 0.058)):
        extrude_profile("HandleFoot" + tag,
                        rect_profile(y0, y1, RECEIVER_TOP - 0.002, 0.050, chamfer=0.003),
                        0.030, anodized, gun, smooth=False, bevel=0.002)
    extrude_profile("CarryHandle", [
        (-0.052, 0.032), (-0.060, 0.046), (-0.056, 0.074), (-0.046, HANDLE_TOP),
        (0.042, HANDLE_TOP), (0.052, 0.074), (0.056, 0.046), (0.052, 0.032),
        (0.038, 0.032), (0.032, HANDLE_OPEN), (-0.038, HANDLE_OPEN), (-0.044, 0.032),
    ], 0.026, anodized, gun, smooth=False, bevel=0.0025)

    # rear aperture sight in the rear of the arch, as on the M16A2
    sight_rear("RearSight", anodized, gun, -0.046, 0.052, 0.030,
               width=0.014, aperture_material=steel)
    knob = tube("WindageKnob", [(0.0, 0.0068), (0.011, 0.0062)], 28, steel, gun, smooth=True)
    knob.rotation_euler = (0, 0, -math.pi / 2)
    knob.location = (0.019, -0.046, 0.068)
    drum = tube("ElevationKnob", [(0.0, 0.0058), (0.010, 0.0052)], 28, steel, gun, smooth=True)
    drum.rotation_euler = (math.pi / 2, 0, 0)
    drum.location = (0.0, -0.058, 0.044)

    # ---- right-side controls ---------------------------------------------
    # ejection port: recessed dark panel with a closed dust cover and hinge
    ejection_port("EjectionPort", phosphate, gun, 0.010, 0.050, -0.004, 0.020,
                  0.0188, depth=0.0032)
    cover = extrude_profile("PortCover", [
        (0.008, 0.022), (0.052, 0.019), (0.052, -0.006), (0.008, -0.006),
    ], 0.0042, anodized, gun, smooth=False, bevel=0.0018)
    cover.location.x = 0.0192
    hinge = tube("PortHinge", [(0.0, 0.0020), (0.046, 0.0020)], 14, steel, gun, smooth=True)
    hinge.rotation_euler = (0, 0, -math.pi / 2)
    hinge.location = (0.0205, 0.030, -0.0085)

    # brass deflector: the angled bump just forward of the port
    deflector = extrude_profile("BrassDeflector", [
        (0.046, -0.010), (0.064, 0.000), (0.064, 0.024), (0.052, 0.022),
    ], 0.014, anodized, gun, smooth=False, bevel=0.0020)
    deflector.location.x = 0.0245
    for index in range(3):
        y = 0.055 + index * 0.004
        extrude_profile("DeflectorRib%d" % index,
                        rect_profile(y, y + 0.0022, 0.002, 0.022, chamfer=0.0006),
                        0.0135, gunmetal, gun, smooth=False, bevel=0.0006).location.x = 0.0250

    # forward assist: serrated round plunger high on the right flank
    assist = tube("ForwardAssist", [(0.0, 0.0080), (0.015, 0.0090)], 32, phosphate, gun, smooth=True)
    assist.rotation_euler = (0, 0, -math.pi / 2)
    assist.location = (0.0205, -0.062, 0.012)
    for index in range(8):
        phi = math.tau * index / 8.0
        tooth = extrude_profile("ForwardAssistTooth%d" % index,
                                rect_profile(-0.0017, 0.0017, -0.0017, 0.0017, chamfer=0.0004),
                                0.016, steel, gun, smooth=False, bevel=0.0006)
        tooth.location = (0.0305, -0.062 + math.cos(phi) * 0.0084,
                          0.012 + math.sin(phi) * 0.0084)

    # magazine release button and the bolt catch paddle on the left
    release = tube("MagazineRelease", [(0.0, 0.0054), (0.0105, 0.0062)], 28, steel, gun, smooth=True)
    release.rotation_euler = (0, 0, -math.pi / 2)
    release.location = (0.0195, -0.050, -0.028)
    catch = extrude_profile("BoltCatch", [
        (-0.088, -0.012), (-0.058, -0.017), (-0.056, -0.031), (-0.088, -0.027),
    ], 0.010, steel, gun, smooth=False, bevel=0.0015)
    catch.location.x = -0.0205

    # selector switch, left side, with its hub
    selector = extrude_profile("Selector", [
        (-0.068, -0.018), (-0.020, -0.025), (-0.022, -0.037), (-0.070, -0.031),
    ], 0.006, steel, gun, smooth=False, bevel=0.0015)
    selector.location.x = -0.0210
    hub = tube("SelectorHub", [(0.0, 0.0058), (0.0085, 0.0054)], 28, steel, gun, smooth=True)
    hub.rotation_euler = (0, 0, -math.pi / 2)
    hub.location = (-0.0205, -0.058, -0.025)

    # takedown pins: front pivot and rear, both captured through the flanks
    for tag, y in (("Front", 0.030), ("Rear", -0.084)):
        pin = tube("TakedownPin" + tag, [(0.0, 0.0048), (0.048, 0.0048)], 28,
                   steel, gun, smooth=True)
        pin.rotation_euler = (0, 0, -math.pi / 2)
        pin.location = (-0.024, y, -0.028)
        head = tube("TakedownPinHead" + tag, [(0.0, 0.0062), (0.007, 0.0058)], 28,
                    gunmetal, gun, smooth=True)
        head.rotation_euler = (0, 0, -math.pi / 2)
        head.location = (-0.025, y, -0.028)


def furniture(gun, m):
    """Ribbed M4 handguard, delta ring, A2 pistol grip, CAR-15 stock."""
    polymer = m["polymer"]
    polymer_grey = m["polymer_grey"]
    anodized = m["anodized"]
    rubber = m["rubber"]
    gunmetal = m["gunmetal"]
    steel = m["steel"]
    phosphate = m["phosphate"]

    # ---- ribbed M4 handguard: rounded two-piece shell, not a slab ---------
    loft("Handguard", [
        (HANDGUARD_REAR, arc_profile(-0.0245, 0.0245, -0.029, 0.029, 0.013, steps=4)),
        (0.148, arc_profile(-0.0270, 0.0270, -0.032, 0.032, 0.014, steps=4)),
        (0.246, arc_profile(-0.0260, 0.0260, -0.030, 0.030, 0.013, steps=4)),
        (HANDGUARD_FRONT, arc_profile(-0.0225, 0.0225, -0.026, 0.026, 0.011, steps=4)),
    ], polymer, gun, smooth=True, bevel=0.002)
    tube("HandguardCap", [(HANDGUARD_FRONT - 0.008, 0.0245),
                          (HANDGUARD_FRONT + 0.004, 0.0235)], 40, anodized, gun, smooth=True)

    # raised top deck that continues the receiver spine forward
    extrude_profile("HandguardSpine",
                    rect_profile(0.098, 0.298, 0.026, 0.0385, chamfer=0.004),
                    0.024, polymer, gun, smooth=False, bevel=0.0025)
    for index in range(8):
        y = 0.106 + index * 0.024
        extrude_profile("HandguardSpineVent%d" % index,
                        rect_profile(y - 0.0035, y + 0.0035, 0.028, 0.040, chamfer=0.0015),
                        0.026, anodized, gun, smooth=False, bevel=0.001)
    # longitudinal cooling flutes down both flanks
    for index, z in enumerate((-0.015, -0.005, 0.005, 0.015)):
        for side in (-1, 1):
            flute = extrude_profile("HandguardFlute%d_%d" % (index, side),
                                    rect_profile(0.098, 0.296, z - 0.0032, z + 0.0032,
                                                 chamfer=0.0015),
                                    0.005, polymer_grey, gun, smooth=False, bevel=0.0012)
            flute.location.x = side * 0.0252
    # transverse heat-shield slots
    for index in range(5):
        y = 0.108 + index * 0.040
        for side in (-1, 1):
            slot = extrude_profile("HandguardSlot%d_%d" % (index, side),
                                   rect_profile(y - 0.0055, y + 0.0055, -0.019, 0.019,
                                                chamfer=0.002),
                                   0.0045, anodized, gun, smooth=False, bevel=0.0012)
            slot.location.x = side * 0.0258

    # ---- delta ring / barrel nut ------------------------------------------
    tube("DeltaRing", [(0.058, 0.0225), (0.070, 0.0282), (0.086, 0.0262)],
         44, phosphate, gun, smooth=True)

    # ---- A2 pistol grip with a finger shelf -------------------------------
    pistol_grip("PistolGrip", polymer, gun, -0.138, -0.030, 0.114, -0.024, 0.034,
                panels=True, panel_material=polymer_grey, swell=0.014)
    extrude_profile("GripFingerShelf", [
        (-0.122, -0.036), (-0.100, -0.038), (-0.098, -0.052), (-0.120, -0.050),
    ], 0.032, polymer, gun, smooth=False, bevel=0.002)
    extrude_profile("GripCap", [
        (-0.154, -0.142), (-0.196, -0.149), (-0.200, -0.161), (-0.158, -0.154),
    ], 0.036, polymer_grey, gun, smooth=False, bevel=0.0025)
    knurl("GripCheck", -0.166, -0.128, -0.096, 0.0168, 0.006, 3, polymer_grey, gun, depth=0.018)

    # ---- CAR-15 collapsible buffer-tube stock -----------------------------
    buffer_tube = tube("BufferTube", [(-0.290, 0.0186), (-0.086, 0.0192)],
                       48, gunmetal, gun, smooth=True)
    buffer_tube.location.z = -0.004
    tube("CastleNut", [(-0.102, 0.0225), (-0.088, 0.0222)], 40, phosphate, gun,
         smooth=True).location.z = -0.004

    extrude_profile("StockBody", [
        (STOCK_FRONT, 0.016), (-0.164, 0.026), (-0.186, 0.038), (-0.262, 0.038),
        (-0.290, 0.032), (-0.308, 0.014), (-0.316, -0.028), (-0.304, -0.054),
        (-0.238, -0.060), (-0.182, -0.052), (-0.158, -0.040), (STOCK_FRONT, -0.026),
    ], 0.044, polymer, gun, smooth=False, bevel=0.004, taper=0.06)
    extrude_profile("ButtPad", [
        (-0.304, 0.012), (-0.322, 0.004), (-0.322, -0.040), (-0.304, -0.052),
    ], 0.046, rubber, gun, smooth=False, bevel=0.004)
    # leather-hard buttplate seam, QD socket and the stock release lever
    extrude_profile("ButtSeam",
                    rect_profile(-0.308, -0.298, -0.052, 0.012, chamfer=0.002),
                    0.045, anodized, gun, smooth=False, bevel=0.0012)
    tube("StockCollar", [(-0.166, 0.0248), (-0.154, 0.0252)], 40, anodized, gun,
         smooth=True).location.z = -0.004
    extrude_profile("StockLever", [
        (-0.190, -0.046), (-0.154, -0.052), (-0.152, -0.068), (-0.190, -0.060),
    ], 0.016, steel, gun, smooth=False, bevel=0.0015)
    # two machined grooves per flank instead of magazine-style ribbing
    for index, z in enumerate((0.016, -0.016)):
        for side in (-1, 1):
            groove = extrude_profile("StockGroove%d_%d" % (index, side),
                                     rect_profile(-0.290, -0.172, z - 0.0022, z + 0.0022),
                                     0.0045, anodized, gun, smooth=False, bevel=0.0010)
            groove.location.x = side * 0.0208
    extrude_profile("SwivelMount",
                    rect_profile(-0.262, -0.242, -0.054, -0.044, chamfer=0.002),
                    0.014, steel, gun, smooth=False, bevel=0.0015)
    _swivel("ButtSwivel", steel, gun, -0.252, -0.060, 0.009)


def controls(gun, m, bolt_root, charging_root, trigger_root, magazine_root,
             mag_drop=None, witness_rows=4):
    """Animatable sub-assemblies: bolt carrier, charging handle, trigger, mag."""
    mag_drop = MAG_DROP if mag_drop is None else mag_drop
    steel = m["steel"]
    anodized = m["anodized"]
    phosphate = m["phosphate"]
    gunmetal = m["gunmetal"]

    # charging handle: T-latch behind the receiver, shaft down the raceway
    extrude_profile("ChargingShaft",
                    rect_profile(-0.022, 0.086, 0.008, 0.022, chamfer=0.002),
                    0.014, gunmetal, charging_root, smooth=False, bevel=0.0015)
    extrude_profile("ChargingLatch", [
        (-0.118, 0.006), (-0.100, 0.008), (-0.098, 0.028), (-0.114, 0.030),
        (-0.120, 0.020),
    ], 0.054, phosphate, charging_root, smooth=False, bevel=0.0025)
    for index in range(6):
        extrude_profile("ChargingTooth%d" % index,
                        rect_profile(-0.117 - index * 0.0006, -0.113 - index * 0.0006,
                                     0.010, 0.026, chamfer=0.0006),
                        0.056, steel, charging_root, smooth=False, bevel=0.0008)

    carrier = tube("CarrierBody", [(-0.062, 0.0120), (0.024, 0.0117)], 40, steel,
                   bolt_root, smooth=True)
    carrier.location.z = 0.004
    tail = tube("CarrierTail", [(-0.090, 0.0074), (-0.060, 0.0072)], 24, gunmetal,
                bolt_root, smooth=True)
    tail.location.z = 0.004
    bolt_head = tube("BoltHead", [(0.024, 0.0090), (0.052, 0.0086)], 32, phosphate,
                     bolt_root, smooth=True)
    bolt_head.location.z = 0.004

    # A2 trigger: a real blade inside a real open guard loop
    _trigger("TriggerBlade", steel, trigger_root, -0.070, -0.042, -0.082, 0.022)
    _guard("TriggerGuard", anodized, trigger_root, -0.106, -0.036, -0.040, -0.098,
           0.024, thickness=0.0080)
    for tag, y, z in (("Hammer", -0.062, -0.038), ("Trigger", -0.070, -0.044)):
        pin = tube("TriggerPin" + tag, [(0.0, 0.0028), (0.032, 0.0028)], 18, gunmetal,
                   trigger_root, smooth=True)
        pin.rotation_euler = (0, 0, -math.pi / 2)
        pin.location = (-0.016, y, z)

    # STANAG box: near-straight, drops out of the magwell. The 30-round M4A4
    # and the 20-round M4A1-S differ only in drop and witness-row count.
    curved_magazine("MagazineBody", anodized, magazine_root, MAG_BACK, MAG_FRONT,
                    MAG_TOP, mag_drop, 0.005, 0.028, stations=12, ribs=3,
                    rib_material=gunmetal, floor_material=gunmetal)
    extrude_profile("MagazineCatch",
                    rect_profile(MAG_BACK + 0.006, MAG_BACK + 0.024, -0.046, -0.034,
                                 chamfer=0.002),
                    0.030, steel, magazine_root, smooth=False, bevel=0.0015)
    for index in range(witness_rows):
        y = MAG_BACK + 0.010 + index * 0.018
        extrude_profile("MagazineWitness%d" % index,
                        rect_profile(y, y + 0.009,
                                     MAG_TOP - mag_drop + 0.020 + index * 0.014,
                                     MAG_TOP - mag_drop + 0.040 + index * 0.014, chamfer=0.002),
                        0.030, gunmetal, magazine_root, smooth=False, bevel=0.0012)


# --------------------------------------------------------------------------
# muzzle assemblies
# --------------------------------------------------------------------------
def front_end(gun, m, barrel_front, muzzle_tip, front_sight_y=None):
    """Barrel, gas tube, A2 front sight base and M16A2 birdcage flash hider."""
    front_sight_y = FRONT_SIGHT_Y if front_sight_y is None else front_sight_y
    phosphate = m["phosphate"]
    steel = m["steel"]
    anodized = m["anodized"]

    stepped_barrel("Barrel", phosphate, gun, [
        (0.046, 0.0156), (0.072, 0.0140), (0.140, 0.0110), (0.240, 0.0102),
        (0.296, 0.0100), (0.332, 0.0094), (0.420, 0.0091), (barrel_front, 0.0098),
    ], segments=56)

    # gas tube runs back under the handguard spine into the upper receiver
    tube("GasTube", [(0.084, 0.0040), (0.298, 0.0036)], 26, steel, gun,
         smooth=True).location.z = 0.0135

    # A2 triangular front sight base doubling as the gas block
    _front_sight_base("FrontSightBase", phosphate, steel, gun, front_sight_y)
    box("BayonetLug", (front_sight_y, 0.0, -0.030), (0.028, 0.018, 0.024),
        phosphate, gun, bevel=0.002)
    extrude_profile("BayonetLugRib",
                    rect_profile(front_sight_y - 0.015, front_sight_y + 0.015,
                                 -0.038, -0.034, chamfer=0.0015),
                    0.022, anodized, gun, smooth=False, bevel=0.0012)
    extrude_profile("SwivelMount",
                    rect_profile(front_sight_y - 0.008, front_sight_y + 0.008,
                                 -0.046, -0.036, chamfer=0.002),
                    0.010, steel, gun, smooth=False, bevel=0.0012)
    _swivel("FrontSwivel", steel, gun, front_sight_y, -0.050, 0.009)

    _birdcage("FlashHider", phosphate, anodized, gun, muzzle_tip - 0.054, muzzle_tip, 0.0122)


def build(palette):
    root = group(WEAPON_ID + "_Root")
    gun = group(DISPLAY, root)

    magazine = group("Magazine", gun)
    bolt = group("BoltCarrier", gun)
    charging = group("ChargingHandle", gun)
    trigger = group("Trigger", gun)

    receiver_bank(gun, palette)
    furniture(gun, palette)
    front_end(gun, palette, BARREL_FRONT, MUZZLE_TIP)
    controls(gun, palette, bolt, charging, trigger, magazine)

    anchor("ViewmodelAnchor", (0.0, 0.058, -0.012), root)
    anchor("Muzzle", (0.0, MUZZLE_TIP + 0.004, 0.0), root)
    anchor("LeftHandIK", (0.0, 0.192, -0.046), root)
    anchor("RightHandIK", (0.0, -0.142, -0.070), root)
    anchor("MagazineAnchor", (0.0, -0.014, -0.040), magazine)
    return root
