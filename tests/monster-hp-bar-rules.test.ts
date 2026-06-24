import { getMonsterHpFillWidth } from "../src/scenes/monsterHpBarRules.js";

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}，期望 ${String(expected)}，实际 ${String(actual)}`);
  }
}

function run(): void {
  assertEqual(getMonsterHpFillWidth(100, 100, 90), 90, "满血时 Boss 血条应满");
  assertEqual(getMonsterHpFillWidth(45, 100, 90), 41, "受伤后 Boss 血条应按当前血量缩短");
  assertEqual(getMonsterHpFillWidth(0, 100, 90), 0, "死亡后 Boss 血条应清空");
  assertEqual(getMonsterHpFillWidth(-10, 100, 90), 0, "负血量时 Boss 血条不能小于 0");
  assertEqual(getMonsterHpFillWidth(120, 100, 90), 90, "溢出治疗时 Boss 血条不能超过最大宽度");
}

run();
console.log("monster-hp-bar-rules tests ok");
