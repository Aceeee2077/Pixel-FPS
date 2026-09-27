import type { WeaponId } from './WeaponConfig';
import { getWeapon } from '../data/weapons';
import { skinById, type WeaponSkin } from './WeaponSkins';

export const KNIVES = [
    { id: 'classic', name: 'Combat Knife', finish: 'IVORY / FIELD', label: '战术匕首', color: '#dce3cf', image: new URL('../../Knife.png', import.meta.url).href },
    { id: 'butterfly-emerald', name: 'Butterfly', finish: 'EMERALD', label: '蝴蝶刀 · 绿宝石', color: '#39e791', image: new URL('../../Butterfly_Knife_Emerald.png', import.meta.url).href },
    { id: 'butterfly-fade', name: 'Butterfly', finish: 'FADE', label: '蝴蝶刀 · 渐变之色', color: '#ed81c4', image: new URL('../../Butterfly_Knife_Fade.png', import.meta.url).href },
    { id: 'karambit-emerald', name: 'Karambit', finish: 'EMERALD', label: '爪子刀 · 绿宝石', color: '#39e791', image: new URL('../../Karambit_Emerald.png', import.meta.url).href },
    { id: 'm9-ruby', name: 'M9 Bayonet', finish: 'RUBY', label: 'M9 刺刀 · 红宝石', color: '#f95770', image: new URL('../../M9Bayonet_Ruby.png', import.meta.url).href },
] as const;
export const RIFLE_SKINS = [
    { id: 'standard', name: 'FIELD / 原版', image: new URL('../../M4A4.png', import.meta.url).href },
    { id: 'asimov', name: 'ASIMOV / 白橙', image: new URL('../../M4A4_Asimov.png', import.meta.url).href },
] as const;
export const PISTOL_SKINS = [
    { id: 'default', name: 'SERVICE / 原版', image: new URL('../../Glock.png', import.meta.url).href },
    { id: 'copper', name: 'COPPER / 铜色', image: new URL('../../Glock.png', import.meta.url).href },
] as const;
export type PistolSkin = typeof PISTOL_SKINS[number]['id'];
export type KnifeStyle = typeof KNIVES[number]['id'];
export type RifleSkin = typeof RIFLE_SKINS[number]['id'];
export interface WeaponAppearance {
    knifeStyle: KnifeStyle;
    rifleSkin: RifleSkin;
    pistolSkin?: PistolSkin;
    /** Equipped owner-supplied model variant, when the weapon has any. */
    finish?: string;
}
export const DEFAULT_APPEARANCE: WeaponAppearance = { knifeStyle: 'classic', rifleSkin: 'standard' };
export function knifeInfo(style: KnifeStyle) { return KNIVES.find(k => k.id === style)!; }
export function appearanceKey(id: WeaponId, appearance: WeaponAppearance) {
    return `${id}:${appearance.finish ?? (id === 'knife' ? appearance.knifeStyle : (id === 'rifle' || id === 'm4a4') ? appearance.rifleSkin : getWeapon(id)?.category === 'pistols' || id === 'pistol' ? appearance.pistolSkin ?? 'default' : 'standard')}`;
}

/**
 * Model for a specific finish. Skin variants that ship their own GLB win over
 * the base weapon model, which is why this is keyed by finish and not by weapon.
 */
export function skinModel(id: WeaponId, finish: string | undefined) {
    return skinById(id, finish)?.model;
}

/** Card/title art for a finish: the variant render when one exists. */
export function finishImage(id: WeaponId, appearance: WeaponAppearance) {
    const skin = skinById(id, appearance.finish);
    if (skin) return skinPreview(skin);
    return weaponImage(id, appearance);
}

/** The variant's own render, derived from the model path the pipeline published. */
export function skinPreview(skin: WeaponSkin) {
    return skin.model.replace(/\.glb$/, '/preview.png');
}

export function weaponImage(id: WeaponId, appearance: WeaponAppearance) {
    if (id === 'knife') return knifeInfo(appearance.knifeStyle).image;
    if (id === 'rifle' || id === 'm4a4') return RIFLE_SKINS.find(s => s.id === appearance.rifleSkin)!.image;
    const definition = getWeapon(id);
    if (definition && id !== 'rifle' && id !== 'smg' && id !== 'sniper' && id !== 'pistol' && id !== 'shotgun') return definition.previewImage ?? '';
    if (id === 'smg') return new URL('../../UMP-45.png', import.meta.url).href;
    if (id === 'sniper') return new URL('../../AWP.png', import.meta.url).href;
    if (id === 'pistol') return new URL('../../Glock.png', import.meta.url).href;
    return '';
}
export function weaponTitle(id: WeaponId, appearance: WeaponAppearance) {
    if (id === 'knife') { const k = knifeInfo(appearance.knifeStyle); return `${k.name} / ${k.finish}`; }
    const definition = getWeapon(id);
    if (definition && !['rifle','smg','sniper','pistol','shotgun'].includes(id)) return definition.displayName;
    return id === 'rifle' ? `M4A4 / ${appearance.rifleSkin === 'asimov' ? 'ASIMOV' : 'FIELD'}` : id === 'smg' ? 'UMP-45' : id === 'sniper' ? 'AWP' : id === 'pistol' ? 'GLOCK' : 'SG-08';
}
