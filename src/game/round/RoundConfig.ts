export interface RoundConfig {
    freezeTime: number;
    buyTime: number;
    roundTime: number;
    bombTime: number;
    plantTime: number;
    defuseTime: number;
    kitDefuseTime: number;
    endTime: number;
}

export const DEFAULT_ROUND_CONFIG: RoundConfig = {
    freezeTime: 6,
    buyTime: 12,
    roundTime: 115,
    bombTime: 40,
    plantTime: 3.2,
    defuseTime: 10,
    kitDefuseTime: 5,
    endTime: 5,
};
