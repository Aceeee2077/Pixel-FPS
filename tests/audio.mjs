import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
const page = await browser.newPage();
const errors = [], checks = [];
page.on('pageerror', e => errors.push(e.message));
const check = (name, value) => { assert.ok(value, name); checks.push(name); console.log('PASS', name); };
fs.mkdirSync('test-results/audio', { recursive: true });
try {
    await page.goto(process.env.AUDIO_TEST_URL || 'http://127.0.0.1:5173');
    await page.waitForFunction(() => window.__game);
    await page.evaluate(() => window.__game.renderer.setAnimationLoop(null));
    const report = await page.evaluate(async () => {
        const { AudioManager } = await import('/src/audio/AudioManager.ts');
        const { GUN_SOUND, gunSamples, foleySamples, soundPosition } = await import('/src/audio/WeaponSounds.ts');
        const { Weapon } = await import('/src/weapons/Weapon.ts');
        const { WEAPONS } = await import('/src/weapons/WeaponConfig.ts');
        const energy = data => data.reduce((sum, v) => sum + v * v, 0) / Math.max(1, data.length);
        const peak = data => data.reduce((max, v) => Math.max(max, Math.abs(v)), 0);
        const profiles = [];
        for (const rate of [44100, 48000]) for (const id of Object.keys(GUN_SOUND)) {
            const a = gunSamples(id, rate, 0), b = gunSamples(id, rate, 1);
            profiles.push({ id, rate, peak: peak(a), finite: a.every(Number.isFinite), edge: a[0] === 0 && a.at(-1) === 0,
                attack: energy(a.slice(0, Math.floor(rate * .05))), tail: energy(a.slice(Math.floor(rate * .2))),
                varied: a.some((v, i) => Math.abs(v - b[i]) > .05) });
        }
        const settings = { data: { volume: .6, sfx: .8 } };
        const render = async (seconds, events, volume = .6) => {
            const context = new OfflineAudioContext(2, Math.ceil(48000 * seconds), 48000);
            const a = new AudioManager({ data: { volume, sfx: .8 } }, context);
            const start = performance.now(); a.unlock(); const warmup = performance.now() - start;
            for (const [time, action] of events) context.suspend(time).then(() => { action(a); return context.resume(); });
            const buffer = await context.startRendering();
            await new Promise(resolve => setTimeout(resolve, 0));
            return { a, buffer, warmup, left: buffer.getChannelData(0), right: buffer.getChannelData(1) };
        };
        const left = await render(1.2, [[.02, a => a.gun('rifle', 10, -1)]]);
        const right = await render(1.2, [[.02, a => a.gun('rifle', 10, 1)]]);
        const near = await render(1.2, [[.02, a => a.gun('rifle')]]);
        const far = await render(1.2, [[.02, a => a.gun('rifle', 90)]]);
        const mute = await render(1.2, [[.02, a => a.gun('rifle')]], 0);
        const burst = await render(2.5, Array.from({ length: 15 }, (_, i) => [.02 + i * .08, a => { a.gun('rifle'); for (let bot=0;bot<7;bot++) a.gun('smg', 15 + bot*5, (bot-3)/3); }]));
        const turn = soundPosition({ x: 0, y: 0, z: -10 }, { x: 0, y: 0, z: 0 }, Math.PI / 2);

        // Reload markers must follow weapon progress; cancellation must stop scheduled foley.
        const context = new OfflineAudioContext(2, 48000, 48000), a = new AudioManager(settings, context); a.unlock();
        const played = []; const original = a.foley.bind(a); a.foley = (...args) => { played.push(args[0]); original(...args); };
        const w = new Weapon(WEAPONS.rifle); w.ammo = 3; w.reload(); a.reload(w);
        w.update(.95); a.updateWeapon(w, true);
        const magazineStages = played.join(',') === 'mag-out,mag-in';
        a.updateWeapon(new Weapon(WEAPONS.pistol), true); const afterSwitch = played.length;
        w.update(2); a.updateWeapon(w, false);
        const cancelled = played.length === afterSwitch && a.voices === 0;
        a.drawBlade(true); const scheduled = a.voices; a.cancelWeapon();
        const cancelDraw = scheduled === 4 && a.voices === 0;
        a.stopAll();

        const demoReload = new Weapon(WEAPONS.rifle); demoReload.ammo = 3;
        const events = [[.2, a => a.gun('rifle')], [.85, a => a.gun('rifle')]];
        for (let i=0;i<7;i++) events.push([1.6+i*.1, a=>a.gun('rifle')]);
        for (let i=0;i<8;i++) events.push([3.1+i*.075, a=>a.gun('smg')]);
        events.push([4.45,a=>a.gun('pistol')],[4.95,a=>a.gun('pistol')],[5.75,a=>a.gun('sniper')],[7.05,a=>a.gun('shotgun')],
            [8.3,a=>{demoReload.reload();a.reload(demoReload);}],
            [9.18,a=>{demoReload.update(.88);a.updateWeapon(demoReload,true);}],
            [9.84,a=>{demoReload.update(.66);a.updateWeapon(demoReload,true);}],
            [10.12,a=>{demoReload.update(.28);a.updateWeapon(demoReload,true);}],
            [10.65,a=>a.drawBlade(true)],[11.5,a=>a.melee('light')],[12,a=>a.melee('heavy')],[12.4,a=>a.meleeHit()]);
        const demo = await render(13.2, events);
        const bytes = new Uint8Array(demo.left.length * 4), view = new DataView(bytes.buffer);
        for(let i=0;i<demo.left.length;i++) for(let c=0;c<2;c++) view.setInt16(i*4+c*2, Math.round(Math.max(-1,Math.min(1,c ? demo.right[i] : demo.left[i]))*32767), true);
        let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
        window.__audioDemo=btoa(binary);
        return { profiles, left: energy(left.left) > energy(left.right)*100, right: energy(right.right) > energy(right.left)*100,
            turned: turn.pan > .99, quieter: energy(far.left) < energy(near.left) * .1, muted: peak(mute.left) === 0,
            burstPeak: Math.max(peak(burst.left),peak(burst.right)), released: burst.a.voices === 0,
            magazineStages, cancelled, cancelDraw, warmupMs: near.warmup,
            foleyFinite: ['mag-out','mag-in','bolt','draw','blade','fold','light','heavy','impact','head'].every(k=>foleySamples(k,48000).every(Number.isFinite)),
        };
    });
    check('Five gun profiles remain finite, bounded and click-free at both sample rates', report.profiles.every(p => p.finite && p.edge && p.peak <= .921));
    check('Every gun has a sharp attack, decaying tail and alternate recordings', report.profiles.every(p => p.attack > p.tail * 3 && p.varied));
    check('Left and right sound sources remain distinct', report.left && report.right && report.turned);
    check('Distant fire is quieter and mute produces silence', report.quieter && report.muted);
    check('Eight simultaneous shooters stay below clipping', report.burstPeak < .99 && report.burstPeak > .01);
    check('Finished voices release audio nodes', report.released);
    check('Reload stages follow game progress', report.magazineStages);
    check('Switching or death cancels remaining reload sounds', report.cancelled);
    check('Interrupted knife draws cancel scheduled sounds', report.cancelDraw);
    check('All mechanical and melee sounds contain valid samples', report.foleyFinite);
    check('No browser exceptions', errors.length === 0);
    const pcm = Buffer.from(await page.evaluate(() => window.__audioDemo), 'base64');
    const header = Buffer.alloc(44);header.write('RIFF');header.writeUInt32LE(36+pcm.length,4);header.write('WAVEfmt ',8);header.writeUInt32LE(16,16);header.writeUInt16LE(1,20);header.writeUInt16LE(2,22);header.writeUInt32LE(48000,24);header.writeUInt32LE(192000,28);header.writeUInt16LE(4,32);header.writeUInt16LE(16,34);header.write('data',36);header.writeUInt32LE(pcm.length,40);
    fs.writeFileSync('test-results/audio/weapon-demo.wav', Buffer.concat([header,pcm]));
    fs.writeFileSync('test-results/audio/report.json',JSON.stringify({checks,report,errors},null,2));
    console.log('Audio bank warmup:',report.warmupMs.toFixed(1),'ms; full combat peak:',report.burstPeak.toFixed(3));
} finally { await browser.close(); }
