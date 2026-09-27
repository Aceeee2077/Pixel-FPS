import type { Team } from '../modes/GameMode';
import type { RoundConfig } from './RoundConfig';

export type BombSite = 'A' | 'B';
export type BombState = 'carried' | 'planting' | 'planted' | 'defusing' | 'defused' | 'exploded';

export class BombSystem {
    state: BombState = 'carried';
    carrierId: number | null = null;
    site: BombSite | null = null;
    planterId: number | null = null;
    defuserId: number | null = null;
    progress = 0;
    remaining = 0;
    constructor(private readonly config: RoundConfig) { }
    reset(carrierId: number) {
        this.state = 'carried'; this.carrierId = carrierId; this.site = null;
        this.planterId = null; this.defuserId = null; this.progress = 0; this.remaining = 0;
    }
    cancel() {
        if (this.state === 'planting') { this.state = 'carried'; this.planterId = null; this.site = null; this.progress = 0; }
        if (this.state === 'defusing') { this.state = 'planted'; this.defuserId = null; this.progress = 0; }
    }
    plant(actorId: number, team: Team, site: BombSite | null, dt: number) {
        if (team !== 'attackers' || !site || this.carrierId !== actorId || !['carried', 'planting'].includes(this.state)) return false;
        if (this.state === 'planting' && (this.planterId !== actorId || this.site !== site)) this.cancel();
        this.state = 'planting'; this.planterId = actorId; this.site = site;
        this.progress += Math.max(0, dt);
        if (this.progress < this.config.plantTime) return false;
        this.state = 'planted'; this.carrierId = null; this.planterId = null; this.progress = 0; this.remaining = this.config.bombTime;
        return true;
    }
    defuse(actorId: number, team: Team, hasKit: boolean, dt: number) {
        if (team !== 'defenders' || !['planted', 'defusing'].includes(this.state)) return false;
        if (this.state === 'defusing' && this.defuserId !== actorId) this.cancel();
        this.state = 'defusing'; this.defuserId = actorId;
        this.progress += Math.max(0, dt);
        if (this.progress < (hasKit ? this.config.kitDefuseTime : this.config.defuseTime)) return false;
        this.state = 'defused'; this.remaining = 0; return true;
    }
    update(dt: number) {
        if (this.state !== 'planted' && this.state !== 'defusing') return false;
        this.remaining = Math.max(0, this.remaining - Math.max(0, dt));
        if (this.remaining > 0) return false;
        this.state = 'exploded'; this.progress = 0; return true;
    }
}

