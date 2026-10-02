import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true, args: ['--enable-unsafe-swiftshader','--use-angle=swiftshader'],
});
try {
  const page = await browser.newPage({ viewport:{width:1440,height:900}, locale:'en-US' });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('http://127.0.0.1:5173/');
  await page.waitForFunction(() => window.__game);
  const initial = await page.evaluate(() => {
    const p = window.__game.progress;
    return { weapons: Object.keys(p.data).length, player: p.player, allZero: Object.values(p.data).every(w => w.level === 0 && w.xp === 0) };
  });
  assert.equal(initial.weapons, 38);
  assert.equal(initial.player.level, 0);
  assert.ok(initial.allZero);
  const levels = await page.evaluate(() => {
    const p = window.__game.progress;
    const first = p.cost('ak-47');
    p.award('ak-47',99);
    const early = p.get('ak-47').level === 0 && p.get('ak-47').xp === 99;
    p.award('ak-47',1);
    const second = p.cost('ak-47');
    const isolated = p.get('m4a4').level === 0 && p.get('m4a4').xp === 0;
    return { first, second, early, isolated, level:p.get('ak-47').level };
  });
  assert.deepEqual(levels, { first:100, second:160, early:true, isolated:true, level:1 });
  await page.locator('#menu nav [data-action="armory"]').click();
  assert.equal(await page.locator('.catalog-categories button').count(), 7);
  assert.equal(await page.locator('[data-catalog-category="rifles"]~button').count() > 0, true);
  await page.locator('[data-equip-page="collection"]').click();
  // The fade butterfly is the free starter blade; the ruby M9 is still gated.
  await page.locator('[data-collection-select="butterfly-fade"]').click();
  assert.ok(!await page.locator('[data-collection-equip="butterfly-fade"]').isDisabled());
  await page.locator('[data-collection-select="m9-ruby"]').click();
  assert.ok(await page.locator('[data-collection-equip="m9-ruby"]').isDisabled());
  await page.locator('#dialog [data-action="close"]').click();
  await page.locator('#play').click();
  await page.waitForFunction(() => window.__game.running);
  const result = await page.evaluate(() => {
    const g = window.__game;
    for (const ai of g.ais) ai.update = () => {};
    const bot = g.bots[0]; bot.hp = 10; bot.protectedUntil = 0;
    const beforePlayer = g.progress.player.kills;
    const beforeWeapon = g.progress.get('m4a4').kills ?? 0;
    g.damage(bot, 20, g.player);
    const immediate = { player:g.progress.player.kills - beforePlayer, weapon:(g.progress.get('m4a4').kills ?? 0) - beforeWeapon, match:g.matchPlayerXp };
    const xpBeforeEnd = JSON.stringify(g.progress.data);
    const playerBeforeEnd = JSON.stringify(g.progress.player);
    g.match.remaining = .01;
    g.tick(.1);
    return { immediate, unchanged: xpBeforeEnd === JSON.stringify(g.progress.data)
      && playerBeforeEnd === JSON.stringify(g.progress.player), results:g.ui.screen,
      summary:g.ui.el('results-xp').textContent };
  });
  assert.deepEqual(result.immediate, { player:1, weapon:1, match:50 });
  assert.ok(result.unchanged, 'match end must not award XP again');
  assert.equal(result.results, 'results');
  assert.match(result.summary, /玩家 \+50 XP/);
  await page.reload();
  await page.waitForFunction(() => window.__game);
  assert.equal(await page.evaluate(() => window.__game.progress.player.kills), 1);
  assert.equal(await page.evaluate(() => window.__game.progress.get('m4a4').kills), 1);
  assert.deepEqual(errors, []);
  console.log({ initial, levels, result, errors });
} finally { await browser.close(); }
