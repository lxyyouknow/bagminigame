import type { AnimationDef } from "../src/types.js";
import { getAnimationEventFrameIndex, getAnimationEventFrameTime, getMonsterAttackHitTime, resolveAnimatedMonsterAttackTiming, stepAnimatedMonsterAttack } from "../src/scenes/monsterAttackAnimationRules.js";

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
assertEqual(getAnimationEventFrameIndex(15, 19), 14, "美术配置第 15 帧应转换为动画当前帧索引 14");
assertEqual(getAnimationEventFrameTime(15, 12), 14 / 12, "美术配置的第 15 帧应按 1 起始帧数换算为第 14 个索引时间");

const bossAttackAnim: AnimationDef = {
  ...attackAnim,
  frames: Array.from({ length: 19 }, (_, index) => `boss_attack_down_${String(index).padStart(2, "0")}`),
  fps: 12,
  hitFrame: 18,
  damageFrame: 15,
  shakeFrame: 15,
};
assertEqual(getMonsterAttackHitTime(bossAttackAnim), 14 / 12, "damageFrame 应优先于旧 hitFrame，用于对齐 Boss 实际扣血帧");
assertEqual(
  resolveAnimatedMonsterAttackTiming({ animation: attackAnim, attackInterval: 0.2 }).animationSpeedMul,
  1.25,
  "攻击间隔短于命中帧时，应自动提速动画让命中帧对齐攻速表",
);
assertEqual(
  resolveAnimatedMonsterAttackTiming({ animation: attackAnim, attackInterval: 2, attackSpeedMul: 2 }).animationSpeedMul,
  2,
  "攻速倍率提升时，攻击动画播放速度也应同步提升",
);

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
assertEqual(first.attackCooldown, 2, "未提升攻速时，攻击 CD 应使用怪物表里的攻击间隔");

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

const boosted = stepAnimatedMonsterAttack({
  contacted: true,
  attackCooldown: 0,
  attackWindupTimer: 0,
  attackDamagePending: false,
  dt: 0.1,
  attack: 100,
  attackInterval: 2,
  attackSpeedMul: 2,
  armor: 10,
  armorBonus: 0,
  animation: attackAnim,
});
assertEqual(boosted.attackCooldown, 1, "攻速倍率提升时，攻击 CD 应按倍率缩短");

const frameDriven = stepAnimatedMonsterAttack({
  contacted: true,
  attackCooldown: 0,
  attackWindupTimer: 0,
  attackDamagePending: false,
  dt: 0.5,
  attack: 100,
  attackInterval: 2,
  armor: 10,
  armorBonus: 0,
  animation: bossAttackAnim,
  useFrameEvent: true,
});
assertEqual(frameDriven.startedAttack, true, "帧事件模式下仍应正常启动攻击");
assertEqual(frameDriven.damage, 0, "帧事件模式下不应通过倒计时提前扣血");
assertEqual(frameDriven.frameEventDamage, 95.5, "帧事件模式下应把待扣伤害交给动画帧回调");

console.log("monster-attack-animation-rules tests ok");
