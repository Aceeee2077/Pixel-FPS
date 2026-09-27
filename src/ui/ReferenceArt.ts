/**
 * The project reference renders are 1254x1254 studio images whose subject sits
 * inside a wide margin of empty backdrop. Used raw in a card they read as a
 * hairline in a field of grey, so the silhouette band measured by the Blender
 * pipeline (`subject_crop` in tools/blender/reference_manifest.json) is applied
 * on a canvas at runtime.
 *
 * The crop is a measurement, not a new asset: no reference pixel is ever used
 * as a texture on exported geometry.
 */
export const DEFAULT_CROP: Crop = [0, 0.14, 1, 0.72];
export type Crop = readonly [number, number, number, number];

/** Normalised subject rectangles, kept in sync with reference_manifest.json. */
const SUBJECT_CROPS: Readonly<Record<string, Crop>> = {
    'ak-47': [0, 0.24, 1, 0.573],
    'm4a4': [0, 0.199, 0.88, 0.611],
    'm4a1-s': [0, 0.093, 1, 0.643],
    'awp': [0, 0.071, 1, 0.664],
    'glock': [0, 0.105, 1, 0.863],
    'usp-s': [0, 0.15, 1, 0.765],
    'deagle': [0, 0.119, 1, 0.807],
    'famas': [0, 0.048, 1, 0.773],
    'aug': [0, 0.091, 1, 0.679],
    'p2000': [0, 0.148, 0.995, 0.838],
    'p250': [0, 0.085, 1, 0.848],
    'five-seven': [0.016, 0.159, 0.952, 0.815],
    'tec-9': [0, 0.086, 0.956, 0.843],
    'cz75': [0.009, 0.041, 0.968, 0.911],
    'mp9': [0, 0.101, 1, 0.832],
    'mac-10': [0, 0.027, 1, 0.973],
    'mp7': [0, 0.15, 1, 0.752],
    'pp-bizon': [0, 0.241, 1, 0.495],
    'p90': [0, 0.095, 1, 0.727],
    'knife': [0, 0, 1, 1],
    'butterfly': [0, 0.018, 1, 0.974],
    'karambit': [0, 0.074, 1, 0.852],
    'm9': [0, 0.023, 1, 0.97],
    'ump-45': [0, 0.14, 1, 0.72],
    // Skin variants reuse a weapon's render but not always the same framing:
    // M4A4_Asimov.png is a separate render with its own measured band.
    'm4a4:asimov': [0, 0.182, 0.895, 0.618],
};

/** Crop rectangle for a skin card, keyed by the variant rather than the weapon. */
export const SKIN_CROPS: Readonly<Record<string, string>> = {
    'classic': 'knife',
    'butterfly-emerald': 'butterfly',
    'butterfly-fade': 'butterfly',
    'karambit-emerald': 'karambit',
    'm9-ruby': 'm9',
    'standard': 'm4a4',
    'asimov': 'm4a4:asimov',
    'default': 'glock',
    'copper': 'glock',
};

export function skinCrop(skinId: string): Crop {
    return subjectCrop(SKIN_CROPS[skinId] ?? skinId);
}

export function subjectCrop(id: string, family?: string | null): Crop {
    const key = family ?? id;
    return SUBJECT_CROPS[key] ?? SUBJECT_CROPS[id] ?? DEFAULT_CROP;
}

const cache = new Map<string, string>();
const inFlight = new Set<string>();

/**
 * Crop ``source`` to ``crop``, letterboxing onto the catalogue backdrop so the
 * result fills a card of ``aspect`` without distorting the weapon.
 *
 * Resolves to the original URL when anything is unavailable (no 2D context,
 * decode failure, a tainted canvas), so the caller always has usable art.
 */
export async function croppedArt(source: string, crop: Crop, aspect = 2.1): Promise<string> {
    const key = `${source}|${crop.join(',')}|${aspect}`;
    const ready = cache.get(key);
    if (ready) return ready;
    if (inFlight.has(key)) return source;
    inFlight.add(key);
    try {
        const image = new Image();
        image.decoding = 'async';
        image.src = source;
        await image.decode();
        const naturalWidth = image.naturalWidth || 1;
        const naturalHeight = image.naturalHeight || 1;

        const sx = Math.max(0, Math.min(1, crop[0])) * naturalWidth;
        const sy = Math.max(0, Math.min(1, crop[1])) * naturalHeight;
        const sw = Math.max(1, Math.min(1 - crop[0], crop[2]) * naturalWidth);
        const sh = Math.max(1, Math.min(1 - crop[1], crop[3]) * naturalHeight);

        // Show as much of the subject as possible inside the card shape.
        const scale = Math.max(sw / (aspect * sh), 1);
        const viewWidth = Math.min(naturalWidth - sx, sw * scale);
        const viewHeight = Math.min(naturalHeight - sy, sh * scale);
        const viewX = sx - (viewWidth - sw) / 2;
        const viewY = sy - (viewHeight - sh) / 2;

        const height = 320;
        const width = Math.round(height * aspect);
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        if (!context) return source;
        context.fillStyle = '#141518';
        context.fillRect(0, 0, width, height);
        context.drawImage(image,
            Math.max(0, viewX), Math.max(0, viewY), viewWidth, viewHeight,
            0, 0, width, height);
        const url = canvas.toDataURL('image/webp', 0.9);
        cache.set(key, url);
        return url;
    } catch {
        return source;
    } finally {
        inFlight.delete(key);
    }
}

/** Swap an ``<img>`` to its cropped art once it decodes. */
export function applyCrop(image: HTMLImageElement, crop: Crop, aspect = 2.1) {
    const source = image.dataset.raw ?? image.src;
    image.dataset.raw = source;
    void croppedArt(source, crop, aspect).then(url => {
        if (!image.isConnected || image.dataset.raw !== source) return;
        // The refined canvas version already carries its own framing.
        image.style.objectFit = 'contain';
        image.style.objectPosition = '50% 50%';
        image.src = url;
    });
}
