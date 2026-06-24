import { shouldShowBagTextFeedback } from "../src/scenes/bagTextFeedbackRules.js";

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}，期望 ${String(expected)}，实际 ${String(actual)}`);
  }
}

function run(): void {
  assertEqual(shouldShowBagTextFeedback(), false, "买量视频阶段背包界面不应显示文字提示");
}

run();
console.log("bag-text-feedback-rules tests ok");
