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

const restored = loadRunRecoverySnapshot("test_lxy", 12_000);
if (!restored) throw new Error("同账号未过期快照应该可以恢复");
assertEqual(restored.levelId, 1, "恢复关卡 id 应正确");
assertEqual(restored.session.currentWave, 2, "恢复波次应正确");
assertEqual(restored.session.baseHp, 720, "恢复基地血量应正确");
assertEqual(restored.session.bag, restored.bag, "恢复后 session.bag 应指向恢复背包对象");
assertEqual(sessionStorage.getItem("backpack_run_recovery_v1") !== null, true, "快照应同时写入 sessionStorage，提升 WebView 刷新恢复率");

assertEqual(loadRunRecoverySnapshot("other_account", 12_000), undefined, "不同账号不应恢复快照");
assertEqual(loadRunRecoverySnapshot("test_lxy", 10_000 + 1000 * 60 * 41), undefined, "过期快照不应恢复");

clearRunRecoverySnapshot();
assertEqual(loadRunRecoverySnapshot("test_lxy", 12_000), undefined, "清理后不应恢复快照");

sessionStorage.setItem("backpack_run_recovery_v1", JSON.stringify({
  version: 1,
  accountId: "test_lxy",
  levelId: 1,
  phase: "preparing",
  savedAt: 20_000,
  bag,
  session,
}));
const restoredFromSession = loadRunRecoverySnapshot("test_lxy", 21_000);
if (!restoredFromSession) throw new Error("localStorage 为空但 sessionStorage 有快照时应该可以恢复");
assertEqual(restoredFromSession.phase, "preparing", "sessionStorage 快照恢复应正确");

console.log("run-recovery-state tests ok");
