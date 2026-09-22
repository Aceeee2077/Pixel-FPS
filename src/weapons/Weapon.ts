import { MeleeKind, WeaponConfig } from './WeaponConfig';
export class Weapon {
    ammo: number;
    reserve: number;
    cooldown = 0;
    reloadLeft = 0;
    heat = 0;
    /** Active melee swing. The knife has no other way to deal damage. */
    attack: MeleeKind | null = null;
    attackTime = 0;
    landed = false;
    constructor(public config: WeaponConfig) { this.ammo = config.magazineSize; this.reserve = config.reserveAmmo; }
    get melee() { return this.config.melee; }
    get attacking() { return this.attack !== null; }
    /** Attack progress in 0..1, used by the first person swing animation. */
    get attackProgress() { return this.attack ? Math.min(1, this.attackTime / this.config.melee![this.attack].duration) : 0; }
    update(dt: number) { this.cooldown = Math.max(0, this.cooldown - dt); this.heat = Math.max(0, this.heat - dt * 2.8); if (this.attack) {
        this.attackTime += dt;
        if (this.attackTime >= this.config.melee![this.attack].duration) {
            this.attack = null;
            this.attackTime = 0;
        }
    } if (this.reloadLeft > 0) {
        this.reloadLeft -= dt;
        if (this.reloadLeft <= 0) {
            const n = Math.min(this.config.magazineSize - this.ammo, this.reserve);
            this.ammo += n;
            this.reserve -= n;
            this.reloadLeft = 0;
        }
    } }
    reload() { if (this.config.id === 'knife' || this.reloadLeft > 0 || this.ammo === this.config.magazineSize || this.reserve === 0)
        return false; this.reloadLeft = this.config.reloadTime; return true; }
    /** Starts a melee swing. Cooldown covers the whole animation, so swings cannot be spammed mid-strike. */
    meleeAttack(kind: MeleeKind) { const profile = this.config.melee; if (!profile || this.attack || this.cooldown > 0 || this.reloadLeft > 0)
        return false; this.attack = kind; this.attackTime = 0; this.landed = false; this.cooldown = profile[kind].duration; return true; }
    cancelAttack() { this.attack = null; this.attackTime = 0; this.landed = false; }
    shoot() { if (this.cooldown > 0 || this.reloadLeft > 0 || this.ammo <= 0)
        return false; if (this.config.id !== 'knife')
        this.ammo--; this.cooldown = 60 / this.config.fireRate; this.heat = Math.min(5, this.heat + .6); return true; }
}
