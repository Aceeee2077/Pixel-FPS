/**
 * Maps this project's weapon ids onto the Counter-Strike 2 resources that ship
 * inside the user's own installation.
 *
 * The paths below were read out of the local VPK (see `scan.mjs`), not guessed:
 * they are the `weapons/models/<folder>/<file>.vmdl_c` entries that exist on
 * disk. `optional: true` entries may be absent from a given build, and are
 * reported as missing instead of failing the run.
 */

/** Which mesh inside a converted model is the first-person body and which is the world LOD. */
export const MESH_VARIANTS = {
    /** Highest detail; used for the first-person viewmodel. */
    view: ['body_hd', 'body'],
    /** Lower detail; used for the dropped/world model. */
    world: ['body_legacy', 'body_lod', 'body'],
};

export const WEAPONS = [
    // pistols
    { id: 'glock', category: 'pistol', model: 'weapons/models/glock18/weapon_pist_glock18.vmdl_c' },
    { id: 'usp-s', category: 'pistol', model: 'weapons/models/usp_silencer/weapon_pist_usp_silencer.vmdl_c' },
    { id: 'p2000', category: 'pistol', model: 'weapons/models/hkp2000/weapon_pist_hkp2000.vmdl_c' },
    { id: 'p250', category: 'pistol', model: 'weapons/models/p250/weapon_pist_p250.vmdl_c' },
    { id: 'five-seven', category: 'pistol', model: 'weapons/models/fiveseven/weapon_pist_fiveseven.vmdl_c' },
    { id: 'tec-9', category: 'pistol', model: 'weapons/models/tec9/weapon_pist_tec9.vmdl_c' },
    { id: 'cz75', category: 'pistol', model: 'weapons/models/cz75a/weapon_pist_cz75a.vmdl_c' },
    { id: 'dual-berettas', category: 'pistol', model: 'weapons/models/elite/weapon_pist_elite.vmdl_c' },
    { id: 'deagle', category: 'pistol', model: 'weapons/models/deagle/weapon_pist_deagle.vmdl_c' },
    { id: 'r8', category: 'pistol', model: 'weapons/models/revolver/weapon_pist_revolver.vmdl_c' },
    // smgs
    { id: 'mp9', category: 'smg', model: 'weapons/models/mp9/weapon_smg_mp9.vmdl_c' },
    { id: 'mac-10', category: 'smg', model: 'weapons/models/mac10/weapon_smg_mac10.vmdl_c' },
    { id: 'mp5-sd', category: 'smg', model: 'weapons/models/mp5sd/weapon_smg_mp5sd.vmdl_c' },
    { id: 'mp7', category: 'smg', model: 'weapons/models/mp7/weapon_smg_mp7.vmdl_c' },
    { id: 'ump-45', category: 'smg', model: 'weapons/models/ump45/weapon_smg_ump45.vmdl_c' },
    { id: 'pp-bizon', category: 'smg', model: 'weapons/models/bizon/weapon_smg_bizon.vmdl_c' },
    { id: 'p90', category: 'smg', model: 'weapons/models/p90/weapon_smg_p90.vmdl_c' },
    // rifles
    { id: 'ak-47', category: 'rifle', model: 'weapons/models/ak47/weapon_rif_ak47.vmdl_c' },
    { id: 'm4a4', category: 'rifle', model: 'weapons/models/m4a4/weapon_rif_m4a4.vmdl_c' },
    { id: 'm4a1-s', category: 'rifle', model: 'weapons/models/m4a1_silencer/weapon_rif_m4a1_silencer.vmdl_c' },
    { id: 'galil-ar', category: 'rifle', model: 'weapons/models/galilar/weapon_rif_galilar.vmdl_c' },
    { id: 'famas', category: 'rifle', model: 'weapons/models/famas/weapon_rif_famas.vmdl_c' },
    { id: 'aug', category: 'rifle', model: 'weapons/models/aug/weapon_rif_aug.vmdl_c' },
    { id: 'sg-553', category: 'rifle', model: 'weapons/models/sg556/weapon_rif_sg556.vmdl_c' },
    // snipers
    { id: 'awp', category: 'sniper', model: 'weapons/models/awp/weapon_snip_awp.vmdl_c' },
    { id: 'ssg-08', category: 'sniper', model: 'weapons/models/ssg08/weapon_snip_ssg08.vmdl_c' },
    { id: 'scar-20', category: 'sniper', model: 'weapons/models/scar20/weapon_snip_scar20.vmdl_c' },
    { id: 'g3sg1', category: 'sniper', model: 'weapons/models/g3sg1/weapon_snip_g3sg1.vmdl_c' },
    // shotguns
    { id: 'nova', category: 'shotgun', model: 'weapons/models/nova/weapon_shot_nova.vmdl_c' },
    { id: 'xm1014', category: 'shotgun', model: 'weapons/models/xm1014/weapon_shot_xm1014.vmdl_c' },
    { id: 'mag-7', category: 'shotgun', model: 'weapons/models/mag7/weapon_shot_mag7.vmdl_c' },
    { id: 'sawed-off', category: 'shotgun', model: 'weapons/models/sawedoff/weapon_shot_sawedoff.vmdl_c' },
    // heavy
    { id: 'm249', category: 'machine-gun', model: 'weapons/models/m249/weapon_mach_m249.vmdl_c' },
    { id: 'negev', category: 'machine-gun', model: 'weapons/models/negev/weapon_mach_negev.vmdl_c' },
    // melee - the four the game already exposes
    { id: 'knife', category: 'knife', model: 'weapons/models/knife/knife_default_ct/weapon_knife_default_ct.vmdl_c' },
    { id: 'butterfly', category: 'knife', model: 'weapons/models/knife/knife_butterfly/weapon_knife_butterfly.vmdl_c' },
    { id: 'karambit', category: 'knife', model: 'weapons/models/knife/knife_karambit/weapon_knife_karambit.vmdl_c' },
    { id: 'm9', category: 'knife', model: 'weapons/models/knife/knife_m9/weapon_knife_m9.vmdl_c' },
    // The remaining blades exist locally; exporting them keeps the collection one
    // row away from being extended without inventing anything.
    { id: 'knife-default-t', category: 'knife', model: 'weapons/models/knife/knife_default_t/weapon_knife_default_t.vmdl_c' },
    { id: 'knife-classic', category: 'knife', model: 'weapons/models/knife/knife_css/weapon_knife_css.vmdl_c' },
    { id: 'knife-bayonet', category: 'knife', model: 'weapons/models/knife/knife_bayonet/weapon_knife_bayonet.vmdl_c' },
    { id: 'knife-flip', category: 'knife', model: 'weapons/models/knife/knife_flip/weapon_knife_flip.vmdl_c' },
    { id: 'knife-gut', category: 'knife', model: 'weapons/models/knife/knife_gut/weapon_knife_gut.vmdl_c' },
    { id: 'knife-huntsman', category: 'knife', model: 'weapons/models/knife/knife_canis/weapon_knife_canis.vmdl_c' },
    { id: 'knife-falchion', category: 'knife', model: 'weapons/models/knife/knife_falchion/weapon_knife_falchion.vmdl_c' },
    { id: 'knife-bowie', category: 'knife', model: 'weapons/models/knife/knife_bowie/weapon_knife_bowie.vmdl_c' },
    { id: 'knife-shadow-daggers', category: 'knife', model: 'weapons/models/knife/knife_push/weapon_knife_push.vmdl_c' },
    { id: 'knife-talon', category: 'knife', model: 'weapons/models/knife/knife_talon/weapon_knife_talon.vmdl_c' },
    { id: 'knife-ursus', category: 'knife', model: 'weapons/models/knife/knife_ursus/weapon_knife_ursus.vmdl_c' },
    { id: 'knife-navaja', category: 'knife', model: 'weapons/models/knife/knife_navaja/weapon_knife_navaja.vmdl_c' },
    { id: 'knife-stiletto', category: 'knife', model: 'weapons/models/knife/knife_stiletto/weapon_knife_stiletto.vmdl_c' },
    { id: 'knife-skeleton', category: 'knife', model: 'weapons/models/knife/knife_skeleton/weapon_knife_skeleton.vmdl_c' },
    { id: 'knife-kukri', category: 'knife', model: 'weapons/models/knife/knife_kukri/weapon_knife_kukri.vmdl_c' },
    { id: 'knife-paracord', category: 'knife', model: 'weapons/models/knife/knife_cord/weapon_knife_cord.vmdl_c' },
    { id: 'knife-nomad', category: 'knife', model: 'weapons/models/knife/knife_outdoor/weapon_knife_outdoor.vmdl_c' },
    { id: 'knife-tactical', category: 'knife', model: 'weapons/models/knife/knife_tactical/weapon_knife_tactical.vmdl_c' },
];

/** First-person arms, exported once and shared by every viewmodel. */
export const ARMS = { id: 'arms', model: 'weapons/models/shared/arms/weapon_arms.vmdl_c' };

export function weaponById(id) { return WEAPONS.find(weapon => weapon.id === id) ?? null; }
export function weaponIds() { return WEAPONS.map(weapon => weapon.id); }
