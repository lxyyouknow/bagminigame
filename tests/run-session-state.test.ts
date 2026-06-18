import type { BagState, LevelDef } from "../src/types.js";
import { createRunSessionState } from "../src/scenes/runSessionState.js";

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}，期望 ${String(expected)}，实际 ${String(actual)}`);
  }
}

const level: LevelDef = {
  id: 1,
  name: "测试关",
  desc: "测试",
  theme: "green",
  initRows: 3,
  initCols: 3,
  maxRows: 5,
  maxCols: 5,
  initGold: 20,
  baseHp: 1000,
  baseArmor: 2,
  waveGroupId: 101,
  shopPoolId: 101,
  roguePoolId: 101,
  winWave: 10,
};

const bag: BagState = {
  rows: 3,
  cols: 3,
  gold: 20,
  refreshFree: 3,
  candidates: [101, 111, 121],
  placed: [],
};

function run(): void {
  const state = createRunSessionState(level, bag);
  assertEqual(state.bag, bag, "局内状态必须持有原背包对象，不能每波复制重建");
  assertEqual(state.currentWave, 1, "新局应从第 1 波开始");
  assertEqual(state.baseHp, 1000, "新局应使用关卡初始血量");
  assertEqual(state.exp, 0, "新局经验应为 0");
  assertEqual(state.levelNo, 1, "新局等级应为 1");
  assertEqual(state.buffs.attackMul, 1, "新局攻击倍率应为 1");

  state.currentWave = 3;
  state.baseHp = 725;
  state.exp = 19;
  state.levelNo = 2;
  state.kills = 14;
  state.playSeconds = 31.5;
  state.buffs.attackMul = 1.25;

  assertEqual(state.bag, bag, "更新战斗成长后仍应引用同一背包");
  assertEqual(state.currentWave, 3, "波次必须保存在整局状态中");
  assertEqual(state.baseHp, 725, "受损血量必须跨波保留");
  assertEqual(state.exp, 19, "经验必须跨波保留");
  assertEqual(state.levelNo, 2, "等级必须跨波保留");
  assertEqual(state.kills, 14, "击杀数必须整局累计");
  assertEqual(state.playSeconds, 31.5, "战斗时长必须整局累计");
  assertEqual(state.buffs.attackMul, 1.25, "肉鸽强化必须跨波保留");
}

run();
console.log("run-session-state tests ok");
