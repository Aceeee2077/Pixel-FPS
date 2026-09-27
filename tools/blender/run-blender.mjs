/**
 * Locate Blender and run a pipeline script through it.
 *
 *   node tools/blender/run-blender.mjs build_weapon.py -- --weapon ak-47
 *   node tools/blender/run-blender.mjs build_all_weapons.py
 *   node tools/blender/run-blender.mjs build_reference_manifest.py
 *
 * Search order: $BLENDER_PATH, `blender` on PATH, then the standard Windows
 * install roots (newest version first). Exits with a clear message and the
 * paths it tried when nothing is found.
 */
import { existsSync, readdirSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');

function candidates() {
  const found = [];
  if (process.env.BLENDER_PATH) found.push(process.env.BLENDER_PATH);
  if (process.platform === 'win32') {
    for (const base of [
      'C:/Program Files/Blender Foundation',
      'C:/Program Files (x86)/Blender Foundation',
      join(process.env.LOCALAPPDATA || '', 'Programs/Blender Foundation'),
    ]) {
      if (!base || !existsSync(base)) continue;
      const versions = readdirSync(base)
        .filter(name => name.startsWith('Blender'))
        .map(name => ({ name, path: join(base, name, 'blender.exe') }))
        .filter(entry => existsSync(entry.path))
        .sort((a, b) => b.name.localeCompare(a.name, undefined, { numeric: true }));
      found.push(...versions.map(entry => entry.path));
    }
  } else {
    found.push('/usr/bin/blender', '/usr/local/bin/blender', '/Applications/Blender.app/Contents/MacOS/Blender');
  }
  return found.filter(path => { try { return statSync(path).isFile(); } catch { return false; } });
}

const blender = (() => {
  for (const candidate of candidates()) if (existsSync(candidate)) return candidate;
  const onPath = spawnSync('blender', ['--version'], { stdio: 'ignore', shell: process.platform === 'win32' });
  if (onPath.status === 0) return 'blender';
  return null;
})();

if (!blender) {
  console.error('Blender was not found.');
  console.error('Set BLENDER_PATH, add blender to PATH, or install it to:');
  console.error('  C:\\Program Files\\Blender Foundation\\Blender <version>\\blender.exe');
  console.error('Tried:');
  for (const candidate of candidates()) console.error('  ' + candidate);
  process.exit(1);
}

const [script, ...rest] = process.argv.slice(2);
if (!script) {
  console.error('usage: node tools/blender/run-blender.mjs <script.py> [-- <script args>]');
  process.exit(1);
}
const scriptPath = join(here, script);
if (!existsSync(scriptPath)) {
  console.error(`No such pipeline script: ${scriptPath}`);
  process.exit(1);
}

console.log(`blender: ${blender}`);
console.log(`script : tools/blender/${script}`);
const args = ['-b', '--factory-startup', '-P', scriptPath, ...rest];
const result = spawnSync(blender, args, { stdio: 'inherit', cwd: root });
process.exit(result.status ?? 1);
