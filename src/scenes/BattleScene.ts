import { AnimatedSprite, Container, Graphics, type DestroyOptions } from "pixi.js";
import type { BagState, CombatBuffs, FloatingRuntime, ItemDef, LevelDef, MonsterDef, MonsterRuntime, PlacedItem, ProjectileRuntime, RogueOptionDef, SkillDef, SpinDamageRuntime } from "../types";
import type { LifecycleReason } from "../services/LifecycleService";
import { analytics, app, assetManager, audio, data, nextUid, save } from "../core/runtime";
import { showBag, showMain } from "../core/navigation";
import { color, drawGrassBg, text, button, weightedPick, spriteFromAsset } from "../utils/display";
import { getUiLayout, resolveUiLayoutPosition, resolveUiLayoutRect } from "../ui/layout/UiLayout";
import { GameWindow } from "../windows/GameWindow";
import { WndPause } from "../windows/WndPause";
import { WndResult } from "../windows/WndResult";
import { WndRogueOption } from "../windows/WndRogueOption";
import { computeBattleEquipListLayout, computeBattleHudLayout } from "./battleEquipLayout";
import { applyWaveCheckpointToBag, buildSingleWaveSpawnQueue } from "./battleWaveRules";
import { stepMonsterContact } from "./monsterContactRules";
import { getMonsterAnimationKey } from "./monsterVisualRules";
import { chooseMonsterSpawnPosition } from "./monsterSpawnRules";
import { AnimationPlaybackController } from "./animationPlaybackController";
import { shouldUseVisualProjectile, usesAreaImpact } from "./skillVisualRules";
import { chooseBalancedTarget, getInitialWeaponCooldown } from "./weaponAttackRules";
import { BaseScene } from "./BaseScene";
import type { RunSessionState } from "./runSessionState";

export interface BattleSceneOptions {
  session?: RunSessionState;
  onWaveClear?: (message: string) => void;
}

interface HitHoldRuntime {
  view: AnimatedSprite;
  holdDuration: number;
  fadeDuration: number;
  elapsed: number;
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
  private hitHolds: HitHoldRuntime[] = [];
  private spawnQueue: Array<{ time: number; monsterId: number; wave: number }> = [];
  private time = 0;
  private baseHp: number;
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
  private projectileLayer = new Container();
  private hitFxLayer = new Container();
  private heroLayer = new Container();
  private uiLayer = new Container();
  private modalWindow: GameWindow | undefined;
  private hero?: AnimatedSprite;
  private heroAttackTimer = 0;
  private heroCastX = 0;
  private heroCastY = 0;
  private readonly heroAnimKey = "wizard_attack_up";
  private readonly animationPlayback = new AnimationPlaybackController();

  private waveClearTimer: number | undefined;

  constructor(private readonly level: LevelDef, private readonly bag: BagState, private readonly options: BattleSceneOptions = {}) {
    super();
    audio.preloadGroups(["battle"]);
    audio.playMusicEvent("music_battle");
    const session = options.session;
    bag.currentWave ??= session?.currentWave ?? 1;
    bag.baseHp ??= session?.baseHp ?? level.baseHp;
    this.currentWave = session?.currentWave ?? bag.currentWave;
    this.baseHp = session?.baseHp ?? bag.baseHp;
    this.armor = level.baseArmor;
    if (session) {
      this.exp = session.exp;
      this.levelNo = session.levelNo;
      this.kills = session.kills;
      this.buffs = session.buffs;
    }
    this.initializeWeaponCooldowns();
    this.buildSpawnQueue();
    analytics.track("battle_start", { levelId: level.id, wave: this.currentWave, weaponCount: bag.placed.length, startGold: bag.gold });
    this.container.addChild(this.battleLayer, this.uiLayer, this.projectileLayer, this.hitFxLayer);
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
    this.updateHero(dt);
    this.drawStatic();
    if (this.ending) return;
    if (this.baseHp <= 0) {
      this.showResult(false);
    } else if (this.spawnQueue.length === 0 && this.monsters.every((monster) => monster.dead)) {
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

  private buildSpawnQueue(): void {
    this.spawnQueue = buildSingleWaveSpawnQueue(data.getWaves(this.level.waveGroupId), this.currentWave);
    this.waveDuration = Math.max(1, (this.spawnQueue.at(-1)?.time ?? 0.2) + 2.8);
  }

  private drawStatic(): void {
    this.uiLayer.removeChildren();
    const w = app.screen.width;
    const h = app.screen.height;
    if (this.battleLayer.children.length === 0) {
      drawGrassBg(this.battleLayer, this.level.theme);
      this.drawBattleMapDecor();
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
    const pause = button("Ⅱ", pauseLayout.width, pauseLayout.height, 0x2b3441, () => this.openPause());
    const pausePos = resolveUiLayoutPosition(pauseLayout, w, h);
    pause.position.set(pausePos.x, pausePos.y);
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
    const expNeed = data.getEconomy("exp_need_base") + this.levelNo * 18;
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
    const goldIcon = new Graphics();
    goldIcon.roundRect(24, statPos.y - 6, 30, 14, 5).fill({ color: 0xf2c548 }).stroke({ color: 0x6e5512, width: 2 });
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
    const { base: baseRect, equip: equipRect, hpBar: hpRect } = hud;

    const baseTop = baseRect.y + 10;
    const turretX = baseRect.x + baseRect.width / 2;
    this.positionHero(turretX, this.friendlyAreaCenterY(baseTop + 24) - this.friendlyAreaHeight() * 0.2 - 120);

    const guardLabel = text("守卫基地", baseLayout.fontSize ?? 16, "#ffdf83", "700");
    guardLabel.anchor.set(0, 0.5);
    guardLabel.position.set(baseRect.x + 30, baseTop + 34);

    const statusBack = new Graphics();
    const statusX = Math.max(baseRect.x + 118, baseRect.x + baseRect.width - 162);
    const statusY = baseTop + 34;
    statusBack.roundRect(statusX - 10, statusY - 20, 148, 40, 18).fill({ color: 0x40372b, alpha: 0.72 });
    statusBack.stroke({ color: 0xa58b55, width: 1, alpha: 0.38 });

    const armorIcon = new Graphics();
    armorIcon.moveTo(0, -11).lineTo(11, -4).lineTo(8, 10).lineTo(0, 16).lineTo(-8, 10).lineTo(-11, -4).closePath();
    armorIcon.fill({ color: 0x6db9ff }).stroke({ color: 0xffffff, width: 2, alpha: 0.45 });
    armorIcon.position.set(statusX + 12, statusY);
    const armorText = text(String(this.armor + this.buffs.armorBonus), 18, "#ffffff", "700");
    armorText.anchor.set(0, 0.5);
    armorText.position.set(armorIcon.x + 18, armorIcon.y + 1);

    const hpIcon = new Graphics();
    hpIcon.moveTo(0, 12).bezierCurveTo(-15, 1, -13, -12, 0, -5).bezierCurveTo(13, -12, 15, 1, 0, 12).fill({ color: 0xff5e70 });
    hpIcon.position.set(statusX + 72, statusY + 1);
    const hpText = text(String(Math.max(0, Math.round(this.baseHp))), 18, "#ffffff", "700");
    hpText.anchor.set(0, 0.5);
    hpText.position.set(hpIcon.x + 18, hpIcon.y + 1);

    const hpTrack = new Graphics();
    hpTrack.roundRect(hpRect.x, hpRect.y, hpRect.width, hpRect.height, 7).fill({ color: 0x11181f, alpha: 0.96 });
    hpTrack.stroke({ color: 0x0a0e12, width: 2, alpha: 0.72 });
    const hpFill = new Graphics();
    hpFill.roundRect(hpRect.x + 3, hpRect.y + 3, Math.max(0, (hpRect.width - 6) * Math.max(0, this.baseHp / this.level.baseHp)), hpRect.height - 6, 5).fill({ color: 0x2ff16b });

    if (pauseLayout.visible) this.uiLayer.addChild(pause);
    if (titleLayout.visible) this.uiLayer.addChild(title);
    if (waveLayout.visible) this.uiLayer.addChild(waveBar, levelBadge, levelText);
    if (statLayout.visible) this.uiLayer.addChild(goldBg, goldIcon, goldText, killText, topHp);
    if (baseLayout.visible) this.uiLayer.addChild(this.heroLayer, guardLabel, statusBack, armorIcon, armorText, hpIcon, hpText, hpTrack, hpFill);

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

  private drawBattleMapDecor(): void {
    const w = app.screen.width;
    const h = app.screen.height;
    const skinTexture = assetManager.texture("battle_friendly_area_skin");
    if (!skinTexture) return;

    const skinScale = w / skinTexture.width;
    const skinW = skinTexture.width * skinScale;
    const skinH = skinTexture.height * skinScale;
    const skin = spriteFromAsset("battle_friendly_area_skin", skinW, skinH);
    if (!skin) return;
    skin.position.set((w - skinW) / 2, h - skinH);
    this.battleLayer.addChild(skin);

    const lineTexture = assetManager.texture("battle_divider_line");
    if (!lineTexture) return;
    const lineScale = w / lineTexture.width;
    const lineW = lineTexture.width * lineScale;
    const lineH = lineTexture.height * lineScale;
    const line = spriteFromAsset("battle_divider_line", lineW, lineH);
    if (!line) return;
    line.position.set((w - lineW) / 2, skin.y - lineH);
    this.battleLayer.addChild(line);
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
      this.spawnMonster(spawn.monsterId);
    }
  }

  private spawnMonster(monsterId: number): void {
    const def = data.getMonster(monsterId);
    const w = app.screen.width;
    const { x, y } = chooseMonsterSpawnPosition(
      w,
      this.monsters.filter((monster) => !monster.dead).map((monster) => ({ x: monster.x, y: monster.y })),
    );
    const animationKey = getMonsterAnimationKey(def, false);
    const view = this.createMonsterView(def, animationKey);
    view.position.set(x, y);
    this.battleLayer.addChild(view);
    this.monsters.push({ uid: nextUid(), def, view, hp: def.hp, maxHp: def.hp, x, y, slowTimer: 0, attackCooldown: 0, dead: false, animationKey });
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
    if (def.boss) {
      body.roundRect(-r * 0.9, -r * 1.2, r * 1.8, 10, 5).fill({ color: 0xffd25a });
    }
    c.addChild(body);
    return c;
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
    this.playHeroAttack();
    const qMul = this.buffs.qualityAttack[item.quality] ?? 1;
    const damage = skill.attack * data.getQuality(item.quality).attackMul * this.buffs.attackMul * qMul * (skill.type === "dot" ? this.buffs.dotMul : 1);
      const start = this.getHeroCastPoint(placed.uid);
      const startX = start.x;
      const startY = start.y;
    if ((skill.type === "projectile" || shouldUseVisualProjectile(skill)) && target) {
      audio.playSfxEvent("battle_shoot");
      const view = this.createProjectileView(color(skill.color), skill.projectileAnimKey);
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
        rotateToTarget: !skill.projectileAnimKey,
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
      this.addFloating(app.screen.width / 2 + 82, app.screen.height - 156, `护甲+${effect?.value ?? 1}`, 0x7ee08a);
    } else if (skill.type === "heal") {
      const effect = data.getEffect(skill.effectId);
      this.baseHp = Math.min(this.level.baseHp, this.baseHp + (effect?.value ?? 40));
      this.syncSessionProgress();
      this.addFloating(app.screen.width / 2 + 82, app.screen.height - 156, `+${effect?.value ?? 40}`, 0x45ff99);
    }
  }

  private areaDamage(x: number, y: number, radius: number, damage: number, skill: SkillDef): void {
    if (!this.playHitEffect(skill.hitAnimKey, x, y)) {
      const fx = new Graphics();
      fx.circle(0, 0, radius).fill({ color: color(skill.color), alpha: 0.18 });
      fx.circle(0, 0, radius * 0.55).stroke({ color: color(skill.color), width: 5, alpha: 0.8 });
      fx.position.set(x, y);
      this.battleLayer.addChild(fx);
      this.floating.push({ view: fx, ttl: 0.35, vy: 0 });
    }
    for (const monster of this.monsters) {
      if (!monster.dead && Math.hypot(monster.x - x, monster.y - y) <= radius) {
        this.damageMonster(monster, damage, skill);
      }
    }
  }

  private updateMonsters(dt: number): void {
    for (const monster of this.monsters) {
      if (monster.dead) continue;
      monster.slowTimer = Math.max(0, monster.slowTimer - dt);
      const contact = stepMonsterContact({
        y: monster.y,
        speed: monster.def.speed,
        slowTimer: monster.slowTimer,
        attackCooldown: monster.attackCooldown,
        dt,
        contactY: this.baseContactY(monster),
        attack: monster.def.attack,
        attackInterval: monster.def.attackInterval,
        armor: this.armor,
        armorBonus: this.buffs.armorBonus,
      });
      monster.y = contact.y;
      monster.attackCooldown = contact.attackCooldown;
      this.updateMonsterAnimation(monster, contact.contacted);
      monster.view.position.set(monster.x, monster.y + Math.sin(this.time * 8 + monster.uid) * 2);
      monster.view.scale.set(1 + Math.sin(this.time * 9 + monster.uid) * 0.035, 1 - Math.sin(this.time * 9 + monster.uid) * 0.025);
      if (contact.damage > 0) {
        this.baseHp -= contact.damage;
        this.bag.baseHp = Math.max(0, this.baseHp);
        this.syncSessionProgress();
        this.addFloating(monster.x, monster.y - 24, `-${Math.round(contact.damage)}`, 0xff5b5b);
      }
    }
  }

  private updateMonsterAnimation(monster: MonsterRuntime, contacted: boolean): void {
    const nextKey = getMonsterAnimationKey(monster.def, contacted);
    if (!nextKey || nextKey === monster.animationKey) return;
    const animated = assetManager.animation(nextKey);
    if (!animated) return;
    for (const child of monster.view.removeChildren()) child.destroy({ children: true });
    animated.play();
    monster.view.addChild(animated);
    monster.animationKey = nextKey;
  }

  private baseContactY(monster: MonsterRuntime): number {
    const w = app.screen.width;
    const h = app.screen.height;
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
    return hud.base.y + 34 - monster.def.radius * 0.18;
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
      if ((projectile.skill.impactSpinTurns ?? 0) !== 0) {
        this.startDelayedImpact(projectile);
        return false;
      }
      this.areaDamage(projectile.target.x, projectile.target.y, projectile.radius, projectile.damage, projectile.skill);
      return true;
    }
    this.playHitEffect(projectile.skill.hitAnimKey, projectile.target.x, projectile.target.y);
    this.damageMonster(projectile.target, projectile.damage, projectile.skill);
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
      duration: Math.max(0.01, projectile.skill.impactSpinDuration ?? 0.55),
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
      impact.view.rotation = impact.startRotation + progress * impact.turns * Math.PI * 2;
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

  private damageMonster(monster: MonsterRuntime, amount: number, skill?: SkillDef): void {
    audio.playSfxEvent("battle_hit");
    const damage = Math.max(1, amount - monster.def.armor);
    monster.hp -= damage;
    this.addFloating(monster.x, monster.y - 26, Math.round(damage).toString(), 0xffffff);
    if (skill?.effectId) {
      const effect = data.getEffect(skill.effectId);
      if (effect?.type === "slow") monster.slowTimer = effect.duration;
    }
    if (monster.hp <= 0) {
      this.killMonster(monster, true);
    }
  }

  private killMonster(monster: MonsterRuntime, reward: boolean): void {
    monster.dead = true;
    monster.view.destroy({ children: true } as DestroyOptions);
    if (reward) {
      this.kills += 1;
      this.bag.gold += monster.def.gold;
      this.exp += monster.def.exp;
      this.syncSessionProgress();
      this.addFloating(monster.x, monster.y, `+${monster.def.gold}`, 0xffdf59);
      this.checkLevelUp();
    }
  }

  private checkLevelUp(): void {
    const need = data.getEconomy("exp_need_base") + this.levelNo * 18;
    if (this.exp >= need) {
      this.exp -= need;
      this.levelNo += 1;
      this.syncSessionProgress();
      audio.playSfxEvent("battle_level_up");
      this.showRogueOptions();
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
    else if (option.effectType === "heal") this.baseHp = Math.min(this.level.baseHp, this.baseHp + option.effectValue);
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
      this.baseHp = Math.min(this.level.baseHp, this.baseHp + option.effectValue);
      this.buffs.armorBonus += 2;
    }
    this.syncSessionProgress();
    this.addFloating(app.screen.width / 2, app.screen.height * 0.32, option.title, 0xffdf59);
  }

  private updateFloating(dt: number): void {
    for (const item of [...this.floating]) {
      item.ttl -= dt;
      item.view.y += item.vy * dt;
      item.view.alpha = Math.max(0, item.ttl / 0.7);
      if (item.ttl <= 0) {
        item.view.destroy({ children: true } as DestroyOptions);
        this.floating = this.floating.filter((f) => f !== item);
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
    hero.scale.set((anim?.scale ?? 1) * 1.65);
    hero.gotoAndStop(0);
    this.hero = hero;
    this.heroLayer.addChild(hero);
    return hero;
  }

  private positionHero(x: number, y: number): void {
    const hero = this.ensureHero();
    this.heroCastX = x + 34;
    this.heroCastY = y - 96;
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
    const art = spriteFromAsset(assetKey, 42, 42);
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

  private playHitEffect(animationKey: string | undefined, x: number, y: number): boolean {
    const animated = animationKey ? assetManager.animation(animationKey) : undefined;
    if (!animated) return false;
    const anim = animationKey ? data.getAnimation(animationKey) : undefined;
    animated.loop = false;
    animated.position.set(x, y);
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
    this.hitFxLayer.addChild(animated);
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

  private layout(key: string, defaults: Parameters<typeof getUiLayout>[3]) {
    return getUiLayout(data, "battle", key, defaults);
  }

  private showWaveCheckpoint(): void {
    if (this.ending) return;
    this.ending = true;
    this.setBattlePaused(true);
    this.bag.baseHp = Math.max(0, this.baseHp);
    const result = applyWaveCheckpointToBag(this.bag, this.level, data.getWaves(this.level.waveGroupId));
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
    const coin = new Graphics();
    coin.circle(-96, -2, 22).fill({ color: 0xf3c63e }).stroke({ color: 0x7a5a0d, width: 3 });
    coin.roundRect(-108, -7, 24, 10, 4).fill({ color: 0xffec8a, alpha: 0.75 });
    const labelText = text(label, 21, "#ffffff", "700");
    labelText.anchor.set(0.5);
    labelText.position.set(28, 0);
    banner.addChild(bg, coin, labelText);
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

  private setBattlePaused(paused: boolean): void {
    this.paused = paused;
    if (paused) {
      this.animationPlayback.pause([this.battleLayer, this.projectileLayer, this.hitFxLayer, this.heroLayer]);
    } else {
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
    super.destroy();
  }
}
