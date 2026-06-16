export type RewardedAdStatus = "success" | "failed" | "canceled" | "busy";

export interface RewardedAdResult {
  ok: boolean;
  placementId: string;
  status: RewardedAdStatus;
  message: string;
}

type AdServiceOptions = {
  delayMs?: number;
  logger?: (line: string, result: RewardedAdResult) => void;
};

export class AdService {
  private readonly delayMs: number;
  private readonly logger: (line: string, result: RewardedAdResult) => void;
  private readonly mockOutcomes = new Map<string, Exclude<RewardedAdStatus, "busy">>();
  private readonly history: RewardedAdResult[] = [];
  private playing = false;

  constructor(options: AdServiceOptions = {}) {
    this.delayMs = options.delayMs ?? 160;
    this.logger = options.logger ?? ((line) => console.info(line));
    this.installDebugTools();
  }

  setMockOutcome(placementId: string, status: Exclude<RewardedAdStatus, "busy">): void {
    this.mockOutcomes.set(placementId, status);
  }

  clearMockOutcome(placementId: string): void {
    this.mockOutcomes.delete(placementId);
  }

  getHistory(): RewardedAdResult[] {
    return this.history.map((result) => ({ ...result }));
  }

  async showRewardedAd(placementId: string): Promise<RewardedAdResult> {
    if (this.playing) {
      return this.record({
        ok: false,
        placementId,
        status: "busy",
        message: "广告播放中，请稍后再试",
      });
    }

    this.playing = true;
    await new Promise((resolve) => globalThis.setTimeout(resolve, this.delayMs));
    this.playing = false;

    const status = this.mockOutcomes.get(placementId) ?? "success";
    if (status === "success") {
      return this.record({ ok: true, placementId, status, message: "激励视频播放完成" });
    }
    if (status === "canceled") {
      return this.record({ ok: false, placementId, status, message: "已取消观看广告" });
    }
    return this.record({ ok: false, placementId, status, message: "广告加载失败，请稍后再试" });
  }

  private record(result: RewardedAdResult): RewardedAdResult {
    const cloned = { ...result };
    this.history.push(cloned);
    this.logger(`[AdService Mock] ${result.placementId} ${result.status}`, cloned);
    return cloned;
  }

  private installDebugTools(): void {
    const target = globalThis as typeof globalThis & {
      __debugAds?: Record<string, unknown>;
    };
    target.__debugAds = {
      setOutcome: (placementId: string, status: Exclude<RewardedAdStatus, "busy">) => this.setMockOutcome(placementId, status),
      clearOutcome: (placementId: string) => this.clearMockOutcome(placementId),
      history: () => this.getHistory(),
    };
  }
}
