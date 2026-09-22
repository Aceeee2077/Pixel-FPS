import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser = await chromium.launch({executablePath:process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
const page=await browser.newPage();
try {
    await page.goto('http://127.0.0.1:5173'); await page.waitForFunction(()=>window.__game);
    const report=await page.evaluate(async()=>{
        const g=window.__game;g.renderer.setAnimationLoop(null);g.start();g.pause();
        const {MAPS}=await import('/src/world/Maps.ts');
        const maps=[];
        for(const def of MAPS){g.loadMap(def.id);g.pickups.reset(g.map,g.nav);maps.push({id:def.id,count:g.pickups.items.length,clear:g.pickups.items.every(i=>!g.map.blocked(i.position[0],i.position[2],.42,i.position[1],1.8))});}
        const p=g.player,health=g.pickups.items.find(i=>i.kind==='health'),ammo=g.pickups.items.find(i=>i.kind==='ammo');
        const collect=()=>g.pickups.update(g.time,[p],()=>g.weapons.slots,()=>{});
        p.alive=true;p.hp=100;p.position.fromArray(health.position);collect();const fullNotConsumed=health.readyAt===0;
        p.hp=80;const old=[...health.position];collect();const healed=p.hp===100&&health.readyAt===g.time+20&&health.position.some((n,i)=>n!==old[i]);
        p.position.fromArray(health.position);p.hp=50;collect();const cooldown=p.hp===50;
        g.time+=20;collect();const respawn=p.hp===85;
        p.position.fromArray(ammo.position);g.weapons.slots[0].reserve=0;const before=g.weapons.slots[0].ammo;collect();const reserve=g.weapons.slots[0].reserve===g.weapons.slots[0].config.magazineSize;
        const untouched=g.weapons.slots[0].ammo===before;
        g.pickups.reset(g.map,g.nav);const fresh=g.pickups.items.every(i=>i.readyAt===0);
        return {maps,fullNotConsumed,healed,cooldown,respawn,reserve,untouched,fresh};
    });
    for(const map of report.maps)assert.ok(map.count===10&&map.clear,'Valid supplies on '+map.id);
    for(const [key,value]of Object.entries(report))if(key!=='maps')assert.ok(value,key);
    console.log('PASS pickups:',JSON.stringify(report));
}finally{await browser.close();}
