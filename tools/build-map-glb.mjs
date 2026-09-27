/**
 * Builds high-detail GLB maps for BlockStrike from the same layout data used by
 * `src/world/Maps.ts`. This script runs headlessly under Node and uses three's
 * GLTFExporter, so it does not need Blender to produce a runnable game asset.
 * An equivalent Blender (bpy) script is provided in `tools/blockyard_bpy.py`.
 *
 * The generated GLB contains only *visual* geometry. Collision, spawns and bot
 * routes remain in the TypeScript map definitions, which guarantees gameplay
 * parity while the art is upgraded.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// GLTFExporter relies on the browser FileReader for binary GLB output; provide a
// minimal Node polyfill so the asset pipeline runs headlessly.
class NodeFileReader {
    result = null;
    onloadend = null;
    readAsArrayBuffer(blob) {
        blob.arrayBuffer().then((buf) => {
            this.result = buf;
            if (this.onloadend) this.onloadend();
        });
    }
}
globalThis.FileReader = NodeFileReader;

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'assets', 'maps');

const mats = new Map();
const MATERIAL_DEFAULTS = {
    ground: { color: 0xc8c6ad, roughness: 0.98, metalness: 0 },
    asphalt: { color: 0x879591, roughness: 0.96, metalness: 0 },
    concrete: { color: 0x879591, roughness: 0.9, metalness: 0 },
    plaster: { color: 0xe7e6d2, roughness: 0.92, metalness: 0 },
    roof: { color: 0x3e6061, roughness: 0.82, metalness: 0.05 },
    rooftrim: { color: 0x2f3b39, roughness: 0.7, metalness: 0.15 },
    wood: { color: 0xb08850, roughness: 0.8, metalness: 0 },
    woodtrim: { color: 0x6d5636, roughness: 0.72, metalness: 0 },
    metal: { color: 0x527673, roughness: 0.45, metalness: 0.8 },
    trim: { color: 0x2f3b39, roughness: 0.5, metalness: 0.6 },
    marking: { color: 0xdadbb9, roughness: 0.6, metalness: 0 },
    window: { color: 0x1b2a33, roughness: 0.2, metalness: 0.5 },
    rock: { color: 0x8a8f84, roughness: 1, metalness: 0 },
    foliage: { color: 0x82a66e, roughness: 1, metalness: 0 },
    distant: { color: 0x9bb6b2, roughness: 0.95, metalness: 0 },
    distant2: { color: 0xb1c3ba, roughness: 0.95, metalness: 0 },
    'container:blue': { color: 0x6c9eaa, roughness: 0.55, metalness: 0.35 },
    sand: { color: 0xd9c48f, roughness: 0.98, metalness: 0 },
    stone: { color: 0xcbb894, roughness: 0.92, metalness: 0 },
    dune: { color: 0xe0d0a0, roughness: 1, metalness: 0 },
    rust: { color: 0xb5824f, roughness: 0.7, metalness: 0.35 },
    ripple: { color: 0xcdb684, roughness: 0.7, metalness: 0 },
    'container:rust': { color: 0xce8163, roughness: 0.7, metalness: 0.3 },
    'container:tan': { color: 0xe1bd6b, roughness: 0.6, metalness: 0.3 },
    'container:green': { color: 0xa9bbae, roughness: 0.55, metalness: 0.35 },
};

function mat(name, color, roughness, metalness) {
    if (!mats.has(name)) {
        const d = MATERIAL_DEFAULTS[name] ?? {};
        mats.set(name, new THREE.MeshStandardMaterial({
            name,
            color: color ?? d.color ?? 0xcccccc,
            roughness: roughness ?? d.roughness ?? 0.92,
            metalness: metalness ?? d.metalness ?? 0,
        }));
    }
    return mats.get(name);
}

class Modeler {
    constructor() {
        this.group = new THREE.Group();
        this.parts = new Map();
    }

    add(mesh, name) {
        if (!this.parts.has(name)) this.parts.set(name, []);
        this.parts.get(name).push(mesh);
    }

    box(x, y, z, w, h, d, name) {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(name));
        mesh.position.set(x, y, z);
        this.add(mesh, name);
        return mesh;
    }

    /** A solid slab used for roads, markings and thin surface layers. */
    slab(x, y, z, w, d, name) {
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat(name));
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(x, y, z);
        this.add(mesh, name);
        return mesh;
    }

    cylinder(x, y, z, rTop, rBottom, h, name, seg = 18) {
        const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, seg), mat(name));
        mesh.position.set(x, y, z);
        this.add(mesh, name);
        return mesh;
    }

    sphere(x, y, z, r, name, detail = 1) {
        const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, Math.max(8, detail * 8), Math.max(6, detail * 6)), mat(name));
        mesh.position.set(x, y, z);
        this.add(mesh, name);
        return mesh;
    }

    /**
     * Wall with a base plinth and a slightly wider coping cap. Keeping the main
     * body exactly inside the original AABB is what prevents players from seeing
     * through walls while the unchanged collision does the blocking.
     */
    wall(x, y, z, w, h, d, name, capName = name) {
        this.box(x, y, z, w, h, d, name);
        const capH = Math.min(0.22, h * 0.16);
        this.box(x, y + h / 2 - capH / 2, z, w + 0.24, capH, d + 0.24, capName);
        if (h > 2.2) {
            this.box(x, y - h / 2 + 0.06, z, w + 0.16, 0.12, d + 0.16, capName);
        }
    }

    /** Recessed window/door panels create facade relief without extra polygons. */
    windows(face, count, x, y, z, span, h, d, name, panelName) {
        const step = span / (count + 1);
        const inset = 0.02;
        const w = step * 0.42;
        const wh = h * 0.42;
        for (let i = 1; i <= count; i++) {
            const along = face === 'x' ? x - span / 2 + step * i : x;
            const alongZ = face === 'z' ? z - span / 2 + step * i : z;
            const pw = face === 'x' ? d + inset : w;
            const pd = face === 'z' ? d + inset : w;
            const cx = face === 'x' ? x : along;
            const cz = face === 'z' ? z : alongZ;
            this.box(cx, y, cz, pw, wh, pd, panelName);
        }
    }

    crate(x, y, z, s, body, frame) {
        this.box(x, y + s / 2, z, s, s, s, body);
        this.box(x, y + s - 0.03, z, s + 0.07, 0.07, s + 0.07, frame);
        for (const dx of [-s / 2 + 0.05, s / 2 - 0.05]) {
            this.box(x + dx, y + s / 2, z, 0.06, s * 0.94, s + 0.05, frame);
        }
        for (const dz of [-s / 2 + 0.05, s / 2 - 0.05]) {
            this.box(x, y + s / 2, z + dz, s + 0.05, s * 0.94, 0.06, frame);
        }
    }

    /** Cover crate with arbitrary footprint so the visual matches the collision box. */
    crateBox(x, baseY, z, w, h, d, body, frame) {
        this.box(x, baseY + h / 2, z, w, h, d, body);
        this.box(x, baseY + h - 0.03, z, w + 0.07, 0.07, d + 0.07, frame);
        for (const dx of [-w / 2 + 0.05, w / 2 - 0.05]) this.box(x + dx, baseY + h / 2, z, 0.06, h * 0.94, d + 0.05, frame);
        for (const dz of [-d / 2 + 0.05, d / 2 - 0.05]) this.box(x, baseY + h / 2, z + dz, w + 0.05, h * 0.94, 0.06, frame);
    }

    barrel(x, y, z, name = 'metal', r = 0.42, h = 1.1) {
        this.cylinder(x, y + h / 2, z, r, r, h, name);
        this.cylinder(x, y + h * 0.74, z, r * 1.08, r * 1.08, 0.09, 'trim');
        this.cylinder(x, y + h * 0.3, z, r * 1.08, r * 1.08, 0.09, 'trim');
    }

    container(x, y, z, colorName, rotate = false) {
        const w = rotate ? 5 : 13;
        const d = rotate ? 13 : 5;
        this.box(x, y + 2.1, z, w, 4.2, d, colorName);
        this.box(x, y + 4.24, z, w + 0.16, 0.1, d + 0.16, 'trim');
        // Corrugated ribs are what visually sell a shipping container.
        for (let i = -5; i <= 5; i++) {
            if (rotate) this.box(x + 2.52, y + 2.1, z + i, 0.04, 3.7, 0.08, 'trim');
            else this.box(x + i, y + 2.1, z + 2.52, 0.08, 3.7, 0.04, 'trim');
        }
        // Door pair on the long face.
        const doorW = rotate ? 0.1 : 2.6;
        const doorD = rotate ? 2.6 : 0.1;
        this.box(rotate ? x + w / 2 - 0.12 : x - 2.5, y + 2.1, rotate ? z : z + d / 2 - 0.12, doorW, 3.2, doorD, 'trim');
        this.box(rotate ? x + w / 2 - 0.12 : x + 2.5, y + 2.1, rotate ? z : z + d / 2 - 0.12, doorW, 3.2, doorD, 'trim');
    }

    fence(x, y, z, length, axis, name = 'metal') {
        const along = axis === 'x';
        this.box(x, y + 0.55, z, along ? length : 0.1, 1.1, along ? 0.1 : length, name);
        for (let i = -length / 2 + 0.4; i <= length / 2 - 0.2; i += 1.5) {
            this.cylinder(along ? x + i : x, y + 0.62, along ? z : z + i, 0.06, 0.06, 1.24, 'trim', 8);
        }
    }

    lamp(x, y, z, height, name = 'metal') {
        this.cylinder(x, y + height / 2, z, 0.09, 0.14, height, name, 10);
        this.box(x, y + height, z, 1.4, 0.16, 0.3, name);
        this.box(x + 0.55, y + height - 0.2, z, 0.42, 0.2, 0.42, 'trim');
    }

    tree(x, y, z, scale = 1) {
        this.cylinder(x, y + 2 * scale, z, 0.4 * scale, 0.4 * scale, 4 * scale, 'wood', 10);
        this.sphere(x, y + 4.6 * scale, z, 2.4 * scale, 'foliage');
        this.sphere(x + 1.2 * scale, y + 5.6 * scale, z - 0.4 * scale, 1.5 * scale, 'foliage');
        this.sphere(x - 1.1 * scale, y + 5.3 * scale, z + 0.5 * scale, 1.4 * scale, 'foliage');
    }

    rock(x, y, z, w, h, name = 'rock') {
        this.sphere(x, y + h * 0.45, z, Math.max(w, h) * 0.62, name);
        this.sphere(x + w * 0.25, y + h * 0.55, z - w * 0.18, Math.max(w, h) * 0.36, name);
    }

    merge() {
        this.group.updateMatrixWorld(true);
        for (const [name, meshes] of this.parts) {
            const geos = [];
            for (const mesh of meshes) {
                mesh.updateMatrix();
                const g = mesh.geometry.clone().applyMatrix4(mesh.matrix);
                geos.push(g);
            }
            const merged = mergeGeometries(geos);
            geos.forEach(g => g.dispose());
            if (!merged) continue;
            const mesh = new THREE.Mesh(merged, mat(name));
            mesh.name = name;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            this.group.add(mesh);
        }
        return this.group;
    }
}

function buildBlockyard() {
    const m = new Modeler();
    const ground = mat('ground', 0xc8c6ad);
    ground.roughness = 0.98;
    const road = mat('asphalt', 0x879591);
    road.roughness = 0.96;

    // Ground plane (top at y=0, matching the original collision floor).
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(176, 176), ground);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0;
    m.add(floor, 'ground');

    // Main roads and lane markings.
    m.slab(0, 0.012, 0, 32, 150, 'asphalt');
    m.slab(0, 0.014, 14, 142, 23, 'asphalt');
    for (let z = -70; z < 72; z += 10) {
        m.slab(0, 0.029, z, 0.35, 4, 'marking');
    }
    for (let x = -70; x < 72; x += 10) {
        m.slab(x, 0.031, 14, 4, 0.35, 'marking');
    }

    // Boundary walls with coping caps and corner posts.
    m.wall(0, 2, -88, 178, 4, 1.5, 'concrete');
    m.wall(0, 2, 88, 178, 4, 1.5, 'concrete');
    m.wall(-88, 2, 0, 1.5, 4, 176, 'concrete');
    m.wall(88, 2, 0, 1.5, 4, 176, 'concrete');

    // Central yard cover ring (low jersey barriers).
    m.wall(-9, 0.62, -3, 8, 1.24, 1, 'concrete');
    m.wall(10, 0.62, 1, 8, 1.24, 1, 'concrete');
    m.wall(2, 0.62, -18, 1, 1.24, 9, 'concrete');
    m.crateBox(-12, 0, 17, 4, 2.8, 4, 'wood', 'woodtrim');
    m.crateBox(13, 0, 23, 3.4, 2.4, 3.4, 'wood', 'woodtrim');
    m.crateBox(-13, 0, -18, 4, 3, 4, 'wood', 'woodtrim');
    m.crateBox(-13, 3, -18, 3, 1, 3, 'woodtrim', 'woodtrim');
    m.slab(1, 0.03, -3, 8, 6, 'marking');

    warehouse(m);
    towerAndBridge(m);
    underpass(m);

    // Containers.
    m.container(32, 0, 19, 'container:blue');
    m.container(51, 0, 31, 'container:rust', true);
    m.container(51, 0, 4, 'container:tan', true);
    m.container(31, 0, 43, 'container:tan');
    m.container(31, 4.2, 43, 'container:green');
    m.container(-33, 0, 31, 'container:rust', true);
    m.container(-52, 0, 46, 'container:blue');
    m.container(-24, 0, 55, 'container:tan');
    m.container(-39, 0, -49, 'container:blue');
    m.container(-16, 0, -58, 'container:rust', true);
    m.container(39, 0, -52, 'container:blue', true);

    // Scattered cover: crates + barrels.
    for (const [x, z] of [[-64, -18], [58, -18], [-7, 44], [47, 61], [-55, 65], [66, -52]]) {
        m.crateBox(x, 0, z, 5, 2.2, 3, 'wood', 'woodtrim');
        m.crateBox(x + 5, 0, z + 2, 2, 1.3, 2, 'wood', 'woodtrim');
    }
    for (const [x, z] of [[-70, 8], [69, 43], [-66, -54], [56, -64], [0, 73], [-70, 70], [72, -7]]) {
        m.tree(x, 0, z);
    }

    // Distant buildings on the horizon.
    for (let i = 0; i < 16; i++) {
        const x = -110 + i * 15;
        const h = 10 + (i % 4) * 5;
        m.wall(x, h / 2, -110, 11, h, 13, i % 2 ? 'distant' : 'distant2');
        m.windows('z', 3, x, h / 2, -110, 11, h, 13, 'distant', 'window');
    }

    return m.merge();
}

function warehouse(m) {
    const wall = 'plaster';
    // Floor and roof.
    m.slab(-38, 0.025, -13, 27, 26, 'plaster');
    m.box(-38, 8.2, -13, 29, 0.4, 29, 'roof');
    // Perimeter walls. Each wall keeps the original footprint so the untouched
    // collision proxy lines up with the visible surface.
    m.wall(-38, 4, -27, 28, 8, 1, wall);
    m.wall(-51.5, 4, -13, 1, 8, 28, wall);
    m.wall(-24.5, 4, -13, 1, 8, 28, wall);
    // North wall split by two door openings, with a lintel over the gap.
    m.wall(-46, 4, 0.5, 11, 8, 1, wall);
    m.wall(-29, 4, 0.5, 10, 8, 1, wall);
    m.box(-38, 7, 0.5, 7, 2, 1, wall);
    // Door frames and a roof parapet.
    m.box(-40.5, 3.5, 1.06, 0.25, 6, 0.25, 'trim');
    m.box(-34, 3.5, 1.06, 0.25, 6, 0.25, 'trim');
    m.box(-38, 8.9, -13, 29.3, 0.35, 29.3, 'rooftrim');
    // Facade windows.
    m.windows('x', 5, -38, 4, -27, 27, 8, 1.1, 'plaster', 'window');
    m.windows('x', 5, -38, 4, 0.5, 18, 8, 1.1, 'plaster', 'window');
    m.windows('z', 3, -51.5, 4, -13, 27, 8, 1.1, 'plaster', 'window');
    m.windows('z', 3, -24.5, 4, -13, 27, 8, 1.1, 'plaster', 'window');
    // Interior props.
    m.crateBox(-44, 0, -19, 4, 2.8, 4, 'wood', 'woodtrim');
    m.crateBox(-31, 0, -10, 4, 2.3, 5, 'wood', 'woodtrim');
    m.barrel(-40, 0, -21, 'metal');
    // Exterior roof-access stairs. Step height/depth mirror MapKit.stairs so the
    // visible treads land exactly on the unchanged collision staircase.
    for (let i = 0; i < 21; i++) {
        m.box(-57, (i + 1) * 0.2, 2 - i * 1.25, 4, (i + 1) * 0.4, 1.27, 'concrete');
    }
    m.box(-54.5, 8.2, -25.3, 6, 0.4, 4, 'roof');
}

function towerAndBridge(m) {
    const steel = 'metal';
    // Tower columns.
    for (const x of [24, 34]) {
        for (const z of [-25, -15]) {
            m.box(x, 4, z, 1.2, 8, 1.2, steel);
            m.box(x, 8.4, z, 1.35, 0.4, 1.35, 'trim');
        }
    }
    // Cross braces for the tower.
    m.box(29, 5, -20, 9.5, 0.5, 0.5, 'trim');
    m.box(29, 6.6, -20, 9.5, 0.5, 0.5, 'trim');
    m.box(24, 5.8, -20, 0.5, 0.5, 9.5, 'trim');
    m.box(34, 5.8, -20, 0.5, 0.5, 9.5, 'trim');
    // Deck and canopy.
    m.box(29, 8.2, -20, 13, 0.4, 13, 'metal');
    m.box(29, 11.5, -25.8, 13, 6.2, 0.5, 'roof');
    m.box(23, 10, -24, 0.45, 3.2, 4, steel);
    m.box(23, 10, -16, 0.45, 3.2, 4, steel);
    m.box(35, 10, -22, 0.45, 3.2, 8, steel);
    m.box(29, 12.5, -20, 13.8, 0.45, 13.8, 'rooftrim');
    // Stairs up to the deck, matching MapKit.stairs collision.
    for (let i = 0; i < 21; i++) {
        m.box(40, (i + 1) * 0.2, 18 - i * 1.25, 4, (i + 1) * 0.4, 1.27, 'concrete');
    }
    m.box(37.5, 8.2, -7.5, 7, 0.4, 4, 'metal');
    m.box(35, 8.2, -12, 4, 0.4, 7, 'metal');

    // Sky bridge with railings and a central walkway.
    m.box(-1.5, 8.2, -20, 47, 0.4, 4, 'metal');
    m.box(-1.5, 8.9, -22, 47, 1, 0.2, steel);
    m.box(-1.5, 8.9, -18, 47, 1, 0.2, steel);
    for (const x of [-15, 7]) {
        m.box(x, 4, -20, 0.8, 8, 0.8, steel);
    }
    for (let x = -22; x <= 19; x += 2) {
        m.cylinder(x, 9.25, -21.85, 0.05, 0.05, 0.8, 'trim', 6);
        m.cylinder(x, 9.25, -18.15, 0.05, 0.05, 0.8, 'trim', 6);
    }
}

function underpass(m) {
    m.box(8, 2.5, -48, 1, 5, 20, 'concrete');
    m.box(19, 2.5, -48, 1, 5, 20, 'concrete');
    m.box(13.5, 5.2, -48, 12, 0.4, 20, 'roof');
    m.box(13.5, 4.2, -37.6, 10, 1.2, 0.2, 'trim');
    // Underpass ramp: stairsUpTo(-37.4) resolves to a climb starting near z=-23.
    for (let i = 0; i < 13; i++) {
        m.box(13.5, (i + 1) * 0.2, -23 - i * 1.2, 3.2, (i + 1) * 0.4, 1.22, 'concrete');
    }
    m.box(13.5, 5.7, -48, 12.3, 0.4, 20.3, 'rooftrim');
}

/** Solid staircase matching MapKit.stairs: every step fills from the base up. */
function stairsSteps(m, x, startZ, direction, count, rise, depth, width, matName) {
    for (let i = 0; i < count; i++) {
        m.box(x, (i + 1) * rise / 2, startZ + direction * i * depth, width, (i + 1) * rise, depth + 0.02, matName);
    }
}

/** Stepped dune matching MapKit.hill so climbable rings line up with collision. */
function duneHill(m, x, z, w, d, height, matName) {
    const steps = Math.max(2, Math.round(height / 0.42));
    const rise = height / steps;
    for (let i = 0; i < steps; i++) {
        const t = i / steps;
        const wi = w * (1 - t * 0.72), di = d * (1 - t * 0.72);
        m.box(x, rise * i + rise / 2, z, wi, rise, di, matName);
    }
}

function buildDuneridge() {
    const m = new Modeler();
    mat('sand', 0xd9c48f, 0.98, 0);
    mat('sand:dark', 0xc0a877, 0.96, 0);
    mat('ripple', 0xcdb684, 0.7, 0);
    mat('rock', 0xb08a5c, 0.95, 0);
    mat('rock:dark', 0x8e6b45, 0.95, 0);
    mat('stone', 0xcbb894, 0.92, 0);
    mat('dune:east', 0xe3cd98, 1, 0);
    mat('dune:west', 0xd2bb85, 1, 0);
    mat('dune:south', 0xe8d6a6, 1, 0);
    mat('metal', 0x6d7b74, 0.5, 0.7);
    mat('metal:deck', 0x7c8983, 0.55, 0.6);
    mat('metal:rail', 0x5c6a65, 0.5, 0.7);
    mat('rust', 0xb5824f, 0.7, 0.35);
    mat('rust:orange', 0xc0703f, 0.7, 0.35);
    mat('rust:canopy', 0x8a5a3c, 0.7, 0.3);
    mat('wood', 0x8a7a58, 0.9, 0);
    mat('wood:ruin1', 0xc9a877, 0.8, 0);
    mat('wood:ruin2', 0xbf9d6c, 0.8, 0);
    mat('wood:derrick', 0xb5824f, 0.8, 0);
    mat('foliage', 0x6f8a4e, 1, 0);
    mat('bush', 0x9a9358, 1, 0);
    mat('container:rust', 0xc07a4a, 0.7, 0.3);
    mat('container:sand', 0xb08a5c, 0.65, 0.3);
    mat('container:brown', 0x9a7a58, 0.65, 0.3);
    mat('distant', 0xc09a70, 0.95, 0);
    mat('distant2', 0xb08a5c, 0.95, 0);

    // Ground, dry riverbed and wind ripples.
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(176, 176), mat('sand'));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0;
    m.add(floor, 'sand');
    m.slab(0, 0.02, 0, 176, 15, 'sand:dark');
    for (let x = -80; x <= 80; x += 8) {
        m.slab(x, 0.026, -9 + (x % 16 === 0 ? 0 : 3), 5, 2.6, 'ripple');
    }

    // Canyon walls with a lighter coping cap.
    m.wall(-76, 3, -28, 20, 6, 66, 'rock', 'rock:dark');
    m.wall(-16, 4, -79, 118, 8, 20, 'rock:dark', 'rock');
    m.wall(76, 2.5, 22, 20, 5, 96, 'rock', 'rock:dark');
    m.wall(-6, 5, 76, 118, 10, 20, 'rock', 'rock:dark');
    m.box(-76, 6.4, -28, 22, 0.8, 68, 'rock:dark');
    stairsSteps(m, -76, 5.6 - (-1) * (17 - 1) * 1.2, -1, 17, 0.4, 1.2, 4, 'rock:dark');

    // Dunes.
    duneHill(m, 8, 18, 30, 24, 3.2, 'dune:east');
    duneHill(m, -44, 36, 26, 22, 4.4, 'dune:west');
    duneHill(m, 42, 48, 22, 18, 2.6, 'dune:south');

    // Sandstone ruins platform, pillars and roof slabs.
    m.wall(-42, 1.6, -22, 20, 3.2, 16, 'stone', 'stone');
    stairsSteps(m, -42, -13.1 - (-1) * (8 - 1) * 1.3, -1, 8, 0.4, 1.3, 5, 'stone');
    for (const [x, z] of [[-49, -28], [-42, -28], [-35, -28], [-49, -16], [-35, -16]]) {
        m.box(x, 5, z, 1.2, 3.6, 1.2, 'rock:dark');
        m.box(x, 6.75, z, 1.3, 0.25, 1.3, 'rock');
    }
    m.box(-42, 7.1, -28, 20, 0.6, 4, 'rock:dark');
    m.box(-49, 7.1, -16, 6, 0.6, 4, 'rock:dark');
    m.crateBox(-34, 3.2, -30, 1.6, 1.6, 1.6, 'wood:ruin1', 'woodtrim');
    m.crateBox(-35.6, 3.2, -30.4, 1.3, 1.3, 1.3, 'wood:ruin2', 'woodtrim');
    // Arch doorway.
    m.box(-47, 2.2, -1.6, 0.7, 4.4, 1.4, 'stone');
    m.box(-37, 2.2, -1.6, 0.7, 4.4, 1.4, 'stone');
    m.box(-42, 4.75, -1.6, 10.7, 0.7, 1.4, 'stone');
    m.box(-42, 5.15, -1.6, 10.9, 0.22, 1.6, 'rock');

    // Drilling derrick.
    for (const [x, z] of [[24, -36], [36, -36], [24, -24], [36, -24]]) {
        m.box(x, 4.6, z, 1.4, 9.2, 1.4, 'metal');
        m.box(x, 9.15, z, 1.55, 0.35, 1.55, 'metal:rail');
    }
    m.box(30, 9.2, -30, 14, 0.4, 14, 'metal:deck');
    m.box(30, 9.8, -36.9, 14, 0.9, 0.18, 'metal:rail');
    m.box(30, 9.8, -23.1, 14, 0.9, 0.18, 'metal:rail');
    m.box(23.1, 9.8, -30, 0.18, 0.9, 14, 'metal:rail');
    m.box(36.9, 9.8, -30, 0.18, 0.9, 14, 'metal:rail');
    stairsSteps(m, 30, -21.9 - (-1) * (24 - 1) * 1.2, -1, 24, 0.4, 1.2, 4, 'metal');
    m.box(30, 11.4, -36, 15, 0.5, 15, 'metal:rail');
    m.box(26.5, 12.6, -35.4, 1.2, 3, 1.2, 'metal');
    m.barrel(23.9, 9.6, -24.2, 'rust');
    m.barrel(25.3, 9.6, -24.8, 'metal');
    m.crateBox(36, 9.6, -24.8, 1.7, 1.7, 1.7, 'wood:derrick', 'woodtrim');

    // Watch tower on the east shelf.
    for (const [x, z] of [[58, 38], [66, 38], [58, 46], [66, 46]]) {
        m.box(x, 3.2, z, 1, 6.4, 1, 'metal');
        m.box(x, 6.35, z, 1.15, 0.3, 1.15, 'metal:rail');
    }
    m.box(62, 6.2, 42, 12, 0.4, 12, 'metal:deck');
    m.box(62, 6.8, 36.1, 12, 0.8, 0.16, 'metal:rail');
    m.box(62, 6.8, 47.9, 12, 0.8, 0.16, 'metal:rail');
    m.box(56.1, 6.8, 42, 0.16, 0.8, 12, 'metal:rail');
    m.box(67.9, 6.8, 42, 0.16, 0.8, 12, 'metal:rail');
    stairsSteps(m, 62, 48.6 - (-1) * (16 - 1) * 1.2, -1, 16, 0.4, 1.2, 4, 'metal');
    m.box(62, 8.6, 42, 13, 3.6, 0.5, 'rust:canopy');
    m.cylinder(62, 6.6 + 1.5, 37, 0.17, 0.17, 3, 'metal', 10);
    m.box(62, 9.75, 37, 0.9, 0.25, 0.42, 'metal:rail');
    m.box(62, 9.55, 37, 0.34, 0.22, 0.34, 'trim');

    // Ground cover, wrecks and vegetation.
    for (const [x, z, w, h] of [[-16, 30, 4, 2.2], [18, -10, 5, 1.6], [-20, -40, 6, 2.6], [34, 10, 4.4, 1.4], [-56, 6, 5, 2.4], [52, -34, 4.6, 2]]) {
        m.box(x, h / 2, z, w, h, w * 0.8, 'rock');
        m.sphere(x + w * 0.25, h * 0.85, z - w * 0.18, w * 0.28, 'rock');
    }
    for (const [x, z] of [[-10, 62], [16, 66], [-66, -8], [70, -40], [-30, -50], [46, -60]]) {
        m.sphere(x, 0.8, z, 1.0, 'bush');
        m.sphere(x + 0.5, 1.15, z - 0.25, 0.7, 'bush');
    }
    for (const [x, z] of [[-58, -70], [66, 62], [-78, 66], [10, -64]]) m.tree(x, 0, z, 0.9);
    m.crateBox(-6, 0, -56, 9, 2.2, 4, 'rust', 'woodtrim');
    m.box(-6, 3, -56, 9.6, 0.3, 4.6, 'metal:rail');
    m.crateBox(20, 0, 58, 7, 1.8, 3.2, 'rust:orange', 'woodtrim');
    m.container(-70, 0, 30, 'container:rust', true);
    m.container(-54, 0, 62, 'container:sand', false);
    m.container(64, 0, -8, 'container:brown', false);

    // Distant mesas.
    for (let i = 0; i < 12; i++) {
        const x = -120 + i * 22, h = 12 + (i % 3) * 7;
        m.wall(x, h / 2, -118, 18, h, 16, i % 2 ? 'distant' : 'distant2', 'rock');
    }

    return m.merge();
}
function buildSandstorm() {
    const m = new Modeler();
    mat('sandstorm:ground', 0xcbb58a, .98, 0);
    mat('sandstorm:stone', 0xb9a07b, .9, 0);
    mat('sandstorm:plaster', 0xe5d6b6, .88, 0);
    mat('sandstorm:shadow', 0x493f39, .82, 0);
    mat('sandstorm:wood', 0x765b42, .72, .04);
    mat('sandstorm:clothBlue', 0x567e83, .84, 0);
    mat('sandstorm:clothRed', 0xaa6852, .84, 0);
    mat('sandstorm:iron', 0x59605c, .4, .77);
    mat('sandstorm:rust', 0x96674c, .65, .5);
    mat('sandstorm:glass', 0x294650, .2, .4);
    mat('sandstorm:tile', 0x9a896e, .92, 0);
    mat('sandstorm:sea', 0x6e9b9f, .32, .05);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(180, 180), mat('sandstorm:ground'));
    ground.rotation.x = -Math.PI / 2;
    m.add(ground, 'sandstorm:ground');
    for (const z of [-46, 0, 46]) m.slab(0, .013, z, 168, 11, 'sandstorm:tile');
    m.slab(74, .015, 0, 12, 160, 'sandstorm:tile');
    m.slab(-82, .02, 0, 8, 170, 'sandstorm:sea');
    for (const z of [-69, 69]) {
        for (const [i, x] of [-47, -19, 20, 55].entries()) {
            const body = i % 2 ? 'sandstorm:plaster' : 'sandstorm:stone';
            m.wall(x, 4.5, z, 18, 9, 17, body, 'sandstorm:plaster');
            m.box(x, 9.25, z, 18.7, .5, 17.7, 'sandstorm:tile');
            for (const sx of [-7, 7]) {
                m.box(x + sx, 10.15, z, 1.2, 1.5, 17.4, 'sandstorm:plaster');
            }
            const frontZ = z > 0 ? z - 8.6 : z + 8.6;
            for (const dx of [-5.5, 0, 5.5]) {
                m.box(x + dx, 5.6, frontZ, 2.2, 3.4, .18, 'sandstorm:shadow');
                m.box(x + dx, 5.7, frontZ + (z > 0 ? -.11 : .11), 1.65, 2.7, .09, 'sandstorm:glass');
                m.box(x + dx, 7.55, frontZ, 2.7, .16, .3, 'sandstorm:plaster');
            }
            m.box(x, 2.3, frontZ + (z > 0 ? -.1 : .1), 2.8, 4.6, .14, 'sandstorm:wood');
            for (let k = 0; k < 5; k++)
                m.box(x - 1.1 + k * .55, 2.4, frontZ + (z > 0 ? -.21 : .21), .07, 4.3, .08, 'sandstorm:iron');
            // Exposed drain pipe and roof spout.
            m.cylinder(x + 8.6, 4.2, frontZ, .1, .1, 8.4, 'sandstorm:rust', 10);
            m.box(x + 8.6, 8.55, frontZ, .8, .18, .25, 'sandstorm:rust');
        }
    }
    // High market bridge, with usable full-height passage under the deck.
    m.box(0, 3, 0, 25, .4, 17, 'sandstorm:stone');
    for (const x of [-11, 11]) for (const z of [-7, 7])
        m.wall(x, 1.6, z, 1, 3.2, 1, 'sandstorm:stone', 'sandstorm:plaster');
    for (const z of [-8.5, 8.5]) {
        m.box(0, 4.3, z, 27, 2.2, .6, 'sandstorm:plaster');
        for (let x = -12; x <= 12; x += 4)
            m.box(x, 4.3, z + (z > 0 ? .35 : -.35), .18, 1.5, .15, 'sandstorm:tile');
    }
    for (let x = -10; x <= 10; x += 4) m.box(x, 3.35, 0, .18, .12, 17, 'sandstorm:wood');
    // Weathered arcade windows above the market.
    for (const x of [-8, -3, 3, 8]) {
        m.box(x, 4.4, -8.9, 1.25, 1.2, .12, 'sandstorm:shadow');
        m.box(x, 4.45, -8.99, .95, .83, .06, 'sandstorm:glass');
    }
    // Cover is aligned to gameplay AABBs; details are visual-only.
    for (const [x, z, w, d] of [[-35, -24, 10, 2], [-35, 24, 10, 2],
        [10, -25, 2, 10], [10, 25, 2, 10], [52, -22, 8, 2], [52, 22, 8, 2]]) {
        m.wall(x, 1.5, z, w, 3, d, 'sandstorm:plaster', 'sandstorm:stone');
        const alongX = w > d;
        for (let j = -1; j <= 1; j++)
            m.box(x + (alongX ? j * 2.2 : 0), 2.1, z + (alongX ? .04 : j * 2.2),
                alongX ? .08 : d + .06, .08, alongX ? d + .06 : .08, 'sandstorm:tile');
    }
    for (const [x, z] of [[-28, -58], [-3, -55], [4, 55], [-26, 58], [54, -55], [55, 55]])
        m.crate(x, 0, z, 2, 'sandstorm:wood', 'sandstorm:iron');
    for (const [x, z] of [[-5, -39], [5, 39], [56, -39], [56, 39]])
        m.barrel(x, 0, z, 'sandstorm:rust');
    // Market fabric, poles, rope, lanterns, signage.
    for (const z of [-35, 35]) {
        const cloth = z < 0 ? 'sandstorm:clothBlue' : 'sandstorm:clothRed';
        m.box(-18, 4.5, z, 18, .16, 8, cloth);
        for (const x of [-27, -9]) {
            m.cylinder(x, 2.35, z - 3.6, .08, .08, 4.7, 'sandstorm:wood', 8);
            m.cylinder(x, 2.35, z + 3.6, .08, .08, 4.7, 'sandstorm:wood', 8);
        }
        for (let x = -25; x <= -11; x += 3.5) {
            m.box(x, 4.25, z - 3.4, .35, .55, .25, cloth);
            m.box(x, 4.25, z + 3.4, .35, .55, .25, cloth);
        }
        m.crateBox(-23, 0, z + (z > 0 ? 7 : -7), 3.3, 1.15, 1.9, 'sandstorm:wood', 'sandstorm:iron');
    }
    for (const [x, z] of [[-78, -78], [78, -78], [-78, 78], [78, 78], [0, -81], [0, 81]])
        m.lamp(x, 0, z, 7, 'sandstorm:iron');
    for (const [site, z] of [['A', -46], ['B', 46]]) {
        m.slab(37, .025, z, 15, 15, 'sandstorm:tile');
        for (const dx of [-8, 8]) m.box(37 + dx, .05, z, .2, .08, 16, 'sandstorm:rust');
        for (const dz of [-8, 8]) m.box(37, .05, z + dz, 16, .08, .2, 'sandstorm:rust');
        // Site letter is formed from durable painted bars.
        m.box(37, .065, z, 3, .02, .24, 'sandstorm:rust');
        m.box(37, .065, z - 1.4, .24, .02, 3, 'sandstorm:rust');
    }
    // Distant silhouettes remain outside the playable collision field.
    for (let i = 0; i < 14; i++) {
        const x = -120 + i * 19;
        const h = 12 + (i % 4) * 5;
        m.wall(x, h / 2, -115, 15, h, 13, i % 2 ? 'sandstorm:plaster' : 'sandstorm:stone');
        m.wall(x, h / 2, 115, 15, h, 13, i % 2 ? 'sandstorm:stone' : 'sandstorm:plaster');
    }
    return m.merge();
}

function exportGltf(scene, out) {
    const exporter = new GLTFExporter();
    exporter.parse(
        scene,
        (result) => {
            const buffer = ArrayBuffer.isView(result) ? result : result;
            writeFileSync(out, Buffer.from(buffer));
            const kb = Math.round(buffer.byteLength / 1024);
            console.log(`Wrote ${out} (${kb} KB)`);
        },
        (err) => {
            console.error(err);
            process.exit(1);
        },
        { binary: true, onlyVisible: false }
    );
}

mkdirSync(OUT_DIR, { recursive: true });
const requested = new Set(process.argv.slice(2));
for (const [id, builder] of [['blockyard', buildBlockyard], ['duneridge', buildDuneridge], ['sandstorm', buildSandstorm]]) {
    if (requested.size && !requested.has(id)) continue;
    mats.clear();
    const scene = builder();
    exportGltf(scene, join(OUT_DIR, `${id}.glb`));
}
