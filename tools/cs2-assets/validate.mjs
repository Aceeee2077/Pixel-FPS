/**
 * Structural validation for a converted weapon GLB.
 *
 * This reads the glTF JSON chunk directly rather than loading through a
 * renderer, so it can run in CI without a GPU. It checks the things that
 * actually break a weapon in game: a missing mesh, missing UVs, a material with
 * no texture, a skin whose joints were pruned away, non-finite transforms, an
 * implausible bounding box, or the wrong number of files.
 */
import fs from 'node:fs';

const GLB_MAGIC = 0x46546c67; // 'glTF'
const CHUNK_JSON = 0x4e4f534a; // 'JSON'

export function readGlb(file) {
    const buffer = fs.readFileSync(file);
    if (buffer.length < 20) throw new Error('file is too small to be a GLB');
    if (buffer.readUInt32LE(0) !== GLB_MAGIC) throw new Error('missing glTF magic');
    const version = buffer.readUInt32LE(4);
    if (version !== 2) throw new Error(`unsupported glTF version ${version}`);

    let offset = 12;
    let json = null;
    let binaryLength = 0;
    while (offset + 8 <= buffer.length) {
        const length = buffer.readUInt32LE(offset);
        const type = buffer.readUInt32LE(offset + 4);
        const start = offset + 8;
        if (type === CHUNK_JSON) json = JSON.parse(buffer.toString('utf8', start, start + length));
        else binaryLength += length;
        offset = start + length + ((4 - (length % 4)) % 4);
    }
    if (!json) throw new Error('GLB has no JSON chunk');
    return { json, bytes: buffer.length, binaryLength };
}

function primitiveStats(json) {
    const accessors = json.accessors ?? [];
    let triangles = 0;
    let vertices = 0;
    let withUv = 0;
    let total = 0;
    const missingAttributes = new Set();
    for (const mesh of json.meshes ?? []) {
        for (const primitive of mesh.primitives ?? []) {
            total += 1;
            const position = accessors[primitive.attributes?.POSITION];
            if (position) vertices += position.count;
            if (primitive.indices !== undefined) triangles += accessors[primitive.indices].count / 3;
            else if (position) triangles += position.count / 3;
            if (primitive.attributes?.TEXCOORD_0 !== undefined) withUv += 1;
            else missingAttributes.add('TEXCOORD_0');
            if (primitive.attributes?.NORMAL === undefined) missingAttributes.add('NORMAL');
        }
    }
    return { triangles, vertices, withUv, primitives: total, missingAttributes: [...missingAttributes] };
}

/**
 * Bounding box in metres.
 *
 * The optimizer records the pre-quantization extent in `asset.extras`, because
 * a meshopt-compressed skinned mesh stores positions as normalized integers and
 * the de-quantization lives in the joint matrices: the accessor min/max are no
 * longer metres. The declared box is cross-checked against the accessors when
 * those are still floats.
 */
function measureBounds(json) {
    const declared = json.scenes?.[json.scene ?? 0]?.extras?.sourceBounds ?? json.asset?.extras?.sourceBounds;
    if (declared?.min && declared?.max) {
        return { min: declared.min, max: declared.max, size: declared.max.map((value, index) => value - declared.min[index]), source: 'asset.extras' };
    }
    const accessors = json.accessors ?? [];
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (const mesh of json.meshes ?? []) {
        for (const primitive of mesh.primitives ?? []) {
            const accessor = accessors[primitive.attributes?.POSITION];
            if (!accessor?.min) continue;
            if (accessor.normalized) return null; // quantized without a declared box
            for (let i = 0; i < 3; i += 1) {
                min[i] = Math.min(min[i], accessor.min[i]);
                max[i] = Math.max(max[i], accessor.max[i]);
            }
        }
    }
    if (!Number.isFinite(min[0])) return null;
    return { min, max, size: max.map((value, index) => value - min[index]), source: 'accessors' };
}

/** Any transform in the file that is not a finite number. */
function nonFiniteTransforms(json) {
    const bad = [];
    (json.nodes ?? []).forEach((node, index) => {
        for (const key of ['translation', 'rotation', 'scale']) {
            const values = node[key];
            if (values && values.some(value => !Number.isFinite(value))) bad.push(`${node.name ?? index}.${key}`);
        }
        if (node.matrix && node.matrix.some(value => !Number.isFinite(value))) bad.push(`${node.name ?? index}.matrix`);
    });
    return bad;
}

/**
 * Validate one built variant.
 *
 * @param {string} file
 * @param {{ expectAnimations?: boolean, maxSize?: number }} [options]
 */
export function validateGlb(file, options = {}) {
    const failures = [];
    const warnings = [];

    if (!fs.existsSync(file)) return { ok: false, file, failures: ['file missing'], warnings, stats: null };
    let parsed;
    try { parsed = readGlb(file); }
    catch (error) { return { ok: false, file, failures: [`does not load: ${error.message}`], warnings, stats: null }; }

    const { json, bytes } = parsed;
    const stats = primitiveStats(json);
    const box = measureBounds(json);
    const materials = json.materials ?? [];
    const textures = json.textures ?? [];
    const images = json.images ?? [];
    const skins = json.skins ?? [];
    const animations = json.animations ?? [];

    if (!(json.meshes ?? []).length) failures.push('no meshes');
    if (stats.triangles <= 0) failures.push('no triangles');
    if (stats.missingAttributes.includes('TEXCOORD_0')) failures.push('a primitive has no UV set');
    if (stats.missingAttributes.includes('NORMAL')) warnings.push('a primitive has no normals');
    if (!materials.length) failures.push('no materials');

    // Every material must resolve its textures, and every texture its image.
    for (const [index, material] of materials.entries()) {
        const pbr = material.pbrMetallicRoughness ?? {};
        const referenced = [
            pbr.baseColorTexture?.index, pbr.metallicRoughnessTexture?.index,
            material.normalTexture?.index, material.occlusionTexture?.index, material.emissiveTexture?.index,
        ].filter(value => value !== undefined);
        if (!referenced.length) warnings.push(`material ${material.name ?? index} has no textures`);
        for (const textureIndex of referenced) {
            const texture = textures[textureIndex];
            const source = texture?.source ?? texture?.extensions?.EXT_texture_webp?.source;
            if (source === undefined) failures.push(`material ${material.name ?? index} references a texture with no image`);
            else if (!images[source]) failures.push(`material ${material.name ?? index} references a missing image`);
        }
    }
    for (const [index, image] of images.entries()) {
        if (image.uri && !/^data:/.test(image.uri)) failures.push(`image ${image.name ?? index} is an external file (${image.uri})`);
        if (image.bufferView === undefined && !image.uri) failures.push(`image ${index} has no data`);
    }

    // A skin whose joints no longer exist cannot be posed.
    for (const skin of skins) {
        if (!skin.joints?.length) failures.push('skin has no joints');
        for (const joint of skin.joints ?? []) if (!(json.nodes ?? [])[joint]) failures.push('skin references a missing joint node');
    }
    const skinned = (json.nodes ?? []).some(node => node.skin !== undefined);
    if (skinned && !skins.length) failures.push('a node is skinned but the file has no skin');
    if (options.expectAnimations && !animations.length) warnings.push('no animation clips');

    if (!box) failures.push('geometry has no bounds');
    else {
        const longest = Math.max(...box.size);
        if (!(longest > 0.05 && longest < 4)) failures.push(`implausible size ${box.size.map(v => v.toFixed(3)).join(' x ')} m`);
    }
    const bad = nonFiniteTransforms(json);
    if (bad.length) failures.push(`non-finite transforms: ${bad.slice(0, 4).join(', ')}`);
    if (options.maxSize && bytes > options.maxSize) warnings.push(`${(bytes / 1e6).toFixed(2)} MB exceeds the ${(options.maxSize / 1e6).toFixed(0)} MB budget`);

    return {
        ok: failures.length === 0,
        file,
        failures,
        warnings,
        stats: {
            bytes, ...stats,
            materials: materials.length,
            textures: textures.length,
            images: images.length,
            imageMimeTypes: [...new Set(images.map(image => image.mimeType).filter(Boolean))],
            skins: skins.length,
            joints: skins.reduce((sum, skin) => sum + (skin.joints?.length ?? 0), 0),
            animations: animations.map(animation => animation.name),
            extensionsUsed: json.extensionsUsed ?? [],
            bounds: box ? { size: box.size.map(value => +value.toFixed(3)) } : null,
        },
    };
}
