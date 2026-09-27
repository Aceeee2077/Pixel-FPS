import * as THREE from 'three';
import { Weapon } from '../weapons/Weapon';
import { WEAPONS, WeaponConfig } from '../weapons/WeaponConfig';
import { weaponModel } from '../weapons/WeaponModel';
import { WeaponAssetLoader } from '../weapons/WeaponAssetLoader';
import { DEFAULT_APPEARANCE } from '../weapons/WeaponAppearance';

/** Bots share one loader so a given weapon GLB is fetched and parsed once. */
const sharedWeaponAssets = new WeaponAssetLoader();
export type Actor = {
    id: number;
    name: string;
    color: number;
    position: THREE.Vector3;
    velocity: THREE.Vector3;
    /** Facing, used for backstab checks; matches the Three.js convention of looking down -Z. */
    yaw: number;
    grounded: boolean;
    crouched: boolean;
    hp: number;
    armor?: number;
    helmet?: boolean;
    hasDefuseKit?: boolean;
    alive: boolean;
    kills: number;
    deaths: number;
    score: number;
    streak: number;
    respawnAt: number;
    protectedUntil: number;
};
const geometry = new THREE.BoxGeometry(1, 1, 1);
export class Bot implements Actor {
    position = new THREE.Vector3();
    velocity = new THREE.Vector3();
    yaw = 0;
    grounded = true;
    crouched = false;
    hp = 100;
    armor = 0;
    helmet = false;
    hasDefuseKit = false;
    alive = true;
    kills = 0;
    deaths = 0;
    score = 0;
    streak = 0;
    respawnAt = 0;
    protectedUntil = 0;
    group = new THREE.Group();
    legs: THREE.Mesh[] = [];
    weapon = new Weapon(WEAPONS.rifle);
    state = 'Patrol';
    gun = weaponModel('rifle');
    constructor(public id: number, public name: string, public color: number, scene: THREE.Scene) {
        const mat = new THREE.MeshLambertMaterial({ color });
        const dark = new THREE.MeshLambertMaterial({ color: 0x27343a });
        const skin = new THREE.MeshLambertMaterial({ color: 0xe0c8a6 });
        const part = (x: number, y: number, z: number, w: number, h: number, d: number, m: THREE.Material) => { const p = new THREE.Mesh(geometry, m); p.position.set(x, y, z); p.scale.set(w, h, d); p.castShadow = true; this.group.add(p); return p; };
        part(0, 1.56, 0, .49, .49, .46, skin);
        part(0, 1.72, 0, .54, .25, .5, mat);
        part(0, 1.58, -.242, .39, .1, .018, dark);
        part(0, 1.03, 0, .64, .65, .36, mat);
        part(0, 1.05, -.2, .43, .38, .08, dark);
        part(-.43, 1.05, -.1, .21, .58, .25, mat);
        part(.43, 1.05, -.1, .21, .58, .25, mat);
        this.legs.push(part(-.19, .36, 0, .25, .7, .3, dark), part(.19, .36, 0, .25, .7, .3, dark));
        this.gun.position.set(.35, 1.1, -.35);
        this.group.add(this.gun);
        scene.add(this.group);
    }
    equip(config: WeaponConfig) {
        this.weapon = new Weapon(config);
        this.setGun(weaponModel(config.id));
        // Swap in the authored world model when one is published for this id.
        const requested = config.id;
        void sharedWeaponAssets.loadWorld(requested, DEFAULT_APPEARANCE).then(asset => {
            if (asset && this.weapon.config.id === requested) this.setGun(asset);
        });
    }
    private setGun(model: THREE.Group) {
        this.group.remove(this.gun);
        this.gun = model;
        this.gun.position.set(.35, 1.1, -.35);
        this.group.add(this.gun);
    }
    sync(time: number) { this.group.visible = this.alive; if (this.gun) this.gun.visible = this.alive; this.group.position.copy(this.position); this.group.scale.y = this.crouched ? .7 : 1; const moving = Math.hypot(this.velocity.x, this.velocity.z) > 1; this.legs.forEach((leg, i) => leg.rotation.x = moving ? Math.sin(time * 13 + i * Math.PI) * .45 : 0); }
}
