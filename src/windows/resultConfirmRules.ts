export function canAcceptResultConfirm(openedAtMs: number, nowMs: number, minDelayMs = 450): boolean {
  return nowMs - openedAtMs >= minDelayMs;
}
