"""Generate three original knife families from authored silhouette controls.

The four supplied PNGs are visual proportion and finish references only. No image
is projected onto geometry, and no third-party game mesh is imported.

Run: blender -b -P tools/blender/generate-knives.py
"""
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent))

from knife_common import reset_scene, collection_root, outline, block, screw, ring, pivot, parent_keep
from materials import palette
from export_glb import export_family


def butterfly():
    reset_scene()
    m = palette()
    root = collection_root("Butterfly")
    root["forward_axis"] = "+Y in Blender / -Z in glTF"
    blade = outline("Blade", [(-.045, .025), (-.08, .16), (-.11, .33),
        (-.055, .52), (.02, .68), (.082, .59), (.105, .4), (.065, .19), (.025, .055)],
        .022, m["blade"], root)
    blade["skin_slot"] = "blade"
    for side, x in (("Left", -.065), ("Right", .065)):
        joint = pivot("Pivot" + side, x, .025, root)
        grip = outline("Handle" + side, [(x - .025, .01), (x + .025, .01),
            (x + .033, -.5), (x + .008, -.59), (x - .033, -.53)], .034, m["grip"], root)
        parent_keep(grip, joint)
        insert = block("Inlay" + side, (x, -.29, .019), (.025, .31, .006), m["inlay"], root)
        insert["skin_slot"] = "inlay"
        parent_keep(insert, joint)
        for i, y in enumerate((-.13, -.46)):
            pin = screw("Screw" + side + str(i), x, y, .012, m["steel"], root)
            parent_keep(pin, joint)
        screw("PivotCap" + side, x, .025, .021, m["steel"], root)
    block("Latch", (0, -.59, 0), (.09, .018, .028), m["steel"], root)
    pivot("HandsAnchor", 0, -.34, root)
    return root


def karambit():
    reset_scene()
    m = palette()
    root = collection_root("Karambit")
    blade = outline("Blade", [(.035, .08), (-.085, .16), (-.23, .31),
        (-.39, .42), (-.35, .29), (-.24, .18), (-.13, .08), (-.03, .035)],
        .025, m["blade"], root, .003)
    blade["skin_slot"] = "blade"
    handle = outline("Handle", [(-.03, .04), (.075, .08), (.13, -.08),
        (.19, -.22), (.15, -.37), (.075, -.48), (-.045, -.43),
        (-.08, -.29), (-.04, -.16)], .045, m["grip"], root)
    ring("FingerRing", .07, -.52, .066, .015, m["steel"], root)
    block("Grip", (.045, -.2, .027), (.09, .21, .008), m["inlay"], root)["skin_slot"] = "inlay"
    for i, y in enumerate((-.08, -.32)):
        screw("GripPin" + str(i), .04, y, .012, m["steel"], root)
    pivot("HandsAnchor", .035, -.2, root)
    return root


def m9():
    reset_scene()
    m = palette()
    root = collection_root("M9")
    blade = outline("Blade", [(-.065, .08), (-.075, .32), (-.08, .55),
        (-.015, .76), (.06, .68), (.072, .31), (.06, .08)],
        .029, m["blade"], root, .003)
    blade["skin_slot"] = "blade"
    block("Guard", (0, .05, 0), (.25, .027, .055), m["steel"], root)
    ring("Ring", -.105, .07, .038, .012, m["steel"], root)
    block("Handle", (0, -.2, 0), (.106, .45, .065), m["grip"], root, .015)
    block("Pommel", (0, -.45, 0), (.12, .055, .07), m["steel"], root)
    block("Fuller", (0, .39, .017), (.018, .32, .004), m["steel"], root, .002)
    for i in range(6):
        y = -.36 + i * .057
        block("GripRib" + str(i), (0, y, .035), (.11, .016, .006), m["steel"], root, .002)
    for i in range(5):
        y = .16 + i * .04
        block("Serration" + str(i), (-.077, y, 0), (.026, .01, .028), m["blade"], root, .002)
    pivot("HandsAnchor", 0, -.25, root)
    return root


REFERENCE_PNGS = {
    "butterfly": ("Butterfly_Knife_Emerald.png", "Butterfly_Knife_Fade.png"),
    "karambit": ("Karambit_Emerald.png",),
    "m9": ("M9Bayonet_Ruby.png",),
}


def reference_bounds(filename):
    image = __import__("bpy").data.images.load(str(Path(__file__).resolve().parents[2] / filename), check_existing=False)
    width, height = image.size
    pixels = image.pixels[:]
    xs, ys = [], []
    for y in range(0, height, 12):
        for x in range(0, width, 12):
            i = (y * width + x) * 4
            if max(pixels[i], pixels[i + 1], pixels[i + 2]) > .12 and pixels[i + 3] > .1:
                xs.append(x)
                ys.append(y)
    __import__("bpy").data.images.remove(image)
    if not xs:
        raise ValueError("No silhouette found in " + filename)
    bounds = (min(xs), min(ys), max(xs), max(ys))
    print("Reference", filename, "pixels", width, height, "silhouette", bounds)
    return bounds


manifest = {}
for name, build in (("butterfly", butterfly), ("karambit", karambit), ("m9", m9)):
    bounds = [reference_bounds(filename) for filename in REFERENCE_PNGS[name]]
    root = build()
    root["reference_bounds"] = str(bounds)
    export_family(name, root)
    manifest[name] = "/assets/weapons/knives/" + name + "/" + name + ".glb"

manifest_path = Path(__file__).resolve().parents[2] / "public" / "assets" / "weapons" / "manifest.json"
manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")

