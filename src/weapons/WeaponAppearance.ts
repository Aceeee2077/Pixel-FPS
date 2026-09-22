import type { WeaponId } from './WeaponConfig';

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
export type KnifeStyle = typeof KNIVES[number]['id'];
export type RifleSkin = typeof RIFLE_SKINS[number]['id'];
export interface WeaponAppearance { knifeStyle: KnifeStyle; rifleSkin: RifleSkin }
export const DEFAULT_APPEARANCE: WeaponAppearance = { knifeStyle: 'classic', rifleSkin: 'standard' };
export function knifeInfo(style: KnifeStyle) { return KNIVES.find(k => k.id === style)!; }
export function appearanceKey(id: WeaponId, appearance: WeaponAppearance) {
    return `${id}:${id === 'knife' ? appearance.knifeStyle : id === 'rifle' ? appearance.rifleSkin : 'standard'}`;
}
export function weaponImage(id: WeaponId, appearance: WeaponAppearance) {
    if (id === 'knife') return knifeInfo(appearance.knifeStyle).image;
    if (id === 'rifle') return RIFLE_SKINS.find(s => s.id === appearance.rifleSkin)!.image;
    if (id === 'smg') return new URL('../../UMP-45.png', import.meta.url).href;
    if (id === 'sniper') return new URL('../../AWP.png', import.meta.url).href;
    if (id === 'pistol') return new URL('../../Glock.png', import.meta.url).href;
    return '';
}
export function weaponTitle(id: WeaponId, appearance: WeaponAppearance) {
    if (id === 'knife') { const k = knifeInfo(appearance.knifeStyle); return `${k.name} / ${k.finish}`; }
    return id === 'rifle' ? `M4A4 / ${appearance.rifleSkin === 'asimov' ? 'ASIMOV' : 'FIELD'}` : id === 'smg' ? 'UMP-45' : id === 'sniper' ? 'AWP' : id === 'pistol' ? 'GLOCK' : 'SG-08';
}
