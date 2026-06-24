import type { MonsterDef } from "../types.js";

export function getMonsterAnimationKey(monster: MonsterDef, contacted: boolean): string | undefined {
  if (contacted && monster.attackAnimKey) return monster.attackAnimKey;
  return monster.runAnimKey || undefined;
}

export function getMonsterDeathAnimationKey(monster: MonsterDef): string | undefined {
  return monster.deathAnimKey || undefined;
}
