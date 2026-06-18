export type RunFlowPhase = "preparing" | "toBattle" | "fighting" | "toBag" | "ended";

export interface RunFlowState {
  phase: RunFlowPhase;
  elapsed: number;
  duration: number;
}

export interface RunViewOffsets {
  bagY: number;
  battleY: number;
}

export function createRunFlow(duration: number): RunFlowState {
  return {
    phase: "preparing",
    elapsed: 0,
    duration: Math.max(0.01, duration),
  };
}

export function beginBattleTransition(flow: RunFlowState): boolean {
  if (flow.phase !== "preparing") return false;
  flow.phase = "toBattle";
  flow.elapsed = 0;
  return true;
}

export function beginBagTransition(flow: RunFlowState): boolean {
  if (flow.phase !== "fighting") return false;
  flow.phase = "toBag";
  flow.elapsed = 0;
  return true;
}

export function stepRunFlow(flow: RunFlowState, dt: number): boolean {
  if (flow.phase !== "toBattle" && flow.phase !== "toBag") return false;
  flow.elapsed = Math.min(flow.duration, flow.elapsed + Math.max(0, dt));
  if (flow.elapsed < flow.duration) return false;
  flow.phase = flow.phase === "toBattle" ? "fighting" : "preparing";
  flow.elapsed = 0;
  return true;
}

export function finishRun(flow: RunFlowState): void {
  flow.phase = "ended";
  flow.elapsed = 0;
}

export function getRunViewOffsets(flow: RunFlowState, screenHeight: number): RunViewOffsets {
  if (flow.phase === "preparing" || flow.phase === "ended") {
    return { bagY: 0, battleY: -screenHeight };
  }
  if (flow.phase === "fighting") {
    return { bagY: screenHeight, battleY: 0 };
  }

  const rawProgress = Math.min(1, flow.elapsed / flow.duration);
  const progress = easeInOutCubic(rawProgress);
  if (flow.phase === "toBattle") {
    return {
      bagY: screenHeight * progress,
      battleY: -screenHeight * (1 - progress),
    };
  }
  return {
    bagY: screenHeight * (1 - progress),
    battleY: -screenHeight * progress,
  };
}

function easeInOutCubic(value: number): number {
  return value < 0.5 ? 4 * value * value * value : 1 - Math.pow(-2 * value + 2, 3) / 2;
}
