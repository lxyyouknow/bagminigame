import type { MonsterDef } from "../types.js";

export function getMonsterAnimationKey(monster: MonsterDef, contacted: boolean): string | undefined {
  if (contacted && monster.attackAnimKey) return monster.attackAnimKey;
  return monster.runAnimKey || undefined;
}

export function getMonsterDeathAnimationKey(monster: MonsterDef): string | undefined {
  return monster.deathAnimKey || undefined;
}

export function shouldKeepPendingAttackAnimation(
  attackDamagePending: boolean,
  currentAnimationKey: string | undefined,
  attackAnimationKey: string | undefined,
  nextAnimationKey: string | undefined,
): boolean {
  if (!attackDamagePending || !attackAnimationKey) return false;
  if (currentAnimationKey !== attackAnimationKey) return false;
  return nextAnimationKey !== attackAnimationKey;
}
