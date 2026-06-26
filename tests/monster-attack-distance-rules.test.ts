import { resolveMonsterAttackContactY } from "../src/scenes/monsterAttackDistanceRules.js";

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) throw new Error(`${message}，期望 ${String(expected)}，实际 ${String(actual)}`);
}

assertEqual(resolveMonsterAttackContactY({ baseContactY: 760 }), 760, "未配置攻击距离的小僵尸应沿用栏杆接触线");
assertEqual(resolveMonsterAttackContactY({ baseContactY: 760, attackDistance: 150 }), 610, "毒蝠放大后应在更远的位置停下释放喷射攻击");
assertEqual(resolveMonsterAttackContactY({ baseContactY: 760, attackDistance: -20 }), 760, "攻击距离不能把怪物推到栏杆里面");

console.log("monster-attack-distance-rules tests ok");
