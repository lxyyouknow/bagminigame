import { computeBattleBottomPanelRect, computeBattleEquipListLayout, computeBattleHudLayout } from "../src/scenes/battleEquipLayout.js";

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}, expected ${String(expected)}, actual ${String(actual)}`);
  }
}

function run(): void {
  const oneRow = computeBattleEquipListLayout(3, 360, 52, 8);
  assertEqual(oneRow.rows, 1, "3 weapons should stay on one row");
  assertEqual(oneRow.columns, 3, "3 weapons should use 3 columns");
  assertEqual(oneRow.slots[0].width, 52, "weapon slots should stay square");
  assertEqual(oneRow.slots[1].x, 60, "weapon slots should use the configured horizontal gap");
  assert(oneRow.slots[2].x + oneRow.slots[2].width <= 360, "last slot in one row should stay inside the panel");

  const twoRows = computeBattleEquipListLayout(8, 360, 52, 8);
  assertEqual(twoRows.rows, 2, "8 weapons should wrap to two rows");
  assertEqual(twoRows.columns, 6, "8 weapons should fill up to 6 columns first");
  assertEqual(twoRows.slots[6].y > twoRows.slots[0].y, true, "the 7th weapon should enter the second row");
  assert(twoRows.slots.every((slot) => slot.x + slot.width <= 360), "all weapon slots should stay inside the panel width");

  const bottomRect = computeBattleBottomPanelRect(393, 852, 366, 96, -30);
  assertEqual(bottomRect.x, Math.round((393 - 366) / 2), "bottom panel should stay horizontally centered");
  assert(bottomRect.y + bottomRect.height <= 852, "bottom panel should not overflow the screen bottom");

  const portraitHud = computeBattleHudLayout(393, 852, 338, 150, 366, 112, -18);
  assert(portraitHud.base.y + portraitHud.base.height > portraitHud.hpBar.y, "base rect should overlap behind the hp bar");
  assertEqual(portraitHud.hpBar.width, 369, "hp bar should fill the narrow screen with padding");
  assertEqual(portraitHud.hpBar.height, 20, "hp bar should use the requested 20px height");
  assert(portraitHud.hpBar.y + portraitHud.hpBar.height <= portraitHud.equip.y, "hp bar should not be hidden by the weapon bar");
  assert(portraitHud.equip.y + portraitHud.equip.height <= 852, "weapon bar should not overflow the portrait screen bottom");

  const shortHud = computeBattleHudLayout(1007, 454, 338, 158, 366, 112, -18);
  assert(shortHud.base.y >= Math.round(454 * 0.34), "base should not be pushed into the battle center on short screens");
  assertEqual(shortHud.hpBar.width, 720, "hp bar should cap at the requested 720px width");
  assert(shortHud.hpBar.y + shortHud.hpBar.height <= shortHud.equip.y, "hp bar should stay above the weapon bar on short screens");
}

run();
console.log("battle-equip-layout tests ok");
