import { Graphics } from "pixi.js";
import type { ComStrDef } from "../types";
import { app } from "../core/runtime";
import { glossyButton, text } from "../utils/display";
import { GameWindow } from "./GameWindow";

export class WndConfirm extends GameWindow {
  constructor(config: ComStrDef, onConfirm: () => void, onCancel: () => void) {
    super();
    const w = app.screen.width;
    const h = app.screen.height;
    const shade = new Graphics().rect(0, 0, w, h).fill({ color: 0x000000, alpha: 0.68 });
    const panelW = Math.min(w - 52, 560);
    const panelH = 250;
    const x = (w - panelW) / 2;
    const y = h * 0.26;
    const panel = new Graphics();
    panel.roundRect(x, y, panelW, panelH, 12).fill({ color: 0xf3f3f3 }).stroke({ color: 0x1a1a1a, width: 3, alpha: 0.45 });
    panel.rect(x, y, panelW, 6).fill({ color: 0xff7c1f });
    const titleBg = new Graphics();
    titleBg.roundRect(x + 14, y - 38, 230, 58, 14).fill({ color: 0x252525 });
    titleBg.rect(x + 95, y - 26, 130, 24).fill({ color: 0xff7c1f, alpha: 0.26 });
    const title = text(config.title, 25, "#ffffff", "700");
    title.anchor.set(0, 0.5);
    title.position.set(x + 76, y - 10);
    const icon = new Graphics();
    icon.circle(x + 42, y - 10, 34).fill({ color: 0x4b4b4b }).stroke({ color: 0x111111, width: 4 });
    icon.moveTo(x + 26, y - 10).lineTo(x + 58, y - 10).stroke({ color: 0xffffff, width: 7 });
    icon.moveTo(x + 42, y - 26).lineTo(x + 42, y + 6).stroke({ color: 0xffffff, width: 7 });
    const content = text(config.content, 22, "#30343a", "700");
    content.style.align = "left";
    content.style.wordWrapWidth = panelW - 88;
    content.anchor.set(0, 0.5);
    content.position.set(x + 58, y + 96);
    const cancel = glossyButton(config.cancelText, 168, 58, 0x2ebaf0, onCancel, 24);
    const confirm = glossyButton(config.confirmText, 168, 58, 0xffc23d, onConfirm, 24);
    cancel.position.set(x + 48, y + 170);
    confirm.position.set(x + panelW - 216, y + 170);
    this.container.addChild(shade, panel, titleBg, icon, title, content, cancel, confirm);
  }
}
