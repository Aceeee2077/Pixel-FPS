import type { Actor } from '../../bots/Bot';
import type { GameMode, Team } from './GameMode';

export class DefuseMode implements GameMode {
    readonly id = 'defuse';
    readonly name = 'Defuse';
    readonly duration = Infinity;
    readonly teams = new Map<number, Team>();
    assign(actors: Actor[], localTeam: Team = 'attackers') {
        this.teams.clear();
        actors.slice(0, 10).forEach((actor, index) => this.teams.set(actor.id, index < 5 ? localTeam : localTeam === 'attackers' ? 'defenders' : 'attackers'));
    }
    team(actor: Actor | number): Team | undefined { return this.teams.get(typeof actor === 'number' ? actor : actor.id); }
    enemies(a: Actor, b: Actor) { return this.team(a) !== undefined && this.team(a) !== this.team(b); }
    onElimination(killer: Actor, victim: Actor) {
        if (this.enemies(killer, victim)) { killer.kills++; killer.score++; killer.streak++; }
        victim.deaths++; victim.streak = 0;
    }
    rank(actors: Actor[]) {
        return [...actors].sort((a, b) => b.score - a.score || a.deaths - b.deaths || a.id - b.id);
    }
}

