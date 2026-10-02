/**
 * Development viewer for weapon models.
 *
 * Lists both asset sources side by side:
 *   - `cs2`   - models converted from the local Counter-Strike 2 install
 *   - `local` - the project's own authored GLBs in public/assets/weapons
 *
 * Shows the diagnostics that matter when judging an asset swap: triangle and
 * draw-call counts, texture memory, material slots, animation clips, the GLB
 * size on disk and the real bounding box in metres. It exists so a converted
 * model can be inspected before it reaches the game.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const canvas = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, 1, 0.01, 60);
camera.position.set(0.9, 0.55, 1.15);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = .08;
controls.autoRotateSpeed = 1.6;

const pmrem = new THREE.PMREMGenerator(renderer);
const environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

/** Lighting presets: the same model should read well under all of them. */
function buildLights(preset) {
  const group = new THREE.Group();
  group.name = 'lights';
  const add = (light, position) => { light.position.set(...position); group.add(light); return light; };
  if (preset === 'flat') {
    group.add(new THREE.AmbientLight(0xffffff, 2.2));
  } else if (preset === 'overcast') {
    group.add(new THREE.HemisphereLight(0xdfe9f2, 0x40483f, 2.4));
    add(new THREE.DirectionalLight(0xffffff, 1.2), [2, 4, 3]);
  } else if (preset === 'rim') {
    group.add(new THREE.AmbientLight(0x9fb0bd, .6));
    add(new THREE.DirectionalLight(0xffe6c4, 2.4), [-2.5, 3, 2]);
    add(new THREE.DirectionalLight(0x7fb6ff, 2.2), [2.5, 1.5, -3]);
    add(new THREE.DirectionalLight(0xffffff, 1.1), [0, 4, 0]);
  } else {
    group.add(new THREE.HemisphereLight(0xe8f2ff, 0x3a423a, 1.6));
    add(new THREE.DirectionalLight(0xfff2dd, 2.6), [-2.2, 3.4, 2.6]);
    add(new THREE.DirectionalLight(0xbfd8ff, 1.1), [2.6, 1.4, -2.2]);
  }
  return group;
}

const draco = new DRACOLoader().setDecoderPath('/draco/');
const loader = new GLTFLoader().setDRACOLoader(draco).setMeshoptDecoder(MeshoptDecoder);

const state = {
  entries: [],
  current: null,
  root: null,
  mixer: null,
  action: null,
  mode: 'view',
  wireframe: false,
  light: 'studio',
  spin: true,
  clips: [],
  loadToken: 0,
};

const el = id => document.getElementById(id);
const rows = (target, pairs) => {
  target.innerHTML = pairs.map(([key, value]) => `<dt>${key}</dt><dd>${value}</dd>`).join('');
};

/** Load both manifests; a missing CS2 manifest is expected on a fresh clone. */
async function loadManifests() {
  const entries = [];
  const sources = [];
  try {
    const response = await fetch('/generated-assets/cs2/manifest.json');
    if (response.ok) {
      const manifest = await response.json();
      for (const weapon of Object.values(manifest.weapons)) {
        entries.push({
          id: weapon.id,
          origin: 'cs2',
          category: weapon.category ?? 'weapon',
          view: weapon.view,
          world: weapon.world ?? weapon.view,
          animations: weapon.animations ?? [],
          bytes: null,
        });
      }
      sources.push(`cs2 ${Object.keys(manifest.weapons).length}`);
    }
  } catch { /* not built yet */ }
  try {
    const response = await fetch('/assets/weapons/manifest.json');
    if (response.ok) {
      const manifest = await response.json();
      for (const [id, asset] of Object.entries(manifest.assets ?? {})) {
        if (!asset.model) continue;
        entries.push({ id, origin: 'local', category: asset.category ?? 'weapon', view: asset.model, world: asset.model, animations: [], bytes: null });
      }
      sources.push(`local ${Object.keys(manifest.assets ?? {}).length}`);
    }
  } catch { /* optional */ }
  return { entries, sources };
}

function renderList() {
  const list = el('list');
  const groups = new Map();
  for (const entry of state.entries) {
    const key = `${entry.origin}/${entry.category}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(entry);
  }
  list.innerHTML = [...groups.entries()].map(([key, items]) => {
    const [origin, category] = key.split('/');
    return `<li><div style="padding:8px 8px 2px;color:#8fa091;font-size:11px">${category} · ${origin}</div>`
      + items.map(item => `<button data-id="${item.id}" data-origin="${item.origin}" class="${state.current?.id === item.id && state.current?.origin === item.origin ? 'selected' : ''}">`
        + `<span>${item.id}</span><small>${item.origin === 'cs2' ? 'CS2' : 'local'}</small></button>`).join('')
      + '</li>';
  }).join('');
  list.querySelectorAll('button').forEach(button => button.addEventListener('click', () => {
    select(state.entries.find(entry => entry.id === button.dataset.id && entry.origin === button.dataset.origin));
  }));
}

function disposeRoot() {
  if (!state.root) return;
  state.mixer?.stopAllAction();
  state.root.traverse(object => {
    if (object.isMesh) {
      object.geometry?.dispose?.();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        for (const key of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap']) material[key]?.dispose?.();
        material.dispose?.();
      }
    }
  });
  scene.remove(state.root);
  state.root = null;
  state.mixer = null;
}

/** Frame the model so any weapon size lands the same on screen. */
function frame(object) {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const centre = box.getCenter(new THREE.Vector3());
  const radius = Math.max(size.x, size.y, size.z) || 1;
  controls.target.copy(centre);
  const distance = radius / Math.tan((camera.fov * Math.PI / 180) / 2) * .65;
  const direction = new THREE.Vector3(0.85, 0.5, 1).normalize();
  camera.position.copy(centre).addScaledVector(direction, distance);
  camera.near = Math.max(0.005, radius / 200);
  camera.far = radius * 40;
  camera.updateProjectionMatrix();
  controls.update();
  return { box, size };
}

async function select(entry) {
  if (!entry) return;
  const token = ++state.loadToken;
  state.current = entry;
  renderList();
  disposeRoot();

  const path = state.mode === 'world' ? entry.world : entry.view;
  el('asset-path').textContent = path;
  const gltf = await loader.loadAsync(path);
  // A second click can land while this load is in flight; only the newest wins.
  if (token !== state.loadToken) return;
  const root = gltf.scene;
  root.traverse(object => {
    if (object.isMesh) object.frustumCulled = false;
  });
  scene.add(root);
  state.root = root;

  const { size } = frame(root);
  const clips = gltf.animations ?? [];
  state.clips = clips;
  state.mixer = clips.length ? new THREE.AnimationMixer(root) : null;
  const select = el('animation');
  select.innerHTML = '<option value="">bind pose</option>' + clips.map(clip => `<option value="${clip.name}">${clip.name}</option>`).join('');
  state.action = null;

  // Diagnostics
  let triangles = 0, meshes = 0, textures = 0, textureBytes = 0;
  const materials = new Set();
  root.traverse(object => {
    if (!object.isMesh) return;
    meshes += 1;
    const geometry = object.geometry;
    triangles += geometry.index ? geometry.index.count / 3 : (geometry.getAttribute('position')?.count ?? 0) / 3;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      materials.add(material.uuid);
      for (const key of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap']) {
        const texture = material[key];
        if (!texture) continue;
        textures += 1;
        const image = texture.image;
        if (image) textureBytes += (image.width ?? 0) * (image.height ?? 0) * 4;
      }
    }
  });
  const bytes = await fetch(path).then(response => response.arrayBuffer()).then(buffer => buffer.byteLength).catch(() => null);

  rows(el('geo'), [
    ['source', `<span class="badge ${entry.origin}">${entry.origin === 'cs2' ? 'Counter-Strike 2' : 'project'}</span>`],
    ['variant', state.mode],
    ['triangles', triangles.toLocaleString()],
    ['draw calls', meshes],
    ['skinned', root.getObjectByProperty('isSkinnedMesh', true) ? 'yes' : 'no'],
    ['bbox (m)', `${size.x.toFixed(3)} × ${size.y.toFixed(3)} × ${size.z.toFixed(3)}`],
    ['glb size', bytes ? `${(bytes / 1e6).toFixed(2)} MB` : '—'],
  ]);
  rows(el('mat'), [
    ['materials', materials.size],
    ['textures', textures],
    ['texture memory', `${(textureBytes / 1e6).toFixed(1)} MB`],
  ]);
  rows(el('anim'), [
    ['clips', clips.length],
    ...clips.slice(0, 10).map(clip => [clip.name, `${clip.duration.toFixed(2)}s`]),
  ]);
  renderHud(triangles, meshes, materials.size, size);
}

function renderHud(triangles, meshes, materials, size) {
  el('hud').innerHTML = `<dl>
    <dt>${state.current.id}</dt><dd>${state.mode}</dd>
    <dt>triangles</dt><dd>${triangles.toLocaleString()}</dd>
    <dt>draws</dt><dd>${meshes}</dd>
    <dt>materials</dt><dd>${materials}</dd>
    <dt>length</dt><dd>${Math.max(size.x, size.y, size.z).toFixed(3)} m</dd>
  </dl>`;
}

function applyLighting() {
  scene.environment = state.light === 'flat' ? null : environment;
  const existing = scene.getObjectByName('lights');
  if (existing) scene.remove(existing);
  scene.add(buildLights(state.light));
}

el('mode-view').addEventListener('click', () => setMode('view'));
el('mode-world').addEventListener('click', () => setMode('world'));
el('wire').addEventListener('click', event => {
  state.wireframe = !state.wireframe;
  event.currentTarget.classList.toggle('on', state.wireframe);
  state.root?.traverse(object => {
    if (!object.isMesh) return;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) material.wireframe = state.wireframe;
  });
});
el('spin').addEventListener('click', event => {
  state.spin = !state.spin;
  controls.autoRotate = state.spin;
  event.currentTarget.classList.toggle('on', state.spin);
});
el('reset').addEventListener('click', () => { if (state.root) frame(state.root); });
el('light').addEventListener('change', event => { state.light = event.target.value; applyLighting(); });
el('animation').addEventListener('change', event => {
  if (!state.mixer) return;
  state.mixer.stopAllAction();
  const found = state.clips.find(clip => clip.name === event.target.value);
  if (found) state.mixer.clipAction(found).reset().play();
});

function setMode(mode) {
  state.mode = mode;
  el('mode-view').classList.toggle('on', mode === 'view');
  el('mode-world').classList.toggle('on', mode === 'world');
  select(state.current);
}

function resize() {
  const parent = canvas.parentElement;
  const width = parent.clientWidth, height = parent.clientHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / Math.max(1, height);
  camera.updateProjectionMatrix();
}

new ResizeObserver(resize).observe(canvas.parentElement);

const clock = new THREE.Clock();

/** Handy for scripted inspection: set the camera, read the model's axes. */
window.__viewer = { THREE, scene, camera, controls, state, renderer, frame, loader, select };

renderer.setAnimationLoop(() => {
  const delta = clock.getDelta();
  state.mixer?.update(delta);
  controls.autoRotate = state.spin;
  controls.update();
  renderer.render(scene, camera);
});

(async () => {
  applyLighting();
  resize();
  const { entries, sources } = await loadManifests();
  state.entries = entries.sort((a, b) => a.category.localeCompare(b.category) || a.id.localeCompare(b.id));
  el('source-note').textContent = sources.length ? `sources: ${sources.join(' · ')}` : 'no manifests found';
  renderList();
  const preferred = state.entries.find(entry => entry.origin === 'cs2' && entry.id === 'ak-47') ?? state.entries[0];
  if (preferred) await select(preferred);
  else el('hud').innerHTML = '<span class="err">No weapon assets found. Run <code>npm run assets:cs2</code>.</span>';
})();
