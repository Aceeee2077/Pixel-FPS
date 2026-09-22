import * as THREE from 'three';
import { MapKit, MapRoute } from './MapKit';
import type { MapDefinition } from './Maps';

export interface Body {
    position: THREE.Vector3;
    velocity: THREE.Vector3;
    grounded: boolean;
    crouched: boolean;
}

/**
 * Built playfield: collision, respawn points and the waypoint routes that feed the bot navigation
 * graph. Every map is assembled by `MapKit`, so this class is purely physics plus bookkeeping.
 */
export class ArenaMap {
    solids: THREE.Box3[];
    meshes: THREE.Mesh[];
    routes: MapRoute[];
    spawns: THREE.Vector3[];
    group: THREE.Group;
    size: number;
    private kit: MapKit;
    constructor(public scene: THREE.Scene, public definition: MapDefinition) {
        this.size = definition.size;
        this.kit = new MapKit(definition.size);
        definition.build(this.kit);
        this.kit.finish();
        this.group = this.kit.group;
        this.solids = this.kit.solids;
        this.meshes = this.kit.meshes;
        this.routes = this.kit.routes;
        this.spawns = this.kit.spawns.length
            ? this.kit.spawns
            : definition.spawns.map(([x, z, y]) => new THREE.Vector3(x, y ?? 0, z));
        scene.add(this.group);
    }
    get name() { return this.definition.name; }
    dispose() {
        this.scene.remove(this.group);
        this.kit.dispose();
        this.solids = [];
        this.meshes = [];
        this.spawns = [];
    }
    blocked(x: number, z: number, r = .48, y = 0, h = 1.85) { return this.solids.some(b => x + r > b.min.x && x - r < b.max.x && z + r > b.min.z && z - r < b.max.z && y + h > b.min.y + .02 && y < b.max.y - .04); }
    /**
     * Highest walkable surface under a column, used by the bot grid so maps with trenches, platforms
     * and pits get waypoints at the height a body would actually stand at.
     */
    floorAt(x: number, z: number, r = .75) {
        let top: number | null = null;
        for (const b of this.solids) {
            if (x + r <= b.min.x || x - r >= b.max.x || z + r <= b.min.z || z - r >= b.max.z) continue;
            if (b.max.y > .7 || b.max.y < -14) continue;
            if (top === null || b.max.y > top) top = b.max.y;
        }
        return top;
    }
    move(body: Body, dt: number) {
        const p = body.position, v = body.velocity, r = .42, h = body.crouched ? 1.25 : 1.85;
        const wasGrounded = body.grounded;
        for (const axis of ['x', 'z'] as const) {
            p[axis] += v[axis] * dt;
            for (const b of this.solids) {
                if (p.x + r <= b.min.x || p.x - r >= b.max.x || p.z + r <= b.min.z || p.z - r >= b.max.z || p.y + h <= b.min.y + .005 || p.y >= b.max.y - .005)
                    continue;
                const rise = b.max.y - p.y;
                // Steps up to half a metre are climbed instead of blocking the move. The clearance
                // test uses a narrow probe: with a full body radius, any flight whose treads are
                // shallower than the body would refuse to climb, because the step after next reads
                // as a wall.
                if (wasGrounded && rise > 0 && rise <= .48 && !this.blocked(p.x, p.z, r * .5, b.max.y, h)) {
                    p.y = b.max.y;
                    continue;
                }
                if (v[axis] > 0)
                    p[axis] = b.min[axis] - r;
                else if (v[axis] < 0)
                    p[axis] = b.max[axis] + r;
                v[axis] = 0;
            }
        }
        v.y -= 24 * dt;
        const oldY = p.y;
        p.y += v.y * dt;
        body.grounded = false;
        for (const b of this.solids) {
            if (p.x + r <= b.min.x || p.x - r >= b.max.x || p.z + r <= b.min.z || p.z - r >= b.max.z)
                continue;
            if (v.y <= 0 && oldY >= b.max.y - .06 && p.y <= b.max.y) {
                p.y = b.max.y;
                v.y = 0;
                body.grounded = true;
            }
            else if (v.y > 0 && oldY + h <= b.min.y + .05 && p.y + h > b.min.y) {
                p.y = b.min.y - h;
                v.y = 0;
            }
        }
        p.x = THREE.MathUtils.clamp(p.x, -this.size + .5, this.size - .5);
        p.z = THREE.MathUtils.clamp(p.z, -this.size + .5, this.size - .5);
        // Only a fall out of the world counts as out of bounds; maps with pits keep their own floor.
        if (p.y < -16) {
            p.copy(this.spawns[0]);
            v.set(0, 0, 0);
        }
    }
    lineClear(a: THREE.Vector3, b: THREE.Vector3) {
        const delta = b.clone().sub(a), distance = delta.length();
        const ray = new THREE.Ray(a, delta.normalize());
        const hit = new THREE.Vector3();
        return !this.solids.some(box => ray.intersectBox(box, hit) && hit.distanceTo(a) < distance - .1);
    }
}
