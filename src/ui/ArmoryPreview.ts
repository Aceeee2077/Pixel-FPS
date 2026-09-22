import * as THREE from 'three';
import { weaponModel } from '../weapons/WeaponModel';
import type { WeaponId } from '../weapons/WeaponConfig';
import type { WeaponAppearance } from '../weapons/WeaponAppearance';
import { t } from '../core/I18n';

export class ArmoryPreview {
    private renderer: THREE.WebGLRenderer;
    private scene = new THREE.Scene();
    private camera = new THREE.PerspectiveCamera(32, 1, .01, 20);
    private pivot = new THREE.Group();
    private host?: HTMLElement;
    private yaw = 1.22;
    private pitch = -.08;
    private dragging = false;
    private lastX = 0;
    private lastY = 0;
    private width = 0;
    private height = 0;
    private time = 0;
    constructor() {
        this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
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
    private reset() { this.yaw=1.22; this.pitch=-.08; }
    show(host: HTMLElement, id: WeaponId, appearance: WeaponAppearance) {
        this.host=host; host.append(this.renderer.domElement); this.renderer.domElement.setAttribute('aria-label', t('armory.previewAria')); this.reset();
        this.pivot.clear();
        const model=weaponModel(id,false,appearance);
        const bounds=new THREE.Box3().setFromObject(model),size=bounds.getSize(new THREE.Vector3());
        model.position.sub(bounds.getCenter(new THREE.Vector3()));
        model.scale.setScalar(1.65/Math.max(size.x,size.y,size.z)); model.position.multiplyScalar(model.scale.x);
        this.pivot.add(model); this.width=0; this.time=0;
        host.dataset.appearance=model.userData.appearance;
    }
    render(dt: number) {
        if (!this.host?.isConnected) return;
        const width=this.host.clientWidth,height=this.host.clientHeight;
        if (!width || !height) return;
        if(width!==this.width||height!==this.height) {
            this.width=width; this.height=height;
            this.renderer.setSize(width,height,false); this.camera.aspect=width/height;
            this.camera.position.set(0,.35,Math.max(2.6,1.08/(Math.tan(THREE.MathUtils.degToRad(16))*this.camera.aspect)));
            this.camera.lookAt(0,0,0); this.camera.updateProjectionMatrix();
        }
        this.time+=dt;
        this.pivot.rotation.set(this.pitch,this.yaw,0);
        this.renderer.render(this.scene,this.camera);
    }
}
