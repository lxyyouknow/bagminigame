import { chooseMonsterSpawnPosition } from "../src/scenes/monsterSpawnRules.js";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const width = 570;
const spawned: Array<{ x: number; y: number }> = [];
for (let index = 0; index < 6; index += 1) {
  const position = chooseMonsterSpawnPosition(width, spawned, () => 0.5);
  assert(!spawned.some((monster) => monster.x === position.x), `低密度第 ${index + 1} 只怪不应复用已占槽位`);
  spawned.push(position);
}

const crowded = chooseMonsterSpawnPosition(width, spawned, () => 0.5);
assert(crowded.x >= 40 && crowded.x <= width - 40, "高密度时出生横坐标仍应位于安全区");
assert(crowded.y >= 126 && crowded.y <= 156, "出生纵坐标应位于顶部出生带");

const withFarMonster = chooseMonsterSpawnPosition(width, [{ x: 40, y: 400 }], () => 0);
assert(withFarMonster.x === 40, "已离开出生带的怪物不应继续占用出生槽位");

console.log("monster-spawn-rules tests ok");
