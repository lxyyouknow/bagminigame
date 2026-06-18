import type { BagState, CombatBuffs, LevelDef } from "../types.js";

export interface RunSessionState {
  bag: BagState;
  currentWave: number;
  baseHp: number;
  exp: number;
  levelNo: number;
  kills: number;
  playSeconds: number;
  buffs: CombatBuffs;
}

export function createRunSessionState(level: LevelDef, bag: BagState): RunSessionState {
  return {
    bag,
    currentWave: bag.currentWave ?? 1,
    baseHp: bag.baseHp ?? level.baseHp,
    exp: 0,
    levelNo: 1,
    kills: 0,
    playSeconds: 0,
    buffs: createInitialBuffs(),
  };
}

function createInitialBuffs(): CombatBuffs {
  return {
    attackMul: 1,
    cdMul: 1,
    radiusMul: 1,
    dotMul: 1,
    armorBonus: 0,
    qualityAttack: {},
  };
}
