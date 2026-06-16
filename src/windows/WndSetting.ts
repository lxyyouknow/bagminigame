import { Graphics } from "pixi.js";
import { app, audio, data } from "../core/runtime";
import { button, glossyButton, text } from "../utils/display";
import { getUiLayout, resolveUiLayoutPosition, resolveUiLayoutRect } from "../ui/layout/UiLayout";
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
    const panelLayout = this.layout("panel", { scene: "setting", key: "panel", anchor: "center", x: 0, y: Math.round(h * 0.2 + 220 - h / 2), width: Math.round(w * 0.84), height: 440, visible: true, desc: "设置弹窗主面板" });
    const panelRect = resolveUiLayoutRect(panelLayout, w, h);
    const panel = new Graphics();
    panel.roundRect(panelRect.x, panelRect.y, panelRect.width, panelRect.height, 18).fill({ color: 0x24303a }).stroke({ color: 0x54c6ff, width: 4 });
    const titleLayout = this.layout("title", { scene: "setting", key: "title", anchor: "center", x: 0, y: Math.round(h * 0.25 - h / 2), width: 320, height: 40, fontSize: 28, visible: true, desc: "设置标题" });
    const title = text("游戏设置", titleLayout.fontSize ?? 28, "#ffffff", "700");
    title.anchor.set(0.5);
    const titlePos = resolveUiLayoutPosition(titleLayout, w, h);
    title.position.set(titlePos.x, titlePos.y);
    if (panelLayout.visible) this.container.addChild(panel);
    if (titleLayout.visible) this.container.addChild(title);

    this.addVolumeRow("volume_master", "总音量", audio.settings.masterVolume, h * 0.33, (value) => audio.setMasterVolume(value));
    this.addVolumeRow("volume_music", "背景音乐", audio.settings.musicVolume, h * 0.42, (value) => audio.setMusicVolume(value));
    this.addVolumeRow("volume_sfx", "战斗音效", audio.settings.sfxVolume, h * 0.51, (value) => audio.setSfxVolume(value));

    const musicLayout = this.layout("music_toggle", { scene: "setting", key: "music_toggle", anchor: "center", x: -77, y: Math.round(h * 0.61 + 24 - h / 2), width: 130, height: 48, fontSize: 18, visible: true, desc: "音乐开关按钮" });
    const sfxLayout = this.layout("sfx_toggle", { scene: "setting", key: "sfx_toggle", anchor: "center", x: 77, y: Math.round(h * 0.61 + 24 - h / 2), width: 130, height: 48, fontSize: 18, visible: true, desc: "音效开关按钮" });
    const musicToggle = glossyButton(audio.settings.mutedMusic ? "音乐：关" : "音乐：开", musicLayout.width, musicLayout.height, audio.settings.mutedMusic ? 0x2ebaf0 : 0x33d7ad, () => {
      audio.toggleMusic();
      this.draw();
    }, musicLayout.fontSize ?? 18);
    const sfxToggle = glossyButton(audio.settings.mutedSfx ? "音效：关" : "音效：开", sfxLayout.width, sfxLayout.height, audio.settings.mutedSfx ? 0x2ebaf0 : 0x33d7ad, () => {
      audio.toggleSfx();
      this.draw();
    }, sfxLayout.fontSize ?? 18);
    const musicRect = resolveUiLayoutRect(musicLayout, w, h);
    const sfxRect = resolveUiLayoutRect(sfxLayout, w, h);
    musicToggle.position.set(musicRect.x, musicRect.y);
    sfxToggle.position.set(sfxRect.x, sfxRect.y);

    const hintLayout = this.layout("hint", { scene: "setting", key: "hint", anchor: "center", x: 0, y: Math.round(h * 0.71 - h / 2), width: w * 0.72, height: 48, fontSize: 13, visible: true, desc: "设置说明文本" });
    const hint = text("音频配置来自 s_audio / s_audio_event，正式资源可后续替换", hintLayout.fontSize ?? 13, "#bfe9ff", "700");
    hint.anchor.set(0.5);
    hint.style.wordWrapWidth = hintLayout.width;
    const hintPos = resolveUiLayoutPosition(hintLayout, w, h);
    hint.position.set(hintPos.x, hintPos.y);

    const closeLayout = this.layout("close_button", { scene: "setting", key: "close_button", anchor: "center", x: 0, y: Math.round(h * 0.76 + 28 - h / 2), width: 140, height: 56, fontSize: 24, visible: true, desc: "设置确定按钮" });
    const close = glossyButton("确定", closeLayout.width, closeLayout.height, 0xffc23d, this.onClose, closeLayout.fontSize ?? 24);
    const closeRect = resolveUiLayoutRect(closeLayout, w, h);
    close.position.set(closeRect.x, closeRect.y);
    if (musicLayout.visible) this.container.addChild(musicToggle);
    if (sfxLayout.visible) this.container.addChild(sfxToggle);
    if (hintLayout.visible) this.container.addChild(hint);
    if (closeLayout.visible) this.container.addChild(close);
  }

  private addVolumeRow(key: string, label: string, value: number, fallbackY: number, onChange: (value: number) => void): void {
    const w = app.screen.width;
    const h = app.screen.height;
    const layout = this.layout(key, { scene: "setting", key, anchor: "center", x: 0, y: Math.round(fallbackY - h / 2), width: 300, height: 44, fontSize: 18, visible: true, desc: `${label}行中心点` });
    if (!layout.visible) return;
    const pos = resolveUiLayoutPosition(layout, w, h);
    const name = text(label, layout.fontSize ?? 18, "#ffffff", "700");
    name.anchor.set(0, 0.5);
    name.position.set(pos.x - layout.width / 2, pos.y);
    const minus = button("-", 44, 38, 0x2ebaf0, () => {
      onChange(value - 0.1);
      this.draw();
    });
    const plus = button("+", 44, 38, 0x33d7ad, () => {
      onChange(value + 0.1);
      this.draw();
    });
    minus.position.set(pos.x - 20, pos.y - 19);
    plus.position.set(pos.x + layout.width * 0.38, pos.y - 19);
    const bar = new Graphics();
    bar.roundRect(pos.x + layout.width * 0.1, pos.y - 8, layout.width * 0.22, 16, 8).fill({ color: 0x111822, alpha: 0.9 });
    bar.roundRect(pos.x + layout.width * 0.1, pos.y - 8, layout.width * 0.22 * value, 16, 8).fill({ color: 0x54c6ff });
    const percent = text(`${Math.round(value * 100)}%`, 16, "#d8f3ff", "700");
    percent.anchor.set(0.5);
    percent.position.set(pos.x + layout.width * 0.21, pos.y + 27);
    this.container.addChild(name, minus, bar, percent, plus);
  }

  private layout(key: string, defaults: Parameters<typeof getUiLayout>[3]) {
    return getUiLayout(data, "setting", key, defaults);
  }
}
