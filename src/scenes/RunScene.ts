import type { LifecycleReason } from "../services/LifecycleService";
import type { BagState, LevelDef } from "../types";
import { app, audio, data } from "../core/runtime";
import { BaseScene } from "./BaseScene";
import { BagScene } from "./BagScene";
import { BattleScene } from "./BattleScene";
import {
  beginBagTransition,
  beginBattleTransition,
  createRunFlow,
  getRunViewOffsets,
  stepRunFlow,
  type RunFlowState,
} from "./runFlowRules";
import { createRunSessionState, type RunSessionState } from "./runSessionState";

export class RunScene extends BaseScene {
  private readonly flow: RunFlowState;
  private readonly session: RunSessionState;
  private readonly bagScene: BagScene;
  private battleScene: BattleScene | undefined;
  private lifecycleFrozen = false;
  private startingBattleUi = false;
  private startingBattleUiElapsed = 0;
  private readonly startingBattleUiDuration: number;
  private battleHudEntering = false;
  private battleHudEnterElapsed = 0;
  private readonly battleHudEnterDuration: number;
  private readonly farmBattleCameraShift: number;

  constructor(private readonly level: LevelDef, initialState?: BagState, entryToast?: string) {
    super();
    this.flow = createRunFlow(
      data.getEconomy("run_transition_seconds") ?? 0.42,
      data.getEconomy("run_transition_split_progress") ?? 0.6,
      data.getEconomy("run_transition_split_hold_seconds") ?? 0.28,
    );
    this.startingBattleUiDuration = data.getEconomy("run_bag_top_hud_exit_seconds") ?? 0.28;
    this.battleHudEnterDuration = data.getEconomy("run_battle_top_hud_enter_seconds") ?? 0.28;
    this.farmBattleCameraShift = data.economy.find((row) => row.key === "run_farm_battle_camera_shift")?.value ?? 0.5;
    this.bagScene = new BagScene(level, initialState, entryToast, () => this.startBattle());
    this.session = createRunSessionState(level, this.bagScene.getState());
    this.bagScene.attachRunSession(this.session);
    this.bagScene.refresh();
    this.container.addChild(this.bagScene.container);
    this.applyViewOffsets();
    this.applyUiTransition();
    audio.playMusicEvent("music_bag");
  }

  override update(dt: number): void {
    if (this.lifecycleFrozen) return;
    if (this.startingBattleUi) {
      this.startingBattleUiElapsed = Math.min(this.startingBattleUiDuration, this.startingBattleUiElapsed + Math.max(0, dt));
      const progress = this.easeOutCubic(this.startingBattleUiElapsed / Math.max(0.01, this.startingBattleUiDuration));
      this.bagScene.setTopHudExitProgress(progress);
      if (this.startingBattleUiElapsed >= this.startingBattleUiDuration) {
        this.startingBattleUi = false;
        this.beginBattleSceneTransition();
      }
      return;
    }
    if (this.battleHudEntering) {
      this.battleHudEnterElapsed = Math.min(this.battleHudEnterDuration, this.battleHudEnterElapsed + Math.max(0, dt));
      const progress = this.easeOutCubic(this.battleHudEnterElapsed / Math.max(0.01, this.battleHudEnterDuration));
      this.battleScene?.setTopHudRevealProgress(progress);
      this.battleScene?.setFenceRevealProgress(progress);
      if (this.battleHudEnterElapsed >= this.battleHudEnterDuration) {
        this.battleHudEntering = false;
        if (this.battleScene) {
          this.battleScene.setTopHudRevealProgress(1);
          this.battleScene.setFenceRevealProgress(1);
          this.battleScene.container.eventMode = "auto";
        }
      }
      return;
    }
    if (this.flow.phase === "toBattle" || this.flow.phase === "toBag") {
      const completed = stepRunFlow(this.flow, dt);
      this.applyViewOffsets();
      this.applyUiTransition();
      if (completed) this.finishTransition();
      return;
    }
    if (this.flow.phase === "preparing") {
      this.bagScene.update(dt);
      return;
    }
    if (this.flow.phase === "fighting") {
      this.battleScene?.update(dt);
      this.bagScene.syncCombatCooldowns(this.battleScene?.getCooldownMultiplier() ?? 1);
    }
  }

  override onAppPause(reason: LifecycleReason): void {
    if (this.flow.phase === "fighting") {
      this.battleScene?.onAppPause(reason);
      return;
    }
    this.lifecycleFrozen = true;
  }

  override onAppResume(reason: LifecycleReason): void {
    if (this.flow.phase === "fighting") {
      this.battleScene?.onAppResume(reason);
      return;
    }
    this.lifecycleFrozen = false;
  }

  private startBattle(): void {
    if (this.flow.phase !== "preparing" || this.startingBattleUi || this.battleHudEntering) return;
    this.startingBattleUi = true;
    this.startingBattleUiElapsed = 0;
    this.battleHudEntering = false;
    this.battleHudEnterElapsed = 0;
    this.bagScene.container.eventMode = "none";
    this.bagScene.setTopHudExitProgress(0);
  }

  private beginBattleSceneTransition(): void {
    if (!beginBattleTransition(this.flow)) return;
    const finalBagY = getRunViewOffsets({ ...this.flow, phase: "fighting", elapsed: 0 }, app.screen.height, this.farmBattleCameraShift).bagY;
    this.bagScene.setCombatMode(true);
    this.bagScene.container.eventMode = "none";
    this.battleScene = new BattleScene(this.level, this.session.bag, {
      session: this.session,
      onWaveClear: (message) => this.returnToBag(message),
      farmBaseMode: true,
      farmBoard: this.bagScene.getFarmBoardMetrics(finalBagY),
    });
    this.battleScene.container.eventMode = "none";
    this.battleScene.setTopHudRevealProgress(0);
    this.battleScene.setFenceRevealProgress(0);
    this.container.addChild(this.battleScene.container);
    this.applyViewOffsets();
    this.applyUiTransition();
  }

  private returnToBag(message: string): void {
    if (!beginBagTransition(this.flow)) return;
    this.battleHudEntering = false;
    this.battleHudEnterElapsed = 0;
    this.bagScene.setCombatMode(false);
    this.bagScene.refreshAfterWave(message);
    this.bagScene.container.eventMode = "none";
    if (this.battleScene) this.battleScene.container.eventMode = "none";
    this.applyViewOffsets();
    this.applyUiTransition();
  }

  private finishTransition(): void {
    if (this.flow.phase === "fighting") {
      this.battleHudEntering = true;
      this.battleHudEnterElapsed = 0;
      this.battleScene?.setTopHudRevealProgress(0);
      this.battleScene?.setFenceRevealProgress(0);
      return;
    }
    if (this.flow.phase !== "preparing") return;
    this.bagScene.container.eventMode = "auto";
    if (this.battleScene) {
      this.battleScene.destroy();
      this.battleScene = undefined;
    }
    audio.playMusicEvent("music_bag");
    this.applyViewOffsets();
    this.applyUiTransition();
  }

  private applyViewOffsets(): void {
    const offsets = getRunViewOffsets(this.flow, app.screen.height, this.farmBattleCameraShift);
    this.bagScene.container.y = offsets.bagY;
    if (this.battleScene) this.battleScene.container.y = offsets.battleY;
  }

  private applyUiTransition(): void {
    if (this.flow.phase === "toBattle") {
      this.bagScene.setTopHudExitProgress(1);
      this.battleScene?.setTopHudRevealProgress(0);
      this.battleScene?.setFenceRevealProgress(0);
      return;
    }
    if (this.flow.phase === "fighting") {
      this.bagScene.setTopHudExitProgress(1);
      this.battleScene?.setTopHudRevealProgress(1);
      this.battleScene?.setFenceRevealProgress(1);
      return;
    }
    this.bagScene.setTopHudExitProgress(0);
    this.battleScene?.setTopHudRevealProgress(0);
    this.battleScene?.setFenceRevealProgress(0);
  }

  private easeOutCubic(value: number): number {
    return 1 - Math.pow(1 - Math.min(1, Math.max(0, value)), 3);
  }

  override destroy(): void {
    this.disposed = true;
    this.bagScene.destroy();
    this.battleScene?.destroy();
    this.battleScene = undefined;
    this.container.destroy({ children: false });
  }
}
