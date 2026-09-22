import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
fs.mkdirSync('test-results',{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
const page=await browser.newPage({viewport:{width:1280,height:800}});
const errors=[],checks=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const check=(name,value)=>{assert.ok(value,name);checks.push(name);console.log('PASS',name);};
/**
 * Walks every authored route with the real collision code and returns a per map report. The walker
 * uses the player body at 120Hz so stair stepping, pits and decks are exercised exactly as in game.
 */
const audit=id=>page.evaluate(id=>{
  const g=window.__game;
  g.running=false;
  g.loadMap(id);
  const map=g.map, out={id, name:map.name, spawns:map.spawns.length, nodes:g.nav.nodes.length, routes:[], errors:[]};
  // Spawn sanity: inside the world, clear of geometry, spaced out, and able to settle on a floor.
  const spawns=map.spawns.map(s=>s.clone());
  out.spawnsBlocked=spawns.filter(s=>map.blocked(s.x,s.z,.42,s.y,1.85)).length;
  out.spawnsBlockedAt=spawns.filter(s=>map.blocked(s.x,s.z,.42,s.y,1.85)).map(s=>[+s.x.toFixed(1),s.y,+s.z.toFixed(1)]);
  let minPair=Infinity;
  for(let i=0;i<spawns.length;i++)for(let j=i+1;j<spawns.length;j++)minPair=Math.min(minPair,spawns[i].distanceTo(spawns[j]));
  out.minSpawnDistance=Number.isFinite(minPair)?minPair:0;
  out.spawnsOutOfWorld=spawns.filter(s=>Math.abs(s.x)>=map.size||Math.abs(s.z)>=map.size).length;
  const p=g.player;
  out.spawnsFallOut=0;
  for(const s of spawns){
    p.position.copy(s);p.velocity.set(0,0,0);p.grounded=false;p.crouched=false;p.alive=true;
    for(let i=0;i<240;i++)g.map.move(p,1/120);
    if(!p.grounded||p.position.y<-15)out.spawnsFallOut++;
  }
  // Nav graph connectivity, measured on the actual edge list.
  const total=g.nav.nodes.length;
  // Union-find over the real edge list: robust and independent of traversal order.
  const parent=new Int32Array(total).map((_,i)=>i);
  const find=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;};
  for(let i=0;i<total;i++)for(const e of g.nav.edges[i]){if(e<0||e>=total)continue;const a=find(i),b=find(e);if(a!==b)parent[a]=b;}
  const group=new Map();
  for(let i=0;i<total;i++){const r=find(i);group.set(r,(group.get(r)??0)+1);}
  const sizes=[...group.values()].sort((a,b)=>b-a);
  const biggestRoot=[...group.entries()].sort((a,b)=>b[1]-a[1])[0][0];
  out.connected=(sizes[0]??0)/Math.max(1,total);
  out.parts=sizes.slice(0,5);
  out.isolated=g.nav.nodes.map((n,i)=>({n,i})).filter(o=>find(o.i)!==biggestRoot).slice(0,10).map(o=>o.n.toArray().map(v=>+v.toFixed(1)));
  const reachable=i=>find(i)===biggestRoot;
  out.spawnsReachable=spawns.every(s=>reachable(g.nav.nearest(s)));
  out.spawnsNotReachable=spawns.filter(s=>!reachable(g.nav.nearest(s))).map(s=>[+s.x.toFixed(1),+s.z.toFixed(1)]);
  out.spawnNodesNotReachable=spawns.filter(s=>!reachable(g.nav.nearest(s))).map(s=>{const n=g.nav.nodes[g.nav.nearest(s)];return {spawn:[+s.x.toFixed(1),+s.y.toFixed(1),+s.z.toFixed(1)],node:[+n.x.toFixed(1),+n.y.toFixed(1),+n.z.toFixed(1)]};});
  // Route chains are the authored walkable paths: all of them must belong to the main component.
  const routePoints=map.routes.flatMap(r=>r.points);
  out.routesReachable=g.nav.nodes.every((n,i)=>!routePoints.some(p=>p.distanceToSquared(n)<.01)||reachable(i));
  out.routesNotReachable=map.routes.filter(r=>r.points.some(p=>g.nav.nodes.some((n,i)=>n.distanceToSquared(p)<.01&&!reachable(i)))).map(r=>r.name);
  // Every authored route must be walkable end to end with no teleporting.
  for(const route of map.routes){
    const points=route.points;
    // `since` counts frames spent without reaching the next waypoint: a real stall, not slow travel.
    let stuck=null,index=1,steps=0,since=0;
    p.position.copy(points[0]);p.velocity.set(0,0,0);p.grounded=true;p.crouched=false;
    p.position.y+=.05;
    const gap=()=>{const t=points[index];return Math.hypot(t.x-p.position.x,t.z-p.position.z);};
    // A fixed budget per waypoint: 2.5 times the travel time plus slack for stairs and tight turns.
    let budget=Math.ceil(gap()/4.6*300)+300;
    while(index<points.length&&steps<9000&&!stuck){
      const target=points[index];
      const dx=target.x-p.position.x,dz=target.z-p.position.z,flat=Math.hypot(dx,dz);
      if(flat<.5&&Math.abs(target.y-p.position.y)<.75){
        index++;since=0;
        if(index<points.length)budget=Math.ceil(gap()/4.6*300)+300;
        continue;
      }
      p.velocity.x=flat>.001?dx/flat*4.6:0;
      p.velocity.z=flat>.001?dz/flat*4.6:0;
      g.map.move(p,1/120);
      steps++;since++;
      if(since>budget)stuck={index,at:p.position.toArray().map(n=>+n.toFixed(2)),target:target.toArray()};
    }
    const end=points[points.length-1];
    const arrived=Math.hypot(p.position.x-end.x,p.position.z-end.z)<1.9&&Math.abs(p.position.y-end.y)<.95;
    out.routes.push({name:route.name,points:points.length,steps,arrived,stuck});
  }
  // Bots must actually patrol the map using the generated navigation graph.
  g.match.reset(g.actors);
  g.actors.forEach(a=>{a.alive=true;a.hp=100;a.protectedUntil=0;a.velocity.set(0,0,0);});
  g.player.position.copy(map.spawns[0]);g.player.alive=true;
  const start=g.bots.map((b,i)=>{b.position.copy(map.spawns[(i+1)%map.spawns.length]);b.velocity.set(0,0,0);b.sync(0);return b.position.clone();});
  g.ais.forEach(ai=>ai.reset());
  g.running=true;
  for(let i=0;i<900;i++){g.tick(1/60);g.input.endFrame();}
  g.running=false;
  out.botTravel=g.bots.map((b,i)=>b.position.distanceTo(start[i]));
  out.finite=g.actors.every(a=>[a.hp,...a.position.toArray(),...a.velocity.toArray()].every(Number.isFinite));
  out.drawCalls=g.renderer.info.render.calls;
  out.geometries=g.renderer.info.memory.geometries;
  return out;
},id);
try{
  await page.goto('http://127.0.0.1:5173');await page.waitForFunction(()=>window.__game);
  await page.locator('#play').click();await page.waitForTimeout(250);
  const ids=await page.evaluate(()=>[...document.querySelectorAll('#menu-map-grid [data-map]')].map(b=>b.dataset.map).filter(id=>id!=='random'));
  check('Menu picker lists all ten arenas plus random rotation',ids.length>=10&&await page.locator('#menu-map-grid [data-map="random"]').count()===1);
  const reports=[];
  for(const id of ids){
    const r=await audit(id);
    reports.push(r);
    if(r.routes.some(x=>!x.arrived))console.log('ROUTE FAIL',r.id,JSON.stringify(r.routes.filter(x=>!x.arrived)));
    if(r.spawnsBlocked||r.spawnsOutOfWorld||r.spawnsFallOut)console.log('SPAWN FAIL',r.id,JSON.stringify({blocked:r.spawnsBlocked,at:r.spawnsBlockedAt,out:r.spawnsOutOfWorld,fall:r.spawnsFallOut,min:r.minSpawnDistance}));
    if(!r.spawnsReachable||!r.routesReachable)console.log('LINK FAIL',r.id,JSON.stringify({spawns:r.spawnNodesNotReachable,routes:r.routesNotReachable,best:Number(r.connected.toFixed(3)),isolated:r.isolated}));
    console.log('MAP',JSON.stringify({id:r.id,nodes:r.nodes,best:Number(r.connected.toFixed(3)),componentTotal:r.componentTotal,parts:(r.parts??[]).map(p=>p.size),badRoutes:r.routes.filter(x=>!x.arrived).map(x=>x.name),botTravel:r.botTravel.map(v=>Number(v.toFixed(1)))}));
    check(`${r.id}: spawn points are clear and inside the world`,r.spawnsBlocked===0&&r.spawnsOutOfWorld===0&&r.spawnsFallOut===0);
    check(`${r.id}: spawn points are spread across the map`,r.spawns>=10&&r.minSpawnDistance>=9);
    check(`${r.id}: spawns and every authored route sit in the main navigation component`,r.spawnsReachable&&r.routesReachable&&r.connected>=.7);
    check(`${r.id}: every elevated route is walkable`,r.routes.every(x=>x.arrived));
    check(`${r.id}: bots patrol the map without errors`,r.botTravel.filter(d=>d>2).length>=5&&r.finite);
    await page.screenshot({path:`test-results/map-${r.id}.png`});
  }
  check('Only ten or more distinct maps exist',new Set(reports.map(r=>r.name)).size===reports.length&&reports.length>=10);
  check('No browser console errors or exceptions',errors.length===0);
  fs.writeFileSync('test-results/maps-report.json',JSON.stringify({passed:checks.length,checks,errors,reports},null,2));
}catch(e){await page.screenshot({path:'test-results/maps-failure.png'});console.error('FAILED',e);console.error('BROWSER ERRORS',errors);fs.writeFileSync('test-results/maps-report.json',JSON.stringify({checks,errors,failure:String(e)},null,2));process.exitCode=1;}finally{await browser.close();}
