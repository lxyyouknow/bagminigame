export interface BossArrivalWarningFrame {
  alpha: number;
  scale: number;
  offsetX: number;
  offsetY: number;
  done: boolean;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function easeOutBack(value: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(value - 1, 3) + c1 * Math.pow(value - 1, 2);
}

export function getBossArrivalWarningFrame(elapsed: number, duration = 1.22, maxAlpha = 0.78): BossArrivalWarningFrame {
  const safeDuration = Math.max(0.2, duration);
  const t = Math.max(0, elapsed);
  if (t >= safeDuration) return { alpha: 0, scale: 1, offsetX: 0, offsetY: 0, done: true };

  const fadeInDuration = 0.12;
  const fadeOutDuration = 0.26;
  let alpha = maxAlpha;
  if (t < fadeInDuration) alpha = maxAlpha * clamp01(t / fadeInDuration);
  if (t > safeDuration - fadeOutDuration) alpha = maxAlpha * clamp01((safeDuration - t) / fadeOutDuration);

  const intro = clamp01(t / 0.24);
  const scale = 1 + (1 - easeOutBack(intro)) * 0.14;
  const shakePower = t < 0.34 ? (1 - t / 0.34) * 8 : 0;
  return {
    alpha,
    scale,
    offsetX: Math.sin(t * 92) * shakePower,
    offsetY: Math.cos(t * 77) * shakePower * 0.55,
    done: false,
  };
}
