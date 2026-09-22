import { Weapon } from './Weapon';
import { WEAPONS, WeaponId } from './WeaponConfig';
import { DEFAULT_APPEARANCE, type WeaponAppearance } from './WeaponAppearance';
export class WeaponManager {
    slots: Weapon[] = [];
    slot = 0;
    switchLeft = 0;
    /** Full length of the running switch animation; the knife draws noticeably slower than a gun. */
    switchTotal = 0;
    previousSlot = 0;
    readonly holsterTime = .12;
    get holstering() { return this.switching && this.switchTotal - this.switchLeft < this.holsterTime; }
    get displayed() { return this.slots[this.holstering ? this.previousSlot : this.slot]; }
    appearance: WeaponAppearance = { ...DEFAULT_APPEARANCE };
    constructor(public primary: WeaponId = 'rifle') { this.reset(); }
    get current() { return this.slots[this.slot]; }
    reset() { this.slots = [new Weapon(WEAPONS[this.primary]), new Weapon(WEAPONS.pistol), new Weapon(WEAPONS.knife)]; this.slot = 0; this.switchLeft = 0; this.switchTotal = 0; }
    select(slot: number) { if (slot === this.slot || slot < 0 || slot > 2)
        return false; this.previousSlot = this.holstering ? this.previousSlot : this.slot; this.current.cancelAttack(); this.current.reloadLeft = 0; this.slot = slot; this.switchTotal = this.switchLeft = this.slots[slot].config.id === 'knife' ? .75 : .32; return true; }
    /** Weapons are unusable while they are being raised: no firing, no stabbing. */
    get switching() { return this.switchLeft > 0; }
    update(dt: number) { this.slots.forEach(w => w.update(dt)); this.switchLeft = Math.max(0, this.switchLeft - dt); }
}
