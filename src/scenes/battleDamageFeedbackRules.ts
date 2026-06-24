export interface DamageNumberFeedback {
  label: string;
  fill: number;
  fontSize: number;
  ttl: number;
  vy: number;
  popScale: number;
  layer: "damageText";
}

export function getDamageNumberFeedback(damage: number, killed: boolean): DamageNumberFeedback {
  const rounded = Math.max(1, Math.round(damage));
  return {
    label: `-${rounded}`,
    fill: killed ? 0xfff06a : 0xffffff,
    fontSize: killed ? 32 : 24,
    ttl: killed ? 0.92 : 0.78,
    vy: killed ? -46 : -38,
    popScale: killed ? 1.34 : 1.16,
    layer: "damageText",
  };
}
