import { shouldOpenRogueOptionsOnLevelUp } from "../src/scenes/rogueTriggerRules.js";

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}，期望 ${String(expected)}，实际 ${String(actual)}`);
  }
}

function run(): void {
  assertEqual(shouldOpenRogueOptionsOnLevelUp(), false, "买量视频阶段升级不应打开三选一");
}

run();
console.log("rogue-trigger-rules tests ok");
