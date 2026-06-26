export type RunFlowPhase = "preparing" | "toBattle" | "fighting" | "toBag" | "ended";

export interface RunFlowState {
  phase: RunFlowPhase;
  elapsed: number;
  duration: number;
  battleSplitProgress: number;
  battleSplitHold: number;
}

export interface RunViewOffsets {
  bagY: number;
  battleY: number;
}

export function createRunFlow(duration: number, battleSplitProgress = 0.6, battleSplitHold = 0): RunFlowState {
  return {
    phase: "preparing",
    elapsed: 0,
    duration: Math.max(0.01, duration),
    battleSplitProgress: Math.max(0.05, Math.min(0.95, battleSplitProgress)),
    battleSplitHold: Math.max(0, battleSplitHold),
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
  const targetDuration = flow.phase === "toBattle" ? flow.duration + flow.battleSplitHold : flow.duration;
  flow.elapsed = Math.min(targetDuration, flow.elapsed + Math.max(0, dt));
  if (flow.elapsed < targetDuration) return false;
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

  const progress = flow.phase === "toBattle" ? getBattleTransitionProgress(flow) : easeInOutCubic(Math.min(1, flow.elapsed / flow.duration));
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

function getBattleTransitionProgress(flow: RunFlowState): number {
  if (flow.battleSplitHold <= 0) return easeInOutCubic(Math.min(1, flow.elapsed / flow.duration));
  const split = flow.battleSplitProgress;
  if (flow.elapsed <= flow.duration) {
    return split * easeOutCubic(flow.elapsed / Math.max(0.01, flow.duration));
  }
  return split;
}

function easeInOutCubic(value: number): number {
  return value < 0.5 ? 4 * value * value * value : 1 - Math.pow(-2 * value + 2, 3) / 2;
}

function easeOutCubic(value: number): number {
  return 1 - Math.pow(1 - Math.min(1, Math.max(0, value)), 3);
}
