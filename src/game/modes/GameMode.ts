import type { Actor } from '../../bots/Bot';

export type Team = 'attackers' | 'defenders';
export type ModeId = 'ffa' | 'defuse';

export interface GameMode {
    id: ModeId;
    name: string;
    duration: number;
    onElimination(killer: Actor, victim: Actor): void;
    rank(actors: Actor[]): Actor[];
}
