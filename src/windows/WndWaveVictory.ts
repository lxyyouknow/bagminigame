import { Container, Graphics, Rectangle } from "pixi.js";
import { app, data } from "../core/runtime";
import { spriteFromUi, text, uiButton } from "../utils/display";
import { getUiLayout, resolveUiLayoutPosition, resolveUiLayoutRect, scaleUiLayoutSize } from "../ui/layout/UiLayout";
import { GameWindow } from "./GameWindow";

export class WndWaveVictory extends GameWindow {
  private accepted = false;
  private readonly popup = new Container();
  private popElapsed = 0;
  private readonly popDuration = 0.68;

  constructor(rewardGold: number, onContinue: () => void) {
    super();
    const w = app.screen.width;
    const h = app.screen.height;
    this.container.addChild(new Graphics().rect(0, 0, w, h).fill({ color: 0x080706, alpha: 0.58 }));
    this.popup.position.set(w / 2, h / 2);
    this.popup.scale.set(0.2);
    this.popup.alpha = 0;
    this.container.addChild(this.popup);

    const panelLayout = scaleUiLayoutSize(this.layout("panel", {
      scene: "wave_victory",
      key: "panel",
      anchor: "center",
      x: 0,
      y: -18,
      width: 700,
      height: 649,
      scale: 0.86,
      visible: true,
      desc: "Single wave victory panel image",
    }));
    if (panelLayout.visible) {
      const panelRect = resolveUiLayoutRect(panelLayout, w, h);
      const panel = spriteFromUi("wave_victory_panel", panelRect.width, panelRect.height);
      if (panel) {
        panel.position.set(panelRect.x - w / 2, panelRect.y - h / 2);
        this.popup.addChild(panel);
      }
    }

    const coinLayout = scaleUiLayoutSize(this.layout("coin_value", {
      scene: "wave_victory",
      key: "coin_value",
      anchor: "center",
      x: 44,
      y: 93,
      width: 220,
      height: 52,
      fontSize: 38,
      textColor: "#fff2a8",
      strokeColor: "#7a3511",
      strokeWidth: 5,
      scale: 1,
      visible: true,
      desc: "Single wave reward gold text",
    }));
    if (coinLayout.visible) {
      const reward = text(`+${rewardGold}`, coinLayout.fontSize ?? 38, coinLayout.textColor ?? "#fff2a8", "700", {
        strokeColor: coinLayout.strokeColor ?? "#7a3511",
        strokeWidth: coinLayout.strokeWidth ?? 5,
      });
      reward.anchor.set(0.5);
      const rewardPos = resolveUiLayoutPosition(coinLayout, w, h);
      reward.position.set(rewardPos.x - w / 2, rewardPos.y - h / 2);
      this.popup.addChild(reward);
    }

    const buttonLayout = scaleUiLayoutSize(this.layout("continue_button", {
      scene: "wave_victory",
      key: "continue_button",
      anchor: "center",
      x: 0,
      y: 251,
      width: 300,
      height: 89,
      scale: 1,
      visible: true,
      desc: "Single wave victory continue button",
    }));
    if (buttonLayout.visible) {
      const buttonRect = resolveUiLayoutRect(buttonLayout, w, h);
      const button = uiButton("wave_victory_continue_button", "", buttonRect.width, buttonRect.height, 0xffc23d, () => {
        if (this.accepted) return;
        this.accepted = true;
        onContinue();
      });
      button.position.set(buttonRect.x - w / 2, buttonRect.y - h / 2);
      button.hitArea = new Rectangle(0, 0, buttonRect.width, buttonRect.height);
      this.popup.addChild(button);
    }
  }

  override update(dt: number): void {
    this.popElapsed = Math.min(this.popDuration, this.popElapsed + Math.max(0, dt));
    const t = this.popElapsed / this.popDuration;
    const scale = this.popScale(t);
    this.popup.scale.set(scale);
    this.popup.alpha = Math.min(1, t / 0.16);
  }

  private popScale(t: number): number {
    if (t < 0.52) {
      const p = t / 0.52;
      return 0.16 + (1.16 - 0.16) * this.easeOutBack(p, 2.35);
    }
    if (t < 0.78) {
      const p = (t - 0.52) / 0.26;
      return 1.16 + (0.96 - 1.16) * this.easeOutCubic(p);
    }
    const p = (t - 0.78) / 0.22;
    return 0.96 + (1 - 0.96) * this.easeOutBack(p, 1.15);
  }

  private easeOutBack(value: number, strength = 1.70158): number {
    const c1 = strength;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(value - 1, 3) + c1 * Math.pow(value - 1, 2);
  }

  private easeOutCubic(value: number): number {
    return 1 - Math.pow(1 - Math.min(1, Math.max(0, value)), 3);
  }

  private layout(key: string, defaults: Parameters<typeof getUiLayout>[3]) {
    return getUiLayout(data, "wave_victory", key, defaults);
  }
}
