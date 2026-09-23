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
    'container:rust': { color: 0xce8163, roughness: 0.7, metalness: 0.3 },
    'container:tan': { color: 0xe1bd6b, roughness: 0.6, metalness: 0.3 },
    'container:green': { color: 0xa9bbae, roughness: 0.55, metalness: 0.35 },
};

function mat(name, color, roughness, metalness) {
    if (!mats.has(name)) {
        const d = MATERIAL_DEFAULTS[name] ?? { color: color ?? 0xcccccc, roughness: roughness ?? 0.92, metalness: metalness ?? 0 };
        mats.set(name, new THREE.MeshStandardMaterial({ name, color: d.color, roughness: d.roughness, metalness: d.metalness }));
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
        const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(r, detail), mat(name));
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
const scene = buildBlockyard();
exportGltf(scene, join(OUT_DIR, 'blockyard.glb'));
