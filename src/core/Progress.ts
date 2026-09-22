import type { WeaponId } from '../weapons/WeaponConfig';
import { KNIVES, RIFLE_SKINS, type KnifeStyle, type RifleSkin } from '../weapons/WeaponAppearance';

export const MAX_LEVEL = 10;
/** Levelling order shown in the armory. */
export const WEAPON_ORDER: WeaponId[] = ['rifle', 'smg', 'sniper', 'shotgun', 'pistol', 'knife'];
/** Cost of the level with this index: level 0 → 1 costs 100, then every level costs 60 more. */
export const levelCost = (level: number) => 100 + 60 * Math.max(0, Math.min(level, MAX_LEVEL - 1));
/** Cosmetics unlocked by level. Level 0 items are always available. */
export const KNIFE_UNLOCKS: Record<KnifeStyle, number> = { classic: 0, 'butterfly-fade': 1, 'm9-ruby': 3, 'butterfly-emerald': 5, 'karambit-emerald': 7 };
export const RIFLE_UNLOCKS: Record<RifleSkin, number> = { standard: 0, asimov: 2 };

export interface WeaponProgress {
    level: number;
    xp: number;
}

export interface MatchXp {
    weapon: WeaponId;
    gained: number;
    from: number;
    to: number;
}

/** Per weapon levels and XP, persisted locally. A match hands out XP in `Game.awardMatchXp`. */
export class Progress {
    data: Record<string, WeaponProgress> = {};
    constructor() {
        for (const id of WEAPON_ORDER) this.data[id] = { level: 0, xp: 0 };
        this.load();
    }
    get(id: WeaponId) { return this.data[id] ??= { level: 0, xp: 0 }; }
    /** XP still needed for the next level, or 0 at max level. */
    cost(id: WeaponId) { const p = this.get(id); return p.level >= MAX_LEVEL ? 0 : levelCost(p.level); }
    progress(id: WeaponId) { const p = this.get(id); const cost = this.cost(id); return cost ? Math.min(1, p.xp / cost) : 1; }
    get totalLevels() { return WEAPON_ORDER.reduce((sum, id) => sum + this.get(id).level, 0); }
    unlockedKnife(id: KnifeStyle) { return this.get('knife').level >= KNIFE_UNLOCKS[id]; }
    unlockedRifleSkin(id: RifleSkin) { return this.get('rifle').level >= RIFLE_UNLOCKS[id]; }
    /** Adds XP, rolls any levels it pays for and returns the before/after for the results screen. */
    award(id: WeaponId, xp: number): MatchXp {
        const p = this.get(id), from = p.level, gained = Math.max(0, Math.round(xp));
        if (p.level < MAX_LEVEL) {
            p.xp += gained;
            while (p.level < MAX_LEVEL && p.xp >= levelCost(p.level)) {
                p.xp -= levelCost(p.level);
                p.level++;
            }
            if (p.level >= MAX_LEVEL) p.xp = 0;
        }
        this.save();
        return { weapon: id, gained, from, to: p.level };
    }
    save() { try { localStorage.setItem('blockstrike.progress', JSON.stringify(this.data)); } catch { } }
    load() {
        try {
            const saved = JSON.parse(localStorage.getItem('blockstrike.progress') || '{}') as Record<string, Partial<WeaponProgress>>;
            for (const id of WEAPON_ORDER) {
                const row = saved?.[id];
                if (!row) continue;
                const level = Math.max(0, Math.min(MAX_LEVEL, Math.floor(Number(row.level) || 0)));
                const xp = Math.max(0, Math.floor(Number(row.xp) || 0));
                this.data[id] = { level, xp: level >= MAX_LEVEL ? 0 : xp };
            }
        }
        catch { }
    }
}

/**
 * XP handed out for one finished match. The equipped primary is the main earner: a ten kill round
 * pays exactly the 100 XP that level 0 → 1 costs. Pistol and knife only earn what they use.
 */
export function matchXp(primary: WeaponId, kills: Partial<Record<WeaponId, number>>, won: boolean): { weapon: WeaponId; xp: number }[] {
    const k = (id: WeaponId) => Math.max(0, Math.round(kills[id] ?? 0));
    const rows: { weapon: WeaponId; xp: number }[] = [{ weapon: primary, xp: 40 + 6 * k(primary) + (won ? 20 : 0) }];
    if (primary !== 'pistol') rows.push({ weapon: 'pistol', xp: 20 + 6 * k('pistol') });
    rows.push({ weapon: 'knife', xp: 20 + 6 * k('knife') });
    return rows;
}

export const KNIFE_ORDER = KNIVES.map(k => k.id);
export const RIFLE_SKIN_ORDER = RIFLE_SKINS.map(s => s.id);
