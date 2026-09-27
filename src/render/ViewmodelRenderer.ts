import * as THREE from 'three';

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
