import * as THREE from 'three';
import { InputManager } from '../core/InputManager';
import { ArenaMap } from '../world/Map';
export class Player {
    id = 0;
    name = 'YOU';
    color = 0xc8f277;
    position = new THREE.Vector3(0, 0, 15);
    velocity = new THREE.Vector3();
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
    yaw = 0;
    pitch = 0;
    recoil = 0;
    bob = 0;
    eye = 1.65;
    landing = 0;
    speed = 0;
    constructor(public camera: THREE.PerspectiveCamera) { camera.rotation.order = 'YXZ'; }
    look(input: InputManager, sensitivity: number) { this.yaw -= input.dx * .002 * sensitivity; this.pitch = THREE.MathUtils.clamp(this.pitch - input.dy * .002 * sensitivity, -1.48, 1.48); }
    update(dt: number, input: InputManager, map: ArenaMap, multiplier = 1) {
        const k = input.keys;
        const wantsCrouch = k.has('ControlLeft') || k.has('ControlRight');
        this.crouched = wantsCrouch || (this.crouched && map.blocked(this.position.x, this.position.z, .4, this.position.y, 1.85));
        const wish = new THREE.Vector3(Number(k.has('KeyD')) - Number(k.has('KeyA')), 0, Number(k.has('KeyS')) - Number(k.has('KeyW'))).normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
        const speed = (this.crouched ? 3.6 : k.has('ShiftLeft') ? 10 : 7) * multiplier;
        if (this.grounded && k.has('Space') && !this.crouched) {
            this.velocity.y = 8.4;
            this.grounded = false;
        }
        const blend = 1 - Math.exp(-(this.grounded ? 14 : 2.5) * dt);
        if (wish.lengthSq() > 0) {
            const target = this.grounded ? speed : Math.max(speed, Math.min(13, this.velocity.length() + .4));
            this.velocity.x = THREE.MathUtils.lerp(this.velocity.x, wish.x * target, blend);
            this.velocity.z = THREE.MathUtils.lerp(this.velocity.z, wish.z * target, blend);
        }
        else if (this.grounded) {
            this.velocity.x *= Math.exp(-10 * dt);
            this.velocity.z *= Math.exp(-10 * dt);
        }
        const horizontal = Math.hypot(this.velocity.x, this.velocity.z);
        if (horizontal > 13) {
            this.velocity.x *= 13 / horizontal;
            this.velocity.z *= 13 / horizontal;
        }
        const falling = this.velocity.y;
        map.move(this, dt);
        if (this.grounded && falling < -4)
            this.landing = Math.min(.22, -falling * .016);
        this.speed = Math.hypot(this.velocity.x, this.velocity.z);
        this.bob += this.speed * dt * 1.3;
        this.eye = THREE.MathUtils.lerp(this.eye, this.crouched ? 1.05 : 1.65, 1 - Math.exp(-15 * dt));
        this.landing *= Math.exp(-12 * dt);
        this.recoil *= Math.exp(-7 * dt);
        this.camera.position.copy(this.position).add(new THREE.Vector3(0, this.eye + (this.grounded ? Math.sin(this.bob * 2) * Math.min(.035, this.speed * .005) : 0) - this.landing, 0));
        this.camera.rotation.set(this.pitch + this.recoil, this.yaw, 0);
    }
}
