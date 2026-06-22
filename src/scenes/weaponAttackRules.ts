export interface AttackTargetCandidate {
  uid: number;
  y: number;
}

export function chooseBalancedTarget<T extends AttackTargetCandidate>(
  targets: readonly T[],
  targetRule: string,
  incomingByUid: ReadonlyMap<number, number>,
  countNear: (target: T) => number,
): T | undefined {
  if (targets.length === 0) return undefined;
  const leastIncoming = Math.min(...targets.map((target) => incomingByUid.get(target.uid) ?? 0));
  const available = targets.filter((target) => (incomingByUid.get(target.uid) ?? 0) === leastIncoming);
  return [...available].sort((a, b) => {
    if (targetRule === "cluster") {
      const clusterDiff = countNear(b) - countNear(a);
      if (clusterDiff !== 0) return clusterDiff;
    }
    const yDiff = b.y - a.y;
    return yDiff !== 0 ? yDiff : a.uid - b.uid;
  })[0];
}

export function getInitialWeaponCooldown(
  skillCooldown: number,
  cooldownMultiplier: number,
  weaponUid: number,
  staggerSeconds: number,
): number {
  const fullCooldown = skillCooldown * cooldownMultiplier;
  const stagger = (Math.abs(weaponUid) % 5) * Math.max(0, staggerSeconds);
  return Math.round(Math.max(0.25, fullCooldown + stagger) * 1000) / 1000;
}
