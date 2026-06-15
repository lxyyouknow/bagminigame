import { Container, Graphics } from "pixi.js";
import { app, audio, data } from "../core/runtime";
import { showBag } from "../core/navigation";
import { drawMainBg, drawStageDiorama, drawTopResourceBar, glossyButton, spriteFromUi, text } from "../utils/display";
import { BaseScene } from "./BaseScene";

export class WndMain extends BaseScene {
  private selectedIndex = 0;

  constructor() {
    super();
    audio.playMusicEvent("music_main");
    this.draw();
  }

  private draw(): void {
    this.container.removeChildren();
    drawMainBg(this.container);
    const w = app.screen.width;
    const h = app.screen.height;
    drawTopResourceBar(this.container);

    const avatar = new Graphics();
    avatar.circle(52, 102, 34).fill({ color: 0x2f2f34 }).stroke({ color: 0x111111, width: 4 });
    avatar.circle(52, 102, 24).fill({ color: 0xd24e40 });
    avatar.rect(34, 92, 36, 16).fill({ color: 0x20262b });
    const lv = new Graphics().circle(28, 132, 18).fill({ color: 0x27343c }).stroke({ color: 0xffffff, width: 2 });
    const lvText = text("3", 18, "#ffffff", "700");
    lvText.anchor.set(0.5);
    lvText.position.set(28, 132);
    const namePlate = new Graphics().roundRect(88, 82, 150, 42, 10).fill({ color: 0x3b3430, alpha: 0.88 });
    const roleName = text("秘藏猎人", 20, "#ffffff", "700");
    roleName.anchor.set(0, 0.5);
    roleName.position.set(110, 103);
    this.container.addChild(avatar, lv, lvText, namePlate, roleName);

    const mini = this.sideIcon("小游戏", 0xffd14c, "!");
    mini.position.set(w - 92, 96);
    const circle = this.sideIcon("游戏圈", 0x8ac7ff, "🎮");
    circle.position.set(w - 84, 230);
    this.container.addChild(mini, circle);

    const level = data.levels[this.selectedIndex];
    const diorama = drawStageDiorama(level, Math.min(1.12, w / 430));
    diorama.position.set(w / 2, h * 0.43);
    this.container.addChild(diorama);

    if (this.selectedIndex > 0) {
      const left = glossyButton("‹", 54, 64, 0xffffff, () => this.switchLevel(-1), 38);
      left.position.set(34, h * 0.42);
      this.container.addChild(left);
    }
    if (this.selectedIndex < data.levels.length - 1) {
      const right = glossyButton("›", 54, 64, 0xffffff, () => this.switchLevel(1), 38);
      right.position.set(w - 88, h * 0.42);
      this.container.addChild(right);
    }

    const levelName = text(level.name, 30, "#ffffff", "700");
    levelName.anchor.set(0.5);
    levelName.position.set(w / 2, h * 0.68);
    const record = new Graphics();
    record.roundRect(w / 2 - 138, h * 0.71, 276, 36, 16).fill({ color: 0x3a2f27, alpha: 0.88 });
    const recordText = text(`最高记录： 第0波`, 18, "#ffffff", "700");
    recordText.anchor.set(0.5);
    recordText.position.set(w / 2, h * 0.71 + 18);
    const chest = new Graphics();
    chest.roundRect(w / 2 + 112, h * 0.7 - 8, 62, 46, 10).fill({ color: 0x8f6a20 }).stroke({ color: 0x2a2110, width: 4 });
    chest.moveTo(w / 2 + 122, h * 0.7 + 10).lineTo(w / 2 + 140, h * 0.7 + 28).lineTo(w / 2 + 168, h * 0.7 - 2).stroke({ color: 0x2fff67, width: 8 });
    const start = glossyButton("开始游戏\n🧨 x6", Math.min(250, w * 0.52), 92, 0xffe05a, () => showBag(level), 28);
    start.position.set((w - Math.min(250, w * 0.52)) / 2, h * 0.8);
    this.container.addChild(levelName, record, recordText, chest, start);
  }

  private switchLevel(delta: number): void {
    this.selectedIndex = Math.max(0, Math.min(data.levels.length - 1, this.selectedIndex + delta));
    this.draw();
  }

  private sideIcon(label: string, bg: number, mark: string): Container {
    const c = new Container();
    const uiKey = label === "小游戏" ? "side_minigame_icon" : "side_game_circle_icon";
    const sprite = spriteFromUi(uiKey, 52, 52);
    if (sprite) {
      sprite.anchor.set(0.5);
      c.addChild(sprite);
    } else {
      const g = new Graphics().circle(0, 0, 24).fill({ color: bg }).stroke({ color: 0xffffff, width: 4 });
      c.addChild(g);
    }
    const m = text(mark, 20, "#ffffff", "700");
    m.anchor.set(0.5);
    if (sprite) m.alpha = 0;
    const l = text(label, 14, "#ffffff", "700");
    l.anchor.set(0.5, 0);
    l.position.set(0, 25);
    c.addChild(m, l);
    return c;
  }
}
