import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { SurfaceLibrary } from './SurfaceLibrary';

/**
 * Loads the authored GLB visual layer for a map. Gameplay data (collision,
 * spawns, bot routes) continues to come from `ArenaMap`, whose procedural
 * meshes are hidden only after the GLB has successfully loaded — so a failed
 * asset fetch cleanly falls back to the existing low-poly scene.
 */
export class Environment {
    readonly group = new THREE.Group();
    private loader = new GLTFLoader();
    private surfaces = new SurfaceLibrary();
    private loaded = false;
    private token = 0;

    constructor(private scene: THREE.Scene) {
        scene.add(this.group);
    }

    get ready() { return this.loaded; }

    async load(mapId: string) {
        this.clear();
        const token = ++this.token;
        const url = `${import.meta.env.BASE_URL}assets/maps/${mapId}.glb`;
        try {
            const gltf = await this.loader.loadAsync(url);
            if (token !== this.token) {
                this.disposeObject(gltf.scene);
                return;
            }
            gltf.scene.traverse(o => {
                if (o instanceof THREE.Mesh) {
                    o.castShadow = true;
                    o.receiveShadow = true;
                    const materials = Array.isArray(o.material) ? o.material : [o.material];
                    materials.forEach(m => this.surfaces.apply(m));
                }
            });
            this.group.add(gltf.scene);
            this.loaded = true;
        } catch (err) {
            if (token !== this.token) return;
            console.warn(`Environment: failed to load ${url}, falling back to procedural geometry.`, err);
            this.loaded = false;
        }
    }

    private disposeObject(root: THREE.Object3D) {
        root.traverse(o => {
            if (o instanceof THREE.Mesh) {
                o.geometry.dispose();
                const materials = Array.isArray(o.material) ? o.material : [o.material];
                materials.forEach(m => m.dispose());
            }
        });
    }

    clear() {
        this.group.traverse(o => {
            if (o instanceof THREE.Mesh) {
                o.geometry.dispose();
                const materials = Array.isArray(o.material) ? o.material : [o.material];
                materials.forEach(m => m.dispose());
            }
        });
        while (this.group.children.length) this.group.remove(this.group.children[0]);
        this.loaded = false;
    }

    dispose() {
        this.clear();
        this.scene.remove(this.group);
        this.surfaces.dispose();
    }
}
