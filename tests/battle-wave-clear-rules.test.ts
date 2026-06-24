import { isWaveCombatSettled } from "../src/scenes/battleWaveClearRules.js";

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) throw new Error(`${message}，期望 ${String(expected)}，实际 ${String(actual)}`);
}

assertEqual(
  isWaveCombatSettled(1, [{ dead: true, deathVisualDone: true }]),
  false,
  "还有待刷怪物时不能清波",
);

assertEqual(
  isWaveCombatSettled(0, [{ dead: false, deathVisualDone: false }]),
  false,
  "还有存活怪物时不能清波",
);

assertEqual(
  isWaveCombatSettled(0, [{ dead: true, deathVisualDone: false }]),
  false,
  "怪物刚死亡但死亡动画未播放完成时不能清波",
);

assertEqual(
  isWaveCombatSettled(0, [{ dead: true, deathVisualDone: true }]),
  true,
  "最后一只怪物死亡动画释放完成后才允许清波",
);

assertEqual(
  isWaveCombatSettled(0, [{ dead: true }]),
  true,
  "没有死亡动画的旧怪物保持立即清波回退",
);

console.log("battle-wave-clear-rules tests ok");
