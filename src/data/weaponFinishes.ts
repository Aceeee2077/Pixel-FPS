import * as THREE from 'three';

export interface WeaponFinish {
    id: string;
    weaponId: string;
    /** Only these named parts receive a finish; the base geometry never changes. */
    parts: readonly { name: RegExp; color: number; metalness: number; roughness: number }[];
}

export const WEAPON_FINISHES: Readonly<Record<string, WeaponFinish>> = {
    asimov: {
        id: 'asimov', weaponId: 'm4a4',
        parts: [
            { name: /^(CarrierBody|StockBody|MagazineBody|GripCap)/i, color: 0xe7e4da, metalness: .25, roughness: .4 },
            { name: /^(StockCollar|MagazineCatch|GripFingerShelf)/i, color: 0xd86b2f, metalness: .4, roughness: .35 },
        ],
    },
    copper: {
        id: 'copper', weaponId: 'pistols',
        parts: [{ name: /^(Slide|Cylinder)/i, color: 0xa86135, metalness: .82, roughness: .28 }],
    },
};

/** Each changed mesh receives its own material, so skins cannot bleed across instances. */
export function applyWeaponFinish(root: THREE.Object3D, finishId: string) {
    const finish = WEAPON_FINISHES[finishId];
    if (!finish) return;
    root.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return;
        const part = finish.parts.find(candidate => candidate.name.test(object.name));
        if (!part) return;
        const recolor = (material: THREE.Material) => {
            const copy = material.clone();
            if (copy instanceof THREE.MeshStandardMaterial) {
                copy.map = null;
                copy.color.setHex(part.color);
                copy.metalness = part.metalness;
                copy.roughness = part.roughness;
            }
            return copy;
        };
        object.material = Array.isArray(object.material) ? object.material.map(recolor) : recolor(object.material);
    });
}
