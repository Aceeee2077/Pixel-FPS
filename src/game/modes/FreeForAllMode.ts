import type { Actor } from '../../bots/Bot';
import type { GameMode } from './GameMode';

export class FreeForAllMode implements GameMode {
    readonly id = 'ffa';
    readonly name = 'Free For All';
    readonly duration = 300;
    onElimination(killer: Actor, victim: Actor) {
        killer.kills++; killer.score++; killer.streak++;
        victim.deaths++; victim.streak = 0;
    }
    rank(actors: Actor[]) {
        return [...actors].sort((a, b) => b.score - a.score || a.deaths - b.deaths || a.id - b.id);
    }
}
