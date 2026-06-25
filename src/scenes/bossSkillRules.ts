import type { BossSkillDef } from "../types.js";

export interface BossRoarStateInput {
  skill?: BossSkillDef;
  cooldown: number;
  dt: number;
  bossWasHit: boolean;
  spawnAge?: number;
  targetCount?: number;
}

export interface BossRoarStateResult {
  cooldown: number;
  shouldCast: boolean;
}

export function stepBossRoarCooldown(input: BossRoarStateInput): BossRoarStateResult {
  if (!input.skill) {
    return { cooldown: input.cooldown, shouldCast: false };
  }
  const cooldown = Math.max(0, input.cooldown - input.dt);
  const triggerReady =
    input.skill.trigger === "onHit"
      ? input.bossWasHit
      : (input.spawnAge ?? 0) >= Math.max(0, input.skill.delay ?? 0);
  if (!triggerReady || cooldown > 0 || (input.targetCount ?? 1) <= 0) {
    return { cooldown, shouldCast: false };
  }
  return { cooldown: Math.max(0.1, input.skill.cd), shouldCast: true };
}

export function applyBossRoarBuff(
  baseSpeedMul: number,
  baseAttackMul: number,
  baseAttackSpeedMul: number,
  skill: BossSkillDef,
): { speedMul: number; attackMul: number; attackSpeedMul: number } {
  return {
    speedMul: baseSpeedMul * Math.max(0.01, skill.speedMul),
    attackMul: baseAttackMul * Math.max(0.01, skill.attackMul),
    attackSpeedMul: baseAttackSpeedMul * Math.max(0.01, skill.attackSpeedMul ?? 1),
  };
}
