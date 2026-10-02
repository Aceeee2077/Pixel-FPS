import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';

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
  await page.locator('#play').click();
  await page.waitForFunction(() => window.__game?.running);
  const result = await page.evaluate(async () => {
    const g = window.__game;
    const styles = ['butterfly-emerald', 'butterfly-fade', 'karambit-emerald', 'm9-ruby'];
    g.weapons.select(2);
    g.weapons.switchLeft = 0;
    for (const style of styles) {
      g.weapons.appearance.knifeStyle = style;
      g.updateView(.016);
      g.viewmodel.render(g.renderer, g.scene, g.camera);
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    const knifeGlb = await g.weaponAssets.loadView('knife', g.weapons.appearance);
    g.viewmodel.render(g.renderer, g.scene, g.camera);
    const before = g.renderer.info.memory.geometries;
    for (let i = 0; i < 20; i++) {
      g.weapons.appearance.knifeStyle = styles[i % styles.length];
      g.updateView(.016);
      g.viewmodel.render(g.renderer, g.scene, g.camera);
    }
    await new Promise(resolve => setTimeout(resolve, 60));
    return { fallback: g.view.userData.weapon === 'knife', knifeGlbPath: knifeGlb?.userData.assetPath,
      geometryGrowth: g.renderer.info.memory.geometries - before,
      inSeparateScene: g.view.parent === g.viewmodel.camera && g.view.parent !== g.camera };
  });
  console.log('KNIFE RESOURCE REPORT', result);
  assert.ok(result.fallback, 'procedural knife fallback remains visible');
  // The M9 must resolve to its own blade, never a shared generic knife. Which
  // file that is depends on whether the optional Counter-Strike 2 conversion
  // has been run on this machine: the converted M9 is the original model and
  // takes precedence over this project's stand-in when it is present.
  const m9Assets = ['/assets/weapons/m9/m9.glb', '/generated-assets/cs2/m9/view.glb'];
  assert.ok(m9Assets.includes(result.knifeGlbPath), `M9 finish uses its dedicated GLB (got ${result.knifeGlbPath})`);
  assert.ok(result.inSeparateScene, 'knife is rendered by viewmodel camera');
  assert.ok(result.geometryGrowth <= 2, 'repeated skin switches share cached geometry');
  const manifestCandidates = ['dist/assets/weapons/manifest.json', 'public/assets/weapons/manifest.json'];
  assert.ok(manifestCandidates.some(file => fs.existsSync(file)), 'weapon manifest path exists');
  assert.deepEqual(errors, [], 'no browser errors');
  console.log(result);
} finally {
  await browser.close();
}
