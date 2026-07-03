import { Container, Graphics, Rectangle } from "pixi.js";
import type { UiLayoutDef } from "../types";
import { analytics, app, audio, data } from "../core/runtime";
import { showRun } from "../core/navigation";
import { drawAssetBg, spriteFromAsset } from "../utils/display";
import { getUiLayout, resolveUiLayoutRect, scaleUiLayoutSize } from "../ui/layout/UiLayout";
import { WndSetting } from "../windows/WndSetting";
import { BaseScene } from "./BaseScene";

export class LoginScene extends BaseScene {
  private settingWindow?: WndSetting;

  constructor() {
    super();
    audio.playMusicEvent("music_main");
    this.draw();
  }

  override update(dt: number): void {
    this.settingWindow?.update(dt);
  }

  override destroy(): void {
    this.settingWindow?.destroy();
    this.settingWindow = undefined;
    super.destroy();
  }

  private draw(): void {
    this.container.removeChildren();
    drawAssetBg(this.container, "login_background");
    this.addImageButton("start_button", "login_start_game_button", {
      scene: "login",
      key: "start_button",
      anchor: "bottomCenter",
      x: 0,
      y: -278,
      width: 500,
      height: 134,
      scale: 1,
      visible: true,
      desc: "登录界面开始游戏按钮，点击直接进入第一关背包",
    }, () => this.enterBag());

    this.addImageButton("guest_button", "login_guest_button", {
      scene: "login",
      key: "guest_button",
      anchor: "bottomCenter",
      x: 0,
      y: -170,
      width: 300,
      height: 92,
      scale: 1,
      visible: true,
      desc: "登录界面游客登录按钮",
    }, () => this.enterBag());

    this.addImageButton("settings_button", "login_settings_button", {
      scene: "login",
      key: "settings_button",
      anchor: "topRight",
      x: -36,
      y: 42,
      width: 100,
      height: 97,
      scale: 1,
      visible: true,
      desc: "登录界面设置按钮",
    }, () => this.openSettings());
  }

  private addImageButton(key: string, assetKey: string, defaults: UiLayoutDef, onTap: () => void): void {
    const layout = scaleUiLayoutSize(getUiLayout(data, "login", key, defaults));
    if (!layout.visible) return;
    const rect = resolveUiLayoutRect(layout, app.screen.width, app.screen.height);
    const button = new Container();
    button.position.set(rect.x + rect.width / 2, rect.y + rect.height / 2);
    button.pivot.set(rect.width / 2, rect.height / 2);
    button.eventMode = "static";
    button.cursor = "pointer";
    button.hitArea = new Rectangle(0, 0, rect.width, rect.height);

    const sprite = spriteFromAsset(assetKey, rect.width, rect.height);
    if (sprite) {
      button.addChild(sprite);
    } else {
      button.addChild(new Graphics().roundRect(0, 0, rect.width, rect.height, 16).fill({ color: 0x223c45, alpha: 0.65 }));
    }
    const restoreScale = () => button.scale.set(1);
    button.on("pointerdown", () => button.scale.set(0.95));
    button.on("pointerup", restoreScale);
    button.on("pointerupoutside", restoreScale);
    button.on("pointerout", restoreScale);
    button.on("pointercancel", restoreScale);
    button.on("pointertap", () => {
      restoreScale();
      audio.playSfxEvent("ui_click");
      onTap();
    });
    this.container.addChild(button);
  }

  private enterBag(): void {
    const level = data.levels[0];
    if (!level) return;
    analytics.track("login_start_game", { levelId: level.id });
    showRun(level);
  }

  private openSettings(): void {
    if (this.settingWindow) return;
    this.settingWindow = new WndSetting(() => {
      if (!this.settingWindow) return;
      this.container.removeChild(this.settingWindow.container);
      this.settingWindow.destroy();
      this.settingWindow = undefined;
    });
    this.container.addChild(this.settingWindow.container);
  }
}
