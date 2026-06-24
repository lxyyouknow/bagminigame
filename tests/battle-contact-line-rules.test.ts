import { resolveMonsterContactY } from "../src/scenes/battleContactLineRules.js";

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) throw new Error(`${message}，期望 ${String(expected)}，实际 ${String(actual)}`);
}

assertEqual(
  resolveMonsterContactY({ screenHeight: 840, configuredY: 0, fenceForegroundY: 690, monsterContactOffsetY: 56, monsterRadius: 18 }),
  743,
  "怪物接触线应默认跟随实际栏杆前景位置，而不是使用固定屏幕坐标",
);

assertEqual(
  resolveMonsterContactY({ screenHeight: 840, configuredY: 372, fenceForegroundY: 690, monsterContactOffsetY: 56, monsterRadius: 18 }),
  369,
  "显式配置 monsterContactY 时仍应支持绝对调试坐标",
);

assertEqual(
  resolveMonsterContactY({ screenHeight: 840, configuredY: 0, fenceForegroundY: 690, monsterContactOffsetY: 56, monsterRadius: 60 }),
  735,
  "大体型怪物应比小怪更早停住，避免身体穿进栏杆/基地资源",
);

assertEqual(
  resolveMonsterContactY({ screenHeight: 840, configuredY: 0, monsterRadius: 18 }),
  602,
  "栏杆资源缺失时应使用偏下的屏幕比例兜底，不应停在半屏上方",
);

console.log("battle-contact-line-rules tests ok");
