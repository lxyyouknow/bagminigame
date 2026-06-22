import type { MonsterDef } from "../src/types.js";
import { getMonsterAnimationKey } from "../src/scenes/monsterVisualRules.js";

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) throw new Error(`${message}，期望 ${String(expected)}，实际 ${String(actual)}`);
}

const zombie = {
  id: 1,
  name: "小僵尸",
  hp: 65,
  armor: 0,
  speed: 42,
  attack: 18,
  attackInterval: 1.35,
  gold: 2,
  exp: 8,
  radius: 18,
  color: "#e5c542",
  boss: false,
  runAnimKey: "zombie_walk_down",
  attackAnimKey: "",
} satisfies MonsterDef;

assertEqual(getMonsterAnimationKey(zombie, false), "zombie_walk_down", "移动中的小僵尸应播放向下行走动画");
assertEqual(getMonsterAnimationKey(zombie, true), "zombie_walk_down", "攻击动画未配置时，贴脸后应继续保持行走动画");
assertEqual(getMonsterAnimationKey({ ...zombie, attackAnimKey: "zombie_attack_down" }, true), "zombie_attack_down", "后续配置攻击动画后应自动切换");

console.log("monster-visual-rules tests ok");
