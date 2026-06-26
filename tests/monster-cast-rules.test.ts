import { shouldFreezeMonsterMovement } from "../src/scenes/monsterCastRules.js";

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) throw new Error(`${message}，期望 ${String(expected)}，实际 ${String(actual)}`);
}

assertEqual(shouldFreezeMonsterMovement(undefined), false, "没有施法计时器时怪物应正常移动");
assertEqual(shouldFreezeMonsterMovement(0), false, "施法计时结束后怪物应恢复移动");
assertEqual(shouldFreezeMonsterMovement(0.01), true, "施法计时期间怪物应原地播放动作");

console.log("monster-cast-rules tests ok");
