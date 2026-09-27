import { getWeapon } from '../data/weapons';
import type { Settings } from '../core/Settings';
import type { MeleeKind, WeaponId } from '../weapons/WeaponConfig';
import type { Weapon } from '../weapons/Weapon';
import { foleySamples, gunSamples, GUN_SOUND, soundPosition, type Foley } from './WeaponSounds';

type Voice = { source: AudioScheduledSourceNode; gain: GainNode; priority: number; group: 'world' | 'weapon' | 'ui'; dispose: () => void };
type ReloadCue = { at: number; kind: Foley; gain: number };
const RELOAD_CUES: Record<Exclude<WeaponId, 'knife'>, ReloadCue[]> = {
    rifle: [{ at: 0, kind: 'mag-out', gain: .20 }, { at: .48, kind: 'mag-in', gain: .31 }, { at: .83, kind: 'bolt', gain: .23 }],
    smg: [{ at: 0, kind: 'mag-out', gain: .18 }, { at: .46, kind: 'mag-in', gain: .27 }, { at: .84, kind: 'bolt', gain: .19 }],
    pistol: [{ at: 0, kind: 'mag-out', gain: .16 }, { at: .52, kind: 'mag-in', gain: .24 }, { at: .85, kind: 'bolt', gain: .20 }],
    sniper: [{ at: 0, kind: 'bolt', gain: .24 }, { at: .22, kind: 'mag-out', gain: .19 }, { at: .61, kind: 'mag-in', gain: .30 }, { at: .88, kind: 'bolt', gain: .29 }],
    shotgun: [{ at: 0, kind: 'mag-out', gain: .19 }, { at: .29, kind: 'mag-in', gain: .22 }, { at: .51, kind: 'mag-in', gain: .22 }, { at: .72, kind: 'mag-in', gain: .22 }, { at: .9, kind: 'bolt', gain: .28 }],
};

/** Cached original percussion and foley, mixed with distance filtering and peak control. */
export class AudioManager {
    context: AudioContext | OfflineAudioContext | null = null;
    master: GainNode | null = null;
    noise: AudioBuffer | null = null;
    private mix: DynamicsCompressorNode | null = null;
    private bank = new Map<string, AudioBuffer>();
    private active = new Set<Voice>();
    private variation = 0;
    private reloadTrack?: { weapon: Weapon; cues: ReloadCue[]; next: number };
    get voices() { return this.active.size; }
    constructor(public settings: Settings, context?: AudioContext | OfflineAudioContext) { this.context = context ?? null; }
    unlock() {
        try {
            if (!this.context) this.context = new AudioContext({ latencyHint: 'interactive' });
            const ctx = this.context;
            if (!this.master) {
                this.master = ctx.createGain();
                this.mix = ctx.createDynamicsCompressor();
                this.mix.threshold.value = -8;
                this.mix.knee.value = 8;
                this.mix.ratio.value = 6;
                this.mix.attack.value = .001;
                this.mix.release.value = .085;
                this.mix.connect(this.master);
                this.master.connect(ctx.destination);
                this.master.gain.value = this.settings.data.volume * this.settings.data.sfx;
                this.noise = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * .4), ctx.sampleRate);
                const samples = this.noise.getChannelData(0);
                for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
                // Prepare once outside the trigger path so the first shot cannot hitch on synthesis.
                for (const id of Object.keys(GUN_SOUND) as Exclude<WeaponId, 'knife'>[])
                    for (let variant = 0; variant < 4; variant++) this.buffer('gun:' + id, variant, () => gunSamples(id, ctx.sampleRate, variant));
            }
            if (ctx instanceof AudioContext) void ctx.resume().catch(() => {});
            this.volume();
        } catch { /* A denied audio device must never prevent playing. */ }
    }
    volume() {
        if (this.master && this.context)
            this.master.gain.setTargetAtTime(this.settings.data.volume * this.settings.data.sfx, this.context.currentTime, .02);
    }
    private buffer(key: string, variant: number, samples: () => Float32Array) {
        const cacheKey = key + ':' + variant;
        if (!this.bank.has(cacheKey)) {
            const data = samples(), buffer = this.context!.createBuffer(1, data.length, this.context!.sampleRate);
            buffer.getChannelData(0).set(data); this.bank.set(cacheKey, buffer);
        }
        return this.bank.get(cacheKey)!;
    }
    private room(priority: number) {
        if (this.active.size < 48) return true;
        const victim = [...this.active].find(v => v.priority < priority);
        if (!victim) return false;
        victim.source.stop(); victim.dispose(); return true;
    }
    private track(source: AudioScheduledSourceNode, gain: GainNode, nodes: AudioNode[], priority: number, group: Voice['group']) {
        const voice: Voice = { source, gain, priority, group, dispose: () => {
            if (!this.active.delete(voice)) return;
            source.disconnect(); nodes.forEach(n => n.disconnect());
        } };
        this.active.add(voice); source.onended = voice.dispose; return voice;
    }
    private play(buffer: AudioBuffer, gain: number, options: { pan?: number; cutoff?: number; rate?: number; delay?: number; priority?: number; group?: Voice['group']; duration?: number } = {}) {
        const ctx = this.context, priority = options.priority ?? 2;
        if (!ctx || !this.mix || gain <= 0 || !this.room(priority)) return;
        const source = ctx.createBufferSource(), amp = ctx.createGain(), filter = ctx.createBiquadFilter(), panner = ctx.createStereoPanner();
        const at = ctx.currentTime + (options.delay ?? 0);
        source.buffer = buffer; source.playbackRate.value = options.rate ?? 1;
        filter.type = 'lowpass'; filter.frequency.value = Math.min(ctx.sampleRate * .45, options.cutoff ?? 16000); filter.Q.value = .55;
        panner.pan.value = Math.max(-1, Math.min(1, options.pan ?? 0));
        amp.gain.setValueAtTime(gain, at);
        if (options.duration) amp.gain.exponentialRampToValueAtTime(.0001, at + options.duration);
        source.connect(filter); filter.connect(panner); panner.connect(amp); amp.connect(this.mix);
        this.track(source, amp, [filter, panner, amp], priority, options.group ?? 'world');
        source.start(at);
        if (options.duration) source.stop(at + options.duration + .005);
    }
    tone(frequency: number, duration: number, gain = .1, type: OscillatorType = 'sine', end = frequency, delay = 0) {
        const ctx = this.context;
        if (!ctx || !this.mix || !this.room(0)) return;
        const osc = ctx.createOscillator(), amp = ctx.createGain(), at = ctx.currentTime + delay;
        osc.type = type; osc.frequency.setValueAtTime(frequency, at); osc.frequency.exponentialRampToValueAtTime(Math.max(20, end), at + duration);
        amp.gain.setValueAtTime(0, at); amp.gain.linearRampToValueAtTime(gain, at + .001);
        amp.gain.exponentialRampToValueAtTime(.0001, at + duration);
        osc.connect(amp); amp.connect(this.mix);
        this.track(osc, amp, [amp], 0, 'ui'); osc.start(at); osc.stop(at + duration + .01);
    }
    burst(duration: number, gain: number, cutoff: number, pan = 0) {
        if (this.noise) this.play(this.noise, gain, { cutoff, pan, duration, priority: 0 });
    }
    gun(id: WeaponId, distance = 0, pan = 0) {
        if (!this.context || !this.mix || id === 'knife' || distance >= 200) return;
        const family = getWeapon(id)?.modelFamily ?? id;
        const local = distance === 0, profile = GUN_SOUND[family] ?? GUN_SOUND.rifle, variant = this.variation++ % 4;
        const attenuation = local ? 1 : .58 / Math.pow(1 + distance / 23, 1.05) * Math.min(1, (200 - distance) / 35);
        const buffer = this.buffer('gun:' + id, variant, () => gunSamples(id, this.context!.sampleRate, variant));
        this.play(buffer, profile.level * attenuation, {
            pan, cutoff: local ? 16000 : Math.max(950, 11500 / (1 + distance / 28)),
            rate: 1 + (Math.random() - .5) * .024, priority: local ? 3 : 1,
        });
    }
    gunAt(id: WeaponId, origin: { x: number; y: number; z: number }, listener: { x: number; y: number; z: number }, yaw: number) {
        const { distance, pan } = soundPosition(origin, listener, yaw); this.gun(id, distance, pan);
    }
    private foley(kind: Foley, gain: number, delay = 0, group: Voice['group'] = 'weapon') {
        if (!this.context || !this.mix) return;
        const variant = this.variation++ % 3;
        this.play(this.buffer(kind, variant, () => foleySamples(kind, this.context!.sampleRate, variant)), gain, {
            delay, group, rate: 1 + (Math.random() - .5) * .04, priority: group === 'weapon' ? 2 : 0,
        });
    }
    drawWeapon(id: WeaponId) {
        this.cancelWeapon();
        if (id === 'knife') return;
        this.foley('draw', .19, .08); this.foley((getWeapon(id)?.modelFamily ?? id) === 'pistol' ? 'mag-in' : 'bolt', .1, .2);
    }
    drawBlade(folding = false) {
        this.cancelWeapon();
        this.foley('draw', .11);
        this.foley('blade', .22, .12);
        if (folding) { this.foley('fold', .15, .31); this.foley('fold', .18, .52); }
        else this.foley('mag-in', .10, .48);
    }
    melee(kind: MeleeKind) { this.foley(kind, kind === 'heavy' ? .37 : .27); }
    meleeHit(backstab = false) { this.foley('impact', backstab ? .49 : .36, 0, 'world'); if (backstab) this.foley('head', .14, .016, 'world'); }
    hit(head = false) { this.foley(head ? 'head' : 'impact', head ? .17 : .085, 0, 'world'); }
    kill() { this.tone(620, .075, .055, 'sine', 740); this.tone(1040, .085, .045, 'sine', 1180, .07); }
    reload(weapon: Weapon) {
        this.cancelWeapon();
        if (weapon.config.id === 'knife' || weapon.reloadLeft <= 0) return;
        this.reloadTrack = { weapon, cues: RELOAD_CUES[getWeapon(weapon.config.id)?.modelFamily ?? weapon.config.id] ?? RELOAD_CUES.rifle, next: 0 };
        this.updateWeapon(weapon, true);
    }
    /** Progress follows game time, so pausing, dying or switching cannot leave delayed reload sounds. */
    updateWeapon(weapon: Weapon, alive: boolean) {
        if (!alive) { this.cancelWeapon(); return; }
        if (this.reloadTrack && this.reloadTrack.weapon !== weapon) this.cancelWeapon();
        if (!this.reloadTrack && weapon.reloadLeft > 0 && weapon.config.id !== 'knife') {
            const cues = RELOAD_CUES[getWeapon(weapon.config.id)?.modelFamily ?? weapon.config.id] ?? RELOAD_CUES.rifle, progress = 1 - weapon.reloadLeft / weapon.config.reloadTime;
            this.reloadTrack = { weapon, cues, next: cues.findIndex(c => c.at >= progress) };
            if (this.reloadTrack.next < 0) this.reloadTrack = undefined;
        }
        const track = this.reloadTrack;
        if (!track) return;
        const progress = 1 - Math.max(0, weapon.reloadLeft) / weapon.config.reloadTime;
        while (track.next < track.cues.length && progress >= track.cues[track.next].at) {
            const cue = track.cues[track.next++]; this.foley(cue.kind, cue.gain);
        }
        if (weapon.reloadLeft <= 0) this.reloadTrack = undefined;
    }
    cancelWeapon() {
        this.reloadTrack = undefined;
        for (const voice of [...this.active]) if (voice.group === 'weapon') { voice.source.stop(); voice.dispose(); }
    }
    stopAll() {
        this.reloadTrack = undefined;
        for (const voice of [...this.active]) { voice.source.stop(); voice.dispose(); }
    }
    footstep() { this.burst(.045, .06, 550); }
    jump() { this.burst(.09, .07, 750); }
    ui() { this.unlock(); this.tone(520, .055, .06, 'sine', 800); }
}
