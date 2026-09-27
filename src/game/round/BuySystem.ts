import type { Team } from '../modes/GameMode';
import { buyableWeapons, getWeapon, type WeaponCategory } from '../../data/weapons';
import type { WeaponId } from '../../weapons/WeaponConfig';
import type { RoundManager } from './RoundManager';

export type BuyItemId = string;
export type BuyCategory = WeaponCategory | 'gear' | 'grenades';
export type BuyStatus = 'AVAILABLE' | 'TOO EXPENSIVE' | 'WRONG SIDE' | 'OUTSIDE BUY ZONE' | 'BUY TIME ENDED' | 'ALREADY OWNED' | 'INVENTORY FULL';
export interface BuyItem {
    id: BuyItemId;
    label: string;
    category: BuyCategory;
    price: number;
    weapon?: WeaponId;
    team?: Team;
    previewImage?: string | null;
    ammo?: number;
    damage?: number;
    rpm?: number;
}
export const BUY_ITEMS: readonly BuyItem[] = [
    ...buyableWeapons.map(weapon => ({
        id: weapon.id, label: weapon.displayName, category: weapon.category, price: weapon.price,
        weapon: weapon.id, team: weapon.team === 'both' ? undefined : weapon.team,
        previewImage: weapon.previewImage, ammo: weapon.config.magazineSize,
        damage: weapon.config.damage, rpm: weapon.config.fireRate,
    })),
    { id: 'vest', label: 'Armor Vest', category: 'gear', price: 650 },
    { id: 'helmet', label: 'Helmet', category: 'gear', price: 350 },
    { id: 'kit', label: 'Defuse Kit', category: 'gear', price: 400, team: 'defenders' },
];
export interface BuyContext {
    inZone: boolean;
    owned: ReadonlySet<string>;
    hasFreePrimarySlot?: boolean;
    hasFreeSecondarySlot?: boolean;
}
export class BuySystem {
    status(round: RoundManager, actorId: number, team: Team, itemId: BuyItemId, context: BuyContext): BuyStatus {
        const item = BUY_ITEMS.find(candidate => candidate.id === itemId);
        if (!item) return 'INVENTORY FULL';
        if (!round.canBuy) return 'BUY TIME ENDED';
        if (!context.inZone) return 'OUTSIDE BUY ZONE';
        if (item.team && item.team !== team) return 'WRONG SIDE';
        if (context.owned.has(item.id)) return 'ALREADY OWNED';
        if (item.weapon) {
            const definition = getWeapon(item.weapon);
            if (!definition || definition.slot === 'melee') return 'INVENTORY FULL';
            // Each slot holds one weapon; replacing the current weapon is an explicit purchase.
            if (definition.slot === 'primary' && context.hasFreePrimarySlot === false) return 'INVENTORY FULL';
            if (definition.slot === 'secondary' && context.hasFreeSecondarySlot === false) return 'INVENTORY FULL';
        }
        if (round.economy.balance(actorId) < item.price) return 'TOO EXPENSIVE';
        return 'AVAILABLE';
    }
    purchase(round: RoundManager, actorId: number, team: Team, itemId: BuyItemId, context: BuyContext) {
        const item = BUY_ITEMS.find(candidate => candidate.id === itemId);
        if (!item || this.status(round, actorId, team, itemId, context) !== 'AVAILABLE') return null;
        return round.economy.spend(actorId, item.price) ? item : null;
    }
}
