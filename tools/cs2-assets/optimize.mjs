/**
 * Turns one raw Source 2 Viewer export into the two files the game loads.
 *
 * Nothing here changes the model's shape: no remeshing, no retopology, no
 * proportion edits. The only operations are
 *
 *   - selecting which authored mesh group is the viewmodel and which is the
 *     world model (CS2 ships `body_hd` and `body_legacy` side by side),
 *   - dropping what the selected group does not reference,
 *   - re-encoding the original textures to WebP, capped at a configurable
 *     resolution, and
 *   - optional meshopt vertex compression.
 *
 * UV sets, material slots, skin weights, bone hierarchy and animation clips are
 * passed through untouched.
 */
import fs from 'node:fs';
import path from 'node:path';
import { dedup, getBounds, meshopt, prune } from '@gltf-transform/functions';
import { Logger } from '@gltf-transform/core';
import sharp from 'sharp';
import { MESH_VARIANTS } from './weapons.mjs';
import { gltfIO } from './io.mjs';

/** Triangle count of a mesh, used to rank variants when names are unfamiliar. */
function triangleCount(mesh) {
    let total = 0;
    for (const primitive of mesh.listPrimitives()) {
        const indices = primitive.getIndices();
        const position = primitive.getAttribute('POSITION');
        total += indices ? indices.getCount() / 3 : (position?.getCount() ?? 0) / 3;
    }
    return total;
}

/** Last dotted segment of a mesh name: `…vmdl_c.body_hd` -> `body_hd`. */
function variantKey(mesh) {
    return mesh.getName().split('.').pop().toLowerCase();
}

/**
 * Keep one authored mesh group.
 *
 * Preference order: an exact variant key match, then the highest/lowest
 * triangle count depending on the role. Unknown naming still resolves to a
 * sensible choice instead of leaving two overlapping bodies in the scene.
 */
function selectVariant(document, role) {
    const meshes = document.getRoot().listMeshes().filter(mesh => mesh.listPrimitives().length > 0);
    if (!meshes.length) return { kept: null, keptTris: 0, groups: [] };

    const preferences = MESH_VARIANTS[role] ?? [];
    const groups = meshes.map(mesh => ({ name: mesh.getName(), key: variantKey(mesh), tris: triangleCount(mesh) }));
    let kept = preferences.map(pref => meshes.find(mesh => variantKey(mesh) === pref)).find(Boolean);
    if (!kept) {
        const sorted = [...meshes].sort((a, b) => triangleCount(b) - triangleCount(a));
        kept = role === 'view' ? sorted[0] : sorted[sorted.length - 1];
    }

    // A node that draws the same mesh as another is a duplicate body; drop the
    // ones we are not keeping. Joint/attachment nodes carry no mesh, so the
    // skeleton survives.
    for (const node of document.getRoot().listNodes()) {
        const mesh = node.getMesh();
        if (mesh && mesh !== kept) node.dispose();
    }
    for (const mesh of meshes) if (mesh !== kept) mesh.dispose();

    return { kept: kept.getName(), keptTris: triangleCount(kept), groups };
}

/**
 * Re-encode every texture to WebP, capped at `maxTexture` on the long edge.
 *
 * Done directly through sharp rather than glTF Transform's texture compressor:
 * the Source 2 PNGs are 2k/4k colour, normal and ORM maps with no ICC profile,
 * and sharp's own resize keeps every channel untouched while producing a much
 * smaller file. The model stays a single GLB with the images embedded.
 */
async function optimizeTextures(document, { maxTexture, quality }) {
    for (const texture of document.getRoot().listTextures()) {
        const image = texture.getImage();
        if (!image?.byteLength) continue;
        const pipeline = sharp(Buffer.from(image));
        const meta = await pipeline.metadata();
        const longest = Math.max(meta.width ?? 0, meta.height ?? 0);
        const resize = maxTexture && longest > maxTexture ? [maxTexture, maxTexture] : null;
        if (!resize && texture.getMimeType() === 'image/webp') continue;
        const encoded = await (resize
            ? sharp(Buffer.from(image)).resize(resize[0], resize[1], { fit: 'inside', withoutEnlargement: true })
            : sharp(Buffer.from(image))).webp({ quality, effort: 5 }).toBuffer();
        texture.setImage(new Uint8Array(encoded)).setMimeType('image/webp');
    }
}

function textureSummary(document) {
    const images = document.getRoot().listTextures();
    let bytes = 0;
    const dimensions = [];
    for (const texture of images) {
        const image = texture.getImage();
        bytes += image?.byteLength ?? 0;
        const size = texture.getSize();
        if (size) dimensions.push(`${texture.getName() || 'texture'} ${size[0]}x${size[1]}`);
    }
    return { count: images.length, bytes, dimensions };
}

/**
 * Build one GLB from a raw exporter output.
 *
 * @param {object} options
 * @param {string} options.sourceGlb  raw export from Source 2 Viewer
 * @param {string} options.output     destination .glb
 * @param {'view'|'world'} options.role
 */
export async function buildVariant({ sourceGlb, output, role, maxTexture = 2048, textureQuality = 90, compress = true }) {
    const io = await gltfIO();
    const document = await io.read(sourceGlb);
    // The prune/quantize notes are routine; failures are reported by validate.
    document.setLogger(new Logger(Logger.Verbosity.SILENT));
    const selection = selectVariant(document, role);
    if (!selection.kept) throw new Error(`${path.basename(sourceGlb)} has no mesh to export`);

    await document.transform(dedup(), prune());
    await optimizeTextures(document, { maxTexture, quality: textureQuality });

    // Measure before meshopt runs. Quantization stores positions as normalized
    // integers, and for a skinned mesh the de-quantization lives in the joint
    // matrices rather than the node, so the accessor bounds stop being metres
    // once the file is compressed. The real extent has to be captured here and
    // carried in the asset extras for the validator and the manifest.
    const scene = document.getRoot().getDefaultScene() ?? document.getRoot().listScenes()[0];
    const measured = scene ? getBounds(scene) : null;
    const sourceBounds = measured
        ? { min: measured.min.map(value => +value.toFixed(4)), max: measured.max.map(value => +value.toFixed(4)) }
        : null;
    if (sourceBounds) {
        const node = document.getRoot().getDefaultScene() ?? document.getRoot().listScenes()[0];
        node?.setExtras({ ...(node.getExtras() ?? {}), sourceBounds });
    }

    const encoder = compress ? await loadMeshoptEncoder(io) : null;
    // The transform needs the encoder for its internal reorder pass, and the
    // writer resolves the same module through the IO dependency registry.
    if (encoder) await document.transform(meshopt({ encoder, level: 'medium' }));

    fs.mkdirSync(path.dirname(output), { recursive: true });
    await io.write(output, document);

    const root = document.getRoot();
    const stats = {
        role,
        file: output,
        bytes: fs.statSync(output).size,
        mesh: selection.kept,
        meshGroups: selection.groups,
        triangles: selection.keptTris,
        materials: root.listMaterials().map(material => material.getName()),
        textures: textureSummary(document),
        animations: root.listAnimations().map(animation => animation.getName()),
        joints: root.listSkins().reduce((sum, skin) => sum + skin.listJoints().length, 0),
        compressed: !!encoder,
        bounds: sourceBounds
            ? { min: sourceBounds.min, max: sourceBounds.max, size: sourceBounds.max.map((value, index) => +(value - sourceBounds.min[index]).toFixed(4)) }
            : null,
    };
    return stats;
}

/**
 * Meshopt's encoder is a WebAssembly module that has to be initialised before
 * use. Loaded lazily so a missing optional dependency degrades to uncompressed
 * output instead of failing the whole weapon.
 */
let meshoptEncoder;
async function loadMeshoptEncoder(io) {
    if (meshoptEncoder !== undefined) return meshoptEncoder;
    try {
        const module = await import('meshoptimizer');
        meshoptEncoder = module.MeshoptEncoder ?? null;
    } catch {
        meshoptEncoder = null;
    }
    return meshoptEncoder;
}
