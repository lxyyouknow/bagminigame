import { MemoryStorageAdapter } from "../src/services/StorageAdapter.js";
import { SaveService, type BattleResult, type SaveLevelConfig } from "../src/services/SaveService.js";

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}，期望 ${String(expected)}，实际 ${String(actual)}`);
  }
}

const levels: SaveLevelConfig[] = [
  { id: 1, winWave: 3, entryCostResource: "dynamite", entryCostAmount: 6, firstPassRewardCoin: 80, repeatWinRewardCoin: 30, loseRewardCoin: 10 },
  { id: 2, winWave: 5, entryCostResource: "dynamite", entryCostAmount: 6, firstPassRewardCoin: 120, repeatWinRewardCoin: 45, loseRewardCoin: 12 },
  { id: 3, winWave: 6, entryCostResource: "dynamite", entryCostAmount: 6, firstPassRewardCoin: 160, repeatWinRewardCoin: 60, loseRewardCoin: 15 },
];

function createService(accountId = "test_lxy", storage = new MemoryStorageAdapter()): SaveService {
  const service = new SaveService(storage, { accountId, now: () => 1000 });
  service.init(levels);
  return service;
}

function run(): void {
  const save = createService();
  assertEqual(save.getAccountId(), "test_lxy", "测试账号 id 应该可指定");
  assertEqual(save.getResources().dynamite, 30, "默认炸药数量错误");
  assert(save.isLevelUnlocked(1), "第 1 关默认应解锁");
  assert(!save.isLevelUnlocked(2), "第 2 关默认不应解锁");

  const start = save.tryConsumeLevelEntry(1);
  assert(start.ok, "炸药足够时应允许开始第 1 关");
  assertEqual(save.getResources().dynamite, 24, "开始关卡后应扣除 6 个炸药");

  const sharedStorage = new MemoryStorageAdapter();
  const persistentSave = createService("persist_user", sharedStorage);
  const persistentStart = persistentSave.tryConsumeLevelEntry(1);
  assert(persistentStart.ok, "共享存储下也应允许开始第 1 关");
  const reloadedSave = createService("persist_user", sharedStorage);
  assertEqual(reloadedSave.getResources().dynamite, 24, "重新初始化后炸药扣减结果应保留");

  const win: BattleResult = { win: true, wave: 3, kills: 18, runGold: 42, playSeconds: 31 };
  const firstReward = save.applyBattleResult(1, win);
  assertEqual(firstReward.coin, 80, "第 1 关首通应发首通金币");
  assert(save.getLevelProgress(1).passed, "胜利后第 1 关应标记通关");
  assert(save.isLevelUnlocked(2), "通关第 1 关后应解锁第 2 关");
  assertEqual(save.getLevelProgress(1).bestWave, 3, "最高波次应更新");
  assertEqual(save.getResources().coin, 520, "首通奖励应进入长期金币");

  const repeatReward = save.applyBattleResult(1, win);
  assertEqual(repeatReward.coin, 30, "重复通关应发重复奖励");
  assertEqual(save.getResources().coin, 550, "重复奖励应进入长期金币");
  assertEqual(save.getLevelProgress(1).winCount, 2, "胜利次数应累加");

  const loseReward = save.applyBattleResult(2, { win: false, wave: 2, kills: 5, runGold: 9, playSeconds: 18 });
  assertEqual(loseReward.coin, 12, "失败应发安慰奖励");
  assert(!save.getLevelProgress(2).passed, "失败不应标记通关");
  assert(!save.isLevelUnlocked(3), "失败不应解锁下一关");
  assertEqual(save.getLevelProgress(2).bestWave, 2, "失败也应记录最高波次");

  const other = createService("test_alt");
  assertEqual(other.getResources().dynamite, 30, "不同测试账号应使用独立默认存档");
}

run();
console.log("save-service tests ok");
