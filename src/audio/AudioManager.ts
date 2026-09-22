import type { Settings } from '../core/Settings';
import type { MeleeKind, WeaponId } from '../weapons/WeaponConfig';
/** Original Web Audio synthesis; no external samples. */
export class AudioManager {
    context: AudioContext | null = null;
    master: GainNode | null = null;
    noise: AudioBuffer | null = null;
    voices = 0;
    constructor(public settings: Settings) { }
    unlock() { try {
        if (!this.context) {
            this.context = new AudioContext();
            this.master = this.context.createGain();
            this.master.connect(this.context.destination);
            this.noise = this.context.createBuffer(1, this.context.sampleRate * .35, this.context.sampleRate);
            const samples = this.noise.getChannelData(0);
            for (let i = 0; i < samples.length; i++)
                samples[i] = Math.random() * 2 - 1;
        }
        void this.context.resume();
        this.volume();
    }
    catch { } }
    volume() { if (this.master && this.context)
        this.master.gain.setTargetAtTime(this.settings.data.volume * this.settings.data.sfx, this.context.currentTime, .02); }
    tone(frequency: number, duration: number, gain = .1, type: OscillatorType = 'sine', end = frequency, delay = 0) { const ctx = this.context; if (!ctx || !this.master || this.voices > 28)
        return; const osc = ctx.createOscillator(), amp = ctx.createGain(); const t = ctx.currentTime + delay; osc.type = type; osc.frequency.setValueAtTime(frequency, t); osc.frequency.exponentialRampToValueAtTime(Math.max(20, end), t + duration); amp.gain.setValueAtTime(gain, t); amp.gain.exponentialRampToValueAtTime(.0001, t + duration); osc.connect(amp); amp.connect(this.master); osc.start(t); osc.stop(t + duration + .02); this.voices++; osc.onended = () => { osc.disconnect(); amp.disconnect(); this.voices--; }; }
    burst(duration: number, gain: number, cutoff: number, pan = 0) { const ctx = this.context; if (!ctx || !this.master || !this.noise || this.voices > 28)
        return; const src = ctx.createBufferSource(), amp = ctx.createGain(), filter = ctx.createBiquadFilter(), panner = ctx.createStereoPanner(); src.buffer = this.noise; filter.type = 'lowpass'; filter.frequency.value = cutoff; panner.pan.value = Math.max(-1, Math.min(1, pan)); amp.gain.setValueAtTime(gain, ctx.currentTime); amp.gain.exponentialRampToValueAtTime(.0001, ctx.currentTime + duration); src.connect(filter); filter.connect(amp); amp.connect(panner); panner.connect(this.master); src.start(); src.stop(ctx.currentTime + duration); this.voices++; src.onended = () => { src.disconnect(); filter.disconnect(); amp.disconnect(); panner.disconnect(); this.voices--; }; }
    gun(id: WeaponId, distance = 0, pan = 0) { const gain = distance ? Math.max(0, 1 - distance / 80) * .13 : .36; if (gain <= 0)
        return; if (id === 'knife') {
        this.burst(.13, .15, 1200);
        return;
    } const heavy = id === 'shotgun' || id === 'sniper'; this.burst(heavy ? .22 : .095, gain, heavy ? 1700 : 2400, pan); if (!distance)
        this.tone(heavy ? 105 : 160, .11, gain * .5, 'triangle', 40); }
    /** Blade leaving the sheath: a short, dry scrape before the swing starts. */
    drawBlade(flourish = false) { this.burst(.12, .09, 2300); this.tone(340, .09, .05, 'triangle', 620); if (flourish)
        this.tone(760, .16, .05, 'sine', 1180, .09); }
    /** Air cutting around the blade; the heavy stab gets a longer, darker whoosh. */
    melee(kind: MeleeKind) { const heavy = kind === 'heavy'; this.burst(heavy ? .22 : .12, heavy ? .17 : .12, heavy ? 1500 : 3100); this.tone(heavy ? 148 : 250, heavy ? .17 : .09, heavy ? .08 : .05, 'triangle', heavy ? 58 : 128); }
    meleeHit(backstab = false) { this.burst(.1, .22, 720); this.tone(backstab ? 205 : 168, .12, .17, 'square', backstab ? 460 : 88); if (backstab) {
        this.tone(1180, .11, .11, 'triangle', 1520, .04);
        this.tone(1580, .14, .09, 'sine', 1900, .12);
    } }
    hit(head = false) { this.tone(head ? 1250 : 800, .08, .15, 'triangle', head ? 1750 : 1000); }
    kill() { this.tone(620, .13, .12, 'sine', 820); this.tone(1040, .16, .1, 'sine', 1250, .09); }
    reload() { this.burst(.045, .17, 3500); this.tone(250, .045, .05, 'square', 180, .12); }
    footstep() { this.burst(.045, .06, 550); }
    jump() { this.burst(.09, .07, 750); }
    ui() { this.unlock(); this.tone(520, .055, .06, 'sine', 800); }
}
