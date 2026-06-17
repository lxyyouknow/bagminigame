import { AnimatedSprite, Graphics } from "pixi.js";
import { app, assetManager, data } from "../core/runtime";
import { drawGradientBg, glossyButton, text } from "../utils/display";
import { BaseScene } from "./BaseScene";

export class AnimationTestScene extends BaseScene {
  private readonly animKey = new URLSearchParams(window.location.search).get("animtest") || "fx_merge_test";
  private elapsed = 0;
  private status = "正在加载动画测试资源...";
  private fx?: AnimatedSprite;

  constructor() {
    super();
    this.draw();
    void this.load();
  }

  override update(dt: number): void {
    this.elapsed += dt;
    const pulse = 1 + Math.sin(this.elapsed * 4) * 0.03;
    if (this.fx) this.fx.scale.set(1.45 * pulse);
  }

  private async load(): Promise<void> {
    try {
      await data.loadAll();
      await assetManager.preloadGroups(["battle"]);
      if (this.disposed) return;
      this.status = "帧动画加载完成：点击角色可重播";
      this.draw();
    } catch (error) {
      console.error("帧动画测试加载失败", error);
      this.status = `加载失败：${error instanceof Error ? error.message : String(error)}`;
      this.draw();
    }
  }

  private draw(): void {
    this.container.removeChildren();
    drawGradientBg(this.container, "steel");

    const w = app.screen.width;
    const h = app.screen.height;
    const anim = data.getAnimation(this.animKey);

    const title = text("帧动画生成测试", 30, "#ffffff", "700");
    title.anchor.set(0.5);
    title.position.set(w / 2, 84);

    const sub = text(this.status, 17, "#d8fff7", "700");
    sub.anchor.set(0.5);
    sub.position.set(w / 2, 124);

    const stage = new Graphics();
    stage.roundRect(w / 2 - 150, h / 2 - 150, 300, 300, 34).fill({ color: 0x0f1722, alpha: 0.72 }).stroke({ color: 0x8fffea, width: 3, alpha: 0.5 });
    stage.circle(w / 2, h / 2 + 62, 68).fill({ color: 0x000000, alpha: 0.24 });

    this.container.addChild(stage, title, sub);

    const sprite = assetManager.animation(this.animKey);
    if (sprite) {
      this.fx = sprite;
      sprite.position.set(w / 2, h / 2);
      sprite.eventMode = "static";
      sprite.cursor = "pointer";
      sprite.on("pointertap", () => {
        sprite.gotoAndPlay(0);
      });
      sprite.play();
      this.container.addChild(sprite);
    } else {
      this.fx = undefined;
      const placeholder = text("等待资源加载...", 22, "#ffffff", "700");
      placeholder.anchor.set(0.5);
      placeholder.position.set(w / 2, h / 2);
      this.container.addChild(placeholder);
    }

    const infoText = anim
      ? `配置：${anim.key} / ${anim.frames.length} 帧 / ${anim.fps} FPS / ${anim.loop ? "循环" : "单次"}`
      : "配置：等待 s_animation.json 加载";
    const info = text(infoText, 15, "#fff4bf", "700");
    info.anchor.set(0.5);
    info.position.set(w / 2, h / 2 + 190);
    this.container.addChild(info);

    const back = glossyButton("返回主流程", 190, 58, 0xffd44d, () => {
      window.location.href = `${window.location.pathname}`;
    }, 22);
    back.position.set(w / 2 - 95, h - 104);
    this.container.addChild(back);
  }
}
