import type { WeaponConfig } from '../WeaponConfig';
import { getWeapon } from '../../data/weapons';
import { RECOIL_PATTERNS, type RecoilStep } from './RecoilPattern';

export class RecoilController {
    shotIndex = 0;
    lastShotAt = -Infinity;
    lastWeapon = '';
    reset() { this.shotIndex = 0; this.lastShotAt = -Infinity; this.lastWeapon = ''; }
    next(config: WeaponConfig, now: number): RecoilStep {
        if (this.lastWeapon !== config.id || now - this.lastShotAt > .42) this.shotIndex = 0;
        const family = getWeapon(config.id)?.modelFamily ?? config.id;
        const pattern = RECOIL_PATTERNS[family] ?? RECOIL_PATTERNS.rifle;
        const step = pattern[Math.min(this.shotIndex, pattern.length - 1)];
        this.shotIndex++;
        this.lastShotAt = now;
        this.lastWeapon = config.id;
        return { pitch: step.pitch * config.recoil, yaw: step.yaw * config.horizontalRecoil };
    }
}
