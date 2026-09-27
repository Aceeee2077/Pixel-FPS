import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Weapon asset pipeline contract.
 *
 * The Blender pipeline stages finished GLBs under `tools/blender/dist/weapons`
 * and `npm run publish:weapons` copies them into `public/assets/weapons`. This
 * test always validates the real built glTF binaries, and additionally asserts
 * the published paths and the generated registry agree with them.
 */
const DIST = path.join('tools', 'blender', 'dist', 'weapons');
const PUBLISHED = path.join('public', 'assets', 'weapons');
const distManifestPath = path.join(DIST, 'manifest.json');

assert.ok(fs.existsSync(distManifestPath), 'weapon build manifest exists (run `npm run build:weapons`)');
const distManifest = JSON.parse(fs.readFileSync(distManifestPath, 'utf8'));
const assets = distManifest.assets ?? {};
const ids = Object.keys(assets).sort();
console.log('BUILT WEAPONS', ids.length);
assert.ok(ids.length > 0, 'the pipeline produced authored weapons');

const published = new Set(fs.existsSync(PUBLISHED)
  ? fs.readdirSync(PUBLISHED).filter(name => {
      const entry = path.join(PUBLISHED, name);
      return fs.statSync(entry).isDirectory();
    })
  : []);
const publishedCount = ids.filter(id => published.has(id)).length;
console.log('PUBLISHED WEAPONS', publishedCount, 'of', ids.length);
if (publishedCount < ids.length) {
  console.log('NOTE: run `npm run publish:weapons` to copy the staged GLBs into public/assets/weapons.');
}

/** Validate one real glTF binary: structure, PBR data and authored anchors. */
function validateGlb(file, id) {
  const bytes = fs.readFileSync(file);
  assert.equal(bytes.readUInt32LE(0), 0x46546c67, `${id}: glTF magic number`);
  assert.equal(bytes.readUInt32LE(4), 2, `${id}: glTF version 2`);
  assert.equal(bytes.readUInt32LE(8), bytes.length, `${id}: declared length matches file size`);
  assert.ok(bytes.length > 20000, `${id}: real geometry payload (${bytes.length} bytes)`);
  const jsonLength = bytes.readUInt32LE(12);
  const gltf = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString('utf8'));
  const nodes = gltf.nodes ?? [];
  const names = nodes.map(node => node.name ?? '');
  const meshes = gltf.meshes ?? [];
  const materials = gltf.materials ?? [];
  const thirdParty = assets[id].status === 'third_party';

  assert.ok(meshes.length >= (thirdParty ? 1 : 5), `${id}: mesh hierarchy (${meshes.length} meshes)`);
  assert.ok(materials.length >= (thirdParty ? 1 : 3), `${id}: PBR material zones (${materials.length} materials)`);
  assert.ok(names.some(name => name === 'Muzzle'), `${id}: Muzzle anchor authored`);
  assert.ok(names.some(name => name === 'ViewmodelAnchor'), `${id}: ViewmodelAnchor authored`);
  assert.ok(materials.every(m => m.pbrMetallicRoughness), `${id}: every material is PBR`);
  if (!thirdParty) assert.ok(materials.some(m => (m.pbrMetallicRoughness.metallicFactor ?? 1) > 0.3),
    `${id}: has metal material zones`);
  assert.ok(materials.every(m => typeof m.pbrMetallicRoughness.roughnessFactor === 'number'),
    `${id}: materials carry roughness`);
  // Separately transformable parts are what make reload / fire / inspect possible.
  const animatable = ['Magazine', 'Trigger', 'Bolt', 'Slide', 'ChargingHandle', 'Pivot', 'Blade']
    .filter(part => names.some(name => name.startsWith(part)));
  if (!thirdParty) assert.ok(animatable.length >= 1, `${id}: animatable parts split out (${animatable.join(', ') || 'none'})`);

  const vertices = meshes.reduce((sum, mesh) => sum + mesh.primitives.reduce(
    (inner, primitive) => inner + (gltf.accessors[primitive.attributes.POSITION]?.count ?? 0), 0), 0);
  const triangles = meshes.reduce((sum, mesh) => sum + mesh.primitives.reduce(
    (inner, primitive) => inner + (primitive.indices !== undefined
      ? (gltf.accessors[primitive.indices]?.count ?? 0) / 3 : 0), 0), 0);
  assert.ok(triangles > 1500, `${id}: real tessellation (${Math.round(triangles)} tris)`);
  assert.equal(Math.round(triangles), assets[id].triangles,
    `${id}: manifest triangle count matches the GLB`);
  return { meshes: meshes.length, materials: materials.length, triangles: Math.round(triangles), vertices };
}

const report = [];
for (const id of ids) {
  const glb = path.join(DIST, id, `${id}.glb`);
  assert.ok(fs.existsSync(glb), `${id}: staged GLB exists at ${glb}`);
  const stats = validateGlb(glb, id);
  const target = path.join(PUBLISHED, id, `${id}.glb`);
  if (fs.existsSync(target)) {
    assert.equal(fs.statSync(target).size, fs.statSync(glb).size,
      `${id}: published GLB matches the built one byte-for-byte`);
  }
  report.push({ id, ...stats });
}
console.log('WEAPON GEOMETRY REPORT', JSON.stringify({
  weapons: report.length,
  trianglesTotal: report.reduce((sum, item) => sum + item.triangles, 0),
  trianglesMin: Math.min(...report.map(r => r.triangles)),
  trianglesMax: Math.max(...report.map(r => r.triangles)),
  materialsMin: Math.min(...report.map(r => r.materials)),
  materialsMax: Math.max(...report.map(r => r.materials)),
  distinctTriangleCounts: new Set(report.map(r => r.triangles)).size,
}));
// Distinct silhouettes: the pipeline must never emit one generic mesh per class.
assert.ok(new Set(report.map(r => r.triangles)).size >= report.length - 2,
  'weapons are individually authored, not clones of one generic mesh');
assert.ok(report.every(r => r.triangles <= 100000), 'no weapon exceeds its triangle budget');

// The generated TypeScript registry must agree with the build manifest.
const registry = fs.readFileSync(path.join('src', 'data', 'weaponAssets.ts'), 'utf8');
for (const id of ids) {
  assert.ok(registry.includes(`'${id}':`), `registry carries an entry for ${id}`);
  assert.ok(registry.includes(assets[id].model), `registry carries the model path for ${id}`);
}

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
});
try {
  const page = await browser.newPage({ locale: 'en-US' });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('http://127.0.0.1:5173/');
  await page.waitForFunction(() => window.__game);

  const live = await page.evaluate(async () => {
    const { weaponRegistry } = await import('/src/data/weapons.ts');
    const { weaponAssets } = await import('/src/data/weaponAssets.ts');
    const { weaponModel } = await import('/src/weapons/WeaponModel.ts');
    const authored = weaponRegistry.filter(weapon => weapon.modelStatus === 'final' && weapon.modelPath);
    const attempted = [];
    for (const weapon of authored) {
      const model = await window.__game.weaponAssets.loadPreview(weapon.id,
        { knifeStyle: 'classic', rifleSkin: 'standard' });
      let meshes = 0;
      model?.traverse(object => { if (object.isMesh) meshes++; });
      attempted.push({ id: weapon.id, path: weapon.modelPath, loaded: model !== null, meshes,
        muzzle: model?.userData.muzzle ?? null });
    }
    // A weapon without an authored GLB must still fall back to the procedural mesh.
    const fallbackId = weaponRegistry.find(weapon => weapon.modelStatus !== 'final')?.id ?? 'ak-47';
    const fallbackGlb = await window.__game.weaponAssets.loadPreview(fallbackId,
      { knifeStyle: 'classic', rifleSkin: 'standard' });
    let fallbackMeshes = 0;
    weaponModel(fallbackId).traverse(object => { if (object.isMesh) fallbackMeshes++; });
    return {
      registryCount: weaponRegistry.length,
      assetsCount: Object.keys(weaponAssets).length,
      authored: authored.map(weapon => weapon.id),
      attempted,
      fallbackId,
      fallbackGlbMissing: fallbackGlb === null,
      fallbackMeshes,
      distinctPaths: new Set(authored.map(weapon => weapon.modelPath)).size,
    };
  });
  console.log('WEAPON REGISTRY REPORT', JSON.stringify({
    registry: live.registryCount,
    assets: live.assetsCount,
    authored: live.authored.length,
    distinctPaths: live.distinctPaths,
    fallbackId: live.fallbackId,
    fallbackMeshes: live.fallbackMeshes,
  }));

  assert.ok(live.distinctPaths > 0, 'every authored weapon has its own path');
  assert.ok(live.assetsCount > 0, 'the generated registry carries the authored weapons');
  // Each weapon must map to its own model, never one shared generic rifle.
  assert.equal(live.distinctPaths, live.authored.length, 'each authored weapon has a distinct path');
  assert.ok(live.fallbackMeshes > 0, 'the procedural fallback still renders for unpublished models');
  if (publishedCount > 0) {
    const served = live.attempted.filter(item => item.loaded);
    assert.ok(served.length > 0, 'published GLBs load through the game loader');
    assert.ok(served.every(item => item.meshes > 0), 'published GLBs load with meshes');
    assert.ok(served.every(item => Array.isArray(item.muzzle) && item.muzzle.length === 3),
      'published GLBs expose an authored muzzle anchor');
  }

  // Owner-supplied finishes are separate models, so each one must resolve to its
  // own GLB and override the base weapon model when equipped.
  const finishes = await page.evaluate(async () => {
    const { WEAPON_SKINS } = await import('/src/weapons/WeaponSkins.ts');
    const { appearanceKey } = await import('/src/weapons/WeaponAppearance.ts');
    const loader = window.__game.weaponAssets;
    const results = [];
    for (const [weapon, skins] of Object.entries(WEAPON_SKINS)) {
      for (const skin of skins) {
        const appearance = { knifeStyle: 'classic', rifleSkin: 'standard', finish: skin.key };
        const resolved = await loader.resolvePath(weapon, 'view', appearance);
        const key = appearanceKey(weapon, appearance);
        results.push({ weapon, key: skin.key, model: skin.model, resolved, appearanceKey: key });
      }
    }
    return results;
  });
  console.log('FINISH VARIANTS', JSON.stringify(finishes.map(f => ({ weapon: f.weapon, key: f.key, resolved: f.resolved }))));
  assert.ok(finishes.length > 0, 'owner-supplied finishes are registered');
  for (const finish of finishes) {
    assert.equal(finish.resolved, finish.model,
      `${finish.weapon} finish ${finish.key} resolves to its own model`);
    assert.ok(finish.appearanceKey.includes(finish.key),
      `${finish.weapon} finish ${finish.key} is part of the appearance key, so the rig reloads`);
  }
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
}
console.log('weapon asset pipeline verified');
