import { AnimatedSprite, Container, Graphics, Sprite, type DestroyOptions } from "pixi.js";
import type { AnimationDef, BagState, BattleTuningDef, CombatBuffs, FloatingRuntime, ItemDef, LevelDef, MonsterDef, MonsterRuntime, PlacedItem, ProjectileRuntime, RogueOptionDef, SkillDef, SpinDamageRuntime } from "../types";
import type { LifecycleReason } from "../services/LifecycleService";
import { analytics, app, assetManager, audio, data, nextUid, save } from "../core/runtime";
import { showBag, showMain } from "../core/navigation";
import { color, text, uiButton, weightedPick, spriteFromAsset, spriteFromUi } from "../utils/display";
import { getUiLayout, resolveUiLayoutPosition, resolveUiLayoutRect, scaleUiLayoutSize } from "../ui/layout/UiLayout";
import { GameWindow } from "../windows/GameWindow";
import { WndPause } from "../windows/WndPause";
import { WndResult } from "../windows/WndResult";
import { WndRogueOption } from "../windows/WndRogueOption";
import { getBaseDamageFeedback, getBaseShakeFeedback } from "./baseDamageFeedbackRules";
import { getBossArrivalWarningFrame } from "./bossArrivalWarningRules";
import { getDamageNumberFeedback } from "./battleDamageFeedbackRules";
import { resolveMonsterContactY } from "./battleContactLineRules";
import { computeBattleEquipListLayout, computeBattleHudLayout } from "./battleEquipLayout";
import { isWaveCombatSettled } from "./battleWaveClearRules";
import { applyWaveCheckpointToBag, buildSingleWaveSpawnQueue, type WaveSpawnEvent } from "./battleWaveRules";
import { createEffectiveMonster, getBaseArmor, getBaseMaxHp, getExpNeed } from "./battleDifficultyRules";
import { stepMonsterContact } from "./monsterContactRules";
import { shouldFreezeMonsterMovement } from "./monsterCastRules";
import { getMonsterAnimationKey, getMonsterDeathAnimationKey, shouldKeepPendingAttackAnimation } from "./monsterVisualRules";
import { getAnimationEventFrameIndex, resolveAnimatedMonsterAttackTiming, stepAnimatedMonsterAttack } from "./monsterAttackAnimationRules";
import { resolveMonsterAttackContactY } from "./monsterAttackDistanceRules";
import { applyBossRoarBuff, stepBossRoarCooldown } from "./bossSkillRules";
import { shouldPreserveMonsterOverlayChild } from "./monsterViewRules";
import { chooseMonsterSpawnPosition } from "./monsterSpawnRules";
import { AnimationPlaybackController } from "./animationPlaybackController";
import { getImpactAnimationKey, shouldUseVisualProjectile, usesAreaImpact } from "./skillVisualRules";
import { chooseBalancedTarget, getInitialWeaponCooldown } from "./weaponAttackRules";
import { shouldOpenRogueOptionsOnLevelUp } from "./rogueTriggerRules";
import { getMonsterHpFillWidth } from "./monsterHpBarRules";
import { getMonsterDepthZIndex, separateMonsterCrowd } from "./monsterDepthRules";
import { BaseScene } from "./BaseScene";
import type { RunSessionState } from "./runSessionState";
import type { FarmBoardMetrics } from "./BagScene";

export interface BattleSceneOptions {
  session?: RunSessionState;
  onWaveClear?: (message: string) => void;
  farmBaseMode?: boolean;
  farmBoard?: FarmBoardMetrics;
  onFarmWeaponAttack?: (uid: number) => void;
}

interface HitHoldRuntime {
  view: AnimatedSprite;
  holdDuration: number;
  fadeDuration: number;
  elapsed: number;
}

interface DamageResult {
  damage: number;
  killed: boolean;
}

interface FadeReleaseRuntime {
  view: Container;
  duration: number;
  elapsed: number;
  onComplete?: () => void;
}

interface BossArrivalWarningRuntime {
  view: Container;
  elapsed: number;
  duration: number;
}

interface DelayedImpactRuntime {
  view: Container;
  x: number;
  y: number;
  radius: number;
  damage: number;
  skill: SkillDef;
  elapsed: number;
  duration: number;
  turns: number;
  startRotation: number;
}

export class BattleScene extends BaseScene {
  private monsters: MonsterRuntime[] = [];
  private projectiles: ProjectileRuntime[] = [];
  private delayedImpacts: DelayedImpactRuntime[] = [];
  private spinZones: SpinDamageRuntime[] = [];
  private floating: FloatingRuntime[] = [];
  private fadeReleases: FadeReleaseRuntime[] = [];
  private hitHolds: HitHoldRuntime[] = [];
  private spawnQueue: WaveSpawnEvent[] = [];
  private time = 0;
  private baseHp: number;
  private baseMaxHp: number;
  private armor: number;
  private exp = 0;
  private levelNo = 1;
  private kills = 0;
  private currentWave = 1;
  private waveDuration = 1;
  private ending = false;
  private paused = false;
  private buffs: CombatBuffs = {
    attackMul: 1,
    cdMul: 1,
    radiusMul: 1,
    dotMul: 1,
    armorBonus: 0,
    qualityAttack: {},
  };
  private battleLayer = new Container();
  private groundFxLayer = new Container();
  private monsterLayer = new Container();
  private fieldForegroundLayer = new Container();
  private projectileLayer = new Container();
  private hitFxLayer = new Container();
  private deathFxLayer = new Container();
  private damageTextLayer = new Container();
  private heroLayer = new Container();
  private uiLayer = new Container();
  private bossWarningLayer = new Container();
  private topHudLayer: Container | undefined;
  private topHudRevealProgress = 1;
  private fenceLeft?: Sprite;
  private fenceRight?: Sprite;
  private fenceRevealProgress = 1;
  private mapDecorDrawn = false;
  private baseHpLayer?: Container;
  private baseHpLayerHomeX = 0;
  private modalWindow: GameWindow | undefined;
  private hero?: AnimatedSprite;
  private heroAttackTimer = 0;
  private heroCastX = 0;
  private heroCastY = 0;
  private baseShakeTimer = 0;
  private baseShakeDuration = 0;
  private baseShakeAmplitude = 0;
  private bossArrivalWarning?: BossArrivalWarningRuntime;
  private readonly heroAnimKey = "hero_pumpkin_slingshot_attack_up";
  private readonly animationPlayback = new AnimationPlaybackController();
  private readonly tuning: BattleTuningDef;
  private readonly farmBaseMode: boolean;

  private waveClearTimer: number | undefined;

  constructor(private readonly level: LevelDef, private readonly bag: BagState, private readonly options: BattleSceneOptions = {}) {
    super();
    this.farmBaseMode = Boolean(options.farmBaseMode);
    audio.preloadGroups(["battle"]);
    audio.playMusicEvent("music_battle");
    this.monsterLayer.sortableChildren = true;
    this.tuning = data.getBattleTuning(level.battleTuningId);
    this.baseMaxHp = getBaseMaxHp(level, this.tuning);
    const session = options.session;
    bag.currentWave ??= session?.currentWave ?? 1;
    bag.baseHp ??= session?.baseHp ?? this.baseMaxHp;
    this.currentWave = session?.currentWave ?? bag.currentWave;
    this.baseHp = session?.baseHp ?? bag.baseHp;
    this.armor = getBaseArmor(level, this.tuning);
    if (session) {
      this.exp = session.exp;
      this.levelNo = session.levelNo;
      this.kills = session.kills;
      this.buffs = session.buffs;
    }
    this.initializeWeaponCooldowns();
    this.buildSpawnQueue();
    analytics.track("battle_start", { levelId: level.id, wave: this.currentWave, weaponCount: bag.placed.length, startGold: bag.gold });
    this.container.addChild(this.battleLayer, this.groundFxLayer, this.monsterLayer, this.fieldForegroundLayer, this.projectileLayer, this.hitFxLayer, this.deathFxLayer, this.damageTextLayer, this.uiLayer, this.bossWarningLayer);
    this.drawStatic();
  }

  override update(dt: number): void {
    if (this.paused) return;
    this.time += dt;
    if (this.options.session) this.options.session.playSeconds += dt;
    this.spawnDue();
    this.updateWeapons(dt);
    this.updateMonsters(dt);
    this.updateProjectiles(dt);
    this.updateDelayedImpacts(dt);
    this.updateSpinZones(dt);
    this.updateHitHolds(dt);
    this.updateFloating(dt);
    this.updateFadeReleases(dt);
    this.updateHero(dt);
    this.drawStatic();
    this.updateBaseShake(dt);
    this.updateBossArrivalWarning(dt);
    if (this.ending) return;
    if (this.baseHp <= 0) {
      this.showResult(false);
    } else if (isWaveCombatSettled(this.spawnQueue.length, this.monsters)) {
      if (this.currentWave >= this.level.winWave) this.showResult(true);
      else this.showWaveCheckpoint();
    }
  }

  override onAppPause(_reason: LifecycleReason): void {
    if (this.modalWindow) {
      this.setBattlePaused(true);
      return;
    }
    this.openPause();
  }

  override onAppResume(_reason: LifecycleReason): void {
    // 市面小游戏常见处理：回到前台只恢复音频，不自动继续战斗，等待玩家点“继续挑战”。
  }

  setTopHudRevealProgress(progress: number): void {
    this.topHudRevealProgress = Math.max(0, Math.min(1, progress));
    this.applyTopHudTransition();
  }

  setFenceRevealProgress(progress: number): void {
    this.fenceRevealProgress = Math.max(0, Math.min(1, progress));
    this.applyFenceTransition();
  }

  getCooldownMultiplier(): number {
    return this.buffs.cdMul;
  }

  private buildSpawnQueue(): void {
    this.spawnQueue = buildSingleWaveSpawnQueue(data.getWaves(this.level.waveGroupId), this.currentWave, this.tuning);
    this.waveDuration = Math.max(1, (this.spawnQueue.at(-1)?.time ?? 0.2) + 2.8);
  }

  private drawStatic(): void {
    this.uiLayer.removeChildren();
    this.topHudLayer = undefined;
    this.baseHpLayer = undefined;
    const w = app.screen.width;
    const h = app.screen.height;
    if (!this.mapDecorDrawn) {
      const field = data.getBattleField(this.level.battleFieldKey);
      if (!this.farmBaseMode) this.drawSplitBattleBackground(field.bgAssetKey);
      this.drawBattleMapDecor();
      this.mapDecorDrawn = true;
    }

    const pauseLayout = this.layout("pause_button", {
      scene: "battle",
      key: "pause_button",
      anchor: "topLeft",
      x: 18,
      y: 20,
      width: 48,
      height: 48,
      fontSize: 16,
      visible: true,
      desc: "战斗左上暂停按钮",
    });
    const pauseScale = pauseLayout.scale ?? 1;
    const pause = uiButton("battle_pause_button", "", pauseLayout.width * pauseScale, pauseLayout.height * pauseScale, 0x2b3441, () => this.openPause(), pauseLayout.fontSize ?? 16, undefined, true);
    const pausePos = resolveUiLayoutPosition(pauseLayout, w, h);
    pause.position.set(pausePos.x, pausePos.y);

    const infoLayout = this.layout("info_bar", {
      scene: "battle",
      key: "info_bar",
      anchor: "topCenter",
      x: 0,
      y: 0,
      width: 407,
      height: 207,
      scale: 1,
      visible: true,
      desc: "战斗顶部信息栏图片",
    });
    const infoScale = infoLayout.scale ?? 1;
    const infoBar = spriteFromUi("battle_info_bar", infoLayout.width * infoScale, infoLayout.height * infoScale);
    if (infoBar) {
      infoBar.anchor.set(0.5, 0);
      const infoPos = resolveUiLayoutPosition(infoLayout, w, h);
      infoBar.position.set(infoPos.x, infoPos.y);
    }

    const waveValueLayout = this.layout("wave_value", {
      scene: "battle",
      key: "wave_value",
      anchor: "topCenter",
      x: 20,
      y: 128,
      width: 120,
      height: 34,
      fontSize: 24,
      textColor: "#fff4c2",
      strokeColor: "#274a1c",
      strokeWidth: 4,
      visible: true,
      desc: "战斗信息栏僵尸头右侧怪物波次数值",
    });
    const waveValue = text(`${this.currentWave}/${this.level.winWave}`, waveValueLayout.fontSize ?? 24, waveValueLayout.textColor ?? "#fff4c2", "700", {
      strokeColor: waveValueLayout.strokeColor ?? "#274a1c",
      strokeWidth: waveValueLayout.strokeWidth ?? 4,
    });
    waveValue.anchor.set(0.5);
    const waveValuePos = resolveUiLayoutPosition(waveValueLayout, w, h);
    waveValue.position.set(waveValuePos.x, waveValuePos.y);
    const titleLayout = this.layout("title", {
      scene: "battle",
      key: "title",
      anchor: "topCenter",
      x: 0,
      y: 44,
      width: 320,
      height: 56,
      fontSize: 20,
      visible: true,
      desc: "战斗关卡名和波次文本",
    });
    const title = text(`${this.level.name}\n波次 ${this.currentWave}/${this.level.winWave}`, titleLayout.fontSize ?? 20, "#ffffff", "700");
    title.anchor.set(0.5);
    const titlePos = resolveUiLayoutPosition(titleLayout, w, h);
    title.position.set(titlePos.x, titlePos.y);

    const waveLayout = this.layout("wave_bar", {
      scene: "battle",
      key: "wave_bar",
      anchor: "topCenter",
      x: 0,
      y: 86,
      width: Math.round(w * 0.56),
      height: 14,
      visible: true,
      desc: "战斗波次进度条",
    });
    const waveRect = resolveUiLayoutRect(waveLayout, w, h);
    const waveBar = new Graphics();
    const expNeed = getExpNeed(this.levelNo, this.tuning);
    const progress = Math.max(0, Math.min(1, this.exp / Math.max(1, expNeed)));
    waveBar.roundRect(waveRect.x, waveRect.y, waveRect.width, waveRect.height, 8).fill({ color: 0x10151c, alpha: 0.9 });
    waveBar.roundRect(waveRect.x, waveRect.y, waveRect.width * progress, waveRect.height, 8).fill({ color: 0x4ed5ff });
    waveBar.stroke({ color: 0xffffff, width: 1, alpha: 0.35 });
    const levelBadge = new Graphics();
    levelBadge.circle(waveRect.x + waveRect.width + 18, waveRect.y + waveRect.height / 2, 18).fill({ color: 0x7c4f27 }).stroke({ color: 0xffd36a, width: 3 });
    const levelText = text(String(this.levelNo), 14, "#ffffff", "700");
    levelText.anchor.set(0.5);
    levelText.position.set(waveRect.x + waveRect.width + 18, waveRect.y + waveRect.height / 2);

    const statLayout = this.layout("stat", {
      scene: "battle",
      key: "stat",
      anchor: "topCenter",
      x: 0,
      y: 118,
      width: 340,
      height: 30,
      fontSize: 17,
      visible: true,
      desc: "战斗金币、杀敌、等级文本",
    });
    const statPos = resolveUiLayoutPosition(statLayout, w, h);
    const goldBg = new Graphics();
    goldBg.roundRect(18, statPos.y - 12, 112, 28, 12).fill({ color: 0x121820, alpha: 0.92 });
    const goldIcon = spriteFromUi("resource_coin_icon", 26, 26);
    if (goldIcon) {
      goldIcon.anchor.set(0.5);
      goldIcon.position.set(39, statPos.y + 1);
    }
    const goldIconFallback = new Graphics();
    goldIconFallback.roundRect(24, statPos.y - 6, 30, 14, 5).fill({ color: 0xf2c548 }).stroke({ color: 0x6e5512, width: 2 });
    const goldText = text(String(this.bag.gold), statLayout.fontSize ?? 17, "#ffffff", "700");
    goldText.anchor.set(0, 0.5);
    goldText.position.set(64, statPos.y + 1);
    const killText = text(`杀敌数:${this.kills}`, statLayout.fontSize ?? 17, "#ffffff", "700");
    killText.anchor.set(0, 0.5);
    killText.position.set(18, statPos.y + 40);
    const topHp = text(`♥ ${Math.max(0, Math.round(this.baseHp))}`, statLayout.fontSize ?? 17, "#ff6b78", "700");
    topHp.anchor.set(1, 0.5);
    topHp.position.set(w - 18, statPos.y + 1);

    const equipLayout = this.layout("equip_bar", {
      scene: "battle",
      key: "equip_bar",
      anchor: "bottomCenter",
      x: 0,
      y: -18,
      width: Math.min(w - 28, 366),
      height: 112,
      gap: 8,
      iconSize: 42,
      visible: true,
      desc: "战斗底部横向武器槽面板",
    });
    const equipGap = equipLayout.gap ?? 8;
    const equipSlotSize = this.assetDisplaySize("battle_weapon_slot_box", 50) * 0.5;
    const equipCount = Math.min(this.bag.placed.length, 10);
    const equipColumns = Math.max(1, Math.min(6, equipCount || 1));
    const equipPanelWidth = Math.min(w - 28, equipColumns * equipSlotSize + Math.max(0, equipColumns - 1) * equipGap + 24);
    const equipList = computeBattleEquipListLayout(equipCount, equipPanelWidth - 24, equipSlotSize, equipGap);
    const equipPanelHeight = Math.max(equipLayout.height, equipList.panelHeight + 18);
    const baseLayout = this.layout("base_panel", {
      scene: "battle",
      key: "base_panel",
      anchor: "bottomCenter",
      x: 0,
      y: -132,
      width: Math.min(w - 40, 360),
      height: 128,
      fontSize: 16,
      visible: true,
      desc: "战斗底部基地区域",
    });
    const hud = computeBattleHudLayout(w, h, baseLayout.width, baseLayout.height, equipPanelWidth, equipPanelHeight, equipLayout.y);
    const { base: baseRect, equip: equipRect } = hud;

    if (!this.farmBaseMode) {
      const baseTop = baseRect.y + 10;
      const turretX = baseRect.x + baseRect.width / 2;
      this.positionHero(turretX, this.friendlyAreaCenterY(baseTop + 24) - this.friendlyAreaHeight() * 0.2 - 120);
    }

    const hpLayoutRaw = this.layout("base_hp_bar", {
      scene: "battle",
      key: "base_hp_bar",
      anchor: "bottomCenter",
      x: 0,
      y: -198,
      width: 360,
      height: 88,
      scale: 1,
      fontSize: 22,
      textColor: "#ffffff",
      strokeColor: "#3b1c06",
      strokeWidth: 4,
      barOffsetX: 88,
      barOffsetY: 20,
      barWidth: 230,
      barHeight: 41,
      textOffsetX: 0,
      textOffsetY: 0,
      visible: true,
      desc: "战斗基地血条位置和尺寸",
    });
    const hpLayout = this.farmBaseMode
      ? scaleUiLayoutSize({
          ...hpLayoutRaw,
          width: hpLayoutRaw.farmWidth ?? hpLayoutRaw.width,
          scale: hpLayoutRaw.farmScale ?? hpLayoutRaw.scale ?? 1,
        })
      : scaleUiLayoutSize(hpLayoutRaw);
    const hpPos = this.farmBaseMode && this.options.farmBoard
      ? {
          x: this.options.farmBoard.gridLeft + (this.options.farmBoard.cols * this.options.farmBoard.cellSize + Math.max(0, this.options.farmBoard.cols - 1) * this.options.farmBoard.cellGap) / 2 + (hpLayoutRaw.farmOffsetX ?? 0),
          y: Math.max(0, this.options.farmBoard.gridTop + (hpLayoutRaw.farmOffsetY ?? -46)),
        }
      : resolveUiLayoutPosition(hpLayout, w, h);
    const baseHpUi = this.createBaseHpBar(hpPos.x, hpPos.y, hpLayout.width, hpLayout);
    this.baseHpLayer = baseHpUi;
    this.baseHpLayerHomeX = baseHpUi.x;
    this.applyFenceTransition();

    const topHud = new Container();
    if (pauseLayout.visible) topHud.addChild(pause);
    if (infoLayout.visible && infoBar) topHud.addChild(infoBar);
    if (waveValueLayout.visible) topHud.addChild(waveValue);
    if (titleLayout.visible) topHud.addChild(title);
    if (waveLayout.visible) topHud.addChild(waveBar, levelBadge, levelText);
    if (statLayout.visible) topHud.addChild(goldBg, goldIcon ?? goldIconFallback, goldText, killText, topHp);
    if (topHud.children.length > 0) {
      this.topHudLayer = topHud;
      this.applyTopHudTransition();
      this.uiLayer.addChild(topHud);
    }
    if (!this.farmBaseMode && baseLayout.visible) this.uiLayer.addChild(this.heroLayer);
    if (hpLayout.visible) this.uiLayer.addChild(baseHpUi);

    if (this.farmBaseMode) return;

    this.bag.placed.slice(0, 10).forEach((placed, index) => {
      const item = data.getItem(placed.itemId);
      const slot = equipList.slots[index];
      if (!slot) return;
      const iconSize = this.assetDisplaySize(item.battleIconAssetKey || item.iconAssetKey || `weapon_${item.icon}_icon`, equipLayout.iconSize ?? 46) * 0.5;
      const slotSize = Math.min(slot.width, slot.height);
      const icon = this.createBattleWeaponSlot(item, iconSize, slotSize);
      icon.position.set(equipRect.x + 12 + slot.x + slot.width / 2, equipRect.y + 9 + slot.y + slot.height / 2);
      const skill = data.getSkill(item.skillId);
      const cdRate = Math.max(0, Math.min(1, placed.cdLeft / Math.max(0.1, skill.cd * this.buffs.cdMul)));
      if (cdRate > 0) {
        const mask = new Graphics();
        mask.roundRect(-slotSize / 2, -slotSize / 2, slotSize, slotSize * cdRate, 8).fill({ color: 0x000000, alpha: 0.46 });
        icon.addChild(mask);
      }
      if (equipLayout.visible) this.uiLayer.addChild(icon);
    });
  }

  private applyTopHudTransition(): void {
    if (!this.topHudLayer) return;
    this.topHudLayer.y = -Math.round(220 * (1 - this.topHudRevealProgress));
    this.topHudLayer.alpha = this.topHudRevealProgress;
  }

  private createBaseHpBar(centerX: number, centerY: number, width: number, layout?: { fontSize?: number; textColor?: string; strokeColor?: string; strokeWidth?: number; barOffsetX?: number; barOffsetY?: number; barWidth?: number; barHeight?: number; textOffsetX?: number; textOffsetY?: number }): Container {
    const c = new Container();
    const frameTexture = assetManager.texture("battle_base_hp_frame");
    const barTexture = assetManager.texture("battle_base_hp_bar");
    const frameW = width;
    const frameH = frameTexture ? (frameTexture.height / frameTexture.width) * frameW : 88;
    c.position.set(centerX - frameW / 2, centerY - frameH / 2);

    const frame = spriteFromAsset("battle_base_hp_frame", frameW, frameH);
    if (frame) {
      c.addChild(frame);
    } else {
      c.addChild(new Graphics().roundRect(0, 0, frameW, frameH, 18).fill({ color: 0x5c2f08 }).stroke({ color: 0xffd36a, width: 3 }));
    }

    const hpRate = Math.max(0, Math.min(1, this.baseHp / Math.max(1, this.baseMaxHp)));
    const scale = frameW / 360;
    const barX = layout?.barOffsetX ?? 88 * scale;
    const barY = layout?.barOffsetY ?? 20 * scale;
    const barW = layout?.barWidth ?? 230 * scale;
    const barH = layout?.barHeight ?? 41 * scale;
    const bar = spriteFromAsset("battle_base_hp_bar", barW, barH);
    if (bar && barTexture) {
      bar.position.set(barX, barY);
      const mask = new Graphics().rect(barX, barY, barW * hpRate, barH).fill({ color: 0xffffff });
      bar.mask = mask;
      c.addChild(bar, mask);
    } else {
      c.addChild(new Graphics().roundRect(barX, barY, barW * hpRate, barH, 8 * scale).fill({ color: 0x6cc83a }));
    }

    const hpValue = text(String(Math.max(0, Math.round(this.baseHp))), layout?.fontSize ?? Math.max(16, Math.round(22 * scale)), layout?.textColor ?? "#ffffff", "700", {
      strokeColor: layout?.strokeColor ?? "#3b1c06",
      strokeWidth: layout?.strokeWidth ?? Math.max(2, Math.round(4 * scale)),
    });
    hpValue.anchor.set(0.5);
    hpValue.position.set(barX + barW / 2 + (layout?.textOffsetX ?? 0), barY + barH / 2 + (layout?.textOffsetY ?? 0));
    c.addChild(hpValue);
    return c;
  }

  private drawSplitBattleBackground(battleBgAssetKey: string): void {
    const w = app.screen.width;
    const h = app.screen.height;
    const split = Math.max(0.05, Math.min(0.95, data.getEconomy("run_transition_split_progress") || 0.6));
    const battleHeight = Math.round(h * split);
    const bagHeight = h - battleHeight;
    const battleTexture = assetManager.texture(battleBgAssetKey);
    const bagTexture = assetManager.texture("bg_bag_prebattle");

    if (battleTexture) {
      const battleBg = new Sprite(battleTexture);
      battleBg.width = w;
      battleBg.height = h;
      battleBg.y = -bagHeight;
      const battleMask = new Graphics().rect(0, 0, w, battleHeight).fill({ color: 0xffffff });
      battleBg.mask = battleMask;
      this.battleLayer.addChild(battleBg, battleMask);
    } else {
      this.battleLayer.addChild(new Graphics().rect(0, 0, w, battleHeight).fill({ color: color(this.level.theme) }));
    }

    if (bagTexture) {
      const bagBg = new Sprite(bagTexture);
      bagBg.width = w;
      bagBg.height = h;
      bagBg.y = battleHeight;
      const bagMask = new Graphics().rect(0, battleHeight, w, bagHeight).fill({ color: 0xffffff });
      bagBg.mask = bagMask;
      this.battleLayer.addChild(bagBg, bagMask);
    } else {
      this.battleLayer.addChild(new Graphics().rect(0, battleHeight, w, bagHeight).fill({ color: 0x93d56a }));
    }
  }

  private drawBattleMapDecor(): void {
    const w = app.screen.width;
    const h = app.screen.height;
    const field = data.getBattleField(this.level.battleFieldKey);
    const fenceLayout = scaleUiLayoutSize(this.layout("fence", {
      scene: "battle",
      key: "fence",
      anchor: "bottomCenter",
      x: 0,
      y: -430,
      width: 720,
      height: 109,
      scale: 1,
      visible: true,
      desc: "战斗左右栅栏位置和尺寸",
    }));
    if (!fenceLayout.visible) return;
    const leftTexture = assetManager.texture("battle_fence_left");
    const rightTexture = assetManager.texture("battle_fence_right");
    if (!leftTexture || !rightTexture) return;
    const fenceScale = fenceLayout.width / (leftTexture.width + rightTexture.width);
    const leftW = leftTexture.width * fenceScale;
    const rightW = rightTexture.width * fenceScale;
    const fenceH = fenceLayout.height;
    const left = spriteFromAsset("battle_fence_left", leftW, fenceH);
    const right = spriteFromAsset("battle_fence_right", rightW, fenceH);
    if (!left || !right) return;
    const fenceRect = resolveUiLayoutRect(fenceLayout, w, h);
    left.y = fenceRect.y;
    right.y = fenceRect.y;
    this.fenceLeft = left;
    this.fenceRight = right;
    this.applyFenceTransition();
    const targetLayer = field.fenceCoversMonsters === false ? this.battleLayer : this.fieldForegroundLayer;
    targetLayer.addChild(left, right);
  }

  private resolveFenceForegroundY(field = data.getBattleField(this.level.battleFieldKey)): number | undefined {
    if (field.fenceForegroundY && field.fenceForegroundY > 0) return field.fenceForegroundY;
    const layout = data.getUiLayout("battle", "fence");
    if (layout?.visible !== false) {
      const scaled = scaleUiLayoutSize(
        layout ?? {
          scene: "battle",
          key: "fence",
          anchor: "bottomCenter",
          x: 0,
          y: -430,
          width: 720,
          height: 109,
          scale: 1,
          visible: true,
          desc: "战斗左右栅栏位置和尺寸",
        },
      );
      return resolveUiLayoutRect(scaled, app.screen.width, app.screen.height).y;
    }
    const skinTexture = assetManager.texture("battle_friendly_area_skin");
    const fenceTexture = assetManager.texture("battle_fence_left") || assetManager.texture(field.fenceForegroundAssetKey || field.fenceAssetKey || "battle_divider_line");
    if (!skinTexture || !fenceTexture) return undefined;
    const skinScale = app.screen.width / skinTexture.width;
    const rightTexture = assetManager.texture("battle_fence_right");
    const totalFenceWidth = fenceTexture.width + (rightTexture?.width ?? fenceTexture.width);
    const fenceScale = app.screen.width / totalFenceWidth;
    const skinY = app.screen.height - skinTexture.height * skinScale;
    return Math.round(skinY - fenceTexture.height * fenceScale);
  }

  private applyFenceTransition(): void {
    const progress = this.easeOutCubic(this.fenceRevealProgress);
    const leftOffset = this.fenceLeft ? -this.fenceLeft.width * (1 - progress) : -app.screen.width * 0.5 * (1 - progress);
    if (this.fenceLeft && this.fenceRight) {
      const w = app.screen.width;
      this.fenceLeft.x = leftOffset;
      this.fenceRight.x = w - this.fenceRight.width * progress;
    }
    if (this.baseHpLayer) {
      const hiddenX = -this.baseHpLayer.width - 4;
      this.baseHpLayer.x = hiddenX + (this.baseHpLayerHomeX - hiddenX) * progress;
      this.baseHpLayer.alpha = progress;
    }
  }

  private easeOutCubic(value: number): number {
    return 1 - Math.pow(1 - Math.min(1, Math.max(0, value)), 3);
  }

  private friendlyAreaCenterY(fallbackY: number): number {
    const skinH = this.friendlyAreaHeight();
    if (skinH <= 0) return fallbackY;
    return app.screen.height - skinH / 2;
  }

  private friendlyAreaHeight(): number {
    const texture = assetManager.texture("battle_friendly_area_skin");
    if (!texture) return 0;
    const skinScale = app.screen.width / texture.width;
    return texture.height * skinScale;
  }

  private assetDisplaySize(assetKey: string | undefined, fallback: number): number {
    const texture = assetManager.texture(assetKey);
    if (!texture) return fallback;
    return Math.max(texture.width, texture.height);
  }

  private createBattleWeaponSlot(item: ItemDef, iconSize: number, slotSize: number): Container {
    const c = new Container();
    const boxSize = this.assetDisplaySize("battle_weapon_slot_box", slotSize) * 0.5;
    const boxTexture = assetManager.texture("battle_weapon_slot_box");
    const box = spriteFromAsset("battle_weapon_slot_box", (boxTexture?.width ?? boxSize) * 0.5, (boxTexture?.height ?? boxSize) * 0.5);
    if (box) {
      box.anchor.set(0.5);
      c.addChild(box);
    } else {
      const fallback = new Graphics();
      fallback.roundRect(-boxSize / 2, -boxSize / 2, boxSize, boxSize, 10).fill({ color: 0xb46f2e, alpha: 0.95 });
      fallback.stroke({ color: 0x5b3518, width: 3, alpha: 0.9 });
      c.addChild(fallback);
    }

    const artSize = iconSize;
    const art = spriteFromAsset(item.battleIconAssetKey || item.iconAssetKey || `weapon_${item.icon}_icon`, artSize, artSize);
    if (art) {
      art.anchor.set(0.5);
      art.position.set(0, -slotSize * 0.04);
      c.addChild(art);
      return c;
    }

    const fallbackIcon = new Graphics();
    fallbackIcon.circle(0, -slotSize * 0.04, artSize * 0.32).fill({ color: 0x78c95b, alpha: 0.96 });
    fallbackIcon.stroke({ color: 0x315b25, width: 3, alpha: 0.9 });
    c.addChild(fallbackIcon);
    return c;
  }

  private spawnDue(): void {
    while (this.spawnQueue.length > 0 && this.spawnQueue[0].time <= this.time) {
      const spawn = this.spawnQueue.shift()!;
      this.currentWave = Math.max(this.currentWave, spawn.wave);
      this.spawnMonster(spawn);
    }
  }

  private spawnMonster(spawn: WaveSpawnEvent): void {
    const def = createEffectiveMonster(data.getMonster(spawn.monsterId), spawn.tuning);
    const w = app.screen.width;
    const { x, y } = chooseMonsterSpawnPosition(
      w,
      this.monsters.filter((monster) => !monster.dead).map((monster) => ({ x: monster.x, y: monster.y })),
      Math.random,
      16,
      def.layerType === "boss" ? "center" : "spread",
    );
    const animationKey = getMonsterAnimationKey(def, false);
    const view = this.createMonsterView(def, animationKey);
    const hpBar = def.boss ? this.addMonsterHpBar(view, def) : undefined;
    view.position.set(x, y);
    this.monsterLayer.addChild(view);
    this.monsters.push({ uid: nextUid(), def, view, hpBarTrack: hpBar?.track, hpBarFill: hpBar?.fill, hp: def.hp, maxHp: def.hp, x, y, slowTimer: 0, hitStopTimer: 0, attackCooldown: 0, dead: false, deathVisualDone: false, animationKey, spawnAge: 0 });
    if (def.boss) {
      audio.playMusicEvent("music_boss");
      this.showBossArrivalWarning();
    }
  }

  private createMonsterView(def: MonsterDef, animationKey?: string): Container {
    const c = new Container();
    const animated = animationKey ? assetManager.animation(animationKey) : undefined;
    if (animated) {
      animated.play();
      c.addChild(animated);
      return c;
    }
    const body = new Graphics();
    const r = def.radius;
    body.circle(0, 0, r).fill({ color: color(def.color) }).stroke({ color: 0x1a1f27, width: 3 });
    body.circle(-r * 0.28, -r * 0.12, Math.max(3, r * 0.13)).fill({ color: 0xffffff });
    body.circle(r * 0.28, -r * 0.12, Math.max(3, r * 0.13)).fill({ color: 0xffffff });
    body.roundRect(-r * 0.28, r * 0.22, r * 0.56, 4, 2).fill({ color: 0x1b2028 });
    c.addChild(body);
    return c;
  }

  private addMonsterHpBar(view: Container, def: MonsterDef): { track: Graphics; fill: Graphics } {
    const r = def.radius;
    const barWidth = Math.max(72, r * 2.8);
    const barHeight = 12;
    const barX = -barWidth / 2;
    const barY = -r * 1.55;
    const track = new Graphics();
    track.roundRect(barX, barY, barWidth, barHeight, 6).fill({ color: 0x1b2028, alpha: 0.9 });
    track.roundRect(barX + 2, barY + 2, barWidth - 4, barHeight - 4, 4).fill({ color: 0x4a1f2b, alpha: 0.95 });
    const fill = new Graphics();
    view.addChild(track, fill);
    this.redrawMonsterHpBar({ def, hp: def.hp, maxHp: def.hp, hpBarFill: fill } as MonsterRuntime);
    return { track, fill };
  }

  private redrawMonsterHpBar(monster: MonsterRuntime): void {
    if (!monster.hpBarFill || monster.hpBarFill.destroyed) return;
    const r = monster.def.radius;
    const barWidth = Math.max(72, r * 2.8);
    const barHeight = 12;
    const innerWidth = barWidth - 4;
    const fillWidth = getMonsterHpFillWidth(monster.hp, monster.maxHp, innerWidth);
    monster.hpBarFill.clear();
    if (fillWidth <= 0) return;
    monster.hpBarFill
      .roundRect(-barWidth / 2 + 2, -r * 1.55 + 2, fillWidth, barHeight - 4, 4)
      .fill({ color: 0xffd25a });
  }

  private updateWeapons(dt: number): void {
    for (const placed of this.bag.placed) {
      placed.cdLeft -= dt;
      if (placed.cdLeft > 0) continue;
      const item = data.getItem(placed.itemId);
      const skill = data.getSkill(item.skillId);
      const target = this.pickTarget(skill);
      if (skill.type !== "shield" && skill.type !== "heal" && !target) continue;
      this.fireSkill(placed, item, skill, target);
      placed.cdLeft = Math.max(0.25, skill.cd * this.buffs.cdMul);
    }
  }

  private initializeWeaponCooldowns(): void {
    const staggerSeconds = data.getEconomy("battle_initial_cd_stagger") || 0.08;
    for (const placed of this.bag.placed) {
      const item = data.getItem(placed.itemId);
      const skill = data.getSkill(item.skillId);
      placed.cdLeft = getInitialWeaponCooldown(skill.cd, this.buffs.cdMul, placed.uid, staggerSeconds);
    }
  }

  private pickTarget(skill: SkillDef): MonsterRuntime | undefined {
    const alive = this.monsters.filter((monster) => !monster.dead && monster.hp > 0);
    const incomingByUid = new Map<number, number>();
    for (const projectile of this.projectiles) {
      if (projectile.target.dead) continue;
      incomingByUid.set(projectile.target.uid, (incomingByUid.get(projectile.target.uid) ?? 0) + 1);
    }
    return chooseBalancedTarget(alive, skill.targetRule, incomingByUid, (monster) => this.countNear(monster));
  }

  private countNear(monster: MonsterRuntime): number {
    return this.monsters.filter((other) => !other.dead && Math.hypot(other.x - monster.x, other.y - monster.y) < 120).length;
  }

  private fireSkill(placed: PlacedItem, item: ItemDef, skill: SkillDef, target?: MonsterRuntime): void {
    if (this.farmBaseMode) this.options.onFarmWeaponAttack?.(placed.uid);
    else this.playHeroAttack();
    const qMul = this.buffs.qualityAttack[item.quality] ?? 1;
    const damage = skill.attack * data.getQuality(item.quality).attackMul * this.buffs.attackMul * qMul * (skill.type === "dot" ? this.buffs.dotMul : 1);
    const start = this.farmBaseMode ? this.getFarmCastPoint(placed) : this.getHeroCastPoint(placed.uid);
    const startX = start.x;
    const startY = start.y;
    const projectileAssetKey = this.visualProjectileAssetKey(item);
    if ((skill.type === "projectile" || shouldUseVisualProjectile(skill) || projectileAssetKey) && target) {
      audio.playSfxEvent("battle_shoot");
      const view = this.createProjectileView(color(skill.color), projectileAssetKey ? undefined : skill.projectileAnimKey, projectileAssetKey);
      view.position.set(startX, startY);
      this.projectileLayer.addChild(view);
      this.projectiles.push({
        view,
        target,
        skill,
        x: startX,
        y: startY,
        speed: Math.max(1, skill.speed),
        damage,
        radius: skill.radius,
        color: color(skill.color),
        hitDistance: 24,
        rotateToTarget: skill.projectileRotateToTarget ?? (!skill.projectileAnimKey && !projectileAssetKey),
      });
    } else if ((skill.type === "aoe" || skill.type === "dot") && target) {
      audio.playSfxEvent("battle_cast");
      const radius = skill.radius * this.buffs.radiusMul;
      this.areaDamage(target.x, target.y, radius, damage, skill);
    } else if (skill.type === "melee" && target) {
      audio.playSfxEvent("battle_hit");
      this.areaDamage(target.x, target.y, skill.radius, damage, skill);
    } else if (skill.type === "shield") {
      const effect = data.getEffect(skill.effectId);
      this.buffs.armorBonus += effect?.value ?? 1;
      this.addFloating(startX, startY - 20, `护甲+${effect?.value ?? 1}`, 0x7ee08a);
    } else if (skill.type === "heal") {
      const effect = data.getEffect(skill.effectId);
      this.baseHp = Math.min(this.baseMaxHp, this.baseHp + (effect?.value ?? 40));
      this.syncSessionProgress();
      this.addFloating(startX, startY - 20, `+${effect?.value ?? 40}`, 0x45ff99);
    }
  }

  private visualProjectileAssetKey(item: ItemDef): string | undefined {
    if (item.baseId !== "bomb" && item.baseId !== "staff") return undefined;
    return item.projectileAssetKey;
  }

  private getFarmCastPoint(placed: PlacedItem): { x: number; y: number } {
    const board = this.options.farmBoard;
    if (!board) return this.getHeroCastPoint(placed.uid);
    const item = data.getItem(placed.itemId);
    const shape = data.getShape(item.shapeId);
    const maxX = Math.max(...shape.cells.map(([x]) => x));
    const maxY = Math.max(...shape.cells.map(([, y]) => y));
    const pitch = board.cellSize + board.cellGap;
    return {
      x: board.gridLeft + placed.x * pitch + (maxX + 1) * pitch / 2 - board.cellGap / 2,
      y: board.gridTop + placed.y * pitch + (maxY + 1) * pitch / 2 - board.cellGap / 2 - board.cellSize * 0.38,
    };
  }

  private areaDamage(x: number, y: number, radius: number, damage: number, skill: SkillDef): void {
    let hitAny = false;
    let killedAny = false;
    for (const monster of this.monsters) {
      if (!monster.dead && Math.hypot(monster.x - x, monster.y - y) <= radius) {
        const result = this.damageMonster(monster, damage, skill);
        hitAny = true;
        killedAny ||= result.killed;
      }
    }
    const playedAnimatedEffect = hitAny && this.playImpactEffect(skill, killedAny, x, y);
    if (!playedAnimatedEffect) {
      const fx = new Graphics();
      fx.circle(0, 0, radius).fill({ color: color(skill.color), alpha: 0.18 });
      fx.circle(0, 0, radius * 0.55).stroke({ color: color(skill.color), width: 5, alpha: 0.8 });
      fx.position.set(x, y);
      this.groundFxLayer.addChild(fx);
      this.floating.push({ view: fx, ttl: 0.35, vy: 0 });
    }
  }

  private updateMonsters(dt: number): void {
    for (const monster of this.monsters) {
      if (monster.dead) continue;
      monster.slowTimer = Math.max(0, monster.slowTimer - dt);
      monster.hitStopTimer = Math.max(0, monster.hitStopTimer - dt);
      if (monster.hitStopTimer > 0) {
        this.updateMonsterAnimation(monster, false);
        monster.view.position.set(monster.x, monster.y + Math.sin(this.time * 8 + monster.uid) * 2);
        monster.view.scale.set(1 + Math.sin(this.time * 9 + monster.uid) * 0.035, 1 - Math.sin(this.time * 9 + monster.uid) * 0.025);
        continue;
      }
      const speedMul = monster.speedBuffMul ?? 1;
      const attackMul = monster.attackBuffMul ?? 1;
      const attackSpeedMul = monster.attackSpeedBuffMul ?? 1;
      monster.spawnAge = (monster.spawnAge ?? 0) + dt;
      monster.bossBuffTimer = Math.max(0, (monster.bossBuffTimer ?? 0) - dt);
      if (monster.bossBuffTimer <= 0) {
        monster.speedBuffMul = 1;
        monster.attackBuffMul = 1;
        monster.attackSpeedBuffMul = 1;
      }
      monster.bossRoarTimer = Math.max(0, (monster.bossRoarTimer ?? 0) - dt);
      this.tryTriggerBossRoar(monster, false, dt);
      const freezeForCast = shouldFreezeMonsterMovement(monster.bossRoarTimer);
      const attackAnim = monster.bossRoarTimer && monster.bossRoarTimer > 0 ? undefined : monster.def.attackAnimKey ? data.getAnimation(monster.def.attackAnimKey) : undefined;
      const hasAnimatedAttack = Boolean(attackAnim);
      const baseHitY = this.baseFenceContactY(monster);
      const contactY = this.baseContactY(monster);
      monster.lastBaseHitY = baseHitY;
      monster.lastContactY = contactY;
      if (freezeForCast) {
        monster.view.position.set(monster.x, monster.y + Math.sin(this.time * 8 + monster.uid) * 2);
        monster.view.scale.set(1 + Math.sin(this.time * 9 + monster.uid) * 0.035, 1 - Math.sin(this.time * 9 + monster.uid) * 0.025);
        continue;
      }
      const contact = stepMonsterContact({
        y: monster.y,
        speed: monster.def.speed * speedMul,
        slowTimer: monster.slowTimer,
        attackCooldown: hasAnimatedAttack ? Number.POSITIVE_INFINITY : monster.attackCooldown,
        dt,
        contactY,
        attack: monster.def.attack * attackMul,
        attackInterval: monster.def.attackInterval,
        armor: this.armor,
        armorBonus: this.buffs.armorBonus,
      });
      monster.y = contact.y;
      monster.attackCooldown = hasAnimatedAttack ? monster.attackCooldown : contact.attackCooldown;
      this.updateMonsterAnimation(monster, contact.contacted);
      monster.view.position.set(monster.x, monster.y + Math.sin(this.time * 8 + monster.uid) * 2);
      monster.view.scale.set(1 + Math.sin(this.time * 9 + monster.uid) * 0.035, 1 - Math.sin(this.time * 9 + monster.uid) * 0.025);
      let damage = contact.damage;
      if (hasAnimatedAttack) {
        const animatedAttack = stepAnimatedMonsterAttack({
          contacted: contact.contacted,
          attackCooldown: monster.attackCooldown,
          attackWindupTimer: monster.attackWindupTimer ?? 0,
          attackDamagePending: monster.attackDamagePending ?? false,
          dt,
          attack: monster.def.attack * attackMul,
          attackInterval: monster.def.attackInterval,
          attackSpeedMul,
          armor: this.armor,
          armorBonus: this.buffs.armorBonus,
          animation: attackAnim,
          fallbackHitTime: data.getBattleField(this.level.battleFieldKey).monsterAttackHitTime,
          useFrameEvent: true,
        });
        monster.attackCooldown = animatedAttack.attackCooldown;
        monster.attackWindupTimer = animatedAttack.attackWindupTimer;
        monster.attackDamagePending = animatedAttack.attackDamagePending;
        damage = animatedAttack.damage;
        if (animatedAttack.startedAttack) {
          this.restartMonsterAnimation(monster, monster.def.attackAnimKey, this.getMonsterAttackAnimationSpeedMul(monster, attackAnim), attackAnim, animatedAttack.frameEventDamage);
        }
      }
      if (damage > 0) {
        this.applyBaseDamage(monster, damage);
      }
    }
    this.separateAndSortMonsters();
  }

  private separateAndSortMonsters(): void {
    const alive = this.monsters.filter((monster) => !monster.dead);
    const points = alive.map((monster) => ({
      uid: monster.uid,
      x: monster.x,
      y: monster.y,
      radius: monster.def.radius,
    }));
    separateMonsterCrowd(points, app.screen.width);
    const pointsByUid = new Map(points.map((point) => [point.uid, point]));
    for (const monster of alive) {
      const point = pointsByUid.get(monster.uid);
      if (!point) continue;
      monster.x = point.x;
      monster.y = Math.min(this.baseContactY(monster), point.y);
      monster.view.position.set(monster.x, monster.y + Math.sin(this.time * 8 + monster.uid) * 2);
      monster.view.zIndex = getMonsterDepthZIndex(monster.y, monster.uid, monster.def.layerType);
    }
    this.monsterLayer.sortChildren();
  }

  private updateMonsterAnimation(monster: MonsterRuntime, contacted: boolean): void {
    if (monster.bossRoarTimer && monster.bossRoarTimer > 0) return;
    const nextKey = getMonsterAnimationKey(monster.def, contacted);
    if (!nextKey || nextKey === monster.animationKey) return;
    if (shouldKeepPendingAttackAnimation(monster.attackDamagePending ?? false, monster.animationKey, monster.def.attackAnimKey, nextKey)) return;
    const animated = assetManager.animation(nextKey);
    if (!animated) return;
    this.replaceMonsterLiveVisual(monster, animated, this.getMonsterAnimationSpeedMul(monster, nextKey));
    monster.animationKey = nextKey;
  }

  private restartMonsterAnimation(
    monster: MonsterRuntime,
    animationKey: string | undefined,
    animationSpeedMul = 1,
    animation?: AnimationDef,
    frameEventDamage = 0,
  ): void {
    if (!animationKey) return;
    const animated = assetManager.animation(animationKey);
    if (!animated) return;
    if (frameEventDamage > 0 && animation) this.bindMonsterAttackFrameEvents(monster, animated, animation, frameEventDamage);
    this.replaceMonsterLiveVisual(monster, animated, animationSpeedMul);
    monster.animationKey = animationKey;
    monster.view.zIndex = getMonsterDepthZIndex(monster.y, monster.uid, monster.def.layerType);
  }

  private bindMonsterAttackFrameEvents(monster: MonsterRuntime, animated: AnimatedSprite, animation: AnimationDef, damage: number): void {
    const frameCount = Math.max(1, animation.frames.length);
    const damageFrame = animation.damageFrame ?? (animation.hitFrame === undefined ? undefined : animation.hitFrame + 1);
    const damageIndex = getAnimationEventFrameIndex(damageFrame, frameCount);
    const shakeIndex = animation.shakeFrame === undefined ? damageIndex : getAnimationEventFrameIndex(animation.shakeFrame, frameCount);
    let damageDone = false;
    let shakeDone = false;
    animated.onFrameChange = (currentFrame) => {
      if (!shakeDone && currentFrame >= shakeIndex) {
        shakeDone = true;
        const shake = getBaseShakeFeedback(monster.def.boss);
        if (shake) this.startBaseShake(shake.duration, shake.amplitude);
      }
      if (!damageDone && currentFrame >= damageIndex) {
        damageDone = true;
        monster.attackDamagePending = false;
        this.applyBaseDamage(monster, damage, !shakeDone);
      }
    };
  }

  private replaceMonsterLiveVisual(monster: MonsterRuntime, animated: AnimatedSprite, animationSpeedMul = 1): void {
    const keepZIndex = monster.view.zIndex;
    const overlays = [monster.hpBarTrack, monster.hpBarFill];
    for (const child of [...monster.view.children]) {
      if (shouldPreserveMonsterOverlayChild(child, overlays)) continue;
      child.removeFromParent();
      child.destroy({ children: true });
    }
    animated.animationSpeed *= Math.max(0.01, animationSpeedMul);
    animated.play();
    monster.view.addChildAt(animated, 0);
    monster.view.zIndex = keepZIndex;
  }

  private getMonsterAnimationSpeedMul(monster: MonsterRuntime, animationKey: string): number {
    if (animationKey !== monster.def.attackAnimKey) return 1;
    return this.getMonsterAttackAnimationSpeedMul(monster, data.getAnimation(animationKey));
  }

  private getMonsterAttackAnimationSpeedMul(monster: MonsterRuntime, animation: AnimationDef | undefined): number {
    return resolveAnimatedMonsterAttackTiming({
      animation,
      fallbackHitTime: data.getBattleField(this.level.battleFieldKey).monsterAttackHitTime,
      attackInterval: monster.def.attackInterval,
      attackSpeedMul: monster.attackSpeedBuffMul ?? 1,
    }).animationSpeedMul;
  }

  private applyBaseDamage(monster: MonsterRuntime, damage: number, includeShake = true): void {
    this.baseHp -= damage;
    this.bag.baseHp = Math.max(0, this.baseHp);
    this.syncSessionProgress();
    audio.playSfxEvent(this.monsterAttackSfxEvent(monster));
    this.addBaseDamageFloating(monster.x, (monster.lastBaseHitY ?? this.baseFenceContactY(monster)) - 18, damage);
    const shake = getBaseShakeFeedback(monster.def.boss);
    if (includeShake && shake) this.startBaseShake(shake.duration, shake.amplitude);
  }

  private monsterAttackSfxEvent(monster: MonsterRuntime): string {
    if (monster.def.boss) return "monster_boss_attack";
    if (monster.def.id === 2 || monster.def.layerType === "flying") return "monster_bat_attack";
    return "monster_zombie_attack";
  }

  private baseContactY(monster: MonsterRuntime): number {
    return resolveMonsterAttackContactY({
      baseContactY: this.baseFenceContactY(monster),
      attackDistance: monster.def.attackDistance,
    });
  }

  private baseFenceContactY(monster: MonsterRuntime): number {
    const h = app.screen.height;
    const field = data.getBattleField(this.level.battleFieldKey);
    return resolveMonsterContactY({
      screenHeight: h,
      configuredY: field.monsterContactY,
      fenceForegroundY: field.monsterContactMode === "fenceForeground" ? this.resolveFenceForegroundY(field) : undefined,
      monsterContactOffsetY: field.monsterContactOffsetY,
      monsterRadius: monster.def.radius,
    });
  }

  private updateProjectiles(dt: number): void {
    for (const projectile of [...this.projectiles]) {
      if (projectile.target.dead) {
        this.removeProjectile(projectile);
        continue;
      }
      const dx = projectile.target.x - projectile.x;
      const dy = projectile.target.y - projectile.y;
      const dist = Math.max(1, Math.hypot(dx, dy));
      const move = projectile.speed * dt;
      projectile.x += (dx / dist) * move;
      projectile.y += (dy / dist) * move;
      projectile.view.position.set(projectile.x, projectile.y);
      if (projectile.rotateToTarget) projectile.view.rotation = Math.atan2(dy, dx);
      if (projectile.spinSpeed) projectile.view.rotation += this.time * projectile.spinSpeed;
      if (dist <= projectile.hitDistance || move >= dist) {
        const shouldReleaseView = this.resolveProjectileHit(projectile);
        if (shouldReleaseView) {
          this.removeProjectile(projectile);
        } else {
          this.projectiles = this.projectiles.filter((item) => item !== projectile);
        }
      }
    }
  }

  private resolveProjectileHit(projectile: ProjectileRuntime): boolean {
    if (usesAreaImpact(projectile.skill)) {
      if ((projectile.skill.impactSpinTurns ?? 0) !== 0 || (projectile.skill.impactDelayDuration ?? 0) > 0) {
        this.startDelayedImpact(projectile);
        return false;
      }
      this.areaDamage(projectile.target.x, projectile.target.y, projectile.radius, projectile.damage, projectile.skill);
      return true;
    }
    const hitX = projectile.target.x;
    const hitY = projectile.target.y;
    const result = this.damageMonster(projectile.target, projectile.damage, projectile.skill);
    this.playImpactEffect(
      projectile.skill,
      result.killed,
      hitX,
      hitY,
      projectile.skill.hitUseProjectileRotation ? projectile.view.rotation : 0,
    );
    return true;
  }

  private startDelayedImpact(projectile: ProjectileRuntime): void {
    const x = projectile.target.x;
    const y = projectile.target.y;
    projectile.view.position.set(x, y);
    this.delayedImpacts.push({
      view: projectile.view,
      x,
      y,
      radius: projectile.radius,
      damage: projectile.damage,
      skill: projectile.skill,
      elapsed: 0,
      duration: Math.max(0.01, projectile.skill.impactDelayDuration ?? projectile.skill.impactSpinDuration ?? 0.55),
      turns: projectile.skill.impactSpinTurns ?? 2,
      startRotation: projectile.view.rotation,
    });
  }

  private removeProjectile(projectile: ProjectileRuntime): void {
    this.releaseCombatVisual(projectile.view);
    this.projectiles = this.projectiles.filter((item) => item !== projectile);
  }

  private updateDelayedImpacts(dt: number): void {
    for (const impact of [...this.delayedImpacts]) {
      impact.elapsed += dt;
      const progress = Math.min(1, impact.elapsed / impact.duration);
      if (impact.turns !== 0) impact.view.rotation = impact.startRotation + progress * impact.turns * Math.PI * 2;
      if (progress >= 1) {
        this.delayedImpacts = this.delayedImpacts.filter((item) => item !== impact);
        this.releaseCombatVisual(impact.view);
        audio.playSfxEvent("battle_cast");
        this.areaDamage(impact.x, impact.y, impact.radius, impact.damage, impact.skill);
      }
    }
  }

  private createSpinZone(x: number, y: number, radius: number, damage: number, fill: number, assetKey?: string): void {
    const zone = new Container();
    const range = new Graphics();
    range.circle(0, 0, radius).fill({ color: fill, alpha: 0.13 });
    range.circle(0, 0, radius * 0.62).stroke({ color: fill, width: 4, alpha: 0.72 });
    zone.addChild(range);

    const blade = spriteFromAsset(assetKey, 54, 54);
    if (blade) {
      blade.anchor.set(0.5);
      zone.addChild(blade);
    } else {
      const fallback = new Graphics();
      fallback.roundRect(-24, -8, 48, 16, 8).fill({ color: fill, alpha: 0.95 }).stroke({ color: 0xffffff, width: 3, alpha: 0.72 });
      zone.addChild(fallback);
    }
    zone.position.set(x, y);
    this.projectileLayer.addChild(zone);
    this.spinZones.push({ view: zone, x, y, radius, damage, ttl: 1, hitUids: new Set(), spinSpeed: 18 });
  }

  private updateSpinZones(dt: number): void {
    for (const zone of [...this.spinZones]) {
      zone.ttl -= dt;
      zone.view.rotation += zone.spinSpeed * dt;
      zone.view.alpha = Math.max(0, Math.min(1, zone.ttl / 0.25));
      for (const monster of this.monsters) {
        if (monster.dead || zone.hitUids.has(monster.uid)) continue;
        if (Math.hypot(monster.x - zone.x, monster.y - zone.y) <= zone.radius + monster.def.radius * 0.35) {
          zone.hitUids.add(monster.uid);
          this.damageMonster(monster, zone.damage);
        }
      }
      if (zone.ttl <= 0) {
        zone.view.destroy({ children: true } as DestroyOptions);
        this.spinZones = this.spinZones.filter((item) => item !== zone);
      }
    }
  }

  private damageMonster(monster: MonsterRuntime, amount: number, skill?: SkillDef): DamageResult {
    audio.playSfxEvent("battle_hit");
    const damage = Math.max(1, amount - monster.def.armor);
    monster.hp -= damage;
    this.redrawMonsterHpBar(monster);
    const killed = monster.hp <= 0;
    this.addDamageFloating(monster.x, monster.y - 36, damage, killed);
    if (skill?.effectId) {
      const effect = data.getEffect(skill.effectId);
      if (effect?.type === "slow") monster.slowTimer = effect.duration;
    }
    if (skill?.hitStopDuration) {
      monster.hitStopTimer = Math.max(monster.hitStopTimer, skill.hitStopDuration);
    }
    if (!killed) this.tryTriggerBossRoar(monster, true, 0);
    if (killed) {
      this.killMonster(monster, true);
    }
    return { damage, killed };
  }

  private tryTriggerBossRoar(monster: MonsterRuntime, bossWasHit: boolean, dt: number): void {
    if (!monster.def.boss || monster.dead) return;
    if (monster.attackDamagePending) return;
    const skill = data.getBossSkill(monster.def.roarSkillKey);
    const targets = this.monsters.filter((other) => other.uid !== monster.uid && !other.dead);
    const result = stepBossRoarCooldown({
      skill,
      cooldown: monster.bossRoarCooldown ?? 0,
      dt,
      bossWasHit,
      spawnAge: monster.spawnAge ?? 0,
      targetCount: targets.length,
    });
    monster.bossRoarCooldown = result.cooldown;
    if (!result.shouldCast || !skill) return;
    audio.playSfxEvent("monster_boss_roar");
    this.restartMonsterAnimation(monster, skill.animKey);
    const anim = data.getAnimation(skill.animKey);
    monster.bossRoarTimer = (anim?.frames.length ?? 1) / Math.max(1, anim?.fps ?? 12);
    for (const other of targets) {
      const buff = applyBossRoarBuff(other.speedBuffMul ?? 1, other.attackBuffMul ?? 1, other.attackSpeedBuffMul ?? 1, skill);
      other.speedBuffMul = buff.speedMul;
      other.attackBuffMul = buff.attackMul;
      other.attackSpeedBuffMul = buff.attackSpeedMul;
      other.bossBuffTimer = Math.max(other.bossBuffTimer ?? 0, skill.duration);
    }
    this.addFloating(monster.x, monster.y - 64, "怒吼强化!", 0xff7a38);
  }

  private killMonster(monster: MonsterRuntime, reward: boolean): void {
    monster.dead = true;
    if (!this.playMonsterDeath(monster)) {
      monster.deathVisualDone = true;
      monster.view.destroy({ children: true } as DestroyOptions);
    }
    if (reward) {
      this.kills += 1;
      this.bag.gold += monster.def.gold;
      this.exp += monster.def.exp;
      this.syncSessionProgress();
      this.addFloating(monster.x, monster.y, `+${monster.def.gold}`, 0xffdf59);
      this.checkLevelUp();
    }
  }

  private playMonsterDeath(monster: MonsterRuntime): boolean {
    const animationKey = getMonsterDeathAnimationKey(monster.def);
    const animated = animationKey ? assetManager.animation(animationKey) : undefined;
    if (!animated) return false;
    monster.deathVisualDone = false;
    for (const child of monster.view.removeChildren()) child.destroy({ children: true });
    animated.loop = false;
    animated.onComplete = () => {
      animated.gotoAndStop(Math.max(0, animated.totalFrames - 1));
      this.fadeAndRelease(monster.view, 0.32, () => {
        monster.deathVisualDone = true;
      });
    };
    animated.play();
    monster.view.addChild(animated);
    monster.animationKey = animationKey;
    return true;
  }

  private checkLevelUp(): void {
    const need = getExpNeed(this.levelNo, this.tuning);
    if (this.exp >= need) {
      this.exp -= need;
      this.levelNo += 1;
      this.syncSessionProgress();
      // 买量视频阶段先关闭升级三选一触发，避免玩家被阅读选择打断。
      if (shouldOpenRogueOptionsOnLevelUp()) {
        audio.playSfxEvent("battle_level_up");
        this.showRogueOptions();
      }
    }
  }

  private showRogueOptions(): void {
    this.setBattlePaused(true);
    const options = this.pickRogueOptions();
    this.modalWindow?.destroy();
    this.modalWindow = new WndRogueOption(options, (option) => {
      this.applyRogueOption(option);
      this.modalWindow?.destroy();
      this.modalWindow = undefined;
      this.setBattlePaused(false);
    });
    this.container.addChild(this.modalWindow.container);
  }

  private pickRogueOptions(): RogueOptionDef[] {
    const pool = [...data.getRogueOptions(this.level.roguePoolId)];
    const result: RogueOptionDef[] = [];
    while (pool.length > 0 && result.length < 3) {
      const pick = weightedPick(pool);
      result.push(pick);
      pool.splice(pool.indexOf(pick), 1);
    }
    return result;
  }

  private applyRogueOption(option: RogueOptionDef): void {
    analytics.track("rogue_option_select", { levelId: this.level.id, optionId: option.id, effectType: option.effectType });
    if (option.effectType === "attackMul") this.buffs.attackMul *= option.effectValue;
    else if (option.effectType === "cdMul") this.buffs.cdMul *= option.effectValue;
    else if (option.effectType === "heal") this.baseHp = Math.min(this.baseMaxHp, this.baseHp + option.effectValue);
    else if (option.effectType === "radiusMul") this.buffs.radiusMul *= option.effectValue;
    else if (option.effectType === "dotBoost") {
      this.buffs.dotMul *= option.effectValue;
      this.buffs.attackMul *= 1.06;
    } else if (option.effectType === "armorAdd") this.buffs.armorBonus += option.effectValue;
    else if (option.effectType === "qualityAttackMul") this.buffs.qualityAttack[Number(option.effectTarget)] = option.effectValue;
    else if (option.effectType === "overload") {
      this.buffs.attackMul *= option.effectValue;
      this.buffs.cdMul *= 0.92;
    } else if (option.effectType === "repair") {
      this.baseHp = Math.min(this.baseMaxHp, this.baseHp + option.effectValue);
      this.buffs.armorBonus += 2;
    }
    this.syncSessionProgress();
    this.addFloating(app.screen.width / 2, app.screen.height * 0.32, option.title, 0xffdf59);
  }

  private updateFloating(dt: number): void {
    for (const item of [...this.floating]) {
      item.ttl -= dt;
      item.view.y += item.vy * dt;
      const maxTtl = item.maxTtl ?? 0.7;
      const life = Math.max(0, item.ttl / maxTtl);
      item.view.alpha = Math.min(1, life * 1.35);
      if (item.popScale !== undefined) {
        const progress = 1 - life;
        const scale = 1 + (item.popScale - 1) * Math.max(0, 1 - progress * 4);
        item.view.scale.set(scale);
      }
      if (item.ttl <= 0) {
        item.view.destroy({ children: true } as DestroyOptions);
        this.floating = this.floating.filter((f) => f !== item);
      }
    }
  }

  private fadeAndRelease(view: Container, duration: number, onComplete?: () => void): void {
    if (view.destroyed) return;
    view.alpha = 1;
    this.fadeReleases.push({ view, duration: Math.max(0.01, duration), elapsed: 0, onComplete });
  }

  private updateFadeReleases(dt: number): void {
    for (const item of [...this.fadeReleases]) {
      item.elapsed += dt;
      item.view.alpha = Math.max(0, 1 - item.elapsed / item.duration);
      if (item.elapsed >= item.duration) {
        this.fadeReleases = this.fadeReleases.filter((fade) => fade !== item);
        item.onComplete?.();
        this.releaseCombatVisual(item.view);
      }
    }
  }

  private updateHitHolds(dt: number): void {
    for (const hold of [...this.hitHolds]) {
      hold.elapsed += dt;
      if (hold.elapsed > hold.holdDuration) {
        const fadeElapsed = hold.elapsed - hold.holdDuration;
        hold.view.alpha = Math.max(0, 1 - fadeElapsed / hold.fadeDuration);
      }
      if (hold.elapsed >= hold.holdDuration + hold.fadeDuration) {
        this.hitHolds = this.hitHolds.filter((item) => item !== hold);
        this.releaseCombatVisual(hold.view);
      }
    }
  }

  private ensureHero(): AnimatedSprite | undefined {
    if (this.hero) return this.hero;
    const hero = assetManager.animation(this.heroAnimKey);
    if (!hero) return undefined;
    const anim = data.getAnimation(this.heroAnimKey);
    hero.loop = false;
    hero.animationSpeed = (anim?.fps ?? 12) / 60;
    hero.scale.set(anim?.scale ?? 1);
    hero.gotoAndStop(0);
    this.hero = hero;
    this.heroLayer.addChild(hero);
    return hero;
  }

  private positionHero(x: number, y: number): void {
    const hero = this.ensureHero();
    this.heroCastX = x;
    this.heroCastY = y - 132;
    if (!hero) return;
    hero.position.set(x, y);
  }

  private getHeroCastPoint(seed: number): { x: number; y: number } {
    const spread = ((seed % 5) - 2) * 5;
    return {
      x: this.heroCastX + spread,
      y: this.heroCastY,
    };
  }

  private createProjectileView(fill: number, animationKey?: string, assetKey?: string): Container {
    const c = new Container();
    const animated = animationKey ? assetManager.animation(animationKey) : undefined;
    if (animated) {
      animated.play();
      c.addChild(animated);
      return c;
    }
    const trail = new Graphics();
    trail.moveTo(-34, 0).lineTo(-8, 0).stroke({ color: fill, width: 8, alpha: 0.34 });
    trail.moveTo(-26, 0).lineTo(-6, 0).stroke({ color: 0xffffff, width: 3, alpha: 0.38 });
    const art = spriteFromAsset(assetKey, 150, 150);
    if (art) {
      art.anchor.set(0.5);
      c.addChild(trail, art);
      return c;
    }
    const orb = new Graphics();
    orb.circle(0, 0, 12).fill({ color: fill, alpha: 0.95 }).stroke({ color: 0xffffff, width: 3, alpha: 0.72 });
    orb.circle(0, 0, 20).fill({ color: fill, alpha: 0.18 });
    c.addChild(trail, orb);
    return c;
  }

  private playImpactEffect(skill: SkillDef, killed: boolean, x: number, y: number, rotation = 0): boolean {
    return this.playHitEffect(getImpactAnimationKey(skill, killed), x, y, rotation, killed ? this.deathFxLayer : this.hitFxLayer);
  }

  private playHitEffect(animationKey: string | undefined, x: number, y: number, rotation = 0, layer: Container = this.hitFxLayer): boolean {
    const animated = animationKey ? assetManager.animation(animationKey) : undefined;
    if (!animated) return false;
    const anim = animationKey ? data.getAnimation(animationKey) : undefined;
    animated.loop = false;
    animated.position.set(x, y);
    animated.rotation = rotation;
    if (anim?.hitHoldFrame !== undefined) {
      const holdFrame = Math.max(0, Math.min(animated.totalFrames - 1, anim.hitHoldFrame));
      const startHold = () => {
        if (this.hitHolds.some((item) => item.view === animated)) return;
        animated.onFrameChange = undefined;
        animated.gotoAndStop(holdFrame);
        animated.alpha = 1;
        this.hitHolds.push({
          view: animated,
          holdDuration: Math.max(0, anim.hitHoldDuration ?? 1),
          fadeDuration: Math.max(0.01, anim.hitFadeDuration ?? 0.35),
          elapsed: 0,
        });
      };
      animated.onFrameChange = (currentFrame) => {
        if (currentFrame >= holdFrame) startHold();
      };
      animated.onComplete = startHold;
    } else {
      animated.onComplete = () => this.releaseCombatVisual(animated);
    }
    layer.addChild(animated);
    animated.play();
    return true;
  }

  private releaseCombatVisual(view: Container): void {
    if (view.destroyed) return;
    view.removeFromParent();
    view.destroy({ children: true } as DestroyOptions);
  }

  private playHeroAttack(): void {
    const hero = this.ensureHero();
    if (!hero) return;
    const anim = data.getAnimation(this.heroAnimKey);
    this.heroAttackTimer = (anim?.frames.length ?? 8) / Math.max(1, anim?.fps ?? 12);
    hero.gotoAndPlay(0);
  }

  private updateHero(dt: number): void {
    if (!this.hero) return;
    if (this.heroAttackTimer > 0) {
      this.heroAttackTimer -= dt;
      if (this.heroAttackTimer <= 0) {
        this.hero.gotoAndStop(0);
      }
    }
  }

  private addFloating(x: number, y: number, label: string, fill: number): void {
    const t = text(label, 18, `#${fill.toString(16).padStart(6, "0")}`, "700");
    t.anchor.set(0.5);
    t.position.set(x, y);
    this.battleLayer.addChild(t);
    this.floating.push({ view: t, ttl: 0.75, vy: -34 });
  }

  private addDamageFloating(x: number, y: number, damage: number, killed: boolean): void {
    const feedback = getDamageNumberFeedback(damage, killed);
    const view = this.createOutlinedText(feedback.label, feedback.fontSize, feedback.fill);
    view.position.set(x, y);
    this.damageTextLayer.addChild(view);
    this.floating.push({
      view,
      ttl: feedback.ttl,
      maxTtl: feedback.ttl,
      vy: feedback.vy,
      popScale: feedback.popScale,
    });
  }

  private addBaseDamageFloating(x: number, y: number, damage: number): void {
    const feedback = getBaseDamageFeedback(damage);
    const view = this.createOutlinedText(feedback.label, feedback.fontSize, feedback.fill);
    view.position.set(x, y);
    this.damageTextLayer.addChild(view);
    this.floating.push({
      view,
      ttl: feedback.ttl,
      maxTtl: feedback.ttl,
      vy: feedback.vy,
      popScale: feedback.popScale,
    });
  }

  private startBaseShake(duration: number, amplitude: number): void {
    this.baseShakeDuration = Math.max(this.baseShakeDuration, duration);
    this.baseShakeTimer = Math.max(this.baseShakeTimer, duration);
    this.baseShakeAmplitude = Math.max(this.baseShakeAmplitude, amplitude);
  }

  private updateBaseShake(dt: number): void {
    if (this.baseShakeTimer <= 0 || this.baseShakeDuration <= 0) {
      this.fieldForegroundLayer.position.set(0, 0);
      this.heroLayer.position.set(0, 0);
      this.baseShakeTimer = 0;
      this.baseShakeDuration = 0;
      this.baseShakeAmplitude = 0;
      return;
    }
    this.baseShakeTimer = Math.max(0, this.baseShakeTimer - dt);
    const life = this.baseShakeTimer / this.baseShakeDuration;
    const amount = this.baseShakeAmplitude * life;
    const x = Math.sin(this.time * 86) * amount;
    const y = Math.cos(this.time * 73) * amount * 0.42;
    this.fieldForegroundLayer.position.set(x, y);
    this.heroLayer.position.set(x * 0.55, y * 0.55);
  }

  private createOutlinedText(label: string, fontSize: number, fill: number): Container {
    const c = new Container();
    const fillHex = `#${fill.toString(16).padStart(6, "0")}`;
    const offsets = [
      [-2, 0],
      [2, 0],
      [0, -2],
      [0, 2],
      [-1.4, -1.4],
      [1.4, -1.4],
      [-1.4, 1.4],
      [1.4, 1.4],
    ];
    for (const [dx, dy] of offsets) {
      const outline = text(label, fontSize, "#5b1a12", "700");
      outline.anchor.set(0.5);
      outline.position.set(dx, dy);
      c.addChild(outline);
    }
    const main = text(label, fontSize, fillHex, "700");
    main.anchor.set(0.5);
    main.position.set(0, 0);
    c.addChild(main);
    return c;
  }

  private layout(key: string, defaults: Parameters<typeof getUiLayout>[3]) {
    return getUiLayout(data, "battle", key, defaults);
  }

  private showWaveCheckpoint(): void {
    if (this.ending) return;
    this.ending = true;
    this.setBattlePaused(true);
    this.bag.baseHp = Math.max(0, this.baseHp);
    const result = applyWaveCheckpointToBag(this.bag, this.level, data.getWaves(this.level.waveGroupId), this.tuning);
    if (this.options.session) {
      this.options.session.baseHp = this.bag.baseHp;
      this.options.session.currentWave = result.nextWave;
    }
    audio.playSfxEvent("result_win");
    analytics.track("battle_wave_clear", {
      levelId: this.level.id,
      wave: this.currentWave,
      rewardGold: result.rewardGold,
      expandedCells: result.expandedCells,
      nextWave: result.nextWave,
    });
    const label = result.expandedCells > 0 ? `+${result.rewardGold}金币\n背包扩展 +${result.expandedCells}格` : `+${result.rewardGold}金币`;
    this.addRewardBanner(label);
    this.waveClearTimer = window.setTimeout(() => {
      const expandText = result.expandedCells > 0 ? `，背包扩展 ${result.expandedCells} 格` : "";
      const message = `第${this.currentWave}波完成：+${result.rewardGold}金币${expandText}`;
      if (this.options.onWaveClear) this.options.onWaveClear(message);
      else showBag(this.level, message, this.bag);
    }, 950);
  }

  private addRewardBanner(label: string): void {
    const w = app.screen.width;
    const h = app.screen.height;
    const banner = new Container();
    const bg = new Graphics();
    bg.roundRect(-150, -42, 300, 84, 24).fill({ color: 0x1f2b2b, alpha: 0.92 });
    bg.stroke({ color: 0xffdf59, width: 3, alpha: 0.86 });
    const coin = spriteFromUi("resource_coin_icon", 44, 44);
    if (coin) {
      coin.anchor.set(0.5);
      coin.position.set(-96, -2);
    }
    const coinFallback = new Graphics();
    coinFallback.circle(-96, -2, 22).fill({ color: 0xf3c63e }).stroke({ color: 0x7a5a0d, width: 3 });
    coinFallback.roundRect(-108, -7, 24, 10, 4).fill({ color: 0xffec8a, alpha: 0.75 });
    const labelText = text(label, 21, "#ffffff", "700");
    labelText.anchor.set(0.5);
    labelText.position.set(28, 0);
    banner.addChild(bg, coin ?? coinFallback, labelText);
    banner.position.set(w / 2, h * 0.34);
    this.uiLayer.addChild(banner);
    this.floating.push({ view: banner, ttl: 0.95, vy: -10 });
  }

  private showResult(win: boolean): void {
    this.ending = true;
    this.setBattlePaused(true);
    if (this.modalWindow) return;
    this.bag.baseHp = Math.max(0, this.baseHp);
    audio.playSfxEvent(win ? "result_win" : "result_lose");
    const reward = save.applyBattleResult(this.level.id, {
      win,
      wave: this.currentWave,
      kills: this.options.session?.kills ?? this.kills,
      runGold: this.bag.gold,
      playSeconds: this.options.session?.playSeconds ?? this.time,
    });
    analytics.track("battle_result", {
      levelId: this.level.id,
      win,
      wave: this.currentWave,
      kills: this.options.session?.kills ?? this.kills,
      runGold: this.bag.gold,
      rewardCoin: reward.coin,
      playSeconds: Math.round(this.options.session?.playSeconds ?? this.time),
    });
    this.modalWindow = new WndResult(this.level, win, this.options.session?.kills ?? this.kills, reward.coin, this.currentWave, () => showMain());
    this.container.addChild(this.modalWindow.container);
  }

  private openPause(): void {
    if (this.modalWindow) return;
    this.setBattlePaused(true);
    this.modalWindow = new WndPause(
      this.level,
      this.kills,
      this.bag.gold,
      () => {
        this.modalWindow?.destroy();
        this.modalWindow = undefined;
        this.setBattlePaused(false);
      },
      () => showMain(),
    );
    this.container.addChild(this.modalWindow.container);
  }

  private syncSessionProgress(): void {
    const session = this.options.session;
    if (!session) return;
    session.baseHp = Math.max(0, this.baseHp);
    session.exp = this.exp;
    session.levelNo = this.levelNo;
    session.kills = this.kills;
  }

  private showBossArrivalWarning(): void {
    this.bossArrivalWarning?.view.destroy({ children: true } as DestroyOptions);
    const w = app.screen.width;
    const h = app.screen.height;
    const view = new Container();
    view.eventMode = "none";
    view.pivot.set(w / 2, h / 2);
    view.position.set(w / 2, h / 2);

    const warning = spriteFromAsset("ui_boss_arrival_warning", w, h);
    if (warning) {
      view.addChild(warning);
    } else {
      const fallback = new Graphics();
      fallback.rect(0, 0, w, h).fill({ color: 0x5a0000, alpha: 0.62 });
      const title = text("BOSS 来袭", 60, "#ffd66f", "700", { strokeColor: "#5b0000", strokeWidth: 8 });
      title.anchor.set(0.5);
      title.position.set(w / 2, h * 0.34);
      view.addChild(fallback, title);
    }

    this.bossWarningLayer.addChild(view);
    this.bossArrivalWarning = { view, elapsed: 0, duration: 1.22 };
    this.applyBossArrivalWarningFrame();
  }

  private applyBossArrivalWarningFrame(): void {
    if (!this.bossArrivalWarning) return;
    const frame = getBossArrivalWarningFrame(this.bossArrivalWarning.elapsed, this.bossArrivalWarning.duration);
    const w = app.screen.width;
    const h = app.screen.height;
    this.bossArrivalWarning.view.alpha = frame.alpha;
    this.bossArrivalWarning.view.scale.set(frame.scale);
    this.bossArrivalWarning.view.position.set(w / 2 + frame.offsetX, h / 2 + frame.offsetY);
    if (frame.done) {
      this.bossArrivalWarning.view.destroy({ children: true } as DestroyOptions);
      this.bossArrivalWarning = undefined;
    }
  }

  private updateBossArrivalWarning(dt: number): void {
    if (!this.bossArrivalWarning) return;
    this.bossArrivalWarning.elapsed += Math.max(0, dt);
    this.applyBossArrivalWarningFrame();
  }

  private setBattlePaused(paused: boolean): void {
    this.paused = paused;
    if (paused) {
      audio.pauseMusic();
      this.animationPlayback.pause([this.battleLayer, this.groundFxLayer, this.monsterLayer, this.fieldForegroundLayer, this.projectileLayer, this.hitFxLayer, this.deathFxLayer, this.damageTextLayer, this.heroLayer]);
    } else {
      audio.resumeMusic();
      this.animationPlayback.resume();
    }
  }

  override destroy(): void {
    if (this.waveClearTimer !== undefined) window.clearTimeout(this.waveClearTimer);
    this.animationPlayback.clear();
    for (const projectile of [...this.projectiles]) this.releaseCombatVisual(projectile.view);
    this.projectiles = [];
    for (const impact of [...this.delayedImpacts]) this.releaseCombatVisual(impact.view);
    this.delayedImpacts = [];
    for (const hold of [...this.hitHolds]) this.releaseCombatVisual(hold.view);
    this.hitHolds = [];
    for (const fade of [...this.fadeReleases]) this.releaseCombatVisual(fade.view);
    this.fadeReleases = [];
    this.bossArrivalWarning?.view.destroy({ children: true } as DestroyOptions);
    this.bossArrivalWarning = undefined;
    super.destroy();
  }
}
