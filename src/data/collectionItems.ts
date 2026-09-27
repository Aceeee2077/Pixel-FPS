import { KNIVES, PISTOL_SKINS, RIFLE_SKINS } from '../weapons/WeaponAppearance';
import { knifeIdFor } from '../weapons/WeaponSkins';
import { knifeFinish } from '../weapons/skins/KnifeSkinConfig';
import { KNIFE_UNLOCKS, PISTOL_UNLOCKS, RIFLE_UNLOCKS } from '../core/Progress';

export interface CollectionItem {
    id: string;
    weaponId: string;
    finishId: string;
    category: 'knife' | 'rifle' | 'pistol';
    image: string;
    unlock: { weaponId: string; level: number };
}

/** Stable save IDs are kept separate from the base geometry and finish recipe. */
export const COLLECTION_ITEMS: readonly CollectionItem[] = [
    ...KNIVES.map(item => ({
        id: item.id, weaponId: knifeIdFor(item.id), finishId: knifeFinish(item.id) ?? 'original',
        category: 'knife' as const, image: item.image,
        unlock: { weaponId: 'knife', level: KNIFE_UNLOCKS[item.id] },
    })),
    ...RIFLE_SKINS.map(item => ({
        id: item.id, weaponId: 'm4a4', finishId: item.id === 'standard' ? 'original' : item.id,
        category: 'rifle' as const, image: item.image,
        unlock: { weaponId: 'm4a4', level: RIFLE_UNLOCKS[item.id] },
    })),
    ...PISTOL_SKINS.map(item => ({
        id: item.id, weaponId: 'starting-pistol', finishId: item.id === 'default' ? 'original' : item.id,
        category: 'pistol' as const, image: item.image,
        unlock: { weaponId: 'starting-pistol', level: PISTOL_UNLOCKS[item.id] },
    })),
];

export function collectionItem(id: string) { return COLLECTION_ITEMS.find(item => item.id === id); }
