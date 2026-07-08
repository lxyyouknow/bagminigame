import { GameDataManager } from "../data/GameDataManager";
import type { AudioDef, AudioSettings } from "../types";
import { clamp01 } from "../utils/math";
import { debugTrace } from "../core/debugTrace";

export class AudioManager {
  private readonly storageKey = "backpack-mini-game-audio";
  private clips = new Map<string, HTMLAudioElement>();
  private sfxBuffers = new Map<string, AudioBuffer>();
  private sfxBufferLoading = new Map<string, Promise<void>>();
  private activeCount = new Map<string, number>();
  private lastPlayAt = new Map<string, number>();
  private currentMusic: HTMLAudioElement | undefined;
  private currentMusicKey = "";
  private context: AudioContext | undefined;
  private htmlAudioUnlocked = false;
  private musicUnlockPromise: Promise<void> | undefined;
  private generatedMusic:
    | {
        key: string;
        osc: OscillatorNode;
        gain: GainNode;
      }
    | undefined;
  private musicPausedByGame = false;
  constructor(private readonly data: GameDataManager) {}

  settings: AudioSettings = {
    masterVolume: 0.8,
    musicVolume: 0.55,
    sfxVolume: 0.8,
    mutedMusic: false,
    mutedSfx: false,
  };

  init(): void {
    this.loadSettings();
    window.addEventListener("pointerdown", () => void this.unlock(), { once: true });
    window.addEventListener("touchend", () => void this.unlock(), { once: true });
    document.addEventListener("WeixinJSBridgeReady", () => void this.unlock(), { once: true });
  }

  async preloadGroups(groups: string[]): Promise<void> {
    const targetGroups = new Set(groups);
    const rows: AudioDef[] = [];
    const musicRows: AudioDef[] = [];
    for (const row of this.data.audio) {
      if (!row.url || !targetGroups.has(row.preloadGroup)) continue;
      if (row.type === "music") musicRows.push(row);
      else rows.push(row);
    }
    for (const row of musicRows) this.ensureClip(row);
    await Promise.all(rows.map((row) => this.loadSfxBuffer(row)));
  }

  preloadGroupsInBackground(groups: string[]): void {
    void this.preloadGroups(groups);
  }

  playMusicEvent(eventKey: string): void {
    const event = this.data.getAudioEvent(eventKey);
    if (!event) return;
    const def = this.data.getAudio(event.audioKey);
    if (!def || def.type !== "music") return;
    this.playMusic(def);
  }

  pauseMusic(): void {
    this.musicPausedByGame = true;
    this.currentMusic?.pause();
    this.applyGeneratedMusicVolume();
  }

  resumeMusic(): void {
    this.musicPausedByGame = false;
    this.applyMusicVolume();
    if (this.currentMusic && !this.settings.mutedMusic) void this.currentMusic.play().catch(() => {});
  }

  playSfxEvent(eventKey: string): void {
    const event = this.data.getAudioEvent(eventKey);
    if (!event || event.category !== "sfx") return;
    const def = this.data.getAudio(event.audioKey);
    if (!def || this.settings.mutedSfx) return;
    const now = performance.now();
    if (event.cooldownMs > 0 && now - (this.lastPlayAt.get(event.event) ?? 0) < event.cooldownMs) return;
    this.lastPlayAt.set(event.event, now);

    if (!def.url) {
      this.playGenerated(def);
      return;
    }

    if (this.playBufferedSfx(def)) return;
    void this.loadSfxBuffer(def);
  }

  setMasterVolume(value: number): void {
    this.settings.masterVolume = clamp01(value);
    this.persist();
    this.applyMusicVolume();
  }

  setMusicVolume(value: number): void {
    this.settings.musicVolume = clamp01(value);
    this.persist();
    this.applyMusicVolume();
  }

  setSfxVolume(value: number): void {
    this.settings.sfxVolume = clamp01(value);
    this.persist();
  }

  toggleMusic(): void {
    this.settings.mutedMusic = !this.settings.mutedMusic;
    this.persist();
    this.applyMusicVolume();
    this.applyGeneratedMusicVolume();
  }

  toggleSfx(): void {
    this.settings.mutedSfx = !this.settings.mutedSfx;
    this.persist();
  }

  pauseForLifecycle(): void {
    this.currentMusic?.pause();
    if (this.context?.state === "running") void this.context.suspend().catch(() => {});
  }

  resumeFromLifecycle(): void {
    if (this.context?.state === "suspended") void this.context.resume().catch(() => {});
    if (this.currentMusic && !this.settings.mutedMusic && !this.musicPausedByGame) void this.currentMusic.play().catch(() => {});
  }

  private playMusic(def: AudioDef): void {
    if (this.currentMusicKey === def.key && (this.currentMusic || this.generatedMusic)) {
      this.applyMusicVolume();
      this.applyGeneratedMusicVolume();
      return;
    }
    this.currentMusic?.pause();
    this.currentMusic = undefined;
    this.stopGeneratedMusic();
    this.currentMusicKey = def.key;
    this.musicPausedByGame = false;
    if (!def.url) {
      this.playGeneratedMusic(def);
      return;
    }
    const clip = this.ensureClip(def);
    if (!clip) return;
    clip.loop = def.loop;
    clip.volume = this.calcVolume(def, "music");
    clip.currentTime = 0;
    this.currentMusic = clip;
    if (!this.settings.mutedMusic) {
      void clip.play().catch((error) => {
        debugTrace("audio_music_play_failed", {
          key: def.key,
          message: error instanceof Error ? error.message : String(error),
        });
      });
    }
  }

  private applyMusicVolume(): void {
    this.applyGeneratedMusicVolume();
    if (!this.currentMusic) return;
    this.currentMusic.volume = this.calcVolume(this.data.getAudio(this.currentMusicKey), "music");
    if (this.settings.mutedMusic || this.musicPausedByGame || this.currentMusic.volume <= 0) {
      this.currentMusic.pause();
    } else {
      void this.currentMusic.play().catch((error) => {
        debugTrace("audio_music_resume_failed", {
          key: this.currentMusicKey,
          message: error instanceof Error ? error.message : String(error),
        });
      });
    }
  }

  private ensureClip(def: AudioDef): HTMLAudioElement | undefined {
    if (!def.url) return undefined;
    const existing = this.clips.get(def.key);
    if (existing) return existing;
    const clip = new Audio(def.url);
    clip.preload = "auto";
    clip.loop = def.loop;
    clip.volume = this.calcVolume(def, def.type);
    clip.load();
    this.clips.set(def.key, clip);
    return clip;
  }

  private async loadSfxBuffer(def: AudioDef): Promise<void> {
    if (!def.url || this.sfxBuffers.has(def.key)) return;
    const existing = this.sfxBufferLoading.get(def.key);
    if (existing) return existing;
    const task = this.fetchAndDecodeSfx(def).finally(() => {
      this.sfxBufferLoading.delete(def.key);
    });
    this.sfxBufferLoading.set(def.key, task);
    return task;
  }

  private async fetchAndDecodeSfx(def: AudioDef): Promise<void> {
    const ctx = this.ensureAudioContext();
    if (!ctx || !def.url) return;
    try {
      const response = await fetch(def.url, { cache: "force-cache" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const bytes = await response.arrayBuffer();
      const buffer = await ctx.decodeAudioData(bytes.slice(0));
      this.sfxBuffers.set(def.key, buffer);
      debugTrace("audio_sfx_decoded", { key: def.key, seconds: Math.round(buffer.duration * 100) / 100 });
    } catch (error) {
      debugTrace("audio_sfx_decode_failed", {
        key: def.key,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private playBufferedSfx(def: AudioDef): boolean {
    const buffer = this.sfxBuffers.get(def.key);
    if (!buffer) return false;
    const ctx = this.ensureAudioContext();
    if (!ctx) return false;
    if (ctx.state === "suspended") void ctx.resume().catch(() => {});
    const active = this.activeCount.get(def.key) ?? 0;
    if (def.maxConcurrent > 0 && active >= def.maxConcurrent) return true;
    const gain = ctx.createGain();
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    gain.gain.value = this.calcVolume(def, "sfx");
    source.connect(gain);
    gain.connect(ctx.destination);
    this.activeCount.set(def.key, active + 1);
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
      this.activeCount.set(def.key, Math.max(0, (this.activeCount.get(def.key) ?? 1) - 1));
    };
    try {
      source.start();
      return true;
    } catch (error) {
      debugTrace("audio_sfx_start_failed", {
        key: def.key,
        message: error instanceof Error ? error.message : String(error),
      });
      source.onended = null;
      source.disconnect();
      gain.disconnect();
      this.activeCount.set(def.key, Math.max(0, active));
      return false;
    }
  }

  private ensureAudioContext(): AudioContext | undefined {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return undefined;
    this.context ??= new Ctor();
    return this.context;
  }

  private playGenerated(def: AudioDef): void {
    if (!def.generatedFreq || this.settings.sfxVolume <= 0 || this.settings.masterVolume <= 0) return;
    const ctx = this.ensureAudioContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.value = def.generatedFreq;
    gain.gain.value = this.calcVolume(def, "sfx") * 0.12;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.09);
    osc.stop(ctx.currentTime + 0.1);
  }

  private playGeneratedMusic(def: AudioDef): void {
    if (!def.generatedFreq) return;
    const ctx = this.ensureAudioContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = def.generatedFreq;
    gain.gain.value = 0;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    this.generatedMusic = { key: def.key, osc, gain };
    this.applyGeneratedMusicVolume();
  }

  private stopGeneratedMusic(): void {
    if (!this.generatedMusic) return;
    try {
      this.generatedMusic.osc.stop();
    } catch {
      // 已停止的测试 BGM 节点直接忽略。
    }
    this.generatedMusic.osc.disconnect();
    this.generatedMusic.gain.disconnect();
    this.generatedMusic = undefined;
  }

  private applyGeneratedMusicVolume(): void {
    if (!this.generatedMusic) return;
    const def = this.data.getAudio(this.generatedMusic.key);
    const target = this.musicPausedByGame ? 0 : this.calcVolume(def, "music") * 0.06;
    const ctx = this.context;
    if (!ctx) return;
    this.generatedMusic.gain.gain.cancelScheduledValues(ctx.currentTime);
    this.generatedMusic.gain.gain.setTargetAtTime(target, ctx.currentTime, 0.035);
  }

  private calcVolume(def: AudioDef | undefined, type: "music" | "sfx"): number {
    if (!def) return 0;
    const muted = type === "music" ? this.settings.mutedMusic : this.settings.mutedSfx;
    if (muted) return 0;
    const channel = type === "music" ? this.settings.musicVolume : this.settings.sfxVolume;
    return clamp01(this.settings.masterVolume * channel * def.volume);
  }

  private async unlock(): Promise<void> {
    this.htmlAudioUnlocked = true;
    if (this.context?.state === "suspended") await this.context.resume();
    this.musicUnlockPromise ??= this.unlockMusicClips();
    await this.musicUnlockPromise;
    if (this.currentMusic && !this.settings.mutedMusic && !this.musicPausedByGame) void this.currentMusic.play().catch(() => {});
  }

  private async unlockMusicClips(): Promise<void> {
    const musicRows = this.data.audio.filter((row) => row.type === "music" && row.url);
    for (const row of musicRows) {
      const clip = this.ensureClip(row);
      if (!clip) continue;
      const previousMuted = clip.muted;
      const previousVolume = clip.volume;
      const previousTime = clip.currentTime;
      try {
        clip.muted = true;
        clip.volume = 0;
        await clip.play();
        clip.pause();
        clip.currentTime = Number.isFinite(previousTime) ? previousTime : 0;
        debugTrace("audio_music_unlocked", { key: row.key });
      } catch (error) {
        debugTrace("audio_music_unlock_failed", {
          key: row.key,
          message: error instanceof Error ? error.message : String(error),
        });
      } finally {
        clip.muted = previousMuted;
        clip.volume = previousVolume;
      }
    }
  }

  private loadSettings(): void {
    try {
      const raw = window.localStorage.getItem(this.storageKey);
      if (!raw) return;
      this.settings = { ...this.settings, ...(JSON.parse(raw) as Partial<AudioSettings>) };
    } catch {
      this.persist();
    }
  }

  private persist(): void {
    window.localStorage.setItem(this.storageKey, JSON.stringify(this.settings));
  }
}
