export interface MonsterAttackDistanceInput {
  baseContactY: number;
  attackDistance?: number;
}

export function resolveMonsterAttackContactY(input: MonsterAttackDistanceInput): number {
  return Math.round(input.baseContactY - Math.max(0, input.attackDistance ?? 0));
}
