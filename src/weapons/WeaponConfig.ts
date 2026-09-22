export type WeaponId = 'rifle' | 'smg' | 'sniper' | 'shotgun' | 'pistol' | 'knife';
export type MeleeKind = 'light' | 'heavy';
/** Melee timing is authored in seconds; the strike lands exactly at `windup`. */
export interface MeleeAttack {
    label: string;
    damage: number;
    backstab: number;
    windup: number;
    duration: number;
    range: number;
}
export interface MeleeProfile {
    light: MeleeAttack;
    heavy: MeleeAttack;
}
export interface WeaponConfig {
    id: WeaponId;
    name: string;
    tag: string;
    damage: number;
    fireRate: number;
    magazineSize: number;
    reserveAmmo: number;
    reloadTime: number;
    spread: number;
    movementSpread: number;
    jumpSpread: number;
    recoil: number;
    horizontalRecoil: number;
    range: number;
    movementSpeedMultiplier: number;
    automatic: boolean;
    pelletCount: number;
    scopeFov: number;
    color: number;
    melee?: MeleeProfile;
}
export const WEAPONS: Record<string, WeaponConfig> = {
    rifle: { id: 'rifle', name: 'Assault Rifle', tag: 'AR-30', damage: 25, fireRate: 600, magazineSize: 30, reserveAmmo: 90, reloadTime: 1.8, spread: .003, movementSpread: .012, jumpSpread: .025, recoil: .019, horizontalRecoil: .005, range: 110, movementSpeedMultiplier: 1, automatic: true, pelletCount: 1, scopeFov: 65, color: 0xb8d486 },
    smg: { id: 'smg', name: 'Submachine Gun', tag: 'VX-35', damage: 18, fireRate: 850, magazineSize: 35, reserveAmmo: 105, reloadTime: 1.55, spread: .006, movementSpread: .018, jumpSpread: .035, recoil: .012, horizontalRecoil: .009, range: 75, movementSpeedMultiplier: 1.06, automatic: true, pelletCount: 1, scopeFov: 68, color: 0xe9b86b },
    sniper: { id: 'sniper', name: 'Sniper Rifle', tag: 'SR-05', damage: 105, fireRate: 48, magazineSize: 5, reserveAmmo: 20, reloadTime: 2.65, spread: .025, movementSpread: .04, jumpSpread: .09, recoil: .08, horizontalRecoil: .012, range: 200, movementSpeedMultiplier: .85, automatic: false, pelletCount: 1, scopeFov: 24, color: 0x9cbac5 },
    shotgun: { id: 'shotgun', name: 'Shotgun', tag: 'SG-08', damage: 15, fireRate: 85, magazineSize: 8, reserveAmmo: 32, reloadTime: 2.4, spread: .065, movementSpread: .018, jumpSpread: .035, recoil: .065, horizontalRecoil: .01, range: 42, movementSpeedMultiplier: .95, automatic: false, pelletCount: 9, scopeFov: 72, color: 0xd98e6d },
    pistol: { id: 'pistol', name: 'Pistol', tag: 'P-12', damage: 30, fireRate: 340, magazineSize: 12, reserveAmmo: 48, reloadTime: 1.25, spread: .006, movementSpread: .012, jumpSpread: .035, recoil: .028, horizontalRecoil: .007, range: 75, movementSpeedMultiplier: 1.09, automatic: false, pelletCount: 1, scopeFov: 70, color: 0xc0c5c7 },
    knife: {
        id: 'knife', name: 'Combat Knife', tag: 'K-01', damage: 45, fireRate: 150, magazineSize: 1, reserveAmmo: 0, reloadTime: 0, spread: 0, movementSpread: 0, jumpSpread: 0, recoil: 0, horizontalRecoil: 0, range: 2.6, movementSpeedMultiplier: 1.2, automatic: false, pelletCount: 1, scopeFov: 90, color: 0xe1e8df,
        // CS2-style melee: a fast light stab and a slower heavy stab, both resolved on the strike frame.
        melee: {
            light: { label: 'LIGHT STAB', damage: 45, backstab: 90, windup: .16, duration: .44, range: 2.4 },
            heavy: { label: 'HEAVY STAB', damage: 90, backstab: 180, windup: .34, duration: .72, range: 2.8 },
        },
    },
};
export const PRIMARY: WeaponId[] = ['rifle', 'smg', 'sniper', 'shotgun'];
