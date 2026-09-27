import type { KnifeStyle } from './WeaponAppearance';

/**
 * Skin / finish variants that ship their own authored GLB.
 *
 * The base weapon models in this project are clean-room recreations built by
 * `tools/blender` from the project's reference art. The variants below are NOT:
 * they are third-party CS:GO-styled models the project owner supplied, converted
 * to this game's rig contract by `tools/blender/convert_user_model.py`. They are
 * recorded as `third_party` in the asset manifest and credited in CREDITS.md
 * under the CC-BY-4.0 terms their authors published them with.
 */
export interface WeaponSkin {
    /** Stable key stored in settings. */
    key: string;
    label: string;
    /** Published GLB for this finish. */
    model: string;
    /** Blade/knife finish to apply at runtime, when the model uses skin slots. */
    knifeStyle?: KnifeStyle;
    credit: string;
    licence: string;
    source: string;
}

export const WEAPON_SKINS: Readonly<Record<string, readonly WeaponSkin[]>> = {
    'ak-47': [{
        key: 'wildlotus',
        label: 'WILD LOTUS',
        model: '/assets/weapons/wildlotus/wildlotus.glb',
        credit: 'WoodenManufacturing on Sketchfab',
        licence: 'CC-BY-4.0',
        source: 'https://sketchfab.com/3d-models/csgo-ak47-wild-lotus-0af74d693a014c4d9fe5538b99dc0355',
    }],
    awp: [{
        key: 'gungnir',
        label: 'GUNGNIR',
        model: '/assets/weapons/gungnir/gungnir.glb',
        credit: 'WoodenManufacturing on Sketchfab',
        licence: 'CC-BY-4.0',
        source: 'https://sketchfab.com/3d-models/csgo-weapon-awp-gungnir-e1d6a40dc1f1499c8b960b05d13e7f6c',
    }],
    butterfly: [{
        key: 'csstlyed',
        label: 'CS STYLED / 红刃',
        model: '/assets/weapons/butterfly-csstlyed/butterfly-csstlyed.glb',
        credit: 'Aslady on Sketchfab',
        licence: 'CC-BY-4.0',
        source: 'https://sketchfab.com/3d-models/csgo-styled-butterfly-knife-6f023e5fb12947e18ce2d93d38e13cfd',
    }],
};

/** Every credit line, for the generated CREDITS.md and in-app attribution. */
export function allSkinCredits() {
    const rows: { weapon: string; skin: WeaponSkin }[] = [];
    for (const [weapon, skins] of Object.entries(WEAPON_SKINS)) {
        for (const skin of skins) rows.push({ weapon, skin });
    }
    return rows;
}

export function skinsFor(weaponId: string): readonly WeaponSkin[] {
    return WEAPON_SKINS[weaponId] ?? [];
}

export function skinById(weaponId: string, key: string | undefined): WeaponSkin | undefined {
    if (!key) return undefined;
    return skinsFor(weaponId).find(skin => skin.key === key);
}

/**
 * The knife body a butterfly finish belongs to. The knife slot is a single
 * weapon in the registry, so its finish picks both the body and the appearance.
 */
export function knifeIdFor(style: KnifeStyle): string {
    if (style.startsWith('butterfly')) return 'butterfly';
    if (style.startsWith('karambit')) return 'karambit';
    if (style.startsWith('m9')) return 'm9';
    return 'knife';
}
