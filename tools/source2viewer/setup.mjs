/**
 * Installs Source 2 Viewer's CLI (ValveResourceFormat) into
 * `tools/source2viewer/bin`.
 *
 * ValveResourceFormat is the community-standard open-source converter for
 * Source 2 resources; it is what turns `.vmdl_c` / `.vmat_c` / `.vtex_c` into
 * glTF plus PNG. It is a build tool, not a game asset, and it is fetched from
 * its own official GitHub releases.
 *
 * Nothing here touches the Counter-Strike 2 installation.
 *
 *   node tools/source2viewer/setup.mjs            # install if missing
 *   node tools/source2viewer/setup.mjs --force    # reinstall
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const binDir = path.join(here, 'bin');
const repo = 'ValveResourceFormat/ValveResourceFormat';
const releases = `https://api.github.com/repos/${repo}/releases`;

const EXE = process.platform === 'win32' ? 'Source2Viewer-CLI.exe' : 'Source2Viewer-CLI';

/** Release asset that matches this machine. */
function assetForPlatform() {
    const arch = process.arch === 'arm64' ? 'arm64' : 'x64';
    const os = process.platform === 'win32' ? 'windows' : process.platform === 'darwin' ? 'macos' : 'linux';
    return `cli-${os}-${arch}.zip`;
}

export function cliPath() { return path.join(binDir, EXE); }
export function isInstalled() { return fs.existsSync(cliPath()); }

/** `--version` plus a `--help` probe; a zero exit means the binary runs here. */
export function probe(file = cliPath()) {
    if (!fs.existsSync(file)) return { ok: false, reason: 'not installed' };
    try {
        const help = execFileSync(file, ['--help'], { encoding: 'utf8', timeout: 60_000 });
        return { ok: true, help };
    } catch (error) {
        const output = `${error?.stdout ?? ''}${error?.stderr ?? ''}`;
        // Some builds exit non-zero for --help while still printing usage.
        if (output.trim().length > 0) return { ok: true, help: output };
        return { ok: false, reason: String(error?.message ?? error) };
    }
}

async function fetchJson(url) {
    const response = await fetch(url, { headers: { 'user-agent': 'blockstrike-asset-pipeline' } });
    if (!response.ok) throw new Error(`${url} -> HTTP ${response.status}`);
    return response.json();
}

/** Download the release zip and unpack it next to the CLI. */
/**
 * Unpack a zip with whatever the host actually has. `tar` (bsdtar, shipped
 * with Windows 10+) is tried first because PowerShell's Archive module is not
 * available in every session.
 */
function unzip(zipPath, destination) {
    const attempts = process.platform === 'win32' ? [
        ['tar', ['-xf', zipPath, '-C', destination]],
        ['powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
            `Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::ExtractToDirectory('${zipPath}','${destination}',$true)`]],
        ['powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
            `Expand-Archive -LiteralPath '${zipPath}' -DestinationPath '${destination}' -Force`]],
    ] : [['unzip', ['-o', '-q', zipPath, '-d', destination]]];

    const failures = [];
    for (const [command, args] of attempts) {
        try {
            execFileSync(command, args, { stdio: 'pipe' });
            return;
        } catch (error) {
            failures.push(`${command}: ${String(error?.stderr ?? error?.message ?? error).split(/\r?\n/)[0]}`);
        }
    }
    throw new Error(`could not unpack ${path.basename(zipPath)}\n${failures.join('\n')}`);
}

export async function installSource2Viewer(tag = 'latest') {
    const release = tag === 'latest'
        ? await fetchJson(`${releases}/latest`)
        : await fetchJson(`${releases}/tags/${tag}`);
    const assetName = assetForPlatform();
    const asset = release.assets?.find(entry => entry.name === assetName);
    if (!asset) throw new Error(`release ${release.tag_name} has no ${assetName}`);

    fs.mkdirSync(binDir, { recursive: true });
    const zipPath = path.join(binDir, assetName);
    console.log(`[source2viewer] downloading ${release.tag_name} / ${assetName} (${(asset.size / 1e6).toFixed(1)} MB)`);
    const response = await fetch(asset.browser_download_url, { headers: { 'user-agent': 'blockstrike-asset-pipeline' } });
    if (!response.ok) throw new Error(`download failed: HTTP ${response.status}`);
    fs.writeFileSync(zipPath, Buffer.from(await response.arrayBuffer()));

    console.log('[source2viewer] unpacking');
    unzip(zipPath, binDir);
    fs.rmSync(zipPath, { force: true });

    if (process.platform !== 'win32') {
        for (const entry of fs.readdirSync(binDir)) {
            if (entry.startsWith('Source2Viewer')) fs.chmodSync(path.join(binDir, entry), 0o755);
        }
    }
    return release.tag_name;
}

/**
 * Command-line entry point. Kept behind an entry check so the pipeline can
 * import `cliPath` / `probe` without triggering an install.
 */
async function runInstaller() {
    const force = process.argv.includes('--force');
    const tagArg = process.argv.find(arg => arg.startsWith('--tag='));
    const wanted = tagArg ? tagArg.slice('--tag='.length) : 'latest';

    if (isInstalled() && !force) {
        const result = probe();
        if (result.ok) {
            console.log(`[source2viewer] already installed at ${cliPath()}`);
            return;
        }
        console.log(`[source2viewer] existing binary did not run (${result.reason}); reinstalling`);
    }

    const installedTag = await installSource2Viewer(wanted);
    const result = probe();
    if (!result.ok) {
        console.error(`[source2viewer] installed ${installedTag} but it failed to run: ${result.reason}`);
        process.exitCode = 1;
        return;
    }
    console.log(`[source2viewer] installed ${installedTag} -> ${cliPath()}`);
    console.log(result.help.split(/\r?\n/).slice(0, 24).join('\n'));
}

const entry = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (entry === path.resolve(fileURLToPath(import.meta.url))) {
    await runInstaller();
}
