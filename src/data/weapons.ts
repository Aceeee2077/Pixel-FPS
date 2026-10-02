import type { WeaponConfig } from '../weapons/WeaponConfig';
import { weaponAsset } from './weaponAssets';
import { localReferenceImage } from './localReferenceImages';
import { cs2AssetSync, loadCs2Manifest } from './cs2Assets';

export type WeaponCategory = 'pistols' | 'smgs' | 'rifles' | 'snipers' | 'shotguns' | 'machine-guns' | 'melee';
export type WeaponSide = 'attackers' | 'defenders' | 'both';
export type WeaponSlot = 'primary' | 'secondary' | 'melee';
export type ModelFamily = 'rifle' | 'smg' | 'sniper' | 'shotgun' | 'pistol' | 'knife';
export interface WeaponDefinition extends WeaponConfig {
    id: string;
    displayName: string;
    category: WeaponCategory;
    slot: WeaponSlot;
    team: WeaponSide;
    price: number;
    config: WeaponConfig;
    rpm: number;
    fireInterval: number;
    magazine: number;
    movementSpeed: number;
    movingSpread: number;
    previewImage: string | null;
    referenceImage: string | null;
    thumbnail: string | null;
    inspectImage: string | null;
    iconPath: string | null;
    modelPath: string | null;
    worldModelPath: string | null;
    viewModelPath: string | null;
    modelFamily: ModelFamily;
    modelStatus: 'final' | 'temporary';
    skins: readonly string[];
    animationSet: string;
    headMultiplier: number;
    armorPenetration: number;
    rangeFalloff: number;
    crouchSpread: number;
    firstShotAccuracy: number;
    recoilPattern: string;
    recoilRecovery: number;
    scopeLevels: readonly number[];
    wallPenetration: number;
}
type Row = readonly [id: string, name: string, category: WeaponCategory, team: WeaponSide, price: number, image?: string, damage?: number, magazine?: number, rpm?: number, family?: ModelFamily];
// Every base weapon is listed here. Missing reference art is explicit, so the viewer never claims a generic mesh is final.
const rows: readonly Row[] = [
    ['glock','Glock','pistols','attackers',200,'Glock.png',30,20,400],
    ['usp-s','USP-S','pistols','defenders',200,'usp.png',34,12,350],
    ['p2000','P2000','pistols','defenders',200,'P2000.png',35,13,350],
    ['p250','P250','pistols','both',300,'P250.png',38,13,400],
    ['five-seven','Five-SeveN','pistols','defenders',500,'FN57.png',32,20,400],
    ['tec-9','Tec-9','pistols','attackers',500,'TEC-9.png',33,18,500],
    ['cz75','CZ75-Auto','pistols','both',500,'CZ75.png',25,12,600],
    ['dual-berettas','Dual Berettas','pistols','both',300,undefined,28,30,500],
    ['deagle','Desert Eagle','pistols','both',700,'Deagle.png',63,7,260],
    ['r8','R8 Revolver','pistols','both',600,undefined,65,8,220],
    ['mp9','MP9','smgs','defenders',1250,'MP9.png',26,30,850],
    ['mac-10','MAC-10','smgs','attackers',1050,'MAC-10.png',25,30,800],
    ['mp5-sd','MP5-SD','smgs','both',1500,undefined,27,30,750],
    ['mp7','MP7','smgs','both',1500,'MP7.png',29,30,750],
    ['ump-45','UMP-45','smgs','both',1200,'UMP-45.png',35,25,660],
    ['pp-bizon','PP-Bizon','smgs','both',1400,'PP19.png',27,64,750],
    ['p90','P90','smgs','both',2350,'P90.png',26,50,850],
    ['ak-47','AK-47','rifles','attackers',2700,'AK-47.png',36,30,600],
    ['m4a4','M4A4','rifles','defenders',3100,'M4A4.png',33,30,666],
    ['m4a1-s','M4A1-S','rifles','defenders',2900,'M4A1-S.png',38,20,600],
    ['galil-ar','Galil AR','rifles','attackers',1800,undefined,30,35,666],
    ['famas','FAMAS','rifles','defenders',2050,'FAMAS.png',30,25,666],
    ['aug','AUG','rifles','defenders',3300,'AUG.png',28,30,600],
    ['sg-553','SG 553','rifles','attackers',3000,undefined,30,30,666],
    ['awp','AWP','snipers','both',4750,'AWP.png',105,5,48],
    ['ssg-08','SSG 08','snipers','both',1700,undefined,88,10,48],
    ['scar-20','SCAR-20','snipers','defenders',5000,undefined,75,20,240],
    ['g3sg1','G3SG1','snipers','attackers',5000,undefined,75,20,240],
    ['nova','Nova','shotguns','both',1050,undefined,15,8,85],
    ['xm1014','XM1014','shotguns','both',2000,undefined,12,7,170],
    ['mag-7','MAG-7','shotguns','defenders',1300,undefined,18,5,85],
    ['sawed-off','Sawed-Off','shotguns','attackers',1100,undefined,20,7,85],
    ['m249','M249','machine-guns','both',5200,undefined,32,100,750,'rifle'],
    ['negev','Negev','machine-guns','both',1700,undefined,28,150,800,'rifle'],
    ['knife','Combat Knife','melee','both',0,'Knife.png',45,1,150],
    ['butterfly','Butterfly Knife','melee','both',0,'Butterfly_Knife_Emerald.png',45,1,150],
    ['karambit','Karambit','melee','both',0,'Karambit_Emerald.png',45,1,150],
    ['m9','M9 Bayonet','melee','both',0,'M9Bayonet_Ruby.png',45,1,150],
];
/** Punctuation-insensitive id lookup for imported assets and display names. */
export function normalizeWeaponId(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}
const familyOf = (category: WeaponCategory): ModelFamily =>
    category === 'pistols' ? 'pistol' : category === 'smgs' ? 'smg' :
    category === 'snipers' ? 'sniper' : category === 'shotguns' ? 'shotgun' :
    category === 'melee' ? 'knife' : 'rifle';
/** Knife ids share one authored GLB per blade family, chosen by skin style. */
const knifeModelFamily: Record<string, string> = {
    knife: 'knife', butterfly: 'butterfly', karambit: 'karambit', m9: 'm9',
};
function assetsFor(id: string, category: WeaponCategory): Pick<WeaponDefinition, 'modelPath' | 'worldModelPath' | 'viewModelPath' | 'modelStatus'> {
    const key = category === 'melee' ? knifeModelFamily[id] ?? id : id;
    const asset = weaponAsset(key);
    if (!asset || asset.status === 'blockout' || asset.status === 'reference_only') {
        return { modelPath: null, worldModelPath: null, viewModelPath: null, modelStatus: 'temporary' };
    }
    // Knife blade families resolve their finish at runtime via WeaponAssetLoader.
    return {
        modelPath: asset.model,
        worldModelPath: asset.model,
        viewModelPath: asset.model,
        modelStatus: asset.status === 'needs_more_reference' ? 'temporary' : 'final',
    };
}
function create(row: Row): WeaponDefinition {
    const [id, displayName, category, team, price, image, damage = 25, magazine = 30, rpm = 600, override] = row;
    const family = override ?? familyOf(category);
    const melee = category === 'melee';
    const sniper = family === 'sniper';
    const shotgun = family === 'shotgun';
    const smg = family === 'smg';
    const pistol = family === 'pistol';
    const config: WeaponConfig = {
        id, name: displayName, tag: displayName, damage, fireRate: rpm, magazineSize: magazine,
        reserveAmmo: melee ? 0 : magazine * 3, reloadTime: melee ? 0 : sniper ? 2.65 : shotgun ? 2.4 : pistol ? 1.35 : smg ? 1.55 : 1.8,
        spread: melee ? 0 : sniper ? .025 : shotgun ? .065 : pistol ? .006 : smg ? .006 : .003,
        movementSpread: melee ? 0 : sniper ? .04 : shotgun ? .018 : pistol ? .012 : .018,
        jumpSpread: melee ? 0 : sniper ? .09 : shotgun ? .035 : pistol ? .035 : .025,
        recoil: melee ? 0 : sniper ? .08 : shotgun ? .065 : pistol ? .028 : smg ? .012 : .019,
        horizontalRecoil: melee ? 0 : sniper ? .012 : pistol ? .007 : smg ? .009 : .005,
        range: melee ? 2.6 : sniper ? 200 : shotgun ? 42 : pistol ? 75 : smg ? 75 : 110,
        movementSpeedMultiplier: melee ? 1.2 : sniper ? .85 : shotgun ? .95 : pistol ? 1.09 : smg ? 1.06 : 1,
        automatic: !melee && !sniper && !shotgun && (!pistol || id === 'cz75'),
        pelletCount: shotgun ? 9 : 1, scopeFov: sniper ? 24 : id === 'aug' || id === 'sg-553' ? 48 : 70,
        color: 0x9caeaa,
        melee: melee ? {
            light: { label: 'LIGHT STAB', damage: 45, backstab: 90, windup: .16, duration: .44, range: 2.4 },
            heavy: { label: 'HEAVY STAB', damage: 90, backstab: 180, windup: .34, duration: .72, range: 2.8 },
        } : undefined,
    };
    const authored = assetsFor(id, category);
    const referenceImage = image ? localReferenceImage(image) : null;
    const thumbnail = weaponAsset(id)?.thumbnail ?? null;
    const previewImage = referenceImage ?? thumbnail;
    return {
        ...config, rpm, fireInterval: 60 / rpm, magazine, movementSpeed: config.movementSpeedMultiplier, movingSpread: config.movementSpread,
        id, displayName, category, slot: melee ? 'melee' : pistol ? 'secondary' : 'primary',
        team, price, config, previewImage, referenceImage, thumbnail, inspectImage: previewImage, iconPath: null,
        ...authored, modelFamily: family,
        skins: melee ? ['default','emerald','fade','ruby'] : pistol ? ['default','copper'] : id === 'm4a4' ? ['standard','asimov'] : ['default'],
        animationSet: melee ? 'knife' : family, headMultiplier: 2,
        armorPenetration: sniper ? .9 : pistol ? .55 : .7,
        rangeFalloff: sniper ? .99 : shotgun ? .7 : .86,
        crouchSpread: .65, firstShotAccuracy: .9,
        recoilPattern: family, recoilRecovery: .42, scopeLevels: sniper ? [24] : [],
        wallPenetration: sniper ? .8 : pistol ? .25 : .45,
    };
}
export const weaponRegistry: readonly WeaponDefinition[] = rows.map(create);
export const weaponById = new Map(weaponRegistry.map(weapon => [weapon.id, weapon]));
const weaponByNormalizedId = new Map(weaponRegistry.flatMap(weapon => [
    [normalizeWeaponId(weapon.id), weapon], [normalizeWeaponId(weapon.displayName), weapon],
] as const));
export const weaponCategories: readonly WeaponCategory[] = ['pistols','smgs','rifles','snipers','shotguns','machine-guns','melee'];
export const buyableWeapons = weaponRegistry.filter(weapon => weapon.category !== 'melee');
export const legacyWeaponIds = { rifle: 'm4a4', smg: 'ump-45', sniper: 'awp', shotgun: 'nova', pistol: 'glock', knife: 'knife' } as const;
export function canonicalWeaponId(id: string) { return legacyWeaponIds[id as keyof typeof legacyWeaponIds] ?? id; }
export function getWeapon(id: string) { return weaponById.get(canonicalWeaponId(id)) ?? weaponByNormalizedId.get(normalizeWeaponId(id)); }

/** Development audit for missing and accidentally reused asset bindings. */
export async function validateWeaponAssets() {
    const issues: { weapon: string; issue: string; path?: string }[] = [];
    // Weapons the local CS2 conversion covers are modelled even when this
    // project ships no GLB of its own for them, so they are not "missing".
    await loadCs2Manifest();
    const models = new Map<string, string>();
    const paths = new Set<string>();
    for (const weapon of weaponRegistry) {
        const converted = cs2AssetSync(weapon.category === 'melee' ? knifeModelFamily[weapon.id] ?? weapon.id : weapon.id);
        if (!weapon.modelPath && !converted) issues.push({ weapon: weapon.id, issue: 'missing model' });
        else if (converted) paths.add(converted.view);
        else {
            const modelPath = weapon.modelPath!;
            const other = models.get(modelPath);
            if (other && other !== weapon.id) issues.push({ weapon: weapon.id, issue: `duplicate model shared with ${other}`, path: modelPath });
            models.set(modelPath, weapon.id);
            paths.add(modelPath);
        }
        if (!weapon.referenceImage && !weapon.thumbnail) issues.push({ weapon: weapon.id, issue: 'missing reference and thumbnail' });
        if (weapon.referenceImage) paths.add(weapon.referenceImage);
        if (weapon.thumbnail) paths.add(weapon.thumbnail);
    }
    await Promise.all([...paths].map(async path => {
        try {
            const response = await fetch(path, { method: 'HEAD' });
            if (!response.ok) issues.push({ weapon: 'registry', issue: `broken URL (${response.status})`, path });
        } catch { issues.push({ weapon: 'registry', issue: 'unreachable URL', path }); }
    }));
    if (issues.length) console.warn('[WeaponAsset] validation', issues);
    return issues;
}
