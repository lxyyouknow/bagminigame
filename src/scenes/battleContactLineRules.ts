export interface MonsterContactLineInput {
  screenHeight: number;
  configuredY?: number;
  fenceForegroundY?: number;
  monsterContactOffsetY?: number;
  monsterRadius: number;
}

export function resolveMonsterContactY(input: MonsterContactLineInput): number {
  const baseY =
    input.configuredY && input.configuredY > 0
      ? input.configuredY
      : input.fenceForegroundY !== undefined
        ? input.fenceForegroundY + (input.monsterContactOffsetY ?? 56)
        : Math.round(input.screenHeight * 0.72);
  const radiusOffset = Math.round(Math.max(0, input.monsterRadius) * 0.18);
  return Math.round(baseY - radiusOffset);
}
