import type { WeaponId } from './WeaponConfig';
import { getWeapon } from '../data/weapons';
import { localReferenceImage } from '../data/localReferenceImages';
import { skinById, type WeaponSkin } from './WeaponSkins';

const art = (name: string, weaponId: string) => localReferenceImage(name) ?? `/assets/weapons/${weaponId}/preview.webp`;

/**
 * Every equipable blade.
 *
 * `model` is the owner-supplied body a finish ships with, when it has one; it
 * is null for the finishes that only tint the knife family's authored body.
 * The blade a style loads is therefore decided here and not by the weapon
 * registry, which only knows about the four knife families.
 */
export const KNIVES = [
    { id: 'classic', name: 'Combat Knife', finish: 'IVORY / FIELD', label: '战术匕首', color: '#dce3cf', image: art('Knife.png', 'knife'), model: null },
    { id: 'butterfly-emerald', name: 'Butterfly', finish: 'EMERALD', label: '蝴蝶刀 · 绿宝石', color: '#39e791', image: art('Butterfly_Knife_Emerald.png', 'butterfly'), model: null },
    { id: 'butterfly-fade', name: 'Butterfly', finish: 'FADE', label: '蝴蝶刀 · 渐变之色', color: '#ed81c4', image: art('Butterfly_Knife_Fade.png', 'butterfly'), model: '/assets/weapons/butterfly-fade/butterfly-fade.glb' },
    { id: 'karambit-emerald', name: 'Karambit', finish: 'EMERALD', label: '爪子刀 · 绿宝石', color: '#39e791', image: art('Karambit_Emerald.png', 'karambit'), model: null },
    { id: 'm9-ruby', name: 'M9 Bayonet', finish: 'RUBY', label: 'M9 刺刀 · 红宝石', color: '#f95770', image: art('M9Bayonet_Ruby.png', 'm9'), model: null },
] as const;
export const RIFLE_SKINS = [
    { id: 'standard', name: 'FIELD / 原版', image: art('M4A4.png', 'm4a4') },
    { id: 'asimov', name: 'ASIMOV / 白橙', image: art('M4A4_Asimov.png', 'm4a4') },
] as const;
export const PISTOL_SKINS = [
    { id: 'default', name: 'SERVICE / 原版', image: art('Glock.png', 'glock') },
    { id: 'copper', name: 'COPPER / 铜色', image: art('Glock.png', 'glock') },
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

/** The owner-supplied GLB a blade ships with, or null when it tints an authored body. */
export function knifeStyleModel(style: KnifeStyle): string | null { return knifeInfo(style).model; }
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
    if (id === 'smg') return getWeapon('ump-45')?.previewImage ?? '';
    if (id === 'sniper') return getWeapon('awp')?.previewImage ?? '';
    if (id === 'pistol') return getWeapon('glock')?.previewImage ?? '';
    return '';
}
export function weaponTitle(id: WeaponId, appearance: WeaponAppearance) {
    if (id === 'knife') { const k = knifeInfo(appearance.knifeStyle); return `${k.name} / ${k.finish}`; }
    const definition = getWeapon(id);
    if (definition && !['rifle','smg','sniper','pistol','shotgun'].includes(id)) return definition.displayName;
    return id === 'rifle' ? `M4A4 / ${appearance.rifleSkin === 'asimov' ? 'ASIMOV' : 'FIELD'}` : id === 'smg' ? 'UMP-45' : id === 'sniper' ? 'AWP' : id === 'pistol' ? 'GLOCK' : 'SG-08';
}
