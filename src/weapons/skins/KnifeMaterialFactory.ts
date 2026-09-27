import * as THREE from 'three';
import type { KnifeFinish } from './KnifeSkinConfig';

const cache = new Map<KnifeFinish, THREE.MeshPhysicalMaterial>();
const clamp = (value: number) => Math.max(0, Math.min(255, Math.round(value)));
const noise = (x: number, y: number) => {
    const value = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
    return value - Math.floor(value);
};

/** Small repeatable procedural PBR maps; no reference PNG is used as a diffuse texture. */
function texture(finish: KnifeFinish) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    const context = canvas.getContext('2d')!;
    const pixels = context.createImageData(256, 256);
    for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
        const u = x / 255, v = y / 255;
        const grain = noise(Math.floor(x / 7), Math.floor(y / 7)) * .35 + noise(x, y) * .08;
        let color: [number, number, number];
        if (finish === 'fade') {
            const stops: [number, number, number][] = [[91, 43, 156], [182, 40, 137], [202, 41, 71], [227, 106, 37], [238, 180, 59]];
            const phase = Math.min(.999, Math.max(0, v * .78 + u * .22));
            const index = Math.floor(phase * 4), t = phase * 4 - index;
            color = [0, 1, 2].map(i => stops[index][i] * (1 - t) + stops[index + 1][i] * t) as [number, number, number];
            color = color.map(value => value + (grain - .2) * 25) as [number, number, number];
        } else {
            const veins = Math.sin(u * 29 + Math.sin(v * 24) * 3) * Math.sin(v * 38 - u * 11);
            const crystal = Math.max(0, veins * .45 + grain);
            color = finish === 'emerald'
                ? [10 + crystal * 56, 73 + crystal * 139, 69 + crystal * 97]
                : [91 + crystal * 161, 8 + crystal * 47, 25 + crystal * 65];
        }
        const offset = (y * 256 + x) * 4;
        pixels.data[offset] = clamp(color[0]);
        pixels.data[offset + 1] = clamp(color[1]);
        pixels.data[offset + 2] = clamp(color[2]);
        pixels.data[offset + 3] = 255;
    }
    context.putImageData(pixels, 0, 0);
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.anisotropy = 4;
    map.generateMipmaps = true;
    return map;
}

export function knifeMaterial(finish: KnifeFinish) {
    let material = cache.get(finish);
    if (!material) {
        material = new THREE.MeshPhysicalMaterial({
            color: 0xffffff,
            map: texture(finish),
            metalness: finish === 'fade' ? .82 : .88,
            roughness: finish === 'fade' ? .22 : .25,
            clearcoat: finish === 'fade' ? .3 : .28,
            clearcoatRoughness: .1,
            envMapIntensity: 1.25,
        });
        cache.set(finish, material);
    }
    return material;
}

/** Material slots the Blender export names for the gem finish (see weapons/*.py). */
const SKIN_SLOT = /skin_?slot|blade|inlay/i;

function isSkinSlot(material: THREE.Material) {
    const name = material.name || '';
    return SKIN_SLOT.test(name) && !/steel|screw|pivot|guard|pommel|latch|ring|serration/i.test(name);
}

/**
 * Authored knife GLBs merge by material, so object names are unreliable. The
 * finish is applied per material slot instead: any material the Blender module
 * marked as a blade / grip / inlay slot receives the procedural gem material.
 */
export function applyKnifeFinish(root: THREE.Object3D, finish: KnifeFinish) {
    const skin = knifeMaterial(finish);
    const swapped = new Map<THREE.Material, THREE.Material>();
    let applied = 0;
    root.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return;
        const list = Array.isArray(object.material) ? object.material : [object.material];
        if (/^(Handle|Grip)/i.test(object.name)) {
            const neutral = list.map(material => {
                const copy = material.clone();
                if (copy instanceof THREE.MeshStandardMaterial) {
                    copy.map = null;
                    copy.color.set(0x303638);
                    copy.metalness = .38;
                    copy.roughness = .52;
                }
                return copy;
            });
            object.material = Array.isArray(object.material) ? neutral : neutral[0];
            return;
        }
        const next = list.map(material => {
            if (!isSkinSlot(material) || /handle|grip|pivot|screw|latch|guard|pommel|washer/i.test(object.name)) return material;
            applied++;
            if (!swapped.has(material)) swapped.set(material, skin.clone());
            return swapped.get(material)!;
        });
        object.material = Array.isArray(object.material) ? next : next[0];
    });
    // Legacy procedural knives name their objects instead of their slots.
    if (!applied) {
        root.traverse(object => {
            if (!(object instanceof THREE.Mesh)) return;
            if (object.name === 'Blade' || object.name.startsWith('Inlay'))
                object.material = skin.clone();
        });
    }
}
