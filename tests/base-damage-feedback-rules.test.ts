import { getBaseDamageFeedback, getBaseShakeFeedback } from "../src/scenes/baseDamageFeedbackRules.js";

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) throw new Error(`${message}，期望 ${String(expected)}，实际 ${String(actual)}`);
}

const damage = getBaseDamageFeedback(18.2);
assertEqual(damage.label, "-18", "我方基地受伤也应显示扣血数字");
assertEqual(damage.fontSize, 28, "基地扣血数字应比普通怪物受击更醒目");
assertEqual(damage.fill, 0xff6b78, "基地扣血数字应使用红色系");

assertEqual(getBaseShakeFeedback(false), undefined, "普通怪物攻击基地不触发强震");
const bossShake = getBaseShakeFeedback(true);
assertEqual(bossShake?.duration, 0.34, "Boss 攻击基地应触发明显震颤时间");
assertEqual(bossShake?.amplitude, 7, "Boss 攻击基地应使用较克制的局部震颤幅度");
assertEqual(bossShake?.mode, "local", "Boss 攻击基地应使用局部震颤，避免整屏平移露出黑底");

console.log("base-damage-feedback-rules tests ok");
