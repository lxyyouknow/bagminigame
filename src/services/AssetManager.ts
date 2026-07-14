import { AnimatedSprite, Assets, Rectangle, Sprite, Texture } from "pixi.js";
import { GameDataManager } from "../data/GameDataManager";
import type { AssetDef, BagState, LevelDef } from "../types";

export class AssetManager {
  private resources = new Map<string, unknown>();
  private loadingByUrl = new Map<string, Promise<unknown>>();
  private readonly animationFrameLimit = isMobileRuntime() ? 24 : 32;

  constructor(private readonly data: GameDataManager) {}

  async preloadGroups(groups: string[]): Promise<void> {
    const targetGroups = new Set(groups);
    const rows = this.data.assets.filter((asset) => asset.url && asset.type !== "generated" && targetGroups.has(asset.preloadGroup));
    await this.preloadRows(rows);
  }

  async preloadAssetKeys(keys: Iterable<string>): Promise<void> {
    const targetKeys = new Set(keys);
    const rows = this.data.assets.filter((asset) => targetKeys.has(asset.key));
    await this.preloadRows(rows);
  }

  async preloadAnimations(animKeys: Iterable<string>): Promise<void> {
    const frameKeys = new Set<string>();
    for (const animKey of animKeys) {
      const anim = this.data.getAnimation(animKey);
      if (!anim) continue;
      for (const frameKey of this.selectAnimationFrames(anim.frames)) frameKeys.add(frameKey);
    }
    await this.preloadAssetKeys(frameKeys);
  }

  async preloadBagCore(): Promise<void> {
    const rows = this.data.assets.filter((asset) =>
      asset.preloadGroup === "bag"
      && !asset.url.includes("/characters/"),
    );
    await Promise.all([
      this.preloadRows(rows),
      this.preloadAnimations(["mole_worker_idle", "rabbit_worker_idle"]),
    ]);
  }

  async preloadBattleWave(level: LevelDef, wave: number, bag: BagState): Promise<void> {
    const staticRows = this.data.assets.filter((asset) =>
      asset.preloadGroup === "battle"
      && !asset.url.includes("/characters/")
      && !asset.url.includes("/enemies/")
      && !asset.url.includes("/effects/"),
    );
    const animationKeys = new Set<string>();
    const assetKeys = new Set<string>();

    for (const row of this.data.getWaves(level.waveGroupId)) {
      if (row.wave !== wave) continue;
      const monster = this.data.getMonster(row.monsterId);
      if (monster.runAnimKey) animationKeys.add(monster.runAnimKey);
      if (monster.attackAnimKey) animationKeys.add(monster.attackAnimKey);
      if (monster.deathAnimKey) animationKeys.add(monster.deathAnimKey);
      const bossSkill = this.data.getBossSkill(monster.roarSkillKey);
      if (bossSkill?.animKey) animationKeys.add(bossSkill.animKey);
    }

    for (const placed of bag.placed) {
      const item = this.data.getItem(placed.itemId);
      const skill = this.data.getSkill(item.skillId);
      if (item.battleIconAssetKey) assetKeys.add(item.battleIconAssetKey);
      if (item.projectileAssetKey) assetKeys.add(item.projectileAssetKey);
      if (skill.projectileAnimKey) animationKeys.add(skill.projectileAnimKey);
      if (skill.hitAnimKey) animationKeys.add(skill.hitAnimKey);
      if (skill.killAnimKey) animationKeys.add(skill.killAnimKey);
      if (skill.groundFxAnimKey) animationKeys.add(skill.groundFxAnimKey);
    }

    await Promise.all([
      this.preloadRows(staticRows),
      this.preloadAssetKeys(assetKeys),
      this.preloadAnimations(animationKeys),
    ]);
  }

  async preloadWaveVictoryAnimations(): Promise<void> {
    await this.preloadAnimations(["mole_worker_victory", "rabbit_worker_victory"]);
  }

  private async preloadRows(rows: AssetDef[]): Promise<void> {
    await Promise.all(
      rows.map(async (asset) => {
        if (!asset.url || asset.type === "generated" || this.resources.has(asset.key)) return;
        try {
          // 目前工人“图集”是一张 JSON 对一张 PNG，直接加载图片可避免 001.png 等全局帧名互相覆盖。
          const runtimeUrl = asset.type === "spritesheet" && asset.frame
            ? asset.url.replace(/\.json(?=\?|$)/, ".png")
            : asset.url;
          let loading = this.loadingByUrl.get(runtimeUrl);
          if (!loading) {
            loading = Assets.load(runtimeUrl);
            this.loadingByUrl.set(runtimeUrl, loading);
          }
          this.resources.set(asset.key, await loading);
        } catch (error) {
          console.warn(`资源加载失败，使用占位表现：${asset.key} -> ${asset.url}`, error);
        }
      }),
    );
  }

  texture(assetKey: string | undefined): Texture | undefined {
    if (!assetKey) return undefined;
    const asset = this.data.getAsset(assetKey);
    const resource = this.resources.get(assetKey);
    if (resource instanceof Texture) {
      if (asset?.frameWidth && asset.frameHeight) {
        return new Texture({
          source: resource.source,
          frame: new Rectangle(asset.frameX ?? 0, asset.frameY ?? 0, asset.frameWidth, asset.frameHeight),
        });
      }
      return resource;
    }
    if (asset?.frame && typeof resource === "object" && resource && "textures" in resource) {
      const textures = (resource as { textures?: Record<string, Texture> }).textures;
      return textures?.[asset.frame];
    }
    if (asset?.fallbackKey) return this.texture(asset.fallbackKey);
    return undefined;
  }

  animation(animKey: string): AnimatedSprite | undefined {
    const anim = this.data.getAnimation(animKey);
    if (!anim) return undefined;
    const selectedFrames = this.selectAnimationFrames(anim.frames);
    const textures = selectedFrames.map((frameKey) => this.texture(frameKey)).filter((texture): texture is Texture => Boolean(texture));
    if (textures.length === 0) return undefined;
    const sprite = new AnimatedSprite(textures);
    sprite.animationSpeed = (anim.fps / 60) * (textures.length / Math.max(1, anim.frames.length));
    sprite.loop = anim.loop;
    sprite.anchor.set(anim.anchorX, anim.anchorY);
    sprite.scale.set(anim.scale);
    return sprite;
  }

  private selectAnimationFrames(frames: string[]): string[] {
    if (frames.length <= this.animationFrameLimit) return frames;
    const selected: string[] = [];
    const lastIndex = frames.length - 1;
    for (let i = 0; i < this.animationFrameLimit; i += 1) {
      const index = Math.round((i / (this.animationFrameLimit - 1)) * lastIndex);
      const frame = frames[index];
      if (selected.at(-1) !== frame) selected.push(frame);
    }
    return selected;
  }

  sprite(assetKey: string | undefined, width: number, height: number): Sprite | undefined {
    const texture = this.texture(assetKey);
    if (!texture) return undefined;
    const sprite = new Sprite(texture);
    sprite.width = width;
    sprite.height = height;
    return sprite;
  }
}

function isMobileRuntime(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod|Mobile|MicroMessenger/i.test(navigator.userAgent)
    || (navigator.maxTouchPoints ?? 0) > 1;
}
