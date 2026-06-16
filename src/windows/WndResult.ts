import { Container, Graphics } from "pixi.js";
import type { LevelDef } from "../types";
import { app, data } from "../core/runtime";
import { glossyButton, spriteFromUi, text } from "../utils/display";
import { getUiLayout, resolveUiLayoutPosition, resolveUiLayoutRect } from "../ui/layout/UiLayout";
import { GameWindow } from "./GameWindow";

export class WndResult extends GameWindow {
  constructor(level: LevelDef, win: boolean, kills: number, rewardCoin: number, wave: number, onConfirm: () => void) {
    super();
    const w = app.screen.width;
    const h = app.screen.height;
    this.container.addChild(new Graphics().rect(0, 0, w, h).fill({ color: 0x070910, alpha: 0.82 }));
    const heroLayout = this.layout("hero", { scene: "result", key: "hero", anchor: "center", x: 0, y: Math.round(h * 0.17 - h / 2), width: 124, height: 124, visible: true, desc: "结算顶部圆形图标" });
    const heroPos = resolveUiLayoutPosition(heroLayout, w, h);
    const ghost = new Graphics();
    ghost.circle(heroPos.x, heroPos.y, heroLayout.width / 2).fill({ color: win ? 0xffd95a : 0xb9b9b9, alpha: 0.38 }).stroke({ color: 0xffffff, width: 5, alpha: 0.7 });
    ghost.moveTo(heroPos.x - 28, heroPos.y - 8).lineTo(heroPos.x - 8, heroPos.y + 14).lineTo(heroPos.x + 26, heroPos.y - 30).stroke({ color: 0xffffff, width: 7, alpha: 0.8 });
    const titleLayout = this.layout("title", { scene: "result", key: "title", anchor: "center", x: 0, y: Math.round(h * 0.28 - h / 2), width: 320, height: 48, fontSize: 24, visible: true, desc: "结算关卡波次标题" });
    const title = text(`${level.name}   ${wave}/${level.winWave}波`, titleLayout.fontSize ?? 24, "#ffffff", "700");
    title.anchor.set(0.5);
    const titlePos = resolveUiLayoutPosition(titleLayout, w, h);
    const titleRect = resolveUiLayoutRect(titleLayout, w, h);
    title.position.set(titlePos.x, titlePos.y);
    const titleBg = new Graphics().roundRect(titleRect.x, titleRect.y, titleRect.width, titleRect.height, 24).fill({ color: 0xbfbfbf, alpha: 0.62 });

    const panelLayout = this.layout("panel", { scene: "result", key: "panel", anchor: "center", x: 0, y: Math.round(h * 0.36 + 155 - h / 2), width: w, height: 310, visible: true, desc: "结算奖励面板" });
    const panelRect = resolveUiLayoutRect(panelLayout, w, h);
    const panel = new Graphics();
    panel.roundRect(panelRect.x, panelRect.y, panelRect.width, panelRect.height, 14).fill({ color: 0x252525, alpha: 0.94 }).stroke({ color: 0x777777, width: 3, alpha: 0.72 });
    panel.roundRect(panelRect.x + 18, panelRect.y + 11, panelRect.width - 36, 44, 8).fill({ color: 0xe54a23 });
    const rewardLayout = this.layout("reward_title", { scene: "result", key: "reward_title", anchor: "center", x: 0, y: Math.round(h * 0.375 + 22 - h / 2), width: 360, height: 44, fontSize: 24, visible: true, desc: "结算获得奖励标题" });
    const rewardTitle = text("获得奖励", rewardLayout.fontSize ?? 24, "#ffffff", "700");
    rewardTitle.anchor.set(0.5);
    const rewardPos = resolveUiLayoutPosition(rewardLayout, w, h);
    rewardTitle.position.set(rewardPos.x, rewardPos.y);
    const expCard = this.rewardCard("EXP", kills * 12, 0xb53cff, "result_exp_icon");
    const coinCard = this.rewardCard("★", rewardCoin, 0x46cf58, "result_coin_icon");
    const expLayout = this.layout("exp_card", { scene: "result", key: "exp_card", anchor: "center", x: -126, y: Math.round(h * 0.46 + 44 - h / 2), width: 88, height: 88, fontSize: 20, visible: true, desc: "结算 EXP 奖励卡" });
    const coinLayout = this.layout("coin_card", { scene: "result", key: "coin_card", anchor: "center", x: -14, y: Math.round(h * 0.46 + 44 - h / 2), width: 88, height: 88, fontSize: 20, visible: true, desc: "结算金币奖励卡" });
    const expRect = resolveUiLayoutRect(expLayout, w, h);
    const coinRect = resolveUiLayoutRect(coinLayout, w, h);
    expCard.position.set(expRect.x, expRect.y);
    coinCard.position.set(coinRect.x, coinRect.y);
    const resultLayout = this.layout("result_text", { scene: "result", key: "result_text", anchor: "center", x: 0, y: Math.round(h * 0.33 - h / 2), width: 320, height: 42, fontSize: 26, visible: true, desc: "结算结果文本" });
    const resultText = text(win ? "挑战完成" : "挑战结束", resultLayout.fontSize ?? 26, win ? "#ffdf59" : "#cccccc", "700");
    resultText.anchor.set(0.5);
    const resultPos = resolveUiLayoutPosition(resultLayout, w, h);
    resultText.position.set(resultPos.x, resultPos.y);
    const okLayout = this.layout("ok_button", { scene: "result", key: "ok_button", anchor: "bottomCenter", x: 0, y: Math.round(h * 0.82 - h), width: 176, height: 64, fontSize: 26, visible: true, desc: "结算确定按钮" });
    const ok = glossyButton("确定", okLayout.width, okLayout.height, 0xffc23d, onConfirm, okLayout.fontSize ?? 26);
    const okRect = resolveUiLayoutRect(okLayout, w, h);
    ok.position.set(okRect.x, okRect.y);
    if (heroLayout.visible) this.container.addChild(ghost);
    if (titleLayout.visible) this.container.addChild(titleBg, title);
    if (resultLayout.visible) this.container.addChild(resultText);
    if (panelLayout.visible) this.container.addChild(panel);
    if (rewardLayout.visible) this.container.addChild(rewardTitle);
    if (expLayout.visible) this.container.addChild(expCard);
    if (coinLayout.visible) this.container.addChild(coinCard);
    if (okLayout.visible) this.container.addChild(ok);
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

  private layout(key: string, defaults: Parameters<typeof getUiLayout>[3]) {
    return getUiLayout(data, "result", key, defaults);
  }
}
