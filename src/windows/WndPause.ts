import { Graphics } from "pixi.js";
import type { LevelDef } from "../types";
import { app, data } from "../core/runtime";
import { glossyButton, iconButton, text } from "../utils/display";
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
    const titleBg = new Graphics();
    titleBg.roundRect(w / 2 - 130, h * 0.21, 260, 56, 26).fill({ color: 0xff841b });
    titleBg.roundRect(w / 2 - 70, h * 0.23, 132, 36, 18).fill({ color: 0xffc33a, alpha: 0.55 });
    const deco = new Graphics();
    deco.circle(w / 2 - 158, h * 0.24, 11).fill({ color: 0xc6ff68 });
    deco.roundRect(w / 2 - 136, h * 0.235, 82, 18, 9).fill({ color: 0xc6ff68 });
    deco.circle(w / 2 + 152, h * 0.24, 14).fill({ color: 0xffb52a });
    const title = text("暂停", 32, "#ffffff", "700");
    title.anchor.set(0.5);
    title.position.set(w / 2, h * 0.245);

    const panel = new Graphics();
    panel.roundRect(22, h * 0.36, w - 44, 310, 14).fill({ color: 0x252525, alpha: 0.94 }).stroke({ color: 0x777777, width: 3, alpha: 0.72 });
    panel.roundRect(52, h * 0.38, w - 104, 44, 8).fill({ color: 0x444444 });
    const active = text("已启动特性", 23, "#ffffff", "700");
    active.anchor.set(0.5);
    active.position.set(w / 2, h * 0.38 + 22);
    const empty = text(`当前关卡：${level.name}\n本局杀敌：${kills}    当前金币：${gold}`, 18, "#d8d8d8", "700");
    empty.anchor.set(0.5);
    empty.position.set(w / 2, h * 0.5);

    const home = iconButton("⌂", 0x33d7ad, () => this.openConfirm(onExit));
    const cont = glossyButton("继续挑战", 178, 64, 0xffc23d, onContinue, 24);
    const setting = iconButton("⚙", 0x33bfff, () => this.openSetting());
    home.position.set(72, h * 0.77);
    cont.position.set((w - 178) / 2, h * 0.77);
    setting.position.set(w - 142, h * 0.77);
    this.container.addChild(titleBg, deco, title, panel, active, empty, home, cont, setting);
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
