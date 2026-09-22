import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
const page=await browser.newPage({locale:'en-US'});const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{await page.goto('http://127.0.0.1:5173');await page.waitForFunction(()=>window.__game);
const report=await page.evaluate(()=>{const g=window.__game,p=g.player;const stairs=[];g.input.clear();
for(const [x,z] of [[40,21],[-57,5]]){p.position.set(x,0,z);p.velocity.set(0,0,0);p.grounded=true;p.crouched=false;p.yaw=0;g.input.keys.add('KeyW');let max=0;for(let i=0;i<720;i++){p.update(1/120,g.input,g.map);max=Math.max(max,p.position.y);if(p.position.y>=8.39)break;}g.input.clear();stairs.push({x,height:max,position:p.position.toArray()});}
const spawnValid=g.map.spawns.every(s=>!g.map.blocked(s.x,s.z,.42,s.y,1.85));
const roofPath=g.nav.path(g.map.spawns[0],p.position.clone().set(29,8.4,-20));
const routePositions=g.nav.path(p.position.clone().set(-57,0,5),p.position.clone().set(29,8.4,-20));
p.position.set(-57,0,5);p.velocity.set(0,0,0);p.grounded=true;let cursor=0;for(let i=0;i<120*50&&cursor<routePositions.length;i++){const target=routePositions[cursor];if(p.position.distanceTo(target)<.6){cursor++;continue;}const dir=target.clone().sub(p.position);dir.y=0;dir.normalize();p.velocity.x=dir.x*6;p.velocity.z=dir.z*6;g.map.move(p,1/120);}
return {stairs,spawnValid,roofPath:roofPath.length,upperNodes:g.nav.nodes.filter(n=>n.y>1).length,routeCompleted:cursor===routePositions.length,routeCursor:cursor,routeLength:routePositions.length,routePosition:p.position.toArray(),target:routePositions[cursor]?.toArray(),drawCalls:g.renderer.info.render.calls,geometries:g.renderer.info.memory.geometries};});
console.log(JSON.stringify(report,null,2));assert.ok(report.spawnValid,'All spawn points clear collision');assert.ok(report.stairs.every(s=>s.height>=8.39),'Both staircases reach roof level');assert.ok(report.routeCompleted,'Bots can follow connected stairs, roof and bridge route');assert.equal(errors.length,0);fs.writeFileSync('test-results/world-report.json',JSON.stringify({report,errors},null,2));
}finally{await browser.close();}
