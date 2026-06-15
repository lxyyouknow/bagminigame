import { Container, Graphics } from "pixi.js";
import type { RogueOptionDef } from "../types";
import { app } from "../core/runtime";
import { spriteFromUi, text } from "../utils/display";
import { GameWindow } from "./GameWindow";

export class WndRogueOption extends GameWindow {
  constructor(options: RogueOptionDef[], onPick: (option: RogueOptionDef) => void) {
    super();
    const w = app.screen.width;
    const h = app.screen.height;
    this.container.addChild(new Graphics().rect(0, 0, w, h).fill({ color: 0x000000, alpha: 0.64 }));
    const title = text("选择强化", 28, "#ffffff", "700");
    title.anchor.set(0.5);
    title.position.set(w / 2, h * 0.28);
    this.container.addChild(title);
    const cardW = Math.min(118, (w - 62) / 3);
    const gap = 10;
    const total = cardW * 3 + gap * 2;
    const startX = (w - total) / 2;
    const y = h * 0.38;
    options.forEach((option, index) => {
      const card = new Container();
      const bg = new Graphics();
      bg.roundRect(0, 0, cardW, 190, 14).fill({ color: 0xf4f9ff }).stroke({ color: 0x54c6ff, width: 4 });
      const icon = new Container();
      const iconSprite = spriteFromUi("rogue_option_icon", 54, 54);
      if (iconSprite) {
        iconSprite.anchor.set(0.5);
        iconSprite.position.set(cardW / 2, 42);
        icon.addChild(iconSprite);
      } else {
        icon.addChild(new Graphics().circle(cardW / 2, 42, 25).fill({ color: 0xffb33d }).stroke({ color: 0x593716, width: 3 }));
      }
      const name = text(option.title, 16, "#1b2733", "700");
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
}
