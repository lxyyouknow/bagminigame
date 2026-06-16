import { computeBattleBottomPanelRect, computeBattleEquipListLayout, computeBattleHudLayout } from "../src/scenes/battleEquipLayout.js";

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}，期望 ${String(expected)}，实际 ${String(actual)}`);
  }
}

function run(): void {
  const oneRow = computeBattleEquipListLayout(3, 360, 52, 8);
  assertEqual(oneRow.rows, 1, "3 个武器时应保持单行");
  assertEqual(oneRow.columns, 3, "3 个武器时应为 3 列");
  assertEqual(oneRow.slots[0].width, 52, "武器槽应保持方形，不应被拉成长条");
  assertEqual(oneRow.slots[1].x, 60, "方形武器槽应按固定间距横向排列");
  assert(oneRow.slots[2].x + oneRow.slots[2].width <= 360, "单行最后一个武器不应超出面板宽度");

  const twoRows = computeBattleEquipListLayout(8, 360, 52, 8);
  assertEqual(twoRows.rows, 2, "8 个武器时应自动分成双行");
  assertEqual(twoRows.columns, 5, "8 个武器时应优先保持横向展示");
  assertEqual(twoRows.slots[5].y > twoRows.slots[0].y, true, "第 6 个武器应进入第二行");
  assert(twoRows.slots.every((slot) => slot.x + slot.width <= 360), "所有武器卡都应落在面板宽度内");

  const bottomRect = computeBattleBottomPanelRect(393, 852, 366, 96, -30);
  assertEqual(bottomRect.x, Math.round((393 - 366) / 2), "底部面板应保持水平居中");
  assert(bottomRect.y + bottomRect.height <= 852, "底部面板不应超出屏幕底边");

  const portraitHud = computeBattleHudLayout(393, 852, 338, 150, 366, 112, -18);
  assert(portraitHud.base.y + portraitHud.base.height > portraitHud.hpBar.y, "基地底座应压在血条后方形成衔接");
  assert(portraitHud.hpBar.y + portraitHud.hpBar.height <= portraitHud.equip.y, "血条不应被武器栏遮住");
  assert(portraitHud.equip.y + portraitHud.equip.height <= 852, "武器栏不应超出竖屏底边");

  const shortHud = computeBattleHudLayout(1007, 454, 338, 158, 366, 112, -18);
  assert(shortHud.base.y >= Math.round(454 * 0.34), "矮屏下基地不应顶到战场中心");
  assert(shortHud.hpBar.y + shortHud.hpBar.height <= shortHud.equip.y, "矮屏下血条仍应在武器栏上方");
}

run();
console.log("battle-equip-layout tests ok");
