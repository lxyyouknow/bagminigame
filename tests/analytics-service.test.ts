import { AnalyticsService, type AnalyticsEventName } from "../src/services/AnalyticsService.js";

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}，期望 ${String(expected)}，实际 ${String(actual)}`);
  }
}

function run(): void {
  const logs: string[] = [];
  const analytics = new AnalyticsService({
    now: () => 123456,
    logger: (line) => logs.push(line),
  });

  analytics.setUserId("test_lxy");
  analytics.track("main_show", { levelId: 1 });
  analytics.track("level_start_success", { levelId: 1, costResource: "dynamite", costAmount: 6 });

  const events = analytics.getEvents();
  assertEqual(events.length, 2, "应记录两条打点");
  assertEqual(events[0].seq, 1, "第一条序号错误");
  assertEqual(events[1].seq, 2, "第二条序号错误");
  assertEqual(events[0].event, "main_show" as AnalyticsEventName, "事件名错误");
  assertEqual(events[0].userId, "test_lxy", "用户 id 应写入事件");
  assertEqual(events[0].ts, 123456, "时间戳错误");
  assertEqual(events[1].params.levelId, 1, "参数应写入事件");
  assert(logs.some((line) => line.includes("level_start_success")), "mock logger 应输出事件名");

  events[0].params.levelId = 999;
  assertEqual(analytics.getEvents()[0].params.levelId, 1, "读取事件不应允许外部改内部历史");

  analytics.clear();
  assertEqual(analytics.getEvents().length, 0, "clear 后应清空历史");
}

run();
console.log("analytics-service tests ok");
