import type { StorageAdapter } from "./StorageAdapter.js";

export type ResourceKey = "dynamite" | "coin" | "energy";

export interface SaveLevelConfig {
  id: number;
  winWave: number;
  entryCostResource?: ResourceKey;
  entryCostAmount?: number;
  firstPassRewardCoin?: number;
  repeatWinRewardCoin?: number;
  loseRewardCoin?: number;
}

export interface PlayerResources {
  dynamite: number;
  coin: number;
  energy: number;
}

export interface PlayerProfile {
  uid: string;
  createdAt: number;
  lastLoginAt: number;
}

export interface LevelProgress {
  unlocked: boolean;
  passed: boolean;
  bestWave: number;
  bestKills: number;
  winCount: number;
  playCount: number;
  lastPlayedAt: number;
}

export interface PlayerStats {
  totalBattles: number;
  totalWins: number;
  totalKills: number;
  totalPlaySeconds: number;
}

export interface PlayerSaveSettings {
  lastSelectedLevelId: number;
}

export interface PlayerSaveData {
  version: 1;
  player: PlayerProfile;
  resources: PlayerResources;
  levels: Record<string, LevelProgress>;
  stats: PlayerStats;
  settings: PlayerSaveSettings;
}

export interface BattleResult {
  win: boolean;
  wave: number;
  kills: number;
  runGold: number;
  playSeconds: number;
}

export interface RewardResult {
  coin: number;
  firstPass: boolean;
}

export type ConsumeResult =
  | { ok: true }
  | { ok: false; reason: "locked" | "notEnough"; resource?: ResourceKey; need?: number; current?: number };

type SaveServiceOptions = {
  accountId?: string;
  now?: () => number;
};

const ACTIVE_ACCOUNT_KEY = "backpack_defense_active_account";
const SAVE_KEY_PREFIX = "backpack_defense_save_v1";
const DEFAULT_ACCOUNT = "test_lxy";

export class SaveService {
  private accountId: string;
  private readonly now: () => number;
  private levels: SaveLevelConfig[] = [];
  private saveData: PlayerSaveData | undefined;

  constructor(private readonly storage: StorageAdapter, options: SaveServiceOptions = {}) {
    this.now = options.now ?? (() => Date.now());
    this.accountId = this.resolveAccountId(options.accountId);
  }

  init(levels: SaveLevelConfig[]): void {
    this.levels = levels;
    this.saveData = this.loadOrCreate();
    this.repairSave();
    this.save();
    this.installDebugTools();
  }

  getAccountId(): string {
    return this.accountId;
  }

  switchAccount(accountId: string): void {
    this.accountId = this.normalizeAccountId(accountId);
    this.storage.setItem(ACTIVE_ACCOUNT_KEY, this.accountId);
    this.saveData = this.loadOrCreate();
    this.repairSave();
    this.save();
  }

  getState(): PlayerSaveData {
    return this.requireSave();
  }

  getResources(): PlayerResources {
    return this.requireSave().resources;
  }

  getLevelProgress(levelId: number): LevelProgress {
    return this.requireSave().levels[String(levelId)] ?? this.defaultLevelProgress(levelId);
  }

  isLevelUnlocked(levelId: number): boolean {
    return this.getLevelProgress(levelId).unlocked;
  }

  getEntryCost(levelId: number): { resource: ResourceKey; amount: number } {
    const level = this.getLevelConfig(levelId);
    return {
      resource: level.entryCostResource ?? "dynamite",
      amount: level.entryCostAmount ?? 6,
    };
  }

  tryConsumeLevelEntry(levelId: number): ConsumeResult {
    if (!this.isLevelUnlocked(levelId)) return { ok: false, reason: "locked" };
    const cost = this.getEntryCost(levelId);
    const resources = this.requireSave().resources;
    const current = resources[cost.resource] ?? 0;
    if (current < cost.amount) {
      return { ok: false, reason: "notEnough", resource: cost.resource, need: cost.amount, current };
    }
    resources[cost.resource] = current - cost.amount;
    this.save();
    return { ok: true };
  }

  addResource(resource: ResourceKey, amount: number): void {
    const resources = this.requireSave().resources;
    resources[resource] = Math.max(0, (resources[resource] ?? 0) + amount);
    this.save();
  }

  applyBattleResult(levelId: number, result: BattleResult): RewardResult {
    const save = this.requireSave();
    const progress = this.getMutableLevelProgress(levelId);
    const level = this.getLevelConfig(levelId);
    const wasPassed = progress.passed;
    const rewardCoin = this.resolveReward(level, result.win, wasPassed);

    progress.playCount += 1;
    progress.lastPlayedAt = this.now();
    progress.bestWave = Math.max(progress.bestWave, result.wave);
    progress.bestKills = Math.max(progress.bestKills, result.kills);

    if (result.win) {
      progress.passed = true;
      progress.winCount += 1;
      progress.bestWave = Math.max(progress.bestWave, level.winWave);
      this.unlockNextLevel(levelId);
      save.stats.totalWins += 1;
    }

    save.resources.coin = Math.max(0, save.resources.coin + rewardCoin);
    save.stats.totalBattles += 1;
    save.stats.totalKills += result.kills;
    save.stats.totalPlaySeconds += Math.max(0, Math.round(result.playSeconds));
    this.save();
    return { coin: rewardCoin, firstPass: result.win && !wasPassed };
  }

  resetCurrentAccount(): void {
    this.storage.removeItem(this.saveKey());
    this.saveData = this.createDefaultSave();
    this.repairSave();
    this.save();
  }

  unlockAllLevels(): void {
    for (const level of this.levels) {
      this.getMutableLevelProgress(level.id).unlocked = true;
    }
    this.save();
  }

  private resolveAccountId(optionAccountId?: string): string {
    const urlAccount = this.getAccountFromUrl();
    const stored = this.storage.getItem(ACTIVE_ACCOUNT_KEY);
    const accountId = this.normalizeAccountId(optionAccountId || urlAccount || stored || DEFAULT_ACCOUNT);
    this.storage.setItem(ACTIVE_ACCOUNT_KEY, accountId);
    return accountId;
  }

  private getAccountFromUrl(): string {
    try {
      return new URLSearchParams(window.location.search).get("account") || "";
    } catch {
      return "";
    }
  }

  private normalizeAccountId(value: string): string {
    const normalized = value.trim().replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 32);
    return normalized || DEFAULT_ACCOUNT;
  }

  private saveKey(): string {
    return `${SAVE_KEY_PREFIX}:${this.accountId}`;
  }

  private loadOrCreate(): PlayerSaveData {
    const raw = this.storage.getItem(this.saveKey());
    if (!raw) return this.createDefaultSave();
    try {
      const parsed = JSON.parse(raw) as PlayerSaveData;
      if (parsed.version !== 1) return this.createDefaultSave();
      return parsed;
    } catch (error) {
      this.storage.setItem(`${this.saveKey()}:corrupt:${this.now()}`, raw);
      console.warn("玩家存档解析失败，已创建默认存档。", error);
      return this.createDefaultSave();
    }
  }

  private createDefaultSave(): PlayerSaveData {
    const now = this.now();
    const levels: Record<string, LevelProgress> = {};
    for (const level of this.levels) {
      levels[String(level.id)] = this.defaultLevelProgress(level.id);
    }
    return {
      version: 1,
      player: {
        uid: this.accountId,
        createdAt: now,
        lastLoginAt: now,
      },
      resources: {
        dynamite: 30,
        coin: 440,
        energy: 20,
      },
      levels,
      stats: {
        totalBattles: 0,
        totalWins: 0,
        totalKills: 0,
        totalPlaySeconds: 0,
      },
      settings: {
        lastSelectedLevelId: this.levels[0]?.id ?? 1,
      },
    };
  }

  private defaultLevelProgress(levelId: number): LevelProgress {
    const firstLevelId = this.levels[0]?.id ?? 1;
    return {
      unlocked: levelId === firstLevelId,
      passed: false,
      bestWave: 0,
      bestKills: 0,
      winCount: 0,
      playCount: 0,
      lastPlayedAt: 0,
    };
  }

  private repairSave(): void {
    const save = this.requireSave();
    save.player.uid = this.accountId;
    save.player.lastLoginAt = this.now();
    save.resources.dynamite = Math.max(0, Number(save.resources.dynamite) || 0);
    save.resources.coin = Math.max(0, Number(save.resources.coin) || 0);
    save.resources.energy = Math.max(0, Number(save.resources.energy) || 0);
    for (const level of this.levels) {
      const key = String(level.id);
      save.levels[key] = { ...this.defaultLevelProgress(level.id), ...(save.levels[key] ?? {}) };
    }
  }

  private getMutableLevelProgress(levelId: number): LevelProgress {
    const save = this.requireSave();
    const key = String(levelId);
    save.levels[key] = save.levels[key] ?? this.defaultLevelProgress(levelId);
    return save.levels[key];
  }

  private unlockNextLevel(levelId: number): void {
    const currentIndex = this.levels.findIndex((level) => level.id === levelId);
    const next = currentIndex >= 0 ? this.levels[currentIndex + 1] : undefined;
    if (next) this.getMutableLevelProgress(next.id).unlocked = true;
  }

  private resolveReward(level: SaveLevelConfig, win: boolean, wasPassed: boolean): number {
    if (!win) return level.loseRewardCoin ?? 10;
    if (!wasPassed) return level.firstPassRewardCoin ?? 80;
    return level.repeatWinRewardCoin ?? 30;
  }

  private getLevelConfig(levelId: number): SaveLevelConfig {
    return this.levels.find((level) => level.id === levelId) ?? { id: levelId, winWave: 1 };
  }

  private save(): void {
    this.storage.setItem(this.saveKey(), JSON.stringify(this.requireSave()));
  }

  private requireSave(): PlayerSaveData {
    if (!this.saveData) throw new Error("玩家存档尚未初始化");
    return this.saveData;
  }

  private installDebugTools(): void {
    const target = globalThis as typeof globalThis & {
      __debugSave?: Record<string, unknown>;
    };
    target.__debugSave = {
      account: () => this.getAccountId(),
      state: () => this.getState(),
      switchAccount: (accountId: string) => this.switchAccount(accountId),
      reset: () => this.resetCurrentAccount(),
      addDynamite: (amount = 30) => this.addResource("dynamite", amount),
      addCoin: (amount = 500) => this.addResource("coin", amount),
      unlockAll: () => this.unlockAllLevels(),
    };
  }
}
