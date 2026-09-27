import * as THREE from 'three';
import type { MeleeKind } from './WeaponConfig';

export interface KnifeAnimationState {
    draw: number;
    inspect: number;
    attack: MeleeKind | null;
    attackProgress: number;
}

/** Drives named GLB pivots; whole-hand bob and slash still come from the existing view rig. */
export class KnifeAnimationController {
    private readonly left?: THREE.Object3D;
    private readonly right?: THREE.Object3D;
    private readonly blade?: THREE.Object3D;
    private readonly ring?: THREE.Object3D;
    constructor(private readonly root: THREE.Object3D) {
        this.left = root.getObjectByName('PivotLeft') ?? undefined;
        this.right = root.getObjectByName('PivotRight') ?? undefined;
        this.blade = root.getObjectByName('Blade') ?? undefined;
        this.ring = root.getObjectByName('FingerRing') ?? undefined;
    }
    update(state: KnifeAnimationState) {
        const draw = THREE.MathUtils.clamp(state.draw, 0, 1);
        const inspect = THREE.MathUtils.clamp(state.inspect, 0, 1);
        const slash = state.attack ? Math.sin(Math.PI * THREE.MathUtils.clamp(state.attackProgress, 0, 1)) : 0;
        if (this.left) this.left.rotation.z = (1 - draw) * -.95 + inspect * .4 + slash * -.13;
        if (this.right) this.right.rotation.z = (1 - draw) * .95 + inspect * -.4 + slash * .13;
        if (this.blade) this.blade.rotation.y = inspect * .12;
        if (this.ring) this.ring.rotation.y = inspect * .4;
    }
}
