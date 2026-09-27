// Final consistency check across the build output, the served manifest and the
// generated TypeScript registry.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const distManifest = JSON.parse(readFileSync(join(root, 'tools/blender/dist/weapons/manifest.json'), 'utf8'));
const built = distManifest.assets ?? {};
const builtIds = Object.keys(built).sort();

const publicManifest = JSON.parse(readFileSync(join(root, 'public/assets/weapons/manifest.json'), 'utf8'));
// The published manifest is a flat id -> path map with an additional nested
// `assets` record block; that block is metadata, not a weapon id.
const servedIds = Object.keys(publicManifest)
  .filter(key => key !== 'assets' && key[0] !== '_')
  .sort();

const registry = readFileSync(join(root, 'src/data/weaponAssets.ts'), 'utf8');
const registryIds = [...registry.matchAll(/^\s*'([^']+)':\s*\{/gm)].map(match => match[1]).sort();

function compare(label, a, b) {
  const onlyA = a.filter(id => !b.includes(id));
  const onlyB = b.filter(id => !a.includes(id));
  const ok = onlyA.length === 0 && onlyB.length === 0;
  console.log(`${ok ? 'OK  ' : 'DIFF'} ${label}: ${a.length} vs ${b.length}` +
    (onlyA.length ? `  only-in-first: ${onlyA.join(', ')}` : '') +
    (onlyB.length ? `  only-in-second: ${onlyB.join(', ')}` : ''));
  return ok;
}

console.log(`built GLBs      : ${builtIds.length}`);
console.log(`served manifest : ${servedIds.length}`);
console.log(`ts registry     : ${registryIds.length}`);
const ok1 = compare('built vs served', builtIds, servedIds);
const ok2 = compare('served vs registry', servedIds, registryIds);

// Every built weapon must have its GLB and .blend on disk.
let missingFiles = [];
for (const id of builtIds) {
  const glb = join(root, 'tools/blender/dist/weapons', id, `${id}.glb`);
  const blend = join(root, 'tools/blender/dist/blender', `${id}.blend`);
  if (!existsSync(glb)) missingFiles.push(`${id}.glb`);
  if (!existsSync(blend)) missingFiles.push(`${id}.blend`);
}
console.log(missingFiles.length ? `MISSING ARTIFACTS: ${missingFiles.join(', ')}` : 'OK   every weapon has a .glb and a .blend');

// Model registry ids that still have no authored model at all.
const weaponRegistry = readFileSync(join(root, 'src/data/weapons.ts'), 'utf8');
const registryRows = [...weaponRegistry.matchAll(/^\s*\['([a-z0-9-]+)',/gm)].map(m => m[1]);
const uncovered = registryRows.filter(id => !servedIds.includes(id));
console.log(`game weapon ids : ${registryRows.length}`);
console.log(`still on procedural fallback: ${uncovered.length ? uncovered.join(', ') : 'none'}`);

process.exit(ok1 && ok2 && missingFiles.length === 0 ? 0 : 1);
