// Inspect GLB composition: which accessors dominate file size.
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';

const files = process.argv.slice(2);
for (const file of files) {
  const bytes = readFileSync(file);
  const jsonLength = bytes.readUInt32LE(12);
  const gltf = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString('utf8'));
  const total = bytes.length;
  const byType = {};
  const componentSize = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
  const typeCount = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
  for (const mesh of gltf.meshes ?? []) {
    for (const primitive of mesh.primitives) {
      for (const [semantic, index] of Object.entries(primitive.attributes)) {
        const accessor = gltf.accessors[index];
        const size = accessor.count * componentSize[accessor.componentType] * typeCount[accessor.type];
        byType[semantic] = (byType[semantic] ?? 0) + size;
      }
      if (primitive.indices !== undefined) {
        const accessor = gltf.accessors[primitive.indices];
        const size = accessor.count * componentSize[accessor.componentType];
        byType.INDICES = (byType.INDICES ?? 0) + size;
      }
    }
  }
  let vertices = 0, primitives = 0, triangles = 0;
  for (const mesh of gltf.meshes ?? []) {
    for (const primitive of mesh.primitives) {
      primitives++;
      const position = gltf.accessors[primitive.attributes.POSITION];
      vertices += position.count;
      if (primitive.indices !== undefined) triangles += gltf.accessors[primitive.indices].count / 3;
    }
  }
  const rows = Object.entries(byType).sort((a, b) => b[1] - a[1])
    .map(([key, value]) => `${key} ${(value / 1024).toFixed(0)}KB`);
  console.log(`${basename(file)}  ${(total / 1024).toFixed(0)}KB total  json ${(jsonLength / 1024).toFixed(0)}KB  ` +
    `bin ${((total - jsonLength - 28) / 1024).toFixed(0)}KB  meshes ${gltf.meshes?.length}  prims ${primitives}  ` +
    `verts ${vertices}  tris ${triangles.toFixed(0)}`);
  console.log(`   ${rows.join('  |  ')}`);
}
