import { AnimatedSprite, Assets, Sprite, Texture } from "pixi.js";
import { GameDataManager } from "../data/GameDataManager";

export class AssetManager {
  private resources = new Map<string, unknown>();

  constructor(private readonly data: GameDataManager) {}

  async preloadGroups(groups: string[]): Promise<void> {
    const targetGroups = new Set(groups);
    const rows = this.data.assets.filter((asset) => asset.url && asset.type !== "generated" && targetGroups.has(asset.preloadGroup));
    const loadingByUrl = new Map<string, Promise<unknown>>();
    await Promise.all(
      rows.map(async (asset) => {
        try {
          let loading = loadingByUrl.get(asset.url);
          if (!loading) {
            loading = Assets.load(asset.url);
            loadingByUrl.set(asset.url, loading);
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
    if (resource instanceof Texture) return resource;
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
    const textures = anim.frames.map((frameKey) => this.texture(frameKey)).filter((texture): texture is Texture => Boolean(texture));
    if (textures.length === 0) return undefined;
    const sprite = new AnimatedSprite(textures);
    sprite.animationSpeed = anim.fps / 60;
    sprite.loop = anim.loop;
    sprite.anchor.set(anim.anchorX, anim.anchorY);
    sprite.scale.set(anim.scale);
    return sprite;
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
