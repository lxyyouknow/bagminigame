import {
  findNearestDragTarget,
  isSameDragSource,
  shapeOriginFromPointer,
  shouldDetachPlacedOnRelease,
  shouldShowInvalidDropHint,
  shouldToastInvalidDrop,
  type Rect,
} from "../src/scenes/bagDragUi.js";

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

  const lShapeOrigin = shapeOriginFromPointer({
    pointerX: 462,
    pointerY: 381,
    gridLeft: 100,
    gridTop: 200,
    pitch: 104,
    visualCenterX: 154,
    visualCenterY: 77,
  });
  assertEqual(lShapeOrigin.x, 2, "多格形状应按拖拽图视觉中心反推左上角列");
  assertEqual(lShapeOrigin.y, 1, "多格形状应按拖拽图视觉中心反推左上角行");

  const nearest = findNearestDragTarget(300, 500, [
    { key: "far", centerX: 430, centerY: 500 },
    { key: "near", centerX: 345, centerY: 510 },
  ], 180);
  assertEqual(nearest?.target.key, "near", "合成吸附应优先选择距离手指最近的可合成目标");

  const guideOnly = findNearestDragTarget(300, 500, [
    { key: "merge", centerX: 470, centerY: 500 },
  ], 220);
  assertEqual(guideOnly?.target.key, "merge", "较远的可合成目标仍应进入连线提示范围");

  const outsideGuide = findNearestDragTarget(300, 500, [
    { key: "merge", centerX: 560, centerY: 500 },
  ], 220);
  assertEqual(outsideGuide, undefined, "超出提示半径后不应继续显示合成吸附线");

  const globalGuide = findNearestDragTarget(40, 80, [
    { key: "far", centerX: 680, centerY: 1320 },
    { key: "nearest", centerX: 500, centerY: 980 },
  ]);
  assertEqual(globalGuide?.target.key, "nearest", "拖起武器后应跨屏提示最近的可合成目标");

  assertEqual(
    isSameDragSource({ type: "candidate", index: 0 }, { type: "candidate", index: 0 }, true),
    false,
    "候选武器拖起后已从数组移除，前移后的相同索引不能再被误判为拖拽物自身",
  );
  assertEqual(
    isSameDragSource({ type: "candidate", index: 0 }, { type: "candidate", index: 0 }, false),
    true,
    "拖拽源尚未移除时仍应阻止与自身合成",
  );
}

run();
console.log("bag-drag-ui tests ok");
