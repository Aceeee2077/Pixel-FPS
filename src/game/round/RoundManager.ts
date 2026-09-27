import type { Team } from '../modes/GameMode';
import { BombSystem, type BombSite } from './BombSystem';
import { Economy, ECONOMY_RULES } from './Economy';
import { DEFAULT_ROUND_CONFIG, type RoundConfig } from './RoundConfig';

export type RoundPhase = 'waiting' | 'freeze' | 'buy' | 'live' | 'planted' | 'end';
export type RoundReason = 'elimination' | 'time' | 'explosion' | 'defuse';

export class RoundManager {
    phase: RoundPhase = 'waiting';
    phaseLeft = 0;
    round = 0;
    winner: Team | null = null;
    reason: RoundReason | null = null;
    scores: Record<Team, number> = { attackers: 0, defenders: 0 };
    readonly bomb: BombSystem;
    readonly economy = new Economy();
    constructor(public readonly config: RoundConfig = DEFAULT_ROUND_CONFIG) { this.bomb = new BombSystem(config); }
    start(ids: number[], carrierId: number) {
        this.scores = { attackers: 0, defenders: 0 }; this.round = 0;
        this.economy.reset(ids); this.next(carrierId);
    }
    next(carrierId: number) {
        this.round++; this.phase = 'freeze'; this.phaseLeft = this.config.freezeTime;
        this.winner = null; this.reason = null; this.bomb.reset(carrierId);
    }
    get canBuy() { return this.phase === 'freeze' || this.phase === 'buy'; }
    get combatLive() { return this.phase === 'live' || this.phase === 'planted'; }
    interactPlant(actorId: number, team: Team, site: BombSite | null, dt: number) {
        if (this.phase !== 'live') return false;
        if (this.bomb.plant(actorId, team, site, dt)) { this.phase = 'planted'; this.economy.award(actorId, ECONOMY_RULES.plantReward); return true; }
        return false;
    }
    interactDefuse(actorId: number, team: Team, hasKit: boolean, dt: number, teams: ReadonlyMap<number, Team>) {
        if (this.phase !== 'planted') return false;
        if (this.bomb.defuse(actorId, team, hasKit, dt)) {
            this.economy.award(actorId, ECONOMY_RULES.defuseReward); this.end('defenders', 'defuse', teams); return true;
        }
        return false;
    }
    update(dt: number, alive: ReadonlyMap<number, boolean>, teams: ReadonlyMap<number, Team>) {
        if (!Number.isFinite(dt) || dt <= 0 || this.phase === 'waiting') return;
        if (this.phase === 'end') { this.phaseLeft -= dt; return; }
        if (this.phase === 'freeze' || this.phase === 'buy') {
            this.phaseLeft -= dt;
            if (this.phaseLeft <= 0) {
                if (this.phase === 'freeze') { this.phase = 'buy'; this.phaseLeft = this.config.buyTime; }
                else { this.phase = 'live'; this.phaseLeft = this.config.roundTime; }
            }
            return;
        }
        if (this.phase === 'planted' && this.bomb.update(dt)) { this.end('attackers', 'explosion', teams); return; }
        const attackers = [...teams].some(([id, team]) => team === 'attackers' && alive.get(id));
        const defenders = [...teams].some(([id, team]) => team === 'defenders' && alive.get(id));
        if (!defenders) { this.end('attackers', 'elimination', teams); return; }
        if (!attackers && this.phase !== 'planted') { this.end('defenders', 'elimination', teams); return; }
        if (this.phase === 'live') {
            this.phaseLeft -= dt;
            if (this.phaseLeft <= 0) this.end('defenders', 'time', teams);
        }
    }
    private end(winner: Team, reason: RoundReason, teams: ReadonlyMap<number, Team>) {
        if (this.phase === 'end') return;
        this.phase = 'end'; this.phaseLeft = this.config.endTime;
        this.winner = winner; this.reason = reason; this.scores[winner]++;
        this.economy.settle(winner, teams);
    }
}
