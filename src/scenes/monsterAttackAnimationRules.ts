import type { AnimationDef } from "../types.js";
import { computeMonsterBaseDamage } from "./monsterContactRules.js";

export interface AnimatedMonsterAttackInput {
  contacted: boolean;
  attackCooldown: number;
  attackWindupTimer: number;
  attackDamagePending: boolean;
  dt: number;
  attack: number;
  attackInterval: number;
  attackSpeedMul?: number;
  armor: number;
  armorBonus: number;
  animation?: AnimationDef;
  fallbackHitTime?: number;
}

export interface AnimatedMonsterAttackTiming {
  attackInterval: number;
  hitTime: number;
  animationSpeedMul: number;
}

export interface AnimatedMonsterAttackResult {
  attackCooldown: number;
  attackWindupTimer: number;
  attackDamagePending: boolean;
  damage: number;
  startedAttack: boolean;
}

export function getMonsterAttackHitTime(animation: AnimationDef | undefined, fallbackHitTime = 0): number {
  if (animation?.hitFrame !== undefined) return Math.max(0, animation.hitFrame) / Math.max(1, animation.fps);
  if (fallbackHitTime > 0) return fallbackHitTime;
  const frameCount = animation?.frames.length ?? 1;
  return (frameCount * 0.5) / Math.max(1, animation?.fps ?? 10);
}

export function resolveAnimatedMonsterAttackTiming(input: {
  animation?: AnimationDef;
  fallbackHitTime?: number;
  attackInterval: number;
  attackSpeedMul?: number;
}): AnimatedMonsterAttackTiming {
  const attackSpeedMul = Math.max(0.01, input.attackSpeedMul ?? 1);
  const attackInterval = Math.max(0.1, input.attackInterval / attackSpeedMul);
  const rawHitTime = getMonsterAttackHitTime(input.animation, input.fallbackHitTime);
  const animationSpeedMul = Math.max(attackSpeedMul, rawHitTime / attackInterval);
  return {
    attackInterval,
    hitTime: rawHitTime / animationSpeedMul,
    animationSpeedMul,
  };
}

export function stepAnimatedMonsterAttack(input: AnimatedMonsterAttackInput): AnimatedMonsterAttackResult {
  let attackCooldown = Math.max(0, input.attackCooldown - input.dt);
  let attackWindupTimer = input.attackWindupTimer;
  let attackDamagePending = input.attackDamagePending;
  let startedAttack = false;
  let damage = 0;

  if (!input.contacted) {
    return { attackCooldown, attackWindupTimer: 0, attackDamagePending: false, damage: 0, startedAttack: false };
  }

  if (!attackDamagePending && attackCooldown <= 0) {
    const timing = resolveAnimatedMonsterAttackTiming(input);
    attackWindupTimer = timing.hitTime;
    attackDamagePending = true;
    attackCooldown = timing.attackInterval;
    startedAttack = true;
  }

  if (attackDamagePending) {
    attackWindupTimer = Math.max(0, attackWindupTimer - input.dt);
    if (attackWindupTimer <= 0) {
      damage = computeMonsterBaseDamage(input.attack, input.armor, input.armorBonus);
      attackDamagePending = false;
    }
  }

  return { attackCooldown, attackWindupTimer, attackDamagePending, damage, startedAttack };
}
