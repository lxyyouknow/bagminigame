export interface MonsterSpawnPoint {
  x: number;
  y: number;
}

export function chooseMonsterSpawnPosition(
  screenWidth: number,
  existing: readonly MonsterSpawnPoint[],
  random: () => number = Math.random,
  sampleCount = 16,
): MonsterSpawnPoint {
  const margin = Math.min(72, Math.max(52, screenWidth * 0.09));
  const left = margin;
  const right = Math.max(left, screenWidth - margin);
  const nearby = existing.filter((monster) => monster.y <= 360);
  const count = Math.max(1, Math.floor(sampleCount));
  let best: MonsterSpawnPoint | undefined;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (let index = 0; index < count; index += 1) {
    const candidate = {
      x: left + clampRandom(random()) * (right - left),
      y: 108 + clampRandom(random()) * 86,
    };
    const nearest = nearby.length === 0
      ? right - left
      : Math.min(...nearby.map((monster) => Math.hypot(monster.x - candidate.x, (monster.y - candidate.y) * 0.55)));
    const sameColumnPenalty = nearby.some((monster) => Math.abs(monster.x - candidate.x) < 44 && Math.abs(monster.y - candidate.y) < 130) ? 90 : 0;
    const edgePenalty = Math.min(candidate.x - left, right - candidate.x) * 0.08;
    const score = nearest + edgePenalty - sameColumnPenalty;
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }

  return best ?? { x: (left + right) / 2, y: 126 };
}

function clampRandom(value: number): number {
  return Math.max(0, Math.min(0.999999, value));
}
