import * as THREE from 'three';
import { Actor } from '../bots/Bot';
import { ArenaMap } from '../world/Map';
export interface Hit {
    actor?: Actor;
    part: 'head' | 'body' | 'legs' | 'world';
    point: THREE.Vector3;
    distance: number;
    multiplier: number;
}
export function trace(origin: THREE.Vector3, direction: THREE.Vector3, range: number, shooter: Actor, actors: Actor[], map: ArenaMap): Hit {
    const ray = new THREE.Ray(origin, direction.clone().normalize());
    let result: Hit = { part: 'world', point: ray.at(range, new THREE.Vector3()), distance: range, multiplier: 1 };
    const point = new THREE.Vector3();
    for (const b of map.solids) {
        if (ray.intersectBox(b, point)) {
            const d = origin.distanceTo(point);
            if (d < result.distance)
                result = { part: 'world', point: point.clone(), distance: d, multiplier: 1 };
        }
    }
    for (const actor of actors) {
        if (!actor.alive || actor.id === shooter.id)
            continue;
        const p = actor.position, s = actor.crouched ? .7 : 1;
        for (const [part, y0, y1, width, multiplier] of [['head', 1.32, 1.96, .29, 2], ['body', .65, 1.32, .45, 1], ['legs', 0, .65, .32, .75]] as const) {
            const bounds = new THREE.Box3(new THREE.Vector3(p.x - width, p.y + y0 * s, p.z - .27), new THREE.Vector3(p.x + width, p.y + y1 * s, p.z + .27));
            if (ray.intersectBox(bounds, point)) {
                const d = origin.distanceTo(point);
                if (d < result.distance)
                    result = { actor, part, point: point.clone(), distance: d, multiplier };
            }
        }
    }
    return result;
}
