"""Combat knife, authored from ``Knife.png``.

Clean-room recreation: the reference sets silhouette proportions and colour
zoning only, and the gem finishes are applied at runtime by
``src/weapons/skins/KnifeMaterialFactory.ts``. The frame is the knife frame
described in ``knife_lib``: ``+Y`` is blade-forward, ``+Z`` is up and the
blade's flat faces look along ``+-X``.

This is the plain fixed-blade tactical knife: a flat-ground clip-point blade
with a blood groove, a double-quillon crossguard with a thumb ramp, a
finger-grooved handle carrying a gem scale on each flank, and a lanyard
pommel. Total length is 0.30 m from the point to the butt.

Reference calibration (vision report + recovered silhouette, tip to the right):
  0.30 m overall, a 0.178 m blade with a 0.016 m spine drop on the clip, a
  0.012 m guard, a 0.098 m handle and a 0.024 m pommel.
"""
import math

from weapon_common import anchor, group

import knife_lib as knife

WEAPON_ID = "knife"
DISPLAY = "Combat Knife"
CATEGORY = "knife"
TRIANGLE_HINT = 30000

# --- master stations (metres, guard datum) --------------------------------
TIP = 0.178
GUARD_Y = 0.010
HANDLE_FRONT = 0.002
HANDLE_BACK = -0.098
POMMEL_Y = -0.122
BLADE_STATIONS = 106
HANDLE_STATIONS = 88
INLAY_STATIONS = 74
HANDLE_RING_STEPS = 10
FINGER_GROOVES = 3
INLAY_THICKNESS = 0.0032

# Blade control stations: (y, centre z, width, thickness, fuller fade)
BLADE_ROWS = (
    (-0.006, 0.0000, 0.0272, 0.0056, 0.10),
    (0.012, 0.0000, 0.0316, 0.0058, 0.55),
    (0.034, 0.0000, 0.0336, 0.0058, 1.00),
    (0.060, 0.0002, 0.0342, 0.0056, 1.00),
    (0.090, 0.0002, 0.0338, 0.0054, 1.00),
    (0.118, 0.0002, 0.0328, 0.0051, 0.95),
    (0.142, 0.0000, 0.0310, 0.0047, 0.80),
    (0.160, -0.0010, 0.0274, 0.0042, 0.60),
    (0.170, -0.0028, 0.0206, 0.0035, 0.40),
    (0.1755, -0.0046, 0.0118, 0.0025, 0.22),
    (0.1775, -0.0056, 0.0044, 0.0014, 0.10),
    (TIP, -0.0052, 0.0008, 0.0006, 0.05),
)

# Handle control stations: (y, centre z, width, height)
HANDLE_ROWS = (
    (HANDLE_FRONT, -0.0008, 0.0258, 0.0284),
    (-0.014, -0.0012, 0.0276, 0.0304),
    (-0.034, -0.0018, 0.0282, 0.0312),
    (-0.056, -0.0024, 0.0280, 0.0308),
    (-0.078, -0.0030, 0.0270, 0.0294),
    (HANDLE_BACK, -0.0036, 0.0252, 0.0272),
)

# Gem scale: the same billet outline, inset so a rim of handle shows
INLAY_ROWS = (
    (-0.010, -0.0010, 0.0274, 0.0214),
    (-0.030, -0.0016, 0.0280, 0.0224),
    (-0.052, -0.0022, 0.0278, 0.0222),
    (-0.074, -0.0028, 0.0268, 0.0208),
    (-0.090, -0.0034, 0.0254, 0.0192),
)


def _grooved(rows, count):
    """Handle billet with three modelled finger grooves and a palm swell."""
    start, end = rows[0][0], rows[-1][0]
    made = []
    for cy, cz, width, height in knife.resample(rows, count):
        phase = (cy - end) / (start - end)
        swell = 1.0 + 0.030 * math.cos(math.pi * (phase - 0.42))
        groove = 0.5 + 0.5 * math.cos(knife.TAU * FINGER_GROOVES * phase)
        waist = 1.0 - 0.055 * groove ** 8
        ring = knife.rounded_ring(width * swell, height * swell * waist,
                                  min(width, height) * 0.34, HANDLE_RING_STEPS)
        made.append(knife.station(cy, cz, 0.0, ring))
    return made


def _scale_stations(count, mirror):
    """Gem handle scale, proud on one flank and contoured to the billet."""
    made = []
    for cy, cz, width, height in knife.resample(INLAY_ROWS, count):
        ring = knife.panel_ring(INLAY_THICKNESS, height, 0.0016, 5)
        edge = width / 2.0 + 0.0014
        shift = (edge - INLAY_THICKNESS / 2.0) if mirror else -(edge - INLAY_THICKNESS / 2.0)
        made.append(knife.station(cy, cz, 0.0,
                                  [(x + shift, t) for x, t in ring]))
    return made


def build(palette):
    root = group(WEAPON_ID + "_Root")
    body = group("Knife", root)

    materials = knife.slots(palette)
    extras = knife.fittings()
    blade_mat = materials["blade"]
    grip_mat = materials["grip"]
    inlay_mat = materials["inlay"]
    steel = palette["steel"]
    recess = extras["recess"]

    # ---- blade: flat ground clip point with a blood groove ---------------
    knife.forged("Blade",
                 knife.blade(knife.straight(BLADE_ROWS), fuller=(0.46, 0.78, 0.60),
                             count=BLADE_STATIONS, grind=0.22, ratio=0.82,
                             secondary=0.055, spine=0.115),
                 blade_mat, body, bevel=0.00018, bevel_segments=2,
                 smooth_angle=7.0, bevel_angle=26.0)

    # elongated thumb serrations on the spine just ahead of the guard
    for index in range(9):
        knife.tooth("BladeJimping%d" % index, (0.0, 0.024 + 0.0056 * index, 0.0166),
                    0.0046, 0.0032, 0.0044, 0.0010, blade_mat, body, segments=4)

    # ---- crossguard ------------------------------------------------------
    # Named assemblies each own an empty so the per-material batching pass can
    # never fold two of the required parts into one object.
    guard = group("Guard", body)
    guard_rows = (
        (GUARD_Y - 0.006, -0.0014, 0.0266, 0.0320),
        (GUARD_Y, 0.0008, 0.0292, 0.0396),
        (GUARD_Y + 0.007, 0.0004, 0.0274, 0.0352),
    )
    guard_stations = []
    for cy, cz, width, height in knife.resample(guard_rows, 32):
        guard_stations.append(knife.station(cy, cz, 0.0,
                                            knife.rounded_ring(width, height, 0.0044, 6)))
    knife.forged("GuardBody", guard_stations, steel, guard, bevel=0.0004,
                 bevel_segments=3, smooth_angle=30.0)

    # ---- handle with gem scales on both flanks ---------------------------
    handle = group("Handle", body)
    knife.forged("HandleBody", _grooved(HANDLE_ROWS, HANDLE_STATIONS), grip_mat,
                 handle, bevel=0.00022, bevel_segments=2, smooth_angle=22.0)
    for mirror, name in ((False, "Left"), (True, "Right")):
        knife.forged("Inlay" + name, _scale_stations(INLAY_STATIONS, mirror),
                     inlay_mat, handle, bevel=0.00018, bevel_segments=2,
                     smooth_angle=30.0)

    # ---- pommel with a lanyard eye ---------------------------------------
    pommel = group("Pommel", body)
    pommel_rows = (
        (HANDLE_BACK + 0.002, -0.0036, 0.0252, 0.0272),
        (-0.108, -0.0038, 0.0294, 0.0316),
        (-0.116, -0.0038, 0.0270, 0.0290),
        (POMMEL_Y, -0.0036, 0.0206, 0.0224),
    )
    pommel_stations = []
    for cy, cz, width, height in knife.resample(pommel_rows, 36):
        pommel_stations.append(knife.station(cy, cz, 0.0,
                                             knife.rounded_ring(width, height, 0.0054, 6)))
    knife.forged("PommelBody", pommel_stations, steel, pommel, bevel=0.0003,
                 bevel_segments=3)

    # ---- hardware: handle pins and a lanyard tube ------------------------
    for index, y in enumerate((-0.020, -0.050, -0.080)):
        knife.pin("GripPin%d" % index, (0.0, y, -0.0022), 0.0026, 0.0342, steel,
                  handle, segments=24, head=0.0014, head_radius=1.24, socket=0.48,
                  socket_material=recess)
    knife.pin("LanyardTube", (0.0, POMMEL_Y + 0.008, -0.0038), 0.0030, 0.0316, steel,
              pommel, segments=20, head=0.0011, head_radius=1.12)

    # ---- anchors ----------------------------------------------------------
    anchor("ViewmodelAnchor", (0.0, -0.048, -0.001), root)
    anchor("Muzzle", (0.0, TIP + 0.004, -0.0052), root)
    anchor("HandsAnchor", (0.0, -0.042, -0.006), body)
    return root
