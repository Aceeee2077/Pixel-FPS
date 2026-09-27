import type { Team } from '../modes/GameMode';

export const ECONOMY_RULES = {
    startingMoney: 800, maxMoney: 16000, winReward: 3250, lossReward: 1900,
    killReward: 300, plantReward: 300, defuseReward: 300,
} as const;

export class Economy {
    private balances = new Map<number, number>();
    reset(ids: number[]) { this.balances = new Map(ids.map(id => [id, ECONOMY_RULES.startingMoney])); }
    balance(id: number) { return this.balances.get(id) ?? 0; }
    award(id: number, amount: number) {
        if (!this.balances.has(id)) return;
        this.balances.set(id, Math.min(ECONOMY_RULES.maxMoney, this.balance(id) + Math.max(0, amount)));
    }
    spend(id: number, amount: number) {
        if (!Number.isFinite(amount) || amount < 0 || amount > this.balance(id)) return false;
        this.balances.set(id, this.balance(id) - amount); return true;
    }
    settle(winner: Team, teams: ReadonlyMap<number, Team>) {
        for (const [id, team] of teams) this.award(id, team === winner ? ECONOMY_RULES.winReward : ECONOMY_RULES.lossReward);
    }
}
