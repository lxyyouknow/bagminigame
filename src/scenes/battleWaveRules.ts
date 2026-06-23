import type { BagState, BattleTuningDef, LevelDef, ResolvedWaveTuning, WaveDef } from "../types.js";
import { getWaveRewardGoldWithTuning, resolveWaveTuning } from "./battleDifficultyRules.js";

export interface WaveSpawnEvent {
  time: number;
  monsterId: number;
  wave: number;
  tuning: ResolvedWaveTuning;
}

export interface WaveCheckpointResult {
  rewardGold: number;
  expandedCells: number;
  nextWave: number;
}

export function buildSingleWaveSpawnQueue(waves: WaveDef[], waveNo: number, tuning?: BattleTuningDef): WaveSpawnEvent[] {
  const rows = waves.filter((row) => row.wave === waveNo);
  if (rows.length === 0) return [];
  const baseTime = Math.min(...rows.map((row) => row.time));
  const queue: WaveSpawnEvent[] = [];
  for (const row of rows) {
    const firstTime = Math.max(0.2, row.time - baseTime + 0.2);
    for (let index = 0; index < row.count; index += 1) {
      queue.push({
        time: roundTime(firstTime + index * row.interval),
        monsterId: row.monsterId,
        wave: row.wave,
        tuning: resolveWaveTuning(tuning, row),
      });
    }
  }
  return queue.sort((a, b) => a.time - b.time);
}

export function getWaveRewardGold(waves: WaveDef[], waveNo: number, tuning?: BattleTuningDef): number {
  if (tuning) return getWaveRewardGoldWithTuning(waves, waveNo, tuning);
  return waves.filter((row) => row.wave === waveNo).reduce((sum, row) => sum + (row.rewardGold ?? 0), 0);
}

export function applyWaveCheckpointToBag(bag: BagState, level: LevelDef, waves: WaveDef[], tuning?: BattleTuningDef): WaveCheckpointResult {
  const waveNo = bag.currentWave ?? 1;
  const rows = waves.filter((row) => row.wave === waveNo);
  const rewardGold = getWaveRewardGold(waves, waveNo, tuning);
  const beforeCells = bag.rows * bag.cols;
  bag.gold += rewardGold;

  for (const row of rows) {
    const expandCols = Math.max(0, row.expandCols ?? 0);
    const expandRows = Math.max(0, row.expandRows ?? 0);
    for (let i = 0; i < expandCols && bag.cols < level.maxCols; i += 1) bag.cols += 1;
    for (let i = 0; i < expandRows && bag.rows < level.maxRows; i += 1) bag.rows += 1;
  }

  bag.currentWave = waveNo + 1;
  return {
    rewardGold,
    expandedCells: bag.rows * bag.cols - beforeCells,
    nextWave: bag.currentWave,
  };
}

export function refreshWaveCandidates(bag: BagState, rollItem: () => number, count = 3): void {
  bag.candidates = Array.from({ length: Math.max(0, count) }, () => rollItem());
}

function roundTime(value: number): number {
  return Math.round(value * 1000) / 1000;
}
