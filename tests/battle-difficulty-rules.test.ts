import type { BattleTuningDef, LevelDef, MonsterDef, WaveDef } from "../src/types.js";
import {
  createEffectiveMonster,
  getBaseArmor,
  getBaseMaxHp,
  getExpNeed,
  getWaveRewardGoldWithTuning,
  resolveWaveTuning,
} from "../src/scenes/battleDifficultyRules.js";

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}，期望 ${String(expected)}，实际 ${String(actual)}`);
  }
}

const level: LevelDef = {
  id: 2,
  name: "测试关",
  desc: "测试",
  theme: "purple",
  initRows: 3,
  initCols: 3,
  maxRows: 5,
  maxCols: 5,
  initGold: 20,
  baseHp: 1000,
  baseArmor: 4,
  waveGroupId: 102,
  shopPoolId: 102,
  roguePoolId: 102,
  winWave: 8,
  battleTuningId: 2,
};

const tuning: BattleTuningDef = {
  id: 2,
  name: "测试难度",
  desc: "测试用",
  baseHpMul: 1.2,
  baseArmorAdd: 2,
  expNeedBase: 14,
  expNeedPerLevel: 24,
  monsterHpMul: 1.3,
  monsterArmorAdd: 2,
  monsterAttackMul: 1.15,
  monsterSpeedMul: 1.05,
  monsterGoldMul: 1.1,
  monsterExpMul: 1.25,
  waveRewardGoldMul: 1.2,
};

const monster: MonsterDef = {
  id: 1,
  name: "测试怪",
  hp: 100,
  armor: 3,
  speed: 80,
  attack: 20,
  attackInterval: 1.5,
  gold: 5,
  exp: 8,
  radius: 18,
  color: "#ffffff",
  boss: false,
};

const wave: WaveDef = {
  waveGroupId: 102,
  wave: 3,
  time: 0.2,
  monsterId: 1,
  count: 2,
  interval: 0.5,
  spawn: "top",
  rewardGold: 10,
  monsterHpMul: 1.5,
  monsterArmorAdd: 1,
  monsterAttackMul: 1.4,
  rewardGoldMul: 1.3,
};

function run(): void {
  assertEqual(getBaseMaxHp(level, tuning), 1200, "基地最大生命应支持难度倍率");
  assertEqual(getBaseArmor(level, tuning), 6, "基地护甲应支持难度附加值");
  assertEqual(getExpNeed(3, tuning), 86, "升级经验应走难度表曲线");

  const waveTuning = resolveWaveTuning(tuning, wave);
  assertEqual(waveTuning.monsterHpMul, 1.95, "单波血量倍率应叠乘关卡难度");
  assertEqual(waveTuning.monsterArmorAdd, 3, "单波护甲附加值应叠加关卡难度");
  assertEqual(waveTuning.monsterAttackMul, 1.61, "单波攻击倍率应叠乘关卡难度并保留两位有效小数");
  assertEqual(waveTuning.monsterSpeedMul, 1.05, "未配置单波速度倍率时应使用关卡难度");

  const effective = createEffectiveMonster(monster, waveTuning);
  assertEqual(effective.hp, 195, "怪物血量应按最终倍率缩放");
  assertEqual(effective.armor, 6, "怪物护甲应按最终附加值提升");
  assertEqual(effective.attack, 32.2, "怪物攻击应按最终倍率缩放");
  assertEqual(effective.speed, 84, "怪物速度应按最终倍率缩放");
  assertEqual(effective.gold, 6, "击杀金币应按最终倍率取整");
  assertEqual(effective.exp, 10, "击杀经验应按最终倍率取整");

  assertEqual(getWaveRewardGoldWithTuning([wave], 3, tuning), 16, "清波奖励应支持关卡和单波倍率");
}

run();
console.log("battle-difficulty-rules tests ok");
