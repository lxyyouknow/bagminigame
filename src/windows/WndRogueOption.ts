import { Container, Graphics } from "pixi.js";
import type { RogueOptionDef } from "../types";
import { app, data } from "../core/runtime";
import { spriteFromUi, text } from "../utils/display";
import { getUiLayout, resolveUiLayoutPosition } from "../ui/layout/UiLayout";
import { GameWindow } from "./GameWindow";

export class WndRogueOption extends GameWindow {
  constructor(options: RogueOptionDef[], onPick: (option: RogueOptionDef) => void) {
    super();
    const w = app.screen.width;
    const h = app.screen.height;
    this.container.addChild(new Graphics().rect(0, 0, w, h).fill({ color: 0x000000, alpha: 0.64 }));
    const titleLayout = this.layout("title", { scene: "rogue", key: "title", anchor: "center", x: 0, y: Math.round(h * 0.28 - h / 2), width: 320, height: 40, fontSize: 28, visible: true, desc: "肉鸽三选一标题" });
    const title = text("选择强化", titleLayout.fontSize ?? 28, "#ffffff", "700");
    title.anchor.set(0.5);
    const titlePos = resolveUiLayoutPosition(titleLayout, w, h);
    title.position.set(titlePos.x, titlePos.y);
    if (titleLayout.visible) this.container.addChild(title);
    const cardsLayout = this.layout("cards", { scene: "rogue", key: "cards", anchor: "center", x: 0, y: Math.round(h * 0.38 + 95 - h / 2), width: Math.min(118, (w - 62) / 3), height: 190, gap: 10, iconSize: 54, fontSize: 16, visible: true, desc: "肉鸽三选一卡牌组，width 为单张卡宽" });
    if (!cardsLayout.visible) return;
    const cardW = Math.min(cardsLayout.width, (w - 62) / 3);
    const cardH = cardsLayout.height;
    const gap = cardsLayout.gap ?? 10;
    const total = cardW * 3 + gap * 2;
    const cardsPos = resolveUiLayoutPosition(cardsLayout, w, h);
    const startX = cardsPos.x - total / 2;
    const y = cardsPos.y - cardH / 2;
    options.forEach((option, index) => {
      const card = new Container();
      const bg = new Graphics();
      bg.roundRect(0, 0, cardW, cardH, 14).fill({ color: 0xf4f9ff }).stroke({ color: 0x54c6ff, width: 4 });
      const icon = new Container();
      const iconSize = cardsLayout.iconSize ?? 54;
      const iconSprite = spriteFromUi("rogue_option_icon", iconSize, iconSize);
      if (iconSprite) {
        iconSprite.anchor.set(0.5);
        iconSprite.position.set(cardW / 2, 42);
        icon.addChild(iconSprite);
      } else {
        icon.addChild(new Graphics().circle(cardW / 2, 42, iconSize / 2 - 2).fill({ color: 0xffb33d }).stroke({ color: 0x593716, width: 3 }));
      }
      const name = text(option.title, cardsLayout.fontSize ?? 16, "#1b2733", "700");
      name.anchor.set(0.5, 0);
      name.position.set(cardW / 2, 78);
      const desc = text(option.desc, 12, "#334455");
      desc.style.wordWrapWidth = cardW - 18;
      desc.anchor.set(0.5, 0);
      desc.position.set(cardW / 2, 108);
      card.position.set(startX + index * (cardW + gap), y);
      card.eventMode = "static";
      card.cursor = "pointer";
      card.on("pointertap", () => onPick(option));
      card.addChild(bg, icon, name, desc);
      this.container.addChild(card);
    });
  }

  private layout(key: string, defaults: Parameters<typeof getUiLayout>[3]) {
    return getUiLayout(data, "rogue", key, defaults);
  }
}
