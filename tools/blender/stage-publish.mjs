/**
 * Stage assets for publishing when the build process cannot write into the web
 * root itself (for example under a restricted file sandbox).
 *
 *   node tools/blender/stage-publish.mjs [--only id,id] [--with-previews]
 *
 * Emits one text manifest plus one `chunks/*.b64` file per binary under
 * `tools/blender/stage/`. `publish-from-stage.mjs` reassembles them.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const stage = join(here, 'stage');
const dist = join(here, 'dist', 'weapons');
const previews = join(here, 'previews');

const argv = process.argv.slice(2);
const onlyIndex = argv.indexOf('--only');
const only = onlyIndex >= 0 ? new Set(argv[onlyIndex + 1].split(',').map(s => s.trim())) : null;
const withPreviews = argv.includes('--with-previews');
const chunkSize = 60000;

if (existsSync(stage)) rmSync(stage, { recursive: true, force: true });
mkdirSync(join(stage, 'chunks'), { recursive: true });

const records = [];
let chunkCount = 0;
let totalBytes = 0;
let totalChunkBytes = 0;

function addChunked(source, target) {
  const data = readFileSync(source);
  const base64 = data.toString('base64');
  const chunks = [];
  for (let offset = 0; offset < base64.length; offset += chunkSize) {
    const name = `${String(chunkCount).padStart(4, '0')}.b64`;
    const piece = base64.slice(offset, offset + chunkSize);
    writeFileSync(join(stage, 'chunks', name), piece, 'utf8');
    chunks.push(name);
    chunkCount++;
    totalChunkBytes += piece.length;
  }
  records.push({ target, bytes: data.length, chunks });
  totalBytes += data.length;
  return records[records.length - 1];
}

const ids = existsSync(dist)
  ? readdirSync(dist).filter(name => statSync(join(dist, name)).isDirectory()).sort()
  : [];

for (const id of ids) {
  if (only && !only.has(id)) continue;
  const glb = join(dist, id, `${id}.glb`);
  if (existsSync(glb)) addChunked(glb, `public/assets/weapons/${id}/${id}.glb`);
  if (withPreviews) {
    const preview = join(previews, `${id}_preview.png`);
    if (existsSync(preview)) addChunked(preview, `public/assets/weapons/${id}/preview.png`);
  }
}

// The manifest and the generated TS registry are small; ship them inline.
const manifest = join(dist, 'manifest.json');
const inline = {};
if (existsSync(manifest)) {
  inline['public/assets/weapons/manifest.json'] = readFileSync(manifest, 'utf8');
}

writeFileSync(join(stage, 'records.json'), JSON.stringify({
  generated: new Date().toISOString(),
  chunkSize,
  binaries: records,
  inline,
}, null, 2), 'utf8');

console.log(`staged ${records.length} binaries, ${chunkCount} chunks`);
console.log(`binary payload ${(totalBytes / 1024).toFixed(1)} KB -> ${(totalChunkBytes / 1024).toFixed(1)} KB base64`);
for (const record of records) console.log(`  ${record.target}  ${(record.bytes / 1024).toFixed(1)} KB  ${record.chunks.length} chunks`);
