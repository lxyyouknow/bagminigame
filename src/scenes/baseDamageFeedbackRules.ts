export interface BaseDamageFeedback {
  label: string;
  fill: number;
  fontSize: number;
  ttl: number;
  vy: number;
  popScale: number;
}

export interface BaseShakeFeedback {
  duration: number;
  amplitude: number;
  mode: "local";
}

export function getBaseDamageFeedback(damage: number): BaseDamageFeedback {
  return {
    label: `-${Math.max(1, Math.round(damage))}`,
    fill: 0xff6b78,
    fontSize: 28,
    ttl: 0.86,
    vy: -42,
    popScale: 1.24,
  };
}

export function getBaseShakeFeedback(isBoss: boolean): BaseShakeFeedback | undefined {
  if (!isBoss) return undefined;
  return { duration: 0.34, amplitude: 7, mode: "local" };
}
