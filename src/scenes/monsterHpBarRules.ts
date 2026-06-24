export function getMonsterHpFillWidth(hp: number, maxHp: number, totalWidth: number): number {
  if (maxHp <= 0 || totalWidth <= 0) return 0;
  const ratio = Math.max(0, Math.min(1, hp / maxHp));
  return Math.round(totalWidth * ratio);
}
