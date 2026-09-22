import { chromium } from 'playwright';
import fs from 'node:fs';
const stage=process.argv[2]||'1';
fs.mkdirSync('test-results',{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--disable-web-security']});
const page=await browser.newPage({viewport:{width:1440,height:900},locale:'en-US'});
const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.goto('http://127.0.0.1:5173');await page.waitForFunction(()=>window.__game);
await page.locator('#play').click();await page.waitForTimeout(400);
if(Number(stage)>=2){
  await page.mouse.down();await page.waitForTimeout(380);await page.mouse.up();
  console.log('Shooting',await page.evaluate(()=>({ammo:window.__game.weapon.ammo,hp:window.__game.bots[0].hp,score:window.__game.player.score})));
}
const before=await page.evaluate(()=>window.__game.player.position.toArray());
await page.keyboard.down('KeyW');await page.waitForTimeout(500);await page.keyboard.up('KeyW');
await page.keyboard.down('Space');await page.waitForTimeout(200);
const state=await page.evaluate(()=>({position:window.__game.player.position.toArray(),locked:window.__game.input.locked,drawCalls:window.__game.renderer.info.render.calls,running:window.__game.running,actors:window.__game.bots?.length}));
await page.keyboard.up('Space');await page.screenshot({path:`test-results/stage-${stage}.png`});
console.log(JSON.stringify({stage,before,state,errors},null,2));
await browser.close();if(errors.length)process.exit(1);
