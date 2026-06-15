import {
  Application,
  Assets,
  Container,
  Graphics,
  Sprite,
  Text,
  TextStyle,
  Texture,
  type DestroyOptions,
} from "pixi.js";

import "./style.css";

type ThemeName = "green" | "purple" | "steel";

interface LevelDef {
  id: number;
  name: string;
  desc: string;
  theme: ThemeName;
  initRows: number;
  initCols: number;
  maxRows: number;
  maxCols: number;
  initGold: number;
  baseHp: number;
  baseArmor: number;
  waveGroupId: number;
  shopPoolId: number;
  roguePoolId: number;
  winWave: number;
  mapAssetKey?: string;
  lockedMapAssetKey?: string;
}

interface ItemShapeDef {
  id: string;
  name: string;
  cells: [number, number][];
  allowRotate: boolean;
  previewScale: number;
}

interface QualityDef {
  id: number;
  name: string;
  color: string;
  attackMul: number;
  mergeNeed: number;
  nextQuality: number;
}

interface ItemDef {
  id: number;
  baseId: string;
  name: string;
  quality: number;
  shapeId: string;
  icon: string;
  iconAssetKey?: string;
  skillId: number;
  mergeToId: number;
  weight: number;
  pools: number[];
}

interface SkillDef {
  id: number;
  name: string;
  type: "projectile" | "melee" | "aoe" | "dot" | "shield" | "heal";
  attack: number;
  cd: number;
  range: number;
  speed: number;
  radius: number;
  targetRule: string;
  effectId: number;
  color: string;
}

interface EffectDef {
  id: number;
  type: string;
  value: number;
  duration: number;
}

interface MonsterDef {
  id: number;
  name: string;
  hp: number;
  armor: number;
  speed: number;
  attack: number;
  gold: number;
  exp: number;
  radius: number;
  color: string;
  boss: boolean;
}

interface WaveDef {
  waveGroupId: number;
  wave: number;
  time: number;
  monsterId: number;
  count: number;
  interval: number;
  spawn: string;
  rewardGold: number;
}

interface RogueOptionDef {
  id: number;
  poolId: number;
  title: string;
  desc: string;
  icon: string;
  weight: number;
  effectType: string;
  effectTarget: string;
  effectValue: number;
  maxStack: number;
}

interface EconomyDef {
  key: string;
  value: number;
  adPlacement: string;
  desc: string;
}

interface ComStrDef {
  id: number;
  confirmType: number;
  title: string;
  content: string;
  cancelText: string;
  confirmText: string;
}

interface AssetDef {
  key: string;
  type: "image" | "spritesheet" | "audio" | "generated";
  url: string;
  preloadGroup: string;
  fallbackKey: string;
  frame?: string;
}

interface UiSkinDef {
  key: string;
  assetKey: string;
  desc: string;
  defaultWidth: number;
  defaultHeight: number;
}

interface PlacedItem {
  uid: number;
  itemId: number;
  x: number;
  y: number;
  cdLeft: number;
}

interface BagState {
  rows: number;
  cols: number;
  gold: number;
  refreshFree: number;
  candidates: number[];
  placed: PlacedItem[];
}

type DragSource = { type: "candidate"; index: number } | { type: "placed"; uid: number };

type DropResult =
  | { kind: "place"; x: number; y: number }
  | { kind: "mergePlaced"; targetUid: number }
  | { kind: "mergeCandidate"; targetIndex: number }
  | { kind: "invalid"; x: number; y: number };

interface CombatBuffs {
  attackMul: number;
  cdMul: number;
  radiusMul: number;
  dotMul: number;
  armorBonus: number;
  qualityAttack: Record<number, number>;
}

interface MonsterRuntime {
  uid: number;
  def: MonsterDef;
  view: Container;
  hp: number;
  maxHp: number;
  x: number;
  y: number;
  slowTimer: number;
  dead: boolean;
}

interface ProjectileRuntime {
  view: Container;
  target: MonsterRuntime;
  x: number;
  y: number;
  speed: number;
  damage: number;
  radius: number;
  color: number;
}

interface FloatingRuntime {
  view: Container;
  ttl: number;
  vy: number;
}

class GameDataManager {
  levels: LevelDef[] = [];
  shapes: ItemShapeDef[] = [];
  qualities: QualityDef[] = [];
  items: ItemDef[] = [];
  skills: SkillDef[] = [];
  effects: EffectDef[] = [];
  monsters: MonsterDef[] = [];
  waves: WaveDef[] = [];
  rogueOptions: RogueOptionDef[] = [];
  economy: EconomyDef[] = [];
  comStr: ComStrDef[] = [];
  assets: AssetDef[] = [];
  uiSkins: UiSkinDef[] = [];

  async loadAll(): Promise<void> {
    const [
      levels,
      shapes,
      qualities,
      items,
      skills,
      effects,
      monsters,
      waves,
      rogueOptions,
      economy,
      comStr,
      assets,
      uiSkins,
    ] = await Promise.all([
      this.fetchTable<LevelDef>("s_level"),
      this.fetchTable<ItemShapeDef>("s_item_shape"),
      this.fetchTable<QualityDef>("s_quality"),
      this.fetchTable<ItemDef>("s_item"),
      this.fetchTable<SkillDef>("s_skill"),
      this.fetchTable<EffectDef>("s_effect"),
      this.fetchTable<MonsterDef>("s_monster"),
      this.fetchTable<WaveDef>("s_wave"),
      this.fetchTable<RogueOptionDef>("s_rogue_option"),
      this.fetchTable<EconomyDef>("s_economy"),
      this.fetchTable<ComStrDef>("s_comstr"),
      this.fetchTable<AssetDef>("s_asset"),
      this.fetchTable<UiSkinDef>("s_ui"),
      this.fetchTable<unknown>("s_animation"),
    ]);

    this.levels = levels;
    this.shapes = shapes;
    this.qualities = qualities;
    this.items = items;
    this.skills = skills;
    this.effects = effects;
    this.monsters = monsters;
    this.waves = waves;
    this.rogueOptions = rogueOptions;
    this.economy = economy;
    this.comStr = comStr;
    this.assets = assets;
    this.uiSkins = uiSkins;
  }

  getLevel(id: number): LevelDef {
    return this.must(this.levels.find((row) => row.id === id), `关卡 ${id}`);
  }

  getItem(id: number): ItemDef {
    return this.must(this.items.find((row) => row.id === id), `物品 ${id}`);
  }

  getShape(id: string): ItemShapeDef {
    return this.must(this.shapes.find((row) => row.id === id), `形状 ${id}`);
  }

  getQuality(id: number): QualityDef {
    return this.must(this.qualities.find((row) => row.id === id), `品质 ${id}`);
  }

  getSkill(id: number): SkillDef {
    return this.must(this.skills.find((row) => row.id === id), `技能 ${id}`);
  }

  getEffect(id: number): EffectDef | undefined {
    return this.effects.find((row) => row.id === id);
  }

  getMonster(id: number): MonsterDef {
    return this.must(this.monsters.find((row) => row.id === id), `怪物 ${id}`);
  }

  getEconomy(key: string): number {
    return this.economy.find((row) => row.key === key)?.value ?? 0;
  }

  getComStr(id: number): ComStrDef {
    return this.must(this.comStr.find((row) => row.id === id), `通用文案 ${id}`);
  }

  getAsset(key: string): AssetDef | undefined {
    return this.assets.find((row) => row.key === key);
  }

  getUiSkin(key: string): UiSkinDef | undefined {
    return this.uiSkins.find((row) => row.key === key);
  }

  getWaves(groupId: number): WaveDef[] {
    return this.waves.filter((row) => row.waveGroupId === groupId).sort((a, b) => a.time - b.time);
  }

  getShopItems(poolId: number): ItemDef[] {
    return this.items.filter((row) => row.pools.includes(poolId));
  }

  getRogueOptions(poolId: number): RogueOptionDef[] {
    return this.rogueOptions.filter((row) => row.poolId <= poolId);
  }

  private async fetchTable<T>(name: string): Promise<T[]> {
    const response = await fetch(`/gamedata/${name}.json`);
    if (!response.ok) {
      throw new Error(`加载配置表失败：${name}`);
    }
    return (await response.json()) as T[];
  }

  private must<T>(value: T | undefined, label: string): T {
    if (!value) {
      throw new Error(`找不到配置：${label}`);
    }
    return value;
  }
}

class AdService {
  async showRewardedAd(placementId: string): Promise<boolean> {
    console.info(`[AdService Mock] 激励视频成功：${placementId}`);
    await new Promise((resolve) => window.setTimeout(resolve, 160));
    return true;
  }
}

class AssetManager {
  private resources = new Map<string, unknown>();

  async preloadGroups(groups: string[]): Promise<void> {
    const targetGroups = new Set(groups);
    const rows = data.assets.filter((asset) => asset.url && asset.type !== "generated" && targetGroups.has(asset.preloadGroup));
    await Promise.all(
      rows.map(async (asset) => {
        try {
          this.resources.set(asset.key, await Assets.load(asset.url));
        } catch (error) {
          console.warn(`资源加载失败，使用占位表现：${asset.key} -> ${asset.url}`, error);
        }
      }),
    );
  }

  texture(assetKey: string | undefined): Texture | undefined {
    if (!assetKey) return undefined;
    const asset = data.getAsset(assetKey);
    const resource = this.resources.get(assetKey);
    if (resource instanceof Texture) return resource;
    if (asset?.frame && typeof resource === "object" && resource && "textures" in resource) {
      const textures = (resource as { textures?: Record<string, Texture> }).textures;
      return textures?.[asset.frame];
    }
    if (asset?.fallbackKey) return this.texture(asset.fallbackKey);
    return undefined;
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

const root = document.querySelector<HTMLDivElement>("#game-root");

if (!root) {
  throw new Error("找不到 #game-root，无法启动游戏。");
}

const app = new Application();

await app.init({
  background: "#172433",
  resizeTo: window,
  antialias: true,
  resolution: Math.min(window.devicePixelRatio || 1, 2),
  autoDensity: true,
});

root.appendChild(app.canvas);
app.stage.eventMode = "static";
app.stage.hitArea = app.screen;

const data = new GameDataManager();
const ads = new AdService();
const assetManager = new AssetManager();

let activeScene: Scene | undefined;
let uidSeed = 1;

interface Scene {
  container: Container;
  update(dt: number): void;
  destroy(): void;
}

function setScene(scene: Scene): void {
  if (activeScene) {
    app.stage.removeChild(activeScene.container);
    activeScene.destroy();
  }
  activeScene = scene;
  app.stage.addChild(scene.container);
}

app.ticker.add((ticker) => {
  activeScene?.update(Math.min(ticker.deltaMS / 1000, 0.05));
});

function color(hex: string): number {
  return Number.parseInt(hex.replace("#", ""), 16);
}

function text(content: string, size: number, fill = "#ffffff", weight: "400" | "700" = "400"): Text {
  return new Text({
    text: content,
    style: new TextStyle({
      fill,
      fontFamily: "Arial, PingFang SC, sans-serif",
      fontSize: size,
      fontWeight: weight,
      align: "center",
      lineHeight: Math.round(size * 1.25),
      wordWrap: true,
      wordWrapWidth: 360,
    }),
  });
}

function uiAssetKey(uiKey: string, fallbackAssetKey?: string): string | undefined {
  return data.getUiSkin(uiKey)?.assetKey || fallbackAssetKey;
}

function spriteFromUi(uiKey: string, width: number, height: number, fallbackAssetKey?: string): Sprite | undefined {
  return assetManager.sprite(uiAssetKey(uiKey, fallbackAssetKey), width, height);
}

function spriteFromAsset(assetKey: string | undefined, width: number, height: number): Sprite | undefined {
  return assetManager.sprite(assetKey, width, height);
}

function addImageOrFallback(parent: Container, sprite: Sprite | undefined, fallback: Container): Container {
  if (sprite) {
    parent.addChild(sprite);
    fallback.destroy({ children: true } as DestroyOptions);
    return sprite;
  }
  parent.addChild(fallback);
  return fallback;
}

function button(label: string, width: number, height: number, bg: number, onTap: () => void): Container {
  const c = new Container();
  c.eventMode = "static";
  c.cursor = "pointer";
  const fallback = new Container();
  const g = new Graphics();
  g.roundRect(0, 0, width, height, 10).fill({ color: bg }).stroke({ color: 0xffffff, width: 2, alpha: 0.35 });
  fallback.addChild(g);
  const t = text(label, 16, "#ffffff", "700");
  t.anchor.set(0.5);
  t.position.set(width / 2, height / 2);
  addImageOrFallback(c, spriteFromUi("button_basic", width, height), fallback);
  c.addChild(t);
  c.on("pointerdown", (event) => {
    event.stopPropagation();
    onTap();
  });
  return c;
}

function glossyButton(label: string, width: number, height: number, bg: number, onTap: () => void, fontSize = 20): Container {
  const c = new Container();
  c.eventMode = "static";
  c.cursor = "pointer";
  const skinKey = bg === 0xffc23d || bg === 0xffb33d || bg === 0xffe05a ? "button_yellow" : bg === 0x2ebaf0 || bg === 0x33bfff ? "button_blue" : bg === 0x33d7ad || bg === 0x28c9b0 ? "button_green" : "button_white";
  const skin = spriteFromUi(skinKey, width, height);
  if (skin) {
    c.addChild(skin);
  } else {
  const shadow = new Graphics();
  shadow.roundRect(3, 5, width, height, 12).fill({ color: 0x1a1a1a, alpha: 0.38 });
  const body = new Graphics();
  body.roundRect(0, 0, width, height, 12).fill({ color: bg });
  body.roundRect(0, 0, width, height, 12).stroke({ color: 0x24313c, width: 4, alpha: 0.85 });
  body.roundRect(6, 6, width - 12, height * 0.38, 9).fill({ color: 0xffffff, alpha: 0.22 });
    c.addChild(shadow, body);
  }
  const t = text(label, fontSize, "#ffffff", "700");
  t.anchor.set(0.5);
  t.position.set(width / 2, height / 2);
  c.addChild(t);
  c.on("pointerdown", (event) => {
    event.stopPropagation();
    onTap();
  });
  return c;
}

function iconButton(label: string, bg: number, onTap: () => void): Container {
  const c = glossyButton(label, 70, 64, bg, onTap, 30);
  return c;
}

function drawGradientBg(container: Container, theme: ThemeName): void {
  const w = app.screen.width;
  const h = app.screen.height;
  const g = new Graphics();
  const base = theme === "green" ? 0x89d66a : theme === "purple" ? 0x3b345f : 0x3c4650;
  const dark = theme === "green" ? 0x3f915b : theme === "purple" ? 0x19152e : 0x1b242c;
  g.rect(0, 0, w, h).fill({ color: dark });
  for (let i = 0; i < 18; i += 1) {
    const alpha = 0.08 + (i % 4) * 0.018;
    g.circle((i * 73) % w, (i * 131) % h, 90 + (i % 3) * 40).fill({ color: base, alpha });
  }
  container.addChildAt(g, 0);
}

function drawMainBg(container: Container): void {
  const w = app.screen.width;
  const h = app.screen.height;
  const g = new Graphics();
  g.rect(0, 0, w, h).fill({ color: 0xffb16f });
  g.rect(0, 0, w, h).fill({ color: 0xff805f, alpha: 0.22 });
  for (let i = 0; i < 20; i += 1) {
    const x = (i * 97) % w;
    const y = 110 + ((i * 143) % Math.max(1, h - 160));
    g.circle(x, y, 44).stroke({ color: 0xe87a52, width: 10, alpha: 0.08 });
    g.moveTo(x - 16, y).lineTo(x + 42, y).stroke({ color: 0xe87a52, width: 9, alpha: 0.08 });
  }
  container.addChildAt(g, 0);
}

function drawTopResourceBar(container: Container): void {
  const entries = [
    { label: "30/30", color: 0xff384e, uiKey: "resource_energy_icon" },
    { label: "0", color: 0xffc34a, uiKey: "resource_ticket_icon" },
    { label: "440", color: 0x39b8ff, uiKey: "resource_coin_icon" },
  ];
  entries.forEach((entry, index) => {
    const x = 24 + index * 150;
    const icon = new Container();
    const iconSprite = spriteFromUi(entry.uiKey, 38, 38);
    if (iconSprite) {
      iconSprite.anchor.set(0.5);
      iconSprite.position.set(x, 28);
      icon.addChild(iconSprite);
    } else {
      icon.addChild(new Graphics().circle(x, 28, 18).fill({ color: entry.color }).stroke({ color: 0x642b2b, width: 3 }));
    }
    const pill = new Graphics();
    pill.roundRect(x + 10, 12, 112, 30, 15).fill({ color: 0x2f2b2a, alpha: 0.9 });
    const t = text(entry.label, 20, "#ffffff", "700");
    t.anchor.set(0.5);
    t.position.set(x + 70, 27);
    container.addChild(pill, icon, t);
  });
}

function drawStageDiorama(level: LevelDef, scale = 1): Container {
  const c = new Container();
  const mapKey = level.id > 1 ? level.lockedMapAssetKey || level.mapAssetKey : level.mapAssetKey;
  const map = spriteFromAsset(mapKey, 320 * scale, 240 * scale);
  if (map) {
    map.anchor.set(0.5);
    c.addChild(map);
    return c;
  }
  const base = new Graphics();
  base.roundRect(-140 * scale, -64 * scale, 280 * scale, 196 * scale, 22 * scale).fill({ color: 0x262f61 });
  base.roundRect(-132 * scale, -58 * scale, 264 * scale, 126 * scale, 18 * scale).fill({ color: level.theme === "purple" ? 0x273057 : level.theme === "steel" ? 0x34414d : 0x435f74 });
  base.roundRect(-132 * scale, 64 * scale, 264 * scale, 70 * scale, 18 * scale).fill({ color: 0x151834 });
  base.stroke({ color: 0x121528, width: 4 * scale });
  c.addChild(base);

  const turret = new Graphics();
  turret.roundRect(-46 * scale, -48 * scale, 92 * scale, 76 * scale, 14 * scale).fill({ color: 0x786b51 }).stroke({ color: 0x2c261f, width: 3 * scale });
  turret.roundRect(-16 * scale, -88 * scale, 32 * scale, 52 * scale, 8 * scale).fill({ color: 0xd24e40 });
  turret.roundRect(-70 * scale, -18 * scale, 84 * scale, 20 * scale, 8 * scale).fill({ color: 0x29323a });
  c.addChild(turret);

  for (let i = 0; i < 8; i += 1) {
    const sx = (i % 4 < 2 ? -1 : 1) * (94 + (i % 2) * 28) * scale;
    const sy = (-34 + Math.floor(i / 2) * 32) * scale;
    const spike = new Graphics();
    spike.moveTo(sx, sy - 20 * scale).lineTo(sx + 18 * scale, sy + 16 * scale).lineTo(sx - 18 * scale, sy + 16 * scale).closePath();
    spike.fill({ color: 0x203a87 }).stroke({ color: 0x0e1d48, width: 3 * scale });
    c.addChild(spike);
  }

  const lock = new Graphics();
  if (level.id > 1) {
    lock.roundRect(-32 * scale, -8 * scale, 64 * scale, 52 * scale, 8 * scale).fill({ color: 0x202020, alpha: 0.8 });
    lock.circle(0, 10 * scale, 14 * scale).fill({ color: 0xdadada });
    c.addChild(lock);
  }
  return c;
}

abstract class GameWindow {
  readonly container = new Container();

  constructor() {
    this.container.eventMode = "static";
  }

  destroy(): void {
    this.container.destroy({ children: true } as DestroyOptions);
  }
}

class WndConfirm extends GameWindow {
  constructor(config: ComStrDef, onConfirm: () => void, onCancel: () => void) {
    super();
    const w = app.screen.width;
    const h = app.screen.height;
    const shade = new Graphics().rect(0, 0, w, h).fill({ color: 0x000000, alpha: 0.68 });
    const panelW = Math.min(w - 52, 560);
    const panelH = 250;
    const x = (w - panelW) / 2;
    const y = h * 0.26;
    const panel = new Graphics();
    panel.roundRect(x, y, panelW, panelH, 12).fill({ color: 0xf3f3f3 }).stroke({ color: 0x1a1a1a, width: 3, alpha: 0.45 });
    panel.rect(x, y, panelW, 6).fill({ color: 0xff7c1f });
    const titleBg = new Graphics();
    titleBg.roundRect(x + 14, y - 38, 230, 58, 14).fill({ color: 0x252525 });
    titleBg.rect(x + 95, y - 26, 130, 24).fill({ color: 0xff7c1f, alpha: 0.26 });
    const title = text(config.title, 25, "#ffffff", "700");
    title.anchor.set(0, 0.5);
    title.position.set(x + 76, y - 10);
    const icon = new Graphics();
    icon.circle(x + 42, y - 10, 34).fill({ color: 0x4b4b4b }).stroke({ color: 0x111111, width: 4 });
    icon.moveTo(x + 26, y - 10).lineTo(x + 58, y - 10).stroke({ color: 0xffffff, width: 7 });
    icon.moveTo(x + 42, y - 26).lineTo(x + 42, y + 6).stroke({ color: 0xffffff, width: 7 });
    const content = text(config.content, 22, "#30343a", "700");
    content.style.align = "left";
    content.style.wordWrapWidth = panelW - 88;
    content.anchor.set(0, 0.5);
    content.position.set(x + 58, y + 96);
    const cancel = glossyButton(config.cancelText, 168, 58, 0x2ebaf0, onCancel, 24);
    const confirm = glossyButton(config.confirmText, 168, 58, 0xffc23d, onConfirm, 24);
    cancel.position.set(x + 48, y + 170);
    confirm.position.set(x + panelW - 216, y + 170);
    this.container.addChild(shade, panel, titleBg, icon, title, content, cancel, confirm);
  }
}

class WndSetting extends GameWindow {
  constructor(onClose: () => void) {
    super();
    const w = app.screen.width;
    const h = app.screen.height;
    this.container.addChild(new Graphics().rect(0, 0, w, h).fill({ color: 0x000000, alpha: 0.62 }));
    const panel = new Graphics();
    panel.roundRect(w * 0.12, h * 0.28, w * 0.76, 250, 18).fill({ color: 0x24303a }).stroke({ color: 0x54c6ff, width: 4 });
    const title = text("游戏设置", 28, "#ffffff", "700");
    title.anchor.set(0.5);
    title.position.set(w / 2, h * 0.34);
    const info = text("音效：开启\n震动：开启\n画质：流畅", 20, "#d8f3ff", "700");
    info.anchor.set(0.5);
    info.position.set(w / 2, h * 0.43);
    const close = glossyButton("确定", 140, 56, 0xffc23d, onClose, 24);
    close.position.set((w - 140) / 2, h * 0.52);
    this.container.addChild(panel, title, info, close);
  }
}

class WndPause extends GameWindow {
  private childWindow: GameWindow | undefined;

  constructor(
    level: LevelDef,
    kills: number,
    gold: number,
    onContinue: () => void,
    onExit: () => void,
  ) {
    super();
    const w = app.screen.width;
    const h = app.screen.height;
    this.container.addChild(new Graphics().rect(0, 0, w, h).fill({ color: 0x05070c, alpha: 0.78 }));
    const titleBg = new Graphics();
    titleBg.roundRect(w / 2 - 130, h * 0.21, 260, 56, 26).fill({ color: 0xff841b });
    titleBg.roundRect(w / 2 - 70, h * 0.23, 132, 36, 18).fill({ color: 0xffc33a, alpha: 0.55 });
    const deco = new Graphics();
    deco.circle(w / 2 - 158, h * 0.24, 11).fill({ color: 0xc6ff68 });
    deco.roundRect(w / 2 - 136, h * 0.235, 82, 18, 9).fill({ color: 0xc6ff68 });
    deco.circle(w / 2 + 152, h * 0.24, 14).fill({ color: 0xffb52a });
    const title = text("暂停", 32, "#ffffff", "700");
    title.anchor.set(0.5);
    title.position.set(w / 2, h * 0.245);

    const panel = new Graphics();
    panel.roundRect(22, h * 0.36, w - 44, 310, 14).fill({ color: 0x252525, alpha: 0.94 }).stroke({ color: 0x777777, width: 3, alpha: 0.72 });
    panel.roundRect(52, h * 0.38, w - 104, 44, 8).fill({ color: 0x444444 });
    const active = text("已启动特性", 23, "#ffffff", "700");
    active.anchor.set(0.5);
    active.position.set(w / 2, h * 0.38 + 22);
    const empty = text(`当前关卡：${level.name}\n本局杀敌：${kills}    当前金币：${gold}`, 18, "#d8d8d8", "700");
    empty.anchor.set(0.5);
    empty.position.set(w / 2, h * 0.5);

    const home = iconButton("⌂", 0x33d7ad, () => this.openConfirm(onExit));
    const cont = glossyButton("继续挑战", 178, 64, 0xffc23d, onContinue, 24);
    const setting = iconButton("⚙", 0x33bfff, () => this.openSetting());
    home.position.set(72, h * 0.77);
    cont.position.set((w - 178) / 2, h * 0.77);
    setting.position.set(w - 142, h * 0.77);
    this.container.addChild(titleBg, deco, title, panel, active, empty, home, cont, setting);
  }

  private openConfirm(onExit: () => void): void {
    this.childWindow?.destroy();
    this.childWindow = new WndConfirm(data.getComStr(1), onExit, () => {
      this.childWindow?.destroy();
      this.childWindow = undefined;
    });
    this.container.addChild(this.childWindow.container);
  }

  private openSetting(): void {
    this.childWindow?.destroy();
    this.childWindow = new WndSetting(() => {
      this.childWindow?.destroy();
      this.childWindow = undefined;
    });
    this.container.addChild(this.childWindow.container);
  }
}

class WndRogueOption extends GameWindow {
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

class WndResult extends GameWindow {
  constructor(level: LevelDef, win: boolean, kills: number, gold: number, wave: number, onConfirm: () => void) {
    super();
    const w = app.screen.width;
    const h = app.screen.height;
    this.container.addChild(new Graphics().rect(0, 0, w, h).fill({ color: 0x070910, alpha: 0.82 }));
    const ghost = new Graphics();
    ghost.circle(w / 2, h * 0.17, 62).fill({ color: win ? 0xffd95a : 0xb9b9b9, alpha: 0.38 }).stroke({ color: 0xffffff, width: 5, alpha: 0.7 });
    ghost.moveTo(w / 2 - 28, h * 0.16).lineTo(w / 2 - 8, h * 0.19).lineTo(w / 2 + 26, h * 0.13).stroke({ color: 0xffffff, width: 7, alpha: 0.8 });
    const title = text(`${level.name}   ${wave}/${level.winWave}波`, 24, "#ffffff", "700");
    title.anchor.set(0.5);
    title.position.set(w / 2, h * 0.28);
    const titleBg = new Graphics().roundRect(w / 2 - 160, h * 0.25, 320, 48, 24).fill({ color: 0xbfbfbf, alpha: 0.62 });

    const panel = new Graphics();
    panel.roundRect(0, h * 0.36, w, 310, 14).fill({ color: 0x252525, alpha: 0.94 }).stroke({ color: 0x777777, width: 3, alpha: 0.72 });
    panel.roundRect(18, h * 0.375, w - 36, 44, 8).fill({ color: 0xe54a23 });
    const rewardTitle = text("获得奖励", 24, "#ffffff", "700");
    rewardTitle.anchor.set(0.5);
    rewardTitle.position.set(w / 2, h * 0.375 + 22);
    const expCard = this.rewardCard("EXP", kills * 12, 0xb53cff, "result_exp_icon");
    const coinCard = this.rewardCard("★", Math.max(20, gold), 0x46cf58, "result_coin_icon");
    expCard.position.set(36, h * 0.46);
    coinCard.position.set(148, h * 0.46);
    const resultText = text(win ? "挑战完成" : "挑战结束", 26, win ? "#ffdf59" : "#cccccc", "700");
    resultText.anchor.set(0.5);
    resultText.position.set(w / 2, h * 0.33);
    const ok = glossyButton("确定", 176, 64, 0xffc23d, onConfirm, 26);
    ok.position.set((w - 176) / 2, h * 0.82);
    this.container.addChild(ghost, titleBg, title, resultText, panel, rewardTitle, expCard, coinCard, ok);
  }

  private rewardCard(label: string, value: number, bg: number, uiKey: string): Container {
    const c = new Container();
    const g = new Graphics().roundRect(0, 0, 88, 88, 9).fill({ color: bg }).stroke({ color: 0xffffff, width: 3, alpha: 0.55 });
    const icon = spriteFromUi(uiKey, 54, 54);
    if (icon) {
      icon.anchor.set(0.5);
      icon.position.set(44, 34);
    }
    const l = text(label, 28, "#ffffff", "700");
    l.anchor.set(0.5);
    l.position.set(44, 34);
    const v = text(String(value), 20, "#ffffff", "700");
    v.anchor.set(0.5);
    v.position.set(58, 66);
    c.addChild(g);
    if (icon) c.addChild(icon);
    else c.addChild(l);
    c.addChild(v);
    return c;
  }
}

function createWeaponIcon(item: ItemDef, quality: QualityDef, size: number): Container {
  const c = new Container();
  const qColor = color(quality.color);
  const bg = new Graphics();
  bg.roundRect(-size / 2, -size / 2, size, size, 10).fill({ color: 0x233140, alpha: 0.95 });
  bg.stroke({ color: qColor, width: 4, alpha: 0.95 });
  c.addChild(bg);

  const art = spriteFromAsset(item.iconAssetKey || `weapon_${item.icon}_icon`, size * 0.72, size * 0.72);
  if (art) {
    art.anchor.set(0.5);
    c.addChild(art);
    return c;
  }

  const icon = new Graphics();
  if (item.icon === "ball") {
    icon.circle(0, 0, size * 0.24).fill({ color: 0xf17a45 }).stroke({ color: 0x6d2b22, width: 3 });
    icon.moveTo(-size * 0.18, -size * 0.06).lineTo(size * 0.18, size * 0.06).stroke({ color: 0x69221e, width: 2 });
  } else if (item.icon === "bat") {
    icon.roundRect(-size * 0.3, -size * 0.08, size * 0.6, size * 0.16, 6).fill({ color: 0xa36b45 });
    icon.circle(size * 0.22, 0, size * 0.14).fill({ color: 0x69412e });
  } else if (item.icon === "spear") {
    icon.moveTo(0, -size * 0.34).lineTo(size * 0.14, -size * 0.1).lineTo(size * 0.04, -size * 0.1).lineTo(size * 0.04, size * 0.3).lineTo(-size * 0.04, size * 0.3).lineTo(-size * 0.04, -size * 0.1).lineTo(-size * 0.14, -size * 0.1).closePath();
    icon.fill({ color: 0x7fe6ff }).stroke({ color: 0x274a6c, width: 2 });
  } else if (item.icon === "shield") {
    icon.moveTo(0, -size * 0.3).lineTo(size * 0.25, -size * 0.12).lineTo(size * 0.16, size * 0.22).lineTo(0, size * 0.34).lineTo(-size * 0.16, size * 0.22).lineTo(-size * 0.25, -size * 0.12).closePath();
    icon.fill({ color: 0x75dc8a }).stroke({ color: 0x24573a, width: 3 });
  } else if (item.icon === "bomb") {
    icon.circle(0, size * 0.07, size * 0.22).fill({ color: 0x3e3e48 }).stroke({ color: 0xffd25a, width: 3 });
    icon.moveTo(size * 0.1, -size * 0.12).lineTo(size * 0.24, -size * 0.32).stroke({ color: 0xffd25a, width: 4 });
  } else {
    icon.circle(0, 0, size * 0.18).fill({ color: qColor });
    icon.roundRect(-size * 0.08, -size * 0.34, size * 0.16, size * 0.68, 4).fill({ color: 0x4b2a7d });
  }
  c.addChild(icon);
  return c;
}

function createItemShapeView(item: ItemDef, shape: ItemShapeDef, quality: QualityDef, cellSize: number): Container {
  const c = new Container();
  const qColor = color(quality.color);
  for (const [x, y] of shape.cells) {
    const g = new Graphics();
    g.roundRect(x * cellSize, y * cellSize, cellSize - 4, cellSize - 4, 9);
    g.fill({ color: 0x233140, alpha: 0.92 });
    g.stroke({ color: qColor, width: 3 });
    c.addChild(g);
  }

  const maxX = Math.max(...shape.cells.map(([x]) => x));
  const maxY = Math.max(...shape.cells.map(([, y]) => y));
  const icon = createWeaponIcon(item, quality, Math.min(cellSize * 0.82, 58));
  icon.position.set((maxX + 1) * cellSize * 0.5 - 2, (maxY + 1) * cellSize * 0.5 - 2);
  c.addChild(icon);
  return c;
}

function weightedPick<T extends { weight: number }>(items: T[]): T {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let roll = Math.random() * total;
  for (const item of items) {
    roll -= item.weight;
    if (roll <= 0) {
      return item;
    }
  }
  return items[items.length - 1];
}

function screenPoint(event: PointerEvent): { x: number; y: number } {
  const rect = app.canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * app.screen.width,
    y: ((event.clientY - rect.top) / rect.height) * app.screen.height,
  };
}

abstract class BaseScene implements Scene {
  container = new Container();
  protected disposed = false;

  update(_dt: number): void {}

  destroy(): void {
    this.disposed = true;
    this.container.destroy({ children: true } as DestroyOptions);
  }
}

class LoadingScene extends BaseScene {
  private progress = 0;
  private bar = new Graphics();
  private label = text("Loading ...", 24, "#ffffff", "700");

  constructor() {
    super();
    this.redraw();
    void this.load();
  }

  override update(dt: number): void {
    this.progress = Math.min(this.progress + dt * 0.65, 0.92);
    this.redraw();
  }

  private async load(): Promise<void> {
    await data.loadAll();
    await assetManager.preloadGroups(["boot", "main", "bag", "battle", "ui"]);
    if (this.disposed) return;
    this.progress = 1;
    this.redraw();
    window.setTimeout(() => setScene(new WndMain()), 250);
  }

  private redraw(): void {
    this.container.removeChildren();
    drawGradientBg(this.container, "green");
    const w = app.screen.width;
    const h = app.screen.height;
    const hero = new Graphics();
    hero.circle(w / 2, h * 0.43, 34).fill({ color: 0xff5b5b }).stroke({ color: 0xffffff, width: 4, alpha: 0.55 });
    hero.roundRect(w / 2 - 62, h * 0.43 + 34, 124, 24, 12).fill({ color: 0x1f2b39 });

    this.bar.clear();
    this.bar.roundRect(w * 0.16, h * 0.56, w * 0.68, 24, 12).fill({ color: 0x111822 });
    this.bar.roundRect(w * 0.16, h * 0.56, w * 0.68 * this.progress, 24, 12).fill({ color: 0x45f0c2 });
    this.bar.stroke({ color: 0xffffff, width: 2, alpha: 0.35 });
    this.label.anchor.set(0.5);
    this.label.position.set(w / 2, h * 0.62);
    this.container.addChild(hero, this.bar, this.label);
  }
}

class WndMain extends BaseScene {
  private selectedIndex = 0;

  constructor() {
    super();
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
    const start = glossyButton("开始游戏\n🧨 x6", Math.min(250, w * 0.52), 92, 0xffe05a, () => setScene(new BagScene(level)), 28);
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

class BagScene extends BaseScene {
  private state: BagState;
  private toast = "";
  private toastTimer = 0;
  private cellSize = 66;
  private gridLeft = 0;
  private gridTop = 0;
  private dragView: Container | undefined;
  private hintLayer: Container | undefined;
  private draggingItemId = 0;
  private draggingSource: DragSource | undefined;

  constructor(private readonly level: LevelDef, initialState?: BagState) {
    super();
    this.state = initialState ?? {
      rows: level.initRows,
      cols: level.initCols,
      gold: level.initGold,
      refreshFree: data.getEconomy("bag_refresh_free_count"),
      candidates: [this.rollItem(), this.rollItem(), this.rollItem()],
      placed: [],
    };
    for (const placed of this.state.placed) {
      placed.cdLeft = 0;
    }
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

  private rollItem(): number {
    return weightedPick(data.getShopItems(this.level.shopPoolId)).id;
  }

  private draw(): void {
    this.container.removeChildren();
    drawGradientBg(this.container, "green");
    const w = app.screen.width;
    const h = app.screen.height;
    this.cellSize = Math.min(66, Math.floor((w - 76) / Math.max(this.state.cols, 4)));
    const boardW = this.state.cols * this.cellSize;
    const boardH = this.state.rows * this.cellSize;
    this.gridLeft = (w - boardW) / 2;
    this.gridTop = 164;

    const title = text(this.level.name, 24, "#ffffff", "700");
    title.anchor.set(0.5);
    title.position.set(w / 2, 38);
    const gold = text(`金币 ${this.state.gold}`, 18, "#ffe67b", "700");
    gold.anchor.set(0, 0.5);
    gold.position.set(24, 78);
    const hp = text(`背包 ${this.state.rows}x${this.state.cols}`, 16, "#ffffff", "700");
    hp.anchor.set(1, 0.5);
    hp.position.set(w - 24, 78);

    const boardBg = new Graphics();
    boardBg.roundRect(this.gridLeft - 18, this.gridTop - 18, boardW + 36, boardH + 36, 20);
    boardBg.fill({ color: 0x654b36, alpha: 0.96 });
    boardBg.stroke({ color: 0x261b16, width: 4 });
    this.container.addChild(title, gold, hp, boardBg);

    for (let y = 0; y < this.state.rows; y += 1) {
      for (let x = 0; x < this.state.cols; x += 1) {
        const cell = new Graphics();
        cell.roundRect(this.gridLeft + x * this.cellSize + 3, this.gridTop + y * this.cellSize + 3, this.cellSize - 6, this.cellSize - 6, 8);
        cell.fill({ color: 0xf3e7d1 });
        cell.stroke({ color: 0x2d241d, width: 2, alpha: 0.75 });
        this.container.addChild(cell);
      }
    }

    for (const placed of this.state.placed) {
      const item = data.getItem(placed.itemId);
      const shape = data.getShape(item.shapeId);
      const quality = data.getQuality(item.quality);
      const view = createItemShapeView(item, shape, quality, this.cellSize);
      view.position.set(this.gridLeft + placed.x * this.cellSize + 2, this.gridTop + placed.y * this.cellSize + 2);
      view.eventMode = "static";
      view.cursor = "grab";
      view.on("pointerdown", (event) => {
        event.stopPropagation();
        this.startDrag(placed.itemId, { type: "placed", uid: placed.uid }, event.global.x, event.global.y);
      });
      this.container.addChild(view);
    }

    const hint = text("拖到空格放置，拖到同武器同品质上合成", 14, "#244b3a", "700");
    hint.anchor.set(0.5);
    hint.position.set(w / 2, this.gridTop + boardH + 42);
    this.container.addChild(hint);

    this.drawCandidateArea(h);
    this.drawActions(w, h);

    if (this.toast) {
      const t = text(this.toast, 18, "#ffffff", "700");
      t.anchor.set(0.5);
      t.position.set(w / 2, 132);
      const bg = new Graphics();
      bg.roundRect(w / 2 - 150, 112, 300, 42, 20).fill({ color: 0x000000, alpha: 0.55 });
      this.container.addChild(bg, t);
    }
  }

  private drawCandidateArea(h: number): void {
    const slotSize = 74;
    const gap = 16;
    const totalWidth = this.state.candidates.length * slotSize + (this.state.candidates.length - 1) * gap;
    const startX = (app.screen.width - totalWidth) / 2;
    const y = h - 142;
    this.state.candidates.forEach((itemId, index) => {
      const slotX = startX + index * (slotSize + gap);
      const slotBg = new Graphics();
      slotBg.roundRect(slotX, y, slotSize, slotSize, 12).fill({ color: 0x233140, alpha: itemId ? 0.55 : 0.28 });
      slotBg.stroke({ color: itemId ? 0xc9f2ff : 0x7d8a96, width: 3, alpha: itemId ? 0.9 : 0.45 });
      this.container.addChild(slotBg);

      if (!itemId) {
        const empty = text("空", 15, "#9fb2c2", "700");
        empty.anchor.set(0.5);
        empty.position.set(slotX + slotSize / 2, y + slotSize / 2);
        this.container.addChild(empty);
        return;
      }

      const item = data.getItem(itemId);
      const quality = data.getQuality(item.quality);
      const c = createWeaponIcon(item, quality, 64);
      c.position.set(slotX + slotSize / 2, y + slotSize / 2);
      c.eventMode = "static";
      c.cursor = "grab";
      c.on("pointerdown", (event) => {
        event.stopPropagation();
        this.startDrag(itemId, { type: "candidate", index }, event.global.x, event.global.y);
      });
      const label = text(item.name, 12, "#ffffff", "700");
      label.anchor.set(0.5);
      label.position.set(slotX + slotSize / 2, y + 86);
      this.container.addChild(c, label);
    });
  }

  private drawActions(w: number, h: number): void {
    const refreshLabel = this.state.refreshFree > 0 ? `刷新 免费(${this.state.refreshFree})` : `刷新 ${data.getEconomy("bag_refresh_gold_cost")}`;
    const refresh = button(refreshLabel, 122, 42, 0x28c9b0, () => void this.refreshCandidates());
    const expand = button("扩格 30/广告", 122, 42, 0x32a0e6, () => void this.expandBag());
    const start = button("开始战斗", 122, 48, 0xffb33d, () => this.tryStartBattle());
    refresh.position.set(20, h - 58);
    expand.position.set((w - 122) / 2, h - 58);
    start.position.set(w - 142, h - 61);
    this.container.addChild(refresh, expand, start);
  }

  private startDrag(itemId: number, source: DragSource, x: number, y: number): void {
    const item = data.getItem(itemId);
    const view = createItemShapeView(item, data.getShape(item.shapeId), data.getQuality(item.quality), this.cellSize);
    view.alpha = 0.88;
    view.position.set(x, y);
    view.scale.set(0.9);
    this.dragView = view;
    this.hintLayer = new Container();
    this.draggingItemId = itemId;
    this.draggingSource = source;
    this.container.addChild(this.hintLayer, view);
    this.updateDragHint(x, y);

    const move = (event: PointerEvent) => {
      const p = screenPoint(event);
      view.position.set(p.x - this.cellSize * 0.5, p.y - this.cellSize * 0.5);
      this.updateDragHint(p.x, p.y);
    };
    const up = (event: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      const p = screenPoint(event);
      this.finishDrag(p.x, p.y);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  private finishDrag(x: number, y: number): void {
    const result = this.resolveDrop(x, y);
    this.dragView?.destroy({ children: true } as DestroyOptions);
    this.hintLayer?.destroy({ children: true } as DestroyOptions);
    this.dragView = undefined;
    this.hintLayer = undefined;

    if (result.kind === "mergePlaced") {
      this.mergeIntoPlaced(result.targetUid);
    } else if (result.kind === "mergeCandidate") {
      this.mergeIntoCandidate(result.targetIndex);
    } else if (result.kind === "place") {
      this.removeDragSource();
      this.state.placed.push({ uid: uidSeed++, itemId: this.draggingItemId, x: result.x, y: result.y, cdLeft: 0 });
      this.toast = "放置成功";
      this.toastTimer = 0.9;
    } else {
      this.toast = "这里放不下";
      this.toastTimer = 0.9;
    }
    this.draggingSource = undefined;
    this.draw();
  }

  private updateDragHint(x: number, y: number): void {
    if (!this.hintLayer) return;
    this.hintLayer.removeChildren();
    const result = this.resolveDrop(x, y);
    const item = data.getItem(this.draggingItemId);
    const shape = data.getShape(item.shapeId);
    const quality = data.getQuality(item.quality);
    const label = result.kind === "mergePlaced" || result.kind === "mergeCandidate" ? "可合成" : result.kind === "place" ? "可放置" : "不可放置";
    const tint = result.kind === "mergePlaced" || result.kind === "mergeCandidate" ? 0xb66dff : result.kind === "place" ? 0x43f184 : 0xff4d5d;
    const alpha = result.kind === "invalid" ? 0.22 : 0.36;

    if (result.kind === "mergeCandidate") {
      const rect = this.candidateRect(result.targetIndex);
      const g = new Graphics();
      g.roundRect(rect.x - 5, rect.y - 5, rect.w + 10, rect.h + 10, 14).fill({ color: tint, alpha });
      g.stroke({ color: tint, width: 5, alpha: 0.95 });
      this.hintLayer.addChild(g);
      this.addHintText(rect.x + rect.w / 2, rect.y - 18, label, tint);
      return;
    }

    if (result.kind === "mergePlaced") {
      const target = this.state.placed.find((placed) => placed.uid === result.targetUid);
      if (target) {
        const targetItem = data.getItem(target.itemId);
        const targetShape = data.getShape(targetItem.shapeId);
        this.drawShapeHint(target.x, target.y, targetShape, tint, 0.42);
        this.addHintText(this.gridLeft + target.x * this.cellSize + this.cellSize / 2, this.gridTop + target.y * this.cellSize - 18, label, tint);
      }
      return;
    }

    this.drawShapeHint(result.x, result.y, shape, tint, alpha);
    this.addHintText(x, y - 50, label, tint);
    const pulse = new Graphics();
    pulse.circle(x, y, 16 + Math.sin(performance.now() / 90) * 4).stroke({ color: color(quality.color), width: 3, alpha: 0.8 });
    this.hintLayer.addChild(pulse);
  }

  private drawShapeHint(x: number, y: number, shape: ItemShapeDef, tint: number, alpha: number): void {
    if (!this.hintLayer) return;
    for (const [dx, dy] of shape.cells) {
      const g = new Graphics();
      g.roundRect(this.gridLeft + (x + dx) * this.cellSize + 3, this.gridTop + (y + dy) * this.cellSize + 3, this.cellSize - 6, this.cellSize - 6, 8);
      g.fill({ color: tint, alpha });
      g.stroke({ color: tint, width: 4, alpha: 0.92 });
      this.hintLayer.addChild(g);
    }
  }

  private addHintText(x: number, y: number, label: string, tint: number): void {
    if (!this.hintLayer) return;
    const t = text(label, 15, "#ffffff", "700");
    t.anchor.set(0.5);
    t.position.set(x, Math.max(106, y));
    const bg = new Graphics();
    bg.roundRect(t.x - 42, t.y - 16, 84, 30, 15).fill({ color: tint, alpha: 0.92 });
    this.hintLayer.addChild(bg, t);
  }

  private resolveDrop(x: number, y: number): DropResult {
    const candidateIndex = this.candidateIndexAt(x, y);
    if (candidateIndex >= 0) {
      const targetItemId = this.state.candidates[candidateIndex] ?? 0;
      if (targetItemId && this.canMerge(this.draggingItemId, targetItemId, this.draggingSource, { type: "candidate", index: candidateIndex })) {
        return { kind: "mergeCandidate", targetIndex: candidateIndex };
      }
      return { kind: "invalid", x: 0, y: 0 };
    }

    const gridX = Math.floor((x - this.gridLeft) / this.cellSize);
    const gridY = Math.floor((y - this.gridTop) / this.cellSize);
    const target = this.findPlacedAt(gridX, gridY);
    if (target && this.canMerge(this.draggingItemId, target.itemId, this.draggingSource, { type: "placed", uid: target.uid })) {
      return { kind: "mergePlaced", targetUid: target.uid };
    }

    if (this.canPlace(this.draggingItemId, gridX, gridY, this.draggingSource?.type === "placed" ? [this.draggingSource.uid] : [])) {
      return { kind: "place", x: gridX, y: gridY };
    }
    return { kind: "invalid", x: gridX, y: gridY };
  }

  private canPlace(itemId: number, x: number, y: number, ignoring: number[] = []): boolean {
    const shape = data.getShape(data.getItem(itemId).shapeId);
    if (x < 0 || y < 0) return false;
    const occupied = this.occupiedMap(ignoring);
    for (const [dx, dy] of shape.cells) {
      const gx = x + dx;
      const gy = y + dy;
      if (gx < 0 || gy < 0 || gx >= this.state.cols || gy >= this.state.rows) return false;
      if (occupied.has(`${gx},${gy}`)) return false;
    }
    return true;
  }

  private findPlacedAt(x: number, y: number): PlacedItem | undefined {
    return this.state.placed.find((placed) => {
      const item = data.getItem(placed.itemId);
      return data.getShape(item.shapeId).cells.some(([dx, dy]) => placed.x + dx === x && placed.y + dy === y);
    });
  }

  private candidateRect(index: number): { x: number; y: number; w: number; h: number } {
    const slotSize = 74;
    const gap = 16;
    const totalWidth = this.state.candidates.length * slotSize + (this.state.candidates.length - 1) * gap;
    const startX = (app.screen.width - totalWidth) / 2;
    return { x: startX + index * (slotSize + gap), y: app.screen.height - 142, w: slotSize, h: slotSize };
  }

  private candidateIndexAt(x: number, y: number): number {
    return this.state.candidates.findIndex((_, index) => {
      const rect = this.candidateRect(index);
      return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
    });
  }

  private canMerge(
    sourceItemId: number,
    targetItemId: number,
    source: DragSource | undefined,
    target: DragSource,
  ): boolean {
    if (!source || (source.type === target.type && ("uid" in source ? source.uid === (target as { uid?: number }).uid : source.index === (target as { index?: number }).index))) {
      return false;
    }
    const sourceItem = data.getItem(sourceItemId);
    const targetItem = data.getItem(targetItemId);
    return sourceItem.baseId === targetItem.baseId && sourceItem.quality === targetItem.quality && Boolean(sourceItem.mergeToId);
  }

  private removeDragSource(): void {
    if (!this.draggingSource) return;
    if (this.draggingSource.type === "candidate") {
      this.state.candidates[this.draggingSource.index] = 0;
      return;
    }
    this.state.placed = this.state.placed.filter((placed) => placed.uid !== this.draggingSource?.uid);
  }

  private mergeIntoPlaced(targetUid: number): void {
    const sourceItem = data.getItem(this.draggingItemId);
    const target = this.state.placed.find((placed) => placed.uid === targetUid);
    if (!target || !sourceItem.mergeToId) return;
    const x = target.x;
    const y = target.y;
    this.removeDragSource();
    this.state.placed = this.state.placed.filter((placed) => placed.uid !== targetUid);
    if (this.canPlace(sourceItem.mergeToId, x, y)) {
      this.state.placed.push({ uid: uidSeed++, itemId: sourceItem.mergeToId, x, y, cdLeft: 0 });
    } else {
      this.state.candidates[this.firstEmptyCandidateIndex()] = sourceItem.mergeToId;
    }
    this.toast = `合成 ${data.getItem(sourceItem.mergeToId).name}`;
    this.toastTimer = 1.2;
  }

  private mergeIntoCandidate(targetIndex: number): void {
    const sourceItem = data.getItem(this.draggingItemId);
    if (!sourceItem.mergeToId) return;
    this.removeDragSource();
    this.state.candidates[targetIndex] = sourceItem.mergeToId;
    this.toast = `合成 ${data.getItem(sourceItem.mergeToId).name}`;
    this.toastTimer = 1.2;
  }

  private firstEmptyCandidateIndex(): number {
    const emptyIndex = this.state.candidates.findIndex((itemId) => !itemId);
    return emptyIndex >= 0 ? emptyIndex : 0;
  }

  private occupiedMap(ignoring: number[] = []): Set<string> {
    const occupied = new Set<string>();
    for (const placed of this.state.placed) {
      if (ignoring.includes(placed.uid)) continue;
      const item = data.getItem(placed.itemId);
      for (const [dx, dy] of data.getShape(item.shapeId).cells) {
        occupied.add(`${placed.x + dx},${placed.y + dy}`);
      }
    }
    return occupied;
  }

  private checkMerge(): void {
    let changed = true;
    while (changed) {
      changed = false;
      const groups = new Map<string, PlacedItem[]>();
      for (const placed of this.state.placed) {
        const item = data.getItem(placed.itemId);
        const key = `${item.baseId}-${item.quality}`;
        groups.set(key, [...(groups.get(key) ?? []), placed]);
      }
      for (const group of groups.values()) {
        if (group.length < 2) continue;
        const firstItem = data.getItem(group[0].itemId);
        if (!firstItem.mergeToId) continue;
        const [a, b] = group;
        this.state.placed = this.state.placed.filter((item) => item.uid !== a.uid && item.uid !== b.uid);
        if (this.canPlace(firstItem.mergeToId, a.x, a.y)) {
          this.state.placed.push({ uid: uidSeed++, itemId: firstItem.mergeToId, x: a.x, y: a.y, cdLeft: 0 });
        } else {
          this.state.candidates[0] = firstItem.mergeToId;
        }
        this.toast = `合成 ${data.getItem(firstItem.mergeToId).name}`;
        this.toastTimer = 1.2;
        changed = true;
        break;
      }
    }
  }

  private async refreshCandidates(): Promise<void> {
    const cost = data.getEconomy("bag_refresh_gold_cost");
    if (this.state.refreshFree > 0) {
      this.state.refreshFree -= 1;
    } else if (this.state.gold >= cost) {
      this.state.gold -= cost;
    } else {
      await ads.showRewardedAd("bag_refresh");
    }
    this.state.candidates = [this.rollItem(), this.rollItem(), this.rollItem()];
    this.toast = "候选武器已刷新";
    this.toastTimer = 0.8;
    this.draw();
  }

  private async expandBag(): Promise<void> {
    if (this.state.cols >= this.level.maxCols && this.state.rows >= this.level.maxRows) {
      this.toast = "背包已经扩到上限";
      this.toastTimer = 1;
      this.draw();
      return;
    }
    const cost = data.getEconomy("bag_expand_gold_cost");
    if (this.state.gold >= cost) {
      this.state.gold -= cost;
    } else {
      await ads.showRewardedAd("bag_expand");
    }
    if (this.state.cols < this.level.maxCols) this.state.cols += 1;
    else this.state.rows += 1;
    this.toast = "背包扩展成功";
    this.toastTimer = 1;
    this.draw();
  }

  private tryStartBattle(): void {
    if (this.state.placed.length === 0) {
      this.toast = "至少放入一件武器";
      this.toastTimer = 1;
      this.draw();
      return;
    }
    setScene(new BattleScene(this.level, this.state));
  }
}

class BattleScene extends BaseScene {
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
    this.monsters.push({ uid: uidSeed++, def, view, hp: def.hp, maxHp: def.hp, x, y, slowTimer: 0, dead: false });
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
      const view = new Graphics().circle(0, 0, 8).fill({ color: color(skill.color) }).stroke({ color: 0xffffff, width: 2, alpha: 0.45 });
      view.position.set(startX, startY);
      this.battleLayer.addChild(view);
      this.projectiles.push({ view, target, x: startX, y: startY, speed: skill.speed, damage, radius: skill.radius, color: color(skill.color) });
    } else if ((skill.type === "aoe" || skill.type === "dot") && target) {
      const radius = skill.radius * this.buffs.radiusMul;
      this.areaDamage(target.x, target.y, radius, damage, skill);
    } else if (skill.type === "melee" && target) {
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
    this.modalWindow = new WndResult(this.level, win, this.kills, this.bag.gold, this.currentWave, () => setScene(new WndMain()));
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
      () => setScene(new WndMain()),
    );
    this.container.addChild(this.modalWindow.container);
  }
}

setScene(new LoadingScene());
