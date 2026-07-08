export function canAcceptResultConfirm(openedAtMs: number, nowMs: number, minDelayMs = 1000): boolean {
  return nowMs - openedAtMs >= minDelayMs;
}
