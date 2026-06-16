import { Graphics } from "pixi.js";
import type { LevelDef } from "../types";
import { app, data } from "../core/runtime";
import { glossyButton, iconButton, text } from "../utils/display";
import { getUiLayout, resolveUiLayoutPosition, resolveUiLayoutRect } from "../ui/layout/UiLayout";
import { GameWindow } from "./GameWindow";
import { WndConfirm } from "./WndConfirm";
import { WndSetting } from "./WndSetting";

export class WndPause extends GameWindow {
  private childWindow: GameWindow | undefined;

  constructor(
    level: LevelDef,
    kills: number,
    gold: number,
    onContinue: () => void,
    onExit: () => void,
  ) {
    super();
    const w = app.screen.width;
    const h = app.screen.height;
    this.container.addChild(new Graphics().rect(0, 0, w, h).fill({ color: 0x05070c, alpha: 0.78 }));
    const titleLayout = this.layout("title", {
      scene: "pause",
      key: "title",
      anchor: "center",
      x: 0,
      y: Math.round(h * 0.245 - h / 2),
      width: 260,
      height: 72,
      fontSize: 32,
      visible: true,
      desc: "暂停弹窗标题区域",
    });
    const titlePos = resolveUiLayoutPosition(titleLayout, w, h);
    const titleRect = resolveUiLayoutRect(titleLayout, w, h);
    const titleBg = new Graphics();
    titleBg.roundRect(titleRect.x, titleRect.y, titleLayout.width, 56, 26).fill({ color: 0xff841b });
    titleBg.roundRect(titlePos.x - 70, titleRect.y + 15, 132, 36, 18).fill({ color: 0xffc33a, alpha: 0.55 });
    const deco = new Graphics();
    deco.circle(titlePos.x - 158, titlePos.y - 4, 11).fill({ color: 0xc6ff68 });
    deco.roundRect(titlePos.x - 136, titlePos.y - 8, 82, 18, 9).fill({ color: 0xc6ff68 });
    deco.circle(titlePos.x + 152, titlePos.y - 4, 14).fill({ color: 0xffb52a });
    const title = text("暂停", titleLayout.fontSize ?? 32, "#ffffff", "700");
    title.anchor.set(0.5);
    title.position.set(titlePos.x, titlePos.y);

    const panelLayout = this.layout("panel", {
      scene: "pause",
      key: "panel",
      anchor: "center",
      x: 0,
      y: Math.round(h * 0.36 + 155 - h / 2),
      width: w - 44,
      height: 310,
      visible: true,
      desc: "暂停弹窗内容面板",
    });
    const panelRect = resolveUiLayoutRect(panelLayout, w, h);
    const panel = new Graphics();
    panel.roundRect(panelRect.x, panelRect.y, panelRect.width, panelRect.height, 14).fill({ color: 0x252525, alpha: 0.94 }).stroke({ color: 0x777777, width: 3, alpha: 0.72 });
    panel.roundRect(panelRect.x + 30, panelRect.y + 15, panelRect.width - 60, 44, 8).fill({ color: 0x444444 });
    const active = text("已启动特性", 23, "#ffffff", "700");
    active.anchor.set(0.5);
    active.position.set(panelRect.x + panelRect.width / 2, panelRect.y + 37);
    const infoLayout = this.layout("info", {
      scene: "pause",
      key: "info",
      anchor: "center",
      x: 0,
      y: 0,
      width: 330,
      height: 90,
      fontSize: 18,
      visible: true,
      desc: "暂停弹窗关卡和本局数据文本",
    });
    const infoPos = resolveUiLayoutPosition(infoLayout, w, h);
    const empty = text(`当前关卡：${level.name}\n本局杀敌：${kills}    当前金币：${gold}`, infoLayout.fontSize ?? 18, "#d8d8d8", "700");
    empty.anchor.set(0.5);
    empty.position.set(infoPos.x, infoPos.y);

    const homeLayout = this.layout("home_button", { scene: "pause", key: "home_button", anchor: "bottomLeft", x: 72, y: Math.round(h * 0.77 - h), width: 70, height: 64, fontSize: 30, visible: true, desc: "暂停弹窗回主界面按钮" });
    const contLayout = this.layout("continue_button", { scene: "pause", key: "continue_button", anchor: "bottomCenter", x: 0, y: Math.round(h * 0.77 - h), width: 178, height: 64, fontSize: 24, visible: true, desc: "暂停弹窗继续挑战按钮" });
    const settingLayout = this.layout("setting_button", { scene: "pause", key: "setting_button", anchor: "bottomRight", x: -142, y: Math.round(h * 0.77 - h), width: 70, height: 64, fontSize: 30, visible: true, desc: "暂停弹窗设置按钮" });
    const home = iconButton("⌂", 0x33d7ad, () => this.openConfirm(onExit));
    const cont = glossyButton("继续挑战", contLayout.width, contLayout.height, 0xffc23d, onContinue, contLayout.fontSize ?? 24);
    const setting = iconButton("⚙", 0x33bfff, () => this.openSetting());
    const homePos = resolveUiLayoutPosition(homeLayout, w, h);
    const contRect = resolveUiLayoutRect(contLayout, w, h);
    const settingPos = resolveUiLayoutPosition(settingLayout, w, h);
    home.position.set(homePos.x, homePos.y);
    cont.position.set(contRect.x, contRect.y);
    setting.position.set(settingPos.x, settingPos.y);
    if (titleLayout.visible) this.container.addChild(titleBg, deco, title);
    if (panelLayout.visible) this.container.addChild(panel, active);
    if (infoLayout.visible) this.container.addChild(empty);
    if (homeLayout.visible) this.container.addChild(home);
    if (contLayout.visible) this.container.addChild(cont);
    if (settingLayout.visible) this.container.addChild(setting);
  }

  private layout(key: string, defaults: Parameters<typeof getUiLayout>[3]) {
    return getUiLayout(data, "pause", key, defaults);
  }

  private openConfirm(onExit: () => void): void {
    this.childWindow?.destroy();
    this.childWindow = new WndConfirm(data.getComStr(1), onExit, () => {
      this.childWindow?.destroy();
      this.childWindow = undefined;
    });
    this.container.addChild(this.childWindow.container);
  }

  private openSetting(): void {
    this.childWindow?.destroy();
    this.childWindow = new WndSetting(() => {
      this.childWindow?.destroy();
      this.childWindow = undefined;
    });
    this.container.addChild(this.childWindow.container);
  }
}
