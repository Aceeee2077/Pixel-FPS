"""Numerical silhouette check: render a binary projected mask and print its
column profile, so a model outline can be compared against a reference sheet
without relying on a subjective look at a render.

The mask is rendered through Blender's workbench engine (white on transparent),
then decoded here with a small PNG reader instead of ``bpy.data.images``:
Blender hands back scene-linear floats from the bottom row upwards, which is an
easy way to report a vertically mirrored profile.

    blender -b --factory-startup -P tools/blender/silhouette_check.py -- --weapon awp
    blender -b --factory-startup -P tools/blender/silhouette_check.py -- --weapon awp --detail
"""
import argparse
import struct
import sys
import zlib
from pathlib import Path

import bpy

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import build_weapon as builder  # noqa: E402
import weapon_common as common  # noqa: E402
import weapon_materials as materials  # noqa: E402
import weapon_preview as preview  # noqa: E402

OUT_DIR = HERE / "previews"
BANDS = 48


# --------------------------------------------------------------------------
# minimal PNG reader (8-bit RGBA, non-interlaced, as Blender writes it)
# --------------------------------------------------------------------------
def read_png(path):
    data = Path(path).read_bytes()
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError("not a PNG: %s" % path)
    pos = 8
    idat = b""
    width = height = depth = colour = None
    while pos < len(data):
        length = struct.unpack(">I", data[pos:pos + 4])[0]
        kind = data[pos + 4:pos + 8]
        body = data[pos + 8:pos + 8 + length]
        pos += 12 + length
        if kind == b"IHDR":
            width, height, depth, colour = struct.unpack(">IIBB", body[:10])
            if depth != 8 or colour not in (2, 6):
                raise ValueError("unsupported PNG: depth=%d colour=%d" % (depth, colour))
        elif kind == b"IDAT":
            idat += body
        elif kind == b"IEND":
            break
    raw = zlib.decompress(idat)
    channels = 3 if colour == 2 else 4
    stride = width * channels
    rows = []
    previous = bytearray(stride)
    offset = 0
    for _ in range(height):
        filter_type = raw[offset]
        offset += 1
        line = bytearray(raw[offset:offset + stride])
        offset += stride
        for index in range(stride):
            left = line[index - channels] if index >= channels else 0
            up = previous[index]
            up_left = previous[index - channels] if index >= channels else 0
            if filter_type == 1:
                line[index] = (line[index] + left) & 0xFF
            elif filter_type == 2:
                line[index] = (line[index] + up) & 0xFF
            elif filter_type == 3:
                line[index] = (line[index] + (left + up) // 2) & 0xFF
            elif filter_type == 4:
                estimate = left + up - up_left
                pa, pb, pc = abs(estimate - left), abs(estimate - up), abs(estimate - up_left)
                nearest = left if (pa <= pb and pa <= pc) else (up if pb <= pc else up_left)
                line[index] = (line[index] + nearest) & 0xFF
        rows.append(bytes(line))
        previous = line
    return width, height, channels, rows


def _alpha(row, channels, x):
    if channels == 4:
        return row[x * 4 + 3]
    return 255 if row[x * 3:x * 3 + 3] != b"\x00\x00\x00" else 0


# --------------------------------------------------------------------------
def build_mask(weapon_id, resolution=512):
    module = builder.load(weapon_id)
    common.reset_scene()
    root = module.build(materials.gun_palette())
    builder.bake_geometry(root)

    objects = [root] + list(root.children_recursive)
    minimum, maximum = preview._object_bounds(objects)
    centre = (minimum + maximum) / 2
    size = maximum - minimum
    span = max(size.x, size.y, size.z)

    scene = bpy.context.scene
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.display.shading.light = "FLAT"
    scene.display.shading.color_type = "SINGLE"
    scene.display.shading.single_color = (1, 1, 1)
    scene.render.resolution_x = resolution
    scene.render.resolution_y = resolution
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.compression = 0

    distance = span * 4.0
    camera = preview._camera((centre.x + distance, centre.y, centre.z), centre,
                             ortho_scale=span * 1.04)
    camera.data.type = "ORTHO"
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    path = OUT_DIR / ("%s_mask.png" % weapon_id)
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)
    return path, minimum, maximum, span, resolution


def ascii_art(rows, channels, width, height, columns=112, lines=30):
    """Print the mask as text art: an unambiguous view of the modelled outline."""
    print("  outline (muzzle to the RIGHT, %d cols x %d rows):" % (columns, lines))
    for line in range(lines):
        y0 = int(line * height / lines)
        y1 = max(y0 + 1, int((line + 1) * height / lines))
        text = []
        for column in range(columns):
            x0 = int(column * width / columns)
            x1 = max(x0 + 1, int((column + 1) * width / columns))
            filled = 0
            total = 0
            for py in range(y0, y1):
                row = rows[py]
                for px in range(x0, x1):
                    total += 1
                    if _alpha(row, channels, px) > 100:
                        filled += 1
            ratio = filled / float(total) if total else 0.0
            text.append("#" if ratio > 0.6 else ("+" if ratio > 0.25 else
                                                ("." if ratio > 0.02 else " ")))
        print("  |%s|" % "".join(text))


def report(weapon_id, resolution=512, detail=False, art=False):
    path, minimum, maximum, span, resolution = build_mask(weapon_id, resolution)
    width, height, channels, rows = read_png(path)
    scale = span * 1.04 / width          # metres per pixel
    centre_y = (minimum.y + maximum.y) / 2
    centre_z = (minimum.z + maximum.z) / 2

    def model_y(px):
        return (px - width / 2.0) * scale + centre_y

    def model_z(py):
        return (height / 2.0 - py) * scale + centre_z

    columns = []
    for px in range(width):
        filled = []
        for py in range(height):
            if _alpha(rows[py], channels, px) > 100:
                filled.append(py)
        columns.append(filled)

    if art:
        ascii_art(rows, channels, width, height)
        return path

    print("SILHOUETTE %s  span=%.3f m  scale=%.5f m/px  frame=%dx%d"
          % (weapon_id, span, scale, width, height))
    print("  overall y %.3f .. %.3f    z %.3f .. %.3f"
          % (minimum.y, maximum.y, minimum.z, maximum.z))
    print("  %-9s %-9s %-9s %-9s %s" % ("y(m)", "z_top", "z_bot", "z_span", "runs"))
    for band in range(BANDS):
        start = int(band * width / BANDS)
        end = max(start + 1, int((band + 1) * width / BANDS))
        band_columns = [columns[px] for px in range(start, end)]
        best = max(band_columns, key=len)
        if not best:
            continue
        # count separate filled runs in that column
        runs = 1
        for index in range(1, len(best)):
            if best[index] != best[index - 1] + 1:
                runs += 1
        print("  %-9.3f %-9.3f %-9.3f %-9.3f %d"
              % (model_y((start + end) / 2.0), model_z(best[0]), model_z(best[-1]),
                 model_z(best[0]) - model_z(best[-1]), runs))

    if detail:
        print("  through-holes / gaps at 32 stations:")
        for band in range(32):
            px = min(width - 1, int((band + 0.5) * width / 32))
            filled = columns[px]
            if not filled:
                continue
            gaps = []
            for index in range(1, len(filled)):
                if filled[index] != filled[index - 1] + 1:
                    gaps.append((model_z(filled[index - 1]), model_z(filled[index])))
            if gaps:
                print("    y=%.3f  %d runs  gaps: %s"
                      % (model_y(px), len(gaps) + 1,
                         ", ".join("%.3f..%.3f" % gap for gap in gaps)))
    return path


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--weapon", required=True)
    parser.add_argument("--resolution", type=int, default=512)
    parser.add_argument("--detail", action="store_true")
    parser.add_argument("--art", action="store_true")
    args = parser.parse_args(argv)
    report(args.weapon, args.resolution, args.detail, args.art)
    return 0


if __name__ == "__main__":
    sys.exit(main())
