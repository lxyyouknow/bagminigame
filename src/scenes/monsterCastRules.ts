export function shouldFreezeMonsterMovement(castTimer: number | undefined): boolean {
  return (castTimer ?? 0) > 0;
}
