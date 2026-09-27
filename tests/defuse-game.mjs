import { chromium } from 'playwright';
import assert from 'node:assert/strict';

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
  await page.locator('#play-defuse').click();
  await page.waitForFunction(() => window.__game?.running);
  await page.screenshot({ path: 'test-results/defuse-first-frame.png' });
  const report = await page.evaluate(() => {
    const g = window.__game;
    const initial = { mode: g.modeId, seats: g.actors.length, phase: g.round.phase, carrier: g.round.bomb.carrierId, map: g.map.definition.id };
    for (const ai of [...g.ais, ...g.tacticalAis]) ai.update = () => {};
    g.input.clear();
    const boughtVest = g.buy('vest') && g.player.armor === 100 && g.round.economy.balance(0) === 150;
    g.tick(6); g.tick(12);
    const lateBuyRejected = !g.buy('smg');
    g.player.protectedUntil = 0;
    g.damage(g.player, 40, g.bots[4]);
    const armorAbsorbs = g.player.hp === 80 && g.player.armor === 80;
    const live = g.round.phase === 'live';
    const [x, z] = g.map.definition.tactical.sites.A;
    g.player.position.set(x, 0, z);
    g.player.velocity.set(0, 0, 0);
    g.input.keys.add('KeyE');
    for (let i = 0; i < 198; i++) { g.tick(1 / 60); g.input.endFrame(); }
    const planted = g.round.phase === 'planted' && g.round.bomb.site === 'A';
    g.input.keys.delete('KeyE');
    const defender = g.bots[4];
    defender.position.set(x, 0, z);
    defender.velocity.set(0, 0, 0);
    for (let i = 0; i < 610; i++) { g.tick(1 / 60); g.input.endFrame(); }
    const defused = g.round.phase === 'end' && g.round.winner === 'defenders';
    // Jump to the end of round six to exercise the halftime transition.
    g.round.round = 6;
    g.round.phaseLeft = 0;
    g.tick(1 / 60);
    const sideSwapped = g.round.round === 7 && g.defuseMode.team(g.player) === 'defenders'
      && g.round.bomb.carrierId === 5;
    const boughtKit = g.buy('kit') && g.player.hasDefuseKit;
    g.tick(6); g.tick(12);
    const [bx, bz] = g.map.definition.tactical.sites.B;
    const carrier = g.actors.find(a => a.id === g.round.bomb.carrierId);
    carrier.position.set(bx, 0, bz);
    carrier.velocity.set(0, 0, 0);
    g.player.position.set(bx, 0, bz);
    g.player.velocity.set(0, 0, 0);
    for (let i = 0; i < 198; i++) { g.tick(1 / 60); g.input.endFrame(); }
    const botPlanted = g.round.phase === 'planted' && g.round.bomb.site === 'B';
    g.input.keys.add('KeyE');
    for (let i = 0; i < 305; i++) { g.tick(1 / 60); g.input.endFrame(); }
    const playerDefused = g.round.phase === 'end' && g.round.winner === 'defenders'
      && g.round.reason === 'defuse';
    g.input.keys.delete('KeyE');
    g.mainMenu(); g.start(false, 'blockyard', 'ffa');
    const ffaRestored = g.modeId === 'ffa' && g.actors.length === 8 && g.bots.length === 7;
    return { initial, boughtVest, lateBuyRejected, armorAbsorbs, live, planted, defused, sideSwapped, boughtKit, botPlanted, playerDefused, ffaRestored };
  });
  console.log(report, errors);
  assert.deepEqual(report.initial, { mode: 'defuse', seats: 10, phase: 'freeze', carrier: 0, map: 'sandstorm' });
  assert.ok(report.boughtVest, 'vest can be bought during freeze');
  assert.ok(report.lateBuyRejected, 'buying is blocked during live combat');
  assert.ok(report.armorAbsorbs, 'armor reduces HP damage and depletes');
  assert.ok(report.live, 'round enters live phase');
  assert.ok(report.planted, 'player can plant at site A');
  assert.ok(report.defused, 'defender bot can defuse');
  assert.ok(report.sideSwapped, 'teams swap after round six');
  assert.ok(report.boughtKit, 'defender can buy a defuse kit');
  assert.ok(report.botPlanted, 'attacker bot can plant at site B');
  assert.ok(report.playerDefused, 'player can defuse with a kit');
  assert.ok(report.ffaRestored, 'FFA remains available after Defuse');
  assert.deepEqual(errors, [], 'no browser errors');
  console.log(report);
} finally {
  await browser.close();
}




