import { chromium } from 'playwright';
import { createServer } from 'vite';
import { Worker } from 'node:worker_threads';
import { once } from 'node:events';
import assert from 'node:assert/strict';
import fs from 'node:fs';

fs.mkdirSync('test-results', { recursive: true });
const signalling = new Worker(new URL('./peer-server.mjs', import.meta.url));
await once(signalling, 'message');
const vite = await createServer({ server: { port: 5174, host: '127.0.0.1' }, define: {
    'import.meta.env.VITE_PEER_HOST': JSON.stringify('127.0.0.1'),
    'import.meta.env.VITE_PEER_PORT': JSON.stringify('9001'),
    'import.meta.env.VITE_PEER_SECURE': JSON.stringify('false'),
} });
await vite.listen();
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--disable-background-timer-throttling'] });
const host = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const guest = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [], checks = [];
const check = (name, value) => { assert.ok(value, name); checks.push(name); console.log('PASS', name); };
for (const page of [host, guest]) page.on('pageerror', e => errors.push(e.message));
try {
    for (const page of [host, guest]) { await page.goto('http://127.0.0.1:5174'); await page.waitForFunction(() => window.__game); }
    await host.evaluate(async () => { const g = window.__game; g.ui.multiplayer(); await g.network.connect(true, '', 'HOST'); });
    await host.waitForFunction(() => window.__game.network.active && window.__game.ui.screen === 'playing');
    const code = await host.evaluate(() => window.__game.network.room.code);
    await guest.evaluate(async code => { const g = window.__game; g.ui.multiplayer(); await g.network.connect(false, code, 'HOST'); }, code);
    await guest.waitForFunction(() => window.__game.network.actors.length === 2 && window.__game.ui.screen !== 'menu', { timeout: 20000 });
    check('Two isolated browsers join the same room over real WebRTC', await host.evaluate(() => window.__game.actors.length === 2));
    for (const page of [host, guest]) await page.evaluate(() => { const g = window.__game; g.renderer.setAnimationLoop(null); g.input.suspend(); g.running = false; });
    check('Online mode hides all local bots', await host.evaluate(() => window.__game.bots.every(b => !b.group.visible)));
    const map = await host.evaluate(() => window.__game.map.definition.id);
    check('Guest uses host map and clock', await guest.evaluate(map => { const g = window.__game; return g.map.definition.id === map && Math.abs(g.time - (300 - g.match.remaining)) < .2; }, map));
    check('Both peers see identical randomized supplies', JSON.stringify(await host.evaluate(() => window.__game.pickups.snapshot())) === JSON.stringify(await guest.evaluate(() => window.__game.pickups.snapshot())));
    await host.evaluate(() => { const g = window.__game, r = [...g.network.remotes.values()][0]; g.player.position.set(-2, 0, 18); g.player.yaw = 0; g.player.pitch = Math.atan2(-.6, 4); g.player.protectedUntil = 0; r.actor.position.set(-2, 0, 14); r.actor.protectedUntil = 0; g.player.update(.001, g.input, g.map); });
    await guest.evaluate(() => { const g = window.__game; g.player.position.set(-2, 0, 14); g.player.yaw = Math.PI; g.player.pitch = Math.atan2(-.6, 4); g.player.update(.001, g.input, g.map); });
    await host.evaluate(() => window.__game.shootPlayer());
    await guest.waitForFunction(() => window.__game.player.hp === 75);
    check('Host shot damages guest and synchronizes health', true);
    await guest.evaluate(() => window.__game.shootPlayer());
    await host.waitForFunction(() => window.__game.player.hp === 75);
    check('Guest shot is resolved by host and damages host', await host.evaluate(() => [...window.__game.network.remotes.values()][0].loadout.current.ammo === 29));
    // A client cannot inject a claimed victim or arbitrary damage amount.
    await guest.evaluate(() => window.__game.network.room.send({ type: 'damage', victim: 0, damage: 100000 }));
    await host.waitForTimeout(100);
    check('Client damage claims are ignored', await host.evaluate(() => window.__game.player.hp === 75));
    await host.evaluate(() => { const g = window.__game, r = [...g.network.remotes.values()][0], item = g.pickups.items.find(i => i.kind === 'health'); item.position = r.actor.position.toArray(); item.readyAt = 0; g.pickups.update(g.time, g.actors, a => g.network.loadout(a).slots, (a,k,n) => g.network.pickup(a,k,n)); });
    await guest.waitForFunction(() => window.__game.player.hp === 100);
    check('Guest collects medkit once and host broadcasts result', await host.evaluate(() => window.__game.pickups.items.find(i => i.kind === 'health').readyAt > window.__game.time));
    await host.evaluate(() => { const g = window.__game, r = [...g.network.remotes.values()][0], item = g.pickups.items.find(i => i.kind === 'ammo'); r.loadout.slots[0].reserve = 0; item.position = r.actor.position.toArray(); item.readyAt = 0; g.pickups.update(g.time, g.actors, a => g.network.loadout(a).slots, (a,k,n) => g.network.pickup(a,k,n)); });
    await guest.waitForFunction(() => window.__game.weapons.slots[0].reserve === 30);
    check('Ammo pickup restores a magazine of reserve on both peers', true);

    await guest.evaluate(() => { const g=window.__game;g.weapon.reload();g.network.command('reload'); });
    await host.waitForFunction(() => [...window.__game.network.remotes.values()][0].loadout.current.reloadLeft > 0);
    await host.evaluate(() => { const g=window.__game;for(let i=0;i<40;i++)g.tick(.05); });
    await guest.waitForFunction(() => window.__game.weapon.ammo === 30 && window.__game.weapon.reserve === 29);
    check('Host validates reload and conserves guest ammunition', true);
    await guest.evaluate(() => { const g=window.__game;g.weapons.select(2);g.network.command('switch',2);g.weapons.update(.8); });
    await host.waitForFunction(() => [...window.__game.network.remotes.values()][0].loadout.slot === 2);
    await host.evaluate(() => { const g=window.__game;for(let i=0;i<16;i++)g.tick(.05);const r=[...g.network.remotes.values()][0];r.actor.position.set(-2,0,16.2); });
    await guest.evaluate(() => { const g=window.__game;g.player.position.set(-2,0,16.2);g.player.yaw=Math.PI;g.player.pitch=Math.atan2(-.6,1.8);g.player.update(.001,g.input,g.map);g.meleeAttack('light'); });
    await host.waitForFunction(() => [...window.__game.network.remotes.values()][0].loadout.current.attack === 'light');
    check('Guest knife switch reaches host and blocks instant damage', await host.evaluate(() => window.__game.player.hp === 75));
    await host.evaluate(() => { const g=window.__game;for(let i=0;i<4;i++)g.tick(.05); });
    check('Guest knife damage lands on host strike frame', await host.evaluate(() => window.__game.player.hp === 30));
    await guest.evaluate(() => { const g=window.__game;g.player.position.x+=.2;g.network.sendPose(); });
    await host.waitForFunction(() => Math.abs([...window.__game.network.remotes.values()][0].actor.position.x+1.8)<.05);
    check('Remote movement synchronizes', true);
    const hp=await host.evaluate(()=>window.__game.player.hp);
    await guest.evaluate(()=>window.__game.network.room.send({type:'action',round:-1,seq:999,action:'fire'}));
    await host.waitForTimeout(100);
    check('Packets from an old round are ignored', await host.evaluate(hp=>window.__game.player.hp===hp,hp));
    await host.evaluate(() => { const g = window.__game, r = [...g.network.remotes.values()][0]; g.damage(r.actor, 150, g.player); });
    await guest.waitForFunction(() => !window.__game.player.alive && window.__game.player.deaths === 1);
    check('Duplicate nicknames retain distinct kill identities', await guest.evaluate(() => {const g=window.__game;return g.match.feed[0].killerId===0&&g.match.feed[0].victimId===g.player.id;}));
    check('Kill, score and death synchronize', await guest.evaluate(() => window.__game.actors.find(a => a.id === 0).score === 1));
    await host.evaluate(() => { const g = window.__game; for (let i=0;i<62;i++) {g.tick(.05);g.input.endFrame();} });
    await guest.waitForFunction(() => window.__game.player.alive && window.__game.player.hp === 100);
    check('Host respawns guest after three seconds', true);
    const before = await host.evaluate(() => window.__game.time);
    await host.evaluate(() => { const g = window.__game; g.pause(); g.tick(.05); });
    check('Pause menu does not freeze an online match', await host.evaluate(before => window.__game.time > before, before));
    await host.evaluate(() => { const g=window.__game;g.match.remaining=.01;g.tick(.05); });
    await guest.waitForFunction(() => window.__game.match.ended);
    await guest.evaluate(() => window.__game.tick(.01));
    check('Both players reach the same match results', await guest.evaluate(() => window.__game.ui.screen === 'results' && window.__game.lastXp.length === 0));
    await host.screenshot({ path: 'test-results/online-results.png' });
    await host.evaluate(() => window.__game.start(true));
    await guest.waitForFunction(() => !window.__game.match.ended && window.__game.player.deaths === 0);
    check('Host rematch resets shared scores and inventory', await guest.evaluate(() => window.__game.actors.every(a => a.score === 0) && window.__game.weapon.ammo === 30));
    await guest.evaluate(() => window.__game.mainMenu());
    await host.waitForFunction(() => window.__game.actors.length === 1);
    check('Leaving removes the remote player', true);
    await guest.evaluate(async code => { const g=window.__game;g.ui.multiplayer();await g.network.connect(false,code,'GUEST'); }, code);
    await guest.waitForFunction(() => window.__game.actors.length === 2);
    check('Guest can rejoin the same room', true);
    await host.evaluate(() => window.__game.mainMenu());
    await guest.waitForFunction(() => !window.__game.network.active && window.__game.ui.screen === 'menu');
    check('Host departure closes room cleanly', true);
    check('No browser exceptions', errors.length === 0);
    fs.writeFileSync('test-results/online-report.json', JSON.stringify({ checks, errors }, null, 2));
} catch (e) {
    console.error(e, errors);
    console.error('HOST', await host.evaluate(() => ({ active:window.__game.network.active, screen:window.__game.ui.screen, actors:window.__game.actors.map(a=>({id:a.id,hp:a.hp,position:a.position.toArray()})), notice:document.querySelector('#notice').textContent, message:document.querySelector('#network-message')?.textContent })));
    console.error('GUEST', await guest.evaluate(() => ({ active:window.__game.network.active, screen:window.__game.ui.screen, id:window.__game.player.id, notice:document.querySelector('#notice').textContent, message:document.querySelector('#network-message')?.textContent })));
    await host.screenshot({ path:'test-results/online-failure.png' }); process.exitCode=1;
} finally { await browser.close(); await vite.close(); await signalling.terminate(); }
