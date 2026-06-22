export interface MonsterSpawnPoint {
  x: number;
  y: number;
}

export function chooseMonsterSpawnPosition(
  screenWidth: number,
  existing: readonly MonsterSpawnPoint[],
  random: () => number = Math.random,
  laneCount = 6,
): MonsterSpawnPoint {
  const left = 40;
  const right = Math.max(left, screenWidth - 40);
  const count = Math.max(1, Math.floor(laneCount));
  const lanes = Array.from({ length: count }, (_, index) => (
    count === 1 ? (left + right) / 2 : left + ((right - left) * index) / (count - 1)
  ));
  const nearby = existing.filter((monster) => monster.y <= 220);
  const distances = lanes.map((x) => nearby.length === 0
    ? Number.POSITIVE_INFINITY
    : Math.min(...nearby.map((monster) => Math.abs(monster.x - x))));
  const bestDistance = Math.max(...distances);
  const bestLanes = lanes.filter((_, index) => distances[index] === bestDistance);
  const laneIndex = Math.min(bestLanes.length - 1, Math.floor(clampRandom(random()) * bestLanes.length));

  return {
    x: bestLanes[laneIndex],
    y: 126 + clampRandom(random()) * 30,
  };
}

function clampRandom(value: number): number {
  return Math.max(0, Math.min(0.999999, value));
}
