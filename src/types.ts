import type { Container, Graphics } from "pixi.js";

export type ThemeName = "green" | "purple" | "steel";

export interface LevelDef {
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
  battleTuningId?: number;
  waveGroupId: number;
  shopPoolId: number;
  roguePoolId: number;
  winWave: number;
  mapAssetKey?: string;
  lockedMapAssetKey?: string;
  battleFieldKey?: string;
  entryCostResource?: "dynamite" | "coin" | "energy";
  entryCostAmount?: number;
  firstPassRewardCoin?: number;
  repeatWinRewardCoin?: number;
  loseRewardCoin?: number;
}

export interface ItemShapeDef {
  id: string;
  name: string;
  cells: [number, number][];
  allowRotate: boolean;
  previewScale: number;
}

export interface QualityDef {
  id: number;
  name: string;
  color: string;
  attackMul: number;
  mergeNeed: number;
  nextQuality: number;
}

export interface ItemDef {
  id: number;
  baseId: string;
  name: string;
  quality: number;
  shapeId: string;
  icon: string;
  iconAssetKey?: string;
  battleIconAssetKey?: string;
  projectileAssetKey?: string;
  skillId: number;
  mergeToId: number;
  weight: number;
  pools: number[];
}

export interface SkillDef {
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
  projectileAnimKey?: string;
  hitAnimKey?: string;
  killAnimKey?: string;
  groundFxAnimKey?: string;
  projectileRotateToTarget?: boolean;
  hitUseProjectileRotation?: boolean;
  hitStopDuration?: number;
  impactSpinTurns?: number;
  impactSpinDuration?: number;
}

export interface EffectDef {
  id: number;
  type: string;
  value: number;
  duration: number;
}

export interface MonsterDef {
  id: number;
  name: string;
  hp: number;
  armor: number;
  speed: number;
  attack: number;
  attackInterval: number;
  gold: number;
  exp: number;
  radius: number;
  color: string;
  boss: boolean;
  layerType?: "ground" | "flying" | "boss";
  attackDistance?: number;
  runAnimKey?: string;
  attackAnimKey?: string;
  deathAnimKey?: string;
  roarSkillKey?: string;
}

export interface BossSkillDef {
  key: string;
  monsterId: number;
  trigger: "onHit" | "afterSpawn";
  animKey: string;
  cd: number;
  delay?: number;
  duration: number;
  speedMul: number;
  attackMul: number;
  attackSpeedMul?: number;
  target: "otherMonsters";
  desc: string;
}

export interface BattleTuningDef {
  id: number;
  name: string;
  desc: string;
  baseHpMul: number;
  baseArmorAdd: number;
  expNeedBase: number;
  expNeedPerLevel: number;
  monsterHpMul: number;
  monsterArmorAdd: number;
  monsterAttackMul: number;
  monsterSpeedMul: number;
  monsterGoldMul: number;
  monsterExpMul: number;
  waveRewardGoldMul: number;
}

export interface BattleFieldDef {
  key: string;
  name: string;
  bgAssetKey: string;
  fenceAssetKey: string;
  fenceForegroundAssetKey?: string;
  fenceForegroundY?: number;
  fenceCoversMonsters?: boolean;
  baseAssetKey: string;
  monsterContactMode: "line" | "fenceForeground";
  monsterContactY: number;
  monsterContactOffsetY?: number;
  baseHitFxY: number;
  heroY: number;
  hpBarY: number;
  monsterAttackHitFrame?: number;
  monsterAttackHitTime?: number;
  desc: string;
}

export interface ResolvedWaveTuning {
  monsterHpMul: number;
  monsterArmorAdd: number;
  monsterAttackMul: number;
  monsterSpeedMul: number;
  monsterGoldMul: number;
  monsterExpMul: number;
  rewardGoldMul: number;
}

export interface WaveDef {
  waveGroupId: number;
  wave: number;
  time: number;
  monsterId: number;
  count: number;
  interval: number;
  spawn: string;
  rewardGold: number;
  expandRows?: number;
  expandCols?: number;
  monsterHpMul?: number;
  monsterArmorAdd?: number;
  monsterAttackMul?: number;
  monsterSpeedMul?: number;
  monsterGoldMul?: number;
  monsterExpMul?: number;
  rewardGoldMul?: number;
  desc?: string;
}

export interface RogueOptionDef {
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

export interface EconomyDef {
  key: string;
  value: number;
  adPlacement: string;
  desc: string;
}

export interface ComStrDef {
  id: number;
  confirmType: number;
  title: string;
  content: string;
  cancelText: string;
  confirmText: string;
}

export interface AnimationDef {
  key: string;
  assetKey: string;
  frames: string[];
  fps: number;
  loop: boolean;
  anchorX: number;
  anchorY: number;
  scale: number;
  damageFrame?: number;
  shakeFrame?: number;
  fxFrame?: number;
  hitFrame?: number;
  hitHoldFrame?: number;
  hitHoldDuration?: number;
  hitFadeDuration?: number;
  soundKey?: string;
}

export interface AssetDef {
  key: string;
  type: "image" | "spritesheet" | "audio" | "generated";
  url: string;
  preloadGroup: string;
  fallbackKey: string;
  frame?: string;
}

export interface UiSkinDef {
  key: string;
  assetKey: string;
  desc: string;
  defaultWidth: number;
  defaultHeight: number;
  pressScale?: number;
}

export type UiLayoutAnchor =
  | "topLeft"
  | "topCenter"
  | "topRight"
  | "centerLeft"
  | "center"
  | "centerRight"
  | "bottomLeft"
  | "bottomCenter"
  | "bottomRight";

export interface UiLayoutDef {
  scene: string;
  key: string;
  anchor: UiLayoutAnchor;
  x: number;
  y: number;
  width: number;
  height: number;
  iconSize?: number;
  labelOffsetY?: number;
  fontSize?: number;
  textColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
  scale?: number;
  gap?: number;
  visible: boolean;
  desc: string;
}

export interface AudioDef {
  key: string;
  type: "music" | "sfx";
  url: string;
  preloadGroup: string;
  loop: boolean;
  volume: number;
  maxConcurrent: number;
  generatedFreq: number;
  desc: string;
}

export interface AudioEventDef {
  event: string;
  audioKey: string;
  category: "music" | "sfx";
  cooldownMs: number;
  desc: string;
}

export interface AudioSettings {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  mutedMusic: boolean;
  mutedSfx: boolean;
}

export interface PlacedItem {
  uid: number;
  itemId: number;
  x: number;
  y: number;
  cdLeft: number;
}

export interface BagState {
  rows: number;
  cols: number;
  gold: number;
  refreshFree: number;
  candidates: number[];
  placed: PlacedItem[];
  currentWave?: number;
  baseHp?: number;
}

export type DragSource = { type: "candidate"; index: number } | { type: "placed"; uid: number };

export type DropResult =
  | { kind: "place"; x: number; y: number }
  | { kind: "replace"; x: number; y: number; targetUids: number[] }
  | { kind: "mergePlaced"; targetUid: number }
  | { kind: "mergeCandidate"; targetIndex: number }
  | { kind: "invalid"; x: number; y: number };

export interface CombatBuffs {
  attackMul: number;
  cdMul: number;
  radiusMul: number;
  dotMul: number;
  armorBonus: number;
  qualityAttack: Record<number, number>;
}

export interface MonsterRuntime {
  uid: number;
  def: MonsterDef;
  view: Container;
  hpBarTrack?: Graphics;
  hpBarFill?: Graphics;
  hp: number;
  maxHp: number;
  x: number;
  y: number;
  slowTimer: number;
  hitStopTimer: number;
  attackCooldown: number;
  attackWindupTimer?: number;
  attackDamagePending?: boolean;
  speedBuffMul?: number;
  attackBuffMul?: number;
  attackSpeedBuffMul?: number;
  bossBuffTimer?: number;
  bossRoarCooldown?: number;
  bossRoarTimer?: number;
  spawnAge?: number;
  lastContactY?: number;
  lastBaseHitY?: number;
  dead: boolean;
  deathVisualDone?: boolean;
  animationKey?: string;
}

export interface ProjectileRuntime {
  view: Container;
  target: MonsterRuntime;
  skill: SkillDef;
  x: number;
  y: number;
  speed: number;
  damage: number;
  radius: number;
  color: number;
  spinSpeed?: number;
  impactType?: "carrotSpin";
  impactAssetKey?: string;
  hitDistance: number;
  rotateToTarget: boolean;
}

export interface FloatingRuntime {
  view: Container;
  ttl: number;
  maxTtl?: number;
  vy: number;
  popScale?: number;
}

export interface SpinDamageRuntime {
  view: Container;
  x: number;
  y: number;
  radius: number;
  damage: number;
  ttl: number;
  hitUids: Set<number>;
  spinSpeed: number;
}
