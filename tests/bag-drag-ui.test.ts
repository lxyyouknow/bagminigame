import { shouldDetachPlacedOnRelease, shouldShowInvalidDropHint, shouldToastInvalidDrop, type Rect } from "../src/scenes/bagDragUi.js";

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}，期望 ${String(expected)}，实际 ${String(actual)}`);
  }
}

function run(): void {
  const gridRect: Rect = { x: 100, y: 100, width: 200, height: 200 };
  const candidateRects: Rect[] = [
    { x: 20, y: 420, width: 74, height: 74 },
    { x: 110, y: 420, width: 74, height: 74 },
    { x: 200, y: 420, width: 74, height: 74 },
  ];

  assertEqual(
    shouldShowInvalidDropHint(40, 300, gridRect, candidateRects),
    false,
    "指针不在背包和候选区时不应显示红色不可放置提示",
  );

  assertEqual(
    shouldShowInvalidDropHint(130, 130, gridRect, candidateRects),
    true,
    "指针在背包区域内时应显示不可放置提示",
  );

  assertEqual(
    shouldShowInvalidDropHint(130, 440, gridRect, candidateRects),
    false,
    "指针在备战区物品上但不能合成时不应显示红色不可放置提示",
  );

  assertEqual(
    shouldToastInvalidDrop(40, 300, gridRect, candidateRects),
    false,
    "在背包外空白区域释放时不应弹出放不下提示",
  );

  assertEqual(
    shouldToastInvalidDrop(130, 130, gridRect, candidateRects),
    true,
    "在背包区域内释放且不可放置时应弹出提示",
  );

  assertEqual(
    shouldToastInvalidDrop(130, 440, gridRect, candidateRects),
    false,
    "在备战区物品上释放且不能合成时不应弹出放不下提示",
  );

  assertEqual(
    shouldDetachPlacedOnRelease(130, 130, gridRect),
    false,
    "从背包拖起的物品释放点仍在背包区域内时不应卸下",
  );

  assertEqual(
    shouldDetachPlacedOnRelease(130, 440, gridRect),
    true,
    "从背包拖起的物品只要释放点离开背包区域就应卸下",
  );
}

run();
console.log("bag-drag-ui tests ok");
