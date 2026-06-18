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

  constructor(private readonly level: LevelDef, initialState?: BagState, entryToast?: string) {
    super();
    this.flow = createRunFlow(data.getEconomy("run_transition_seconds") || 0.42);
    this.bagScene = new BagScene(level, initialState, entryToast, () => this.startBattle());
    this.session = createRunSessionState(level, this.bagScene.getState());
    this.bagScene.attachRunSession(this.session);
    this.bagScene.refresh();
    this.container.addChild(this.bagScene.container);
    this.applyViewOffsets();
    audio.playMusicEvent("music_main");
  }

  override update(dt: number): void {
    if (this.lifecycleFrozen) return;
    if (this.flow.phase === "toBattle" || this.flow.phase === "toBag") {
      const completed = stepRunFlow(this.flow, dt);
      this.applyViewOffsets();
      if (completed) this.finishTransition();
      return;
    }
    if (this.flow.phase === "preparing") {
      this.bagScene.update(dt);
      return;
    }
    if (this.flow.phase === "fighting") this.battleScene?.update(dt);
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
    if (!beginBattleTransition(this.flow)) return;
    this.bagScene.container.eventMode = "none";
    this.battleScene = new BattleScene(this.level, this.session.bag, {
      session: this.session,
      onWaveClear: (message) => this.returnToBag(message),
    });
    this.battleScene.container.eventMode = "none";
    this.container.addChild(this.battleScene.container);
    this.applyViewOffsets();
  }

  private returnToBag(message: string): void {
    if (!beginBagTransition(this.flow)) return;
    this.bagScene.refresh(message);
    this.bagScene.container.eventMode = "none";
    if (this.battleScene) this.battleScene.container.eventMode = "none";
    this.applyViewOffsets();
  }

  private finishTransition(): void {
    if (this.flow.phase === "fighting") {
      if (this.battleScene) this.battleScene.container.eventMode = "auto";
      return;
    }
    if (this.flow.phase !== "preparing") return;
    this.bagScene.container.eventMode = "auto";
    if (this.battleScene) {
      this.battleScene.destroy();
      this.battleScene = undefined;
    }
    audio.playMusicEvent("music_main");
    this.applyViewOffsets();
  }

  private applyViewOffsets(): void {
    const offsets = getRunViewOffsets(this.flow, app.screen.height);
    this.bagScene.container.y = offsets.bagY;
    if (this.battleScene) this.battleScene.container.y = offsets.battleY;
  }

  override destroy(): void {
    this.disposed = true;
    this.bagScene.destroy();
    this.battleScene?.destroy();
    this.battleScene = undefined;
    this.container.destroy({ children: false });
  }
}
