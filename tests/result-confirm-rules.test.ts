import { canAcceptResultConfirm } from "../src/windows/resultConfirmRules.js";

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) throw new Error(`${message}，期望 ${String(expected)}，实际 ${String(actual)}`);
}

assertEqual(canAcceptResultConfirm(1000, 1200), false, "结算刚弹出时应忽略残留触摸，避免手机端直接回主界面");
assertEqual(canAcceptResultConfirm(1000, 1450), true, "结算弹出保护时间结束后应允许正常点击确定");
assertEqual(canAcceptResultConfirm(1000, 1300, 300), true, "保护时间应支持按窗口类型调整");

console.log("result-confirm-rules tests ok");
