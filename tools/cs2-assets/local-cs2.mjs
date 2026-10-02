/**
 * Locates the Counter-Strike 2 install that belongs to the machine running the
 * pipeline.
 *
 * The install path is never hard-coded into application source. Discovery runs
 * in this order and stops at the first hit:
 *
 *   1. config/local-assets.json   (checked in as an example, ignored by git)
 *   2. CS2_INSTALL_PATH / STEAM_PATH environment variables
 *   3. the Steam install path recorded in the Windows registry
 *   4. steamapps/libraryfolders.vdf for every library on every fixed drive
 *
 * The CS2 install is read-only input: nothing in this directory ever writes to
 * it.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const configPath = path.join(repoRoot, 'config', 'local-assets.json');

/** Folder name Steam uses for the game inside a library's `steamapps/common`. */
const APP_FOLDER = 'Counter-Strike Global Offensive';
/** The reworked CS2 tree keeps the Source 2 content under `game/csgo`. */
const VPK_DIR = path.join('game', 'csgo');

export function readJson(file) {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
    catch { return null; }
}

function isFile(file) { try { return fs.statSync(file).isFile(); } catch { return false; } }
function isDir(file) { try { return fs.statSync(file).isDirectory(); } catch { return false; } }

/** `pak01_dir.vpk` present means the Source 2 content packs were installed. */
export function looksLikeCs2(installPath) {
    return !!installPath && isFile(path.join(installPath, VPK_DIR, 'pak01_dir.vpk'));
}

function fromConfig() {
    const saved = readJson(configPath);
    const value = saved?.cs2InstallPath;
    return typeof value === 'string' && looksLikeCs2(value) ? { installPath: value, source: 'config/local-assets.json' } : null;
}

function fromEnvironment() {
    for (const key of ['CS2_INSTALL_PATH', 'CS2_PATH']) {
        const value = process.env[key];
        if (typeof value === 'string' && looksLikeCs2(value)) return { installPath: value, source: `$${key}` };
    }
    return null;
}

function registryValue(key, name) {
    try {
        const out = execFileSync('reg', ['query', key, '/v', name], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
        const line = out.split(/\r?\n/).find(row => row.trim().startsWith(name));
        return line?.split(/\s{2,}/).filter(Boolean).pop()?.trim() ?? null;
    } catch { return null; }
}

function steamRootsFromRegistry() {
    const roots = [];
    for (const [key, name] of [
        ['HKCU\\Software\\Valve\\Steam', 'SteamPath'],
        ['HKLM\\SOFTWARE\\WOW6432Node\\Valve\\Steam', 'InstallPath'],
        ['HKLM\\SOFTWARE\\Valve\\Steam', 'InstallPath'],
    ]) {
        const value = registryValue(key, name);
        if (value) roots.push(value.replace(/\//g, path.sep));
    }
    return roots;
}

/** Steam keeps every library (including extra drives) in this VDF. */
export function libraryRoots(steamRoot) {
    const file = path.join(steamRoot, 'steamapps', 'libraryfolders.vdf');
    const text = (() => { try { return fs.readFileSync(file, 'utf8'); } catch { return null; } })();
    if (!text) return [steamRoot];
    const roots = [...text.matchAll(/"path"\s+"([^"]+)"/g)].map(match => match[1].replace(/\\\\/g, '\\').replace(/\//g, path.sep));
    return roots.length ? roots : [steamRoot];
}

function fromSteamRoots(roots) {
    for (const root of roots) {
        for (const library of libraryRoots(root)) {
            const installPath = path.join(library, 'steamapps', 'common', APP_FOLDER);
            if (looksLikeCs2(installPath)) return { installPath, source: `steam library ${library}` };
        }
    }
    return null;
}

/** Last resort: walk the top levels of every fixed drive for the VPK pack. */
function fromDriveScan() {
    const roots = [];
    for (const letter of 'CDEFGH') {
        for (const candidate of [`${letter}:\\SteamLibrary`, `${letter}:\\Games`, `${letter}:\\Gaming`, `${letter}:\\Steam`]) {
            if (isDir(candidate)) roots.push(candidate);
        }
    }
    return fromSteamRoots(roots);
}

/**
 * Resolve the local CS2 install, or return null with the reasons discovery
 * failed so the caller can print actionable setup instructions.
 */
export function detectCs2({ scan = true } = {}) {
    const hit = fromConfig() ?? fromEnvironment() ?? fromSteamRoots(steamRootsFromRegistry()) ?? (scan ? fromDriveScan() : null);
    if (!hit) return null;
    const { installPath, source } = hit;
    const csgoDir = path.join(installPath, VPK_DIR);
    return {
        installPath: path.resolve(installPath),
        csgoDir,
        vpkPath: path.join(csgoDir, 'pak01_dir.vpk'),
        source,
    };
}

/** Persist a resolved install so later runs skip discovery. Never committed. */
export function writeConfig(install) {
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    const saved = readJson(configPath) ?? {};
    saved.cs2InstallPath = install.installPath.replace(/\\/g, '/');
    if (install.source2viewer) saved.source2viewerCli = install.source2viewer;
    fs.writeFileSync(configPath, `${JSON.stringify(saved, null, 2)}\n`);
    return configPath;
}

/** Where converted, Valve-derived output lands. Ignored by git. */
export const generatedRoot = path.join(repoRoot, 'generated', 'cs2');
/** Public copy the browser loads. Ignored by git; safe to be absent. */
export const publicAssetsRoot = path.join(repoRoot, 'public', 'generated-assets', 'cs2');
/** Manifest the running game reads, alongside the public assets. */
export const publicManifestPath = path.join(publicAssetsRoot, 'manifest.json');
