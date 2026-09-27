import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import type { WeaponId } from './WeaponConfig';
import { getWeapon } from '../data/weapons';
import { weaponHands } from './WeaponModel';
import { appearanceKey, skinModel, type WeaponAppearance } from './WeaponAppearance';
import { applyKnifeFinish } from './skins/KnifeMaterialFactory';
import { knifeFamily, knifeFinish } from './skins/KnifeSkinConfig';
import { applyWeaponFinish } from '../data/weaponFinishes';

/** Flat id -> path map plus the rich per-weapon records written by Blender. */
interface AssetManifest {
    assets?: Record<string, { model?: string; status?: string }>;
    [key: string]: unknown;
}

function isModelPath(value: unknown): value is string {
    return typeof value === 'string' && value.startsWith('/assets/weapons/') && value.endsWith('.glb');
}

/** Muzzle flash, tracers and hand IK follow anchors authored in the GLB. */
function anchorsOf(model: THREE.Group) {
    model.updateMatrixWorld(true);
    const inverse = new THREE.Matrix4().copy(model.matrixWorld).invert();
    const local = (name: string) => {
        const node = model.getObjectByName(name);
        if (!node) return undefined;
        return new THREE.Vector3().setFromMatrixPosition(
            new THREE.Matrix4().multiplyMatrices(inverse, node.matrixWorld));
    };
    const muzzle = local('Muzzle');
    const viewmodel = local('ViewmodelAnchor');
    const left = local('LeftHandIK');
    const right = local('RightHandIK');
    return {
        muzzle: muzzle ? muzzle.toArray() as [number, number, number] : undefined,
        viewmodel: viewmodel ? viewmodel.toArray() as [number, number, number] : undefined,
        leftHand: left ? left.toArray() as [number, number, number] : undefined,
        rightHand: right ? right.toArray() as [number, number, number] : undefined,
    };
}

interface LoadedAsset {
    model: THREE.Group;
    anchors: ReturnType<typeof anchorsOf>;
    path: string;
}

/** Optional GLBs resolve to null; procedural models remain immediately playable. */
export class WeaponAssetLoader {
    private readonly loader = new GLTFLoader();
    private readonly draco = new DRACOLoader();
    private readonly models = new Map<string, Promise<LoadedAsset | null>>();
    private manifest?: Promise<AssetManifest>;
    constructor() {
        // Authored weapon GLBs are Draco-compressed. Vite serves the matching
        // decoder from three's own package at /draco/ (see vite.config.ts).
        this.draco.setDecoderPath('/draco/');
        this.loader.setDRACOLoader(this.draco);
    }
    private loadManifest(): Promise<AssetManifest> {
        return this.manifest ??= fetch('/assets/weapons/manifest.json')
            .then(response => response.ok ? response.json() as Promise<AssetManifest> : {} as AssetManifest)
            .catch(() => ({} as AssetManifest));
    }
    /** Resolve a weapon and role to the GLB path published for it, if any. */
    async resolvePath(id: WeaponId, role: 'view' | 'preview' | 'world', appearance: WeaponAppearance) {
        const family = id === 'knife' ? knifeFamily(appearance.knifeStyle) : null;
        // A finish that ships its own model wins over the base weapon model, and
        // for the butterfly variants it decides which knife body loads at all.
        const finishModel = skinModel(family ?? id, appearance.finish);
        if (finishModel) return finishModel;
        // The knife slot is stored as one gameplay weapon, but each cosmetic
        // family has its own authored geometry. Resolve that family first.
        if (family) {
            const familyModel = getWeapon(family)?.modelPath;
            if (isModelPath(familyModel)) return familyModel;
        }
        const manifest = await this.loadManifest();
        const definition = getWeapon(id);
        const declared = role === 'view' ? definition?.viewModelPath
            : role === 'world' ? definition?.worldModelPath : definition?.modelPath;
        if (isModelPath(declared)) return declared;
        const key = family ?? id;
        const record = manifest.assets?.[key];
        if (record && isModelPath(record.model)) return record.model;
        const flat = manifest[key];
        return isModelPath(flat) ? flat : null;
    }
    private template(path: string) {
        let task = this.models.get(path);
        if (!task) {
            task = this.loader.loadAsync(path).then(gltf => ({
                model: gltf.scene,
                anchors: anchorsOf(gltf.scene),
                path,
            })).catch(error => { console.warn(`[WeaponAsset] Failed to load ${path}`, error); return null; });
            this.models.set(path, task);
        }
        return task;
    }
    private async load(id: WeaponId, appearance: WeaponAppearance, role: 'view' | 'preview' | 'world') {
        const family = id === 'knife' ? knifeFamily(appearance.knifeStyle) : null;
        const path = await this.resolvePath(id, role, appearance);
        if (!path) return null;
        const template = await this.template(path);
        if (!template) return null;
        const model = template.model.clone(true);
        const sharedMaterials = new Set<THREE.Material>();
        if (role === 'preview') template.model.traverse(object => {
            if (!(object instanceof THREE.Mesh)) return;
            for (const material of Array.isArray(object.material) ? object.material : [object.material]) sharedMaterials.add(material);
        });
        if (family) {
            if (role === 'view') model.add(weaponHands());
            const finish = knifeFinish(appearance.knifeStyle);
            if (finish) applyKnifeFinish(model, finish);
        }
        else if ((id === 'm4a4' || id === 'rifle') && appearance.rifleSkin === 'asimov') applyWeaponFinish(model, 'asimov');
        else if (getWeapon(id)?.category === 'pistols' && appearance.pistolSkin === 'copper') applyWeaponFinish(model, 'copper');
        if (role === 'preview') {
            // GLTF scene clones share their materials. Only clone unswapped
            // template slots; finish slots are already private to this model.
            model.traverse(object => {
                if (!(object instanceof THREE.Mesh)) return;
                const privateMaterial = (material: THREE.Material) => sharedMaterials.has(material) ? material.clone() : material;
                object.material = Array.isArray(object.material)
                    ? object.material.map(privateMaterial) : privateMaterial(object.material);
            });
            model.userData.previewMaterialsOwned = true;
        }
        const anchors = template.anchors;
        // The view rig and the muzzle flash are driven from authored anchors.
        model.userData.muzzle = anchors.muzzle ?? [0, 0, -.9];
        model.userData.viewmodelAnchor = anchors.viewmodel ?? [0, 0, 0];
        model.userData.leftHandIK = anchors.leftHand;
        model.userData.rightHandIK = anchors.rightHand;
        model.userData.assetPath = path;
        model.userData.appearance = appearanceKey(id, appearance);
        model.userData.weapon = id;
        return model;
    }
    loadView(id: WeaponId, appearance: WeaponAppearance) { return this.load(id, appearance, 'view'); }
    loadPreview(id: WeaponId, appearance: WeaponAppearance) { return this.load(id, appearance, 'preview'); }
    loadWorld(id: WeaponId, appearance: WeaponAppearance) { return this.load(id, appearance, 'world'); }
    async preloadPreview(id: WeaponId, appearance: WeaponAppearance) {
        const path = await this.resolvePath(id, 'preview', appearance);
        if (path) await this.template(path);
    }
    dispose() {
        this.draco.dispose();
        this.models.clear();
    }
}
