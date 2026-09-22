import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
fs.mkdirSync('test-results',{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:900}});
const errors=[],checks=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const check=(name,value)=>{assert.ok(value,name);checks.push(name);console.log('PASS',name);};
const state=()=>page.evaluate(()=>{const g=window.__game;return {knife:g.weapon.config.id==='knife',attack:g.weapon.attack,switchLeft:g.weapons.switchLeft,switching:g.weapons.switching,botHp:g.bots[0].hp,score:g.player.score,fov:g.camera.fov,hint:document.querySelector('#weapon-hint').textContent,marker:document.querySelector('#hitmarker').className,meleeCrosshair:document.querySelector('#crosshair').classList.contains('melee')};});
/** Headless software rendering drops frames, so poll for a state instead of sleeping a fixed time. */
async function waitFor(predicate,timeout=3000){const until=Date.now()+timeout;let seen=await state();while(!predicate(seen)&&Date.now()<until){await page.waitForTimeout(25);seen=await state();}return seen;}
async function freeze(){await page.evaluate(()=>{const g=window.__game;window.__updates=g.ais.map(ai=>ai.update);g.ais.forEach(ai=>ai.update=()=>{});});}
async function move({range=1.8,facing='front'}={}){await page.evaluate(({range,facing})=>{const g=window.__game,p=g.player,b=g.bots[0];p.position.set(-2,0,18);p.velocity.set(0,0,0);p.grounded=true;p.alive=true;p.hp=100;p.protectedUntil=0;p.yaw=0;p.pitch=Math.atan2(1.05-1.65,range);p.recoil=0;g.bots.forEach((o,i)=>{o.position.set(60+i*2,0,70);o.velocity.set(0,0,0);o.protectedUntil=0;});b.position.set(-2,0,18-range);b.alive=true;b.hp=100;b.crouched=false;b.yaw=facing==='front'?Math.PI:0;g.weapon.cooldown=0;g.weapon.heat=0;g.weapon.reloadLeft=0;g.weapon.cancelAttack();g.weapons.switchLeft=0;g.weapons.switchTotal=0;p.update(.001,g.input,g.map);g.camera.updateMatrixWorld(true);},{range,facing});await page.waitForTimeout(50);}
/**
 * Runs a whole stab inside one synchronous evaluation: the render loop cannot interleave, so the
 * strike frame, the damage and the kill feed are measured exactly instead of by wall clock.
 */
function stab({kind='light',range=1.8,facing='front',frames=40}={}){
  return page.evaluate(({kind,range,facing,frames})=>{
    const g=window.__game,p=g.player,b=g.bots[0];
    p.position.set(-2,0,18);p.velocity.set(0,0,0);p.grounded=true;p.alive=true;p.hp=100;p.protectedUntil=0;p.yaw=0;p.pitch=Math.atan2(1.05-1.65,range);p.recoil=0;
    g.bots.forEach((o,i)=>{o.position.set(60+i*2,0,70);o.velocity.set(0,0,0);o.protectedUntil=0;});
    b.position.set(-2,0,18-range);b.alive=true;b.hp=100;b.crouched=false;b.yaw=facing==='front'?Math.PI:0;
    g.weapon.cooldown=0;g.weapon.heat=0;g.weapon.reloadLeft=0;g.weapon.cancelAttack();g.weapons.switchLeft=0;g.weapons.switchTotal=0;
    p.update(.001,g.input,g.map);g.camera.updateMatrixWorld(true);
    const started=g.meleeAttack(kind);
    let strikeFrame=null;
    for(let i=0;i<frames;i++){
      g.tick(1/60);g.input.endFrame();
      if(strikeFrame===null&&b.hp<100)strikeFrame=i+1;
      if(!b.alive)break;
    }
    return {started,strikeFrame,hp:b.hp,alive:b.alive,score:p.score,marker:document.querySelector('#hitmarker').className,hint:document.querySelector('#weapon-hint').textContent,slot:g.weapons.slot,ammo:g.weapon.ammo,weapon:g.weapon.config.id};
  },{kind,range,facing,frames});
}
try{
  await page.goto('http://127.0.0.1:5173');await page.waitForFunction(()=>window.__game);
  await page.locator('#play').click();await page.waitForTimeout(250);await freeze();
  check('Match runs with the knife in slot 3',await page.evaluate(()=>{const g=window.__game;return g.running&&g.weapons.slots[2].config.id==='knife'&&!!g.weapons.slots[2].config.melee;}));
  check('Knife exposes only a light and a heavy stab',await page.evaluate(()=>{const k=window.__game.weapons.slots[2].config;return !!k.melee.light&&!!k.melee.heavy&&k.reserveAmmo===0&&k.magazineSize===1;}));
  check('The knife slot is labelled with the equipped blade',await page.evaluate(()=>document.querySelector('#slot2').textContent.trim()==='3COMBAT KNIFE'));
  // Draw animation: the blade rises over time and the knife stays unusable until it is up.
  await page.keyboard.press('Digit1');await page.waitForTimeout(400);
  await page.evaluate(()=>window.__game.weapons.select(2));
  await page.waitForTimeout(60);const drawing=await state();
  check('Switching to the knife plays a draw animation',drawing.knife&&drawing.switching&&drawing.switchLeft>0);
  check('Draw animation shows DRAWING KNIFE in the HUD',drawing.hint==='DRAWING KNIFE…');
  await move({range:1.8});
  await page.evaluate(()=>{const g=window.__game;g.weapons.select(0);g.weapons.select(2);g.weapon.cooldown=0;});
  await page.mouse.down();await page.mouse.up();await page.waitForTimeout(60);const duringDraw=await state();
  check('Knife cannot stab while it is still being drawn',duringDraw.switching&&duringDraw.attack===null&&duringDraw.botHp===100);
  await page.screenshot({path:'test-results/melee-draw.png'});
  const idle=await waitFor(s=>!s.switching,4000);
  check('Draw finishes and the knife becomes usable',!idle.switching&&idle.knife);
  check('Idle knife HUD advertises light and heavy stabs',idle.hint.includes('LIGHT STAB')&&idle.hint.includes('HEAVY STAB'));
  check('Knife HUD swaps the ammo line for stab damage and drops the reload key',await page.evaluate(()=>{const g=window.__game,panel=document.querySelector('#ammo'),box=panel.closest('.ammo');return panel.textContent.replace(/\s+/g,'')===`${g.weapon.config.melee.light.damage}/${g.weapon.config.melee.heavy.damage}`&&document.querySelector('#weapon-label').textContent==='LIGHT / HEAVY STAB DAMAGE'&&box.querySelector('kbd').classList.contains('hidden');}));
  check('Knife uses melee crosshair styling',idle.meleeCrosshair);
  // Light stab: fast wind-up, 45 to the body, and it never scopes or fires.
  const light=await stab({kind:'light'});
  check('Light stab starts as a swing, not a shot',light.started);
  check('Light stab lands on the tenth frame of its swing',light.strikeFrame===10);
  check('Light stab deals 45 damage',light.hp===55);
  // Heavy stab: longer wind-up, 90 to the body.
  const heavy=await stab({kind:'heavy'});
  check('Heavy stab winds up longer than the light stab',heavy.strikeFrame===21);
  check('Heavy stab deals 90 damage',heavy.hp===10);
  check('Body heavy stab does not eliminate a full health bot',heavy.alive&&heavy.score===0);
  check('Heavy stab shows the HEAVY STAB readout',heavy.hint==='HEAVY STAB');
  // Backstab: the CS2 rule, judged by the victim facing away.
  const back=await stab({kind:'heavy',range:1.4,facing:'back'});
  check('Heavy backstab eliminates the target',!back.alive&&back.score===1);
  check('Backstab feedback uses the red marker',back.marker.includes('back'));
  check('Knife kill feed credits the equipped blade',await page.evaluate(()=>window.__game.match.feed[0]?.weapon==='Combat Knife'));
  await page.screenshot({path:'test-results/melee-backstab.png'});
  const front=await stab({kind:'heavy',range:1.4,facing:'front'});
  check('The same stab from the front is not a backstab',front.alive&&front.hp===10);
  check('Front stab keeps the normal marker',!front.marker.includes('back'));
  // Reach: a knife only cuts what it touches, and the heavy stab reaches slightly further.
  const far=await stab({kind:'light',range:8});
  check('Knife cannot reach a target eight metres away',far.strikeFrame===null&&far.hp===100);
  const shortLight=await stab({kind:'light',range:2.8});
  check('Light stab stops short just past its reach',shortLight.strikeFrame===null&&shortLight.hp===100);
  const longHeavy=await stab({kind:'heavy',range:2.8});
  check('Heavy stab reaches where the light stab cannot',longHeavy.hp===10);
  check('Stabbing never consumes ammo or drops the knife',longHeavy.slot===2&&longHeavy.weapon==='knife'&&longHeavy.ammo===1);
  // Real mouse input wires the two stabs; the right button must never scope the knife.
  await move({range:1.8});await page.mouse.down();await page.mouse.up();await page.waitForTimeout(40);
  check('Left mouse starts the light stab',(await waitFor(s=>s.attack==='light')).attack==='light');
  await move({range:1.8});await page.mouse.down({button:'right'});
  const right=await waitFor(s=>s.attack==='heavy');await page.mouse.up({button:'right'});
  check('Right mouse starts the heavy stab',right.attack==='heavy');
  check('Right mouse with the knife never scopes',Math.abs(right.fov-90)<2&&await page.locator('#scope').isHidden());
  // Frozen pose captures. The view model is measured against a frame with the weapon hidden, so the
  // silhouette position of every animation frame is asserted instead of eyeballed.
  await page.evaluate(()=>{
    const g=window.__game;
    g.running=false;g.weapon.cancelAttack();g.weapons.switchLeft=0;g.weapons.switchTotal=0;
    const shot=()=>{const c=document.createElement('canvas');c.width=g.renderer.domElement.width;c.height=g.renderer.domElement.height;const ctx=c.getContext('2d');ctx.drawImage(g.renderer.domElement,0,0);return ctx.getImageData(0,0,c.width,c.height);};
    g.updateView(.001);g.view.visible=false;g.renderer.render(g.scene,g.camera);
    window.__reference=shot();g.view.visible=true;
    window.__poseStats=()=>{g.renderer.render(g.scene,g.camera);const now=shot(),ref=window.__reference;let sx=0,sy=0,n=0;for(let y=0;y<now.height;y++)for(let x=0;x<now.width;x++){const i=(y*now.width+x)*4;const d=Math.abs(now.data[i]-ref.data[i])+Math.abs(now.data[i+1]-ref.data[i+1])+Math.abs(now.data[i+2]-ref.data[i+2]);if(d>60){sx+=x;sy+=y;n++;}}return {cx:n?sx/n/now.width:0,cy:n?sy/n/now.height:0,count:n};};
  });
  const poses={};
  const pose=async(name)=>{await page.evaluate(()=>window.__game.updateView(.001));await page.screenshot({path:`test-results/${name}.png`});return page.evaluate(()=>window.__poseStats());};
  poses.idle=await pose('melee-idle');
  await page.evaluate(()=>{const g=window.__game;g.weapons.switchTotal=.75;g.weapons.switchLeft=.42;});
  poses.draw=await pose('melee-pose-draw');
  await page.evaluate(()=>{const g=window.__game;g.weapons.switchLeft=0;g.weapon.attack='light';g.weapon.attackTime=.16;});
  poses.lightWind=await pose('melee-pose-light-wind');
  await page.evaluate(()=>{const g=window.__game;g.weapon.attackTime=.26;});
  poses.lightCut=await pose('melee-pose-light');
  await page.evaluate(()=>{const g=window.__game;g.weapon.attack='heavy';g.weapon.attackTime=.315;});
  poses.heavyWind=await pose('melee-pose-heavy-wind');
  await page.evaluate(()=>{const g=window.__game;g.weapon.attackTime=.46;});
  poses.heavyCut=await pose('melee-pose-heavy-cut');
  console.log('POSE REPORT',JSON.stringify(poses));
  check('Knife stays on screen through the draw and both swings',Object.values(poses).every(p=>p.count>1500));
  check('Draw animation pulls the blade up from below the frame',poses.draw.cy>poses.idle.cy&&poses.draw.cx!==poses.idle.cx);
  check('Light stab winds up to the right then slashes across to the left',poses.lightWind.cx>poses.idle.cx+.004&&poses.lightCut.cx<poses.lightWind.cx-.03);
  check('Heavy stab lifts the blade then drives it down',poses.heavyWind.cy<poses.idle.cy-.005&&poses.heavyCut.cy>poses.idle.cy+.005);
  check('Heavy stab has the longer, heavier arc of the two',poses.heavyCut.cy-poses.idle.cy>poses.lightCut.cy-poses.idle.cy);
  check('No two animation frames render the same pose',new Set(Object.values(poses).map(p=>`${p.cx.toFixed(4)}:${p.cy.toFixed(4)}`)).size===6);
  check('No browser console errors or exceptions',errors.length===0);
  fs.writeFileSync('test-results/melee-report.json',JSON.stringify({passed:checks.length,checks,errors,poses},null,2));
}catch(e){await page.screenshot({path:'test-results/melee-failure.png'});console.error('FAILED',e);console.error('BROWSER ERRORS',errors);console.error('STATE',await state().catch(()=>null));fs.writeFileSync('test-results/melee-report.json',JSON.stringify({checks,errors,failure:String(e)},null,2));process.exitCode=1;}finally{await browser.close();}
