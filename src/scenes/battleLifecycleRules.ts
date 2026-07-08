import type { LifecycleReason } from "../services/LifecycleService.js";

export function shouldOpenPauseWindowForLifecycle(reason: LifecycleReason): boolean {
  return reason === "visibilitychange" || reason === "pagehide" || reason === "manual";
}
