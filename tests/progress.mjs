import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
fs.mkdirSync('test-results',{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:900},locale:'en-US'});
const errors=[],checks=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const check=(name,value)=>{assert.ok(value,name);checks.push(name);console.log('PASS',name);};
try{
  await page.goto('http://127.0.0.1:5173');await page.waitForFunction(()=>window.__game);
  check('Progression starts every weapon at level 0 with no XP',await page.evaluate(()=>Object.values(window.__game.progress.data).every(p=>p.level===0&&p.xp===0)&&Object.keys(window.__game.progress.data).length===6));
  check('Level 0 → 1 costs 100 XP and every level costs more than the last',await page.evaluate(()=>{
    const p=window.__game.progress;
    const costs=[p.cost('smg')];
    for(let level=0;level<5;level++){p.award('smg',p.cost('smg'));costs.push(p.cost('smg'));}
    return costs[0]===100&&costs[1]===160&&costs[2]===220&&p.get('smg').level===5&&p.get('smg').xp===0;
  }));
  check('A level only rolls over when its XP is paid in full',await page.evaluate(()=>{
    const p=window.__game.progress;p.data.sniper={level:0,xp:0};
    p.award('sniper',99);const early=p.get('sniper').level===0&&p.get('sniper').xp===99;
    p.award('sniper',1);return early&&p.get('sniper').level===1&&p.get('sniper').xp===0;
  }));
  // Armory shows a level for every weapon and a next level requirement.
  await page.locator('#menu nav [data-action="loadout"]').click();
  const rows=await page.locator('#dialog .lvl-row').count();
  check('Armory lists a level row for all six weapons',rows===6);
  check('Armory shows the next level requirement',(await page.locator('#dialog .lvl-next').first().innerText()).includes('XP'));
  check('Primary cards carry their own level badge',await page.locator('#dialog .weapon-card .lvl-badge').count()===4);
  check('Locked cosmetics are disabled until their level',await page.evaluate(()=>{const locked=document.querySelectorAll('#dialog .knife-card.locked, #dialog .skin-chip.locked');return locked.length>0&&[...locked].every(b=>b.disabled);}));
  await page.locator('#dialog .primary').click();
  // Map picker: choosing a map stores it and survives a reload.
  check('Lobby lists ten map cards plus random',await page.locator('#menu-map-grid [data-map]').count()===11);
  await page.locator('#menu-map-grid [data-map="temple"]').click();
  check('Picking a map updates the lobby showcase',await page.evaluate(()=>document.querySelector('#menu-map-name').textContent==='JUNGLE TEMPLE'&&window.__game.settings.data.map==='temple'));
  await page.reload();await page.waitForFunction(()=>window.__game);
  check('Map choice persists across reloads',await page.evaluate(()=>window.__game.settings.data.map==='temple'&&window.__game.map.definition.id==='temple'));
  // Playing a match on the chosen map and finishing it awards XP and levels weapons up.
  await page.locator('#play').click();await page.waitForTimeout(300);
  const before=await page.evaluate(()=>{const p=window.__game.progress;p.data.rifle={level:0,xp:0};return p.get('rifle').level;});
  const earned=await page.evaluate(()=>{
    const g=window.__game;
    g.weaponKills={rifle:12};
    g.match.remaining=.2;
    for(let i=0;i<40&&!g.match.ended;i++){g.tick(1/60);g.input.endFrame();}
    return {xp:g.lastXp,level:g.progress.get('rifle').level};
  });
  check('Finishing a match awards weapon XP',earned.xp.length>=2&&earned.xp.find(r=>r.weapon==='rifle').gained>=112);
  check('Twelve kills with the primary levels it up',earned.level>before&&earned.level===1);
  check('Results screen shows the XP breakdown',await page.evaluate(()=>document.querySelector('#results-xp').textContent.includes('XP')));
  await page.screenshot({path:'test-results/progress-results.png'});
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('blockstrike.progress')||'{}'));
  check('Weapon levels persist to local storage',saved.rifle&&saved.rifle.level===1);
  // Level cap: pumping XP past the cap must not push a weapon beyond level 10.
  check('Weapons cap at level 10',await page.evaluate(()=>{const g=window.__game;for(let i=0;i<40;i++)g.progress.award('smg',500);return g.progress.get('smg').level===10&&g.progress.get('smg').xp===0;}));
  check('No browser console errors or exceptions',errors.length===0);
  fs.writeFileSync('test-results/progress-report.json',JSON.stringify({passed:checks.length,checks,errors,earned},null,2));
}catch(e){await page.screenshot({path:'test-results/progress-failure.png'});console.error('FAILED',e);console.error('BROWSER ERRORS',errors);fs.writeFileSync('test-results/progress-report.json',JSON.stringify({checks,errors,failure:String(e)},null,2));process.exitCode=1;}finally{await browser.close();}
