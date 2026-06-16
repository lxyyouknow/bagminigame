import { Graphics } from "pixi.js";
import { analytics, app, assetManager, audio, data, lifecycle, save } from "../core/runtime";
import { showMain } from "../core/navigation";
import { drawGradientBg, text } from "../utils/display";
import { getUiLayout, resolveUiLayoutPosition, resolveUiLayoutRect } from "../ui/layout/UiLayout";
import { BaseScene } from "./BaseScene";

export class LoadingScene extends BaseScene {
  private progress = 0;
  private bar = new Graphics();
  private label = text("Loading ...", 24, "#ffffff", "700");
  private errorMessage = "";

  constructor() {
    super();
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
      audio.preloadGroups(["boot", "main", "ui"]);
      await assetManager.preloadGroups(["boot", "main", "bag", "battle", "ui"]);
      if (this.disposed) return;
      analytics.track("loading_complete", { levelCount: data.levels.length });
      this.progress = 1;
      this.redraw();
      window.setTimeout(() => {
        try {
          showMain();
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
    drawGradientBg(this.container, "green");
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

    const barLayout = getUiLayout(data, "loading", "progress_bar", {
      scene: "loading",
      key: "progress_bar",
      anchor: "center",
      x: 0,
      y: Math.round(h * 0.56 - h / 2 + 12),
      width: Math.round(w * 0.68),
      height: 24,
      visible: true,
      desc: "Loading 进度条区域",
    });
    const barRect = resolveUiLayoutRect(barLayout, w, h);
    this.bar.clear();
    this.bar.roundRect(barRect.x, barRect.y, barRect.width, barRect.height, 12).fill({ color: 0x111822 });
    this.bar.roundRect(barRect.x, barRect.y, barRect.width * this.progress, barRect.height, 12).fill({ color: 0x45f0c2 });
    this.bar.stroke({ color: 0xffffff, width: 2, alpha: 0.35 });

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
}
