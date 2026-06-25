import { getMonsterDepthZIndex, separateMonsterCrowd } from "../src/scenes/monsterDepthRules.js";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}，期望 ${String(expected)}，实际 ${String(actual)}`);
  }
}

function run(): void {
  assert(getMonsterDepthZIndex(360, 2) > getMonsterDepthZIndex(180, 99), "靠近屏幕下方的怪物层级应高于后排怪物");
  assertEqual(getMonsterDepthZIndex(180, 7), 180007, "同一 y 值附近应使用 uid 做稳定排序，避免层级抖动");
  assert(getMonsterDepthZIndex(120, 2, "flying") > getMonsterDepthZIndex(420, 1, "ground"), "飞行怪应始终压在地面怪上方");
  assert(getMonsterDepthZIndex(260, 3, "flying") > getMonsterDepthZIndex(180, 2, "flying"), "飞行怪之间仍应按 y 值排序");
  assertEqual(getMonsterDepthZIndex(260, 5, "boss"), getMonsterDepthZIndex(260, 5, "ground"), "Boss 应使用地面怪 y 深度排序，不应额外压在前排怪头上");
  assert(getMonsterDepthZIndex(180, 5, "boss") < getMonsterDepthZIndex(320, 1, "ground"), "后排 Boss 应被更靠下的地面怪压住");

  const monsters = [
    { uid: 1, x: 200, y: 220, radius: 24 },
    { uid: 2, x: 205, y: 222, radius: 24 },
    { uid: 3, x: 360, y: 220, radius: 24 },
  ];
  separateMonsterCrowd(monsters, 570);
  const distance = Math.hypot(monsters[0].x - monsters[1].x, monsters[0].y - monsters[1].y);
  assert(distance > 28, "贴得太近的怪物应被分散，避免完全重叠");
  assert(monsters.every((monster) => monster.x >= 42 && monster.x <= 528), "分散后怪物不能被推到屏幕外");
  assert(Math.abs(monsters[2].x - 360) < 1, "距离足够远的怪物不应被明显挪动");
}

run();
console.log("monster-depth-rules tests ok");
