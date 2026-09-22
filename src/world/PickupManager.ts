import * as THREE from 'three';
import type { Actor } from '../bots/Bot';
import type { Weapon } from '../weapons/Weapon';
import type { ArenaMap } from './Map';
import type { BotNavigation } from '../bots/BotNavigation';

export type PickupState = { id: number; kind: 'ammo' | 'health'; position: number[]; readyAt: number };
type Pickup = PickupState & { mesh: THREE.Group };
/** The local simulation or room host alone consumes and relocates supplies. */
export class PickupManager {
    items: Pickup[] = [];
    private points: THREE.Vector3[] = [];
    private map?: ArenaMap;
    constructor(private scene: THREE.Scene) {}
    reset(map: ArenaMap, nav: BotNavigation) {
        this.clear(); this.map = map;
        const reachable = new Set<number>();
        const queue = map.spawns.map(p => nav.nodes.reduce((best, n, i) => n.distanceToSquared(p) < nav.nodes[best].distanceToSquared(p) ? i : best, 0));
        for (let i = 0; i < queue.length; i++) {
            const n = queue[i];
            if (reachable.has(n)) continue;
            reachable.add(n);
            for (const next of nav.edges[n] ?? []) if (!reachable.has(next)) queue.push(next);
        }
        this.points = [...reachable].map(i => nav.nodes[i]).filter(p => p && !map.blocked(p.x, p.z, .65, p.y, 1.8));
        if (!this.points.length) this.points = map.spawns;
        for (let id = 0; id < 10; id++) this.relocate(this.make({ id, kind: id % 2 ? 'health' : 'ammo', position: [0, 0, 0], readyAt: 0 }));
    }
    private make(state: PickupState) {
        const mesh = new THREE.Group(), color = state.kind === 'health' ? 0x62e2b0 : 0xffc65e;
        const shell = new THREE.MeshStandardMaterial({ color: state.kind === 'health' ? 0xe9f2e5 : 0x435347, roughness: .65 });
        const accent = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: .45 });
        const box = (x: number, y: number, z: number, w: number, h: number, d: number, material: THREE.Material) => {
            const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material); m.position.set(x, y, z); mesh.add(m);
        };
        if (state.kind === 'health') {
            box(0, 0, 0, .65, .45, .3, shell);
            for (const z of [-.16, .16]) { box(0, 0, z, .3, .09, .025, accent); box(0, 0, z, .09, .3, .025, accent); }
        } else {
            for (const x of [-.19, 0, .19]) { box(x, 0, 0, .13, .5, .23, shell); box(x, .23, 0, .13, .065, .23, accent); }
        }
        const ring = new THREE.Mesh(new THREE.TorusGeometry(.46, .024, 5, 24), accent);
        ring.rotation.x = Math.PI / 2; ring.position.y = -.32; mesh.add(ring);
        const item = { ...state, position: [...state.position], mesh }; this.items.push(item); this.scene.add(mesh); return item;
    }
    private relocate(item: Pickup) {
        const old = new THREE.Vector3().fromArray(item.position);
        const free = this.points.filter(p => p.distanceTo(old) > 5 && this.items.every(other => other === item || p.distanceTo(new THREE.Vector3().fromArray(other.position)) > 5));
        const candidates = free.length ? free : this.points;
        item.position = candidates[Math.floor(Math.random() * candidates.length)].toArray();
    }
    update(time: number, actors: Actor[], weapons: (actor: Actor) => Weapon[], collected: (actor: Actor, kind: PickupState['kind'], amount: number) => void) {
        for (const item of this.items) {
            if (time < item.readyAt) continue;
            for (const actor of actors) {
                if (!actor.alive || actor.position.distanceTo(new THREE.Vector3().fromArray(item.position)) > 1.2) continue;
                const eye = actor.position.clone().add(new THREE.Vector3(0, .65, 0));
                const supply = new THREE.Vector3().fromArray(item.position).add(new THREE.Vector3(0, .65, 0));
                if (this.map && !this.map.lineClear(eye, supply)) continue;
                let amount = 0;
                if (item.kind === 'health') { amount = Math.min(35, 100 - actor.hp); actor.hp += amount; }
                else for (const weapon of weapons(actor)) {
                    if (weapon.config.melee) continue;
                    const add = Math.max(0, Math.min(weapon.config.magazineSize, weapon.config.reserveAmmo - weapon.reserve));
                    weapon.reserve += add; amount += add;
                }
                if (amount <= 0) continue;
                item.readyAt = time + (item.kind === 'health' ? 20 : 15);
                this.relocate(item); collected(actor, item.kind, amount); break;
            }
        }
        this.animate(time);
    }
    animate(time: number) {
        for (const item of this.items) {
            item.mesh.visible = time >= item.readyAt;
            item.mesh.position.fromArray(item.position); item.mesh.position.y += .65 + Math.sin(time * 2.5 + item.id) * .09;
            item.mesh.rotation.y = time * .7 + item.id;
        }
    }
    snapshot(): PickupState[] { return this.items.map(({ id, kind, position, readyAt }) => ({ id, kind, position: [...position], readyAt })); }
    apply(states: PickupState[], time: number) {
        if (states.length !== this.items.length) { this.clear(); states.forEach(s => this.make(s)); }
        else states.forEach((s, i) => Object.assign(this.items[i], { ...s, position: [...s.position] }));
        this.animate(time);
    }
    clear() {
        for (const item of this.items) {
            this.scene.remove(item.mesh);
            const materials = new Set<THREE.Material>();
            item.mesh.traverse(o => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); materials.add(o.material); } });
            materials.forEach(m => m.dispose());
        }
        this.items = [];
    }
}
