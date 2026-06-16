import { resolveUiLayoutPosition, resolveUiLayoutRect, withLayoutDefaults, type UiLayoutDef } from "../src/ui/layout/UiLayout.js";

// 当前轻量测试链路没有安装 @types/node，这里只在运行时读取配置表。
// @ts-expect-error Node 内置模块类型在本项目测试脚本里未声明。
const { readFileSync } = await import("node:fs");

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}，期望 ${String(expected)}，实际 ${String(actual)}`);
  }
}

function run(): void {
  const sideButton: UiLayoutDef = {
    scene: "main",
    key: "side_minigame",
    anchor: "topRight",
    x: -76,
    y: 104,
    width: 64,
    height: 84,
    iconSize: 52,
    labelOffsetY: 28,
    fontSize: 14,
    visible: true,
    desc: "主界面右侧小游戏入口",
  };

  const resolved = resolveUiLayoutPosition(sideButton, 414, 736);
  assertEqual(resolved.x, 338, "topRight 应以屏幕右侧为基准");
  assertEqual(resolved.y, 104, "topRight 的 y 应以顶部为基准");

  const centered: UiLayoutDef = {
    scene: "main",
    key: "start_button",
    anchor: "center",
    x: 0,
    y: 226,
    width: 250,
    height: 92,
    visible: true,
    desc: "开始按钮",
  };
  const centerPos = resolveUiLayoutPosition(centered, 414, 736);
  assertEqual(centerPos.x, 207, "center 的 x 应以屏幕中心为基准");
  assertEqual(centerPos.y, 594, "center 的 y 应以屏幕中心为基准叠加偏移");

  const merged = withLayoutDefaults(undefined, {
    scene: "main",
    key: "fallback",
    anchor: "topLeft",
    x: 12,
    y: 34,
    width: 56,
    height: 78,
    visible: true,
    desc: "默认布局",
  });
  assertEqual(merged.x, 12, "缺失配置时应使用默认 x");
  assertEqual(merged.visible, true, "缺失配置时应保留默认 visible");

  const override = withLayoutDefaults({ ...merged, x: 99, visible: false }, merged);
  assertEqual(override.x, 99, "已有配置应覆盖默认 x");
  assertEqual(override.visible, false, "已有配置应覆盖默认 visible");

  assert(resolveUiLayoutPosition({ ...sideButton, anchor: "bottomRight", x: -20, y: -30 }, 414, 736).y === 706, "bottomRight 应以底部为基准");
  const rect = resolveUiLayoutRect({ ...centered, width: 250, height: 92 }, 414, 736);
  assertEqual(rect.x, 82, "居中矩形应返回左上 x");
  assertEqual(rect.y, 548, "居中矩形应返回左上 y");

  const rows = JSON.parse(readFileSync("public/gamedata/s_ui_layout.json", "utf8")) as UiLayoutDef[];
  const existing = new Set(rows.map((row) => `${row.scene}.${row.key}`));
  const required = [
    "loading.hero",
    "loading.progress_bar",
    "loading.label",
    "loading.error_text",
    "bag.title",
    "bag.gold",
    "bag.bag_size",
    "bag.board",
    "bag.hint",
    "bag.candidates",
    "bag.action_refresh",
    "bag.action_expand",
    "bag.action_start",
    "bag.toast",
    "battle.pause_button",
    "battle.title",
    "battle.wave_bar",
    "battle.stat",
    "battle.base_panel",
    "battle.equip_bar",
    "pause.title",
    "pause.panel",
    "pause.info",
    "pause.home_button",
    "pause.continue_button",
    "pause.setting_button",
    "setting.panel",
    "setting.title",
    "setting.volume_master",
    "setting.volume_music",
    "setting.volume_sfx",
    "setting.music_toggle",
    "setting.sfx_toggle",
    "setting.hint",
    "setting.close_button",
    "confirm.panel",
    "confirm.title",
    "confirm.icon",
    "confirm.content",
    "confirm.cancel_button",
    "confirm.confirm_button",
    "rogue.title",
    "rogue.cards",
    "result.hero",
    "result.title",
    "result.result_text",
    "result.panel",
    "result.reward_title",
    "result.exp_card",
    "result.coin_card",
    "result.ok_button",
  ];
  const missing = required.filter((key) => !existing.has(key));
  assertEqual(missing.join(", "), "", "s_ui_layout 应覆盖所有主要界面布局 key");
}

run();
console.log("ui-layout tests ok");
