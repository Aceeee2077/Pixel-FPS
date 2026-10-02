import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

/** A separate depth pass keeps first-person gear independent of world FOV and walls. */
export class ViewmodelRenderer {
    readonly scene = new THREE.Scene();
    readonly camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, .01, 10);
    constructor() {
        this.scene.add(this.camera);
        this.scene.add(new THREE.HemisphereLight(0xf5fff6, 0x67746d, 2.4));
        const key = new THREE.DirectionalLight(0xffe9cc, 2.2);
        key.position.set(-2, 4, 3);
        this.scene.add(key);
    }
    /**
     * Give the viewmodel scene something to reflect.
     *
     * Weapons converted from Counter-Strike 2 ship a full PBR texture set, and
     * their metal renders black without an environment. A small pre-filtered
     * room costs nothing per frame and lifts those materials without changing
     * how the project's own flat-shaded models look. Called once the game's
     * renderer exists, which is after this class is constructed.
     */
    attachEnvironment(renderer: THREE.WebGLRenderer, enabled = true) {
        if (!enabled) {
            this.scene.environment?.dispose();
            this.scene.environment = null;
            this.environment?.dispose();
            this.environment = undefined;
            return;
        }
        if (this.scene.environment) return;
        const pmrem = new THREE.PMREMGenerator(renderer);
        this.environment = pmrem.fromScene(new RoomEnvironment(), .04).texture;
        this.scene.environment = this.environment;
        this.scene.environmentIntensity = .55;
        pmrem.dispose();
    }
    private environment?: THREE.Texture;
    resize(aspect: number) {
        this.camera.aspect = aspect;
        this.camera.updateProjectionMatrix();
    }
    render(renderer: THREE.WebGLRenderer, world: THREE.Scene, worldCamera: THREE.Camera) {
        renderer.clear();
        renderer.render(world, worldCamera);
        renderer.clearDepth();
        renderer.render(this.scene, this.camera);
    }
}
