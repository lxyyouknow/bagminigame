import { Container, Graphics, Rectangle, type DestroyOptions } from "pixi.js";
import type { BagState, DragSource, DropResult, ItemShapeDef, LevelDef, PlacedItem } from "../types";
import { ads, app, assetManager, audio, data, nextUid } from "../core/runtime";
import { showBattle } from "../core/navigation";
import { addImageOrFallback, createItemShapeView, drawAssetBg, screenPoint, text, uiButton, weightedPick, color, spriteFromAsset } from "../utils/display";
import { getUiLayout, resolveUiLayoutPosition, resolveUiLayoutRect, scaleUiLayoutSize } from "../ui/layout/UiLayout";
import {
  findNearestDragTarget,
  isSameDragSource,
  shapeOriginFromPointer,
  shouldDetachPlacedOnRelease,
  shouldShowInvalidDropHint,
  shouldToastInvalidDrop,
} from "./bagDragUi";
import { BaseScene } from "./BaseScene";
import type { RunSessionState } from "./runSessionState";
import { refreshWaveCandidates } from "./battleWaveRules";
import { getBaseMaxHp } from "./battleDifficultyRules";
import { shouldShowBagTextFeedback } from "./bagTextFeedbackRules";

interface Point {
  x: number;
  y: number;
}

interface CandidateMotion {
  view: Container;
  label?: Container;
  from: Point;
  to: Point;
  labelOffsetY: number;
  elapsed: number;
  duration: number;
}

interface CandidateLayoutTarget {
  x: number;
  y: number;
  width: number;
  height: number;
  labelOffsetY: number;
}

type MergeDragTarget =
  | { key: string; kind: "placed"; centerX: number; centerY: number; captureRadius: number; targetUid: number }
  | { key: string; kind: "candidate"; centerX: number; centerY: number; captureRadius: number; targetIndex: number };

interface FarmPlot {
  x: number;
  y: number;
  widthCells: number;
  heightCells: number;
  assetKey: string;
  cells: [number, number][];
}

interface PlacedPlantView {
  view: Container;
  baseX: number;
  baseY: number;
  centerX: number;
  centerY: number;
}

interface PlantShootMotion {
  uid: number;
  elapsed: number;
  duration: number;
}

export interface FarmBoardMetrics {
  gridLeft: number;
  gridTop: number;
  cellSize: number;
  cellGap: number;
  rows: number;
  cols: number;
}

export class BagScene extends BaseScene {
  private state: BagState;
  private toast = "";
  private toastTimer = 0;
  private cellSize = 66;
  private cellGap = 5;
  private boardPadding = 28;
  private gridLeft = 0;
  private gridTop = 0;
  private dragView: Container | undefined;
  private hintLayer: Container | undefined;
  private draggingItemId = 0;
  private draggingSource: DragSource | undefined;
  private dragOffset: Point = { x: 0, y: 0 };
  private sourceRemovedForDrag = false;
  private dragRestorePlaced: PlacedItem | undefined;
  private dragRestoreCandidateIndex = -1;
  private candidateViews = new Map<string, { view: Container; label?: Container }>();
  private candidateMotions: CandidateMotion[] = [];
  private pendingCandidateStarts = new Map<string, Point>();
  private runSession?: RunSessionState;
  private topHudLayer: Container | undefined;
  private candidateAreaLayer: Container | undefined;
  private refreshActionLayer: Container | undefined;
  private startActionLayer: Container | undefined;
  private candidateAreaExitDistance = 0;
  private refreshActionExitDistance = 0;
  private startActionExitDistance = 0;
  private topHudExitProgress = 0;
  private combatMode = false;
  private moleWorkerAnimKey = "mole_worker_idle";
  private combatCooldownLayer: Container | undefined;
  private placedPlantViews = new Map<number, PlacedPlantView>();
  private plantShootMotions = new Map<number, PlantShootMotion>();

  constructor(
    private readonly level: LevelDef,
    initialState?: BagState,
    entryToast?: string,
    private readonly onStartBattle?: () => void,
    runSession?: RunSessionState,
  ) {
    super();
    this.runSession = runSession;
    const tuning = data.getBattleTuning(level.battleTuningId);
    const baseMaxHp = getBaseMaxHp(level, tuning);
    this.state = initialState ?? {
      rows: level.initRows,
      cols: level.initCols,
      gold: level.initGold,
      refreshFree: data.getEconomy("bag_refresh_free_count"),
      candidates: [this.rollItem(), this.rollItem(), this.rollItem()],
      placed: [],
      currentWave: 1,
      baseHp: baseMaxHp,
    };
    this.state.currentWave ??= 1;
    this.state.baseHp ??= baseMaxHp;
    for (const placed of this.state.placed) {
      placed.cdLeft = 0;
    }
    if (entryToast) {
      this.toast = entryToast;
      this.toastTimer = 1.8;
    }
    this.draw();
  }

  getState(): BagState {
    return this.state;
  }

  attachRunSession(session: RunSessionState): void {
    this.runSession = session;
  }

  refresh(entryToast?: string): void {
    if (entryToast) {
      this.toast = entryToast;
      this.toastTimer = 1.8;
    }
    for (const placed of this.state.placed) placed.cdLeft = 0;
    this.draw();
  }

  refreshAfterWave(entryToast: string): void {
    refreshWaveCandidates(this.state, () => this.rollItem());
    audio.playSfxEvent("bag_refresh");
    this.refresh(entryToast);
  }

  setTopHudExitProgress(progress: number): void {
    this.topHudExitProgress = Math.max(0, Math.min(1, progress));
    this.applyTopHudTransition();
    this.applyCandidateAreaTransition();
    this.applyRefreshActionTransition();
    this.applyStartActionTransition();
  }

  setCombatMode(enabled: boolean): void {
    if (this.combatMode === enabled) return;
    this.combatMode = enabled;
    if (enabled) this.moleWorkerAnimKey = "mole_worker_idle";
    this.draw();
  }

  playMoleWorkerVictory(): void {
    this.moleWorkerAnimKey = "mole_worker_victory";
    this.draw();
  }

  playMoleWorkerIdle(): void {
    this.moleWorkerAnimKey = "mole_worker_idle";
    this.draw();
  }

  getFarmBoardMetrics(cameraOffsetY = this.container.y): FarmBoardMetrics {
    return {
      gridLeft: this.gridLeft,
      gridTop: this.gridTop + cameraOffsetY,
      cellSize: this.cellSize,
      cellGap: this.cellGap,
      rows: this.state.rows,
      cols: this.state.cols,
    };
  }

  syncCombatCooldowns(cdMultiplier = 1): void {
    if (!this.combatMode || !this.combatCooldownLayer) return;
    this.redrawCombatCooldowns(cdMultiplier);
  }

  playPlantShootPunch(uid: number): void {
    if (!this.combatMode || !this.placedPlantViews.has(uid)) return;
    this.plantShootMotions.set(uid, { uid, elapsed: 0, duration: 0.22 });
    this.applyPlantShootMotion(uid, 0);
  }

  override update(dt: number): void {
    this.updateCandidateMotions(dt);
    this.updatePlantShootMotions(dt);
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) {
        this.toast = "";
        this.draw();
      }
    }
  }

  private rollItem(quality?: number): number {
    const pool = data.getShopItems(this.level.shopPoolId);
    const qualityPool = quality ? data.items.filter((item) => item.quality === quality) : pool;
    return weightedPick(qualityPool.length > 0 ? qualityPool : pool).id;
  }

  private draw(): void {
    this.candidateViews.clear();
    this.candidateMotions = [];
    this.topHudLayer = undefined;
    this.candidateAreaLayer = undefined;
    this.refreshActionLayer = undefined;
    this.startActionLayer = undefined;
    this.candidateAreaExitDistance = 0;
    this.refreshActionExitDistance = 0;
    this.startActionExitDistance = 0;
    this.combatCooldownLayer = undefined;
    this.placedPlantViews.clear();
    this.plantShootMotions.clear();
    this.container.removeChildren();
    drawAssetBg(this.container, "bg_bag_prebattle");
    this.drawMoleWorkerIdle();
    const w = app.screen.width;
    const h = app.screen.height;
    const boardLayout = this.layout("board", {
      scene: "bag",
      key: "board",
      anchor: "topCenter",
      x: 0,
      y: 164,
      width: w - 76,
      height: w - 76,
      scale: 66,
      visible: true,
      desc: "背包棋盘顶部中心点，scale 为最大格子尺寸",
    });
    const boardAvailableW = Math.min(boardLayout.width, w - 76);
    this.cellSize = Math.min(boardLayout.scale ?? 120, Math.floor(boardAvailableW / Math.max(this.state.cols, 1)));
    const pitch = this.cellSize + this.cellGap;
    const boardW = this.state.cols * this.cellSize + Math.max(0, this.state.cols - 1) * this.cellGap;
    const boardH = this.state.rows * this.cellSize + Math.max(0, this.state.rows - 1) * this.cellGap;
    const boardFrameW = boardW + this.boardPadding * 2;
    const boardFrameH = boardH + this.boardPadding * 2;
    const boardCenterX = w / 2 + boardLayout.x;
    const boardCenterY = h * 0.35 + boardLayout.y - 164;
    this.gridLeft = boardCenterX - boardW / 2;
    this.gridTop = boardCenterY - boardFrameH / 2 + this.boardPadding;

    const topBarLayout = scaleUiLayoutSize(this.layout("top_bar", {
      scene: "bag",
      key: "top_bar",
      anchor: "topCenter",
      x: 0,
      y: 0,
      width: 686,
      height: 204,
      scale: 1,
      visible: true,
      desc: "战前背包顶部道具栏图片",
    }));
    const topBarRect = resolveUiLayoutRect(topBarLayout, w, h);
    const topBar = spriteFromAsset("ui_bag_top_resource_bar", topBarRect.width, topBarRect.height);
    if (topBar) topBar.position.set(topBarRect.x, topBarRect.y);

    const goldValueLayout = this.layout("gold_value", {
      scene: "bag",
      key: "gold_value",
      anchor: "topLeft",
      x: 58,
      y: 94,
      width: 96,
      height: 28,
      fontSize: 22,
      textColor: "#fff4c2",
      strokeColor: "#6b3a16",
      strokeWidth: 3,
      visible: true,
      desc: "背包左上角金币图标下方金币数量文本",
    });
    const goldValuePos = resolveUiLayoutPosition(goldValueLayout, w, h);
    const goldValueText = text(String(this.state.gold), goldValueLayout.fontSize ?? 22, goldValueLayout.textColor ?? "#fff4c2", "700", {
      strokeColor: goldValueLayout.strokeColor,
      strokeWidth: goldValueLayout.strokeWidth,
    });
    goldValueText.anchor.set(0.5);
    goldValueText.position.set(goldValuePos.x, goldValuePos.y);

    const currentWave = this.runSession?.currentWave ?? this.state.currentWave ?? 1;
    const waveValueLayout = this.layout("wave_value", {
      scene: "bag",
      key: "wave_value",
      anchor: "topCenter",
      x: 135,
      y: 108,
      width: 80,
      height: 32,
      fontSize: 30,
      visible: true,
      desc: "顶部道具栏内波次数字",
    });
    const waveValuePos = resolveUiLayoutPosition(waveValueLayout, w, h);
    const waveValueText = text(String(currentWave), waveValueLayout.fontSize ?? 30, waveValueLayout.textColor ?? "#ffffff", "700", {
      strokeColor: waveValueLayout.strokeColor,
      strokeWidth: waveValueLayout.strokeWidth,
    });
    waveValueText.anchor.set(0.5);
    waveValueText.position.set(waveValuePos.x, waveValuePos.y);

    const hpValueLayout = this.layout("hp_value", {
      scene: "bag",
      key: "hp_value",
      anchor: "topCenter",
      x: 245,
      y: 108,
      width: 100,
      height: 32,
      fontSize: 30,
      visible: true,
      desc: "顶部道具栏内基地血量数字",
    });
    const hpValuePos = resolveUiLayoutPosition(hpValueLayout, w, h);
    const hpValue = Math.round(this.runSession?.baseHp ?? this.state.baseHp ?? getBaseMaxHp(this.level, data.getBattleTuning(this.level.battleTuningId)));
    const hpValueText = text(String(hpValue), hpValueLayout.fontSize ?? 30, hpValueLayout.textColor ?? "#ffffff", "700", {
      strokeColor: hpValueLayout.strokeColor,
      strokeWidth: hpValueLayout.strokeWidth,
    });
    hpValueText.anchor.set(0, 0.5);
    hpValueText.position.set(hpValuePos.x, hpValuePos.y);

    const bagSizeValueLayout = this.layout("bag_size_value", {
      scene: "bag",
      key: "bag_size_value",
      anchor: "topCenter",
      x: 118,
      y: 165,
      width: 90,
      height: 28,
      fontSize: 24,
      visible: true,
      desc: "顶部道具栏内田野布局数字",
    });
    const bagSizeValuePos = resolveUiLayoutPosition(bagSizeValueLayout, w, h);
    const bagSizeValueText = text(`${this.state.rows}×${this.state.cols}`, bagSizeValueLayout.fontSize ?? 24, bagSizeValueLayout.textColor ?? "#6b3a16", "700", {
      strokeColor: bagSizeValueLayout.strokeColor,
      strokeWidth: bagSizeValueLayout.strokeWidth,
    });
    bagSizeValueText.anchor.set(0, 0.5);
    bagSizeValueText.position.set(bagSizeValuePos.x, bagSizeValuePos.y);

    const boardBg = new Container();
    boardBg.position.set(this.gridLeft - this.boardPadding, this.gridTop - this.boardPadding);
    const boardFallback = new Container();
    const fallbackBg = new Graphics();
    fallbackBg.roundRect(0, 0, boardFrameW, boardFrameH, 20);
    fallbackBg.fill({ color: 0x654b36, alpha: 0.96 });
    fallbackBg.stroke({ color: 0x261b16, width: 4 });
    boardFallback.addChild(fallbackBg);
    addImageOrFallback(boardBg, spriteFromAsset("bag_farm_frame", boardFrameW, boardFrameH), boardFallback);
    if (boardLayout.visible) this.container.addChild(boardBg);

    const mergedFarmPlots = this.mergedFarmPlots();
    for (let y = 0; y < this.state.rows; y += 1) {
      for (let x = 0; x < this.state.cols; x += 1) {
        if (mergedFarmPlots.skipCells.has(this.gridCellKey(x, y))) continue;
        const cell = new Container();
        cell.position.set(this.gridLeft + x * pitch, this.gridTop + y * pitch);
        const fallbackCell = new Container();
        fallbackCell.addChild(
          new Graphics()
            .roundRect(0, 0, this.cellSize, this.cellSize, 8)
            .fill({ color: 0xf3e7d1 })
            .stroke({ color: 0x2d241d, width: 2, alpha: 0.75 }),
        );
        addImageOrFallback(cell, spriteFromAsset("bag_farm_cell", this.cellSize, this.cellSize), fallbackCell);
        this.container.addChild(cell);
      }
    }
    for (const plot of mergedFarmPlots.plots) {
      const cell = new Container();
      const plotW = plot.widthCells * this.cellSize + Math.max(0, plot.widthCells - 1) * this.cellGap;
      const plotH = plot.heightCells * this.cellSize + Math.max(0, plot.heightCells - 1) * this.cellGap;
      cell.position.set(this.gridLeft + plot.x * pitch, this.gridTop + plot.y * pitch);
      const fallbackCell = this.createMergedFarmFallback(plot);
      addImageOrFallback(cell, spriteFromAsset(plot.assetKey, plotW, plotH), fallbackCell);
      this.container.addChild(cell);
    }

    for (const placed of this.state.placed) {
      const item = data.getItem(placed.itemId);
      const shape = data.getShape(item.shapeId);
      const quality = data.getQuality(item.quality);
      const view = createItemShapeView(item, shape, quality, this.cellSize, this.cellGap, 0.9);
      view.position.set(this.gridLeft + placed.x * pitch, this.gridTop + placed.y * pitch);
      const size = this.itemShapePixelSize(placed.itemId);
      this.placedPlantViews.set(placed.uid, {
        view,
        baseX: view.x,
        baseY: view.y,
        centerX: size.width / 2,
        centerY: size.height / 2,
      });
      if (!this.combatMode) {
        view.eventMode = "static";
        view.cursor = "grab";
        view.on("pointerdown", (event) => {
          event.stopPropagation();
          this.startDrag(placed.itemId, { type: "placed", uid: placed.uid }, event.global.x, event.global.y);
        });
      }
      this.container.addChild(view);
    }

    if (this.combatMode) {
      this.combatCooldownLayer = new Container();
      this.redrawCombatCooldowns();
      this.container.addChild(this.combatCooldownLayer);
    }

    const hintLayout = this.layout("hint", {
      scene: "bag",
      key: "hint",
      anchor: "topCenter",
      x: 0,
      y: 42,
      width: 340,
      height: 28,
      fontSize: 14,
      visible: true,
      desc: "背包棋盘下方提示，y 相对棋盘底部",
    });
    if (!this.combatMode && hintLayout.visible && shouldShowBagTextFeedback()) {
      const hint = text("拖到空格放置，拖到同武器同品质上合成", hintLayout.fontSize ?? 14, "#244b3a", "700");
      hint.anchor.set(0.5);
      const hintPos = resolveUiLayoutPosition({ ...hintLayout, y: this.gridTop + boardH + hintLayout.y }, w, h);
      hint.position.set(hintPos.x, hintPos.y);
      this.container.addChild(hint);
    }

    if (!this.combatMode) {
      this.drawCandidateArea();
      this.drawActions(w, h);
    }
    const topHud = new Container();
    if (topBarLayout.visible && topBar) topHud.addChild(topBar);
    if (goldValueLayout.visible) topHud.addChild(goldValueText);
    if (waveValueLayout.visible) topHud.addChild(waveValueText);
    if (hpValueLayout.visible) topHud.addChild(hpValueText);
    if (bagSizeValueLayout.visible) topHud.addChild(bagSizeValueText);
    if (!this.combatMode && topHud.children.length > 0) {
      this.topHudLayer = topHud;
      this.applyTopHudTransition();
      this.container.addChild(topHud);
    }

    if (!this.combatMode && this.toast && shouldShowBagTextFeedback()) {
      const toastLayout = this.layout("toast", {
        scene: "bag",
        key: "toast",
        anchor: "topCenter",
        x: 0,
        y: 132,
        width: 300,
        height: 42,
        fontSize: 18,
        visible: true,
        desc: "背包提示气泡",
      });
      if (!toastLayout.visible) return;
      const toastRect = resolveUiLayoutRect(toastLayout, w, h);
      const t = text(this.toast, toastLayout.fontSize ?? 18, "#ffffff", "700");
      t.anchor.set(0.5);
      t.position.set(toastRect.x + toastRect.width / 2, toastRect.y + toastRect.height / 2);
      const bg = new Graphics();
      bg.roundRect(toastRect.x, toastRect.y, toastRect.width, toastRect.height, 20).fill({ color: 0x000000, alpha: 0.55 });
      this.container.addChild(bg, t);
    }

    if (this.hintLayer) this.container.addChild(this.hintLayer);
    if (this.dragView) this.container.addChild(this.dragView);
  }

  private redrawCombatCooldowns(cdMultiplier = 1): void {
    if (!this.combatCooldownLayer) return;
    this.combatCooldownLayer.removeChildren();
    const pitch = this.cellSize + this.cellGap;
    for (const placed of this.state.placed) {
      const item = data.getItem(placed.itemId);
      const shape = data.getShape(item.shapeId);
      const skill = data.getSkill(item.skillId);
      const fullCd = Math.max(0.1, skill.cd * Math.max(0.05, cdMultiplier));
      const rate = Math.max(0, Math.min(1, placed.cdLeft / fullCd));
      if (rate <= 0) continue;
      const shade = this.createShapeCooldownShade(shape, rate);
      shade.position.set(this.gridLeft + placed.x * pitch, this.gridTop + placed.y * pitch);
      this.combatCooldownLayer.addChild(shade);
    }
  }

  private createShapeCooldownShade(shape: ItemShapeDef, rate: number): Graphics {
    const shade = new Graphics();
    const pitch = this.cellSize + this.cellGap;
    const cells = shape.cells;
    const cellKeys = new Set(cells.map(([x, y]) => this.gridCellKey(x, y)));
    const minY = Math.min(...cells.map(([, y]) => y));
    const maxY = Math.max(...cells.map(([, y]) => y));
    const totalHeight = (maxY - minY + 1) * this.cellSize + (maxY - minY) * this.cellGap;
    const shadeHeight = totalHeight * rate;

    for (const [dx, dy] of cells) {
      const localY = (dy - minY) * pitch;
      const visibleH = Math.max(0, Math.min(this.cellSize, shadeHeight - localY));
      if (visibleH <= 0) continue;
      shade.rect(dx * pitch, dy * pitch, this.cellSize, visibleH);

      if (cellKeys.has(this.gridCellKey(dx + 1, dy))) {
        shade.rect(dx * pitch + this.cellSize, dy * pitch, this.cellGap, visibleH);
      }

      if (cellKeys.has(this.gridCellKey(dx, dy + 1))) {
        const bridgeY = localY + this.cellSize;
        const bridgeH = Math.max(0, Math.min(this.cellGap, shadeHeight - bridgeY));
        if (bridgeH > 0) shade.rect(dx * pitch, dy * pitch + this.cellSize, this.cellSize, bridgeH);
      }
    }

    shade.fill({ color: 0x000000, alpha: 0.42 });
    return shade;
  }

  private updatePlantShootMotions(dt: number): void {
    if (this.plantShootMotions.size === 0) return;
    for (const motion of [...this.plantShootMotions.values()]) {
      motion.elapsed += Math.max(0, dt);
      if (motion.elapsed >= motion.duration) {
        this.resetPlantShootMotion(motion.uid);
        this.plantShootMotions.delete(motion.uid);
        continue;
      }
      this.applyPlantShootMotion(motion.uid, motion.elapsed / motion.duration);
    }
  }

  private applyPlantShootMotion(uid: number, progress: number): void {
    const target = this.placedPlantViews.get(uid);
    if (!target || target.view.destroyed) return;
    const frame = this.plantShootFrame(progress);
    target.view.scale.set(frame.scaleX, frame.scaleY);
    target.view.position.set(
      target.baseX + target.centerX * (1 - frame.scaleX),
      target.baseY + target.centerY * (1 - frame.scaleY) + frame.offsetY,
    );
  }

  private resetPlantShootMotion(uid: number): void {
    const target = this.placedPlantViews.get(uid);
    if (!target || target.view.destroyed) return;
    target.view.scale.set(1, 1);
    target.view.position.set(target.baseX, target.baseY);
  }

  private plantShootFrame(progress: number): { scaleX: number; scaleY: number; offsetY: number } {
    const keys = [
      { t: 0, scaleX: 1, scaleY: 1, offsetY: 0 },
      { t: 0.18, scaleX: 1.08, scaleY: 0.88, offsetY: 4 },
      { t: 0.42, scaleX: 0.92, scaleY: 1.16, offsetY: -8 },
      { t: 0.73, scaleX: 1.03, scaleY: 0.97, offsetY: 1 },
      { t: 1, scaleX: 1, scaleY: 1, offsetY: 0 },
    ];
    for (let i = 1; i < keys.length; i += 1) {
      const prev = keys[i - 1];
      const next = keys[i];
      if (progress <= next.t) {
        const local = (progress - prev.t) / Math.max(0.001, next.t - prev.t);
        const eased = this.easePlantShoot(local);
        return {
          scaleX: prev.scaleX + (next.scaleX - prev.scaleX) * eased,
          scaleY: prev.scaleY + (next.scaleY - prev.scaleY) * eased,
          offsetY: prev.offsetY + (next.offsetY - prev.offsetY) * eased,
        };
      }
    }
    return keys[keys.length - 1];
  }

  private easePlantShoot(value: number): number {
    return 1 - Math.pow(1 - Math.min(1, Math.max(0, value)), 3);
  }

  private drawMoleWorkerIdle(): void {
    const layout = this.layout("mole_worker_idle", {
      scene: "bag",
      key: "mole_worker_idle",
      anchor: "bottomCenter",
      x: -246,
      y: -500,
      width: 512,
      height: 512,
      scale: 0.42,
      visible: true,
      desc: "战前背包界面鼹鼠小工人待机循环动画，x/y 控制中心点，scale 控制显示缩放",
    });
    if (!layout.visible) return;
    const worker = assetManager.animation(this.moleWorkerAnimKey) ?? assetManager.animation("mole_worker_idle");
    if (!worker) return;
    const pos = resolveUiLayoutPosition(layout, app.screen.width, app.screen.height);
    worker.position.set(pos.x, pos.y);
    worker.scale.set(layout.scale ?? 1);
    worker.play();
    this.container.addChild(worker);
  }

  private drawCandidateArea(): void {
    const layer = new Container();
    const cartLayout = scaleUiLayoutSize(this.layout("candidate_cart", {
      scene: "bag",
      key: "candidate_cart",
      anchor: "bottomCenter",
      x: 0,
      y: -505,
      width: 720,
      height: 238,
      scale: 0.68,
      visible: true,
      desc: "Candidate cart background for the three pre-battle item slots",
    }));
    if (cartLayout.visible) {
      const cartRect = resolveUiLayoutRect(cartLayout, app.screen.width, app.screen.height);
      const cart = spriteFromAsset("ui_bag_candidate_cart", cartRect.width, cartRect.height);
      if (cart) {
        cart.position.set(cartRect.x, cartRect.y);
        layer.addChild(cart);
      }
    }

    const layout = this.layout("candidates", {
      scene: "bag",
      key: "candidates",
      anchor: "bottomCenter",
      x: 0,
      y: -405,
      width: 120,
      height: 120,
      gap: 24,
      fontSize: 16,
      visible: true,
      desc: "背包备战区，width/height 为单格尺寸，武器按自身占格大小显示",
    });
    if (!layout.visible) return;
    const targets = this.candidateLayoutTargets(layout);
    const keys = this.candidateKeysFor();
    this.state.candidates.forEach((itemId, index) => {
      const item = data.getItem(itemId);
      const shape = data.getShape(item.shapeId);
      const target = targets[index];
      const group = new Container();
      group.hitArea = new Rectangle(-target.width / 2, -target.height / 2, target.width, target.height);
      const hit = new Graphics();
      hit.roundRect(-target.width / 2, -target.height / 2, target.width, target.height, 14).fill({ color: 0xffffff, alpha: 0 });
      const icon = createItemShapeView(item, shape, data.getQuality(item.quality), this.cellSize, this.cellGap, 0.9);
      const visualOffset = this.dragVisualCenterOffset(shape, this.cellSize);
      icon.position.set(-visualOffset.x, -visualOffset.y);
      group.eventMode = "static";
      group.cursor = "grab";
      group.on("pointerdown", (event) => {
        event.stopPropagation();
        this.startDrag(itemId, { type: "candidate", index }, event.global.x, event.global.y);
      });
      group.addChild(hit, icon);
      group.position.set(target.x, target.y);

      const key = keys[index];
      const start = this.pendingCandidateStarts.get(key);
      if (start && (Math.abs(start.x - target.x) > 1 || Math.abs(start.y - target.y) > 1)) {
        group.position.set(start.x, start.y);
        this.candidateMotions.push({ view: group, from: start, to: target, labelOffsetY: target.labelOffsetY, elapsed: 0, duration: 0.18 });
      }

      this.candidateViews.set(key, { view: group });
      layer.addChild(group);
    });
    if (layer.children.length > 0) {
      this.candidateAreaLayer = layer;
      this.candidateAreaExitDistance = Math.max(160, app.screen.width + 80);
      this.applyCandidateAreaTransition();
      this.container.addChild(layer);
    }
    this.pendingCandidateStarts.clear();
  }

  private applyTopHudTransition(): void {
    if (!this.topHudLayer) return;
    this.topHudLayer.y = -Math.round(220 * this.topHudExitProgress);
    this.topHudLayer.alpha = 1 - this.topHudExitProgress;
  }

  private applyCandidateAreaTransition(): void {
    if (!this.candidateAreaLayer) return;
    this.candidateAreaLayer.x = -Math.round(this.candidateAreaExitDistance * this.topHudExitProgress);
    this.candidateAreaLayer.alpha = 1 - this.topHudExitProgress;
  }

  private applyRefreshActionTransition(): void {
    if (!this.refreshActionLayer) return;
    this.refreshActionLayer.y = Math.round(this.refreshActionExitDistance * this.topHudExitProgress);
    this.refreshActionLayer.alpha = 1 - this.topHudExitProgress;
  }

  private applyStartActionTransition(): void {
    if (!this.startActionLayer) return;
    this.startActionLayer.x = Math.round(this.startActionExitDistance * this.topHudExitProgress);
    this.startActionLayer.alpha = 1 - this.topHudExitProgress;
  }

  private drawActions(w: number, h: number): void {
    const refreshLayout = this.layout("action_refresh", {
      scene: "bag",
      key: "action_refresh",
      anchor: "bottomLeft",
      x: 20,
      y: -58,
      width: 122,
      height: 42,
      fontSize: 16,
      visible: true,
      desc: "背包底部广告刷新按钮，必出 2 级装备",
    });
    const expandLayout = this.layout("action_expand", {
      scene: "bag",
      key: "action_expand",
      anchor: "bottomCenter",
      x: 0,
      y: -58,
      width: 122,
      height: 42,
      fontSize: 16,
      visible: true,
      desc: "背包底部金币刷新按钮",
    });
    const startLayout = this.layout("action_start", {
      scene: "bag",
      key: "action_start",
      anchor: "bottomRight",
      x: -142,
      y: -61,
      width: 122,
      height: 48,
      fontSize: 16,
      visible: true,
      desc: "背包底部开始战斗按钮",
    });
    const scaledRefreshLayout = scaleUiLayoutSize(refreshLayout);
    const scaledExpandLayout = scaleUiLayoutSize(expandLayout);
    const scaledStartLayout = scaleUiLayoutSize(startLayout);
    const refresh = uiButton("bag_ad_refresh_button", "", scaledRefreshLayout.width, scaledRefreshLayout.height, 0x28c9b0, () => void this.refreshCandidatesByAdQuality2(), scaledRefreshLayout.fontSize ?? 16);
    const expand = uiButton("bag_gold_refresh_button", "", scaledExpandLayout.width, scaledExpandLayout.height, 0x33bfff, () => this.refreshCandidatesByGold(), scaledExpandLayout.fontSize ?? 16, 0.95);
    const start = uiButton("bag_start_wave_button", "", scaledStartLayout.width, scaledStartLayout.height, 0xffb33d, () => this.tryStartBattle(), scaledStartLayout.fontSize ?? 16, 0.95);
    const refreshPos = resolveUiLayoutPosition(scaledRefreshLayout, w, h);
    const expandRect = resolveUiLayoutRect(scaledExpandLayout, w, h);
    const startRect = resolveUiLayoutRect(scaledStartLayout, w, h);
    refresh.position.set(refreshPos.x, refreshPos.y);
    expand.position.set(expandRect.x, expandRect.y);
    start.position.set(startRect.x, startRect.y);
    const refreshActions = new Container();
    if (refreshLayout.visible) refreshActions.addChild(refresh);
    if (expandLayout.visible) refreshActions.addChild(expand);
    if (refreshActions.children.length > 0) {
      this.refreshActionLayer = refreshActions;
      const minActionTop = Math.min(
        refreshLayout.visible ? refreshPos.y : h,
        expandLayout.visible ? expandRect.y : h,
      );
      this.refreshActionExitDistance = Math.max(80, h - minActionTop + 24);
      this.applyRefreshActionTransition();
      this.container.addChild(refreshActions);
    }
    if (startLayout.visible) {
      const startActions = new Container();
      startActions.addChild(start);
      this.startActionLayer = startActions;
      this.startActionExitDistance = Math.max(120, w - startRect.x + 24);
      this.applyStartActionTransition();
      this.container.addChild(startActions);
    }
  }

  private startDrag(itemId: number, source: DragSource, x: number, y: number): void {
    const item = data.getItem(itemId);
    const shape = data.getShape(item.shapeId);
    const previousCandidates = this.captureCandidatePositions();
    this.sourceRemovedForDrag = false;
    this.dragRestorePlaced = undefined;
    this.dragRestoreCandidateIndex = -1;
    if (source.type === "candidate") {
      this.dragRestoreCandidateIndex = source.index;
      this.state.candidates.splice(source.index, 1);
      this.sourceRemovedForDrag = true;
      this.animateCandidatesFrom(previousCandidates);
      this.draw();
    } else {
      const placed = this.state.placed.find((entry) => entry.uid === source.uid);
      if (placed) {
        this.dragRestorePlaced = { ...placed };
        this.state.placed = this.state.placed.filter((entry) => entry.uid !== source.uid);
        this.sourceRemovedForDrag = true;
        this.draw();
      }
    }

    const view = createItemShapeView(item, shape, data.getQuality(item.quality), this.cellSize, this.cellGap);
    view.alpha = 0.88;
    this.dragOffset = this.dragVisualCenterOffset(shape);
    view.position.set(x - this.dragOffset.x, y - this.dragOffset.y);
    view.scale.set(0.9);
    this.dragView = view;
    this.hintLayer = new Container();
    this.draggingItemId = itemId;
    this.draggingSource = source;
    this.container.addChild(this.hintLayer, view);
    this.updateDragHint(x, y);

    const move = (event: PointerEvent) => {
      const p = screenPoint(event);
      view.position.set(p.x - this.dragOffset.x, p.y - this.dragOffset.y);
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
    const shouldToastInvalid = shouldToastInvalidDrop(x, y, this.gridRect(), this.candidateRects());
    this.dragView?.destroy({ children: true } as DestroyOptions);
    this.hintLayer?.destroy({ children: true } as DestroyOptions);
    this.dragView = undefined;
    this.hintLayer = undefined;

    const previousCandidates = this.captureCandidatePositions();

    if (result.kind === "mergePlaced") {
      this.mergeIntoPlaced(result.targetUid);
    } else if (result.kind === "mergeCandidate") {
      this.mergeIntoCandidate(result.targetIndex);
    } else if (result.kind === "place") {
      this.removeDragSource();
      this.state.placed.push({ uid: nextUid(), itemId: this.draggingItemId, x: result.x, y: result.y, cdLeft: 0 });
      audio.playSfxEvent("bag_place");
      this.toast = "放置成功";
      this.toastTimer = 0.9;
    } else if (result.kind === "replace") {
      const replaced = this.state.placed.filter((placed) => result.targetUids.includes(placed.uid));
      this.state.placed = this.state.placed.filter((placed) => !result.targetUids.includes(placed.uid));
      this.removeDragSource();
      this.state.placed.push({ uid: nextUid(), itemId: this.draggingItemId, x: result.x, y: result.y, cdLeft: 0 });
      const starts = new Map<string, Point>();
      for (const placed of replaced) {
        this.appendCandidateWithStart(placed.itemId, this.placedVisualCenter(placed));
        const keys = this.candidateKeysFor();
        starts.set(keys[keys.length - 1], this.placedVisualCenter(placed));
      }
      this.animateCandidatesFrom(previousCandidates, starts);
      audio.playSfxEvent("bag_place");
      this.toast = "已替换到背包";
      this.toastTimer = 0.9;
    } else if (this.draggingSource?.type === "placed" && shouldDetachPlacedOnRelease(x, y, this.gridRect())) {
      this.toast = "";
      this.toastTimer = 0;
      this.appendCandidateWithStart(this.draggingItemId, { x, y });
      const keys = this.candidateKeysFor();
      this.animateCandidatesFrom(previousCandidates, new Map([[keys[keys.length - 1], { x, y }]]));
      audio.playSfxEvent("bag_place");
    } else if (shouldToastInvalid) {
      audio.playSfxEvent("bag_invalid");
      this.toast = "这里放不下";
      this.toastTimer = 0.9;
      this.restoreDragSourceToOrigin({ x, y });
    } else {
      this.toast = "";
      this.toastTimer = 0;
      this.restoreDragSourceToOrigin({ x, y });
    }
    this.draggingSource = undefined;
    this.sourceRemovedForDrag = false;
    this.dragRestorePlaced = undefined;
    this.dragRestoreCandidateIndex = -1;
    this.draw();
  }

  private updateDragHint(x: number, y: number): void {
    if (!this.hintLayer) return;
    this.hintLayer.removeChildren();
    const result = this.resolveDrop(x, y);
    const item = data.getItem(this.draggingItemId);
    const shape = data.getShape(item.shapeId);
    const quality = data.getQuality(item.quality);
    const label = result.kind === "mergePlaced" || result.kind === "mergeCandidate" ? "可合成" : result.kind === "replace" ? "替换" : result.kind === "place" ? "可放置" : "不可放置";
    const tint = result.kind === "mergePlaced" || result.kind === "mergeCandidate" ? 0xb66dff : result.kind === "replace" ? 0xffc247 : result.kind === "place" ? 0x43f184 : 0xff4d5d;
    const alpha = result.kind === "invalid" ? 0.22 : 0.36;
    const mergeGuide = this.nearestMergeTarget(x, y, "guide");
    const isCapturedMerge = result.kind === "mergePlaced" || result.kind === "mergeCandidate";
    if (mergeGuide) this.drawMergeGuide(x, y, mergeGuide.target, mergeGuide.distance, isCapturedMerge);

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
        const pitch = this.cellSize + this.cellGap;
        this.addHintText(this.gridLeft + target.x * pitch + this.cellSize / 2, this.gridTop + target.y * pitch - 18, label, tint);
      }
      return;
    }

    if (result.kind === "replace") {
      for (const uid of result.targetUids) {
        const target = this.state.placed.find((placed) => placed.uid === uid);
        if (!target) continue;
        const targetItem = data.getItem(target.itemId);
        this.drawShapeHint(target.x, target.y, data.getShape(targetItem.shapeId), tint, 0.26);
      }
      this.drawShapeHint(result.x, result.y, shape, 0x43f184, 0.28);
      this.addHintText(x, y - 50, label, tint);
      return;
    }

    if (result.kind === "invalid" && !shouldShowInvalidDropHint(x, y, this.gridRect(), this.candidateRects())) {
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
      const pitch = this.cellSize + this.cellGap;
      g.roundRect(this.gridLeft + (x + dx) * pitch, this.gridTop + (y + dy) * pitch, this.cellSize, this.cellSize, 8);
      g.fill({ color: tint, alpha });
      g.stroke({ color: tint, width: 4, alpha: 0.92 });
      this.hintLayer.addChild(g);
    }
  }

  private mergedFarmPlots(): { plots: FarmPlot[]; skipCells: Set<string> } {
    const plots: FarmPlot[] = [];
    const skipCells = new Set<string>();
    for (const placed of this.state.placed) {
      const item = data.getItem(placed.itemId);
      const shape = data.getShape(item.shapeId);
      const farmPlot = this.farmPlotForShape(shape);
      if (!farmPlot) continue;
      if (placed.x < 0 || placed.y < 0 || placed.x + farmPlot.widthCells > this.state.cols || placed.y + farmPlot.heightCells > this.state.rows) continue;
      plots.push({ ...farmPlot, x: placed.x, y: placed.y });
      for (const [dx, dy] of farmPlot.cells) {
        skipCells.add(this.gridCellKey(placed.x + dx, placed.y + dy));
      }
    }
    return { plots, skipCells };
  }

  private farmPlotForShape(shape: ItemShapeDef): Omit<FarmPlot, "x" | "y"> | undefined {
    const shapeKey = this.shapeCellKey(shape);
    if (shapeKey === "0,0|0,1") {
      return { assetKey: "bag_farm_cell_1x2", widthCells: 1, heightCells: 2, cells: shape.cells };
    }
    if (shapeKey === "0,0|1,0") {
      return { assetKey: "bag_farm_cell_2x1", widthCells: 2, heightCells: 1, cells: shape.cells };
    }
    if (shapeKey === "0,0|0,1|1,0|1,1") {
      return { assetKey: "bag_farm_cell_2x2", widthCells: 2, heightCells: 2, cells: shape.cells };
    }
    if (shapeKey === "0,0|0,1|1,1") {
      return { assetKey: "bag_farm_cell_l3", widthCells: 2, heightCells: 2, cells: shape.cells };
    }
    return undefined;
  }

  private shapeCellKey(shape: ItemShapeDef): string {
    return shape.cells.map(([x, y]) => `${x},${y}`).sort().join("|");
  }

  private gridCellKey(x: number, y: number): string {
    return `${x},${y}`;
  }

  private createMergedFarmFallback(plot: FarmPlot): Container {
    const fallback = new Container();
    const pitch = this.cellSize + this.cellGap;
    const g = new Graphics();
    for (const [dx, dy] of plot.cells) {
      g.roundRect(dx * pitch, dy * pitch, this.cellSize, this.cellSize, 8).fill({ color: 0xb47a47 });
      g.roundRect(dx * pitch, dy * pitch, this.cellSize, this.cellSize, 8).stroke({ color: 0x2d241d, width: 2, alpha: 0.75 });
    }
    fallback.addChild(g);
    return fallback;
  }

  private addHintText(x: number, y: number, label: string, tint: number): void {
    if (!this.hintLayer) return;
    if (!shouldShowBagTextFeedback()) return;
    const t = text(label, 15, "#ffffff", "700");
    t.anchor.set(0.5);
    t.position.set(x, Math.max(106, y));
    const bg = new Graphics();
    bg.roundRect(t.x - 42, t.y - 16, 84, 30, 15).fill({ color: tint, alpha: 0.92 });
    this.hintLayer.addChild(bg, t);
  }

  private resolveDrop(x: number, y: number): DropResult {
    const mergeSnap = this.nearestMergeTarget(x, y, "capture");
    if (mergeSnap?.target.kind === "placed") {
      return { kind: "mergePlaced", targetUid: mergeSnap.target.targetUid };
    }
    if (mergeSnap?.target.kind === "candidate") {
      return { kind: "mergeCandidate", targetIndex: mergeSnap.target.targetIndex };
    }

    const candidateIndex = this.candidateIndexAt(x, y);
    if (candidateIndex >= 0) {
      const targetItemId = this.state.candidates[candidateIndex] ?? 0;
      if (targetItemId && this.canMerge(this.draggingItemId, targetItemId, this.draggingSource, { type: "candidate", index: candidateIndex })) {
        return { kind: "mergeCandidate", targetIndex: candidateIndex };
      }
      return { kind: "invalid", x: 0, y: 0 };
    }

    const pitch = this.cellSize + this.cellGap;
    const shape = data.getShape(data.getItem(this.draggingItemId).shapeId);
    const visualCenter = this.dragVisualCenterOffset(shape);
    const origin = shapeOriginFromPointer({
      pointerX: x,
      pointerY: y,
      gridLeft: this.gridLeft,
      gridTop: this.gridTop,
      pitch,
      visualCenterX: visualCenter.x,
      visualCenterY: visualCenter.y,
    });
    const gridX = origin.x;
    const gridY = origin.y;
    const target = this.findPlacedAt(gridX, gridY);
    if (target && this.canMerge(this.draggingItemId, target.itemId, this.draggingSource, { type: "placed", uid: target.uid })) {
      return { kind: "mergePlaced", targetUid: target.uid };
    }

    if (this.canPlace(this.draggingItemId, gridX, gridY, this.draggingSource?.type === "placed" ? [this.draggingSource.uid] : [])) {
      return { kind: "place", x: gridX, y: gridY };
    }
    const targetUids = this.conflictingPlacedUids(this.draggingItemId, gridX, gridY);
    if (targetUids.length > 0) {
      return { kind: "replace", x: gridX, y: gridY, targetUids };
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

  private conflictingPlacedUids(itemId: number, x: number, y: number): number[] {
    const shape = data.getShape(data.getItem(itemId).shapeId);
    const uids = new Set<number>();
    for (const [dx, dy] of shape.cells) {
      const gx = x + dx;
      const gy = y + dy;
      if (gx < 0 || gy < 0 || gx >= this.state.cols || gy >= this.state.rows) return [];
      const placed = this.findPlacedAt(gx, gy);
      if (placed) uids.add(placed.uid);
    }
    return [...uids];
  }

  private placedVisualCenter(placed: PlacedItem): Point {
    const item = data.getItem(placed.itemId);
    const shape = data.getShape(item.shapeId);
    const offset = this.dragVisualCenterOffset(shape);
    const pitch = this.cellSize + this.cellGap;
    return {
      x: this.gridLeft + placed.x * pitch + offset.x,
      y: this.gridTop + placed.y * pitch + offset.y,
    };
  }

  private candidateRect(index: number): { x: number; y: number; w: number; h: number } {
    const target = this.candidateLayoutTargets()[index];
    if (!target) return { x: 0, y: 0, w: 0, h: 0 };
    return {
      x: target.x - target.width / 2,
      y: target.y - target.height / 2,
      w: target.width,
      h: target.height,
    };
  }

  private candidateRects(): { x: number; y: number; width: number; height: number }[] {
    return this.state.candidates.map((_, index) => {
      const rect = this.candidateRect(index);
      return { x: rect.x, y: rect.y, width: rect.w, height: rect.h };
    });
  }

  private candidateKeysFor(items = this.state.candidates): string[] {
    const seen = new Map<number, number>();
    return items.map((itemId) => {
      const count = seen.get(itemId) ?? 0;
      seen.set(itemId, count + 1);
      return `${itemId}:${count}`;
    });
  }

  private captureCandidatePositions(): Map<string, Point> {
    const positions = new Map<string, Point>();
    const keys = this.candidateKeysFor();
    const targets = this.candidateLayoutTargets();
    keys.forEach((key, index) => {
      const view = this.candidateViews.get(key);
      if (view) {
        positions.set(key, { x: view.view.position.x, y: view.view.position.y });
        return;
      }
      const target = targets[index];
      if (target) positions.set(key, { x: target.x, y: target.y });
    });
    return positions;
  }

  private animateCandidatesFrom(previous: Map<string, Point>, overrides = new Map<string, Point>()): void {
    this.pendingCandidateStarts.clear();
    for (const key of this.candidateKeysFor()) {
      const start = overrides.get(key) ?? previous.get(key);
      if (start) this.pendingCandidateStarts.set(key, start);
    }
  }

  private updateCandidateMotions(dt: number): void {
    if (this.candidateMotions.length === 0) return;
    this.candidateMotions = this.candidateMotions.filter((motion) => {
      motion.elapsed = Math.min(motion.duration, motion.elapsed + dt);
      const raw = motion.duration <= 0 ? 1 : motion.elapsed / motion.duration;
      const t = 1 - Math.pow(1 - raw, 3);
      const x = motion.from.x + (motion.to.x - motion.from.x) * t;
      const y = motion.from.y + (motion.to.y - motion.from.y) * t;
      motion.view.position.set(x, y);
      if (motion.label) motion.label.position.set(x, y + motion.labelOffsetY);
      return raw < 1;
    });
  }

  private appendCandidateWithStart(itemId: number, _start: Point): void {
    this.state.candidates.push(itemId);
  }

  private restoreDragSourceToOrigin(point: Point): void {
    if (!this.sourceRemovedForDrag) return;
    const previous = this.captureCandidatePositions();
    if (this.draggingSource?.type === "candidate") {
      const index = Math.max(0, Math.min(this.dragRestoreCandidateIndex, this.state.candidates.length));
      this.state.candidates.splice(index, 0, this.draggingItemId);
      const key = this.candidateKeysFor()[index];
      this.animateCandidatesFrom(previous, new Map([[key, point]]));
      return;
    }
    if (this.dragRestorePlaced) {
      this.state.placed.push(this.dragRestorePlaced);
    }
  }

  private dragVisualCenterOffset(shape: { cells: [number, number][] }, cellSize = this.cellSize): Point {
    const pitch = cellSize + this.cellGap;
    const maxX = Math.max(...shape.cells.map(([x]) => x));
    const maxY = Math.max(...shape.cells.map(([, y]) => y));
    return {
      x: (maxX + 1) * pitch / 2 - this.cellGap / 2,
      y: (maxY + 1) * pitch / 2 - this.cellGap / 2 - 25,
    };
  }

  private itemShapePixelSize(itemId: number, cellSize = this.cellSize): { width: number; height: number } {
    const shape = data.getShape(data.getItem(itemId).shapeId);
    const maxX = Math.max(...shape.cells.map(([x]) => x));
    const maxY = Math.max(...shape.cells.map(([, y]) => y));
    return {
      width: (maxX + 1) * cellSize + maxX * this.cellGap,
      height: (maxY + 1) * cellSize + maxY * this.cellGap,
    };
  }

  private candidateLayoutTargets(layout?: ReturnType<BagScene["layout"]>): CandidateLayoutTarget[] {
    const resolvedLayout =
      layout ??
      this.layout("candidates", {
        scene: "bag",
        key: "candidates",
        anchor: "bottomCenter",
        x: 0,
        y: -405,
        width: 120,
        height: 120,
        gap: 24,
        fontSize: 16,
        visible: true,
        desc: "背包备战区，width/height 为单格尺寸，武器按自身占格大小显示",
      });
    const sizes = this.state.candidates.map((itemId) => this.itemShapePixelSize(itemId, this.cellSize));
    if (sizes.length === 0) return [];

    const cartLayout = scaleUiLayoutSize(this.layout("candidate_cart", {
      scene: "bag",
      key: "candidate_cart",
      anchor: "bottomCenter",
      x: 0,
      y: -505,
      width: 720,
      height: 238,
      scale: 0.68,
      visible: true,
      desc: "Candidate cart background for the three pre-battle item slots",
    }));
    const areaRect = cartLayout.visible
      ? resolveUiLayoutRect(cartLayout, app.screen.width, app.screen.height)
      : resolveUiLayoutRect(resolvedLayout, app.screen.width, app.screen.height);
    const gridLayout = scaleUiLayoutSize(this.layout("candidate_grid", {
      scene: "bag",
      key: "candidate_grid",
      anchor: "center",
      x: 0,
      y: 0,
      width: 120,
      height: 120,
      gap: 180,
      rowGap: 120,
      scale: 1,
      visible: true,
      desc: "Candidate item grid spacing relative to the cart center",
    }));
    const visualSlotCount = this.candidateVisualSlotCount();
    const slotWidth = gridLayout.width || resolvedLayout.width;
    const slotHeight = gridLayout.height || resolvedLayout.height;

    return sizes.map((size, index) => {
      const slot = this.candidateGridSlot(this.candidateVisualSlotIndex(index), visualSlotCount, areaRect, gridLayout);
      return {
        x: slot.x,
        y: slot.y,
        width: slotWidth,
        height: slotHeight,
        labelOffsetY: slotHeight / 2 + 12,
      };
    });
  }

  private candidateVisualSlotCount(): number {
    return Math.min(8, this.state.candidates.length + (this.sourceRemovedForDrag && this.dragRestoreCandidateIndex >= 0 ? 1 : 0));
  }

  private candidateVisualSlotIndex(index: number): number {
    if (this.sourceRemovedForDrag && this.dragRestoreCandidateIndex >= 0 && index >= this.dragRestoreCandidateIndex) {
      return Math.min(index + 1, 7);
    }
    return Math.min(index, 7);
  }

  private candidateGridSlot(
    slotIndex: number,
    visualSlotCount: number,
    areaRect: { x: number; y: number; width: number; height: number },
    gridLayout: ReturnType<BagScene["layout"]>,
  ): Point {
    const clampedIndex = Math.max(0, Math.min(7, slotIndex));
    const row = Math.floor(clampedIndex / 4);
    const indexInRow = clampedIndex % 4;
    const firstRowCount = Math.min(4, visualSlotCount);
    const secondRowCount = Math.max(0, Math.min(4, visualSlotCount - 4));
    const rowCount = row === 0 ? firstRowCount : Math.max(1, secondRowCount);
    const col = Math.min(indexInRow, rowCount - 1);
    const rows = visualSlotCount > 4 ? 2 : 1;
    const centerX = areaRect.x + areaRect.width / 2 + gridLayout.x;
    const centerY = areaRect.y + areaRect.height / 2 + gridLayout.y;
    const colGap = gridLayout.gap ?? 180;
    const rowGap = gridLayout.rowGap ?? 120;
    return {
      x: Math.round(centerX + (col - (rowCount - 1) / 2) * colGap),
      y: Math.round(centerY + (rows === 1 ? 0 : (row - 0.5) * rowGap)),
    };
  }

  private splitCandidateRows(sizes: Array<{ width: number; height: number }>, maxWidth: number, baseGap: number): number[][] {
    const oneRowWidth = sizes.reduce((sum, size) => sum + size.width, 0) + baseGap * Math.max(0, sizes.length - 1);
    if (oneRowWidth <= maxWidth || sizes.length <= 3) {
      return [sizes.map((_, index) => index)];
    }
    const split = Math.ceil(sizes.length / 2);
    return [sizes.slice(0, split).map((_, index) => index), sizes.slice(split).map((_, index) => index + split)];
  }

  private compressedGap(sizes: Array<{ width: number; height: number }>, maxWidth: number, baseGap: number): number {
    if (sizes.length <= 1) return 0;
    const totalItemWidth = sizes.reduce((sum, size) => sum + size.width, 0);
    const naturalWidth = totalItemWidth + baseGap * (sizes.length - 1);
    if (naturalWidth <= maxWidth) return baseGap;
    return Math.max(-this.cellSize * 0.52, Math.floor((maxWidth - totalItemWidth) / (sizes.length - 1)));
  }

  private gridRect(): { x: number; y: number; width: number; height: number } {
    return {
      x: this.gridLeft,
      y: this.gridTop,
      width: this.state.cols * this.cellSize + Math.max(0, this.state.cols - 1) * this.cellGap,
      height: this.state.rows * this.cellSize + Math.max(0, this.state.rows - 1) * this.cellGap,
    };
  }

  private candidateIndexAt(x: number, y: number): number {
    return this.state.candidates.findIndex((_, index) => {
      const rect = this.candidateRect(index);
      return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
    });
  }

  private layout(key: string, defaults: Parameters<typeof getUiLayout>[3]) {
    return getUiLayout(data, "bag", key, defaults);
  }

  private canMerge(
    sourceItemId: number,
    targetItemId: number,
    source: DragSource | undefined,
    target: DragSource,
  ): boolean {
    if (!source || isSameDragSource(source, target, this.sourceRemovedForDrag)) return false;
    const sourceItem = data.getItem(sourceItemId);
    const targetItem = data.getItem(targetItemId);
    return sourceItem.baseId === targetItem.baseId && sourceItem.quality === targetItem.quality && Boolean(sourceItem.mergeToId);
  }

  private mergeDragTargets(): MergeDragTarget[] {
    const targets: MergeDragTarget[] = [];
    for (const placed of this.state.placed) {
      if (!this.canMerge(this.draggingItemId, placed.itemId, this.draggingSource, { type: "placed", uid: placed.uid })) continue;
      const center = this.placedVisualCenter(placed);
      const size = this.itemShapePixelSize(placed.itemId);
      targets.push({
        key: `placed:${placed.uid}`,
        kind: "placed",
        centerX: center.x,
        centerY: center.y,
        captureRadius: this.mergeCaptureRadius(size.width, size.height),
        targetUid: placed.uid,
      });
    }

    const candidateTargets = this.candidateLayoutTargets();
    this.state.candidates.forEach((itemId, index) => {
      if (!this.canMerge(this.draggingItemId, itemId, this.draggingSource, { type: "candidate", index })) return;
      const target = candidateTargets[index];
      if (!target) return;
      targets.push({
        key: `candidate:${index}`,
        kind: "candidate",
        centerX: target.x,
        centerY: target.y,
        captureRadius: this.mergeCaptureRadius(target.width, target.height),
        targetIndex: index,
      });
    });
    return targets;
  }

  private nearestMergeTarget(x: number, y: number, mode: "guide" | "capture") {
    const targets = this.mergeDragTargets();
    const eligible = mode === "capture"
      ? targets.filter((target) => Math.hypot(x - target.centerX, y - target.centerY) <= target.captureRadius)
      : targets;
    return mode === "guide"
      ? findNearestDragTarget(x, y, eligible)
      : findNearestDragTarget(x, y, eligible, Number.POSITIVE_INFINITY);
  }

  private mergeCaptureRadius(width: number, height: number): number {
    return Math.min(176, Math.max(108, Math.hypot(width, height) * 0.48 + 38));
  }

  private drawMergeGuide(x: number, y: number, target: MergeDragTarget, distance: number, captured: boolean): void {
    if (!this.hintLayer) return;
    const strength = Math.max(0.35, 1 - distance / 360);
    const line = new Graphics();
    line.moveTo(x, y).lineTo(target.centerX, target.centerY).stroke({ color: 0x42bfff, width: 15, alpha: 0.18 + strength * 0.14 });
    line.moveTo(x, y).lineTo(target.centerX, target.centerY).stroke({ color: 0xcaf5ff, width: 4, alpha: 0.76 + strength * 0.22 });
    line.circle(target.centerX, target.centerY, 17 + strength * 7).fill({ color: 0x78d8ff, alpha: 0.25 });
    line.circle(target.centerX, target.centerY, 17 + strength * 7).stroke({ color: 0xe1faff, width: 4, alpha: 0.96 });
    this.hintLayer.addChild(line);
    if (captured) return;

    if (target.kind === "candidate") {
      const rect = this.candidateRect(target.targetIndex);
      const outline = new Graphics();
      outline.roundRect(rect.x - 7, rect.y - 7, rect.w + 14, rect.h + 14, 16).fill({ color: 0x42bfff, alpha: 0.18 });
      outline.stroke({ color: 0xb9efff, width: 5, alpha: 0.94 });
      this.hintLayer.addChild(outline);
      this.addHintText(rect.x + rect.w / 2, rect.y - 20, "可合成", 0x42bfff);
      return;
    }

    const placed = this.state.placed.find((entry) => entry.uid === target.targetUid);
    if (!placed) return;
    const targetShape = data.getShape(data.getItem(placed.itemId).shapeId);
    this.drawShapeHint(placed.x, placed.y, targetShape, 0x42bfff, 0.24);
    const pitch = this.cellSize + this.cellGap;
    this.addHintText(target.centerX, this.gridTop + placed.y * pitch - 20, "可合成", 0x42bfff);
  }

  private removeDragSource(): void {
    if (!this.draggingSource) return;
    if (this.sourceRemovedForDrag) return;
    if (this.draggingSource.type === "candidate") {
      this.state.candidates.splice(this.draggingSource.index, 1);
      return;
    }
    const sourceUid = this.draggingSource.uid;
    this.state.placed = this.state.placed.filter((placed) => placed.uid !== sourceUid);
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
      this.state.placed.push({ uid: nextUid(), itemId: sourceItem.mergeToId, x, y, cdLeft: 0 });
    } else {
      this.state.candidates.push(sourceItem.mergeToId);
    }
    this.toast = `合成 ${data.getItem(sourceItem.mergeToId).name}`;
    audio.playSfxEvent("bag_merge");
    this.toastTimer = 1.2;
  }

  private mergeIntoCandidate(targetIndex: number): void {
    const sourceItem = data.getItem(this.draggingItemId);
    if (!sourceItem.mergeToId) return;
    this.removeDragSource();
    this.state.candidates[targetIndex] = sourceItem.mergeToId;
    this.toast = `合成 ${data.getItem(sourceItem.mergeToId).name}`;
    audio.playSfxEvent("bag_merge");
    this.toastTimer = 1.2;
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
          this.state.placed.push({ uid: nextUid(), itemId: firstItem.mergeToId, x: a.x, y: a.y, cdLeft: 0 });
        } else {
          this.state.candidates.push(firstItem.mergeToId);
        }
        this.toast = `合成 ${data.getItem(firstItem.mergeToId).name}`;
        audio.playSfxEvent("bag_merge");
        this.toastTimer = 1.2;
        changed = true;
        break;
      }
    }
  }

  private async refreshCandidatesByAdQuality2(): Promise<void> {
    const result = await ads.showRewardedAd(data.getEconomyAdPlacement("bag_refresh_quality2_ad") || "bag_refresh_quality2");
    if (!result.ok) {
      this.toast = result.message;
      this.toastTimer = 1;
      this.draw();
      return;
    }
    this.state.candidates = [this.rollItem(2), this.rollItem(2), this.rollItem(2)];
    audio.playSfxEvent("bag_refresh");
    this.toast = "广告刷新：已出现 2 级装备";
    this.toastTimer = 0.9;
    this.draw();
  }

  private refreshCandidatesByGold(): void {
    const cost = data.getEconomy("bag_refresh_gold_cost");
    if (this.state.gold < cost) {
      this.toast = `金币不足：需要 ${cost}`;
      this.toastTimer = 1;
      this.draw();
      return;
    }
    this.state.gold -= cost;
    this.state.candidates = [this.rollItem(), this.rollItem(), this.rollItem()];
    audio.playSfxEvent("bag_refresh");
    this.toast = "金币刷新成功";
    this.toastTimer = 0.8;
    this.draw();
  }

  private tryStartBattle(): void {
    if (this.state.placed.length === 0) {
      this.toast = "至少放入一件武器";
      this.toastTimer = 1;
      this.draw();
      return;
    }
    if (this.onStartBattle) {
      this.onStartBattle();
      return;
    }
    showBattle(this.level, this.state);
  }
}
