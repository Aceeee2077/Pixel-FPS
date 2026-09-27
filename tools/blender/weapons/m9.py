"""M9 bayonet, authored from ``M9Bayonet_Ruby.png``.

Clean-room recreation: the reference sets silhouette proportions and colour
zoning only, and the ruby finish is applied at runtime by
``src/weapons/skins/KnifeMaterialFactory.ts``. The frame is the knife frame
described in ``knife_lib``: ``+Y`` is blade-forward, ``+Z`` is up and the
blade's flat faces look along ``+-X``.

The blade is a flat-ground clip point with a fuller; the muzzle ring is a real
torus whose axis runs along the bayonet so it would actually pass over a rifle
barrel, and the spine saw teeth are eleven individually swept wedges inside the
``Serration`` group rather than a painted stripe. Total length is 0.30 m.

Reference calibration (vision report + recovered silhouette, tip to the right):
  a 0.196 m clip-point blade with a saw-tooth spine, a ringed crossguard at
  y = 0.020, a ribbed grip with a gem sleeve, and a lanyard pommel at the butt.
"""
import math

from weapon_common import anchor, group

import knife_lib as knife

WEAPON_ID = "m9"
DISPLAY = "M9 Bayonet"
CATEGORY = "knife"
TRIANGLE_HINT = 30000

# --- master stations (metres, guard datum) --------------------------------
TIP = 0.196
GUARD_Y = 0.020
HANDLE_FRONT = 0.010
HANDLE_BACK = -0.078
POMMEL_Y = -0.104
BLADE_STATIONS = 106
HANDLE_STATIONS = 76
HANDLE_RING_STEPS = 10
TEETH = 11
TEETH_FRONT = 0.116
TEETH_BACK = 0.052

# Blade control stations: (y, centre z, width, thickness, fuller fade)
BLADE_ROWS = (
    (0.004, 0.0000, 0.0286, 0.0056, 0.10),
    (0.020, 0.0000, 0.0310, 0.0056, 0.55),
    (0.040, 0.0000, 0.0322, 0.0055, 1.00),
    (0.070, 0.0002, 0.0326, 0.0054, 1.00),
    (0.100, 0.0002, 0.0324, 0.0052, 1.00),
    (0.128, 0.0000, 0.0316, 0.0049, 0.95),
    (0.152, -0.0004, 0.0298, 0.0045, 0.80),
    (0.168, -0.0016, 0.0262, 0.0040, 0.60),
    (0.180, -0.0034, 0.0200, 0.0034, 0.42),
    (0.189, -0.0052, 0.0124, 0.0026, 0.24),
    (0.1935, -0.0066, 0.0052, 0.0015, 0.12),
    (TIP, -0.0062, 0.0008, 0.0006, 0.05),
)

# Handle control stations: (y, centre z, width, height)
HANDLE_ROWS = (
    (HANDLE_FRONT, -0.0016, 0.0278, 0.0300),
    (0.000, -0.0016, 0.0300, 0.0324),
    (-0.016, -0.0018, 0.0310, 0.0334),
    (-0.036, -0.0020, 0.0312, 0.0336),
    (-0.056, -0.0024, 0.0304, 0.0328),
    (HANDLE_BACK, -0.0030, 0.0286, 0.0310),
)


def _handle_stations(count):
    """Ribbed grip billet: six modelled bands, not a texture."""
    start, end = HANDLE_ROWS[0][0], HANDLE_ROWS[-1][0]
    made = []
    for cy, cz, width, height in knife.resample(HANDLE_ROWS, count):
        phase = (cy - end) / (start - end)
        band = 0.5 + 0.5 * math.cos(knife.TAU * 6.0 * phase)
        swell = 1.0 + 0.045 * band ** 8
        ring = knife.rounded_ring(width * swell, height * swell,
                                  min(width, height) * 0.34, HANDLE_RING_STEPS)
        made.append(knife.station(cy, cz, 0.0, ring))
    return made


def build(palette):
    root = group(WEAPON_ID + "_Root")
    body = group("M9", root)

    materials = knife.slots(palette)
    extras = knife.fittings()
    blade_mat = materials["blade"]
    grip_mat = materials["grip"]
    inlay_mat = materials["inlay"]
    steel = palette["steel"]
    recess = extras["recess"]

    # ---- blade: flat ground clip point with a fuller ----------------------
    knife.forged("Blade",
                 knife.blade(knife.straight(BLADE_ROWS), fuller=(0.46, 0.78, 0.60),
                             count=BLADE_STATIONS, grind=0.22, ratio=0.82,
                             secondary=0.055, spine=0.115),
                 blade_mat, body, bevel=0.00018, bevel_segments=2,
                 smooth_angle=7.0, bevel_angle=26.0)

    # ---- spine saw teeth: eleven individually swept wedges ---------------
    serration = group("Serration", body)
    for index in range(TEETH):
        t = index / float(TEETH - 1)
        y = TEETH_BACK + (TEETH_FRONT - TEETH_BACK) * t
        knife.tooth("SerrationTooth%d" % index, (0.0, y, 0.0166), 0.0044,
                    0.0036, 0.0050, 0.0009, blade_mat, serration, segments=4)

    # ---- crossguard with a slot for the blade ----------------------------
    # Each named assembly owns its own empty so the per-material batching pass
    # can never fold two of the required parts into one object.
    guard = group("Guard", body)
    guard_rows = (
        (GUARD_Y - 0.008, -0.0010, 0.0262, 0.0362),
        (GUARD_Y, 0.0014, 0.0284, 0.0432),
        (GUARD_Y + 0.009, 0.0010, 0.0270, 0.0390),
    )
    guard_stations = []
    for cy, cz, width, height in knife.resample(guard_rows, 30):
        guard_stations.append(knife.station(cy, cz, 0.0,
                                            knife.rounded_ring(width, height, 0.0046, 6)))
    knife.forged("GuardBody", guard_stations, steel, guard, bevel=0.0004,
                 bevel_segments=3, smooth_angle=30.0)

    # thumb ramp on the spine just ahead of the guard
    ramp_rows = (
        (0.029, 0.0156, 0.0104, 0.0056),
        (0.046, 0.0172, 0.0118, 0.0086),
        (0.063, 0.0166, 0.0104, 0.0062),
    )
    ramp = []
    for cy, cz, width, height in knife.resample(ramp_rows, 26):
        ramp.append(knife.station(cy, cz, 0.0,
                                  knife.rounded_ring(width, height, 0.0018, 5)))
    knife.forged("GuardRamp", ramp, steel, guard, bevel=0.0002, bevel_segments=2)

    # ---- muzzle ring: a real torus around the barrel axis ----------------
    muzzle_ring = group("Ring", body)
    knife.ring_body("RingBody", (0.0, 0.034, 0.0214), 0.0118, 0.0034, steel,
                    muzzle_ring, major_segments=64, minor_segments=16, axis="y")
    bracket_rows = (
        (0.030, 0.0086, 0.0100, 0.0060),
        (0.034, 0.0140, 0.0124, 0.0086),
        (0.040, 0.0176, 0.0112, 0.0070),
    )
    bracket = []
    for cy, cz, width, height in knife.resample(bracket_rows, 24):
        bracket.append(knife.station(cy, cz, 0.0,
                                     knife.rounded_ring(width, height, 0.0022, 5)))
    knife.forged("RingBracket", bracket, steel, muzzle_ring, bevel=0.0002,
                 bevel_segments=2)

    # ---- grip ------------------------------------------------------------
    handle = group("Handle", body)
    knife.forged("HandleBody", _handle_stations(HANDLE_STATIONS), grip_mat, handle,
                 bevel=0.00022, bevel_segments=2, smooth_angle=16.0)

    # gem sleeve the runtime finish recolours, with its own moulded band
    sleeve_rows = (
        (-0.008, -0.0018, 0.0324, 0.0348),
        (-0.026, -0.0020, 0.0330, 0.0354),
        (-0.048, -0.0024, 0.0322, 0.0346),
        (-0.062, -0.0028, 0.0306, 0.0330),
    )
    sleeve = []
    for cy, cz, width, height in knife.resample(sleeve_rows, 52):
        sleeve.append(knife.station(cy, cz, 0.0,
                                    knife.rounded_ring(width, height,
                                                       min(width, height) * 0.34, 6)))
    knife.forged("InlayGrip", sleeve, inlay_mat, handle, bevel=0.0002,
                 bevel_segments=2, smooth_angle=28.0)

    # ---- pommel with a lanyard eye ---------------------------------------
    pommel = group("Pommel", body)
    pommel_rows = (
        (HANDLE_BACK + 0.002, -0.0030, 0.0286, 0.0310),
        (-0.088, -0.0032, 0.0322, 0.0346),
        (-0.098, -0.0034, 0.0300, 0.0320),
        (POMMEL_Y, -0.0034, 0.0232, 0.0252),
    )
    pommel_stations = []
    for cy, cz, width, height in knife.resample(pommel_rows, 34):
        pommel_stations.append(knife.station(cy, cz, 0.0,
                                             knife.rounded_ring(width, height, 0.0060, 6)))
    knife.forged("PommelBody", pommel_stations, steel, pommel, bevel=0.0003,
                 bevel_segments=3)

    # ---- hardware --------------------------------------------------------
    for index, y in enumerate((-0.014, -0.062)):
        knife.pin("GripScrew%d" % index, (0.0, y, -0.0022), 0.0026, 0.0356, steel,
                  handle, segments=24, head=0.0014, head_radius=1.26, socket=0.50,
                  socket_material=recess)
    knife.pin("LanyardHole", (0.0, POMMEL_Y + 0.008, -0.0034), 0.0028, 0.0290, steel,
              pommel, segments=20, head=0.0010, head_radius=1.14)

    # ---- anchors ----------------------------------------------------------
    anchor("ViewmodelAnchor", (0.0, -0.040, -0.002), root)
    anchor("Muzzle", (0.0, TIP + 0.004, -0.0062), root)
    anchor("HandsAnchor", (0.0, -0.036, -0.008), body)
    return root
