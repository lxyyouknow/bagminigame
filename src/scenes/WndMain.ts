import { Container, Graphics } from "pixi.js";
import { analytics, app, audio, data, save } from "../core/runtime";
import { showLevelLoading } from "../core/navigation";
import { drawMainBg, drawStageDiorama, drawTopResourceBar, glossyButton, spriteFromUi, text } from "../utils/display";
import { formatConsumeToast } from "../ui/resourceMeta";
import type { UiLayoutDef } from "../types";
import { resolveUiLayoutPosition, withLayoutDefaults } from "../ui/layout/UiLayout";
import { BaseScene } from "./BaseScene";

export class WndMain extends BaseScene {
  private selectedIndex = 0;
  private toast = "";
  private toastTimer = 0;

  constructor() {
    super();
    audio.playMusicEvent("music_main");
    analytics.track("main_show", { account: save.getAccountId() });
    this.draw();
  }

  override update(dt: number): void {
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) {
        this.toast = "";
        this.draw();
      }
    }
  }

  private draw(): void {
    this.container.removeChildren();
    drawMainBg(this.container);
    const w = app.screen.width;
    const h = app.screen.height;
    const resources = save.getResources();
    drawTopResourceBar(this.container, {
      energy: String(resources.energy),
      dynamite: String(resources.dynamite),
      coin: String(resources.coin),
    });

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
    const account = text(`账号：${save.getAccountId()}`, 12, "#ffe9c6", "700");
    account.anchor.set(0, 0.5);
    account.position.set(110, 128);
    this.container.addChild(avatar, lv, lvText, namePlate, roleName, account);

    this.addSideEntries(w, h);

    const level = data.levels[this.selectedIndex];
    const unlocked = save.isLevelUnlocked(level.id);
    const progress = save.getLevelProgress(level.id);
    const stageLayout = this.layout("stage_diorama", {
      scene: "main",
      key: "stage_diorama",
      anchor: "center",
      x: 0,
      y: Math.round(h * 0.43 - h / 2),
      width: 320,
      height: 240,
      scale: Math.min(1.12, w / 430),
      visible: true,
      desc: "主界面关卡预览图中心点",
    });
    if (stageLayout.visible) {
      const diorama = drawStageDiorama(level, Math.min(stageLayout.scale ?? 1.12, w / 430), !unlocked);
      const pos = resolveUiLayoutPosition(stageLayout, w, h);
      diorama.position.set(pos.x, pos.y);
      this.container.addChild(diorama);
    }

    if (this.selectedIndex > 0) {
      this.addArrow("arrow_left", "‹", () => this.switchLevel(-1), w, h, {
        scene: "main",
        key: "arrow_left",
        anchor: "centerLeft",
        x: 34,
        y: Math.round(h * 0.42 - h / 2),
        width: 54,
        height: 64,
        fontSize: 38,
        visible: true,
        desc: "左切关按钮中心点",
      });
    }
    if (this.selectedIndex < data.levels.length - 1) {
      this.addArrow("arrow_right", "›", () => this.switchLevel(1), w, h, {
        scene: "main",
        key: "arrow_right",
        anchor: "centerRight",
        x: -88,
        y: Math.round(h * 0.42 - h / 2),
        width: 54,
        height: 64,
        fontSize: 38,
        visible: true,
        desc: "右切关按钮中心点",
      });
    }

    const levelNameLayout = this.layout("level_name", {
      scene: "main",
      key: "level_name",
      anchor: "center",
      x: 0,
      y: Math.round(h * 0.68 - h / 2),
      width: 320,
      height: 48,
      fontSize: 30,
      visible: true,
      desc: "关卡名文本中心点",
    });
    const levelNamePos = resolveUiLayoutPosition(levelNameLayout, w, h);
    const levelName = text(level.name, levelNameLayout.fontSize ?? 30, "#ffffff", "700");
    levelName.anchor.set(0.5);
    levelName.position.set(levelNamePos.x, levelNamePos.y);

    const recordLayout = this.layout("record_bar", {
      scene: "main",
      key: "record_bar",
      anchor: "center",
      x: 0,
      y: Math.round(h * 0.71 + 18 - h / 2),
      width: 276,
      height: 36,
      fontSize: 18,
      visible: true,
      desc: "最高记录条中心点",
    });
    const recordPos = resolveUiLayoutPosition(recordLayout, w, h);
    const record = new Graphics();
    record.roundRect(recordPos.x - recordLayout.width / 2, recordPos.y - recordLayout.height / 2, recordLayout.width, recordLayout.height, 16).fill({ color: 0x3a2f27, alpha: 0.88 });
    const recordText = text(`最高记录： 第${progress.bestWave}波`, recordLayout.fontSize ?? 18, "#ffffff", "700");
    recordText.anchor.set(0.5);
    recordText.position.set(recordPos.x, recordPos.y);

    const chestLayout = this.layout("reward_chest", {
      scene: "main",
      key: "reward_chest",
      anchor: "center",
      x: 143,
      y: Math.round(h * 0.7 + 15 - h / 2),
      width: 62,
      height: 46,
      visible: true,
      desc: "记录条右侧宝箱中心点",
    });
    const chestPos = resolveUiLayoutPosition(chestLayout, w, h);
    const chestX = chestPos.x - chestLayout.width / 2;
    const chestY = chestPos.y - chestLayout.height / 2;
    const chest = new Graphics();
    chest.roundRect(chestX, chestY, chestLayout.width, chestLayout.height, 10).fill({ color: 0x8f6a20 }).stroke({ color: 0x2a2110, width: 4 });
    chest.moveTo(chestX + 10, chestY + 18).lineTo(chestX + 28, chestY + 36).lineTo(chestX + 56, chestY + 6).stroke({ color: 0x2fff67, width: 8 });

    const startLayout = this.layout("start_button", {
      scene: "main",
      key: "start_button",
      anchor: "center",
      x: 0,
      y: Math.round(h * 0.8 + 46 - h / 2),
      width: Math.min(250, w * 0.52),
      height: 92,
      fontSize: 28,
      visible: true,
      desc: "开始游戏按钮中心点",
    });
    const startPos = resolveUiLayoutPosition(startLayout, w, h);
    const cost = save.getEntryCost(level.id);
    const startLabel = unlocked ? `开始游戏\n钥匙 x${cost.amount}` : "未解锁";
    const start = glossyButton(startLabel, startLayout.width, startLayout.height, unlocked ? 0xffe05a : 0x999999, () => this.tryStartLevel(level.id), startLayout.fontSize ?? 28, 0.95);
    start.position.set(startPos.x - startLayout.width / 2, startPos.y - startLayout.height / 2);
    if (levelNameLayout.visible) this.container.addChild(levelName);
    if (recordLayout.visible) this.container.addChild(record, recordText);
    if (chestLayout.visible) this.container.addChild(chest);
    if (startLayout.visible) this.container.addChild(start);

    if (this.toast) {
      const toastLayout = this.layout("toast", {
        scene: "main",
        key: "toast",
        anchor: "center",
        x: 0,
        y: Math.round(h * 0.76 - h / 2),
        width: 300,
        height: 44,
        fontSize: 18,
        visible: true,
        desc: "主界面提示气泡中心点",
      });
      const toastPos = resolveUiLayoutPosition(toastLayout, w, h);
      if (!toastLayout.visible) return;
      const toast = text(this.toast, toastLayout.fontSize ?? 18, "#ffffff", "700");
      toast.anchor.set(0.5);
      toast.position.set(toastPos.x, toastPos.y);
      const bg = new Graphics();
      bg.roundRect(toastPos.x - toastLayout.width / 2, toastPos.y - toastLayout.height / 2, toastLayout.width, toastLayout.height, 22).fill({ color: 0x000000, alpha: 0.58 });
      this.container.addChild(bg, toast);
    }
  }

  private switchLevel(delta: number): void {
    this.selectedIndex = Math.max(0, Math.min(data.levels.length - 1, this.selectedIndex + delta));
    this.draw();
  }

  private tryStartLevel(levelId: number): void {
    const level = data.getLevel(levelId);
    const cost = save.getEntryCost(level.id);
    analytics.track("level_start_click", { levelId: level.id, costResource: cost.resource, costAmount: cost.amount });
    const result = save.tryConsumeLevelEntry(level.id);
    if (result.ok) {
      analytics.track("level_start_success", { levelId: level.id, costResource: cost.resource, costAmount: cost.amount });
      const remaining = save.getResources()[cost.resource];
      showLevelLoading(level, formatConsumeToast(cost.resource, cost.amount, remaining));
      return;
    }
    if (result.reason === "locked") {
      analytics.track("level_start_failed", { levelId: level.id, reason: "locked" });
      this.toast = "通关上一关后解锁";
    } else {
      analytics.track("level_start_failed", { levelId: level.id, reason: "notEnough", resource: result.resource, need: result.need, current: result.current });
      this.toast = `钥匙不足：需要 ${result.need}，当前 ${result.current}`;
    }
    this.toastTimer = 1.3;
    this.draw();
  }

  private layout(key: string, defaults: UiLayoutDef): UiLayoutDef {
    return withLayoutDefaults(data.getUiLayout("main", key), defaults);
  }

  private addSideEntries(w: number, h: number): void {
    const miniLayout = this.layout("side_minigame", {
      scene: "main",
      key: "side_minigame",
      anchor: "topRight",
      x: -92,
      y: 96,
      width: 64,
      height: 82,
      iconSize: 52,
      labelOffsetY: 28,
      fontSize: 14,
      visible: true,
      desc: "主界面右侧小游戏入口",
    });
    if (miniLayout.visible) {
      const mini = this.sideIcon("小游戏", 0xffd14c, "!", miniLayout);
      const pos = resolveUiLayoutPosition(miniLayout, w, h);
      mini.position.set(pos.x, pos.y);
      this.container.addChild(mini);
    }

    const circleLayout = this.layout("side_game_circle", {
      scene: "main",
      key: "side_game_circle",
      anchor: "topRight",
      x: -84,
      y: 230,
      width: 64,
      height: 82,
      iconSize: 52,
      labelOffsetY: 28,
      fontSize: 14,
      visible: true,
      desc: "主界面右侧游戏圈入口",
    });
    if (circleLayout.visible) {
      const circle = this.sideIcon("游戏圈", 0x8ac7ff, "🎮", circleLayout);
      const pos = resolveUiLayoutPosition(circleLayout, w, h);
      circle.position.set(pos.x, pos.y);
      this.container.addChild(circle);
    }
  }

  private addArrow(key: string, label: string, onTap: () => void, w: number, h: number, defaults: UiLayoutDef): void {
    const layout = this.layout(key, defaults);
    if (!layout.visible) return;
    const arrow = glossyButton(label, layout.width, layout.height, 0xffffff, onTap, layout.fontSize ?? 38);
    const pos = resolveUiLayoutPosition(layout, w, h);
    arrow.position.set(pos.x, pos.y);
    this.container.addChild(arrow);
  }

  private sideIcon(label: string, bg: number, mark: string, layout: UiLayoutDef): Container {
    const c = new Container();
    const uiKey = label === "小游戏" ? "side_minigame_icon" : "side_game_circle_icon";
    const iconSize = layout.iconSize ?? 52;
    const sprite = spriteFromUi(uiKey, iconSize, iconSize);
    if (sprite) {
      sprite.anchor.set(0.5);
      c.addChild(sprite);
    } else {
      const g = new Graphics().circle(0, 0, iconSize / 2 - 2).fill({ color: bg }).stroke({ color: 0xffffff, width: 4 });
      c.addChild(g);
    }
    const m = text(mark, 20, "#ffffff", "700");
    m.anchor.set(0.5);
    if (sprite) m.alpha = 0;
    const l = text(label, layout.fontSize ?? 14, "#ffffff", "700");
    l.anchor.set(0.5, 0);
    l.position.set(0, layout.labelOffsetY ?? 25);
    c.addChild(m, l);
    return c;
  }
}
