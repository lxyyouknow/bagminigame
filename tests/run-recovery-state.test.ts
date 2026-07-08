import type { BagState } from "../src/types.js";
import { clearRunRecoverySnapshot, loadRunRecoverySnapshot, saveRunRecoverySnapshot } from "../src/scenes/runRecoveryState.js";
import type { RunSessionState } from "../src/scenes/runSessionState.js";

class MemoryStorage {
  private readonly map = new Map<string, string>();

  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }

  removeItem(key: string): void {
    this.map.delete(key);
  }
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}，期望 ${String(expected)}，实际 ${String(actual)}`);
  }
}

const storage = new MemoryStorage();
const sessionStorage = new MemoryStorage();
Object.defineProperty(globalThis, "window", {
  value: { localStorage: storage, sessionStorage },
  configurable: true,
});

const bag: BagState = {
  rows: 3,
  cols: 3,
  gold: 88,
  refreshFree: 1,
  candidates: [101, 111, 121],
  placed: [{ uid: 1, itemId: 101, x: 0, y: 0, cdLeft: 0 }],
  currentWave: 2,
  baseHp: 720,
};

const session: RunSessionState = {
  bag,
  currentWave: 2,
  baseHp: 720,
  exp: 6,
  levelNo: 2,
  kills: 9,
  playSeconds: 18,
  buffs: {
    attackMul: 1.2,
    cdMul: 0.9,
    radiusMul: 1,
    dotMul: 1,
    armorBonus: 0,
    qualityAttack: {},
  },
};

saveRunRecoverySnapshot({
  version: 1,
  accountId: "test_lxy",
  levelId: 1,
  phase: "fighting",
  savedAt: 10_000,
  bag,
  session,
});

assertEqual(storage.getItem("backpack_run_recovery_v1"), null, "禁用恢复后不应写入 localStorage 快照");
assertEqual(sessionStorage.getItem("backpack_run_recovery_v1"), null, "禁用恢复后不应写入 sessionStorage 快照");

storage.setItem("backpack_run_recovery_v1", JSON.stringify({
  version: 1,
  accountId: "test_lxy",
  levelId: 1,
  phase: "preparing",
  savedAt: 20_000,
  bag,
  session,
}));
sessionStorage.setItem("backpack_run_recovery_v1", JSON.stringify({
  version: 1,
  accountId: "test_lxy",
  levelId: 1,
  phase: "preparing",
  savedAt: 20_000,
  bag,
  session,
}));

assertEqual(loadRunRecoverySnapshot("test_lxy", 21_000), undefined, "禁用恢复后不应恢复旧快照");
assertEqual(storage.getItem("backpack_run_recovery_v1"), null, "读取恢复时应清理旧 localStorage 快照");
assertEqual(sessionStorage.getItem("backpack_run_recovery_v1"), null, "读取恢复时应清理旧 sessionStorage 快照");

clearRunRecoverySnapshot();
assertEqual(loadRunRecoverySnapshot("test_lxy", 21_000), undefined, "清理后仍不应恢复快照");

console.log("run-recovery-state tests ok");
