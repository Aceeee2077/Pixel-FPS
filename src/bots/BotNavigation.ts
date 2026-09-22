import * as THREE from 'three';
import { ArenaMap } from '../world/Map';
/** Grid waypoint graph with A*; obstacle clearance is sampled at actor radius. */
export class BotNavigation {
    nodes: THREE.Vector3[] = [];
    edges: number[][] = [];
    cell = 4;
    groundCount = 0;
    private half = 0;
    private grid = new Map<string, number>();
    constructor(public map: ArenaMap) { this.build(); this.linkRoutes(); }
    /**
     * Every authored route (stairs, ramps, roof walks, bridges) becomes a chain of waypoints. Chains
     * are joined to the ground grid and to each other, so any map only has to describe its geometry.
     */
    linkRoutes() {
        const link = (a: number, b: number) => { if (a !== b && !this.edges[a].includes(b)) { this.edges[a].push(b); this.edges[b].push(a); } };
        const anchor = (p: THREE.Vector3) => {
            let best = -1, distance = Infinity;
            for (let i = 0; i < this.groundCount; i++) {
                if (Math.abs(this.nodes[i].y - p.y) > .65) continue;
                const d = this.nodes[i].distanceToSquared(p);
                if (d < distance) { distance = d; best = i; }
            }
            return best;
        };
        const routeNodes: number[] = [];
        for (const route of this.map.routes) {
            let previous = -1;
            for (const point of route.points) {
                const index = this.nodes.length;
                this.nodes.push(point.clone());
                this.edges.push([]);
                if (previous >= 0) link(previous, index);
                else {
                    const ground = anchor(point);
                    if (ground >= 0) link(ground, index);
                }
                previous = index;
                routeNodes.push(index);
            }
            // A chain that ends close to the ground (ramps, trenches) reconnects on the far side.
            const last = previous, tail = this.nodes[last];
            const ground = anchor(tail);
            if (ground >= 0 && ground !== last) link(ground, last);
        }
        for (const a of routeNodes) for (const b of routeNodes) {
            if (a >= b) continue;
            const gap = this.nodes[a].distanceTo(this.nodes[b]);
            if (gap > .3 && gap < 4.6 && Math.abs(this.nodes[a].y - this.nodes[b].y) < 1.7) link(a, b);
        }
        // Every waypoint also anchors the grid cells it passes over, so terraces, decks, trench
        // floors and water lines all join the same graph instead of becoming private islands. Only
        // the 3x3 neighbourhood is probed: a full scan here made map loading hitch.
        for (const index of routeNodes) {
            const node = this.nodes[index];
            const column = Math.round((node.x + this.half) / this.cell), row = Math.round((node.z + this.half) / this.cell);
            for (let dx = -1; dx <= 1; dx++)
                for (let dz = -1; dz <= 1; dz++) {
                    const i = this.grid.get(`${-this.half + (column + dx) * this.cell},${-this.half + (row + dz) * this.cell}`);
                    if (i === undefined) continue;
                    const cell = this.nodes[i];
                    if (Math.abs(cell.y - node.y) > .65 || !this.map.lineClear(node, cell)) continue;
                    link(i, index);
                }
        }
    }
    build() {
        const grid = new Map<string, number>();
        const half = this.map.size - 3;
        this.half = half;
        this.grid = grid;
        for (let x = -half; x <= half; x += this.cell)
            for (let z = -half; z <= half; z += this.cell) {
                // Waypoints sit on the floor of their column. A tiny radius is deliberate: sampling
                // wide would let a train roof or a pillar shadow the platform underneath it.
                const floor = this.map.floorAt(x, z, .1);
                if (floor === null || this.map.blocked(x, z, .75, floor)) continue;
                grid.set(`${x},${z}`, this.nodes.length);
                this.nodes.push(new THREE.Vector3(x, floor, z));
            }
        for (const p of this.nodes) {
            const edges: number[] = [];
            for (const [dx, dz] of [[4, 0], [-4, 0], [0, 4], [0, -4], [4, 4], [-4, 4], [4, -4], [-4, -4]]) {
                const i = grid.get(`${p.x + dx},${p.z + dz}`);
                if (i === undefined)
                    continue;
                // Different levels are only joined by authored routes, never by a straight edge.
                if (Math.abs(this.nodes[i].y - p.y) > .6) continue;
                let clear = true;
                for (let t = 0; t <= 1; t += .2)
                    if (this.map.blocked(p.x + dx * t, p.z + dz * t, .65, p.y)) {
                        clear = false;
                        break;
                    }
                if (clear)
                    edges.push(i);
            }
            this.edges.push(edges);
        }
        this.groundCount = this.nodes.length;
    }
    nearest(p: THREE.Vector3) { let best = 0, d = Infinity; this.nodes.forEach((n, i) => { const v = n.distanceToSquared(p); if (v < d) {
        d = v;
        best = i;
    } }); return best; }
    path(from: THREE.Vector3, to: THREE.Vector3) {
        const start = this.nearest(from), goal = this.nearest(to);
        const open = new Set([start]), came = new Map<number, number>(), g = new Map([[start, 0]]);
        let found = false;
        while (open.size) {
            let current = -1, lowest = Infinity;
            for (const i of open) {
                const f = g.get(i)! + this.nodes[i].distanceTo(this.nodes[goal]);
                if (f < lowest) {
                    lowest = f;
                    current = i;
                }
            }
            if (current === goal) {
                found = true;
                break;
            }
            open.delete(current);
            for (const next of this.edges[current]) {
                const cost = g.get(current)! + this.nodes[current].distanceTo(this.nodes[next]);
                if (cost < (g.get(next) ?? Infinity)) {
                    came.set(next, current);
                    g.set(next, cost);
                    open.add(next);
                }
            }
        }
        if (!found)
            return [this.nodes[start].clone()];
        const path = [goal];
        let cur = goal;
        while (came.has(cur)) {
            cur = came.get(cur)!;
            path.unshift(cur);
        }
        return path.map(i => this.nodes[i].clone());
    }
    random() { return this.nodes[Math.floor(Math.random() * this.nodes.length)].clone(); }
}
