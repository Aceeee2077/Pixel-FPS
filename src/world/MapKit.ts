import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * Authoring helpers shared by every map. The kit owns collision, the waypoint routes for bots and
 * the mesh batching, so a map file only describes geometry and elevation.
 */
export interface MapRoute {
    name: string;
    points: THREE.Vector3[];
}

export class MapKit {
    group = new THREE.Group();
    solids: THREE.Box3[] = [];
    routes: MapRoute[] = [];
    spawns: THREE.Vector3[] = [];
    meshes: THREE.Mesh[] = [];
    private signs: THREE.Mesh[] = [];
    private geometry = new THREE.BoxGeometry(1, 1, 1);
    private materials = new Map<string, THREE.MeshLambertMaterial>();

    constructor(public size: number) { }

    material(color: number, flat = true) {
        const key = `${color}:${flat}`;
        if (!this.materials.has(key)) this.materials.set(key, new THREE.MeshLambertMaterial({ color, flatShading: flat }));
        return this.materials.get(key)!;
    }

    /** Axis aligned block. `solid=false` is pure decoration and never affects movement. */
    box(x: number, y: number, z: number, w: number, h: number, d: number, color: number, solid = true) {
        const m = new THREE.Mesh(this.geometry, this.material(color));
        m.position.set(x, y, z);
        m.scale.set(w, h, d);
        m.castShadow = solid;
        m.receiveShadow = true;
        this.group.add(m);
        this.meshes.push(m);
        if (solid) this.solids.push(new THREE.Box3(new THREE.Vector3(x - w / 2, y - h / 2, z - d / 2), new THREE.Vector3(x + w / 2, y + h / 2, z + d / 2)));
        return m;
    }

    /** Thin paint layer used for roads, markings, grass patches and water. */
    paint(x: number, z: number, w: number, d: number, color: number, y = .02) { return this.box(x, y, z, w, .02, d, color, false); }

    /**
     * Walkable staircase. `direction` is +1 / -1 along Z. The waypoint chain is registered so bots
     * can use the same climb, which keeps geometry and navigation from drifting apart.
     */
    stairs(x: number, z: number, direction: number, count: number, rise: number, depth: number, width: number, color: number, name = 'stairs', baseY = 0) {
        const points: THREE.Vector3[] = [new THREE.Vector3(x, baseY, z - direction * depth * .5)];
        for (let i = 0; i < count; i++) {
            this.box(x, baseY + (i + 1) * rise / 2, z + direction * i * depth, width, (i + 1) * rise, depth + .02, color);
            points.push(new THREE.Vector3(x, baseY + (i + 1) * rise, z + direction * i * depth));
        }
        this.routes.push({ name, points });
        return points[points.length - 1];
    }

    /** Stepped slope; the only way to make sloped ground with axis aligned collision. */
    ramp(x: number, z: number, direction: number, count: number, rise: number, depth: number, width: number, color: number, name = 'ramp', baseY = 0) {
        return this.stairs(x, z, direction, count, rise, depth, width, color, name, baseY);
    }

    /**
     * Same flight as `stairs`, but described from its top step so a flight always lands flush with
     * the platform edge it serves.
     */
    stairsUpTo(x: number, z: number, direction: number, count: number, rise: number, depth: number, width: number, color: number, name = 'stairs', baseY = 0) {
        return this.stairs(x, z - direction * (count - 1) * depth, direction, count, rise, depth, width, color, name, baseY);
    }

    /** Stepped mound: each ring is slightly higher and smaller, so it reads as a hill and stays climbable. */
    hill(x: number, z: number, w: number, d: number, height: number, color: number, name = 'hill') {
        const steps = Math.max(2, Math.round(height / .42));
        const rise = height / steps;
        const points: THREE.Vector3[] = [new THREE.Vector3(x + w / 2 + .7, 0, z)];
        for (let i = 0; i < steps; i++) {
            const t = i / steps;
            const wi = w * (1 - t * .72), di = d * (1 - t * .72);
            this.box(x, rise * i + rise / 2, z, wi, rise, di, color);
            points.push(new THREE.Vector3(x + wi / 2 - .4, rise * (i + 1), z));
        }
        this.routes.push({ name, points });
        return points[points.length - 1];
    }

    /**
     * Walkable deck with optional railings. Railings are decorative so bots and players never snag
     * on them, which keeps every elevated route usable.
     */
    platform(x: number, y: number, z: number, w: number, d: number, color: number, railColor?: number) {
        this.box(x, y - .2, z, w, .4, d, color);
        if (railColor !== undefined) {
            this.box(x, y + .5, z - d / 2, w, 1, .16, railColor, false);
            this.box(x, y + .5, z + d / 2, w, 1, .16, railColor, false);
            this.box(x - w / 2, y + .5, z, .16, 1, d, railColor, false);
            this.box(x + w / 2, y + .5, z, .16, 1, d, railColor, false);
        }
        return y;
    }

    /** Narrow sky bridge with low curbs; the deck itself is the collision. */
    catwalk(x: number, y: number, z: number, w: number, d: number, color: number, railColor?: number) {
        this.box(x, y - .15, z, w, .3, d, color);
        if (railColor !== undefined) {
            this.box(x, y + .35, z - d / 2, w, .7, .12, railColor, false);
            this.box(x, y + .35, z + d / 2, w, .7, .12, railColor, false);
        }
    }

    container(x: number, y: number, z: number, color: number, rotate = false, sign = 'BS // FREIGHT') {
        const w = rotate ? 5 : 13, d = rotate ? 13 : 5;
        this.box(x, y + 2.1, z, w, 4.2, d, color);
        this.box(x, y + 4.25, z, w + .15, .12, d + .15, 0xc8ccb8);
        for (let i = -5; i <= 5; i++) {
            if (rotate) this.box(x + 2.52, y + 2.1, z + i, .045, 3.7, .07, 0x435f5c, false);
            else this.box(x + i, y + 2.1, z + 2.52, .07, 3.7, .045, 0x435f5c, false);
        }
        if (sign) this.sign(sign, x, y + 2.3, z + d / 2 + .045, Math.min(w - 1, 5), .9, color, 0xe5e9d7);
    }

    /** Crate with a lid and corner straps: cheap but much richer than a plain cube. */
    crate(x: number, y: number, z: number, s: number, color: number, lid = 0xb08850) {
        this.box(x, y + s / 2, z, s, s, s, color);
        this.box(x, y + s - .04, z, s + .06, .08, s + .06, lid);
        for (const dx of [-s / 2 + .06, s / 2 - .06]) this.box(x + dx, y + s / 2, z, .07, s * .92, s + .04, lid, false);
    }

    barrel(x: number, y: number, z: number, color: number, r = .42, h = 1.1) {
        this.box(x, y + h / 2, z, r * 1.7, h, r * 1.7, color);
        this.box(x, y + h * .74, z, r * 1.85, .1, r * 1.85, 0x2f3b39, false);
        this.box(x, y + h * .3, z, r * 1.85, .1, r * 1.85, 0x2f3b39, false);
    }

    /** Horizontal pipe run along x or z, drawn as a long block plus collars. */
    pipe(x: number, y: number, z: number, length: number, axis: 'x' | 'z', color: number, r = .3, collars = true) {
        const along = axis === 'x';
        this.box(x, y, z, along ? length : r, r, along ? r : length, color, false);
        if (collars) for (let i = -length / 2 + 1; i <= length / 2 - 1; i += 3.2)
            this.box(along ? x + i : x, y, along ? z : z + i, along ? .22 : r * 1.4, r * 1.4, along ? r * 1.4 : .22, 0x4a5856, false);
    }

    fence(x: number, y: number, z: number, length: number, axis: 'x' | 'z', color = 0xb9c2b2) {
        const along = axis === 'x';
        this.box(x, y + .55, z, along ? length : .12, 1.1, along ? .12 : length, color, false);
        for (let i = -length / 2 + .4; i <= length / 2 - .2; i += 1.6)
            this.box(along ? x + i : x, y + .6, along ? z : z + i, .16, 1.3, .16, 0x8d968a, false);
    }

    lamp(x: number, y: number, z: number, height: number, color = 0x46514b) {
        this.box(x, y + height / 2, z, .34, height, .34, color);
        this.box(x, y + height, z, 1.5, .2, .3, color);
        this.box(x + .6, y + height - .16, z, .42, .22, .42, 0xf2e2a8, false);
    }

    tree(x: number, y: number, z: number, scale = 1, trunk = 0x8c8270, leaf = 0x82a66e, leaf2 = 0x9ebb80) {
        this.box(x, y + 2 * scale, z, .8 * scale, 4 * scale, .8 * scale, trunk);
        this.box(x, y + 5 * scale, z, 5 * scale, 4.5 * scale, 5 * scale, leaf, false);
        this.box(x + 1.5 * scale, y + 6.2 * scale, z - scale, 3.5 * scale, 3 * scale, 3.5 * scale, leaf2, false);
    }

    bush(x: number, y: number, z: number, s: number, color: number) {
        this.box(x, y + s * .45, z, s, s * .9, s, color, false);
        this.box(x + s * .3, y + s * .75, z - s * .2, s * .7, s * .7, s * .7, color, false);
    }

    rock(x: number, y: number, z: number, w: number, h: number, color: number, solid = true) {
        this.box(x, y + h / 2, z, w, h, w * .8, color, solid);
        this.box(x + w * .3, y + h * .9, z - w * .2, w * .6, h * .6, w * .5, color, false);
    }

    /** Ruined doorway / arch made of blocks. */
    arch(x: number, y: number, z: number, w: number, h: number, d: number, color: number) {
        this.box(x - w / 2, y + h / 2, z, .7, h, d, color);
        this.box(x + w / 2, y + h / 2, z, .7, h, d, color);
        this.box(x, y + h + .35, z, w + .7, .7, d, color);
    }

    /** Simple hut with a doorway and a darker roof slab. */
    hut(x: number, y: number, z: number, w: number, h: number, d: number, wall: number, roof: number, doorSide = 0) {
        this.box(x, y + h / 2, z - d / 2, w, h, .5, wall);
        this.box(x, y + h / 2, z + d / 2, w, h, .5, wall);
        this.box(x - w / 2, y + h / 2, z, .5, h, d, wall);
        if (doorSide !== 1) this.box(x + w / 2, y + h / 2, z, .5, h, d, wall);
        else {
            this.box(x + w / 2, y + h / 2, z - d * .3, .5, h, d * .4, wall);
            this.box(x + w / 2, y + h / 2, z + d * .3, .5, h, d * .4, wall);
            this.box(x + w / 2, y + h - .6, z, .5, 1.2, d, wall);
        }
        this.box(x, y + h + .3, z, w + .8, .6, d + .8, roof);
    }

    sign(text: string, x: number, y: number, z: number, w: number, h: number, bg: number, fg: number) {
        const canvas = document.createElement('canvas');
        canvas.width = 1024; canvas.height = 256;
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = '#' + bg.toString(16).padStart(6, '0');
        ctx.fillRect(0, 0, 1024, 256);
        ctx.fillStyle = '#' + fg.toString(16).padStart(6, '0');
        ctx.font = 'bold 105px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, 512, 135, 970);
        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        const plane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: texture }));
        plane.position.set(x, y, z);
        this.group.add(plane);
        this.signs.push(plane);
    }

    spawn(x: number, z: number, y = 0) { this.spawns.push(new THREE.Vector3(x, y, z)); }

    route(name: string, points: [number, number, number][]) {
        this.routes.push({ name, points: points.map(p => new THREE.Vector3(...p)) });
    }

    /** Batches every solid/decorative block per material; signs keep their own texture. */
    finish() {
        const groups = new Map<THREE.Material, THREE.BufferGeometry[]>();
        this.group.updateMatrixWorld(true);
        for (const mesh of this.meshes) {
            const material = mesh.material as THREE.Material;
            const geometry = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
            if (!groups.has(material)) groups.set(material, []);
            groups.get(material)!.push(geometry);
            this.group.remove(mesh);
        }
        this.meshes = [];
        for (const [material, geometries] of groups) {
            const merged = mergeGeometries(geometries);
            geometries.forEach(g => g.dispose());
            if (!merged) continue;
            const mesh = new THREE.Mesh(merged, material);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            this.group.add(mesh);
            this.meshes.push(mesh);
        }
        return this;
    }

    dispose() {
        this.group.traverse(object => {
            if (object instanceof THREE.Mesh) {
                object.geometry.dispose();
                const materials = Array.isArray(object.material) ? object.material : [object.material];
                materials.forEach(m => { if (m instanceof THREE.MeshBasicMaterial) m.map?.dispose(); m.dispose(); });
            }
        });
        this.materials.clear();
        this.meshes = [];
        this.signs = [];
    }
}
