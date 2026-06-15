import { Container, Graphics, type DestroyOptions } from "pixi.js";
import type { BagState, CombatBuffs, FloatingRuntime, ItemDef, LevelDef, MonsterDef, MonsterRuntime, ProjectileRuntime, RogueOptionDef, SkillDef } from "../types";
import { app, audio, data, nextUid } from "../core/runtime";
import { showMain } from "../core/navigation";
import { color, createWeaponIcon, drawGradientBg, text, button, weightedPick } from "../utils/display";
import { GameWindow } from "../windows/GameWindow";
import { WndPause } from "../windows/WndPause";
import { WndResult } from "../windows/WndResult";
import { WndRogueOption } from "../windows/WndRogueOption";
import { BaseScene } from "./BaseScene";

export class BattleScene extends BaseScene {
  private monsters: MonsterRuntime[] = [];
  private projectiles: ProjectileRuntime[] = [];
  private floating: FloatingRuntime[] = [];
  private spawnQueue: Array<{ time: number; monsterId: number; wave: number }> = [];
  private time = 0;
  private baseHp: number;
  private armor: number;
  private exp = 0;
  private levelNo = 1;
  private kills = 0;
  private currentWave = 1;
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
  private uiLayer = new Container();
  private modalWindow: GameWindow | undefined;

  constructor(private readonly level: LevelDef, private readonly bag: BagState) {
    super();
    audio.preloadGroups(["battle"]);
    audio.playMusicEvent("music_battle");
    this.baseHp = level.baseHp;
    this.armor = level.baseArmor;
    this.buildSpawnQueue();
    this.container.addChild(this.battleLayer, this.uiLayer);
    this.drawStatic();
  }

  override update(dt: number): void {
    if (this.paused) return;
    this.time += dt;
    this.spawnDue();
    this.updateWeapons(dt);
    this.updateMonsters(dt);
    this.updateProjectiles(dt);
    this.updateFloating(dt);
    this.drawStatic();
    if (this.baseHp <= 0) {
      this.showResult(false);
    } else if (this.spawnQueue.length === 0 && this.monsters.every((monster) => monster.dead)) {
      this.showResult(true);
    }
  }

  private buildSpawnQueue(): void {
    const waves = data.getWaves(this.level.waveGroupId);
    for (const wave of waves) {
      for (let i = 0; i < wave.count; i += 1) {
        this.spawnQueue.push({ time: wave.time + i * wave.interval, monsterId: wave.monsterId, wave: wave.wave });
      }
    }
    this.spawnQueue.sort((a, b) => a.time - b.time);
  }

  private drawStatic(): void {
    this.uiLayer.removeChildren();
    const w = app.screen.width;
    const h = app.screen.height;
    if (this.battleLayer.children.length === 0) {
      drawGradientBg(this.battleLayer, this.level.theme);
    }

    const pause = button("Ⅱ", 48, 48, 0x2b3441, () => this.openPause());
    pause.position.set(18, 20);
    const title = text(`${this.level.name}\n波次 ${this.currentWave}/${this.level.winWave}`, 20, "#ffffff", "700");
    title.anchor.set(0.5);
    title.position.set(w / 2, 44);

    const waveBar = new Graphics();
    const progress = Math.min(1, this.time / Math.max(8, this.spawnQueue.at(-1)?.time ?? this.time + 1));
    waveBar.roundRect(w * 0.22, 86, w * 0.56, 14, 8).fill({ color: 0x10151c, alpha: 0.9 });
    waveBar.roundRect(w * 0.22, 86, w * 0.56 * progress, 14, 8).fill({ color: 0x4ed5ff });
    waveBar.stroke({ color: 0xffffff, width: 1, alpha: 0.35 });

    const stat = text(`金币 ${this.bag.gold}   杀敌 ${this.kills}   Lv.${this.levelNo}`, 17, "#ffe67b", "700");
    stat.anchor.set(0.5);
    stat.position.set(w / 2, 118);

    const base = new Graphics();
    base.roundRect(w * 0.12, h - 180, w * 0.76, 110, 26).fill({ color: 0x4b4138, alpha: 0.96 });
    base.stroke({ color: 0xd2b47e, width: 4, alpha: 0.65 });
    base.rect(w * 0.12, h - 80, w * 0.76, 14).fill({ color: 0x10151c });
    base.rect(w * 0.12, h - 80, w * 0.76 * Math.max(0, this.baseHp / this.level.baseHp), 14).fill({ color: 0x34ed70 });

    const hero = text("守卫", 22, "#ffdf8a", "700");
    hero.anchor.set(0.5);
    hero.position.set(w / 2 - 54, h - 130);
    const baseStat = text(`护甲 ${this.armor + this.buffs.armorBonus}   生命 ${Math.max(0, Math.round(this.baseHp))}`, 16, "#ffffff", "700");
    baseStat.anchor.set(0.5);
    baseStat.position.set(w / 2 + 50, h - 126);

    const equipBg = new Graphics();
    equipBg.roundRect(0, h - 64, w, 64, 0).fill({ color: 0x1d2935, alpha: 0.96 });
    this.uiLayer.addChild(pause, title, waveBar, stat, base, hero, baseStat, equipBg);

    this.bag.placed.slice(0, 8).forEach((placed, index) => {
      const item = data.getItem(placed.itemId);
      const quality = data.getQuality(item.quality);
      const icon = createWeaponIcon(item, quality, 46);
      icon.position.set(32 + index * 54, h - 32);
      const skill = data.getSkill(item.skillId);
      const cdRate = Math.max(0, Math.min(1, placed.cdLeft / Math.max(0.1, skill.cd * this.buffs.cdMul)));
      if (cdRate > 0) {
        const mask = new Graphics();
        mask.roundRect(-23, -23, 46, 46 * cdRate, 8).fill({ color: 0x000000, alpha: 0.52 });
        icon.addChild(mask);
      }
      this.uiLayer.addChild(icon);
    });
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
    const x = 40 + Math.random() * (w - 80);
    const y = 126 + Math.random() * 30;
    const view = this.createMonsterView(def);
    view.position.set(x, y);
    this.battleLayer.addChild(view);
    this.monsters.push({ uid: nextUid(), def, view, hp: def.hp, maxHp: def.hp, x, y, slowTimer: 0, dead: false });
  }

  private createMonsterView(def: MonsterDef): Container {
    const c = new Container();
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

  private pickTarget(skill: SkillDef): MonsterRuntime | undefined {
    const alive = this.monsters.filter((monster) => !monster.dead && monster.hp > 0);
    if (alive.length === 0) return undefined;
    if (skill.targetRule === "lowestY") {
      return alive.sort((a, b) => b.y - a.y)[0];
    }
    if (skill.targetRule === "cluster") {
      return alive.sort((a, b) => this.countNear(b) - this.countNear(a))[0];
    }
    return alive.sort((a, b) => b.y - a.y)[0];
  }

  private countNear(monster: MonsterRuntime): number {
    return this.monsters.filter((other) => !other.dead && Math.hypot(other.x - monster.x, other.y - monster.y) < 120).length;
  }

  private fireSkill(placed: PlacedItem, item: ItemDef, skill: SkillDef, target?: MonsterRuntime): void {
    const qMul = this.buffs.qualityAttack[item.quality] ?? 1;
    const damage = skill.attack * data.getQuality(item.quality).attackMul * this.buffs.attackMul * qMul * (skill.type === "dot" ? this.buffs.dotMul : 1);
    const startX = app.screen.width / 2 - 80 + (placed.uid % 5) * 38;
    const startY = app.screen.height - 170;
    if (skill.type === "projectile" && target) {
      audio.playSfxEvent("battle_shoot");
      const view = new Graphics().circle(0, 0, 8).fill({ color: color(skill.color) }).stroke({ color: 0xffffff, width: 2, alpha: 0.45 });
      view.position.set(startX, startY);
      this.battleLayer.addChild(view);
      this.projectiles.push({ view, target, x: startX, y: startY, speed: skill.speed, damage, radius: skill.radius, color: color(skill.color) });
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
      this.addFloating(app.screen.width / 2 + 82, app.screen.height - 156, `+${effect?.value ?? 40}`, 0x45ff99);
    }
  }

  private areaDamage(x: number, y: number, radius: number, damage: number, skill: SkillDef): void {
    const fx = new Graphics();
    fx.circle(0, 0, radius).fill({ color: color(skill.color), alpha: 0.18 });
    fx.circle(0, 0, radius * 0.55).stroke({ color: color(skill.color), width: 5, alpha: 0.8 });
    fx.position.set(x, y);
    this.battleLayer.addChild(fx);
    this.floating.push({ view: fx, ttl: 0.35, vy: 0 });
    for (const monster of this.monsters) {
      if (!monster.dead && Math.hypot(monster.x - x, monster.y - y) <= radius) {
        this.damageMonster(monster, damage, skill);
      }
    }
  }

  private updateMonsters(dt: number): void {
    const baseY = app.screen.height - 190;
    for (const monster of this.monsters) {
      if (monster.dead) continue;
      monster.slowTimer = Math.max(0, monster.slowTimer - dt);
      const speedMul = monster.slowTimer > 0 ? 0.55 : 1;
      monster.y += monster.def.speed * speedMul * dt;
      monster.view.position.set(monster.x, monster.y + Math.sin(this.time * 8 + monster.uid) * 2);
      monster.view.scale.set(1 + Math.sin(this.time * 9 + monster.uid) * 0.035, 1 - Math.sin(this.time * 9 + monster.uid) * 0.025);
      if (monster.y >= baseY) {
        const dmg = Math.max(1, monster.def.attack - (this.armor + this.buffs.armorBonus) * 0.45);
        this.baseHp -= dmg;
        this.addFloating(monster.x, monster.y, `-${Math.round(dmg)}`, 0xff5b5b);
        this.killMonster(monster, false);
      }
    }
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
      if (dist <= projectile.radius || move >= dist) {
        this.damageMonster(projectile.target, projectile.damage);
        this.removeProjectile(projectile);
      }
    }
  }

  private removeProjectile(projectile: ProjectileRuntime): void {
    projectile.view.destroy({ children: true } as DestroyOptions);
    this.projectiles = this.projectiles.filter((item) => item !== projectile);
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
      this.addFloating(monster.x, monster.y, `+${monster.def.gold}`, 0xffdf59);
      this.checkLevelUp();
    }
  }

  private checkLevelUp(): void {
    const need = data.getEconomy("exp_need_base") + this.levelNo * 18;
    if (this.exp >= need) {
      this.exp -= need;
      this.levelNo += 1;
      audio.playSfxEvent("battle_level_up");
      this.showRogueOptions();
    }
  }

  private showRogueOptions(): void {
    this.paused = true;
    const options = this.pickRogueOptions();
    this.modalWindow?.destroy();
    this.modalWindow = new WndRogueOption(options, (option) => {
      this.applyRogueOption(option);
      this.modalWindow?.destroy();
      this.modalWindow = undefined;
      this.paused = false;
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

  private addFloating(x: number, y: number, label: string, fill: number): void {
    const t = text(label, 18, `#${fill.toString(16).padStart(6, "0")}`, "700");
    t.anchor.set(0.5);
    t.position.set(x, y);
    this.battleLayer.addChild(t);
    this.floating.push({ view: t, ttl: 0.75, vy: -34 });
  }

  private showResult(win: boolean): void {
    this.paused = true;
    if (this.modalWindow) return;
    audio.playSfxEvent(win ? "result_win" : "result_lose");
    this.modalWindow = new WndResult(this.level, win, this.kills, this.bag.gold, this.currentWave, () => showMain());
    this.container.addChild(this.modalWindow.container);
  }

  private openPause(): void {
    if (this.modalWindow) return;
    this.paused = true;
    this.modalWindow = new WndPause(
      this.level,
      this.kills,
      this.bag.gold,
      () => {
        this.modalWindow?.destroy();
        this.modalWindow = undefined;
        this.paused = false;
      },
      () => showMain(),
    );
    this.container.addChild(this.modalWindow.container);
  }
}
