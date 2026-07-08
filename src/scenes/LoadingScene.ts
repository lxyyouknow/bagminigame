import { Container, Graphics, type Sprite } from "pixi.js";
import { analytics, app, assetManager, audio, data, lifecycle, save } from "../core/runtime";
import { showLogin, showRun } from "../core/navigation";
import { debugTrace } from "../core/debugTrace";
import { drawAssetBg, spriteFromAsset, text } from "../utils/display";
import { getUiLayout, resolveUiLayoutPosition, resolveUiLayoutRect, scaleUiLayoutSize } from "../ui/layout/UiLayout";
import { BaseScene } from "./BaseScene";
import { inspectRunRecoverySnapshot } from "./runRecoveryState";

export class LoadingScene extends BaseScene {
  private progress = 0;
  private bar = new Graphics();
  private label = text("Loading ...", 24, "#ffffff", "700");
  private errorMessage = "";

  constructor() {
    super();
    document.querySelector("#boot-loading")?.remove();
    this.redraw();
    void this.load();
  }

  override update(dt: number): void {
    if (this.progress < 1 && !this.errorMessage) {
      this.progress = Math.min(this.progress + dt * 0.65, 0.92);
      this.redraw();
    }
  }

  private async load(): Promise<void> {
    try {
      await data.loadAll();
      save.init(data.levels);
      analytics.setUserId(save.getAccountId());
      lifecycle.init();
      audio.init();
      audio.preloadGroupsInBackground(["main"]);
      await assetManager.preloadGroups(["boot"]);
      if (this.disposed) return;
      this.redraw();
      await audio.preloadGroups(["boot", "main", "login", "bag", "battle", "ui"]);
      audio.preloadGroupsInBackground(["main", "bag", "battle"]);
      await assetManager.preloadGroups(["boot", "main", "login", "bag", "battle", "ui"]);
      if (this.disposed) return;
      analytics.track("loading_complete", { levelCount: data.levels.length });
      this.progress = 1;
      this.redraw();
      window.setTimeout(() => {
        try {
          const recoveryResult = inspectRunRecoverySnapshot(save.getAccountId());
          const recovery = recoveryResult.snapshot;
          if (recovery) {
            debugTrace("run_recovery_restore", {
              levelId: recovery.levelId,
              phase: recovery.phase,
              wave: recovery.session.currentWave,
              baseHp: Math.round(recovery.session.baseHp),
              source: recoveryResult.source ?? "",
            });
            const level = data.levels.find((row) => row.id === recovery.levelId);
            if (level) {
              showRun(level, "检测到页面刷新，已恢复上一局", recovery.bag, recovery.session);
              return;
            }
            debugTrace("run_recovery_missing_level", { levelId: recovery.levelId });
          }
          debugTrace("run_recovery_skip", { reason: recoveryResult.reason, account: save.getAccountId() });
          showLogin();
        } catch (error) {
          this.showError(error);
        }
      }, 250);
    } catch (error) {
      this.showError(error);
    }
  }

  private showError(error: unknown): void {
    console.error("LoadingScene 加载失败", error);
    this.errorMessage = error instanceof Error ? error.message : String(error);
    this.redraw();
  }

  private redraw(): void {
    this.container.removeChildren();
    drawAssetBg(this.container, "loading_background");
    const w = app.screen.width;
    const h = app.screen.height;
    const heroLayout = getUiLayout(data, "loading", "hero", {
      scene: "loading",
      key: "hero",
      anchor: "center",
      x: 0,
      y: Math.round(h * 0.43 - h / 2),
      width: 124,
      height: 92,
      iconSize: 68,
      visible: true,
      desc: "Loading 中央角色占位图中心点",
    });
    const heroPos = resolveUiLayoutPosition(heroLayout, w, h);
    const hero = new Graphics();
    hero.circle(heroPos.x, heroPos.y, (heroLayout.iconSize ?? 68) / 2).fill({ color: 0xff5b5b }).stroke({ color: 0xffffff, width: 4, alpha: 0.55 });
    hero.roundRect(heroPos.x - heroLayout.width / 2, heroPos.y + (heroLayout.iconSize ?? 68) / 2, heroLayout.width, 24, 12).fill({ color: 0x1f2b39 });

    const barLayout = getUiLayout(data, "loading", "progress_fill", {
      scene: "loading",
      key: "progress_fill",
      anchor: "center",
      x: 0,
      y: Math.round(h * 0.56 - h / 2 + 12),
      width: Math.round(w * 0.68),
      height: 24,
      visible: true,
      desc: "Loading 进度条区域",
    });
    this.bar.clear();
    this.bar.removeChildren();
    this.drawProgressBar();

    const labelLayout = getUiLayout(data, "loading", "label", {
      scene: "loading",
      key: "label",
      anchor: "center",
      x: 0,
      y: Math.round(h * 0.62 - h / 2),
      width: 320,
      height: 36,
      fontSize: 24,
      visible: true,
      desc: "Loading 文本中心点",
    });
    const labelPos = resolveUiLayoutPosition(labelLayout, w, h);
    this.label.anchor.set(0.5);
    this.label.style.fontSize = labelLayout.fontSize ?? 24;
    this.label.position.set(labelPos.x, labelPos.y);
    if (heroLayout.visible) this.container.addChild(hero);
    if (barLayout.visible) this.container.addChild(this.bar);
    if (labelLayout.visible) this.container.addChild(this.label);
    if (this.errorMessage) {
      const errorLayout = getUiLayout(data, "loading", "error_text", {
        scene: "loading",
        key: "error_text",
        anchor: "center",
        x: 0,
        y: Math.round(h * 0.7 - h / 2),
        width: Math.min(520, w * 0.86),
        height: 80,
        fontSize: 16,
        visible: true,
        desc: "Loading 错误文本中心点",
      });
      if (!errorLayout.visible) return;
      const errorText = text(`加载失败：${this.errorMessage}`, errorLayout.fontSize ?? 16, "#ffefef", "700");
      errorText.style.wordWrapWidth = Math.min(errorLayout.width, w * 0.86);
      errorText.anchor.set(0.5);
      const errorPos = resolveUiLayoutPosition(errorLayout, w, h);
      errorText.position.set(errorPos.x, errorPos.y);
      this.container.addChild(errorText);
    }
  }

  private drawProgressBar(): void {
    const w = app.screen.width;
    const h = app.screen.height;
    const layer = new Container();
    const groupLayout = getUiLayout(data, "loading", "progress_group", {
      scene: "loading",
      key: "progress_group",
      anchor: "bottomCenter",
      x: 0,
      y: 0,
      width: 600,
      height: 87,
      scale: 1,
      visible: true,
      desc: "Loading 进度条整体模块，x/y 是整体偏移，scale 是整体缩放",
    });
    if (!groupLayout.visible) return;

    const trackLayout = scaleUiLayoutSize(getUiLayout(data, "loading", "progress_track", {
      scene: "loading",
      key: "progress_track",
      anchor: "bottomCenter",
      x: 0,
      y: -380,
      width: 700,
      height: 258,
      scale: 1,
      visible: true,
      desc: "Loading 进度条底图",
    }));
    const fillLayout = scaleUiLayoutSize(getUiLayout(data, "loading", "progress_fill", {
      scene: "loading",
      key: "progress_fill",
      anchor: "bottomCenter",
      x: 0,
      y: -345,
      width: 600,
      height: 87,
      scale: 1,
      visible: true,
      desc: "Loading 进度条填充图",
    }));
    const thumbLayout = scaleUiLayoutSize(getUiLayout(data, "loading", "progress_thumb", {
      scene: "loading",
      key: "progress_thumb",
      anchor: "bottomCenter",
      x: 0,
      y: -379,
      width: 120,
      height: 146,
      scale: 1,
      visible: true,
      desc: "Loading 进度条滑块，x 是相对进度末端的横向微调",
    }));

    const trackRect = resolveUiLayoutRect(trackLayout, w, h);
    const track = spriteFromAsset("loading_progress_track", trackRect.width, trackRect.height);
    if (track && trackLayout.visible) {
      track.position.set(trackRect.x, trackRect.y);
      layer.addChild(track);
    }

    const fillRect = resolveUiLayoutRect(fillLayout, w, h);
    const fill = spriteFromAsset("loading_progress_fill", fillRect.width, fillRect.height) as Sprite | undefined;
    if (fill && fillLayout.visible) {
      fill.position.set(fillRect.x, fillRect.y);
      const fillMask = new Graphics();
      fillMask.rect(fillRect.x, fillRect.y, Math.max(1, fillRect.width * this.progress), fillRect.height).fill({ color: 0xffffff });
      fill.mask = fillMask;
      layer.addChild(fill, fillMask);
    }

    const thumbRect = resolveUiLayoutRect(thumbLayout, w, h);
    const thumb = spriteFromAsset("loading_progress_thumb", thumbRect.width, thumbRect.height);
    if (thumb && thumbLayout.visible) {
      const thumbCenterX = fillRect.x + fillRect.width * this.progress + thumbLayout.x;
      thumb.position.set(thumbCenterX - thumbRect.width / 2, thumbRect.y);
      layer.addChild(thumb);
    }

    const groupPivotX = fillRect.x + fillRect.width / 2;
    const groupPivotY = fillRect.y + fillRect.height / 2;
    layer.pivot.set(groupPivotX, groupPivotY);
    layer.position.set(groupPivotX + groupLayout.x, groupPivotY + groupLayout.y);
    layer.scale.set(groupLayout.scale ?? 1);
    this.bar.addChild(layer);
  }
}
