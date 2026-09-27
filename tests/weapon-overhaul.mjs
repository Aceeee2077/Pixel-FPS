import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true, args: ['--enable-unsafe-swiftshader','--use-angle=swiftshader'],
});
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: 'en-US' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('http://127.0.0.1:5173/');
  await page.waitForFunction(() => window.__game);
  const registry = await page.evaluate(async () => {
    const data = await import('/src/data/weapons.ts');
    return { count: data.weaponRegistry.length, buyable: data.buyableWeapons.length, categories: data.weaponCategories.length,
      ids: data.weaponRegistry.map(w => w.id), image: !!data.getWeapon('ak-47').previewImage };
  });
  assert.equal(registry.count, 38);
  assert.equal(registry.buyable, 34);
  assert.equal(registry.categories, 7);
  assert.ok(registry.image);
  const modelCheck = await page.evaluate(async () => {
    const { weaponRegistry } = await import('/src/data/weapons.ts');
    const { weaponModel } = await import('/src/weapons/WeaponModel.ts');
    const summary = weaponRegistry.map(weapon => {
      const model = weaponModel(weapon.id);
      let meshes = 0;
      model.traverse(part => { if (part.isMesh) meshes++; });
      return { id: weapon.id, meshes };
    });
    const knives = ['knife','butterfly','karambit','m9'].map(id => {
      const model = weaponModel(id);
      return { id, meshes: model.children.length };
    });
    return { summary, knives };
  });
  assert.ok(modelCheck.summary.every(item => item.meshes > 0));
  assert.ok(new Set(modelCheck.knives.map(item => item.meshes)).size >= 2);
  await page.locator('#menu nav [data-action="armory"]').click();
  assert.equal(await page.locator('.catalog-card').count(), 7);
  await page.locator('[data-catalog-category="pistols"]').click();
  assert.equal(await page.locator('.catalog-card').count(), 10);
  await page.locator('[data-catalog-category="rifles"]').click();
  await page.locator('[data-catalog-weapon="ak-47"]').click();
  assert.match(await page.locator('.catalog-detail').innerText(), /AK-47/);
  assert.ok(await page.locator('.catalog-reference img').isVisible());
  await page.locator('[data-viewer="3d"]').click();
  assert.ok(await page.locator('#armory-canvas canvas').isVisible());
  await page.waitForTimeout(100);
  await page.screenshot({ path: 'test-results/weapon-overhaul-armory.png' });
  const preview = () => page.evaluate(() => {
    const p = window.__game.ui.equipment.preview;
    p.render(0);
    return p.renderer.info.memory.geometries;
  });
  const memoryBefore = await preview();
  for (let i = 0; i < 3; i++) {
    await page.locator('[data-catalog-weapon="m4a4"]').click({ force: true });
    await page.locator('[data-viewer="3d"]').click({ force: true });
    await preview();
    await page.locator('[data-catalog-weapon="ak-47"]').click({ force: true });
    await page.locator('[data-viewer="3d"]').click({ force: true });
    await preview();
  }
  const memoryAfter = await preview();
  assert.ok(memoryAfter <= memoryBefore + 2, `Preview geometry leak: ${memoryBefore} -> ${memoryAfter}`);
  await page.locator('[data-viewer="reference"]').click({ force: true });
  await page.locator('#catalog-search').fill('m4');
  assert.equal(await page.locator('.catalog-card').count(), 2);
  await page.locator('[data-equip-page="collection"]').click();
  await page.locator('[data-collection-select="butterfly-fade"]').click();
  assert.ok(await page.locator('[data-collection-equip="butterfly-fade"]').isDisabled());
  assert.ok(await page.locator('#collection-canvas canvas').isVisible());
  await page.locator('[data-collection-select="copper"]').click();
  assert.ok(await page.locator('[data-collection-equip="copper"]').isDisabled());
  await page.evaluate(() => window.__game.progress.award('glock', 100));
  await page.locator('[data-collection-select="copper"]').click();
  await page.locator('[data-collection-equip="copper"]').click();
  assert.equal(await page.evaluate(() => window.__game.loadout.get('attackers').pistolSkin), 'copper');
  await page.locator('[data-equip-page="loadout"]').click();
  await page.locator('[data-loadout-change="preferredRifle"]').click();
  await page.locator('[data-loadout-id="galil-ar"]').click();
  const before = await page.evaluate(() => ({ attacker: window.__game.loadout.get('attackers').preferredRifle,
    defender: window.__game.loadout.get('defenders').preferredRifle }));
  assert.deepEqual(before, { attacker: 'galil-ar', defender: 'm4a1-s' });
  await page.reload();
  await page.waitForFunction(() => window.__game);
  assert.equal(await page.evaluate(() => window.__game.loadout.get('attackers').pistolSkin), 'copper');
  assert.deepEqual(await page.evaluate(() => ({ attacker: window.__game.loadout.get('attackers').preferredRifle,
    defender: window.__game.loadout.get('defenders').preferredRifle })), before);
  await page.locator('#play').click();
  await page.waitForFunction(() => window.__game.running);
  const xp = await page.evaluate(() => {
    const g = window.__game;
    for (const ai of g.ais) ai.update = () => {};
    const p = g.progress, beforePlayer = p.player.kills;
    const [a,b] = g.bots;
    for (const bot of [a,b]) { bot.hp = 10; bot.alive = true; bot.protectedUntil = 0; g.damage(bot, 20, g.player); }
    const once = { player: p.player.kills - beforePlayer, weapon: p.get('m4a4').kills, other: p.get('glock').kills,
      match: g.matchPlayerXp, current: p.get('m4a4').level, weaponXp: p.get('m4a4').xp };
    g.damage(a, 20, g.player);
    const duplicate = p.player.kills - beforePlayer;
    g.player.protectedUntil = 0; g.damage(g.player, 200, g.player);
    const suicide = p.player.kills - beforePlayer;
    return { once, duplicate, suicide };
  });
  assert.equal(xp.once.player, 2);
  assert.equal(xp.once.match, 100);
  assert.equal(xp.once.weapon, 2);
  assert.equal(xp.once.other, 0);
  assert.equal(xp.duplicate, 2);
  assert.equal(xp.suicide, 2);
  await page.reload();
  await page.waitForFunction(() => window.__game);
  assert.equal(await page.evaluate(() => window.__game.progress.player.kills), 2);
  assert.equal(await page.evaluate(() => window.__game.progress.get('m4a4').kills), 2);
  await page.locator('#play-defuse').click();
  await page.waitForFunction(() => window.__game.running);
  const buy = await page.evaluate(async () => {
    const g = window.__game;
    const { BUY_ITEMS } = await import('/src/game/round/BuySystem.ts');
    const start = { pistol: g.weapons.slots[1].config.id, primary: g.weapons.slots[0].config.id,
      zone: g.inBuyZone(), status: g.buyStatus('ak-47'), playerLevel:g.progress.player.level, weaponLevel:g.progress.get('ak-47').level };
    g.round.economy.award(g.player.id, 4000);
    const spawn = g.player.position.clone();
    g.player.position.set(0,0,0);
    const outsideZone = g.buyStatus('ak-47');
    g.player.position.copy(spawn);
    const available = g.buyStatus('ak-47');
    const purchased = g.buy('ak-47');
    const equipped = g.weapons.slots[0].config.id;
    const wrongSide = g.buySystem.status(g.round, g.player.id, 'defenders', 'ak-47', { inZone: true, owned: new Set() });
    const teammate = g.bots[0]; teammate.hp = 10; teammate.protectedUntil = 0;
    const playerBefore = g.progress.player.kills;
    g.round.update(6, new Map(g.actors.map(a=>[a.id,a.alive])), g.defuseMode.teams);
    g.round.update(12, new Map(g.actors.map(a=>[a.id,a.alive])), g.defuseMode.teams);
    g.damage(teammate, 200, g.player);
    const ammoBefore = g.weapon.ammo;
    g.shootPlayer();
    const akFires = g.weapon.ammo === ammoBefore - 1;
    const teamKill = g.progress.player.kills === playerBefore && teammate.alive;
    const late = g.buyStatus('m4a4');
    return { start, outsideZone, available, purchased, equipped, wrongSide, teamKill, akFires, late,
      pool: BUY_ITEMS.filter(item => item.weapon).length };
  });
  assert.deepEqual(buy.start, { pistol:'glock', primary:'knife', zone:true, status:'TOO EXPENSIVE', playerLevel:0, weaponLevel:0 });
  assert.equal(buy.outsideZone, 'OUTSIDE BUY ZONE');
  assert.equal(buy.available, 'AVAILABLE');
  assert.equal(buy.purchased, true);
  assert.equal(buy.equipped, 'ak-47');
  assert.equal(buy.wrongSide, 'WRONG SIDE');
  assert.equal(buy.teamKill, true);
  assert.equal(buy.akFires, true);
  assert.equal(buy.late, 'BUY TIME ENDED');
  assert.equal(buy.pool, 34);
  const remoteXp = await page.evaluate(() => {
    const g = window.__game, net = g.network;
    const before = g.progress.player.kills;
    net.active = true; net.room.host = false; net.room.code = 'TESTABCD';
    const event = { type:'xp', eventId:'1:7:1', weapon:'ak-47', amount:50 };
    net.receive('untrusted-peer', event);
    const ignored = g.progress.player.kills === before;
    net.receive('blockstrike-v1-TESTABCD', event);
    net.receive('blockstrike-v1-TESTABCD', event);
    const once = g.progress.player.kills === before + 1;
    net.active = false;
    return { ignored, once };
  });
  assert.deepEqual(remoteXp, { ignored:true, once:true });
  assert.deepEqual(errors, []);
  console.log({ registry, xp, buy, remoteXp, errors });
} finally { await browser.close(); }
