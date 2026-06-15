import { Container, Graphics } from "pixi.js";
import type { LevelDef } from "../types";
import { app } from "../core/runtime";
import { glossyButton, spriteFromUi, text } from "../utils/display";
import { GameWindow } from "./GameWindow";

export class WndResult extends GameWindow {
  constructor(level: LevelDef, win: boolean, kills: number, gold: number, wave: number, onConfirm: () => void) {
    super();
    const w = app.screen.width;
    const h = app.screen.height;
    this.container.addChild(new Graphics().rect(0, 0, w, h).fill({ color: 0x070910, alpha: 0.82 }));
    const ghost = new Graphics();
    ghost.circle(w / 2, h * 0.17, 62).fill({ color: win ? 0xffd95a : 0xb9b9b9, alpha: 0.38 }).stroke({ color: 0xffffff, width: 5, alpha: 0.7 });
    ghost.moveTo(w / 2 - 28, h * 0.16).lineTo(w / 2 - 8, h * 0.19).lineTo(w / 2 + 26, h * 0.13).stroke({ color: 0xffffff, width: 7, alpha: 0.8 });
    const title = text(`${level.name}   ${wave}/${level.winWave}波`, 24, "#ffffff", "700");
    title.anchor.set(0.5);
    title.position.set(w / 2, h * 0.28);
    const titleBg = new Graphics().roundRect(w / 2 - 160, h * 0.25, 320, 48, 24).fill({ color: 0xbfbfbf, alpha: 0.62 });

    const panel = new Graphics();
    panel.roundRect(0, h * 0.36, w, 310, 14).fill({ color: 0x252525, alpha: 0.94 }).stroke({ color: 0x777777, width: 3, alpha: 0.72 });
    panel.roundRect(18, h * 0.375, w - 36, 44, 8).fill({ color: 0xe54a23 });
    const rewardTitle = text("获得奖励", 24, "#ffffff", "700");
    rewardTitle.anchor.set(0.5);
    rewardTitle.position.set(w / 2, h * 0.375 + 22);
    const expCard = this.rewardCard("EXP", kills * 12, 0xb53cff, "result_exp_icon");
    const coinCard = this.rewardCard("★", Math.max(20, gold), 0x46cf58, "result_coin_icon");
    expCard.position.set(36, h * 0.46);
    coinCard.position.set(148, h * 0.46);
    const resultText = text(win ? "挑战完成" : "挑战结束", 26, win ? "#ffdf59" : "#cccccc", "700");
    resultText.anchor.set(0.5);
    resultText.position.set(w / 2, h * 0.33);
    const ok = glossyButton("确定", 176, 64, 0xffc23d, onConfirm, 26);
    ok.position.set((w - 176) / 2, h * 0.82);
    this.container.addChild(ghost, titleBg, title, resultText, panel, rewardTitle, expCard, coinCard, ok);
  }

  private rewardCard(label: string, value: number, bg: number, uiKey: string): Container {
    const c = new Container();
    const g = new Graphics().roundRect(0, 0, 88, 88, 9).fill({ color: bg }).stroke({ color: 0xffffff, width: 3, alpha: 0.55 });
    const icon = spriteFromUi(uiKey, 54, 54);
    if (icon) {
      icon.anchor.set(0.5);
      icon.position.set(44, 34);
    }
    const l = text(label, 28, "#ffffff", "700");
    l.anchor.set(0.5);
    l.position.set(44, 34);
    const v = text(String(value), 20, "#ffffff", "700");
    v.anchor.set(0.5);
    v.position.set(58, 66);
    c.addChild(g);
    if (icon) c.addChild(icon);
    else c.addChild(l);
    c.addChild(v);
    return c;
  }
}
