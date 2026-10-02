/**
 * Shared glTF Transform IO.
 *
 * Registered with every extension glTF Transform ships plus meshopt's encoder
 * and decoder. The decoder is required to *read* the compressed models this
 * pipeline writes, and the encoder to write them; both live behind the same
 * dependency registry in glTF Transform v4.
 */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';

let io;

export async function gltfIO() {
    if (io) return io;
    const instance = new NodeIO().registerExtensions(ALL_EXTENSIONS);
    try {
        const { MeshoptEncoder, MeshoptDecoder } = await import('meshoptimizer');
        if (MeshoptEncoder) await MeshoptEncoder.ready;
        if (MeshoptDecoder) await MeshoptDecoder.ready;
        instance.registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
    } catch {
        // Without meshoptimizer the pipeline still runs; it just writes
        // uncompressed models. Reported by `pipeline.mjs`.
    }
    io = instance;
    return io;
}

/** True when meshopt is available, so callers can report compression state. */
export async function meshoptAvailable() {
    try {
        const { MeshoptEncoder } = await import('meshoptimizer');
        return !!MeshoptEncoder;
    } catch { return false; }
}
