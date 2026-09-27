// Inspect a GLB without Blender: structure, provenance hints, rigging and bounds.
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';

const COMPONENT = { 5120: ['BYTE', 1], 5121: ['UBYTE', 1], 5122: ['SHORT', 2], 5123: ['USHORT', 2], 5125: ['UINT', 4], 5126: ['FLOAT', 4] };
const TYPE_COUNT = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 };

function readAccessor(gltf, bin, index, elements = 3) {
  const accessor = gltf.accessors[index];
  const view = gltf.bufferViews[accessor.bufferView];
  const [name, size] = COMPONENT[accessor.componentType];
  const count = TYPE_COUNT[accessor.type];
  const stride = view.byteStride ?? size * count;
  const base = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const out = [];
  for (let i = 0; i < accessor.count && i < elements; i++) {
    const vector = [];
    for (let c = 0; c < count; c++) {
      const offset = base + i * stride + c * size;
      let value;
      if (name === 'FLOAT') value = bin.readFloatLE(offset);
      else if (name === 'USHORT') value = bin.readUInt16LE(offset);
      else if (name === 'SHORT') value = bin.readInt16LE(offset);
      else if (name === 'UINT') value = bin.readUInt32LE(offset);
      else value = bin.readUInt8(offset);
      vector.push(value);
    }
    out.push(count === 1 ? vector[0] : vector);
  }
  return out;
}

for (const file of process.argv.slice(2)) {
  const bytes = readFileSync(file);
  console.log('='.repeat(78));
  console.log(basename(file), `${(bytes.length / 1024).toFixed(0)} KB`);
  if (bytes.readUInt32LE(0) !== 0x46546c67) { console.log('  NOT a GLB (bad magic)'); continue; }
  let offset = 12, gltf = null, bin = null;
  while (offset < bytes.length) {
    const length = bytes.readUInt32LE(offset);
    const type = bytes.readUInt32LE(offset + 4);
    const chunk = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === 0x4e4f534a) gltf = JSON.parse(chunk.toString('utf8'));
    if (type === 0x004e4942) bin = chunk;
    offset += 8 + length + ((4 - (length % 4)) % 4);
  }
  console.log(`  glTF version ${bytes.readUInt32LE(4)}`);
  console.log(`  generator : ${gltf.asset?.generator ?? '(none)'}`);
  console.log(`  copyright : ${gltf.asset?.copyright ?? '(none)'}`);
  console.log(`  extensions: ${(gltf.extensionsUsed ?? []).join(', ') || '(none)'}`);

  const meshes = gltf.meshes ?? [];
  let primitives = 0, triangles = 0, vertices = 0;
  const attributeSet = new Set();
  for (const mesh of meshes) for (const primitive of mesh.primitives) {
    primitives++;
    vertices += gltf.accessors[primitive.attributes.POSITION]?.count ?? 0;
    if (primitive.indices !== undefined) triangles += (gltf.accessors[primitive.indices]?.count ?? 0) / 3;
    for (const key of Object.keys(primitive.attributes)) attributeSet.add(key);
  }
  console.log(`  meshes ${meshes.length}  primitives ${primitives}  vertices ${vertices}  triangles ${Math.round(triangles)}`);
  console.log(`  attributes: ${[...attributeSet].sort().join(', ')}`);
  console.log(`  materials ${(gltf.materials ?? []).length}  textures ${(gltf.textures ?? []).length}  images ${(gltf.images ?? []).length}`);
  console.log(`  nodes ${(gltf.nodes ?? []).length}  skins ${(gltf.skins ?? []).length}  animations ${(gltf.animations ?? []).length}`);

  if ((gltf.images ?? []).length) {
    const total = (gltf.images ?? []).reduce((sum, image) => sum + (gltf.bufferViews?.[image.bufferView]?.byteLength ?? 0), 0);
    console.log(`  embedded image bytes: ${(total / 1024 / 1024).toFixed(2)} MB`);
    for (const image of (gltf.images ?? []).slice(0, 8)) {
      const size = gltf.bufferViews?.[image.bufferView]?.byteLength ?? 0;
      console.log(`    image name="${image.name ?? '-'}" mime=${image.mimeType ?? '-'} ${(size / 1024).toFixed(0)}KB`);
    }
  }
  for (const material of (gltf.materials ?? []).slice(0, 10)) {
    const pbr = material.pbrMetallicRoughness ?? {};
    const base = pbr.baseColorFactor ? pbr.baseColorFactor.map(v => v.toFixed(2)).join(',') : '-';
    console.log(`    material "${material.name ?? '-'}" baseColor=[${base}] metal=${pbr.metallicFactor ?? '-'} rough=${pbr.roughnessFactor ?? '-'} tex=${pbr.baseColorTexture ? 'yes' : 'no'}`);
  }

  const rootNodes = (gltf.scenes?.[gltf.scene ?? 0]?.nodes ?? []).map(i => gltf.nodes[i]?.name ?? `#${i}`);
  console.log(`  scene roots: ${rootNodes.slice(0, 12).join(', ') || '(none)'}`);
  console.log(`  node names: ${(gltf.nodes ?? []).slice(0, 24).map(n => n.name ?? '-').join(' | ')}`);

  if (bin) {
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (const mesh of meshes) for (const primitive of mesh.primitives) {
      const accessor = gltf.accessors[primitive.attributes.POSITION];
      if (!accessor?.min || !accessor?.max) continue;
      for (let i = 0; i < 3; i++) {
        min[i] = Math.min(min[i], accessor.min[i]);
        max[i] = Math.max(max[i], accessor.max[i]);
      }
    }
    const size = min.map((v, i) => max[i] - v);
    console.log(`  bbox (glTF Y-up) min=[${min.map(v => v.toFixed(3)).join(', ')}] max=[${max.map(v => v.toFixed(3)).join(', ')}]`);
    console.log(`  size = [${size.map(v => v.toFixed(3)).join(', ')}]  longest ${Math.max(...size).toFixed(3)} m`);
    const first = meshes[0]?.primitives[0];
    if (first) console.log(`  first POSITION samples: ${JSON.stringify(readAccessor(gltf, bin, first.attributes.POSITION, 3))}`);
  }
}
