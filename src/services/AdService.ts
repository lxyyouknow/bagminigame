export class AdService {
  async showRewardedAd(placementId: string): Promise<boolean> {
    console.info(`[AdService Mock] 激励视频成功：${placementId}`);
    await new Promise((resolve) => window.setTimeout(resolve, 160));
    return true;
  }
}
