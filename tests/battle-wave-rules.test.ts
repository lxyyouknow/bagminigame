import type { BagState, LevelDef, WaveDef } from "../src/types.js";
import { applyWaveCheckpointToBag, buildSingleWaveSpawnQueue, getWaveRewardGold } from "../src/scenes/battleWaveRules.js";

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
  maxRows: 4,
  maxCols: 4,
  initGold: 0,
  baseHp: 900,
  baseArmor: 3,
  waveGroupId: 101,
  shopPoolId: 101,
  roguePoolId: 101,
  winWave: 10,
};

const waves: WaveDef[] = [
  { waveGroupId: 101, wave: 1, time: 6, monsterId: 1, count: 2, interval: 0.5, spawn: "top", rewardGold: 5, expandCols: 1, expandRows: 0 },
  { waveGroupId: 101, wave: 1, time: 7, monsterId: 2, count: 1, interval: 0.3, spawn: "top", rewardGold: 2, expandCols: 0, expandRows: 1 },
  { waveGroupId: 101, wave: 2, time: 20, monsterId: 3, count: 1, interval: 0.4, spawn: "top", rewardGold: 9, expandCols: 0, expandRows: 0 },
];

const bag: BagState = {
  rows: 3,
  cols: 3,
  gold: 10,
  refreshFree: 0,
  candidates: [101, 111, 121],
  placed: [],
  currentWave: 1,
  baseHp: 900,
};

function run(): void {
  const queue = buildSingleWaveSpawnQueue(waves, 1);
  assertEqual(queue.length, 3, "第 1 波应展开成 3 个刷怪事件");
  assertEqual(queue[0].time, 0.2, "单波队列应从 0.2 秒开始，不能沿用整关累计时间");
  assertEqual(queue[2].monsterId, 2, "同波多个配置行应都进入队列");

  assertEqual(getWaveRewardGold(waves, 1), 7, "同一波多行奖励金币应求和");

  const result = applyWaveCheckpointToBag(bag, level, waves);
  assertEqual(result.rewardGold, 7, "波次结算应发放配置金币");
  assertEqual(result.expandedCells, 7, "3x3 扩到 4x4 应新增 7 个格子");
  assertEqual(bag.gold, 17, "波次奖励金币应进入本局背包金币");
  assertEqual(bag.rows, 4, "波次配置应能扩行");
  assertEqual(bag.cols, 4, "波次配置应能扩列");
  assertEqual(bag.currentWave, 2, "波次结算后应推进到下一波");

  const capped = applyWaveCheckpointToBag(bag, level, waves);
  assertEqual(capped.expandedCells, 0, "达到关卡最大背包尺寸后不应继续扩格");
  assertEqual(bag.currentWave, 3, "即使不能扩格也应继续推进波次");
}

run();
console.log("battle-wave-rules tests ok");
