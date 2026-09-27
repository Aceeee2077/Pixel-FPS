import type { WeaponId } from '../WeaponConfig';

export interface RecoilStep { pitch: number; yaw: number }
/** Authored multipliers, independent of random bullet spread. */
export const RECOIL_PATTERNS: Record<WeaponId, readonly RecoilStep[]> = {
    rifle: [
        { pitch: 1, yaw: -.25 }, { pitch: 1.12, yaw: -.4 }, { pitch: 1.2, yaw: -.3 },
        { pitch: 1.25, yaw: .15 }, { pitch: 1.28, yaw: .55 }, { pitch: 1.2, yaw: .8 },
        { pitch: 1.1, yaw: .7 }, { pitch: .98, yaw: .25 }, { pitch: .92, yaw: -.45 },
        { pitch: .86, yaw: -.9 }, { pitch: .8, yaw: -.7 }, { pitch: .78, yaw: .2 },
    ],
    smg: [
        { pitch: .85, yaw: .1 }, { pitch: .9, yaw: -.4 }, { pitch: 1, yaw: -.65 },
        { pitch: 1.05, yaw: -.4 }, { pitch: 1.08, yaw: .2 }, { pitch: 1.1, yaw: .65 },
        { pitch: 1, yaw: .8 }, { pitch: .92, yaw: .3 },
    ],
    sniper: [{ pitch: 1, yaw: 0 }],
    shotgun: [{ pitch: 1, yaw: 0 }, { pitch: 1.1, yaw: .2 }],
    pistol: [{ pitch: 1, yaw: .12 }, { pitch: 1.1, yaw: -.22 }, { pitch: 1.06, yaw: .3 }],
    knife: [{ pitch: 0, yaw: 0 }],
};
