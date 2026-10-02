/**
 * Thin wrapper around the Source 2 Viewer CLI.
 *
 * The CLI is the only external tool in the pipeline: it decodes `.vmdl_c` /
 * `.vmat_c` / `.vtex_c` and writes glTF plus PNG. Everything else (indexing,
 * pruning, texture compression, validation, manifests) is done in Node.
 *
 * The CS2 install is passed as read-only input and is never written to.
 */
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { cliPath, isInstalled, probe } from '../source2viewer/setup.mjs';
import { readJson, configPath } from './local-cs2.mjs';

const run = promisify(execFile);

/** Installed CLI, or one pointed at by config/local-assets.json. */
export function resolveCli() {
    const configured = readJson(configPath)?.source2viewerCli;
    for (const candidate of [configured, cliPath()].filter(Boolean)) {
        if (fs.existsSync(candidate)) return candidate;
    }
    return null;
}

export function requireCli() {
    const cli = resolveCli();
    if (cli) return cli;
    throw new Error(
        'Source 2 Viewer CLI is not installed.\n' +
        '  Run: node tools/source2viewer/setup.mjs\n' +
        '  (or set "source2viewerCli" in config/local-assets.json)');
}

export function cliStatus() {
    const cli = resolveCli();
    if (!cli) return { installed: false, path: null, help: '' };
    const result = probe(cli);
    return { installed: result.ok, path: cli, help: result.help ?? '', reason: result.reason };
}

/**
 * Export one resource out of the game's VPK as glTF/GLB.
 *
 * `--game gameinfo.gi` is what lets the tool resolve the material, texture and
 * shader dependencies through the game's own search paths, so the exported
 * materials carry the original texture set.
 */
export async function exportResource({ cli, vpkPath, gameInfo, resource, outDir, format = 'glb', animations = true, timeout = 600_000 }) {
    fs.mkdirSync(outDir, { recursive: true });
    const args = [
        '-i', vpkPath,
        '--game', gameInfo,
        '-f', resource,
        '--gltf_export_format', format,
        '--gltf_export_materials',
        '--gltf_textures_adapt',
        '-d',
        '-o', outDir,
    ];
    if (animations) args.push('--gltf_export_animations');

    try {
        const { stdout, stderr } = await run(cli, args, { timeout, maxBuffer: 64 * 1024 * 1024, windowsHide: true });
        return { ok: true, log: `${stdout}${stderr}` };
    } catch (error) {
        // A non-zero exit is still useful when the file was written; the caller
        // checks the output directory and only fails when nothing landed.
        return { ok: false, log: `${error?.stdout ?? ''}${error?.stderr ?? ''}`, error: String(error?.message ?? error) };
    }
}

/** Every file the exporter produced under `dir`, as repo-relative slash paths. */
export function listExported(dir) {
    const out = [];
    const walk = current => {
        for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
            const full = path.join(current, entry.name);
            if (entry.isDirectory()) walk(full);
            else out.push(full);
        }
    };
    if (fs.existsSync(dir)) walk(dir);
    return out;
}

/** The model GLB the exporter wrote, ignoring the `_physics` companion. */
export function mainGlb(dir, expectedName) {
    const files = listExported(dir).filter(file => file.endsWith('.glb') && !/_physics\.glb$/.test(file));
    if (!files.length) return null;
    const exact = files.find(file => path.basename(file) === `${expectedName}.glb`);
    return exact ?? files.sort((a, b) => fs.statSync(b).size - fs.statSync(a).size)[0];
}
