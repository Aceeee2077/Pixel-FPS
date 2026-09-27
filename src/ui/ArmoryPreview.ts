import * as THREE from 'three';
import { weaponModel } from '../weapons/WeaponModel';
import { WeaponAssetLoader } from '../weapons/WeaponAssetLoader';
import type { WeaponId } from '../weapons/WeaponConfig';
import type { WeaponAppearance } from '../weapons/WeaponAppearance';
import { t } from '../core/I18n';

export class ArmoryPreview {
    private renderer: THREE.WebGLRenderer;
    private scene = new THREE.Scene();
    private camera = new THREE.PerspectiveCamera(32, 1, .01, 20);
    private pivot = new THREE.Group();
    private host?: HTMLElement;
    private yaw = .4;
    private pitch = -.08;
    private dragging = false;
    private lastX = 0;
    private lastY = 0;
    private width = 0;
    private height = 0;
    private time = 0;
    private displayed?: THREE.Group;
    private modelSize = new THREE.Vector3(1, 1, 1);
    private readonly assets = new WeaponAssetLoader();
    private selection = 0;
    constructor() {
        this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.2;
        const canvas = this.renderer.domElement;
        canvas.setAttribute('aria-label', t('armory.previewAria'));
        canvas.tabIndex = 0;
        this.scene.add(new THREE.HemisphereLight(0xe5f4ec, 0x465148, 2));
        const key = new THREE.DirectionalLight(0xfff5dc, 3); key.position.set(-2, 4, 3); this.scene.add(key);
        const rim = new THREE.DirectionalLight(0x8ad5e0, 2); rim.position.set(3, 2, -2); this.scene.add(rim);
        this.scene.add(this.pivot);
        canvas.addEventListener('pointerdown', e => { this.dragging = true; this.lastX = e.clientX; this.lastY = e.clientY; canvas.setPointerCapture(e.pointerId); });
        canvas.addEventListener('pointermove', e => {
            if (!this.dragging) return;
            this.yaw += (e.clientX - this.lastX) * .009;
            this.pitch = THREE.MathUtils.clamp(this.pitch + (e.clientY - this.lastY) * .009, -1.2, 1.2);
            this.lastX = e.clientX; this.lastY = e.clientY;
        });
        canvas.addEventListener('pointerup', () => this.dragging = false);
        canvas.addEventListener('lostpointercapture', () => this.dragging = false);
        canvas.addEventListener('dblclick', () => this.reset());
        canvas.addEventListener('keydown', e => {
            if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home'].includes(e.code)) return;
            e.preventDefault(); e.stopPropagation();
            if(e.code==='Home') this.reset();
            else if(e.code==='ArrowLeft') this.yaw-=.15;
            else if(e.code==='ArrowRight') this.yaw+=.15;
            else this.pitch=THREE.MathUtils.clamp(this.pitch+(e.code==='ArrowUp'?-.1:.1),-1.2,1.2);
        });
    }
    private reset() { this.yaw=this.modelSize.z > this.modelSize.x * 1.4 ? 1.18 : .38; this.pitch=-.08; }
    show(host: HTMLElement, id: WeaponId, appearance: WeaponAppearance, fallbackImage?: string | null) {
        const selection = ++this.selection;
        this.host=host; host.append(this.renderer.domElement); this.renderer.domElement.setAttribute('aria-label', t('armory.previewAria')); this.reset();
        const overlay = document.createElement('div');
        overlay.className = 'preview-loading';
        if (fallbackImage) {
            const image = document.createElement('img');
            image.src = fallbackImage;
            image.alt = '';
            overlay.append(image);
        }
        const status = document.createElement('span');
        status.textContent = t('equipment.loadingModel');
        overlay.append(status);
        host.append(overlay);
        this.mount(weaponModel(id,false,appearance));
        void this.assets.loadPreview(id, appearance).then(model => {
            if (selection !== this.selection || this.host !== host || !host.isConnected) return;
            if (model) { this.mount(model); overlay.remove(); }
            else status.textContent = t('equipment.modelFailed');
        });
    }
    preload(items: readonly { id: WeaponId; appearance: WeaponAppearance }[]) {
        for (const item of items) void this.assets.preloadPreview(item.id, item.appearance);
    }
    /** GLB geometry is cached by the loader; preview materials are private clones. */
    private dispose(model: THREE.Group) {
        const sharedGeometry = !!model.userData.assetPath;
        model.traverse(object => {
            if (!(object instanceof THREE.Mesh)) return;
            if (!sharedGeometry) object.geometry.dispose();
            const list = Array.isArray(object.material) ? object.material : [object.material];
            list.forEach(material => material.dispose());
        });
    }
    private mount(model: THREE.Group) {
        if (this.displayed) {
            this.dispose(this.displayed);
            this.pivot.remove(this.displayed);
        }
        const bounds=new THREE.Box3().setFromObject(model),size=bounds.getSize(new THREE.Vector3());
        model.position.sub(bounds.getCenter(new THREE.Vector3()));
        model.scale.setScalar(1.65/Math.max(size.x,size.y,size.z)); model.position.multiplyScalar(model.scale.x);
        this.modelSize.copy(size).multiplyScalar(model.scale.x);
        this.reset();
        this.pivot.add(model); this.displayed=model; this.width=0; this.time=0;
        if (this.host) this.host.dataset.appearance=model.userData.appearance;
    }
    render(dt: number) {
        if (!this.host?.isConnected) return;
        const width=this.host.clientWidth,height=this.host.clientHeight;
        if (!width || !height) return;
        if(width!==this.width||height!==this.height) {
            this.width=width; this.height=height;
            this.renderer.setSize(width,height,false); this.camera.aspect=width/height;
            const tan = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
            const projectedWidth = Math.abs(this.modelSize.x * Math.cos(this.yaw)) + Math.abs(this.modelSize.z * Math.sin(this.yaw));
            const projectedHeight = this.modelSize.y + Math.abs(this.modelSize.z * Math.sin(this.pitch));
            const distance = Math.max(1.6, projectedHeight / (2 * tan * .74),
                projectedWidth / (2 * tan * this.camera.aspect * .74));
            this.camera.position.set(0,0,distance);
            this.camera.lookAt(0,0,0); this.camera.updateProjectionMatrix();
        }
        this.time+=dt;
        this.pivot.rotation.set(this.pitch,this.yaw,0);
        this.renderer.render(this.scene,this.camera);
    }
    destroy() {
        ++this.selection;
        if (this.displayed) { this.dispose(this.displayed); this.pivot.remove(this.displayed); this.displayed = undefined; }
        this.assets.dispose();
        this.renderer.dispose();
        this.renderer.forceContextLoss();
        this.renderer.domElement.remove();
        this.host = undefined;
    }
}
