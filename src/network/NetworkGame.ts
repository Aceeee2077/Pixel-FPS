import * as THREE from 'three';
import type { Game } from '../core/Game';
import { Bot, type Actor } from '../bots/Bot';
import { WeaponManager } from '../weapons/WeaponManager';
import { PRIMARY, WEAPONS, type WeaponId, type MeleeKind } from '../weapons/WeaponConfig';
import { trace } from '../game/Combat';
import { t } from '../core/I18n';
import { Room, PROTOCOL, cleanName } from './Room';
import type { PickupState } from '../world/PickupManager';
import type { KillEvent } from '../game/MatchManager';
import { XP_PER_KILL } from '../core/Progress';

type ActorState = { id: number; name: string; color: number; position: number[]; velocity: number[]; yaw: number; crouched: boolean; hp: number; alive: boolean; kills: number; deaths: number; score: number; streak: number; respawnAt: number; protectedUntil: number; weapon: WeaponId };
type State = { type: 'state'; round: number; map: string; time: number; remaining: number; ended: boolean; actors: ActorState[]; pickups: PickupState[]; feed: KillEvent[]; ack: number; slots: { ammo: number; reserve: number; reloadLeft: number }[] };
type Remote = { actor: Bot; loadout: WeaponManager; peer: string; pitch: number; aiming: boolean; seen: number; seq: number; poseAt: number; budget: number; target?: THREE.Vector3 };
const vector = (v: unknown): v is number[] => Array.isArray(v) && v.length === 3 && v.every(n => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) < 10000);
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** Host owns combat, clocks, inventory, respawns and supplies. Clients predict only their movement/view. */
export class NetworkGame {
    room = new Room();
    active = false;
    connecting = false;
    remotes = new Map<number, Remote>();
    private nextId = 1;
    private seq = 0;
    private round = 0;
    private receivedRound = -1;
    private processedXp = new Set<string>();
    private lastPacket = 0;
    private generation = 0;
    private interval: ReturnType<typeof setInterval>;
    get host() { return this.active && this.room.host; }
    get guest() { return this.active && !this.room.host; }
    get actors(): Actor[] { return [this.game.player, ...[...this.remotes.values()].map(r => r.actor)]; }
    constructor(private game: Game) {
        this.room.onData = (peer, data) => this.receive(peer, data);
        this.room.onLeave = peer => {
            if (!this.active) return;
            if (this.host) {
                const entry = [...this.remotes.entries()].find(([, r]) => r.peer === peer);
                if (entry) { this.remove(entry[0]); this.game.ui.notice(t('net.playerLeft')); }
            } else this.fail('hostLeft');
        };
        this.room.onError = () => { if (!this.active || !this.room.connections.size) this.fail('connectionFailed'); };
        this.interval = setInterval(() => this.pulse(), 50);
        window.addEventListener('pagehide', () => this.leave());
    }
    async connect(host: boolean, code: string, name: string) {
        if (this.connecting || this.active) return;
        const generation = ++this.generation;
        this.connecting = true;
        this.game.ui.networkStatus(t('net.connecting'));
        try {
            await this.room.open(host, code);
            if (generation !== this.generation) return;
            this.active = true; this.seq = 0; this.lastPacket = performance.now();
            this.game.player.name = cleanName(name);
            if (host) {
                this.game.player.id = 0;
                this.game.start(true);
                this.game.ui.notice(t('net.roomReady', { code: this.room.code }));
            } else this.room.send({ type: 'hello', protocol: PROTOCOL, name: cleanName(name), primary: this.game.settings.data.primary });
        } catch {
            if (generation === this.generation) { this.leave(); this.game.ui.networkStatus(t('net.connectionFailed')); }
        } finally { if (generation === this.generation) { this.connecting = false; this.game.ui.networkStatus(''); } }
    }
    leave() {
        this.generation++; this.active = false; this.connecting = false; this.room.close();
        for (const id of [...this.remotes.keys()]) this.remove(id);
        this.game.player.id = 0; this.game.player.name = 'YOU'; this.game.match.localId = 0;
        this.receivedRound = -1;
        this.processedXp.clear();
    }
    private fail(reason: string) { this.game.mainMenu(); this.game.ui.notice(t(`net.${reason}`)); }
    private remove(id: number) {
        const remote = this.remotes.get(id);
        if (remote) { this.game.scene.remove(remote.actor.group); this.remotes.delete(id); }
    }
    newRound() {
        this.round++;
        for (const remote of this.remotes.values()) { remote.loadout.reset(); remote.seq = 0; }
        this.seq = 0;
    }
    loadout(actor: Actor) { return actor === this.game.player ? this.game.weapons : this.remotes.get(actor.id)?.loadout; }
    /** Only a host-confirmed elimination can issue this event to the owning guest. */
    awardRemoteKill(killer: Actor, victim: Actor) {
        if (!this.host || killer.id === victim.id) return;
        const remote = this.remotes.get(killer.id);
        if (!remote) return;
        const weapon = remote.loadout.current.config.id;
        const eventId = this.round + ':' + victim.id + ':' + victim.deaths;
        this.room.send({ type: 'xp', eventId, weapon, amount: XP_PER_KILL }, remote.peer);
    }
    command(action: 'fire' | 'light' | 'heavy' | 'reload' | 'switch', slot?: number) {
        if (!this.guest) return;
        this.sendPose();
        this.room.send({ type: 'action', round: this.receivedRound, seq: ++this.seq, action, slot });
    }
    private sendPose() {
        const p = this.game.player;
        this.room.send({ type: 'pose', round: this.receivedRound, position: p.position.toArray(), velocity: p.velocity.toArray(), yaw: p.yaw, pitch: p.pitch + p.recoil, crouched: p.crouched, grounded: p.grounded, aiming: this.game.input.aiming });
    }
    private pulse() {
        if (!this.active) return;
        const now = performance.now();
        if (this.host) {
            // Render callbacks stop in a background tab; keep the shared simulation moving.
            if (document.hidden && !this.game.match.ended) this.game.tick(.05);
            for (const remote of this.remotes.values()) {
                if (now - remote.seen > 15000) { this.room.connections.get(remote.peer)?.close(); continue; }
                this.room.send(this.snapshot(remote), remote.peer);
            }
        } else {
            if (now - this.lastPacket > 15000) { this.fail('timeout'); return; }
            this.sendPose();
        }
    }
    private snapshot(remote: Remote): State {
        const g = this.game;
        return { type: 'state', round: this.round, map: g.map.definition.id, time: g.time, remaining: g.match.remaining, ended: g.match.ended,
            actors: this.actors.map(a => ({ id: a.id, name: a.name, color: a.color, position: a.position.toArray(), velocity: a.velocity.toArray(), yaw: a.yaw, crouched: a.crouched, hp: a.hp, alive: a.alive, kills: a.kills, deaths: a.deaths, score: a.score, streak: a.streak, respawnAt: a.respawnAt, protectedUntil: a.protectedUntil, weapon: this.loadout(a)!.current.config.id })),
            pickups: g.pickups.snapshot(), feed: g.match.feed, ack: remote.seq,
            slots: remote.loadout.slots.map(w => ({ ammo: w.ammo, reserve: w.reserve, reloadLeft: w.reloadLeft })),
        };
    }
    private receive(peer: string, data: unknown) {
        if (!this.active || !record(data)) return;
        if (this.host) this.receiveHost(peer, data);
        else {
            this.lastPacket = performance.now();
            if (data.type === 'reject') { this.fail('unavailable'); return; }
            if (data.type === 'correction' && vector(data.position)) { this.game.player.position.fromArray(data.position); this.game.player.velocity.set(0, 0, 0); }
            if (data.type === 'welcome' && Number.isInteger(data.id)) {
                this.game.player.id = data.id as number; this.game.match.localId = this.game.player.id;
            }
            if (data.type === 'state' && Array.isArray(data.actors) && data.actors.length <= 8 && Array.isArray(data.slots)) this.apply(data as unknown as State);
            if (data.type === 'hit' && typeof data.damage === 'number' && vector(data.point)) {
                this.game.ui.hit(!!data.head, !!data.back);
                if (data.melee) this.game.audio.meleeHit(!!data.back); else this.game.audio.hit(!!data.head);
                this.game.ui.damageNumber(data.damage, new THREE.Vector3().fromArray(data.point), !!data.head, !!data.back);
            }
            if (data.type === 'xp' && peer === `blockstrike-v${PROTOCOL}-${this.room.code}`
                && typeof data.eventId === 'string' && data.eventId.length < 80
                && typeof data.weapon === 'string' && WEAPONS[data.weapon]
                && data.amount === XP_PER_KILL && !this.processedXp.has(data.eventId)) {
                this.processedXp.add(data.eventId);
                const result = this.game.progress.awardKillXP(data.weapon);
                const row = this.game.lastXp.find(entry => entry.weapon === result.weapon);
                if (row) { row.gained += result.gained; row.to = result.to; }
                else this.game.lastXp.push(result);
                this.game.matchPlayerXp += XP_PER_KILL;
                this.game.ui.xpEarned(result.weapon, XP_PER_KILL);
            }
            if (data.type === 'pickup' && (data.kind === 'health' || data.kind === 'ammo')) this.game.ui.notice(t(`pickup.${data.kind}`, { n: Number(data.amount) }));
            if (data.type === 'shot' && vector(data.from) && vector(data.to)) {
                const from = new THREE.Vector3().fromArray(data.from);
                this.game.effects.tracer(from, new THREE.Vector3().fromArray(data.to));
                if (data.shooter !== this.game.player.id && typeof data.weapon === 'string' && WEAPONS[data.weapon]) this.game.audio.gunAt(data.weapon as WeaponId, from, this.game.player.position, this.game.player.yaw);
            }
        }
    }
    private receiveHost(peer: string, data: Record<string, unknown>) {
        const g = this.game;
        let remote = [...this.remotes.values()].find(r => r.peer === peer);
        if (data.type === 'hello' && !remote) {
            if (data.protocol !== PROTOCOL || this.remotes.size >= 7 || g.match.ended) { this.room.send({ type: 'reject' }, peer); return; }
            const id = this.nextId++, name = cleanName(data.name), primary = PRIMARY.includes(data.primary as WeaponId) ? data.primary as WeaponId : 'rifle';
            const actor = new Bot(id, name, [0x78bada, 0xe58057, 0xa88ed4, 0x87ad59][id % 4], g.scene);
            const loadout = new WeaponManager(primary);
            remote = { actor, loadout, peer, pitch: 0, aiming: false, seen: performance.now(), seq: 0, poseAt: performance.now(), budget: 80 };
            this.remotes.set(id, remote); actor.equip(loadout.current.config);
            g.spawns.respawn(actor, this.actors, g.time);
            this.room.send({ type: 'welcome', id }, peer); this.room.send(this.snapshot(remote), peer);
            g.ui.notice(t('net.playerJoined')); return;
        }
        if (!remote || data.round !== this.round) return;
        remote.seen = performance.now();
        if (data.type === 'pose') {
            if (!vector(data.position) || !vector(data.velocity) || typeof data.yaw !== 'number' || !Number.isFinite(data.yaw) || typeof data.pitch !== 'number' || !Number.isFinite(data.pitch)) return;
            const actor = remote.actor, next = new THREE.Vector3().fromArray(data.position);
            const elapsed = Math.min(.5, Math.max(.01, (remote.seen - remote.poseAt) / 1000));
            remote.poseAt = remote.seen;
            const delta = next.clone().sub(actor.position);
            const allowed = Math.hypot(delta.x, delta.z) <= 13 * elapsed + .3 && Math.abs(delta.y) <= 30 * elapsed + 1;
            const inside = Math.abs(next.x) < g.map.size && Math.abs(next.z) < g.map.size && next.y > -15 && next.y < 60;
            const clear = g.map.lineClear(actor.position.clone().add(new THREE.Vector3(0, .7, 0)), next.clone().add(new THREE.Vector3(0, .7, 0)));
            if (actor.alive && allowed && inside && clear && !g.map.blocked(next.x, next.z, .3, next.y, data.crouched ? 1.2 : 1.8)) {
                actor.position.copy(next); actor.velocity.fromArray(data.velocity).clampLength(0, 35); actor.crouched = !!data.crouched;
            } else if (actor.alive && delta.length() > 1) this.room.send({ type: 'correction', position: actor.position.toArray() }, peer);
            actor.yaw = data.yaw; actor.grounded = !!data.grounded; remote.aiming = !!data.aiming; remote.pitch = THREE.MathUtils.clamp(data.pitch, -1.48, 1.48);
        }
        if (data.type !== 'action' || !Number.isSafeInteger(data.seq) || (data.seq as number) <= remote.seq || remote.budget < 1) return;
        remote.budget--; remote.seq = data.seq as number;
        const { actor, loadout } = remote;
        if (!actor.alive || g.match.ended) return;
        if (data.action === 'switch' && Number.isInteger(data.slot)) loadout.select(data.slot as number);
        if (data.action === 'reload' && !loadout.switching) loadout.current.reload();
        if (loadout.switching) return;
        if (data.action === 'fire' && !loadout.current.config.melee && loadout.current.shoot()) { actor.protectedUntil = 0; this.fire(remote); }
        if ((data.action === 'light' || data.action === 'heavy') && loadout.current.meleeAttack(data.action)) actor.protectedUntil = 0;
    }
    update(dt: number) {
        for (const remote of this.remotes.values()) {
            const { actor, loadout } = remote;
            if (this.host) {
                remote.budget = Math.min(80, remote.budget + dt * 40); loadout.update(dt);
                const w = loadout.current;
                if (actor.alive && w.attack && !w.landed && w.attackTime >= w.config.melee![w.attack].windup) { w.landed = true; this.fire(remote, w.attack); }
            }
            const id = this.host ? loadout.current.config.id : actor.weapon.config.id;
            if (actor.gun.userData.weapon !== id) actor.equip(WEAPONS[id]);
            if (this.guest && remote.target) actor.position.lerp(remote.target, 1 - Math.exp(-22 * dt));
            actor.sync(this.game.time); actor.group.rotation.y = actor.yaw;
        }
    }
    private fire(remote: Remote, kind?: MeleeKind) {
        const g = this.game, actor = remote.actor, cfg = remote.loadout.current.config;
        const direction = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(remote.pitch, actor.yaw, 0, 'YXZ'));
        const origin = actor.position.clone().add(new THREE.Vector3(0, actor.crouched ? 1.05 : 1.65, 0));
        const attack = kind ? cfg.melee![kind] : undefined;
        const spread = (remote.aiming ? (cfg.id === 'sniper' ? .0003 : cfg.spread * .3) : cfg.spread) + (Math.hypot(actor.velocity.x, actor.velocity.z) > 1 ? cfg.movementSpread : 0) + (!actor.grounded ? cfg.jumpSpread : 0) + remote.loadout.current.heat * .0007;
        if (!kind) g.audio.gunAt(cfg.id, origin, g.player.position, g.player.yaw);
        for (let i = 0; i < (attack ? 1 : cfg.pelletCount); i++) {
            const dir = direction.clone();
            if (!attack) dir.add(new THREE.Vector3((Math.random() - .5) * spread, (Math.random() - .5) * spread, (Math.random() - .5) * spread)).normalize();
            const hit = trace(origin, dir, attack?.range ?? cfg.range, actor, this.actors, g.map);
            if (!attack && i === 0) { g.effects.tracer(origin, hit.point); this.room.send({ type: 'shot', shooter: actor.id, weapon: cfg.id, from: origin.toArray(), to: hit.point.toArray() }); }
            if (!hit.actor || hit.actor.protectedUntil > g.time) continue;
            const back = !!attack && g.isBackstab(hit.actor, direction);
            const damage = attack ? (back ? attack.backstab : attack.damage) : cfg.damage * hit.multiplier * (cfg.id === 'shotgun' ? Math.max(.12, 1 - hit.distance / 42) : 1);
            g.damage(hit.actor, damage, actor, !attack && hit.part === 'head');
            this.room.send({ type: 'hit', damage, back, melee: !!attack, point: hit.point.toArray(), head: !attack && hit.part === 'head' }, remote.peer);
        }
    }
    pickup(actor: Actor, kind: 'health' | 'ammo', amount: number) {
        const remote = this.remotes.get(actor.id);
        if (remote) this.room.send({ type: 'pickup', kind, amount }, remote.peer);
    }
    private apply(state: State) {
        const g = this.game, p = g.player;
        const fresh = state.round !== this.receivedRound;
        if (fresh) { this.receivedRound = state.round; this.seq = 0; g.start(true, state.map); }
        const local = state.actors.find(a => a.id === p.id);
        if (!local) return;
        g.time = state.time; g.match.remaining = state.remaining; g.match.ended = state.ended;
        g.match.feed = state.feed.map(e => ({ ...e, local: e.killerId === p.id || e.victimId === p.id }));
        const respawn = (!p.alive && local.alive) || fresh || local.deaths !== p.deaths;
        if (local.hp < p.hp) g.ui.damageUntil = g.time + .25;
        if (local.kills > p.kills) { g.audio.kill(); g.ui.eliminated(state.feed.find(e => e.killerId === p.id)?.victim ?? '', local.streak); }
        if (respawn) { p.position.fromArray(local.position); p.velocity.set(0, 0, 0); g.weapons.reset(); g.faceCenter(); }
        for (const key of ['hp', 'alive', 'kills', 'deaths', 'score', 'streak', 'respawnAt', 'protectedUntil'] as const) Object.assign(p, { [key]: local[key] });
        if (!p.alive) { g.input.firing = false; g.input.aiming = false; g.ui.el('killer-label').textContent = t('hud.deathKiller', { name: state.feed.find(e => e.victimId === p.id)?.killer ?? '' }); }
        if (state.ack >= this.seq || respawn) state.slots.forEach((w, i) => { const target = g.weapons.slots[i]; if (target) Object.assign(target, w); });
        for (const a of state.actors) {
            if (a.id === p.id) continue;
            let remote = this.remotes.get(a.id);
            if (!remote) {
                remote = { actor: new Bot(a.id, cleanName(a.name), a.color, g.scene), loadout: new WeaponManager(), peer: '', pitch: 0, aiming: false, seen: 0, seq: 0, poseAt: 0, budget: 0 };
                this.remotes.set(a.id, remote);
            }
            const actor = remote.actor;
            const { position, velocity, weapon, ...rest } = a;
            Object.assign(actor, rest, { name: cleanName(a.name) });
            const target = new THREE.Vector3().fromArray(position);
            if (!remote.target || fresh || actor.position.distanceTo(target) > 5) actor.position.copy(target);
            remote.target = target; actor.velocity.fromArray(velocity);
            if (actor.weapon.config.id !== weapon) actor.equip(WEAPONS[weapon]);
        }
        for (const id of this.remotes.keys()) if (!state.actors.some(a => a.id === id)) this.remove(id);
        g.pickups.apply(state.pickups, g.time); g.ui.lastUpdate = -1; g.ui.update();
    }
}
