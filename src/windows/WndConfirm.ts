import { Graphics } from "pixi.js";
import type { ComStrDef } from "../types";
import { app, data } from "../core/runtime";
import { glossyButton, text } from "../utils/display";
import { getUiLayout, resolveUiLayoutPosition, resolveUiLayoutRect } from "../ui/layout/UiLayout";
import { GameWindow } from "./GameWindow";

export class WndConfirm extends GameWindow {
  constructor(config: ComStrDef, onConfirm: () => void, onCancel: () => void) {
    super();
    const w = app.screen.width;
    const h = app.screen.height;
    const shade = new Graphics().rect(0, 0, w, h).fill({ color: 0x000000, alpha: 0.68 });
    const panelLayout = this.layout("panel", { scene: "confirm", key: "panel", anchor: "center", x: 0, y: Math.round(h * 0.26 + 125 - h / 2), width: Math.min(w - 52, 560), height: 250, visible: true, desc: "确认弹窗面板" });
    const panelRect = resolveUiLayoutRect(panelLayout, w, h);
    const x = panelRect.x;
    const y = panelRect.y;
    const panelW = panelRect.width;
    const panelH = panelRect.height;
    const panel = new Graphics();
    panel.roundRect(x, y, panelW, panelH, 12).fill({ color: 0xf3f3f3 }).stroke({ color: 0x1a1a1a, width: 3, alpha: 0.45 });
    panel.rect(x, y, panelW, 6).fill({ color: 0xff7c1f });
    const titleLayout = this.layout("title", { scene: "confirm", key: "title", anchor: "center", x: -105, y: Math.round(y - 10 - h / 2), width: 230, height: 58, fontSize: 25, visible: true, desc: "确认弹窗标题" });
    const titleRect = resolveUiLayoutRect(titleLayout, w, h);
    const titlePos = resolveUiLayoutPosition(titleLayout, w, h);
    const titleBg = new Graphics();
    titleBg.roundRect(titleRect.x, titleRect.y, titleLayout.width, titleLayout.height, 14).fill({ color: 0x252525 });
    titleBg.rect(titleRect.x + 81, titleRect.y + 12, 130, 24).fill({ color: 0xff7c1f, alpha: 0.26 });
    const title = text(config.title, titleLayout.fontSize ?? 25, "#ffffff", "700");
    title.anchor.set(0, 0.5);
    title.position.set(titlePos.x - 34, titlePos.y);
    const iconLayout = this.layout("icon", { scene: "confirm", key: "icon", anchor: "center", x: -139, y: Math.round(y - 10 - h / 2), width: 68, height: 68, visible: true, desc: "确认弹窗标题图标" });
    const iconPos = resolveUiLayoutPosition(iconLayout, w, h);
    const icon = new Graphics();
    icon.circle(iconPos.x, iconPos.y, iconLayout.width / 2).fill({ color: 0x4b4b4b }).stroke({ color: 0x111111, width: 4 });
    icon.moveTo(iconPos.x - 16, iconPos.y).lineTo(iconPos.x + 16, iconPos.y).stroke({ color: 0xffffff, width: 7 });
    icon.moveTo(iconPos.x, iconPos.y - 16).lineTo(iconPos.x, iconPos.y + 16).stroke({ color: 0xffffff, width: 7 });
    const contentLayout = this.layout("content", { scene: "confirm", key: "content", anchor: "center", x: 0, y: Math.round(y + 96 - h / 2), width: panelW - 88, height: 90, fontSize: 22, visible: true, desc: "确认弹窗内容" });
    const contentPos = resolveUiLayoutPosition(contentLayout, w, h);
    const content = text(config.content, contentLayout.fontSize ?? 22, "#30343a", "700");
    content.style.align = "left";
    content.style.wordWrapWidth = contentLayout.width;
    content.anchor.set(0, 0.5);
    content.position.set(contentPos.x - contentLayout.width / 2, contentPos.y);
    const cancelLayout = this.layout("cancel_button", { scene: "confirm", key: "cancel_button", anchor: "center", x: -83, y: Math.round(y + 199 - h / 2), width: 168, height: 58, fontSize: 24, visible: true, desc: "确认弹窗取消按钮" });
    const confirmLayout = this.layout("confirm_button", { scene: "confirm", key: "confirm_button", anchor: "center", x: 83, y: Math.round(y + 199 - h / 2), width: 168, height: 58, fontSize: 24, visible: true, desc: "确认弹窗确认按钮" });
    const cancel = glossyButton(config.cancelText, cancelLayout.width, cancelLayout.height, 0x2ebaf0, onCancel, cancelLayout.fontSize ?? 24);
    const confirm = glossyButton(config.confirmText, confirmLayout.width, confirmLayout.height, 0xffc23d, onConfirm, confirmLayout.fontSize ?? 24);
    const cancelRect = resolveUiLayoutRect(cancelLayout, w, h);
    const confirmRect = resolveUiLayoutRect(confirmLayout, w, h);
    cancel.position.set(cancelRect.x, cancelRect.y);
    confirm.position.set(confirmRect.x, confirmRect.y);
    this.container.addChild(shade);
    if (panelLayout.visible) this.container.addChild(panel);
    if (titleLayout.visible) this.container.addChild(titleBg, title);
    if (iconLayout.visible) this.container.addChild(icon);
    if (contentLayout.visible) this.container.addChild(content);
    if (cancelLayout.visible) this.container.addChild(cancel);
    if (confirmLayout.visible) this.container.addChild(confirm);
  }

  private layout(key: string, defaults: Parameters<typeof getUiLayout>[3]) {
    return getUiLayout(data, "confirm", key, defaults);
  }
}
