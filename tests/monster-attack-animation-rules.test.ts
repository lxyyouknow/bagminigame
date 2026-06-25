import type { AnimationDef } from "../src/types.js";
import { getMonsterAttackHitTime, stepAnimatedMonsterAttack } from "../src/scenes/monsterAttackAnimationRules.js";

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) throw new Error(`${message}，期望 ${String(expected)}，实际 ${String(actual)}`);
}

const attackAnim: AnimationDef = {
  key: "boss_attack_down",
  assetKey: "loose_frames",
  frames: ["a", "b", "c", "d", "e", "f"],
  fps: 12,
  loop: false,
  anchorX: 0.5,
  anchorY: 0.92,
  scale: 0.7,
  hitFrame: 3,
};

assertEqual(getMonsterAttackHitTime(attackAnim), 0.25, "攻击动画命中时间应由 hitFrame/fps 决定");

const first = stepAnimatedMonsterAttack({
  contacted: true,
  attackCooldown: 0,
  attackWindupTimer: 0,
  attackDamagePending: false,
  dt: 0.1,
  attack: 100,
  attackInterval: 2,
  armor: 10,
  armorBonus: 0,
  animation: attackAnim,
});
assertEqual(first.startedAttack, true, "冷却结束且已贴脸时应启动攻击动画");
assertEqual(first.damage, 0, "攻击动画尚未到命中帧时不应立刻扣血");
assertEqual(first.attackDamagePending, true, "命中帧之前应保留待结算伤害");

const second = stepAnimatedMonsterAttack({
  ...first,
  contacted: true,
  dt: 0.15,
  attack: 100,
  attackInterval: 2,
  armor: 10,
  armorBonus: 0,
  animation: attackAnim,
});
assertEqual(second.damage, 95.5, "攻击动画到达 hitFrame 后才应按护甲结算基地伤害");
assertEqual(second.attackDamagePending, false, "命中帧结算后不应重复扣血");

console.log("monster-attack-animation-rules tests ok");
