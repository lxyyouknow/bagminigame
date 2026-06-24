import { getDamageNumberFeedback } from "../src/scenes/battleDamageFeedbackRules.js";

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) throw new Error(`${message}，期望 ${String(expected)}，实际 ${String(actual)}`);
}

const normal = getDamageNumberFeedback(28, false);
assertEqual(normal.label, "-28", "普通受击伤害数字应明确带负号");
assertEqual(normal.fontSize, 24, "普通受击伤害数字要比旧版更醒目");
assertEqual(normal.layer, "damageText", "伤害数字必须进入独立高层级，避免被爆炸遮挡");

const killed = getDamageNumberFeedback(116, true);
assertEqual(killed.label, "-116", "击杀伤害也必须飘伤害数字");
assertEqual(killed.fontSize, 32, "击杀伤害数字应更大");
assertEqual(killed.fill, 0xfff06a, "击杀伤害数字应使用高亮颜色");
assertEqual(killed.ttl, 0.92, "击杀伤害数字保留时间应更长，避免死亡特效中看不清");

console.log("battle-damage-feedback-rules tests ok");
