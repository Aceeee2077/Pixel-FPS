import { getWeapon, weaponRegistry, type WeaponCategory, type WeaponSide } from '../data/weapons';
import { KNIVES, PISTOL_SKINS, type KnifeStyle, type RifleSkin, type PistolSkin } from '../weapons/WeaponAppearance';

export type TeamSide = Exclude<WeaponSide, 'both'>;
export type LoadoutSlot = 'startingPistol' | 'preferredRifle' | 'alternativeRifle' | 'preferredSmg' | 'preferredSniper';
export interface SideLoadout {
    startingPistol: string;
    preferredRifle: string;
    alternativeRifle: string;
    preferredSmg: string;
    preferredSniper: string;
    knifeStyle: KnifeStyle;
    pistolSkin: PistolSkin;
    rifleSkin: RifleSkin;
}
const defaults: Record<TeamSide, SideLoadout> = {
    attackers: { startingPistol: 'glock', preferredRifle: 'ak-47', alternativeRifle: 'galil-ar', preferredSmg: 'mac-10', preferredSniper: 'awp', knifeStyle: 'classic', pistolSkin: 'default', rifleSkin: 'standard' },
    defenders: { startingPistol: 'usp-s', preferredRifle: 'm4a1-s', alternativeRifle: 'm4a4', preferredSmg: 'mp9', preferredSniper: 'awp', knifeStyle: 'classic', pistolSkin: 'default', rifleSkin: 'standard' },
};
const slotCategory: Record<LoadoutSlot, WeaponCategory> = {
    startingPistol: 'pistols', preferredRifle: 'rifles', alternativeRifle: 'rifles',
    preferredSmg: 'smgs', preferredSniper: 'snipers',
};
export class LoadoutStore {
    sides: Record<TeamSide, SideLoadout> = {
        attackers: { ...defaults.attackers }, defenders: { ...defaults.defenders },
    };
    constructor() { this.load(); }
    choices(side: TeamSide, slot: LoadoutSlot) {
        return weaponRegistry.filter(weapon => weapon.category === slotCategory[slot]
            && (weapon.team === side || weapon.team === 'both')
            && (slot !== 'startingPistol' || weapon.price <= 200));
    }
    set(side: TeamSide, slot: LoadoutSlot, id: string) {
        if (!this.choices(side, slot).some(weapon => weapon.id === id)) return false;
        this.sides[side][slot] = id;
        this.save();
        return true;
    }
    /**
     * Cosmetics belong to the player rather than to a team. The `side` argument
     * is kept so the collection's attacker/defender toggle keeps working, but
     * every row carries the pick: defuse swaps sides at half time, and a blade
     * that reverted then would read as "my knife was reset again".
     */
    setKnife(_side: TeamSide, style: KnifeStyle, unlocked: boolean) {
        if (!unlocked || !KNIVES.some(knife => knife.id === style)) return false;
        this.sides.attackers.knifeStyle = this.sides.defenders.knifeStyle = style;
        this.save();
        return true;
    }
    setPistolSkin(_side: TeamSide, skin: PistolSkin, unlocked: boolean) {
        if (!unlocked || !PISTOL_SKINS.some(item => item.id === skin)) return false;
        this.sides.attackers.pistolSkin = this.sides.defenders.pistolSkin = skin;
        this.save();
        return true;
    }
    setRifleSkin(_side: TeamSide, skin: RifleSkin, unlocked: boolean) {
        if (!unlocked || !['standard','asimov'].includes(skin)) return false;
        this.sides.attackers.rifleSkin = this.sides.defenders.rifleSkin = skin;
        this.save();
        return true;
    }
    get(side: TeamSide) { return this.sides[side]; }
    save() { try { localStorage.setItem('blockstrike.loadout', JSON.stringify(this.sides)); } catch { } }
    load() {
        try {
            const saved = JSON.parse(localStorage.getItem('blockstrike.loadout') || '{}') as Partial<Record<TeamSide, Partial<SideLoadout>>>;
            for (const side of ['attackers','defenders'] as const) {
                const row = saved[side];
                if (!row) continue;
                for (const slot of Object.keys(slotCategory) as LoadoutSlot[])
                    if (typeof row[slot] === 'string' && this.choices(side, slot).some(weapon => weapon.id === row[slot]))
                        this.sides[side][slot] = row[slot]!;
            }
            // Cosmetics were once saved per side. Lift the most specific pick
            // out of an older save onto both rows: a custom finish beats the
            // default, so equipping on either tab survives an upgrade.
            const lift = <T extends string>(read: (row: Partial<SideLoadout>) => T | undefined, valid: (value: T) => boolean, fallback: T) => {
                const values = (['attackers','defenders'] as const)
                    .map(side => read(saved[side] ?? {}))
                    .filter((value): value is T => value !== undefined && valid(value));
                return values.find(value => value !== fallback) ?? values[0];
            };
            const knife = lift(row => row.knifeStyle, value => KNIVES.some(item => item.id === value), 'classic');
            const pistolSkin = lift(row => row.pistolSkin, value => PISTOL_SKINS.some(item => item.id === value), 'default');
            const rifleSkin = lift(row => row.rifleSkin, value => value === 'standard' || value === 'asimov', 'standard');
            if (knife) this.setKnife('attackers', knife, true);
            if (pistolSkin) this.setPistolSkin('attackers', pistolSkin, true);
            if (rifleSkin) this.setRifleSkin('attackers', rifleSkin, true);
        } catch { }
    }
}
export const loadoutSlotLabels: Record<LoadoutSlot, string> = {
    startingPistol: 'Starting Pistol', preferredRifle: 'Preferred Rifle',
    alternativeRifle: 'Alternative Rifle', preferredSmg: 'Preferred SMG',
    preferredSniper: 'Preferred Sniper',
};
export function loadoutWeapon(id: string) { return getWeapon(id); }
