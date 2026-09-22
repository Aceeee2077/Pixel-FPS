import { KNIVES, RIFLE_SKINS, type WeaponAppearance } from '../weapons/WeaponAppearance';
import { DEFAULT_MAP_ID, MAPS, RANDOM_MAP_ID } from '../world/Maps';
import type { Lang } from './I18n';
export interface SettingsData extends WeaponAppearance {
    sensitivity: number;
    fov: number;
    volume: number;
    sfx: number;
    quality: 'low' | 'medium' | 'high';
    difficulty: 'easy' | 'normal' | 'hard';
    primary: string;
    map: string;
    lang: Lang;
}
/** First visit follows the browser; after that the stored choice wins. */
const browserLang: Lang = (navigator.language || 'zh').toLowerCase().startsWith('zh') ? 'zh' : 'en';
const defaults: SettingsData = { sensitivity: 1, fov: 90, volume: .6, sfx: .8, quality: 'medium', difficulty: 'normal', primary: 'rifle', map: DEFAULT_MAP_ID, knifeStyle: 'classic', rifleSkin: 'standard', lang: browserLang };
export class Settings {
    data: SettingsData = { ...defaults };
    constructor() {
        try {
            const saved = JSON.parse(localStorage.getItem('blockstrike.settings') || '{}');
            for (const k of ['sensitivity', 'fov', 'volume', 'sfx'] as const)
                if (typeof saved[k] === 'number' && Number.isFinite(saved[k]))
                    this.data[k] = saved[k];
            if (['low', 'medium', 'high'].includes(saved.quality))
                this.data.quality = saved.quality;
            if (['easy', 'normal', 'hard'].includes(saved.difficulty))
                this.data.difficulty = saved.difficulty;
            if (['rifle', 'smg', 'sniper', 'shotgun'].includes(saved.primary))
                this.data.primary = saved.primary;
            if (saved.map === RANDOM_MAP_ID || MAPS.some(m => m.id === saved.map))
                this.data.map = saved.map;
            if (KNIVES.some(k => k.id === saved.knifeStyle)) this.data.knifeStyle = saved.knifeStyle;
            if (RIFLE_SKINS.some(s => s.id === saved.rifleSkin)) this.data.rifleSkin = saved.rifleSkin;
            if (saved.lang === 'zh' || saved.lang === 'en') this.data.lang = saved.lang;
        }
        catch { }
        this.data.fov = Math.max(70, Math.min(120, this.data.fov));
        this.data.sensitivity = Math.max(.2, Math.min(3, this.data.sensitivity));
        this.data.volume = Math.max(0, Math.min(1, this.data.volume));
        this.data.sfx = Math.max(0, Math.min(1, this.data.sfx));
    }
    save() { try {
        localStorage.setItem('blockstrike.settings', JSON.stringify(this.data));
    }
    catch { } }
}
