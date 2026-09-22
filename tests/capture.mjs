import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
const checks=[];
const check=(name,condition)=>{assert.ok(condition,name);checks.push(name);console.log('PASS',name);};
try {
  for(const failure of ['rejected','event-only','missing','silent','delayed']) {
    const context=await browser.newContext({viewport:{width:1000,height:700},locale:'en-US'});
    const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(failure=>{
      window.__captureRequests=0;
      if(failure==='missing'){HTMLElement.prototype.requestPointerLock=undefined;return;}
      HTMLElement.prototype.requestPointerLock=function(){
        window.__captureRequests++;
        if(failure==='silent')return;
        if(failure==='event-only'){setTimeout(()=>document.dispatchEvent(new Event('pointerlockerror')),0);return;}
        if(failure==='delayed')return new Promise((_,reject)=>setTimeout(()=>reject(new DOMException('The root document is not valid for pointer lock.','WrongDocumentError')),800));
        document.dispatchEvent(new Event('pointerlockerror'));
        return Promise.reject(new DOMException('Embedded browser cannot capture the pointer.','UnknownError'));
      };
    },failure);
    await page.goto('http://127.0.0.1:5173');await page.waitForFunction(()=>window.__game);
    await page.locator('#play').click();
    if(failure==='delayed') {
      check('Match stays frozen while capture is pending',await page.evaluate(()=>!window.__game.running&&window.__game.match.remaining===300));
      await page.evaluate(()=>window.__game.input.lock());
      check('Overlapping requests are coalesced',await page.evaluate(()=>window.__captureRequests===1));
      // Use a fresh attempt to test cancelling while the result is still pending.
      await page.reload();await page.waitForFunction(()=>window.__game);await page.locator('#play').click();
      await page.keyboard.press('Escape');await page.waitForTimeout(950);
      check('ESC cancels pending capture without a late restart',await page.evaluate(()=>!window.__game.running&&window.__game.ui.screen==='pause'&&window.__game.input.mode==='idle'&&window.__game.match.remaining===300));
      await page.locator('#pause [data-action="resume"]').click();
    }
    await page.waitForFunction(()=>window.__game.running&&window.__game.input.mode==='compatibility');
    check(`${failure}: capture failure enters playable compatibility mode`,await page.locator('#capture-hint').isVisible()&&!await page.locator('#pause').isVisible());
    await page.evaluate(()=>{const g=window.__game;g.ais.forEach(ai=>ai.update=()=>{});g.player.position.set(-2,0,18);g.player.velocity.set(0,0,0);g.player.yaw=0;g.player.pitch=0;});
    const yaw=await page.evaluate(()=>window.__game.player.yaw);
    await page.mouse.move(400,320);await page.mouse.move(460,320);await page.waitForTimeout(80);
    check(`${failure}: free mouse aims`,Math.abs(await page.evaluate(()=>window.__game.player.yaw)-yaw)>.03);
    const position=await page.evaluate(()=>window.__game.player.position.toArray());
    await page.keyboard.down('KeyW');await page.waitForTimeout(180);await page.keyboard.up('KeyW');
    check(`${failure}: WASD moves`,await page.evaluate(before=>window.__game.player.position.distanceTo(window.__game.player.position.clone().fromArray(before))>.25,position));
    const ammo=await page.evaluate(()=>window.__game.weapon.ammo);await page.mouse.down();await page.mouse.up();await page.waitForTimeout(100);
    check(`${failure}: quick click fires`,await page.evaluate(()=>window.__game.weapon.ammo)===ammo-1);
    await page.mouse.down({button:'right'});check(`${failure}: right click aims`,await page.evaluate(()=>window.__game.input.aiming));await page.mouse.up({button:'right'});
    await page.mouse.move(996,320);await page.waitForTimeout(70);const edgeYaw=await page.evaluate(()=>window.__game.player.yaw);await page.waitForTimeout(200);
    check(`${failure}: edge turning allows continuous rotation`,Math.abs(await page.evaluate(()=>window.__game.player.yaw)-edgeYaw)>.1);
    await page.keyboard.press('Escape');const paused=await page.evaluate(()=>window.__game.time);await page.waitForTimeout(150);
    check(`${failure}: ESC pauses and clears controls`,await page.evaluate(time=>!window.__game.running&&window.__game.time===time&&!window.__game.input.active&&!window.__game.input.firing,paused));
    const requests=await page.evaluate(()=>window.__captureRequests);await page.locator('#pause [data-action="resume"]').click();await page.waitForFunction(()=>window.__game.running);
    check(`${failure}: RESUME avoids repeated failed requests`,await page.evaluate(()=>window.__captureRequests)===requests);
    await page.evaluate(()=>document.dispatchEvent(new Event('pointerlockerror')));
    check(`${failure}: stale error cannot pause an active match`,await page.evaluate(()=>window.__game.running));
    check(`${failure}: no uncaught exceptions`,errors.length===0);
    await context.close();
  }
  fs.mkdirSync('test-results',{recursive:true});fs.writeFileSync('test-results/capture-report.json',JSON.stringify({passed:checks.length,checks},null,2));
} finally {await browser.close();}
