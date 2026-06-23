import { chooseMonsterSpawnPosition } from "../src/scenes/monsterSpawnRules.js";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const width = 570;
const spawned: Array<{ x: number; y: number }> = [];
const randomValues = [
  0.05, 0.1, 0.2, 0.3, 0.75, 0.4, 0.9, 0.6,
  0.18, 0.2, 0.38, 0.3, 0.58, 0.4, 0.78, 0.5,
  0.28, 0.6, 0.48, 0.7, 0.68, 0.8, 0.88, 0.9,
  0.08, 0.1, 0.32, 0.2, 0.62, 0.3, 0.92, 0.4,
];
let randomIndex = 0;
const deterministicRandom = () => randomValues[randomIndex++ % randomValues.length];
for (let index = 0; index < 8; index += 1) {
  const position = chooseMonsterSpawnPosition(width, spawned, deterministicRandom);
  assert(position.x >= 52 && position.x <= width - 52, `第 ${index + 1} 只怪出生横坐标应位于安全区`);
  assert(!spawned.some((monster) => Math.abs(monster.x - position.x) < 20), `第 ${index + 1} 只怪不应贴着已有怪同列出生`);
  spawned.push(position);
}
const minX = Math.min(...spawned.map((monster) => monster.x));
const maxX = Math.max(...spawned.map((monster) => monster.x));
assert(maxX - minX > width * 0.55, "连续刷怪应覆盖足够宽的横向范围，不能集中在左右两条竖线");

const crowded = chooseMonsterSpawnPosition(width, spawned, () => 0.5);
assert(crowded.x >= 52 && crowded.x <= width - 52, "高密度时出生横坐标仍应位于安全区");
assert(crowded.y >= 112 && crowded.y <= 174, "出生纵坐标应位于顶部出生带并带随机抖动");

const withFarMonster = chooseMonsterSpawnPosition(width, [{ x: 40, y: 400 }], () => 0);
assert(withFarMonster.x >= 52 && withFarMonster.x <= width - 52, "已离开出生带的怪物不应继续占用出生槽位");

console.log("monster-spawn-rules tests ok");
