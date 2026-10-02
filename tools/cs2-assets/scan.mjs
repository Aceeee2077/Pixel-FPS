/**
 * Builds an index of the weapon resources inside the local CS2 install.
 *
 *   npm run assets:cs2:scan
 *
 * Reads the VPK directory pack directly (no external tool needed) and writes
 * `generated/cs2/cs2-asset-index.json`. The mapping table in `weapons.mjs` was
 * produced from this index, and running it again is how you re-derive the table
 * after a game update: entries the pipeline cannot find are reported instead of
 * being guessed at.
 */
import fs from 'node:fs';
import path from 'node:path';
import { detectCs2, generatedRoot, repoRoot } from './local-cs2.mjs';
import { entriesWithExtension, findEntries, openVpk } from './vpk.mjs';
import { ARMS, WEAPONS } from './weapons.mjs';

/** Resources a weapon model needs: geometry, materials and textures. */
const RESOURCE_EXTENSIONS = ['vmdl_c', 'vmat_c', 'vcompmat_c', 'vtex_c', 'vanim_c'];

function main() {
    const install = detectCs2();
    if (!install) {
        console.error('Could not find a local Counter-Strike 2 installation.');
        process.exitCode = 1;
        return;
    }

    console.log(`[scan] ${install.vpkPath}`);
    const index = openVpk(install.vpkPath);
    console.log(`[scan] ${index.entries.length} entries in ${index.ms}ms (VPK v${index.version})`);

    const byExtension = {};
    for (const extension of RESOURCE_EXTENSIONS) byExtension[extension] = entriesWithExtension(index, extension).length;

    // Every weapon model the game ships, so the mapping table can be audited.
    const models = entriesWithExtension(index, 'vmdl_c')
        .filter(entry => entry.path.startsWith('weapons/models/'))
        .map(entry => entry.path);
    const knives = models.filter(model => model.startsWith('weapons/models/knife/'));
    const arms = models.filter(model => model.includes('shared/arms/'));

    // Which of the mapped weapons actually exist on this machine.
    const mapped = [...WEAPONS, ARMS].map(weapon => {
        const entry = index.entries.find(candidate => candidate.path === weapon.model);
        return { id: weapon.id, model: weapon.model, found: !!entry, archive: entry?.archiveIndex ?? null, bytes: entry?.length ?? null };
    });

    // Materials and textures beside each model, for reference.
    const materials = Object.fromEntries(WEAPONS.map(weapon => {
        const folder = path.posix.dirname(weapon.model);
        const short = path.posix.basename(weapon.model).replace(/_?mag\.vmdl_c$/, '');
        return [weapon.id, findEntries(index, folder).filter(entry => /\.(vmat_c|vcompmat_c)$/.test(entry.path)).map(entry => entry.path).slice(0, 24)];
    }));

    const report = {
        generatedAt: new Date().toISOString(),
        install: install.installPath,
        vpk: install.vpkPath,
        counts: { entries: index.entries.length, byExtension, weaponModels: models.length, knives: knives.length },
        mapped,
        missing: mapped.filter(entry => !entry.found).map(entry => `${entry.id} -> ${entry.model}`),
        knifeModels: knives,
        armsModels: arms,
        materials,
        allWeaponModels: models,
    };

    fs.mkdirSync(generatedRoot, { recursive: true });
    const file = path.join(generatedRoot, 'cs2-asset-index.json');
    fs.writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`);

    console.log(`[scan] weapon models ${models.length} (${knives.length} knives, ${arms.length} arms)`);
    console.log(`[scan] mapped weapons found ${mapped.filter(entry => entry.found).length}/${mapped.length}`);
    if (report.missing.length) {
        console.log('[scan] not present in this install:');
        for (const line of report.missing) console.log(`        ${line}`);
    }
    console.log(`[scan] wrote ${path.relative(repoRoot, file)}`);
}

main();
