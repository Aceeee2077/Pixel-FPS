import type { KnifeStyle } from '../WeaponAppearance';

export type KnifeFinish = 'emerald' | 'fade' | 'ruby';
export type KnifeFamily = 'butterfly' | 'karambit' | 'm9';

export function knifeFamily(style: KnifeStyle): KnifeFamily | null {
    if (style.startsWith('butterfly')) return 'butterfly';
    if (style.startsWith('karambit')) return 'karambit';
    if (style.startsWith('m9')) return 'm9';
    return null;
}
export function knifeFinish(style: KnifeStyle): KnifeFinish | null {
    if (style.endsWith('emerald')) return 'emerald';
    if (style.endsWith('fade')) return 'fade';
    if (style.endsWith('ruby')) return 'ruby';
    return null;
}
