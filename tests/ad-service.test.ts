import { AdService, type RewardedAdStatus } from "../src/services/AdService.js";

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}，期望 ${String(expected)}，实际 ${String(actual)}`);
  }
}

async function run(): Promise<void> {
  const logs: string[] = [];
  delete (globalThis as typeof globalThis & { __debugAds?: unknown }).__debugAds;
  const ads = new AdService({
    delayMs: 0,
    logger: (line) => logs.push(line),
  });
  const debug = (globalThis as typeof globalThis & {
    __debugAds?: {
      setOutcome: (placementId: string, status: RewardedAdStatus) => void;
      clearOutcome: (placementId: string) => void;
      history: () => unknown[];
    };
  }).__debugAds;
  assert(debug, "应安装广告调试入口");
  if (!debug) throw new Error("应安装广告调试入口");

  const success = await ads.showRewardedAd("bag_refresh");
  assert(success.ok, "默认激励广告应成功");
  assertEqual(success.status, "success" as RewardedAdStatus, "默认状态应为 success");
  assertEqual(success.placementId, "bag_refresh", "应保留广告点位");

  ads.setMockOutcome("bag_expand", "canceled");
  const canceled = await ads.showRewardedAd("bag_expand");
  assert(!canceled.ok, "取消广告不应发奖励");
  assertEqual(canceled.status, "canceled" as RewardedAdStatus, "取消状态错误");

  ads.setMockOutcome("bag_expand", "failed");
  const failed = await ads.showRewardedAd("bag_expand");
  assert(!failed.ok, "失败广告不应发奖励");
  assertEqual(failed.status, "failed" as RewardedAdStatus, "失败状态错误");

  debug.setOutcome("bag_refresh", "canceled");
  const debugCanceled = await ads.showRewardedAd("bag_refresh");
  assertEqual(debugCanceled.status, "canceled" as RewardedAdStatus, "调试入口应能设置广告结果");
  debug.clearOutcome("bag_refresh");

  const slowAds = new AdService({ delayMs: 20, logger: (line) => logs.push(line) });
  const first = slowAds.showRewardedAd("bag_refresh");
  const busy = await slowAds.showRewardedAd("bag_refresh");
  assert(!busy.ok, "广告播放中再次请求应被拦截");
  assertEqual(busy.status, "busy" as RewardedAdStatus, "忙碌状态错误");
  assert((await first).ok, "第一个广告请求仍应成功");

  const history = slowAds.getHistory();
  assertEqual(history.length, 2, "广告历史应记录请求");
  assert(logs.some((line) => line.includes("bag_refresh")), "mock logger 应输出点位");
}

await run();
console.log("ad-service tests ok");
