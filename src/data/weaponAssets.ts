// GENERATED FILE - do not edit by hand.
// Source of truth: public/assets/weapons/manifest.json (written by the Blender pipeline).
// Regenerate with: node tools/blender/gen-asset-registry.mjs
export type WeaponAssetStatus = 'reference_only' | 'blockout' | 'refining' | 'game_ready' | 'final' | 'needs_more_reference' | 'third_party';
export interface WeaponAssetRecord {
    model: string;
    thumbnail: string;
    status: WeaponAssetStatus;
    triangles: number;
    materials: number;
}
/** Every weapon id that has a real authored GLB published for it. */
export const weaponAssets: Readonly<Record<string, WeaponAssetRecord>> = {
    'ak-47': { model: '/assets/weapons/ak-47/ak-47.glb', thumbnail: '/assets/weapons/ak-47/preview.webp', status: 'game_ready', triangles: 9372, materials: 6 },
    'aug': { model: '/assets/weapons/aug/aug.glb', thumbnail: '/assets/weapons/aug/preview.webp', status: 'refining', triangles: 6797, materials: 5 },
    'awp': { model: '/assets/weapons/awp/awp.glb', thumbnail: '/assets/weapons/awp/preview.webp', status: 'refining', triangles: 15475, materials: 8 },
    'butterfly': { model: '/assets/weapons/butterfly/butterfly.glb', thumbnail: '/assets/weapons/butterfly/preview.webp', status: 'refining', triangles: 7952, materials: 5 },
    'butterfly-csstlyed': { model: '/assets/weapons/butterfly-csstlyed/butterfly-csstlyed.glb', thumbnail: '/assets/weapons/butterfly-csstlyed/preview.webp', status: 'third_party', triangles: 16218, materials: 8 },
    'cz75': { model: '/assets/weapons/cz75/cz75.glb', thumbnail: '/assets/weapons/cz75/preview.webp', status: 'refining', triangles: 7956, materials: 6 },
    'deagle': { model: '/assets/weapons/deagle/deagle.glb', thumbnail: '/assets/weapons/deagle/preview.webp', status: 'refining', triangles: 7919, materials: 5 },
    'famas': { model: '/assets/weapons/famas/famas.glb', thumbnail: '/assets/weapons/famas/preview.webp', status: 'refining', triangles: 6448, materials: 4 },
    'five-seven': { model: '/assets/weapons/five-seven/five-seven.glb', thumbnail: '/assets/weapons/five-seven/preview.webp', status: 'refining', triangles: 7891, materials: 6 },
    'g3sg1': { model: '/assets/weapons/g3sg1/g3sg1.glb', thumbnail: '/assets/weapons/g3sg1/preview.webp', status: 'refining', triangles: 13892, materials: 7 },
    'galil-ar': { model: '/assets/weapons/galil-ar/galil-ar.glb', thumbnail: '/assets/weapons/galil-ar/preview.webp', status: 'refining', triangles: 7382, materials: 3 },
    'glock': { model: '/assets/weapons/glock/glock.glb', thumbnail: '/assets/weapons/glock/preview.webp', status: 'refining', triangles: 7876, materials: 6 },
    'gungnir': { model: '/assets/weapons/gungnir/gungnir.glb', thumbnail: '/assets/weapons/gungnir/preview.webp', status: 'third_party', triangles: 22580, materials: 2 },
    'karambit': { model: '/assets/weapons/karambit/karambit.glb', thumbnail: '/assets/weapons/karambit/preview.webp', status: 'refining', triangles: 7970, materials: 5 },
    'knife': { model: '/assets/weapons/knife/knife.glb', thumbnail: '/assets/weapons/knife/preview.webp', status: 'refining', triangles: 7982, materials: 5 },
    'm4a1-s': { model: '/assets/weapons/m4a1-s/m4a1-s.glb', thumbnail: '/assets/weapons/m4a1-s/preview.webp', status: 'refining', triangles: 11826, materials: 7 },
    'm4a4': { model: '/assets/weapons/m4a4/m4a4.glb', thumbnail: '/assets/weapons/m4a4/preview.webp', status: 'refining', triangles: 11868, materials: 7 },
    'm9': { model: '/assets/weapons/m9/m9.glb', thumbnail: '/assets/weapons/m9/preview.webp', status: 'refining', triangles: 7968, materials: 5 },
    'mac-10': { model: '/assets/weapons/mac-10/mac-10.glb', thumbnail: '/assets/weapons/mac-10/preview.webp', status: 'refining', triangles: 8878, materials: 6 },
    'mp7': { model: '/assets/weapons/mp7/mp7.glb', thumbnail: '/assets/weapons/mp7/preview.webp', status: 'refining', triangles: 8799, materials: 6 },
    'mp9': { model: '/assets/weapons/mp9/mp9.glb', thumbnail: '/assets/weapons/mp9/preview.webp', status: 'refining', triangles: 8923, materials: 6 },
    'p2000': { model: '/assets/weapons/p2000/p2000.glb', thumbnail: '/assets/weapons/p2000/preview.webp', status: 'refining', triangles: 7897, materials: 6 },
    'p250': { model: '/assets/weapons/p250/p250.glb', thumbnail: '/assets/weapons/p250/preview.webp', status: 'refining', triangles: 7941, materials: 6 },
    'p90': { model: '/assets/weapons/p90/p90.glb', thumbnail: '/assets/weapons/p90/preview.webp', status: 'refining', triangles: 8790, materials: 6 },
    'pp-bizon': { model: '/assets/weapons/pp-bizon/pp-bizon.glb', thumbnail: '/assets/weapons/pp-bizon/preview.webp', status: 'refining', triangles: 8776, materials: 6 },
    'scar-20': { model: '/assets/weapons/scar-20/scar-20.glb', thumbnail: '/assets/weapons/scar-20/preview.webp', status: 'refining', triangles: 14436, materials: 7 },
    'sg-553': { model: '/assets/weapons/sg-553/sg-553.glb', thumbnail: '/assets/weapons/sg-553/preview.webp', status: 'refining', triangles: 6954, materials: 4 },
    'ssg-08': { model: '/assets/weapons/ssg-08/ssg-08.glb', thumbnail: '/assets/weapons/ssg-08/preview.webp', status: 'refining', triangles: 14101, materials: 7 },
    'tec-9': { model: '/assets/weapons/tec-9/tec-9.glb', thumbnail: '/assets/weapons/tec-9/preview.webp', status: 'refining', triangles: 7927, materials: 6 },
    'ump-45': { model: '/assets/weapons/ump-45/ump-45.glb', thumbnail: '/assets/weapons/ump-45/preview.webp', status: 'refining', triangles: 8660, materials: 6 },
    'usp-s': { model: '/assets/weapons/usp-s/usp-s.glb', thumbnail: '/assets/weapons/usp-s/preview.webp', status: 'refining', triangles: 7862, materials: 6 },
    'wildlotus': { model: '/assets/weapons/wildlotus/wildlotus.glb', thumbnail: '/assets/weapons/wildlotus/preview.webp', status: 'third_party', triangles: 13069, materials: 1 },
};
export const weaponAssetIds: readonly string[] = Object.keys(weaponAssets);
export function weaponAsset(id: string): WeaponAssetRecord | undefined {
    return weaponAssets[id];
}
