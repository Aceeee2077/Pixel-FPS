import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { WeaponId } from './WeaponConfig';
import { appearanceKey, DEFAULT_APPEARANCE, type WeaponAppearance, type KnifeStyle } from './WeaponAppearance';

// Silhouettes use (forward, height); the finished model points down local -Z.
type Point = [number, number];
type Mat = THREE.MeshStandardMaterial;
const cube = new THREE.BoxGeometry(1, 1, 1);
const materials = new Map<string, Mat>();
const models = new Map<string, THREE.Group>();
let studio: THREE.CubeTexture | undefined;
function reflections() {
    if (studio) return studio;
    const faces = Array.from({ length: 6 }, (_, face) => {
        const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
        const c = canvas.getContext('2d')!;
        const gradient = c.createLinearGradient(0, 0, 0, 128);
        gradient.addColorStop(0, '#c4ddd5'); gradient.addColorStop(.42, '#eaf1df');
        gradient.addColorStop(.46, '#344f48'); gradient.addColorStop(1, '#172926');
        c.fillStyle = gradient; c.fillRect(0, 0, 128, 128);
        if (face !== 3) { c.fillStyle = '#ffffff'; c.fillRect(18, 8, 14, 72); c.fillRect(86, 8, 5, 72); }
        return canvas;
    });
    studio = new THREE.CubeTexture(faces); studio.colorSpace = THREE.SRGBColorSpace; studio.needsUpdate = true;
    return studio;
}
function material(color: number, finish: 'paint' | 'metal' | 'rubber' | 'gem' = 'paint') {
    const key = `${color}:${finish}`;
    if (!materials.has(key)) materials.set(key, new THREE.MeshStandardMaterial({ color,
        roughness: finish === 'rubber' ? .9 : finish === 'gem' ? .2 : finish === 'metal' ? .32 : .58,
        metalness: finish === 'gem' ? .48 : finish === 'metal' ? .65 : finish === 'rubber' ? .02 : .22,
        envMap: reflections(), envMapIntensity: finish === 'gem' ? .95 : .28, flatShading: true }));
    return materials.get(key)!;
}
function coating(asimov: boolean) {
    const key = asimov ? 'ceramic-asimov' : 'ceramic-field';
    if (!materials.has(key)) {
        const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
        const c = canvas.getContext('2d')!;
        c.fillStyle = asimov ? '#e5e6db' : '#cbd4c1'; c.fillRect(0, 0, 256, 256);
        for (let i = 0; i < 85; i++) {
            c.fillStyle = i % 3 ? '#445a4c25' : '#ffffff38'; c.fillRect((i*97)%256, (i*47)%256, 2+i%11, 1);
        }
        const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace;
        map.wrapS = map.wrapT = THREE.RepeatWrapping; map.anisotropy = 4;
        const m = material(0xffffff).clone(); m.map = map; materials.set(key, m);
    }
    return materials.get(key)!;
}
const dark = () => material(0x172c2d);
const black = () => material(0x0e191c, 'rubber');
const steel = () => material(0x516967, 'metal');
const lime = () => material(0xc3f13c);
function mesh(g: THREE.Group, geometry: THREE.BufferGeometry, m: Mat) {
    const part = new THREE.Mesh(geometry, m); g.add(part); return part;
}
function box(g: THREE.Group, m: Mat, x: number, y: number, u: number, w: number, h: number, length: number) {
    const part = mesh(g, cube, m); part.position.set(x, y, -u); part.scale.set(w, h, length); return part;
}
function profile(g: THREE.Group, points: Point[], depth: number, m: Mat, x = 0, holes: Point[][] = [], bevel = .004) {
    const shape = new THREE.Shape(points.map(([u, y]) => new THREE.Vector2(u, y)));
    holes.forEach(points => shape.holes.push(new THREE.Path(points.map(([u, y]) => new THREE.Vector2(u, y)))));
    const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 1, steps: 1, curveSegments: 8 });
    geometry.rotateY(Math.PI / 2); geometry.translate(x - depth / 2, 0, 0);
    return mesh(g, geometry, m);
}
function barrel(g: THREE.Group, m: Mat, y: number, u: number, radius: number, length: number, x = 0, segments = 8) {
    const part = mesh(g, new THREE.CylinderGeometry(radius, radius, length, segments), m);
    part.rotation.x = Math.PI / 2; part.position.set(x, y, -u); return part;
}
function pin(g: THREE.Group, x: number, y: number, u: number, radius = .013, m = steel()) {
    const part = mesh(g, new THREE.CylinderGeometry(radius, radius, .012, 8), m);
    part.rotation.z = Math.PI / 2; part.position.set(x, y, -u); return part;
}
function ring(g: THREE.Group, y: number, u: number, radius: number, thickness: number, m: Mat) {
    const part = mesh(g, new THREE.TorusGeometry(radius, thickness, 4, 12), m);
    part.rotation.y = Math.PI / 2; part.position.set(0, y, -u); return part;
}
function rail(g: THREE.Group, u: number, y: number, length: number, width = .095) {
    box(g, black(), 0, y, u, width * .75, .018, length);
    for (let i = 0; i < Math.floor(length / .037); i++) box(g, steel(), 0, y + .015, u - length/2 + .018 + i*.037, width, .02, .023);
}
function sight(g: THREE.Group, u: number, y: number, front = false) {
    box(g, black(), 0, y, u, .11, .035, .05);
    for (const x of [-.035, .035]) box(g, dark(), x, y + (front?.047:.024), u, .016, front?.08:.05, .035);
    if(front) box(g, lime(), 0, y + .03, u, .014, .044, .02);
    else for(const x of [-.035,.035]) box(g,lime(),x,y+.05,u,.013,.009,.02);
}
function trigger(g: THREE.Group, u: number, y: number) {
    profile(g, [[u-.065,y],[u+.09,y],[u+.075,y-.13],[u-.06,y-.13]], .052, dark(), 0,
        [[[u-.037,y-.025],[u+.057,y-.025],[u+.043,y-.105],[u-.038,y-.105]]]);
    box(g, lime(), 0, y-.04, u+.018, .023, .067, .018).rotation.x = -.25;
}
function grip(g: THREE.Group, u: number, y: number, paint: Mat) {
    profile(g, [[u-.03,y],[u+.075,y],[u+.027,y-.23],[u-.083,y-.22]], .095, paint);
    for (let i=0;i<5;i++) for (const x of [-.051,.051]) box(g,black(),x,y-.08-i*.029,u-.018,.008,.01,.08);
    box(g, black(), 0, y-.23, u-.025, .105, .032, .12);
}
function marking(g: THREE.Group, x: number, y: number, u: number, asimov: boolean) {
    const key=asimov?'mark-asimov':'mark-field';
    if(!materials.has(key)) {
        const canvas=document.createElement('canvas'); canvas.width=256; canvas.height=128;
        const c=canvas.getContext('2d')!;
        c.fillStyle=asimov?'#e9ebdf':'#243a38'; c.fillRect(0,0,256,128);
        c.strokeStyle=asimov?'#e9662d':'#cbef48'; c.lineWidth=8;
        c.beginPath();c.moveTo(32,94);c.lineTo(69,28);c.lineTo(106,94);c.closePath();c.stroke();
        c.fillStyle=asimov?'#192f30':'#d8dfd1';c.font='bold 30px monospace';c.fillText('04',127,60);
        c.font='13px monospace';c.fillText('BLOCKSTRIKE',115,87);
        const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;
        materials.set(key,new THREE.MeshStandardMaterial({map,roughness:.65,side:THREE.DoubleSide}));
    }
    const plane=mesh(g,new THREE.PlaneGeometry(.17,.085),materials.get(key)!);
    plane.rotation.y=-Math.PI/2;plane.position.set(x,y,-u);
}
function rifle(g: THREE.Group, asimov: boolean) {
    const paint=coating(asimov), accent=asimov?material(0xef702a):lime();
    profile(g,[[-.1,.065],[.48,.065],[.51,-.02],[.4,-.13],[.01,-.13],[-.1,-.055]],.14,dark());
    profile(g,[[-.09,.025],[.38,.025],[.4,-.025],[.27,-.085],[-.09,-.075]],.012,paint,-.077);
    box(g,black(),.079,.015,.16,.012,.048,.16);box(g,steel(),.089,.025,.11,.017,.025,.09);
    marking(g,-.089,-.018,.115,asimov);
    barrel(g,steel(),-.005,.83,.029,.58);barrel(g,black(),-.005,1.095,.043,.12);
    barrel(g,material(0x03090b),-.005,1.159,.025,.006);
    for(const x of [-.043,.043])for(let i=0;i<3;i++)box(g,steel(),x,.005,1.066+i*.027,.007,.024,.012);
    profile(g,[[.43,.045],[.79,.045],[.83,-.01],[.77,-.115],[.43,-.115]],.17,paint);
    for(const x of [-.089,.089]) {
        for(let i=0;i<5;i++)box(g,black(),x,-.015,.48+i*.059,.009,.028,.04);
        box(g,accent,x,-.071,.6,.013,.032,.26);box(g,black(),x,-.098,.64,.018,.016,.17);
    }
    rail(g,.35,.088,.87);rail(g,.62,-.136,.23);sight(g,-.035,.124);sight(g,.81,.117,true);
    barrel(g,steel(),-.035,-.21,.047,.22);
    profile(g,[[-.39,.035],[-.12,.035],[-.15,-.09],[-.36,-.2],[-.43,-.2],[-.43,-.02]],.14,paint,0,
        [[[-.355,-.026],[-.19,-.026],[-.215,-.072],[-.355,-.138]]]);
    box(g,black(),0,-.087,-.445,.155,.25,.033);box(g,accent,-.077,-.02,-.3,.015,.04,.12);
    grip(g,-.04,-.11,paint);trigger(g,.104,-.106);
    profile(g,[[.21,-.105],[.365,-.105],[.37,-.255],[.43,-.375],[.3,-.4],[.23,-.285]],.098,paint);
    for(const x of [-.053,.053])for(let i=0;i<3;i++)profile(g,[[.25+i*.034,-.18],[.261+i*.034,-.18],[.3+i*.034,-.355],[.284+i*.034,-.355]],.004,dark(),x,[],0);
    profile(g,[[.285,-.365],[.429,-.345],[.443,-.391],[.3,-.421]],.11,accent);
    for(const u of [-.045,.32])for(const x of [-.083,.083])pin(g,x,-.074,u);
    g.userData.muzzle=[0,-.005,-1.16];
}
function smg(g: THREE.Group) {
    const paint=coating(false);
    profile(g,[[-.12,.065],[.56,.065],[.59,-.035],[.47,-.13],[-.12,-.13]],.17,dark());
    profile(g,[[.3,.03],[.59,.03],[.57,-.095],[.28,-.095]],.184,paint);
    for(const x of [-.099,.099]) {
        box(g,black(),x,-.017,.38,.008,.029,.088);box(g,black(),x,-.017,.5,.008,.029,.08);
        box(g,lime(),x,-.075,.45,.011,.018,.22);box(g,steel(),x,.017,.025,.012,.021,.16);
    }
    barrel(g,steel(),-.02,.69,.032,.24);barrel(g,black(),-.02,.785,.04,.06);barrel(g,material(0x03090b),-.02,.819,.022,.006);
    rail(g,.2,.092,.66);sight(g,-.075,.124);sight(g,.545,.124,true);
    profile(g,[[-.16,.02],[-.4,.005],[-.44,-.215],[-.35,-.215],[-.14,-.095]],.115,paint,0,
        [[[-.21,-.024],[-.34,-.028],[-.365,-.148],[-.22,-.076]]]);
    box(g,black(),0,-.112,-.438,.125,.252,.033);box(g,lime(),-.063,-.038,-.32,.012,.025,.095);
    grip(g,-.055,-.12,paint);trigger(g,.104,-.12);
    profile(g,[[.19,-.12],[.31,-.12],[.33,-.445],[.215,-.46]],.097,black());
    for(const x of [-.053,.053])for(let i=0;i<3;i++)box(g,steel(),x,-.305,.218+i*.029,.006,.205,.009);
    box(g,lime(),0,-.46,.269,.112,.033,.132);rail(g,.43,-.125,.22);pin(g,-.09,-.061,.12);
    g.userData.muzzle=[0,-.02,-.82];
}
function sniper(g: THREE.Group) {
    const paint=coating(false);
    profile(g,[[-.46,0],[-.25,.035],[-.11,.035],[-.025,-.07],[.1,-.04],[.48,-.04],[.56,-.12],[.45,-.175],[.06,-.175],[-.12,-.12],[-.25,-.24],[-.48,-.24]],.155,paint,0,
        [[[-.25,-.08],[-.165,-.076],[-.115,-.105],[-.233,-.184]]]);
    box(g,black(),0,-.12,-.492,.17,.26,.035);box(g,dark(),0,.018,-.34,.17,.085,.23);box(g,lime(),-.083,-.16,-.395,.012,.029,.15);
    barrel(g,dark(),.007,.21,.064,.64);barrel(g,steel(),.007,.88,.027,.76);barrel(g,dark(),.007,1.255,.044,.14);
    barrel(g,material(0x03090b),.007,1.328,.026,.006);
    for(const x of [-.042,.042])for(let i=0;i<3;i++)box(g,black(),x,.013,1.217+i*.035,.012,.029,.021);
    barrel(g,black(),.235,.13,.064,.59);
    for(const u of [-.06,.3]) {
        box(g,dark(),0,.115,u,.07,.12,.065);barrel(g,paint,.235,u,.092,.065);box(g,black(),0,.325,u,.065,.024,.065);
    }
    barrel(g,dark(),.235,.46,.102,.15);barrel(g,dark(),.235,-.18,.082,.11);
    barrel(g,material(0x378e88,'gem'),.235,.537,.083,.004);barrel(g,material(0x19535d,'gem'),.235,-.238,.063,.004);
    barrel(g,lime(),.235,.483,.104,.017);
    const turret=mesh(g,new THREE.CylinderGeometry(.047,.047,.075,10),black());turret.position.set(0,.326,-.12);
    for(let i=0;i<8;i++) {const a=i*Math.PI/4;box(g,steel(),Math.sin(a)*.047,.34,.12+Math.cos(a)*.047,.01,.036,.01);}
    pin(g,.1,.03,.045,.018);box(g,steel(),.135,-.003,.043,.09,.022,.025);pin(g,.18,-.03,.042,.028,black());
    profile(g,[[.105,-.13],[.28,-.13],[.28,-.295],[.11,-.3]],.092,dark());
    box(g,lime(),0,-.296,.195,.11,.024,.188);trigger(g,-.012,-.115);
    for(const x of [-.085,.085]) {box(g,dark(),x,-.102,.37,.012,.04,.19);pin(g,x,-.14,.31);}
    g.userData.muzzle=[0,.007,-1.33];
}
function pistol(g: THREE.Group) {
    const paint=coating(false);
    profile(g,[[-.02,.045],[.47,.045],[.49,-.035],[.47,-.1],[-.02,-.1]],.122,dark());
    box(g,paint,0,-.03,.433,.13,.143,.09);barrel(g,black(),-.026,.48,.037,.03);barrel(g,material(0x010608),-.026,.498,.025,.007);
    box(g,paint,0,-.115,.305,.105,.045,.3);
    for(let i=0;i<3;i++)box(g,black(),0,-.14,.29+i*.048,.113,.018,.018);
    for(const x of [-.065,.065])for(let i=0;i<6;i++)box(g,steel(),x,-.024,.002+i*.021,.006,.08,.009);
    box(g,steel(),.065,.005,.26,.009,.05,.083);box(g,paint,0,.048,.26,.099,.008,.083);
    grip(g,.035,-.125,dark());trigger(g,.19,-.13);box(g,lime(),0,-.371,.01,.119,.032,.133);
    box(g,black(),0,.064,.023,.11,.035,.025);for(const x of [-.039,.039])box(g,lime(),x,.084,.023,.015,.007,.018);
    box(g,lime(),0,.065,.446,.021,.035,.025);pin(g,-.067,-.102,.086,.009);
    g.userData.muzzle=[0,-.026,-.502];
}
function shotgun(g: THREE.Group) {
    const paint=coating(false);box(g,dark(),0,-.015,.2,.145,.17,.42);
    profile(g,[[-.38,-.025],[-.02,-.01],[-.02,-.095],[-.33,-.225],[-.41,-.225]],.135,paint);
    box(g,black(),0,-.125,-.412,.15,.24,.03);grip(g,0,-.1,paint);trigger(g,.145,-.1);
    barrel(g,steel(),.015,.73,.036,.69);barrel(g,dark(),-.07,.72,.035,.63);box(g,paint,0,-.085,.61,.162,.126,.275);
    for(let i=0;i<7;i++)box(g,black(),0,-.086,.493+i*.035,.171,.135,.012);
    barrel(g,black(),.015,1.08,.045,.09);barrel(g,material(0x010607),.015,1.128,.029,.004);
    rail(g,.16,.094,.35);sight(g,.08,.128);sight(g,1.016,.058,true);
    for(let i=0;i<4;i++)barrel(g,material(0xc46a41),-.005,.1+i*.055,.017,.103,-.09).rotation.x=0;
    g.userData.muzzle=[0,.015,-1.13];
}
function gemBlade(g: THREE.Group, points: Point[], style: KnifeStyle, holes: Point[][] = []) {
    const key=`blade:${style}`;
    if(!materials.has(key)) {const m=material(0xffffff,'gem').clone();m.vertexColors=true;materials.set(key,m);}
    const part=profile(g,points,.013,materials.get(key)!,0,holes,.012);
    const geometry=part.geometry,positions=geometry.getAttribute('position'),colors:number[]=[],color=new THREE.Color();
    const max=Math.max(...points.map(p=>p[0])),min=Math.min(...points.map(p=>p[0]));
    for(let i=0;i<positions.count;i++) {
        const u=-positions.getZ(i),y=positions.getY(i),t=THREE.MathUtils.clamp((u-min)/(max-min),0,1);
        const facet=.87+.13*Math.sin(Math.floor(i/3)*2.71);
        if(style==='butterfly-fade') color.setHSL((1.13-t*.4)%1,.87,.5);
        else if(style==='m9-ruby') color.setHSL(.98+.035*Math.sin(u*21+y*20),.88,.36+.12*Math.sin(u*43-y*36));
        else color.setHSL(.405+.035*Math.sin(u*30+y*45),.85,.3+.13*Math.sin(u*37-y*34));
        color.multiplyScalar(facet);colors.push(color.r,color.g,color.b);
    }
    geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
}
function knife(g: THREE.Group, style: KnifeStyle) {
    const emerald=material(0x16be6b,'gem'),ruby=material(0xba123f,'gem');
    if(style==='classic') {
        profile(g,[[.04,.042],[.34,.042],[.37,.012],[.34,-.054],[.04,-.054]],.075,black());
        for(let i=0;i<7;i++)box(g,dark(),0,-.006,.08+i*.036,.089,.113,.021);
        box(g,lime(),0,-.005,.035,.093,.113,.031);box(g,dark(),0,-.009,.369,.103,.235,.032);box(g,lime(),-.057,-.008,.369,.009,.098,.024);
        profile(g,[[.39,.055],[.72,.055],[.9,-.015],[.752,-.095],[.39,-.095]],.016,coating(false),0,[],.01);
        for(const x of [-.018,.018])profile(g,[[.395,-.05],[.77,-.05],[.9,-.015],[.752,-.098],[.395,-.098]],.001,material(0xf0f3de,'metal'),x,[],0);
    } else if(style.startsWith('butterfly')) {
        const accent=style==='butterfly-fade'?material(0xb52644,'gem'):emerald;
        for(const side of [-1,1]) {
            const y=side*.065;
            profile(g,[[.025,y+.04],[.28,y+.029],[.397,side*.044],[.397,side*.006],[.27,y-.023],[.025,y-.023],[-.015,y]],.062,black());
            for(const x of [-.036,.036])profile(g,[[.032,y+.024],[.253,y+.016],[.293,y-.014],[.03,y-.009]],.006,accent,x,[],.002);
            for(const u of [.035,.12,.21])for(const x of [-.042,.042])pin(g,x,y+.005,u,.014,steel());
            for(const x of [-.037,.037])pin(g,x,side*.028,.369,.028,steel());
        }
        box(g,steel(),0,.084,0,.084,.018,.072);
        gemBlade(g,[[.395,-.04],[.395,.045],[.52,.086],[.69,.09],[.82,.044],[.942,-.025],[.735,-.047],[.53,-.028]],style);
        if(style==='butterfly-emerald')for(const x of [-.025,.025])profile(g,[[.42,.03],[.69,.063],[.88,.004],[.7,.036],[.45,.007]],.002,accent,x,[],0);
    } else if(style==='karambit-emerald') {
        profile(g,[[.08,.058],[.24,.065],[.36,.025],[.455,-.028],[.446,-.095],[.38,-.098],[.322,-.048],[.272,-.069],[.23,-.032],[.171,-.05],[.117,-.012],[.058,-.015]],.082,black());
        for(const x of [-.047,.047]) {
            profile(g,[[.12,.035],[.245,.033],[.36,-.014],[.389,-.04],[.31,-.016],[.215,.005],[.127,.009]],.004,emerald,x,[],.002);
            pin(g,x,.014,.135,.018);pin(g,x,-.032,.336,.017);
        }
        ring(g,.046,.012,.087,.023,emerald);
        gemBlade(g,[[.422,.018],[.558,.015],[.678,-.036],[.741,-.134],[.747,-.25],[.685,-.36],[.597,-.411],[.643,-.276],[.625,-.166],[.539,-.102],[.44,-.085]],style);
        box(g,emerald,0,-.059,.44,.103,.095,.033);
    } else {
        profile(g,[[.02,.04],[.35,.04],[.37,-.055],[.035,-.065]],.083,black());
        for(let i=0;i<7;i++)box(g,dark(),0,-.012,.056+i*.039,.098,.135,.023);
        box(g,ruby,0,-.012,.022,.105,.133,.034);box(g,ruby,0,-.022,.385,.115,.224,.035);ring(g,.105,.385,.064,.014,ruby);
        const outline:Point[]=[[.416,.062],[.53,.062]];
        for(let i=0;i<7;i++)outline.push([.534+i*.025,.062],[.547+i*.025,.042],[.557+i*.025,.062]);
        outline.push([.768,.062],[.902,-.028],[1,-.064],[.849,-.135],[.429,-.135]);
        gemBlade(g,outline,style,[[[.749,-.014],[.828,-.025],[.844,-.047],[.829,-.069],[.755,-.052],[.737,-.033]]]);
        for(const x of [-.026,.026])profile(g,[[.432,-.087],[.873,-.087],[1,-.064],[.849,-.135],[.432,-.135]],.001,ruby,x,[],0);
    }
    g.userData.muzzle=[0,0,-.9];
}
function hands(g: THREE.Group, id: WeaponId) {
    const glove=material(0x364d42,'rubber'),seams=material(0x1e302b,'rubber'),sleeve=material(0x748572);
    const u=id==='knife'?.16:id==='pistol'?.008:-.05,y=id==='knife'?-.07:-.24;
    box(g,glove,.015,y,u,.145,.135,.16);box(g,sleeve,.035,y-.04,u-.15,.16,.16,.18);
    box(g,seams,.035,y-.024,u-.071,.166,.145,.042);
    for(let i=0;i<3;i++)box(g,seams,-.063,y+.041,u-.044+i*.041,.022,.045,.032);
    box(g,glove,-.048,y+.07,u+.047,.065,.067,.073);
    if(id!=='knife'&&id!=='pistol') {
        box(g,glove,-.052,-.175,.51,.18,.113,.19);box(g,sleeve,-.13,-.246,.455,.16,.16,.22).rotation.z=-.42;
        for(let i=0;i<3;i++)box(g,seams,-.112,-.115,.452+i*.04,.035,.064,.025);
    }
}
// Merge by material once per appearance. Swaps reuse immutable GPU geometry.
function bake(group: THREE.Group) {
    group.updateMatrixWorld(true);
    const batches=new Map<THREE.Material,THREE.BufferGeometry[]>(),originals=new Set<THREE.BufferGeometry>();
    group.traverse(object=>{
        if(!(object instanceof THREE.Mesh))return;
        const geometry=object.geometry.index?object.geometry.toNonIndexed():object.geometry.clone();
        geometry.applyMatrix4(object.matrixWorld);
        const list=batches.get(object.material)||[];list.push(geometry);batches.set(object.material,list);
        if(object.geometry!==cube)originals.add(object.geometry);
    });
    group.clear();
    batches.forEach((geometries,m)=>{
        const merged=mergeGeometries(geometries);
        if(merged){const part=new THREE.Mesh(merged,m);part.castShadow=true;group.add(part);}
        geometries.forEach(geometry=>geometry.dispose());
    });
    originals.forEach(geometry=>geometry.dispose());return group;
}
export function weaponModel(id: WeaponId, view=false, appearance: WeaponAppearance=DEFAULT_APPEARANCE) {
    const key=appearanceKey(id,appearance)+(view?':hands':':display');
    if(!models.has(key)) {
        const g=new THREE.Group();
        if(id==='rifle')rifle(g,appearance.rifleSkin==='asimov');
        else if(id==='smg')smg(g);else if(id==='sniper')sniper(g);else if(id==='pistol')pistol(g);
        else if(id==='knife')knife(g,appearance.knifeStyle);else shotgun(g);
        if(view)hands(g,id);
        g.userData.appearance=appearanceKey(id,appearance);g.userData.weapon=id;
        models.set(key,bake(g));
    }
    return models.get(key)!.clone();
}
