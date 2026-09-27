"""Butterfly (balisong) knife, authored from ``Butterfly_Knife_*.png``.

Clean-room recreation: the references set silhouette proportions and colour
zoning only, and the emerald / fade finishes are applied at runtime by
``src/weapons/skins/KnifeMaterialFactory.ts``. The frame is the knife frame
described in ``knife_lib``: ``+Y`` is blade-forward, ``+Z`` is up and the
blade's flat faces look along ``+-X``.

The two handles are separate objects parented to their own pivot empties, each
sitting on the real pivot pin at the tang, so ``flipOpen`` / ``flipClose`` can
swing them without any other part moving. They are held apart by a 1.4 mm gap
and each carries a turned steel pivot boss, which is what makes the hinge read
as a hinge instead of one thick slab. The open knife measures 0.246 m from the
blade point to the latch tail.

Reference calibration (vision report + recovered silhouette, tip to the right):
  a 0.124 m clip-point blade, a pair of channelled handles of the same length,
  twin pivot pins at the tang, a latch bar across the tails, and three screws
  per handle.
"""
from weapon_common import anchor, group

import knife_lib as knife

WEAPON_ID = "butterfly"
DISPLAY = "Butterfly Knife"
CATEGORY = "knife"
TRIANGLE_HINT = 30000

# --- master stations (metres, pivot datum) --------------------------------
TIP = 0.124
PIVOT_X = 0.0088          # lateral offset of each handle's pivot pin
PIVOT_Y = 0.006           # fore-aft position of the pivot pins at the tang
HANDLE_FRONT = 0.022
HANDLE_BACK = -0.110
LATCH_BACK = -0.122
BLADE_STATIONS = 96
HANDLE_STATIONS = 66
HANDLE_RING_STEPS = 10
INLAY_THICKNESS = 0.0018
INLAY_HEIGHT = 0.0104

# Blade control stations: (y, centre z, width, thickness, fuller fade)
BLADE_ROWS = (
    (-0.020, 0.0000, 0.0210, 0.0044, 0.10),
    (-0.006, 0.0005, 0.0230, 0.0046, 0.50),
    (0.010, 0.0005, 0.0246, 0.0047, 0.95),
    (0.030, 0.0004, 0.0250, 0.0046, 1.00),
    (0.052, 0.0003, 0.0252, 0.0045, 1.00),
    (0.070, 0.0003, 0.0246, 0.0043, 1.00),
    (0.086, 0.0005, 0.0230, 0.0040, 0.80),
    (0.097, 0.0005, 0.0198, 0.0036, 0.55),
    (0.107, -0.0003, 0.0138, 0.0030, 0.32),
    (0.116, -0.0013, 0.0068, 0.0023, 0.16),
    (0.1215, -0.0019, 0.0026, 0.0015, 0.08),
    (0.1240, -0.0010, 0.0006, 0.0006, 0.05),
)

# Handle control stations: (y, centre z, width, height)
HANDLE_ROWS = (
    (HANDLE_FRONT, 0.0010, 0.0120, 0.0172),
    (0.006, 0.0008, 0.0134, 0.0202),
    (-0.012, 0.0004, 0.0140, 0.0216),
    (-0.032, 0.0000, 0.0142, 0.0220),
    (-0.054, -0.0006, 0.0140, 0.0216),
    (-0.076, -0.0014, 0.0136, 0.0210),
    (-0.094, -0.0022, 0.0130, 0.0200),
    (HANDLE_BACK, -0.0032, 0.0114, 0.0178),
)

# Grip inlay runs the middle of the handle only, so the billet rims show
INLAY_ROWS = (
    (0.012, 0.0006, 0.0132, 0.0200),
    (-0.012, 0.0004, 0.0140, 0.0216),
    (-0.036, -0.0001, 0.0142, 0.0218),
    (-0.062, -0.0009, 0.0136, 0.0210),
    (-0.088, -0.0019, 0.0128, 0.0196),
    (-0.100, -0.0025, 0.0122, 0.0186),
)


def _handle_stations(rows, count, mirror):
    """Channelled handle billet: the trough faces outboard on both handles."""
    made = []
    for cy, cz, width, height in knife.resample(rows, count):
        trough = (-height * 0.28, height * 0.28, width * 0.24, height * 0.075)
        ring = knife.rounded_ring(width, height, min(width, height) * 0.36,
                                  HANDLE_RING_STEPS, channel=trough)
        made.append(knife.station(cy, cz, 0.0,
                                  knife.mirrored_ring(ring) if mirror else ring))
    return made


def _inlay_stations(rows, count, mirror):
    """Gem scale laid inside the handle trough, flush with the outer face."""
    made = []
    for cy, cz, width, _height in knife.resample(rows, count):
        ring = knife.panel_ring(INLAY_THICKNESS, INLAY_HEIGHT, 0.0013, 5)
        edge = width / 2.0 + 0.0002
        shift = (edge - INLAY_THICKNESS / 2.0) if mirror else -(edge - INLAY_THICKNESS / 2.0)
        made.append(knife.station(cy, cz + 0.0004, 0.0,
                                  [(x + shift, t) for x, t in ring]))
    return made


def build(palette):
    root = group(WEAPON_ID + "_Root")
    body = group("Butterfly", root)

    materials = knife.slots(palette)
    extras = knife.fittings()
    blade_mat = materials["blade"]
    grip_mat = materials["grip"]
    inlay_mat = materials["inlay"]
    steel = palette["steel"]
    recess = extras["recess"]

    # ---- blade: flat-ground forging with a fading fuller ------------------
    knife.forged("Blade",
                 knife.blade(knife.straight(BLADE_ROWS), fuller=(0.46, 0.78, 0.60),
                             count=BLADE_STATIONS, grind=0.22, ratio=0.82,
                             secondary=0.055, spine=0.115),
                 blade_mat, body, bevel=0.00018, bevel_segments=2,
                 smooth_angle=7.0, bevel_angle=26.0)

    # thumb jimping: individually modelled teeth on the spine at the tang
    for index in range(6):
        knife.tooth("BladeJimping%d" % index, (0.0, 0.022 + 0.0064 * index, 0.0118),
                    0.0044, 0.0026, 0.0040, 0.0008, blade_mat, body, segments=4)

    # ---- handles: each rides its own pivot empty --------------------------
    for side, name in ((-1, "Left"), (1, "Right")):
        pivot = group("Pivot" + name, body, location=(side * PIVOT_X, PIVOT_Y, 0.0))
        mirror = side > 0
        handle_rows = [(cy - PIVOT_Y, cz, width, height)
                       for cy, cz, width, height in HANDLE_ROWS]
        inlay_rows = [(cy - PIVOT_Y, cz, width, height)
                      for cy, cz, width, height in INLAY_ROWS]

        knife.forged("Handle" + name, _handle_stations(handle_rows, HANDLE_STATIONS,
                                                       mirror),
                     grip_mat, pivot, bevel=0.00022, bevel_segments=2, smooth_angle=30.0)
        knife.forged("Inlay" + name, _inlay_stations(inlay_rows, 52, mirror),
                     inlay_mat, pivot, bevel=0.00016, bevel_segments=2, smooth_angle=34.0)

        # turned steel pivot boss: the hinge reads as a hinge, not a seam
        knife.collar("PivotBoss" + name, (side * 0.0086, 0.0, 0.0), 0.0062, 0.0030,
                     steel, pivot, segments=32, flare=1.14)
        knife.pin("PivotScrew" + name, (0.0, 0.0, 0.0), 0.0030, 0.0198, steel, pivot,
                  segments=28, head=0.0015, head_radius=1.28, socket=0.50,
                  socket_material=recess)
        for index, y in enumerate((-0.038, -0.086)):
            knife.pin("Screw%s%d" % (name, index), (0.0, y - PIVOT_Y, 0.0), 0.0024,
                      0.0194, steel, pivot, segments=24, head=0.0012, head_radius=1.32,
                      socket=0.52, socket_material=recess)

    # ---- latch: a real T bar across the handle tails ----------------------
    latch_rows = (
        (HANDLE_BACK + 0.004, 0.0000, 0.0050, 0.0044),
        (-0.1150, 0.0001, 0.0054, 0.0048),
        (-0.1190, 0.0004, 0.0044, 0.0038),
    )
    latch = []
    for cy, cz, width, height in knife.resample(latch_rows, 22):
        latch.append(knife.station(cy, cz, 0.0,
                                   knife.rounded_ring(width, height, 0.0013, 5)))
    knife.forged("Latch", latch, steel, body, bevel=0.00018, bevel_segments=2)

    head_rows = (
        (-0.1188, 0.0006, 0.0044, 0.0040),
        (-0.1216, 0.0010, 0.0134, 0.0056),
        (-0.1226, 0.0010, 0.0122, 0.0048),
    )
    head = []
    for cy, cz, width, height in knife.resample(head_rows, 16):
        head.append(knife.station(cy, cz, 0.0,
                                  knife.rounded_ring(width, height, 0.0018, 5)))
    knife.forged("LatchHead", head, steel, body, bevel=0.00018, bevel_segments=2)

    # ---- screw group: hardware that rides neither handle ------------------
    screws = group("Screws", body)
    for side, name in ((-1, "Left"), (1, "Right")):
        knife.washer("PivotWasher" + name, (side * PIVOT_X, PIVOT_Y, 0.0), 0.0048,
                     0.0011, steel, screws, segments=30)
        knife.pin("TangPin" + name, (side * PIVOT_X, PIVOT_Y - 0.0152, 0.0006),
                  0.0015, 0.0196, steel, screws, segments=18, head=0.0008,
                  head_radius=1.25)
    knife.pin("LatchPin", (0.0, LATCH_BACK + 0.0072, 0.0), 0.0019, 0.0140, steel,
              screws, segments=20, head=0.0010, head_radius=1.35)
    knife.pin("LatchSpring", (0.0, LATCH_BACK + 0.0162, 0.0), 0.0013, 0.0084, steel,
              screws, segments=16, head=0.0008, head_radius=1.30)

    # ---- anchors ----------------------------------------------------------
    anchor("ViewmodelAnchor", (0.0, -0.048, 0.0), root)
    anchor("Muzzle", (0.0, TIP + 0.004, -0.0010), root)
    anchor("HandsAnchor", (0.0, -0.032, 0.0), body)
    return root
