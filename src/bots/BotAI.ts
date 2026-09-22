import * as THREE from 'three';
import { Bot, Actor } from './Bot';
import { BotNavigation } from './BotNavigation';
import { ArenaMap } from '../world/Map';
export class BotAI {
    target: Actor | null = null;
    path: THREE.Vector3[] = [];
    scanAt = 0;
    routeAt = 0;
    reactAt = 0;
    lastSeen = 0;
    lastPosition = new THREE.Vector3();
    aim = new THREE.Vector3(0, 0, -1);
    strafeSign = 1;
    strafeAt = 0;
    jumpAt = 0;
    constructor(public bot: Bot, public nav: BotNavigation, public map: ArenaMap) { }
    reset() { this.target = null; this.path = []; this.reactAt = 0; this.routeAt = 0; this.scanAt = 0; this.lastSeen = 0; this.strafeAt = 0; this.jumpAt = 0; this.aim.set(0, 0, -1); }
    update(dt: number, time: number, actors: Actor[], shoot: (bot: Bot, origin: THREE.Vector3, dir: THREE.Vector3) => void, difficulty = 'normal') {
        const b = this.bot;
        if (!b.alive) {
            b.state = 'Respawn';
            return;
        }
        b.weapon.update(dt);
        const eye = b.position.clone().add(new THREE.Vector3(0, b.crouched ? 1.1 : 1.55, 0));
        if (time > this.scanAt) {
            this.scanAt = time + .22 + Math.random() * .18;
            const candidates = actors.filter(a => a.id !== b.id && a.alive && a.protectedUntil < time && a.position.distanceTo(b.position) < 65 && this.map.lineClear(eye, a.position.clone().add(new THREE.Vector3(0, 1.25, 0))));
            candidates.sort((a, c) => a.position.distanceToSquared(b.position) - c.position.distanceToSquared(b.position));
            const next = candidates[0];
            if (next) {
                if (this.target?.id !== next.id)
                    this.reactAt = time + (difficulty === 'hard' ? .25 : difficulty === 'easy' ? .8 : .48) + Math.random() * .35;
                this.target = next;
                this.lastSeen = time;
                this.lastPosition.copy(next.position);
            }
            else if (this.target && (!this.target.alive || time - this.lastSeen > 4))
                this.target = null;
        }
        const target = this.target;
        const distance = target ? target.position.distanceTo(b.position) : Infinity;
        const visible = !!target && time - this.lastSeen < .5 && this.map.lineClear(eye, target.position.clone().add(new THREE.Vector3(0, 1.2, 0)));
        const range = b.weapon.config.id === 'shotgun' ? 14 : b.weapon.config.id === 'sniper' ? 58 : 37;
        const move = new THREE.Vector3();
        if (target && visible && distance < range) {
            b.state = time < this.reactAt ? 'Attack' : 'Strafe';
            if (time > this.strafeAt) {
                this.strafeAt = time + 1 + Math.random() * 1.3;
                this.strafeSign = Math.random() < .5 ? -1 : 1;
                b.crouched = Math.random() < .14;
            }
            const toward = target.position.clone().sub(b.position);
            toward.y = 0;
            toward.normalize();
            move.set(-toward.z, 0, toward.x).multiplyScalar(this.strafeSign * .75);
            if (distance > range * .7)
                move.addScaledVector(toward, .7);
            if (distance < 6)
                move.addScaledVector(toward, -.8);
            const aimPoint = target.position.clone().add(new THREE.Vector3(0, target.crouched ? .85 : 1.15, 0));
            const desired = aimPoint.sub(eye).normalize();
            this.aim.lerp(desired, 1 - Math.exp(-5 * dt)).normalize();
            if (time > this.reactAt && Math.sin(time * 3 + b.id) > .0) {
                const error = difficulty === 'easy' ? .065 : difficulty === 'hard' ? .012 : .032;
                const dir = this.aim.clone().add(new THREE.Vector3((Math.random() - .5) * error, (Math.random() - .5) * error, (Math.random() - .5) * error)).normalize();
                shoot(b, eye, dir);
            }
            if (time > this.jumpAt && b.grounded && !b.crouched) {
                this.jumpAt = time + 4 + Math.random() * 7;
                if (Math.random() < .4) {
                    b.velocity.y = 7;
                    b.grounded = false;
                }
            }
        }
        else {
            b.crouched = false;
            b.state = target ? (visible ? 'Chase' : 'Search') : 'Patrol';
            if (time > this.routeAt || !this.path.length) {
                this.routeAt = time + 1.8 + Math.random();
                this.path = this.nav.path(b.position, target ? this.lastPosition : this.nav.random());
            }
            while (this.path.length && b.position.distanceTo(this.path[0]) < .85)
                this.path.shift();
            if (this.path[0]) {
                move.copy(this.path[0]).sub(b.position);
                move.y = 0;
                move.normalize();
                this.aim.lerp(move, .1).normalize();
            }
        }
        if (b.weapon.ammo === 0 && b.weapon.reserve === 0) {
            b.weapon.reserve = b.weapon.config.reserveAmmo;
        }
        if (b.weapon.ammo === 0)
            b.weapon.reload();
        if (b.weapon.reloadLeft > 0)
            b.state = 'Reload';
        const speed = (b.crouched ? 2.3 : visible ? 3.8 : 6.2);
        b.velocity.x = move.x * speed;
        b.velocity.z = move.z * speed;
        this.map.move(b, dt);
        b.yaw = b.group.rotation.y = Math.atan2(-this.aim.x, -this.aim.z);
        b.sync(time);
    }
}
