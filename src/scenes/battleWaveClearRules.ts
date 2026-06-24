export interface WaveClearMonsterState {
  dead: boolean;
  deathVisualDone?: boolean;
}

export function isWaveCombatSettled(spawnQueueCount: number, monsters: WaveClearMonsterState[]): boolean {
  if (spawnQueueCount > 0) return false;
  return monsters.every((monster) => monster.dead && monster.deathVisualDone !== false);
}
