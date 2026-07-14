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

assertEqual(storage.getItem("backpack_run_recovery_v1") !== null, true, "应写入 localStorage 恢复快照");
assertEqual(sessionStorage.getItem("backpack_run_recovery_v1") !== null, true, "应写入 sessionStorage 恢复快照");

const restored = loadRunRecoverySnapshot("test_lxy", 11_000);
assertEqual(restored?.levelId, 1, "刷新后应恢复原关卡");
assertEqual(restored?.session.currentWave, 2, "刷新后应恢复当前波次");
assertEqual(restored?.session.baseHp, 720, "刷新后应恢复基地血量");
assertEqual(loadRunRecoverySnapshot("other_account", 11_000), undefined, "不同账号不能读取该快照");

clearRunRecoverySnapshot();
assertEqual(loadRunRecoverySnapshot("test_lxy", 11_000), undefined, "主动退出后不应继续恢复快照");

console.log("run-recovery-state tests ok");
