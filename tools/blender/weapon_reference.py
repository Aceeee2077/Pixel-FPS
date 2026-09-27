"""Reference-image analysis: background removal, silhouette metrics, colour zones.

The game's reference PNGs are studio renders on a soft charcoal vignette. This
module recovers a real silhouette mask from them without any third-party image
library: it models the background as a coarse colour histogram learned from the
border ring, walks inward through pixels that look like background, and keeps
the largest enclosed component as the weapon.

The mask is used for proportion measurements, silhouette scoring and preview
overlays. No reference pixel is ever projected onto exported geometry.
"""
import math
import zlib
from collections import deque

import bpy

MASK_LEVELS = 6  # background colour histogram resolution per channel

# Terms of the fitted background surface: a quartic keeps radial vignettes smooth.
TERMS = [(i, j) for i in range(5) for j in range(5 - i)]


def _solve(matrix, size):
    """Gaussian elimination with partial pivoting for a small dense system."""
    for column in range(size):
        pivot = max(range(column, size), key=lambda r: abs(matrix[r][column]))
        if abs(matrix[pivot][column]) < 1e-12:
            continue
        matrix[column], matrix[pivot] = matrix[pivot], matrix[column]
        scale = matrix[column][column]
        for j in range(column, size + 1):
            matrix[column][j] /= scale
        for row in range(size):
            if row == column:
                continue
            factor = matrix[row][column]
            if factor == 0.0:
                continue
            for j in range(column, size + 1):
                matrix[row][j] -= factor * matrix[column][j]
    return [matrix[i][size] for i in range(size)]


# --------------------------------------------------------------------------
# image i/o without external dependencies
# --------------------------------------------------------------------------
def load_image(path):
    image = bpy.data.images.load(str(path), check_existing=False)
    width, height = image.size
    pixels = list(image.pixels)
    bpy.data.images.remove(image)
    return width, height, pixels


def write_png(path, width, height, rgb_rows):
    """Write an 8-bit RGB PNG from a list of bytearray rows."""
    raw = b"".join(b"\x00" + bytes(row) for row in rgb_rows)

    def chunk(tag, payload):
        return (len(payload).to_bytes(4, "big") + tag + payload
                + (zlib.crc32(tag + payload) & 0xFFFFFFFF).to_bytes(4, "big"))

    header = (width.to_bytes(4, "big") + height.to_bytes(4, "big")
              + bytes([8, 2, 0, 0, 0]))
    data = (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", header)
            + chunk(b"IDAT", zlib.compress(raw, 6)) + chunk(b"IEND", b""))
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    return path


def _to_srgb(value):
    value = max(0.0, min(1.0, value))
    return 12.92 * value if value <= 0.0031308 else 1.055 * value ** (1 / 2.4) - 0.055


# --------------------------------------------------------------------------
# background model + silhouette
# --------------------------------------------------------------------------
class ReferenceAnalysis:
    """Silhouette and proportion metrics recovered from one reference render.

    Rows are indexed bottom-up, matching Blender's image buffers; ``row(y)``
    helpers below convert to the human "y grows downward" convention.
    """

    def __init__(self, path, name, locate=None):
        self.path = path
        self.name = name
        self.width = 0
        self.height = 0
        self.scale = 1
        self.rows = []            # downsampled rgb floats, top-down
        self.mask = []            # downsampled bool rows, top-down
        self.bounds = None        # (x0, y0, x1, y1) inclusive, top-down
        self.columns = []         # per-column (top, bottom) inside bounds
        self.colors = []
        self.coverage = 0.0
        self._locate = locate or {}
        self._load()

    # ---- loading -------------------------------------------------------
    def _load(self):
        width, height, pixels = load_image(self.path)
        self.width, self.height = width, height
        # 2x downsample keeps a 627px silhouette, plenty for proportion work.
        self.scale = 2
        sample_w, sample_h = width // self.scale, height // self.scale
        rows = []
        stride = width * 4
        for y in range(sample_h):
            base = (sample_h - 1 - y) * self.scale * stride   # flip to top-down
            row = []
            for x in range(sample_w):
                index = base + x * self.scale * 4
                row.append((pixels[index], pixels[index + 1], pixels[index + 2]))
            rows.append(row)
        self.rows = rows
        self._build_background_model()
        self._flood_fill()

    def _build_background_model(self):
        """Fit a smooth 2D surface to the border ring of the render.

        The studio backdrops are gradients (sometimes radial), so a flat colour
        key cannot separate a dark receiver from a dark vignette. A quartic
        surface fitted only on border pixels stays accurate across the whole
        frame while the weapon occupies the interior.
        """
        height, width = len(self.rows), len(self.rows[0])
        ring = max(3, min(width, height) // 40)
        samples = []
        for y in range(height):
            for x in range(width):
                if x < ring or x >= width - ring or y < ring or y >= height - ring:
                    samples.append((x / (width - 1.0), y / (height - 1.0), self.rows[y][x]))
        self._fit_background(samples)
        residuals = [[0.0] * width for _ in range(height)]
        for y in range(height):
            for x in range(width):
                model = self._surface(x / (width - 1.0), y / (height - 1.0))
                pixel = self.rows[y][x]
                residuals[y][x] = sum(abs(pixel[i] - model[i]) for i in range(3)) / 3.0
        self.residuals = residuals
        self.bg_estimate = self._surface(0.5, 0.5)
        self._histogram_background()

    def _fit_background(self, samples):
        terms = len(TERMS)
        matrix = [[0.0] * (terms + 1) for _ in range(terms)]
        for u, v, pixel in samples:
            feature = [u ** i * v ** j for i, j in TERMS]
            for i in range(terms):
                fi = feature[i]
                if fi == 0.0:
                    continue
                row = matrix[i]
                for j in range(terms):
                    row[j] += fi * feature[j]
                row[terms] += fi * (pixel[0] + pixel[1] + pixel[2]) / 3.0
        self._coefficients = _solve(matrix, terms)
        # per-channel refinement keeps colour keys usable for the zone report
        self._channel_coefficients = []
        for channel in range(3):
            channel_matrix = [[0.0] * (terms + 1) for _ in range(terms)]
            for u, v, pixel in samples:
                feature = [u ** i * v ** j for i, j in TERMS]
                for i in range(terms):
                    fi = feature[i]
                    if fi == 0.0:
                        continue
                    row = channel_matrix[i]
                    for j in range(terms):
                        row[j] += fi * feature[j]
                    row[terms] += fi * pixel[channel]
            self._channel_coefficients.append(_solve(channel_matrix, terms))

    def _surface(self, u, v):
        feature = [u ** i * v ** j for i, j in TERMS]
        return [sum(c * f for c, f in zip(coeffs, feature)) for coeffs in self._channel_coefficients]

    def _histogram_background(self):
        """Coarse colour histogram of pixels the surface explains, for zoning."""
        buckets = {}
        height, width = len(self.rows), len(self.rows[0])
        for y in range(height):
            for x in range(width):
                if self.residuals[y][x] < 0.012:
                    pixel = self.rows[y][x]
                    key = tuple(min(MASK_LEVELS - 1, int(c * MASK_LEVELS)) for c in pixel)
                    buckets[key] = buckets.get(key, 0) + 1
        self.background = {key for key, count in buckets.items() if count >= 4}
        self.background_strict = {key for key, count in buckets.items() if count >= 40}

    def _flood_fill(self):
        height, width = len(self.rows), len(self.rows[0])
        flat = sorted(r for row in self.residuals for r in row)
        noise = flat[int(len(flat) * 0.5)]
        # Anything the surface cannot explain is candidate weapon material.
        threshold = max(noise * 1.8, 0.010)
        self.threshold = threshold
        foreground = [[self.residuals[y][x] > threshold for x in range(width)] for y in range(height)]
        mask = self._close(foreground)
        mask = self._largest_component(mask)
        mask = self._fill_holes(mask)
        self.mask = mask
        self.coverage = sum(sum(1 for v in row if v) for row in mask) / float(width * height)

    @staticmethod
    def _fill_holes(mask):
        """Any background region not reachable from the border is weapon interior.

        Dark gem inlays and shadowed receivers punch holes in the residual mask;
        as a silhouette they are part of the body.
        """
        height, width = len(mask), len(mask[0])
        outside = [[False] * width for _ in range(height)]
        queue = deque()
        for y in range(height):
            for x in range(width):
                if (x in (0, width - 1) or y in (0, height - 1)) and not mask[y][x] and not outside[y][x]:
                    outside[y][x] = True
                    queue.append((x, y))
        while queue:
            x, y = queue.popleft()
            for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                if 0 <= nx < width and 0 <= ny < height and not mask[ny][nx] and not outside[ny][nx]:
                    outside[ny][nx] = True
                    queue.append((nx, ny))
        return [[True if mask[y][x] else not outside[y][x] for x in range(width)] for y in range(height)]

    @staticmethod
    def _close(mask, radius=2):
        """Dilate then erode: bridges gaps where dark metal matches the backdrop."""
        height, width = len(mask), len(mask[0])

        def dilate(source, r):
            out = [[False] * width for _ in range(height)]
            for y in range(height):
                for x in range(width):
                    if source[y][x]:
                        for dy in range(-r, r + 1):
                            ny = y + dy
                            if 0 <= ny < height:
                                row = out[ny]
                                for dx in range(-r, r + 1):
                                    nx = x + dx
                                    if 0 <= nx < width:
                                        row[nx] = True
            return out

        def erode(source, r):
            out = [[False] * width for _ in range(height)]
            for y in range(height):
                for x in range(width):
                    if not source[y][x]:
                        continue
                    solid = True
                    for dy in range(-r, r + 1):
                        for dx in range(-r, r + 1):
                            ny, nx = y + dy, x + dx
                            if not (0 <= ny < height and 0 <= nx < width) or not source[ny][nx]:
                                solid = False
                                break
                        if not solid:
                            break
                    out[y][x] = solid
            return out

        return erode(dilate(mask, radius), radius)

    @staticmethod
    def _largest_component(mask):
        height, width = len(mask), len(mask[0])
        seen = [[False] * width for _ in range(height)]
        best = []
        for start_y in range(height):
            for start_x in range(width):
                if not mask[start_y][start_x] or seen[start_y][start_x]:
                    continue
                component = []
                queue = deque([(start_x, start_y)])
                seen[start_y][start_x] = True
                while queue:
                    x, y = queue.popleft()
                    component.append((x, y))
                    for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                        if 0 <= nx < width and 0 <= ny < height:
                            if mask[ny][nx] and not seen[ny][nx]:
                                seen[ny][nx] = True
                                queue.append((nx, ny))
                if len(component) > len(best):
                    best = component
        out = [[False] * width for _ in range(height)]
        for x, y in best:
            out[y][x] = True
        return out

    # ---- metrics -------------------------------------------------------
    def measure(self):
        height, width = len(self.mask), len(self.mask[0])
        xs, ys = [], []
        for y in range(height):
            for x in range(width):
                if self.mask[y][x]:
                    xs.append(x)
                    ys.append(y)
        if not xs:
            raise ValueError("no silhouette recovered from %s" % self.path)
        x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
        self.bounds = (x0, y0, x1, y1)
        self.columns = []
        for x in range(x0, x1 + 1):
            top, bottom = None, None
            for y in range(y0, y1 + 1):
                if self.mask[y][x]:
                    if top is None:
                        top = y
                    bottom = y
            self.columns.append((top, bottom) if top is not None else (None, None))
        self.colors = self._colour_zones()
        self.quality = self._quality()
        return self

    def _quality(self):
        """Heuristic confidence: a real weapon fills a good part of its box."""
        x0, y0, x1, y1 = self.bounds
        box = float((x1 - x0 + 1) * (y1 - y0 + 1))
        filled = sum(sum(1 for value in row if value) for row in self.mask)
        fraction = filled / box if box else 0.0
        self.fill_fraction = round(fraction, 4)
        # rifles sit near 0.35-0.6, pistols near 0.45-0.65, knives 0.35-0.6
        reliable = 0.22 <= fraction <= 0.95 and filled > 400
        return {"fill_fraction": round(fraction, 4),
                "threshold": round(getattr(self, "threshold", 0.0), 4),
                "reliable": bool(reliable),
                "note": ("silhouette recovered" if reliable else
                         "low confidence: proportions cross-checked against vision report")}

    def _colour_zones(self):
        height, width = len(self.mask), len(self.mask[0])
        # 5 zones along the barrel axis x 3 vertical bands
        buckets = {}
        x0, y0, x1, y1 = self.bounds
        span_x = max(1, x1 - x0)
        span_y = max(1, y1 - y0)
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                if not self.mask[y][x]:
                    continue
                zone = min(4, int((x - x0) * 5 / span_x))
                band = min(2, int((y - y0) * 3 / span_y))
                pixel = self.rows[y][x]
                key = (zone * 3 + band,
                       tuple(min(7, int(c * 8)) for c in pixel))
                entry = buckets.setdefault(key, [0, [0.0, 0.0, 0.0]])
                entry[0] += 1
                for i in range(3):
                    entry[1][i] += pixel[i]
        zones = {}
        for (slot, rgb_key), (count, total) in buckets.items():
            zone, band = divmod(slot, 3)
            mean = [total[i] / count for i in range(3)]
            hex_value = "#%02x%02x%02x" % tuple(int(_to_srgb(c) * 255) for c in mean)
            weight = count / float(span_x * span_y)
            key = "z%d.b%d" % (zone, band)
            if key not in zones or zones[key][2] < weight:
                zones[key] = (hex_value, [round(c, 4) for c in mean], weight)
            elif weight > 0.02:
                zones[key + ".alt%d" % count] = (hex_value, [round(c, 4) for c in mean], weight)
        return {key: {"hex": val[0], "linear": val[1], "weight": round(val[2], 4)}
                for key, val in sorted(zones.items())}

    # ---- proportions ---------------------------------------------------
    def proportions(self):
        """Normalised weapon measurements relative to overall length."""
        x0, y0, x1, y1 = self.bounds
        length = float(x1 - x0 + 1)
        height = float(y1 - y0 + 1)
        result = {
            "pixels": {"x0": x0, "y0": y0, "x1": x1, "y1": y1,
                       "length": int(length), "height": int(height)},
            "length_over_height": round(length / height, 4),
        }
        try:
            result["located"] = self.located_proportions()
        except (KeyError, ValueError, ZeroDivisionError):
            result["located"] = {}
        return result

    def x_at(self, fraction):
        """Absolute sample-space x for a fraction of the weapon length."""
        x0, _, x1, _ = self.bounds
        return int(round(x0 + (x1 - x0) * fraction))

    def located_proportions(self):
        """Compare vision-reported feature pixels with the measured mask.

        ``locate`` holds named feature positions in 1254x1254 reference pixels
        (x measured on the full-size image, barrel direction normalised by the
        caller). Values are converted into length fractions and reported next
        to the mask bounds so a spec author can check the two agree.
        """
        x0, y0, x1, y1 = self.bounds
        length = float(x1 - x0)
        sample = self.scale
        located = {}
        for key, value in self._locate.items():
            if isinstance(value, (list, tuple)):
                absolute = value[1] / sample if len(value) > 1 else None
                fraction_raw = None
                if absolute is not None:
                    fraction_raw = (absolute - x0) / length if length else 0.0
                stage = value[0]
                if fraction_raw is None:
                    located[key] = {"stage": stage}
                else:
                    direction = "from_stock" if stage == "stock" else "from_muzzle"
                    fraction = fraction_raw if direction == "from_stock" else 1.0 - fraction_raw
                    located[key] = {"stage": stage, "direction": direction,
                                    "fraction": round(fraction, 4),
                                    "source_pixel": value[1]}
            else:
                located[key] = {"stage": value}
        return located

    # ---- convenience ---------------------------------------------------
    def column_heights(self, bins=48):
        """Normalised silhouette height profile, stock end first."""
        if not self.columns:
            self.measure()
        result = []
        count = len(self.columns)
        for i in range(bins):
            lo = int(i * count / bins)
            hi = max(lo + 1, int((i + 1) * count / bins))
            tops = [c[0] for c in self.columns[lo:hi] if c[0] is not None]
            bottoms = [c[1] for c in self.columns[lo:hi] if c[1] is not None]
            if not tops:
                result.append(0.0)
                continue
            span = (max(bottoms) - min(tops) + 1)
            height = self.bounds[3] - self.bounds[1] + 1
            result.append(round(span / float(height), 4))
        return result

    def debug_overlay(self, path, keep_colour=0.28):
        """Dimmed reference with the recovered mask tinted green."""
        rows = []
        height, width = len(self.rows), len(self.rows[0])
        for y in range(height):
            row = bytearray()
            for x in range(width):
                r, g, b = self.rows[y][x]
                if self.mask[y][x]:
                    row += bytes((int(_to_srgb(g) * 255), int(_to_srgb(r) * 90 + 90), int(_to_srgb(b) * 90)))
                else:
                    row += bytes((int(_to_srgb(r * keep_colour) * 255),
                                  int(_to_srgb(g * keep_colour) * 255),
                                  int(_to_srgb(b * keep_colour) * 255)))
            rows.append(row)
        return write_png(path, width, height, rows)

    def mask_png(self, path):
        rows = []
        height, width = len(self.mask), len(self.mask[0])
        for y in range(height):
            row = bytearray()
            for x in range(width):
                value = 255 if self.mask[y][x] else 0
                row += bytes((value, value, value))
            rows.append(row)
        return write_png(path, width, height, rows)

    def mask_crop_png(self, path, scale=None):
        """Black/white view of the recovered silhouette, cropped to its bounds."""
        if not self.bounds:
            self.measure()
        x0, y0, x1, y1 = self.bounds
        width, height = x1 - x0 + 1, y1 - y0 + 1
        box = max(width, height)
        if scale is None:
            scale = max(1, int(math.ceil(520.0 / box)))
        rows = []
        for y in range(y0, y1 + 1, scale):
            row = bytearray()
            for x in range(x0, x1 + 1, scale):
                value = 255 if self.mask[y][x] else 0
                row += bytes((value, value, value))
            rows.append(row)
        return write_png(path, len(rows[0]), len(rows), rows)

def normalise_mask(mask, target=128):
    """Scale a boolean mask to fit ``target`` keeping aspect, centred."""
    height, width = len(mask), len(mask[0])
    xs = [x for y in range(height) for x in range(width) if mask[y][x]]
    ys = [y for y in range(height) for x in range(width) if mask[y][x]]
    if not xs:
        return [[False] * target for _ in range(target)], (0, 0, 0, 0)
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    box_w, box_h = x1 - x0 + 1, y1 - y0 + 1
    scale = target / float(max(box_w, box_h))
    out_w, out_h = max(1, int(round(box_w * scale))), max(1, int(round(box_h * scale)))
    offset_x, offset_y = (target - out_w) // 2, (target - out_h) // 2
    grid = [[False] * target for _ in range(target)]
    for oy in range(out_h):
        sy = y0 + int(oy / scale)
        if sy > y1:
            break
        for ox in range(out_w):
            sx = x0 + int(ox / scale)
            if sx > x1:
                break
            if mask[sy][sx]:
                grid[offset_y + oy][offset_x + ox] = True
    return grid, (x0, y0, x1, y1)


def compare_silhouettes(reference_mask, model_mask, target=128):
    """IoU plus a 32-bin column-height correlation between two silhouettes."""
    ref, _ = normalise_mask(reference_mask, target)
    model, _ = normalise_mask(model_mask, target)
    intersection = union = 0
    for y in range(target):
        for x in range(target):
            a, b = ref[y][x], model[y][x]
            if a and b:
                intersection += 1
            if a or b:
                union += 1
    iou = intersection / union if union else 0.0
    bins = 32
    ref_profile = _profile(ref, target, bins)
    model_profile = _profile(model, target, bins)
    error = sum(abs(a - b) for a, b in zip(ref_profile, model_profile)) / bins
    coverage = sum(1 for a, b in zip(ref_profile, model_profile) if abs(a - b) < 0.18) / bins
    return {"iou": round(iou, 4), "profile_error": round(error, 4),
            "profile_match": round(coverage, 4)}


def side_by_side(reference_mask, model_mask, path, target=192, gap=12):
    """Write a comparison PNG: reference outline, model outline, and overlay."""
    ref, _ = normalise_mask(reference_mask, target)
    model, _ = normalise_mask(model_mask, target)
    width = target * 3 + gap * 2
    height = target
    rows = []
    for y in range(height):
        row = bytearray()
        for x in range(width):
            if x >= 2 * (target + gap):
                column = x - 2 * (target + gap)
                a = ref[y][column]
                b = model[y][column]
                # magenta = reference only, cyan = model only, white = both
                row += bytes((190 if a else 22, 90 if a else 22, 190 if b else 22)) if not (a and b) \
                    else bytes((225, 225, 225))
            elif x >= target + gap:
                column = x - (target + gap)
                value = 235 if model[y][column] else 18
                row += bytes((value, value, value))
            else:
                value = 235 if ref[y][x] else 18
                row += bytes((value, value, value))
        rows.append(row)
    return write_png(path, width, height, rows)


def _profile(grid, size, bins):
    result = []
    for i in range(bins):
        lo, hi = int(i * size / bins), max(int(i * size / bins) + 1, int((i + 1) * size / bins))
        count = 0
        for y in range(size):
            if any(grid[y][x] for x in range(lo, hi)):
                count += 1
        result.append(count / float(size))
    return result


def mask_from_alpha(width, height, alpha, target_rows):
    """Build a boolean mask from a rendered alpha channel (bottom-up rows)."""
    mask = []
    for y in range(height):
        row = []
        base = (height - 1 - y) * width
        for x in range(width):
            row.append(alpha[base + x] > 0.35)
        mask.append(row)
    return mask
