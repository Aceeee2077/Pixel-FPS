/**
 * Publish staged Blender output into the web root and the blend source vault.
 *
 *     node tools/blender/publish_assets.mjs [--dry-run]
 *
 * Blender writes to `tools/blender/dist`; this step copies validated GLBs into
 * `public/assets/weapons/<id>/<id>.glb`, previews next to them as `preview.webp`,
 * the manifest to `public/assets/weapons/manifest.json` and .blend sources to
 * `assets-source/blender`. WebP encoding uses the Playwright-shipped Chromium so
 * no extra dependency is required, and `gen-asset-registry.mjs` then regenerates
 * `src/data/weaponAssets.ts` from the published manifest.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const dist = join(here, 'dist');
const dryRun = process.argv.includes('--dry-run');

const copied = [];
const skipped = [];
const warnings = [];
const failures = [];
let webpHint = '';
let webpOk = 0;
let previewPng = 0;

function publish(from, to) {
  if (!existsSync(from)) { skipped.push(`${relative(root, from)} (missing)`); return false; }
  if (dryRun) { copied.push(`${relative(root, from)} -> ${relative(root, to)}`); return true; }
  try {
    mkdirSync(dirname(to), { recursive: true });
    writeFileSync(to, readFileSync(from));
  } catch (error) {
    failures.push(`${relative(root, to)}: ${error?.code ?? error?.message ?? error}`);
    return false;
  }
  copied.push(`${relative(root, from)} -> ${relative(root, to)}`);
  return true;
}

/**
 * Encode a PNG to WebP with the Chromium binary Playwright already provides.
 *
 * Returns false when no browser can be launched (missing binary, sandboxed
 * environment, blocked spawn) so the caller can fall back to copying the PNG.
 */
async function toWebp(pngPath, webpPath) {
  let browser;
  try {
    const { chromium } = await import('playwright');
    browser = await chromium.launch({
      executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
      headless: true,
      args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
    });
  } catch (error) {
    webpHint = `WebP encoder unavailable (${error?.message?.split('\n')[0] ?? error}); using PNG previews`;
    return false;
  }
  try {
    const page = await browser.newPage();
    const dataUrl = `data:image/png;base64,${readFileSync(pngPath).toString('base64')}`;
    const encoded = await page.evaluate(async (source) => {
      const image = new Image();
      image.src = source;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      canvas.getContext('2d').drawImage(image, 0, 0);
      return canvas.toDataURL('image/webp', 0.92).split(',')[1];
    }, dataUrl);
    if (!dryRun) {
      mkdirSync(dirname(webpPath), { recursive: true });
      writeFileSync(webpPath, Buffer.from(encoded, 'base64'));
    }
    return true;
  } catch (error) {
    webpHint = `WebP encode failed (${error?.message?.split('\n')[0] ?? error}); using PNG previews`;
    return false;
  } finally {
    await browser.close().catch(() => {});
  }
}

const weaponsDist = join(dist, 'weapons');
const ids = existsSync(weaponsDist)
  ? readdirSync(weaponsDist).filter(name => statSync(join(weaponsDist, name)).isDirectory())
  : [];

for (const id of ids) {
  const glb = join(weaponsDist, id, `${id}.glb`);
  publish(glb, join(root, 'public', 'assets', 'weapons', id, `${id}.glb`));
  const blend = join(dist, 'blender', `${id}.blend`);
  publish(blend, join(root, 'assets-source', 'blender', `${id}.blend`));
  const preview = join(here, 'previews', `${id}_preview.png`);
  if (existsSync(preview)) {
    const webp = join(root, 'public', 'assets', 'weapons', id, 'preview.webp');
    if (await toWebp(preview, webp)) {
      webpOk++;
      copied.push(`previews/${id}_preview.png -> public/assets/weapons/${id}/preview.webp`);
    } else {
      // Never let a missing browser encoder cost us the preview entirely.
      publish(preview, join(root, 'public', 'assets', 'weapons', id, 'preview.png'));
      previewPng++;
    }
  }
}

const manifest = join(weaponsDist, 'manifest.json');
if (existsSync(manifest)) {
  publish(manifest, join(root, 'public', 'assets', 'weapons', 'manifest.json'));
  copied.push('dist/weapons/manifest.json -> public/assets/weapons/manifest.json');
}
if (!dryRun) {
  // src/data/weaponAssets.ts is generated from whichever manifest is newest.
  const { execFileSync } = await import('node:child_process');
  try {
    execFileSync(process.execPath, [join(here, 'gen-asset-registry.mjs')], { stdio: 'inherit', cwd: root });
  } catch (error) {
    warnings.push(`registry generation failed: ${error?.message ?? error}`);
  }
}
for (const warning of warnings) console.log('  !', warning);

console.log(dryRun ? 'PUBLISH DRY RUN' : 'PUBLISHED');
for (const line of copied) console.log('  +', line);
for (const line of skipped) console.log('  -', line);
for (const warning of warnings) console.log('  !', warning);
console.log(`weapons: ${ids.length}  copied: ${copied.length}  webp previews: ${webpOk}  png previews: ${previewPng}`);
if (webpHint) console.log(`note: ${webpHint}`);
if (failures.length) {
  console.error(`\n${failures.length} file(s) could not be written:`);
  for (const failure of failures.slice(0, 8)) console.error('  x', failure);
  if (failures.length > 8) console.error(`  x ...and ${failures.length - 8} more`);
  console.error('\nThis is a filesystem permission boundary, not a pipeline bug.');
  console.error('Re-run `npm run publish:weapons` from a terminal that can write to public/.');
  process.exitCode = 1;
}
if (!ids.length) {
  console.error('\nNothing staged under tools/blender/dist/weapons.');
  console.error('Run `npm run build:weapons` first, or the armory will only have reference art.');
  process.exitCode = 1;
}
