import { Actor } from '../bots/Bot';
export interface GameMode {
    id: string;
    name: string;
    duration: number;
    onElimination(killer: Actor, victim: Actor): void;
    rank(actors: Actor[]): Actor[];
}
export class FreeForAll implements GameMode {
    id = 'ffa';
    name = 'Free For All';
    duration = 300;
    onElimination(killer: Actor, victim: Actor) { killer.kills++; killer.score++; killer.streak++; victim.deaths++; victim.streak = 0; }
    rank(actors: Actor[]) { return [...actors].sort((a, b) => b.score - a.score || a.deaths - b.deaths || a.id - b.id); }
}
export interface KillEvent {
    killerId: number;
    victimId: number;
    killer: string;
    victim: string;
    weapon: string;
    local: boolean;
    time: number;
    headshot: boolean;
}
export class MatchManager {
    localId = 0;
    remaining = 300;
    ended = false;
    feed: KillEvent[] = [];
    constructor(public mode: GameMode = new FreeForAll()) { }
    reset(actors: Actor[]) { this.remaining = this.mode.duration; this.ended = false; this.feed = []; actors.forEach(a => { a.kills = 0; a.deaths = 0; a.score = 0; a.streak = 0; }); }
    update(dt: number) { if (this.ended)
        return; this.remaining = Math.max(0, this.remaining - dt); if (this.remaining === 0)
        this.ended = true; }
    kill(killer: Actor, victim: Actor, weapon: string, time: number, headshot = false) { this.mode.onElimination(killer, victim); this.feed.unshift({ killerId: killer.id, victimId: victim.id, killer: killer.name, victim: victim.name, weapon, local: killer.id === this.localId || victim.id === this.localId, time, headshot }); this.feed = this.feed.slice(0, 5); }
    get clock() { const seconds = Math.ceil(this.remaining); return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`; }
    rank(actors: Actor[]) { return this.mode.rank(actors); }
}
