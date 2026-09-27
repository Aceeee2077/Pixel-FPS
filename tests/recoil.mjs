import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
});
try {
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:5173/');
  const report = await page.evaluate(async () => {
    const { RecoilController } = await import('/src/weapons/recoil/RecoilController.ts');
    const { WEAPONS } = await import('/src/weapons/WeaponConfig.ts');
    const controller = new RecoilController();
    const first = Array.from({ length: 8 }, (_, i) => controller.next(WEAPONS.rifle, i * .1));
    controller.reset();
    const repeated = Array.from({ length: 8 }, (_, i) => controller.next(WEAPONS.rifle, i * .1));
    const recovery = controller.next(WEAPONS.rifle, 2);
    const smg = controller.next(WEAPONS.smg, 2.1);
    return { deterministic: JSON.stringify(first) === JSON.stringify(repeated),
      tapResets: JSON.stringify(recovery) === JSON.stringify(first[0]),
      distinct: JSON.stringify(smg) !== JSON.stringify(first[0]),
      sprayChanges: first[1].yaw !== first[6].yaw };
  });
  for (const [name, passed] of Object.entries(report)) {
    assert.ok(passed, name);
    console.log('PASS', name);
  }
} finally { await browser.close(); }
