export interface MonsterCrowdPoint {
  uid: number;
  x: number;
  y: number;
  radius: number;
}

export type MonsterLayerType = "ground" | "flying" | "boss";

export function getMonsterDepthZIndex(y: number, uid: number, layerType: MonsterLayerType = "ground"): number {
  return getLayerBase(layerType) + Math.round(y * 1000) + (uid % 1000);
}

export function separateMonsterCrowd(monsters: MonsterCrowdPoint[], screenWidth: number): void {
  const left = 42;
  const right = Math.max(left, screenWidth - 42);
  for (let pass = 0; pass < 2; pass += 1) {
    for (let i = 0; i < monsters.length; i += 1) {
      for (let j = i + 1; j < monsters.length; j += 1) {
        const a = monsters[i];
        const b = monsters[j];
        const minDistance = Math.max(24, Math.min(48, (a.radius + b.radius) * 0.78));
        const dx = b.x - a.x;
        const dy = (b.y - a.y) * 0.75;
        const distance = Math.hypot(dx, dy);
        if (distance >= minDistance) continue;
        const overlap = (minDistance - Math.max(0.01, distance)) * 0.5;
        const dirX = distance <= 0.01 ? (a.uid < b.uid ? 1 : -1) : dx / distance;
        const dirY = distance <= 0.01 ? 0.25 : dy / distance;
        a.x = clamp(a.x - dirX * overlap, left, right);
        b.x = clamp(b.x + dirX * overlap, left, right);
        a.y -= dirY * overlap * 0.22;
        b.y += dirY * overlap * 0.22;
      }
    }
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function getLayerBase(layerType: MonsterLayerType): number {
  if (layerType === "flying") return 10_000_000;
  if (layerType === "boss") return 5_000_000;
  return 0;
}
