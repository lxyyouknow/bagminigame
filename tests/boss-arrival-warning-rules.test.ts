import { getBossArrivalWarningFrame } from "../src/scenes/bossArrivalWarningRules.js";

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) throw new Error(`${message}，期望 ${String(expected)}，实际 ${String(actual)}`);
}

function assertOk(value: boolean, message: string): void {
  if (!value) throw new Error(message);
}

const start = getBossArrivalWarningFrame(0);
assertEqual(start.done, false, "Boss 入场提示开始时不应结束");
assertEqual(start.alpha, 0, "Boss 入场提示开始时应从透明淡入");
assertOk(start.scale > 1, "Boss 入场提示开场应有压迫缩放");

const hold = getBossArrivalWarningFrame(0.35);
assertEqual(hold.done, false, "Boss 入场提示主体阶段不应结束");
assertOk(hold.alpha > 0.7, "Boss 入场提示主体阶段应保持足够可见度");
assertOk(Math.abs(hold.scale - 1) < 0.08, "缩放应快速回到接近正常尺寸");

const fade = getBossArrivalWarningFrame(1.08);
assertEqual(fade.done, false, "Boss 入场提示淡出阶段不应立刻销毁");
assertOk(fade.alpha > 0 && fade.alpha < hold.alpha, "结束前应淡出");

const end = getBossArrivalWarningFrame(1.3);
assertEqual(end.done, true, "Boss 入场提示结束后应标记完成");
assertEqual(end.alpha, 0, "Boss 入场提示结束后应完全透明");

console.log("boss arrival warning rules ok");
