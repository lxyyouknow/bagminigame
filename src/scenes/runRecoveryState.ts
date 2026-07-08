import type { BagState } from "../types.js";
import type { RunSessionState } from "./runSessionState.js";

export type RunRecoveryPhase = "preparing" | "fighting" | "transition";

export interface RunRecoverySnapshot {
  version: 1;
  accountId: string;
  levelId: number;
  phase: RunRecoveryPhase;
  savedAt: number;
  bag: BagState;
  session: RunSessionState;
}

export interface RunRecoveryLoadResult {
  snapshot?: RunRecoverySnapshot;
  reason: "ok" | "no_storage" | "empty" | "invalid" | "account_mismatch" | "expired";
  source?: "localStorage" | "sessionStorage";
}

const storageKey = "backpack_run_recovery_v1";
const maxRecoveryAgeMs = 1000 * 60 * 40;
const runRecoveryEnabled = false;

export function saveRunRecoverySnapshot(snapshot: RunRecoverySnapshot): void {
  if (!runRecoveryEnabled) return;
  const storages = getStorages();
  if (storages.length <= 0) return;
  const payload = JSON.stringify(snapshot);
  for (const { storage } of storages) {
    try {
      storage.setItem(storageKey, payload);
    } catch {
      // 微信内置浏览器偶尔会限制 storage，恢复能力失效也不影响正常游戏。
    }
  }
}

export function loadRunRecoverySnapshot(accountId: string, now = Date.now()): RunRecoverySnapshot | undefined {
  return inspectRunRecoverySnapshot(accountId, now).snapshot;
}

export function inspectRunRecoverySnapshot(accountId: string, now = Date.now()): RunRecoveryLoadResult {
  if (!runRecoveryEnabled) {
    clearRunRecoverySnapshot();
    return { reason: "empty" };
  }
  const storages = getStorages();
  if (storages.length <= 0) return { reason: "no_storage" };
  let lastReason: RunRecoveryLoadResult["reason"] = "empty";
  for (const { name, storage } of storages) {
    try {
      const raw = storage.getItem(storageKey);
      if (!raw) continue;
      const snapshot = JSON.parse(raw) as RunRecoverySnapshot;
      if (!isValidSnapshot(snapshot)) {
        lastReason = "invalid";
        continue;
      }
      if (snapshot.accountId !== accountId) {
        lastReason = "account_mismatch";
        continue;
      }
      if (now - snapshot.savedAt > maxRecoveryAgeMs) {
        lastReason = "expired";
        continue;
      }
      snapshot.session.bag = snapshot.bag;
      return { snapshot, reason: "ok", source: name };
    } catch {
      lastReason = "invalid";
    }
  }
  return { reason: lastReason };
}

export function clearRunRecoverySnapshot(): void {
  for (const { storage } of getStorages()) {
    try {
      storage.removeItem(storageKey);
    } catch {
      // ignore
    }
  }
}

function getStorages(): { name: "localStorage" | "sessionStorage"; storage: Storage }[] {
  if (typeof window === "undefined") return [];
  const storages: { name: "localStorage" | "sessionStorage"; storage: Storage }[] = [];
  try {
    if (window.localStorage) storages.push({ name: "localStorage", storage: window.localStorage });
  } catch {
    // ignore
  }
  try {
    if (window.sessionStorage) storages.push({ name: "sessionStorage", storage: window.sessionStorage });
  } catch {
    // ignore
  }
  return storages;
}

function isValidSnapshot(value: RunRecoverySnapshot): value is RunRecoverySnapshot {
  return Boolean(
    value
      && value.version === 1
      && typeof value.accountId === "string"
      && typeof value.levelId === "number"
      && typeof value.savedAt === "number"
      && value.bag
      && Array.isArray(value.bag.placed)
      && Array.isArray(value.bag.candidates)
      && value.session
      && value.session.buffs,
  );
}
