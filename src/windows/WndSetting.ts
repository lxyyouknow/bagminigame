import { Graphics } from "pixi.js";
import { app, audio } from "../core/runtime";
import { button, glossyButton, text } from "../utils/display";
import { GameWindow } from "./GameWindow";

export class WndSetting extends GameWindow {
  constructor(private readonly onClose: () => void) {
    super();
    this.draw();
  }

  private draw(): void {
    this.container.removeChildren();
    const w = app.screen.width;
    const h = app.screen.height;
    this.container.addChild(new Graphics().rect(0, 0, w, h).fill({ color: 0x000000, alpha: 0.62 }));
    const panel = new Graphics();
    panel.roundRect(w * 0.08, h * 0.2, w * 0.84, 440, 18).fill({ color: 0x24303a }).stroke({ color: 0x54c6ff, width: 4 });
    const title = text("游戏设置", 28, "#ffffff", "700");
    title.anchor.set(0.5);
    title.position.set(w / 2, h * 0.25);
    this.container.addChild(panel, title);

    this.addVolumeRow("总音量", audio.settings.masterVolume, h * 0.33, (value) => audio.setMasterVolume(value));
    this.addVolumeRow("背景音乐", audio.settings.musicVolume, h * 0.42, (value) => audio.setMusicVolume(value));
    this.addVolumeRow("战斗音效", audio.settings.sfxVolume, h * 0.51, (value) => audio.setSfxVolume(value));

    const musicToggle = glossyButton(audio.settings.mutedMusic ? "音乐：关" : "音乐：开", 130, 48, audio.settings.mutedMusic ? 0x2ebaf0 : 0x33d7ad, () => {
      audio.toggleMusic();
      this.draw();
    }, 18);
    const sfxToggle = glossyButton(audio.settings.mutedSfx ? "音效：关" : "音效：开", 130, 48, audio.settings.mutedSfx ? 0x2ebaf0 : 0x33d7ad, () => {
      audio.toggleSfx();
      this.draw();
    }, 18);
    musicToggle.position.set(w / 2 - 142, h * 0.61);
    sfxToggle.position.set(w / 2 + 12, h * 0.61);

    const hint = text("音频配置来自 s_audio / s_audio_event，正式资源可后续替换", 13, "#bfe9ff", "700");
    hint.anchor.set(0.5);
    hint.style.wordWrapWidth = w * 0.72;
    hint.position.set(w / 2, h * 0.71);

    const close = glossyButton("确定", 140, 56, 0xffc23d, this.onClose, 24);
    close.position.set((w - 140) / 2, h * 0.76);
    this.container.addChild(musicToggle, sfxToggle, hint, close);
  }

  private addVolumeRow(label: string, value: number, y: number, onChange: (value: number) => void): void {
    const w = app.screen.width;
    const name = text(label, 18, "#ffffff", "700");
    name.anchor.set(0, 0.5);
    name.position.set(w * 0.16, y);
    const minus = button("-", 44, 38, 0x2ebaf0, () => {
      onChange(value - 0.1);
      this.draw();
    });
    const plus = button("+", 44, 38, 0x33d7ad, () => {
      onChange(value + 0.1);
      this.draw();
    });
    minus.position.set(w * 0.46, y - 19);
    plus.position.set(w * 0.74, y - 19);
    const bar = new Graphics();
    bar.roundRect(w * 0.56, y - 8, w * 0.15, 16, 8).fill({ color: 0x111822, alpha: 0.9 });
    bar.roundRect(w * 0.56, y - 8, w * 0.15 * value, 16, 8).fill({ color: 0x54c6ff });
    const percent = text(`${Math.round(value * 100)}%`, 16, "#d8f3ff", "700");
    percent.anchor.set(0.5);
    percent.position.set(w * 0.635, y + 27);
    this.container.addChild(name, minus, bar, percent, plus);
  }
}
