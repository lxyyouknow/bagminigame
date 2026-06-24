import { readFileSync } from "node:fs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) throw new Error(`${message}，期望 ${expected}，实际 ${actual}`);
}

const levels = JSON.parse(readFileSync("public/gamedata/s_level.json", "utf8"));
const fields = JSON.parse(readFileSync("public/gamedata/s_battle_field.json", "utf8"));
const uiLayouts = JSON.parse(readFileSync("public/gamedata/s_ui_layout.json", "utf8"));

const fieldByKey = new Map(fields.map((row) => [row.key, row]));

for (const level of levels) {
  assert(level.battleFieldKey, `关卡 ${level.id} 必须配置 battleFieldKey`);
  assert(fieldByKey.has(level.battleFieldKey), `关卡 ${level.id} 的战场皮肤 ${level.battleFieldKey} 不存在`);
}

const farmField = fieldByKey.get("farm_fence_field");
assert(farmField, "必须提供默认农场栏杆战场皮肤");
assertEqual(farmField.monsterContactY, 0, "默认怪物攻击线不应使用固定绝对 Y，应跟随栏杆前景位置");
assertEqual(farmField.monsterContactMode, "fenceForeground", "默认应使用栏杆前景相对模式，适配不同屏幕高度");
assertEqual(farmField.monsterContactOffsetY, 56, "怪物攻击线应相对栏杆前景向下偏移到栏杆前沿");
assertEqual(farmField.fenceForegroundAssetKey, "battle_divider_line", "栏杆前景遮挡图应配置在战场皮肤表");
assertEqual(farmField.fenceCoversMonsters, true, "栏杆层级必须高于怪物，避免怪物踩在栏杆上面");
assert("monsterAttackHitFrame" in farmField, "战场皮肤应预留怪物攻击命中帧字段");
assert("monsterAttackHitTime" in farmField, "战场皮肤应预留怪物攻击命中时间字段");

assert(
  !uiLayouts.some((row) => row.scene === "battle" && row.key === "monster_contact_line"),
  "怪物攻击接触线属于战场皮肤配置，不应继续放在 s_ui_layout",
);

console.log("battle-field-config tests ok");
