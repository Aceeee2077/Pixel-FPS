"""Karambit, authored from ``Karambit_Emerald.png``.

Clean-room recreation: the reference sets silhouette proportions and colour
zoning only, and the emerald finish is applied at runtime by
``src/weapons/skins/KnifeMaterialFactory.ts``. The frame is the knife frame
described in ``knife_lib``: ``+Y`` is blade-forward, ``+Z`` is up and the
blade's flat faces look along ``+-X``.

The claw is a real swept forging: seventy sections are placed along a 46 mm arc
and each one is rotated onto its own tangent, so the secondary bevel, the grind
line, the fuller and the rounded spine follow the curve instead of shearing
through it. The cutting edge rides the concave inside of the crescent and the
spine -- with its individually modelled jimping teeth -- rides the convex
outside, which is what makes the silhouette read as a karambit claw rather than
a bent flat bar. The knife measures 0.21 m from the finger ring to the point.

Reference calibration (vision report + recovered silhouette, tip to the right):
  0.21 m overall, a 0.10 m claw hooking through 125 degrees, a 0.035 m finger
  ring at the butt, and a ribbed handle wrapped in the grip inlay.
"""
import math

from weapon_common import anchor, group

import knife_lib as knife

WEAPON_ID = "karambit"
DISPLAY = "Karambit"
CATEGORY = "knife"
TRIANGLE_HINT = 30000

# --- master stations (metres, handle datum) -------------------------------
ARC_CENTRE = (0.080, 0.040)   # centre of the claw arc in the YZ plane
ARC_RADIUS = 0.046
ARC_START = -95.0
ARC_END = 30.0
RING_CENTRE = (0.0, -0.064, -0.024)
RING_MAJOR = 0.0175
RING_MINOR = 0.0054
BLADE_STATIONS = 118
HANDLE_STATIONS = 84
GRIP_STATIONS = 98
RING_STEPS = 10
GRIP_RIBS = 5

# Claw control stations: (arc angle, spine-to-edge width, thickness, fuller fade)
ARC_ROWS = (
    (ARC_START, 0.0230, 0.0052, 0.08),
    (-88, 0.0292, 0.0054, 0.50),
    (-78, 0.0330, 0.0054, 0.95),
    (-66, 0.0342, 0.0053, 1.00),
    (-54, 0.0342, 0.0051, 1.00),
    (-42, 0.0332, 0.0049, 1.00),
    (-30, 0.0316, 0.0046, 0.95),
    (-18, 0.0290, 0.0042, 0.80),
    (-6, 0.0254, 0.0037, 0.60),
    (4, 0.0210, 0.0031, 0.42),
    (13, 0.0152, 0.0025, 0.26),
    (21, 0.0092, 0.0018, 0.14),
    (27, 0.0040, 0.0011, 0.08),
    (ARC_END, 0.0012, 0.0006, 0.05),
)

# Handle control stations: (y, centre z, sweep, width, height)
HANDLE_ROWS = (
    (0.080, -0.0040, -12, 0.0196, 0.0282),
    (0.068, -0.0034, -9, 0.0212, 0.0302),
    (0.050, -0.0022, -5, 0.0224, 0.0314),
    (0.028, -0.0028, -1, 0.0228, 0.0316),
    (0.006, -0.0052, 4, 0.0226, 0.0312),
    (-0.014, -0.0090, 9, 0.0218, 0.0300),
    (-0.030, -0.0134, 14, 0.0206, 0.0284),
    (-0.040, -0.0168, 18, 0.0190, 0.0264),
)

# Grip wrap: the same billet, 0.9 mm proud on every face
GRIP_ROWS = (
    (0.062, -0.0036, -11, 0.0226, 0.0320),
    (0.046, -0.0024, -6, 0.0242, 0.0332),
    (0.026, -0.0030, -2, 0.0246, 0.0334),
    (0.004, -0.0056, 3, 0.0244, 0.0330),
    (-0.016, -0.0096, 9, 0.0236, 0.0318),
    (-0.032, -0.0140, 14, 0.0224, 0.0300),
    (-0.040, -0.0168, 18, 0.0214, 0.0286),
)


def _arc_point(theta, radius):
    angle = math.radians(theta)
    return (ARC_CENTRE[0] + radius * math.cos(angle),
            ARC_CENTRE[1] + radius * math.sin(angle))


def _claw_rows(count):
    """(y, z, sweep, width, thickness, fade) control rows turned into stations."""
    made = []
    for theta, width, thickness, fade in knife.resample(ARC_ROWS, count):
        cy, cz = _arc_point(theta, ARC_RADIUS)
        # the section's spine axis follows the outward radial, so the grind
        # tracks the crescent instead of staying fixed in z
        made.append((cy, cz, theta - 90.0, width, thickness, fade))
    return made


def _billet(rows, count, steps=RING_STEPS, grow=0.0, ribs=0.0):
    """Rounded handle billet, optionally banded with modelled grip ribs."""
    start, end = rows[0][0], rows[-1][0]
    made = []
    for cy, cz, sweep, width, height in knife.resample(rows, count):
        swell = 1.0
        if ribs:
            phase = (cy - end) / (start - end)
            band = 0.5 + 0.5 * math.cos(knife.TAU * GRIP_RIBS * phase)
            swell = 1.0 + ribs * band ** 6
        ring = knife.rounded_ring((width + grow) * swell, (height + grow) * swell,
                                  min(width, height) * 0.34, steps)
        made.append(knife.station(cy, cz, sweep, ring))
    return made


def _interp_row(theta):
    """Width / thickness / fade at an arbitrary claw angle."""
    rows = list(ARC_ROWS)
    for index in range(len(rows) - 1):
        a, b = rows[index], rows[index + 1]
        if a[0] <= theta <= b[0]:
            t = (theta - a[0]) / (b[0] - a[0])
            return tuple(a[k] + (b[k] - a[k]) * t for k in (1, 2, 3))
    return rows[-1][1:]


def _handle_z(y):
    """Centre height of the handle billet at ``y``."""
    rows = list(HANDLE_ROWS)
    for index in range(len(rows) - 1):
        a, b = rows[index], rows[index + 1]
        if b[0] <= y <= a[0]:
            t = (y - a[0]) / (b[0] - a[0])
            return a[1] + (b[1] - a[1]) * t
    return rows[-1][1]


def build(palette):
    root = group(WEAPON_ID + "_Root")
    body = group("Karambit", root)

    materials = knife.slots(palette)
    extras = knife.fittings()
    blade_mat = materials["blade"]
    grip_mat = materials["grip"]
    inlay_mat = materials["inlay"]
    steel = palette["steel"]
    recess = extras["recess"]

    # ---- claw: flat grind, fuller along the convex spine, sharp point -----
    knife.forged("Blade", knife.blade(_claw_rows(BLADE_STATIONS),
                                      fuller=(0.46, 0.78, 0.60), grind=0.22,
                                      ratio=0.82, secondary=0.055, spine=0.115),
                 blade_mat, body, bevel=0.00018, bevel_segments=2,
                 smooth_angle=7.0, bevel_angle=26.0)

    # spine jimping: individually modelled teeth, each one swept radially out
    # of the spine so the row curls with the claw
    for index in range(10):
        theta = -88.0 + index * 5.0
        width = _interp_row(theta)[0]
        outer = ARC_RADIUS + width / 2.0
        stations = []
        for offset, shrink in ((-0.0010, 0.90), (0.0006, 1.0), (0.0024, 0.42)):
            cy, cz = _arc_point(theta, outer + offset)
            stations.append(knife.station(
                cy, cz, theta, knife.rounded_ring(0.0034 * shrink, 0.0046 * shrink,
                                                  0.0009 * shrink, 4)))
        knife.forged("BladeJimping%d" % index, stations, blade_mat, body,
                     bevel=0.00012, bevel_segments=2, smooth_angle=7.0)

    # ---- handle ----------------------------------------------------------
    knife.forged("Handle", _billet(HANDLE_ROWS, HANDLE_STATIONS),
                 grip_mat, body, bevel=0.00022, bevel_segments=2, smooth_angle=30.0)

    # grip wrap: the gem inlay sleeve the runtime finish recolours, banded
    # with five modelled finger ribs
    knife.forged("Grip", _billet(GRIP_ROWS, GRIP_STATIONS, grow=0.0018, ribs=0.045),
                 inlay_mat, body, bevel=0.00020, bevel_segments=2, smooth_angle=16.0)

    # ---- finger ring ------------------------------------------------------
    knife.ring_body("FingerRing", RING_CENTRE, RING_MAJOR, RING_MINOR, steel, body,
                    major_segments=88, minor_segments=26)
    _ring_neck(steel, body)

    # grip pins through the wrap, and a lanyard tube in the butt
    for index, y in enumerate((0.040, 0.010, -0.020)):
        knife.pin("GripPin%d" % index, (0.0, y, _handle_z(y)), 0.0018, 0.0272, steel,
                  body, segments=22, head=0.0010, head_radius=1.26, socket=0.46,
                  socket_material=recess)
    knife.pin("LanyardTube", (0.0, -0.036, -0.018), 0.0024, 0.0272, steel, body,
              segments=20, head=0.0009, head_radius=1.16)

    # ---- anchors ----------------------------------------------------------
    tip_y, tip_z = _arc_point(ARC_END, ARC_RADIUS)
    anchor("ViewmodelAnchor", (0.0, 0.006, -0.010), root)
    anchor("Muzzle", (0.0, tip_y + 0.002, tip_z + 0.002), root)
    anchor("HandsAnchor", (0.0, 0.004, -0.012), body)
    return root


def _ring_neck(material, parent):
    """Flared collar where the claw arc's tail runs into the finger ring.

    The neck is swept along the ring's own radial direction, so the collar
    meets both the torus and the handle instead of floating between them.
    """
    dy, dz = 0.976, 0.220          # ring centre -> handle butt, normalised
    sweep = math.degrees(math.atan2(-dz, dy)) - 90.0
    stations = []
    for radius, shrink in ((RING_MAJOR * 0.86, 0.80), (RING_MAJOR * 1.30, 1.10),
                           (RING_MAJOR * 1.78, 0.94)):
        cy = RING_CENTRE[1] + radius * dy
        cz = RING_CENTRE[2] + radius * dz
        stations.append(knife.station(
            cy, cz, sweep + 90.0,
            knife.rounded_ring(0.0206 * shrink, 0.0198 * shrink, 0.0060 * shrink, 6)))
    return knife.forged("RingNeck", stations, material, parent, bevel=0.0002,
                        bevel_segments=2, smooth_angle=28.0)
