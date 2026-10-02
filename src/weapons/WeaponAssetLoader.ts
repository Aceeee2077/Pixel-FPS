import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import type { WeaponId } from './WeaponConfig';
import { canonicalWeaponId, getWeapon } from '../data/weapons';
import { KNIFE_GRIP_ALONG, KNIFE_MODEL_SCALE, weaponHands } from './WeaponModel';
import { appearanceKey, knifeStyleModel, skinModel, type WeaponAppearance } from './WeaponAppearance';
import { applyKnifeFinish } from './skins/KnifeMaterialFactory';
import { knifeFamily, knifeFinish } from './skins/KnifeSkinConfig';
import { applyWeaponFinish } from '../data/weaponFinishes';
import { cs2Asset, cs2ModelLength, type Cs2WeaponAsset } from '../data/cs2Assets';

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
        // Assets converted from Counter-Strike 2 use meshopt so a full PBR
        // weapon stays around 2 MB. The decoder is a no-op for the rest.
        this.loader.setMeshoptDecoder(MeshoptDecoder);
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
        // FFA keeps the legacy alias ids ('rifle', 'sniper'), so the finish has to
        // be looked up under the weapon it stands for.
        const finishModel = skinModel(family ?? canonicalWeaponId(id), appearance.finish);
        if (finishModel) return finishModel;
        // An owner-supplied blade is keyed by the knife *style* rather than by a
        // weapon finish, because the style is what the loadout and the collection
        // persist. It replaces the family's authored body.
        const styleModel = id === 'knife' ? knifeStyleModel(appearance.knifeStyle) : null;
        if (styleModel) return styleModel;
        // Models converted from the user's own Counter-Strike 2 install take
        // precedence over this project's hand-authored stand-ins. Owner-supplied
        // finishes above still win, because those are deliberate choices.
        const converted = await this.convertedAsset(id, appearance);
        if (converted) return role === 'view' ? converted.view : converted.world;
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
    /**
     * The converted CS2 asset for a weapon, when `npm run assets:cs2` has been
     * run on this machine. Returns null on a fresh clone.
     */
    private async convertedAsset(id: WeaponId, appearance: WeaponAppearance): Promise<Cs2WeaponAsset | null> {
        const family = id === 'knife' ? knifeFamily(appearance.knifeStyle) : null;
        const key = family ?? canonicalWeaponId(id);
        const asset = await cs2Asset(key);
        return asset?.view ? asset : null;
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
        // Converted Counter-Strike 2 assets carry the same rig contract as the
        // project's own models, with two differences handled below: blades are
        // authored Y-forward, and the parts sit at true life size.
        const converted = path.startsWith('/generated-assets/cs2/');
        const template = await this.template(path);
        if (!template) return null;
        // `Object3D.clone()` copies a SkinnedMesh's *reference* to its skeleton,
        // so every clone would keep driving the cached template's bones - which
        // never move with the viewmodel rig. SkeletonUtils rebinds a private
        // skeleton per instance, which is what makes a skinned CS2 model follow
        // the camera instead of staying at the world origin.
        const model = cloneSkinned(template.model) as THREE.Group;
        const sharedMaterials = new Set<THREE.Material>();
        if (role === 'preview') template.model.traverse(object => {
            if (!(object instanceof THREE.Mesh)) return;
            for (const material of Array.isArray(object.material) ? object.material : [object.material]) sharedMaterials.add(material);
        });
        // Every melee slot is held, including the classic combat knife, whose
        // style has no folded-blade family of its own.
        const melee = id === 'knife';
        let root = model;
        // Counter-Strike 2 authors firearms pointing down +Z with the origin at
        // the grip; this project's rig drives everything down -Z. A half turn
        // about Y reconciles the two without touching a single vertex. Blades
        // are handled below, because theirs is the other axis.
        //
        // The turn lives on the child, inside a wrapper, because the first-person
        // rig writes `view.rotation` every frame and would otherwise overwrite it.
        if (converted && !melee) {
            model.rotation.y = Math.PI;
            root = new THREE.Group();
            root.name = 'ConvertedRoot';
            root.add(model);
        }
        if (melee) {
            // CS2 knives run down their own +Y with the blade up; the first-person
            // rig drives everything down -Z. A quarter turn about X maps one to
            // the other without touching the geometry.
            if (converted) model.rotation.x = -Math.PI / 2;
            if (role === 'view') root = this.mountInHands(model);
            // The procedural gem finishes tint this project's own authored
            // bodies. An owner-supplied blade carries its own paint, so tinting
            // it would paint over the model the project owner supplied.
            const finish = path === getWeapon(family ?? 'knife')?.modelPath ? knifeFinish(appearance.knifeStyle) : null;
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
        // The view rig and the muzzle flash are driven from authored anchors,
        // which are written in the weapon's space. Once the blade hangs off the
        // hands, the root is the arms, so re-express them on that root.
        const onRoot = (values?: number[]) => {
            if (!values) return undefined;
            const point = new THREE.Vector3(values[0], values[1], values[2]);
            return model.localToWorld(point).toArray() as [number, number, number];
        };
        // How far the model reaches behind its own origin, and how far forward of
        // it the muzzle sits. The rig uses both to keep a long viewmodel - a
        // sniper's stock - in front of the camera instead of letting the near
        // plane slice it off.
        const box = new THREE.Box3().setFromObject(root);
        // Converted models carry no authored Muzzle node, so the flash goes to
        // the front of the mesh rather than to a fixed guess that would sit
        // short on a long rifle.
        const fallbackMuzzle: [number, number, number] = converted
            ? [0, (box.min.y + box.max.y) / 2, box.min.z]
            : [0, 0, -.9];
        root.userData.muzzle = onRoot(anchors.muzzle) ?? fallbackMuzzle;
        // A first-person weapon is always in front of the camera, and a skinned
        // mesh's bounding sphere is computed from its quantized bind-pose vertex
        // data, which says nothing about where the skeleton puts it. Culling on
        // that sphere is both useless and wrong here.
        root.traverse(object => { if (object instanceof THREE.Mesh) object.frustumCulled = false; });
        // A converted model's `ViewmodelAnchor` belongs to Source 2's own
        // first-person rig, which holds weapons at the centre of the screen.
        // Honouring it here would cancel this rig's lower-right offset, so it is
        // ignored; only the muzzle position is reused.
        root.userData.viewmodelAnchor = converted ? [0, 0, 0] : (onRoot(anchors.viewmodel) ?? [0, 0, 0]);
        root.userData.leftHandIK = converted ? undefined : onRoot(anchors.leftHand);
        root.userData.rightHandIK = converted ? undefined : onRoot(anchors.rightHand);
        root.userData.assetPath = path;
        root.userData.converted = converted;
        let rearZ = box.max.z;
        if (converted) {
            // A converted model's bounds come from the pipeline, not from a
            // runtime Box3: a meshopt-quantized skinned mesh reports its
            // normalized bind pose, not the metres the skeleton puts it at.
            const asset = await this.convertedAsset(id, appearance);
            root.userData.modelLength = cs2ModelLength(asset ?? undefined) ?? undefined;
            // The model is turned to face -Z below, so the stock - the model's
            // own -Z end - becomes the +Z end the rig measures.
            const minZ = asset?.bounds?.min?.[2];
            if (typeof minZ === 'number') rearZ = Math.max(0, -minZ);
            // Source 2 pivots a weapon on its grip axis down in the magazine
            // well, so the body sits well above the origin. This rig expects the
            // origin near the middle of the gun, so the model is moved onto it
            // rather than the pose being special-cased per weapon.
            const bounds = asset?.bounds;
            if (bounds && !melee) {
                model.position.x -= (bounds.min[0] + bounds.max[0]) / 2;
                model.position.y -= (bounds.min[1] + bounds.max[1]) / 2;
            }
        }
        root.userData.appearance = appearanceKey(id, appearance);
        root.userData.weapon = id;
        root.userData.rearZ = rearZ;
        return root;
    }
    /**
     * Mount a blade the way modern shooters mount a viewmodel: the arms and the
     * weapon are siblings under one root, and the arms are positioned so the
     * fist closes on the grip socket. The weapon keeps its own origin at the
     * rig's present position, so the blade stays where the rig was tuned to put
     * it, and only the arms move onto it.
     *
     * Welding the hands *into* the weapon (the old behaviour) tied the fist to
     * the weapon's origin: any model whose origin was not exactly on the grip
     * drew its fist over the blade and read as "the knife is stuck to the arm".
     */
    private mountInHands(model: THREE.Group) {
        const root = new THREE.Group();
        root.name = 'ViewmodelRoot';
        // Same held-scale correction the procedural blades use, so a supplied
        // GLB and the fallback silhouette agree in the fist.
        model.scale.multiplyScalar(KNIFE_MODEL_SCALE);
        const hands = weaponHands();
        const socket = hands.getObjectByName('GripSocket') ?? hands;
        hands.position.set(
            -socket.position.x,
            -socket.position.y,
            -socket.position.z + KNIFE_GRIP_ALONG);
        root.add(hands, model);
        return root;
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
