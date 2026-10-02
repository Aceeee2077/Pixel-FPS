/**
 * The CS2 asset pipeline.
 *
 *   detect CS2 -> locate VPK -> export with Source 2 Viewer -> optimize ->
 *   publish to public/generated-assets/cs2 -> validate -> manifest
 *
 * Run it with:
 *
 *   npm run assets:cs2                 # every weapon (skips up-to-date ones)
 *   npm run assets:cs2 -- --weapon ak-47
 *   npm run assets:cs2 -- --category rifle --force
 *
 * Extracted and converted Valve assets stay out of git: the raw exports live in
 * `generated/cs2` (ignored) and the published copies in
 * `public/generated-assets/cs2` (ignored). The game falls back to its existing
 * models whenever those folders are absent, so a fresh clone still runs.
 */
import fs from 'node:fs';
import path from 'node:path';
import { detectCs2, generatedRoot, publicAssetsRoot, publicManifestPath, repoRoot, writeConfig, readJson } from './local-cs2.mjs';
import { exportResource, mainGlb, requireCli } from './source2viewer.mjs';
import { buildVariant } from './optimize.mjs';
import { validateGlb } from './validate.mjs';
import { ARMS, WEAPONS } from './weapons.mjs';
import { meshoptAvailable } from './io.mjs';

const DEFAULTS = { maxTexture: 2048, textureQuality: 90, compress: true, concurrency: 3, force: false };

function parseArgs(argv) {
    const options = { ...DEFAULTS, weapons: [], category: null };
    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        const next = () => argv[++i];
        if (arg === '--all-weapons' || arg === '--all') options.all = true;
        else if (arg === '--weapon') options.weapons.push(next());
        else if (arg === '--category') options.category = next();
        else if (arg === '--max-texture') options.maxTexture = Number(next());
        else if (arg === '--quality') options.textureQuality = Number(next());
        else if (arg === '--concurrency') options.concurrency = Number(next());
        else if (arg === '--force') options.force = true;
        else if (arg === '--no-compress') options.compress = false;
        else if (arg === '--arms') options.arms = true;
        else if (arg === '--help' || arg === '-h') options.help = true;
    }
    return options;
}

const HELP = `CS2 asset pipeline

  --all-weapons            convert every weapon in the mapping table
  --weapon <id>            convert one weapon (repeatable)
  --category <name>        rifle | pistol | smg | sniper | shotgun | machine-gun | knife
  --arms                   also convert the shared first-person arms
  --max-texture <px>       largest texture edge (default ${DEFAULTS.maxTexture})
  --quality <0-100>        WebP quality (default ${DEFAULTS.textureQuality})
  --no-compress            skip meshopt vertex compression
  --concurrency <n>        weapons converted in parallel (default ${DEFAULTS.concurrency})
  --force                  rebuild even when the outputs are up to date
`;

function selected(options) {
    if (options.all || (!options.weapons.length && !options.category)) return WEAPONS;
    return WEAPONS.filter(weapon =>
        options.weapons.includes(weapon.id) || (options.category && weapon.category === options.category));
}

/** Skip work when the inputs and settings have not changed. */
function upToDate(weapon, options) {
    const stamp = readJson(path.join(publicAssetsRoot, weapon.id, 'build.json'));
    if (!stamp) return false;
    const same = stamp.model === weapon.model
        && stamp.maxTexture === options.maxTexture
        && stamp.textureQuality === options.textureQuality
        && stamp.compress === options.compress;
    if (!same) return false;
    return ['view.glb', 'world.glb'].every(file => fs.existsSync(path.join(publicAssetsRoot, weapon.id, file)));
}

/** Convert one weapon: raw export, then both published variants. */
async function convertWeapon(weapon, context) {
    const { cli, vpkPath, gameInfo, options } = context;
    const rawDir = path.join(generatedRoot, weapon.id, 'raw');
    const outDir = path.join(publicAssetsRoot, weapon.id);
    const started = Date.now();

    // Rebuilds start from a clean folder: a stale PNG or GLB left behind by an
    // earlier run would otherwise mask a change in the export.
    fs.rmSync(rawDir, { recursive: true, force: true });
    fs.rmSync(outDir, { recursive: true, force: true });

    const result = await exportResource({ cli, vpkPath, gameInfo, resource: weapon.model, outDir: rawDir });
    const sourceGlb = mainGlb(rawDir, path.basename(weapon.model, '.vmdl_c'));
    if (!sourceGlb) {
        return { id: weapon.id, ok: false, error: 'Source 2 Viewer produced no glTF', log: result.log.slice(-1500) };
    }

    const variants = {};
    for (const role of ['view', 'world']) {
        const output = path.join(outDir, `${role}.glb`);
        variants[role] = await buildVariant({
            sourceGlb, output, role,
            maxTexture: options.maxTexture,
            textureQuality: options.textureQuality,
            compress: options.compress,
        });
    }

    const validation = {};
    for (const role of ['view', 'world']) {
        validation[role] = validateGlb(variants[role].file, { expectAnimations: true, maxSize: 8e6 });
    }

    fs.writeFileSync(path.join(outDir, 'build.json'), `${JSON.stringify({
        id: weapon.id,
        category: weapon.category,
        model: weapon.model,
        maxTexture: options.maxTexture,
        textureQuality: options.textureQuality,
        compress: options.compress,
        builtAt: new Date().toISOString(),
        ms: Date.now() - started,
    }, null, 2)}\n`);

    const ok = Object.values(validation).every(entry => entry.ok);
    return {
        id: weapon.id,
        category: weapon.category,
        ok,
        ms: Date.now() - started,
        source: weapon.model,
        view: variants.view,
        world: variants.world,
        validation,
    };
}

/** Everything the runtime needs to resolve a weapon, keyed by weapon id. */
function buildManifest(results, options) {
    const weapons = {};
    for (const result of results) {
        if (!result.view || !result.world) continue;
        const relative = file => `/${path.relative(path.join(repoRoot, 'public'), file).split(path.sep).join('/')}`;
        weapons[result.id] = {
            id: result.id,
            category: result.category,
            view: relative(result.view.file),
            world: relative(result.world.file),
            viewTriangles: Math.round(result.view.triangles),
            worldTriangles: Math.round(result.world.triangles),
            materials: result.view.materials,
            textures: result.view.textures.count,
            animations: result.view.animations,
            joints: result.view.joints,
            bounds: result.view.bounds ?? result.validation.view?.stats?.bounds ?? null,
            compressed: !!result.view.compressed,
            validated: result.validation.view?.ok === true && result.validation.world?.ok === true,
            source: result.source,
        };
    }
    return {
        version: 1,
        generatedAt: new Date().toISOString(),
        source: 'Local Counter-Strike 2 installation',
        note: 'Valve-owned assets. Not covered by this project\'s licence; see docs/THIRD_PARTY_ASSETS.md.',
        options: { maxTexture: options.maxTexture, textureQuality: options.textureQuality, meshopt: options.compress },
        weapons,
    };
}

async function pool(items, limit, worker) {
    const results = [];
    let cursor = 0;
    const runners = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
        while (cursor < items.length) {
            const index = cursor++;
            results[index] = await worker(items[index]);
        }
    });
    await Promise.all(runners);
    return results;
}

async function main() {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) { process.stdout.write(HELP); return; }

    const cli = requireCli();
    const install = detectCs2();
    if (!install) {
        console.error('Could not find a local Counter-Strike 2 installation.');
        console.error('Install CS2 through Steam, or set cs2InstallPath in config/local-assets.json.');
        process.exitCode = 1;
        return;
    }
    writeConfig({ installPath: install.installPath });
    console.log(`[cs2] install  ${install.installPath}`);
    console.log(`[cs2] vpk      ${install.vpkPath}`);
    console.log(`[cs2] viewer   ${cli}`);
    console.log(`[cs2] meshopt  ${options.compress ? (await meshoptAvailable() ? 'enabled' : 'unavailable - writing uncompressed') : 'disabled'}`);

    const context = { cli, vpkPath: install.vpkPath, gameInfo: path.join(install.csgoDir, 'gameinfo.gi'), options };
    if (!fs.existsSync(context.gameInfo)) {
        console.error(`[cs2] gameinfo.gi is missing at ${context.gameInfo}`);
        process.exitCode = 1;
        return;
    }

    const targets = options.arms ? [...selected(options), ARMS] : selected(options);
    if (!targets.length) { console.error('No weapons matched. Try --all-weapons.'); process.exitCode = 1; return; }

    fs.mkdirSync(publicAssetsRoot, { recursive: true });
    const todo = targets.filter(weapon => options.force || !upToDate(weapon, options));
    const skipped = targets.length - todo.length;
    console.log(`[cs2] ${targets.length} weapon(s): ${todo.length} to build, ${skipped} already up to date`);

    const results = await pool(todo, options.concurrency, async weapon => {
        try {
            const result = await convertWeapon(weapon, context);
            const mark = result.ok ? 'ok  ' : 'FAIL';
            console.log(`  ${mark} ${result.id.padEnd(20)} ${result.ok ? `${Math.round(result.ms)}ms  view ${(result.view.bytes / 1e6).toFixed(2)}MB / world ${(result.world.bytes / 1e6).toFixed(2)}MB` : result.error}`);
            if (!result.ok && result.validation) {
                for (const [role, entry] of Object.entries(result.validation)) {
                    if (entry.failures?.length) console.log(`        ${role}: ${entry.failures.join('; ')}`);
                }
            }
            return result;
        } catch (error) {
            console.log(`  FAIL ${weapon.id.padEnd(20)} ${error.message}`);
            return { id: weapon.id, category: weapon.category, ok: false, error: error.message };
        }
    });

    // Merge with the existing manifest so a single-weapon run keeps the rest of
    // the catalogue intact.
    const previous = readJson(publicManifestPath);
    const merged = { ...previous?.weapons };
    for (const result of results) {
        if (!result.view) { delete merged[result.id]; continue; }
        merged[result.id] = buildManifest([result], options).weapons[result.id];
    }

    const manifest = {
        version: 1,
        generatedAt: new Date().toISOString(),
        source: 'Local Counter-Strike 2 installation',
        note: 'Valve-owned assets. Not covered by this project\'s licence; see docs/THIRD_PARTY_ASSETS.md.',
        options: { maxTexture: options.maxTexture, textureQuality: options.textureQuality, meshopt: options.compress },
        weapons: merged,
    };
    fs.writeFileSync(publicManifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

    // Keep the report a description of the whole catalogue, not just of the
    // weapons this run happened to rebuild.
    const previousReport = readJson(path.join(generatedRoot, 'validation-report.json'));
    const entries = new Map((previousReport?.weapons ?? []).map(entry => [entry.id, entry]));
    for (const result of results) {
        if (!result.ok && !result.validation) entries.delete(result.id);
        else entries.set(result.id, {
            id: result.id, ok: result.ok, error: result.error ?? null,
            view: result.validation?.view ?? null,
            world: result.validation?.world ?? null,
        });
    }
    const report = {
        generatedAt: manifest.generatedAt,
        install: install.installPath,
        summary: {
            total: entries.size,
            passing: [...entries.values()].filter(entry => entry.ok).length,
            builtThisRun: results.length,
            skipped: skipped,
        },
        weapons: [...entries.values()].sort((a, b) => a.id.localeCompare(b.id)),
    };
    fs.mkdirSync(generatedRoot, { recursive: true });
    fs.writeFileSync(path.join(generatedRoot, 'validation-report.json'), `${JSON.stringify(report, null, 2)}\n`);

    const failed = results.filter(result => !result.ok);
    console.log(`[cs2] manifest   ${path.relative(repoRoot, publicManifestPath)}`);
    console.log(`[cs2] report     generated/cs2/validation-report.json`);
    console.log(`[cs2] done: ${results.length - failed.length} ok, ${failed.length} failed${skipped ? `, ${skipped} skipped` : ''}`);
    if (failed.length) {
        console.log(`[cs2] failed: ${failed.map(result => result.id).join(', ')}`);
        process.exitCode = 1;
    }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
