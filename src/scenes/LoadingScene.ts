import { Graphics } from "pixi.js";
import { app, assetManager, audio, data } from "../core/runtime";
import { showMain } from "../core/navigation";
import { drawGradientBg, text } from "../utils/display";
import { BaseScene } from "./BaseScene";

export class LoadingScene extends BaseScene {
  private progress = 0;
  private bar = new Graphics();
  private label = text("Loading ...", 24, "#ffffff", "700");

  constructor() {
    super();
    this.redraw();
    void this.load();
  }

  override update(dt: number): void {
    this.progress = Math.min(this.progress + dt * 0.65, 0.92);
    this.redraw();
  }

  private async load(): Promise<void> {
    await data.loadAll();
    audio.init();
    audio.preloadGroups(["boot", "main", "ui"]);
    await assetManager.preloadGroups(["boot", "main", "bag", "battle", "ui"]);
    if (this.disposed) return;
    this.progress = 1;
    this.redraw();
    window.setTimeout(() => showMain(), 250);
  }

  private redraw(): void {
    this.container.removeChildren();
    drawGradientBg(this.container, "green");
    const w = app.screen.width;
    const h = app.screen.height;
    const hero = new Graphics();
    hero.circle(w / 2, h * 0.43, 34).fill({ color: 0xff5b5b }).stroke({ color: 0xffffff, width: 4, alpha: 0.55 });
    hero.roundRect(w / 2 - 62, h * 0.43 + 34, 124, 24, 12).fill({ color: 0x1f2b39 });

    this.bar.clear();
    this.bar.roundRect(w * 0.16, h * 0.56, w * 0.68, 24, 12).fill({ color: 0x111822 });
    this.bar.roundRect(w * 0.16, h * 0.56, w * 0.68 * this.progress, 24, 12).fill({ color: 0x45f0c2 });
    this.bar.stroke({ color: 0xffffff, width: 2, alpha: 0.35 });
    this.label.anchor.set(0.5);
    this.label.position.set(w / 2, h * 0.62);
    this.container.addChild(hero, this.bar, this.label);
  }
}
