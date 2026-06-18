import { Graphics } from "pixi.js";
import type { LevelDef } from "../types";
import { app, assetManager, audio } from "../core/runtime";
import { showMain, showRun } from "../core/navigation";
import { button, text } from "../utils/display";
import { BaseScene } from "./BaseScene";

export class LevelLoadingScene extends BaseScene {
  private progress = 0;
  private elapsed = 0;
  private ready = false;
  private errorMessage = "";

  constructor(private readonly level: LevelDef, private readonly entryToast?: string) {
    super();
    this.draw();
    void this.load();
  }

  override update(dt: number): void {
    this.elapsed += dt;
    if (!this.ready && !this.errorMessage) {
      this.progress = Math.min(0.92, this.progress + dt * 1.45);
      this.draw();
      return;
    }
    if (this.ready && this.elapsed >= 0.65) {
      this.progress = 1;
      this.draw();
      showRun(this.level, this.entryToast);
    }
  }

  private async load(): Promise<void> {
    try {
      audio.preloadGroups(["bag", "battle", "ui"]);
      await assetManager.preloadGroups(["bag", "battle", "ui"]);
      if (!this.disposed) this.ready = true;
    } catch (error) {
      if (this.disposed) return;
      console.error("关卡 Loading 加载失败", error);
      this.errorMessage = error instanceof Error ? error.message : String(error);
      this.draw();
    }
  }

  private draw(): void {
    this.container.removeChildren();
    const w = app.screen.width;
    const h = app.screen.height;
    const background = new Graphics();
    background.rect(0, 0, w, h).fill({ color: 0xf2a184 });
    for (let y = -40; y < h + 80; y += 120) {
      for (let x = -30; x < w + 80; x += 140) {
        const offsetX = ((y / 120) % 2) * 48;
        background.ellipse(x + offsetX, y, 42, 18).fill({ color: 0xffc0a4, alpha: 0.3 });
        background.ellipse(x + 28 + offsetX, y + 18, 30, 12).fill({ color: 0xe98570, alpha: 0.16 });
      }
    }

    const title = text(this.level.name, 26, "#fff5ee", "700");
    title.anchor.set(0.5);
    title.position.set(w / 2, h * 0.39);

    const bar = new Graphics();
    const barW = Math.min(360, w * 0.68);
    const barX = (w - barW) / 2;
    const barY = h * 0.54;
    bar.roundRect(barX, barY, barW, 24, 12).fill({ color: 0x171719, alpha: 0.96 });
    bar.roundRect(barX + 3, barY + 3, Math.max(0, (barW - 6) * this.progress), 18, 9).fill({ color: 0x3ce8ca });
    bar.stroke({ color: 0x5a2926, width: 2, alpha: 0.45 });

    const runner = new Graphics();
    const runnerX = barX + Math.max(18, (barW - 36) * this.progress);
    runner.circle(runnerX, barY - 18, 16).fill({ color: 0xf8d1b2 }).stroke({ color: 0x5b2833, width: 3 });
    runner.roundRect(runnerX - 18, barY - 10, 36, 32, 10).fill({ color: 0xa9273d }).stroke({ color: 0x5b2833, width: 3 });
    runner.moveTo(runnerX - 14, barY + 18).lineTo(runnerX - 28, barY + 28).stroke({ color: 0x5b2833, width: 5 });
    runner.moveTo(runnerX + 14, barY + 18).lineTo(runnerX + 28, barY + 28).stroke({ color: 0x5b2833, width: 5 });

    const label = text(this.errorMessage ? `加载失败：${this.errorMessage}` : `Loading... ${Math.round(this.progress * 100)}%`, this.errorMessage ? 18 : 22, this.errorMessage ? "#ffdddd" : "#ffffff", "700");
    label.anchor.set(0.5);
    label.position.set(w / 2, barY + 62);
    this.container.addChild(background, title, bar, runner, label);

    if (this.errorMessage) {
      const back = button("返回主界面", 180, 60, 0x596b78, () => showMain());
      back.position.set((w - 180) / 2, barY + 105);
      this.container.addChild(back);
    }
  }
}
