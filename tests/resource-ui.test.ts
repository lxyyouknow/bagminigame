import type { ResourceKey } from "../src/services/SaveService.js";
import { formatConsumeToast, getTopResourceEntries } from "../src/ui/resourceMeta.js";

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}，期望 ${String(expected)}，实际 ${String(actual)}`);
  }
}

function run(): void {
  const entries = getTopResourceEntries({
    energy: "20",
    dynamite: "30",
    coin: "440",
  });

  assertEqual(entries.length, 3, "顶部资源条应包含 3 个资源");
  assertEqual(entries[0].name, "体力", "第 1 个资源名应为体力");
  assertEqual(entries[1].name, "钥匙", "第 2 个资源名应为钥匙");
  assertEqual(entries[2].name, "金币", "第 3 个资源名应为金币");
  assertEqual(entries[1].value, "30", "钥匙数值应透传");

  const resourceKey: ResourceKey = "dynamite";
  assertEqual(
    formatConsumeToast(resourceKey, 6, 24),
    "已消耗钥匙 x6，剩余 24",
    "开始游戏后应提示钥匙扣减结果",
  );

  assert(entries.every((entry) => entry.name.length > 0), "每个资源都应有可见标注");
}

run();
console.log("resource-ui tests ok");
