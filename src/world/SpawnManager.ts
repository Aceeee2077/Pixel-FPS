import * as THREE from 'three';
import { Actor } from '../bots/Bot';
import { ArenaMap } from './Map';
export class SpawnManager {
    constructor(public map: ArenaMap) { }
    choose(actor: Actor, actors: Actor[]) {
        let best = this.map.spawns[0], bestScore = -Infinity;
        for (const point of this.map.spawns) {
            let score = Math.random() * 5;
            const enemies = actors.filter(a => a.alive && a.id !== actor.id);
            let nearest = 100;
            for (const enemy of enemies) {
                const d = point.distanceTo(enemy.position);
                nearest = Math.min(nearest, d);
                if (d < 15)
                    score -= 40;
                if (d < 40 && this.map.lineClear(point.clone().add(new THREE.Vector3(0, 1.6, 0)), enemy.position.clone().add(new THREE.Vector3(0, 1.4, 0))))
                    score -= 18;
            }
            score += nearest;
            if (score > bestScore) {
                bestScore = score;
                best = point;
            }
        }
        return best.clone();
    }
    respawn(actor: Actor, actors: Actor[], time: number) { actor.position.copy(this.choose(actor, actors)); actor.velocity.set(0, 0, 0); actor.hp = 100; actor.alive = true; actor.crouched = false; actor.grounded = true; actor.protectedUntil = time + 1.2; }
}
