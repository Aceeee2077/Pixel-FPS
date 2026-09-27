import { getWeapon } from '../data/weapons';
import type { WeaponId } from '../weapons/WeaponConfig';

export type Firearm = Exclude<WeaponId, 'knife'>;
type GunProfile = { length: number; crack: number; body: number; weight: number; decay: number; tail: number; action: number; level: number };
/** Original layered percussion: muzzle pressure, broadband crack, receiver and short reflections. */
export const GUN_SOUND: Record<Firearm, GunProfile> = {
    rifle:   { length: .46, crack: 4400, body: 155, weight: .86, decay: .031, tail: .066, action: .028, level: .87 },
    smg:     { length: .32, crack: 3200, body: 210, weight: .64, decay: .023, tail: .043, action: .021, level: .72 },
    pistol:  { length: .38, crack: 5400, body: 185, weight: .70, decay: .026, tail: .050, action: .036, level: .79 },
    sniper:  { length: .92, crack: 6100, body: 88,  weight: 1.1, decay: .059, tail: .155, action: .39,  level: 1.06 },
    shotgun: { length: .78, crack: 2400, body: 112, weight: 1.0, decay: .052, tail: .114, action: .27,  level: .99 },
};

function random(seed: number) {
    let state = seed | 0;
    return () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 2147483648 - 1; };
}
function lowpass(hz: number, rate: number) {
    const alpha = 1 - Math.exp(-2 * Math.PI * hz / rate);
    let previous = 0;
    return (value: number) => previous += alpha * (value - previous);
}
function bandpass(hz: number, q: number, rate: number) {
    const w = 2 * Math.PI * Math.min(hz, rate * .45) / rate, alpha = Math.sin(w) / (2 * q);
    const a0 = 1 + alpha, b = alpha / a0, a1 = -2 * Math.cos(w) / a0, a2 = (1 - alpha) / a0;
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    return (x: number) => { const y = b * (x - x2) - a1 * y1 - a2 * y2; x2 = x1; x1 = x; y2 = y1; y1 = y; return y; };
}
/** Remove DC, apply a soft ceiling and a click-free boundary, preserving each weapon's dynamics. */
function finish(samples: Float32Array, rate: number, peak = .92) {
    const dc = lowpass(32, rate);
    let maximum = 0;
    for (let i = 0; i < samples.length; i++) {
        const value = samples[i] - dc(samples[i]);
        samples[i] = Math.tanh(value * 1.45) * Math.min(1, i / (rate * .0004), (samples.length - 1 - i) / (rate * .012));
        maximum = Math.max(maximum, Math.abs(samples[i]));
    }
    if (maximum > 0) for (let i = 0; i < samples.length; i++) samples[i] *= peak / maximum;
    return samples;
}

export function gunSamples(id: Firearm, rate: number, variant = 0): Float32Array {
    const soundId = getWeapon(id)?.modelFamily ?? id;
    const p = GUN_SOUND[soundId] ?? GUN_SOUND.rifle, out = new Float32Array(Math.ceil(rate * p.length));
    const index = Object.keys(GUN_SOUND).indexOf(soundId);
    const noise = random(0x6d2b79f5 ^ ((index + 1) * 1234567) ^ ((variant + 1) * 98761));
    const air = lowpass(p.crack, rate), body = bandpass(p.body * 2.7, .65, rate), bark = bandpass(1100 + index * 133, .8, rate);
    const rumble = lowpass(410, rate), bright = bandpass(3600 + index * 240, 1.7, rate), distant = lowpass(1250, rate);
    let phase = 0;
    const weight = 1 + (variant - 1.5) * .018;
    for (let i = 0; i < out.length; i++) {
        const t = i / rate, n = noise(), filtered = air(n);
        const attack = 1 - Math.exp(-t / .00022);
        // Short pressure pulse has a fast, shallow pitch fall; no long laser-like sweep.
        phase += 2 * Math.PI * p.body * weight * (1 + .9 * Math.exp(-t / .006)) / rate;
        const pressure = (Math.sin(phase) + .24 * Math.sin(phase * 1.93)) * Math.exp(-t / p.decay) * p.weight;
        const crack = (filtered - rumble(filtered)) * Math.exp(-t / .0055) * 2.7;
        const report = (body(n) * 1.55 + bark(n) * .78) * Math.exp(-t / (p.decay * .9));
        const gas = distant(n) * .55 * Math.exp(-t / p.tail) * (1 - Math.exp(-t / .007));
        const boltT = t - p.action;
        const mechanism = boltT >= 0 ? bright(n) * Math.exp(-boltT / .009) * (soundId === 'sniper' || soundId === 'shotgun' ? .33 : .19) : 0;
        out[i] = attack * (pressure * .72 + crack + report + gas) + mechanism;
    }
    // Quiet early reflections add scale without smearing automatic fire into continuous hiss.
    const dry = out.slice();
    const heavy = soundId === 'sniper' || soundId === 'shotgun';
    for (const [seconds, gain] of [[.027, .11], [.061, .06], [.113, heavy ? .065 : .023]]) {
        const offset = Math.round(seconds * rate), filter = lowpass(1900, rate);
        for (let i = offset; i < out.length; i++) out[i] += filter(dry[i - offset]) * gain;
    }
    return finish(out, rate);
}

export type Foley = 'mag-out' | 'mag-in' | 'bolt' | 'draw' | 'blade' | 'fold' | 'light' | 'heavy' | 'impact' | 'head';
/** Grip friction and several inharmonic resonances keep mechanical actions dry and non-musical. */
export function foleySamples(kind: Foley, rate: number, variant = 0): Float32Array {
    const blade = kind === 'blade', swing = kind === 'light' || kind === 'heavy', heavy = kind === 'heavy';
    const length = swing ? (heavy ? .27 : .17) : blade ? .22 : kind === 'draw' ? .19 : .14;
    const out = new Float32Array(Math.ceil(rate * length));
    const kinds: Foley[] = ['mag-out', 'mag-in', 'bolt', 'draw', 'blade', 'fold', 'light', 'heavy', 'impact', 'head'];
    const index = kinds.indexOf(kind), noise = random(98765431 ^ ((index + 1) * 5527) ^ ((variant + 1) * 21397));
    const low = lowpass(swing ? (heavy ? 1200 : 2700) : kind === 'impact' ? 850 : 4200, rate);
    const resonance = bandpass(blade ? 3700 : kind === 'head' ? 2900 : 1500 + index * 57, 2, rate);
    let phase = 0;
    for (let i = 0; i < out.length; i++) {
        const t = i / rate, n = noise();
        if (swing) {
            const envelope = Math.pow(Math.max(0, Math.sin(Math.PI * t / length)), heavy ? 1.8 : 2.8);
            out[i] = low(n) * envelope * (1 + .25 * Math.sin(t * 71));
        } else {
            const slow = blade || kind === 'draw' || kind === 'mag-out';
            const attack = 1 - Math.exp(-t / (slow ? .005 : .0004));
            const decay = slow ? .031 : kind === 'impact' ? .022 : .008;
            const scrape = low(n) * Math.exp(-t / decay);
            const metal = resonance(n) * Math.exp(-t / (blade ? .044 : .017));
            phase += 2 * Math.PI * (kind === 'impact' ? 105 : 340 + index * 40) / rate;
            const thud = Math.sin(phase) * Math.exp(-t / .011) * (kind === 'impact' || kind === 'mag-in' ? .7 : .12);
            out[i] = attack * (scrape + metal * (kind === 'impact' ? .08 : .48) + thud);
            if (kind === 'bolt' || kind === 'fold') {
                const dt = t - .036;
                if (dt > 0) out[i] += n * .6 * Math.exp(-dt / .005);
            }
        }
    }
    return finish(out, rate, swing ? .7 : .84);
}

/** Camera yaw follows Three.js (-Z forward); sources to the right must pan right. */
export function soundPosition(origin: { x: number; y: number; z: number }, listener: { x: number; y: number; z: number }, yaw: number) {
    const x = origin.x - listener.x, y = origin.y - listener.y, z = origin.z - listener.z;
    const horizontal = Math.hypot(x, z);
    return { distance: Math.max(.01, Math.hypot(x, y, z)), pan: horizontal > .001 ? (Math.cos(yaw) * x - Math.sin(yaw) * z) / horizontal : 0 };
}
