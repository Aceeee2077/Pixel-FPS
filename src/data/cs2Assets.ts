/**
 * Runtime view of the locally converted Counter-Strike 2 assets.
 *
 * `npm run assets:cs2` writes `public/generated-assets/cs2/manifest.json`. That
 * folder is deliberately not in version control, so on a fresh clone the fetch
 * fails and every lookup returns undefined: the game then renders its own
 * authored models exactly as before. Nothing here is required to boot.
 *
 * The manifest is the single source of truth for asset paths, so the renderer
 * never hard-codes a converted file location.
 */
export interface Cs2Bounds {
    min: [number, number, number];
    max: [number, number, number];
    size: [number, number, number];
}

export interface Cs2WeaponAsset {
    id: string;
    category?: string;
    /** First-person model, built from the `body_hd` mesh group. */
    view: string;
    /** Dropped/world model, built from the `body_legacy` mesh group. */
    world: string;
    viewTriangles?: number;
    worldTriangles?: number;
    materials?: string[];
    textures?: number;
    animations?: string[];
    joints?: number;
    bounds?: Cs2Bounds | null;
    compressed?: boolean;
    validated?: boolean;
    source?: string;
}

interface Cs2Manifest {
    version: number;
    generatedAt: string;
    source: string;
    weapons: Record<string, Cs2WeaponAsset>;
}

export const CS2_MANIFEST_URL = '/generated-assets/cs2/manifest.json';

let pending: Promise<Record<string, Cs2WeaponAsset>> | null = null;
let loaded: Record<string, Cs2WeaponAsset> = {};

/**
 * Fetch the manifest once. A missing or unreadable manifest resolves to an
 * empty catalogue rather than rejecting, because the game must run without it.
 */
export function loadCs2Manifest(): Promise<Record<string, Cs2WeaponAsset>> {
    pending ??= fetch(CS2_MANIFEST_URL)
        .then(response => response.ok ? response.json() as Promise<Cs2Manifest> : null)
        .then(manifest => {
            loaded = manifest?.weapons ?? {};
            return loaded;
        })
        .catch(() => {
            loaded = {};
            return loaded;
        });
    return pending;
}

/** Converted asset for a weapon id, or undefined when the pipeline has not run. */
export async function cs2Asset(id: string): Promise<Cs2WeaponAsset | undefined> {
    const catalogue = await loadCs2Manifest();
    return catalogue[id];
}

/** Same lookup without awaiting; only valid after the first manifest load. */
export function cs2AssetSync(id: string): Cs2WeaponAsset | undefined {
    return loaded[id];
}

/** Longest axis of a converted model, in metres, as recorded by the pipeline. */
export function cs2ModelLength(asset: Cs2WeaponAsset | undefined): number | null {
    const size = asset?.bounds?.size;
    if (!size) return null;
    return Math.max(size[0], size[1], size[2]);
}
