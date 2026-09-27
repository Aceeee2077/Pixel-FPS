/**
 * Generate the runtime weapon-asset registry from the Blender manifest.
 *
 *   node tools/blender/gen-asset-registry.mjs [--staged]
 *
 * The manifest produced by the Blender export is the single source of truth.
 * This step writes `src/data/weaponAssets.ts`, so the TypeScript registry and
 * the served `manifest.json` can never drift apart. `--staged` reads the
 * build output under `tools/blender/dist` before it is published.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const staged = process.argv.includes('--staged');
const sources = [
  join(root, 'public', 'assets', 'weapons', 'manifest.json'),
  join(here, 'dist', 'weapons', 'manifest.json'),
];
if (staged) sources.reverse();

let manifest = {};
let source = null;
let best = -1;
for (const candidate of sources) {
  if (!existsSync(candidate)) continue;
  try {
    const parsed = JSON.parse(readFileSync(candidate, 'utf8'));
    if (!parsed || typeof parsed !== 'object') continue;
    // Prefer whichever manifest actually describes the most weapons.
    const count = parsed.assets && typeof parsed.assets === 'object'
      ? Object.keys(parsed.assets).length
      : Object.keys(parsed).length;
    if (count > best) { manifest = parsed; source = candidate; best = count; }
  } catch { /* try the next candidate */ }
}
if (!source) {
  console.error('No weapon manifest found. Run the Blender build first.');
  process.exit(1);
}

const assets = manifest.assets && typeof manifest.assets === 'object' ? manifest.assets : {};
const flat = {};
for (const [key, value] of Object.entries(manifest)) {
  if (key === 'assets') continue;
  if (typeof value === 'string' && value.startsWith('/assets/weapons/')) flat[key] = value;
}

const ids = Object.keys(assets).length ? Object.keys(assets).sort() : Object.keys(flat).sort();
const records = ids.map(id => {
  const record = assets[id] ?? {};
  const model = record.model ?? flat[id];
  const status = record.status ?? 'game_ready';
  const triangles = Number.isFinite(record.triangles) ? record.triangles : 0;
  const materials = Number.isFinite(record.materials) ? record.materials : 0;
  return { id, model, status, triangles, materials };
}).filter(record => typeof record.model === 'string');

const lines = records.map(record =>
  `    '${record.id}': { model: '${record.model}', thumbnail: '${record.model.replace(/\/[^/]+\.glb$/, '/preview.webp')}', status: '${record.status}', triangles: ${record.triangles}, materials: ${record.materials} },`);

const output = `// GENERATED FILE - do not edit by hand.
// Source of truth: public/assets/weapons/manifest.json (written by the Blender pipeline).
// Regenerate with: node tools/blender/gen-asset-registry.mjs
export type WeaponAssetStatus = 'reference_only' | 'blockout' | 'refining' | 'game_ready' | 'final' | 'needs_more_reference' | 'third_party';
export interface WeaponAssetRecord {
    model: string;
    thumbnail: string;
    status: WeaponAssetStatus;
    triangles: number;
    materials: number;
}
/** Every weapon id that has a real authored GLB published for it. */
export const weaponAssets: Readonly<Record<string, WeaponAssetRecord>> = {
${lines.join('\n')}
};
export const weaponAssetIds: readonly string[] = Object.keys(weaponAssets);
export function weaponAsset(id: string): WeaponAssetRecord | undefined {
    return weaponAssets[id];
}
`;

const targets = process.argv.includes('--stdout') ? null : [join(root, 'src', 'data', 'weaponAssets.ts')];
if (targets) {
  for (const target of targets) {
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, output, 'utf8');
  }
  console.log(`REGISTRY from ${source.replace(root, '.')}: ${records.length} weapon GLBs`);
} else {
  // --stdout lets a sandboxed caller place the file with its own file tooling.
  process.stdout.write(output);
  console.error(`REGISTRY from ${source.replace(root, '.')}: ${records.length} weapon GLBs`);
}
for (const record of records) console.error(`  ${record.id.padEnd(14)} ${String(record.triangles).padStart(7)} tris  ${record.status}`);
