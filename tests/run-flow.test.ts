import {
  beginBagTransition,
  beginBattleTransition,
  createRunFlow,
  finishRun,
  getRunViewOffsets,
  stepRunFlow,
} from "../src/scenes/runFlowRules.js";

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}，期望 ${String(expected)}，实际 ${String(actual)}`);
  }
}

function assertNear(actual: number, expected: number, message: string): void {
  if (Math.abs(actual - expected) > 0.001) {
    throw new Error(`${message}，期望 ${expected}，实际 ${actual}`);
  }
}

function run(): void {
  const flow = createRunFlow(0.4, 0.6, 0.2);
  assertEqual(flow.phase, "preparing", "整局创建后应停在背包备战态");

  assertEqual(beginBattleTransition(flow), true, "备战态应允许开始战斗转场");
  assertEqual(beginBattleTransition(flow), false, "转场过程中必须拒绝重复开战");
  assertEqual(flow.phase, "toBattle", "开战后应进入向战场转场态");

  stepRunFlow(flow, 0.4);
  const battleSplit = getRunViewOffsets(flow, 1440);
  assertNear(battleSplit.bagY, 864, "开战转场中间镜头应露出下方 40% 背包");
  assertNear(battleSplit.battleY, -576, "开战转场中间镜头应露出上方 60% 战场");

  assertEqual(stepRunFlow(flow, 0.1), false, "开战转场中间镜头停顿期间不能立刻完成");
  const heldSplit = getRunViewOffsets(flow, 1440);
  assertNear(heldSplit.bagY, 864, "开战转场停顿期间背包位置应保持 40% 可见");
  assertNear(heldSplit.battleY, -576, "开战转场停顿期间战场位置应保持 60% 可见");

  assertEqual(stepRunFlow(flow, 0.11), true, "移动和中间镜头停顿结束后应报告完成");
  assertEqual(flow.phase, "fighting", "开战转场结束后才进入战斗态");
  const battleReady = getRunViewOffsets(flow, 1440);
  assertNear(battleReady.bagY, 1440, "战斗态背包应位于屏幕下方");
  assertNear(battleReady.battleY, 0, "战斗态战场应位于屏幕内");

  assertEqual(beginBagTransition(flow), true, "战斗态应允许清波返回背包");
  assertEqual(beginBagTransition(flow), false, "返回转场中必须拒绝重复请求");
  assertEqual(stepRunFlow(flow, 0.4), true, "返回背包转场应按配置时长完成");
  assertEqual(flow.phase, "preparing", "返回转场结束后应恢复备战态");
  const bagReady = getRunViewOffsets(flow, 1440);
  assertNear(bagReady.bagY, 0, "备战态背包应位于屏幕内");
  assertNear(bagReady.battleY, -1440, "备战态战场应位于屏幕上方");

  finishRun(flow);
  assertEqual(flow.phase, "ended", "结算后整局应进入结束态");
  assertEqual(beginBattleTransition(flow), false, "结束态不能再次开始战斗");
}

run();
console.log("run-flow tests ok");
