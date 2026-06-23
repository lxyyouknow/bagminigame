import type { BattleTuningDef, LevelDef, MonsterDef, ResolvedWaveTuning, WaveDef } from "../types.js";

export const DEFAULT_BATTLE_TUNING: BattleTuningDef = {
  id: 0,
  name: "默认难度",
  desc: "缺省战斗难度参数",
  baseHpMul: 1,
  baseArmorAdd: 0,
  expNeedBase: 12,
  expNeedPerLevel: 18,
  monsterHpMul: 1,
  monsterArmorAdd: 0,
  monsterAttackMul: 1,
  monsterSpeedMul: 1,
  monsterGoldMul: 1,
  monsterExpMul: 1,
  waveRewardGoldMul: 1,
};

export function getBaseMaxHp(level: LevelDef, tuning: BattleTuningDef = DEFAULT_BATTLE_TUNING): number {
  return roundInt(level.baseHp * positiveMul(tuning.baseHpMul));
}

export function getBaseArmor(level: LevelDef, tuning: BattleTuningDef = DEFAULT_BATTLE_TUNING): number {
  return round2(level.baseArmor + (tuning.baseArmorAdd ?? 0));
}

export function getExpNeed(levelNo: number, tuning: BattleTuningDef = DEFAULT_BATTLE_TUNING): number {
  return Math.max(1, roundInt(tuning.expNeedBase + Math.max(0, levelNo) * tuning.expNeedPerLevel));
}

export function resolveWaveTuning(tuning: BattleTuningDef = DEFAULT_BATTLE_TUNING, wave?: WaveDef): ResolvedWaveTuning {
  return {
    monsterHpMul: round2(positiveMul(tuning.monsterHpMul) * positiveMul(wave?.monsterHpMul)),
    monsterArmorAdd: round2((tuning.monsterArmorAdd ?? 0) + (wave?.monsterArmorAdd ?? 0)),
    monsterAttackMul: round2(positiveMul(tuning.monsterAttackMul) * positiveMul(wave?.monsterAttackMul)),
    monsterSpeedMul: round2(positiveMul(tuning.monsterSpeedMul) * positiveMul(wave?.monsterSpeedMul)),
    monsterGoldMul: round2(positiveMul(tuning.monsterGoldMul) * positiveMul(wave?.monsterGoldMul)),
    monsterExpMul: round2(positiveMul(tuning.monsterExpMul) * positiveMul(wave?.monsterExpMul)),
    rewardGoldMul: round2(positiveMul(tuning.waveRewardGoldMul) * positiveMul(wave?.rewardGoldMul)),
  };
}

export function createEffectiveMonster(monster: MonsterDef, tuning: ResolvedWaveTuning): MonsterDef {
  return {
    ...monster,
    hp: Math.max(1, roundInt(monster.hp * tuning.monsterHpMul)),
    armor: Math.max(0, roundInt(monster.armor + tuning.monsterArmorAdd)),
    speed: Math.max(1, round2(monster.speed * tuning.monsterSpeedMul)),
    attack: Math.max(1, round2(monster.attack * tuning.monsterAttackMul)),
    gold: Math.max(0, roundInt(monster.gold * tuning.monsterGoldMul)),
    exp: Math.max(0, roundInt(monster.exp * tuning.monsterExpMul)),
  };
}

export function getWaveRewardGoldWithTuning(waves: WaveDef[], waveNo: number, tuning: BattleTuningDef = DEFAULT_BATTLE_TUNING): number {
  return waves
    .filter((row) => row.wave === waveNo)
    .reduce((sum, row) => sum + roundInt((row.rewardGold ?? 0) * resolveWaveTuning(tuning, row).rewardGoldMul), 0);
}

function positiveMul(value: number | undefined): number {
  return value && value > 0 ? value : 1;
}

function roundInt(value: number): number {
  return Math.round(value);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
