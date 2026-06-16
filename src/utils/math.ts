export function color(hex: string): number {
  return Number.parseInt(hex.replace("#", ""), 16);
}

export function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Math.round(value * 100) / 100));
}

export function weightedPick<T extends { weight: number }>(items: T[]): T {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let roll = Math.random() * total;
  for (const item of items) {
    roll -= item.weight;
    if (roll <= 0) {
      return item;
    }
  }
  return items[items.length - 1];
}
