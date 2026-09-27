import type { WeaponId } from '../weapons/WeaponConfig';
import { canonicalWeaponId, weaponRegistry } from '../data/weapons';
import { KNIVES, RIFLE_SKINS, PISTOL_SKINS, type KnifeStyle, type RifleSkin, type PistolSkin } from '../weapons/WeaponAppearance';

export const MAX_LEVEL = 10;
export const PLAYER_MAX_LEVEL = 100;
export const XP_PER_KILL = 50;
export const WEAPON_ORDER: WeaponId[] = weaponRegistry.map(weapon => weapon.id);
export const levelCost = (level: number) => 100 + 60 * Math.max(0, Math.min(level, MAX_LEVEL - 1));
export const playerLevelCost = (level: number) => 150 + 50 * Math.max(0, level);
export const KNIFE_UNLOCKS: Record<KnifeStyle, number> = { classic: 0, 'butterfly-fade': 1, 'm9-ruby': 3, 'butterfly-emerald': 5, 'karambit-emerald': 7 };
export const RIFLE_UNLOCKS: Record<RifleSkin, number> = { standard: 0, asimov: 2 };
export const PISTOL_UNLOCKS: Record<PistolSkin, number> = { default: 0, copper: 1 };

export interface WeaponProgress { level: number; xp: number; kills?: number }
export interface PlayerProgress { level: number; xp: number; kills: number }
export interface MatchXp { weapon: WeaponId; gained: number; from: number; to: number }
const clean = (value: unknown) => Math.max(0, Math.floor(Number(value) || 0));

/** Player and weapon progression are persisted independently inside one versioned record. */
export class Progress {
    data: Record<string, WeaponProgress> = {};
    player: PlayerProgress = { level: 0, xp: 0, kills: 0 };
    constructor() {
        for (const id of WEAPON_ORDER) this.data[id] = { level: 0, xp: 0, kills: 0 };
        this.load();
    }
    get(id: WeaponId) {
        const key = canonicalWeaponId(id);
        return this.data[key] ??= { level: 0, xp: 0, kills: 0 };
    }
    cost(id: WeaponId) { const p = this.get(id); return p.level >= MAX_LEVEL ? 0 : levelCost(p.level); }
    progress(id: WeaponId) { const p = this.get(id), cost = this.cost(id); return cost ? Math.min(1, p.xp / cost) : 1; }
    get totalLevels() { return WEAPON_ORDER.reduce((sum, id) => sum + this.get(id).level, 0); }
    unlockedKnife(id: KnifeStyle) { return this.get('knife').level >= KNIFE_UNLOCKS[id]; }
    unlockedPistolSkin(id: PistolSkin, weaponId: WeaponId = 'glock') { return this.get(weaponId).level >= PISTOL_UNLOCKS[id]; }
    unlockedRifleSkin(id: RifleSkin) { return this.get('m4a4').level >= RIFLE_UNLOCKS[id]; }
    addPlayerXP(amount: number) {
        const gained = clean(amount);
        this.player.xp += gained;
        while (this.player.level < PLAYER_MAX_LEVEL && this.player.xp >= playerLevelCost(this.player.level)) {
            this.player.xp -= playerLevelCost(this.player.level);
            this.player.level++;
        }
        if (this.player.level >= PLAYER_MAX_LEVEL) this.player.xp = 0;
        this.save();
        return gained;
    }
    award(id: WeaponId, xp: number): MatchXp {
        const key = canonicalWeaponId(id), p = this.get(key), from = p.level, gained = clean(xp);
        if (p.level < MAX_LEVEL) {
            p.xp += gained;
            while (p.level < MAX_LEVEL && p.xp >= levelCost(p.level)) {
                p.xp -= levelCost(p.level);
                p.level++;
            }
            if (p.level >= MAX_LEVEL) p.xp = 0;
        }
        this.save();
        return { weapon: key, gained, from, to: p.level };
    }
    awardKillXP(weaponId: WeaponId) {
        const key = canonicalWeaponId(weaponId);
        this.player.kills++;
        this.addPlayerXP(XP_PER_KILL);
        const result = this.award(key, XP_PER_KILL);
        this.get(key).kills = (this.get(key).kills ?? 0) + 1;
        this.save();
        return result;
    }
    save() {
        try { localStorage.setItem('blockstrike.progress', JSON.stringify({ version: 2, player: this.player, weapons: this.data })); }
        catch { }
    }
    load() {
        try {
            const saved = JSON.parse(localStorage.getItem('blockstrike.progress') || '{}') as Record<string, unknown>;
            const player = saved.player as Partial<PlayerProgress> | undefined;
            if (player) this.player = {
                level: Math.min(PLAYER_MAX_LEVEL, clean(player.level)),
                xp: clean(player.xp), kills: clean(player.kills),
            };
            const weapons = (saved.weapons ?? saved) as Record<string, Partial<WeaponProgress>>;
            for (const id of WEAPON_ORDER) {
                const legacy = Object.entries({ rifle: 'm4a4', smg: 'ump-45', sniper: 'awp', shotgun: 'nova', pistol: 'glock' }).find(([, canonical]) => canonical === id)?.[0];
                const row = weapons?.[id] ?? (legacy ? weapons?.[legacy] : undefined);
                if (!row) continue;
                const level = Math.min(MAX_LEVEL, clean(row.level));
                this.data[id] = { level, xp: level >= MAX_LEVEL ? 0 : clean(row.xp), kills: clean(row.kills) };
            }
        } catch { }
    }
}
export const KNIFE_ORDER = KNIVES.map(knife => knife.id);
export const RIFLE_SKIN_ORDER = RIFLE_SKINS.map(skin => skin.id);
export const PISTOL_SKIN_ORDER = PISTOL_SKINS.map(skin => skin.id);
