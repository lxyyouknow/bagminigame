import { shouldOpenPauseWindowForLifecycle } from "../src/scenes/battleLifecycleRules.js";

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) throw new Error(`${message}，期望 ${String(expected)}，实际 ${String(actual)}`);
}

assertEqual(shouldOpenPauseWindowForLifecycle("blur"), false, "手机浏览器 blur 不应直接弹暂停窗，避免地址栏/系统 UI 造成误触");
assertEqual(shouldOpenPauseWindowForLifecycle("focus"), false, "focus 不是暂停入口");
assertEqual(shouldOpenPauseWindowForLifecycle("visibilitychange"), true, "真正切后台时应弹暂停窗");
assertEqual(shouldOpenPauseWindowForLifecycle("pagehide"), true, "页面隐藏时应弹暂停窗");
assertEqual(shouldOpenPauseWindowForLifecycle("manual"), true, "手动暂停应弹暂停窗");

console.log("battle-lifecycle-rules tests ok");
