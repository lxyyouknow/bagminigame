import type { AnimationDef, AssetDef, AudioDef, AudioEventDef, BattleTuningDef, ComStrDef, EconomyDef, EffectDef, ItemDef, ItemShapeDef, LevelDef, MonsterDef, QualityDef, RogueOptionDef, SkillDef, UiLayoutDef, UiSkinDef, WaveDef } from "../types";

export class GameDataManager {
  levels: LevelDef[] = [];
  shapes: ItemShapeDef[] = [];
  qualities: QualityDef[] = [];
  items: ItemDef[] = [];
  skills: SkillDef[] = [];
  effects: EffectDef[] = [];
  monsters: MonsterDef[] = [];
  battleTunings: BattleTuningDef[] = [];
  waves: WaveDef[] = [];
  rogueOptions: RogueOptionDef[] = [];
  economy: EconomyDef[] = [];
  comStr: ComStrDef[] = [];
  assets: AssetDef[] = [];
  animations: AnimationDef[] = [];
  uiSkins: UiSkinDef[] = [];
  uiLayouts: UiLayoutDef[] = [];
  audio: AudioDef[] = [];
  audioEvents: AudioEventDef[] = [];

  async loadAll(): Promise<void> {
    const [
      levels,
      shapes,
      qualities,
      items,
      skills,
      effects,
      monsters,
      battleTunings,
      waves,
      rogueOptions,
      economy,
      comStr,
      assets,
      uiSkins,
      uiLayouts,
      audio,
      audioEvents,
      animations,
    ] = await Promise.all([
      this.fetchTable<LevelDef>("s_level"),
      this.fetchTable<ItemShapeDef>("s_item_shape"),
      this.fetchTable<QualityDef>("s_quality"),
      this.fetchTable<ItemDef>("s_item"),
      this.fetchTable<SkillDef>("s_skill"),
      this.fetchTable<EffectDef>("s_effect"),
      this.fetchTable<MonsterDef>("s_monster"),
      this.fetchTable<BattleTuningDef>("s_battle_tuning"),
      this.fetchTable<WaveDef>("s_wave"),
      this.fetchTable<RogueOptionDef>("s_rogue_option"),
      this.fetchTable<EconomyDef>("s_economy"),
      this.fetchTable<ComStrDef>("s_comstr"),
      this.fetchTable<AssetDef>("s_asset"),
      this.fetchTable<UiSkinDef>("s_ui"),
      this.fetchTable<UiLayoutDef>("s_ui_layout"),
      this.fetchTable<AudioDef>("s_audio"),
      this.fetchTable<AudioEventDef>("s_audio_event"),
      this.fetchTable<AnimationDef>("s_animation"),
    ]);

    this.levels = levels;
    this.shapes = shapes;
    this.qualities = qualities;
    this.items = items;
    this.skills = skills;
    this.effects = effects;
    this.monsters = monsters;
    this.battleTunings = battleTunings;
    this.waves = waves;
    this.rogueOptions = rogueOptions;
    this.economy = economy;
    this.comStr = comStr;
    this.assets = assets;
    this.animations = animations;
    this.uiSkins = uiSkins;
    this.uiLayouts = uiLayouts;
    this.audio = audio;
    this.audioEvents = audioEvents;
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

  getBattleTuning(id: number | undefined): BattleTuningDef {
    const tuningId = id ?? 1;
    return this.must(this.battleTunings.find((row) => row.id === tuningId), `战斗难度 ${tuningId}`);
  }

  getEconomy(key: string): number {
    return this.economy.find((row) => row.key === key)?.value ?? 0;
  }

  getEconomyAdPlacement(key: string): string {
    return this.economy.find((row) => row.key === key)?.adPlacement ?? "";
  }

  getComStr(id: number): ComStrDef {
    return this.must(this.comStr.find((row) => row.id === id), `通用文案 ${id}`);
  }

  getAsset(key: string): AssetDef | undefined {
    return this.assets.find((row) => row.key === key);
  }

  getAnimation(key: string): AnimationDef | undefined {
    return this.animations.find((row) => row.key === key);
  }

  getUiSkin(key: string): UiSkinDef | undefined {
    return this.uiSkins.find((row) => row.key === key);
  }

  getUiLayout(scene: string, key: string): UiLayoutDef | undefined {
    return this.uiLayouts.find((row) => row.scene === scene && row.key === key);
  }

  getAudio(key: string): AudioDef | undefined {
    return this.audio.find((row) => row.key === key);
  }

  getAudioEvent(event: string): AudioEventDef | undefined {
    return this.audioEvents.find((row) => row.event === event);
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
