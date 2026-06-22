import { Container, Graphics, Rectangle, type DestroyOptions } from "pixi.js";
import type { BagState, DragSource, DropResult, ItemShapeDef, LevelDef, PlacedItem } from "../types";
import { ads, app, audio, data, nextUid } from "../core/runtime";
import { showBattle } from "../core/navigation";
import { addImageOrFallback, createItemShapeView, drawGrassBg, screenPoint, text, button, weightedPick, color, spriteFromAsset } from "../utils/display";
import { getUiLayout, resolveUiLayoutPosition, resolveUiLayoutRect } from "../ui/layout/UiLayout";
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

  constructor(
    private readonly level: LevelDef,
    initialState?: BagState,
    entryToast?: string,
    private readonly onStartBattle?: () => void,
    runSession?: RunSessionState,
  ) {
    super();
    this.runSession = runSession;
    this.state = initialState ?? {
      rows: level.initRows,
      cols: level.initCols,
      gold: level.initGold,
      refreshFree: data.getEconomy("bag_refresh_free_count"),
      candidates: [this.rollItem(), this.rollItem(), this.rollItem()],
      placed: [],
      currentWave: 1,
      baseHp: level.baseHp,
    };
    this.state.currentWave ??= 1;
    this.state.baseHp ??= level.baseHp;
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

  override update(dt: number): void {
    this.updateCandidateMotions(dt);
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
    this.container.removeChildren();
    drawGrassBg(this.container);
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

    const titleLayout = this.layout("title", {
      scene: "bag",
      key: "title",
      anchor: "topCenter",
      x: 0,
      y: 38,
      width: 320,
      height: 34,
      fontSize: 24,
      visible: true,
      desc: "背包界面关卡标题",
    });
    const title = text(this.level.name, titleLayout.fontSize ?? 24, "#ffffff", "700");
    title.anchor.set(0.5);
    const titlePos = resolveUiLayoutPosition(titleLayout, w, h);
    title.position.set(titlePos.x, titlePos.y);
    const goldLayout = this.layout("gold", {
      scene: "bag",
      key: "gold",
      anchor: "topLeft",
      x: 24,
      y: 78,
      width: 150,
      height: 28,
      fontSize: 18,
      visible: true,
      desc: "背包界面金币文本",
    });
    const gold = text(`金币 ${this.state.gold}`, goldLayout.fontSize ?? 18, "#ffe67b", "700");
    gold.anchor.set(0, 0.5);
    const goldPos = resolveUiLayoutPosition(goldLayout, w, h);
    gold.position.set(goldPos.x, goldPos.y);
    const sizeLayout = this.layout("bag_size", {
      scene: "bag",
      key: "bag_size",
      anchor: "topRight",
      x: -24,
      y: 78,
      width: 150,
      height: 28,
      fontSize: 16,
      visible: true,
      desc: "背包行列文本",
    });
    const hp = text(`背包 ${this.state.rows}x${this.state.cols}`, sizeLayout.fontSize ?? 16, "#ffffff", "700");
    hp.anchor.set(1, 0.5);
    const sizePos = resolveUiLayoutPosition(sizeLayout, w, h);
    hp.position.set(sizePos.x, sizePos.y);
    const expLayout = this.layout("exp_bar", {
      scene: "bag",
      key: "exp_bar",
      anchor: "topCenter",
      x: 0,
      y: 58,
      width: 300,
      height: 16,
      fontSize: 14,
      visible: true,
      desc: "背包局内经验条",
    });
    const expRect = resolveUiLayoutRect(expLayout, w, h);
    const levelNo = this.runSession?.levelNo ?? 1;
    const exp = this.runSession?.exp ?? 0;
    const expNeed = data.getEconomy("exp_need_base") + levelNo * 18;
    const expRate = Math.max(0, Math.min(1, exp / Math.max(1, expNeed)));
    const expBar = new Graphics();
    expBar.roundRect(expRect.x, expRect.y, expRect.width, expRect.height, 8).fill({ color: 0x1a2428, alpha: 0.9 });
    expBar.roundRect(expRect.x + 2, expRect.y + 2, Math.max(0, (expRect.width - 4) * expRate), expRect.height - 4, 6).fill({ color: 0x39e58a });
    expBar.stroke({ color: 0xffffff, width: 1, alpha: 0.5 });
    const levelBadge = new Graphics();
    levelBadge.circle(expRect.x + expRect.width + 18, expRect.y + expRect.height / 2, 18).fill({ color: 0x7c4f27 }).stroke({ color: 0xffd36a, width: 3 });
    const levelText = text(String(levelNo), expLayout.fontSize ?? 14, "#ffffff", "700");
    levelText.anchor.set(0.5);
    levelText.position.set(expRect.x + expRect.width + 18, expRect.y + expRect.height / 2);

    const waveLayout = this.layout("wave", {
      scene: "bag",
      key: "wave",
      anchor: "topCenter",
      x: 0,
      y: 94,
      width: 180,
      height: 26,
      fontSize: 18,
      visible: true,
      desc: "背包局内波次文本",
    });
    const wavePos = resolveUiLayoutPosition(waveLayout, w, h);
    const waveText = text(`波次 ${this.runSession?.currentWave ?? this.state.currentWave ?? 1}/${this.level.winWave}`, waveLayout.fontSize ?? 18, "#ffffff", "700");
    waveText.anchor.set(0.5);
    waveText.position.set(wavePos.x, wavePos.y);

    const hpLayout = this.layout("hp", {
      scene: "bag",
      key: "hp",
      anchor: "topRight",
      x: -24,
      y: 94,
      width: 130,
      height: 28,
      fontSize: 18,
      visible: true,
      desc: "背包局内基地血量",
    });
    const hpPos = resolveUiLayoutPosition(hpLayout, w, h);
    const hpText = text(`♥ ${Math.round(this.runSession?.baseHp ?? this.state.baseHp ?? this.level.baseHp)}`, hpLayout.fontSize ?? 18, "#ff6b78", "700");
    hpText.anchor.set(1, 0.5);
    hpText.position.set(hpPos.x, hpPos.y);

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
      view.eventMode = "static";
      view.cursor = "grab";
      view.on("pointerdown", (event) => {
        event.stopPropagation();
        this.startDrag(placed.itemId, { type: "placed", uid: placed.uid }, event.global.x, event.global.y);
      });
      this.container.addChild(view);
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
    const hint = text("拖到空格放置，拖到同武器同品质上合成", hintLayout.fontSize ?? 14, "#244b3a", "700");
    hint.anchor.set(0.5);
    const hintPos = resolveUiLayoutPosition({ ...hintLayout, y: this.gridTop + boardH + hintLayout.y }, w, h);
    hint.position.set(hintPos.x, hintPos.y);
    if (hintLayout.visible) this.container.addChild(hint);

    this.drawCandidateArea();
    this.drawActions(w, h);
    if (titleLayout.visible) this.container.addChild(title);
    if (goldLayout.visible) this.container.addChild(gold);
    if (sizeLayout.visible) this.container.addChild(hp);
    if (expLayout.visible) this.container.addChild(expBar, levelBadge, levelText);
    if (waveLayout.visible) this.container.addChild(waveText);
    if (hpLayout.visible) this.container.addChild(hpText);

    if (this.toast) {
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

  private drawCandidateArea(): void {
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
      const shadow = new Graphics();
      shadow.ellipse(0, target.height * 0.42, Math.min(target.width * 0.42, 54), this.cellSize * 0.1).fill({ color: 0x163024, alpha: 0.24 });
      const icon = createItemShapeView(item, shape, data.getQuality(item.quality), this.cellSize, this.cellGap, 0.9);
      const visualOffset = this.dragVisualCenterOffset(shape, this.cellSize);
      icon.position.set(-visualOffset.x, -visualOffset.y);
      group.eventMode = "static";
      group.cursor = "grab";
      group.on("pointerdown", (event) => {
        event.stopPropagation();
        this.startDrag(itemId, { type: "candidate", index }, event.global.x, event.global.y);
      });
      const label = text(item.name, layout.fontSize ?? 12, "#ffffff", "700");
      label.anchor.set(0.5);
      label.position.set(0, target.labelOffsetY);
      group.addChild(hit, shadow, icon);
      group.position.set(target.x, target.y);

      const key = keys[index];
      const start = this.pendingCandidateStarts.get(key);
      if (start && (Math.abs(start.x - target.x) > 1 || Math.abs(start.y - target.y) > 1)) {
        group.position.set(start.x, start.y);
        label.position.set(start.x, start.y + target.labelOffsetY);
        this.candidateMotions.push({ view: group, label, from: start, to: target, labelOffsetY: target.labelOffsetY, elapsed: 0, duration: 0.18 });
      } else {
        label.position.set(target.x, target.y + target.labelOffsetY);
      }

      this.candidateViews.set(key, { view: group, label });
      this.container.addChild(group, label);
    });
    this.pendingCandidateStarts.clear();
  }

  private drawActions(w: number, h: number): void {
    const adRefreshLabel = "广告刷新\n必出2级";
    const goldRefreshLabel = `刷新\n金币 ${data.getEconomy("bag_refresh_gold_cost")}`;
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
    const refresh = button(adRefreshLabel, refreshLayout.width, refreshLayout.height, 0x28c9b0, () => void this.refreshCandidatesByAdQuality2());
    const expand = button(goldRefreshLabel, expandLayout.width, expandLayout.height, 0x32a0e6, () => this.refreshCandidatesByGold());
    const start = button(`开始第${this.runSession?.currentWave ?? this.state.currentWave ?? 1}波`, startLayout.width, startLayout.height, 0xffb33d, () => this.tryStartBattle());
    const refreshPos = resolveUiLayoutPosition(refreshLayout, w, h);
    const expandRect = resolveUiLayoutRect(expandLayout, w, h);
    const startPos = resolveUiLayoutPosition(startLayout, w, h);
    refresh.position.set(refreshPos.x, refreshPos.y);
    expand.position.set(expandRect.x, expandRect.y);
    start.position.set(startPos.x, startPos.y);
    if (refreshLayout.visible) this.container.addChild(refresh);
    if (expandLayout.visible) this.container.addChild(expand);
    if (startLayout.visible) this.container.addChild(start);
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
    const pos = resolveUiLayoutPosition(resolvedLayout, app.screen.width, app.screen.height);
    const sizes = this.state.candidates.map((itemId) => this.itemShapePixelSize(itemId, this.cellSize));
    if (sizes.length === 0) return [];

    const maxWidth = app.screen.width - 56;
    const baseGap = resolvedLayout.gap ?? 24;
    const oneRowNaturalWidth = sizes.reduce((sum, size) => sum + size.width, 0) + baseGap * Math.max(0, sizes.length - 1);
    const oneRowNaturallyFits = oneRowNaturalWidth <= maxWidth;
    const rows = this.splitCandidateRows(sizes, maxWidth, baseGap);
    const centerLines =
      rows.length === 1
        ? [pos.y + this.cellSize]
        : [pos.y + this.cellSize * 0.56, pos.y + this.cellSize * 1.64];
    const targets: CandidateLayoutTarget[] = [];
    const jitterX = [0, -18, 16, -9, 20, -24, 10, -14, 24, -6];
    const jitterY = [0, 8, -6, 10, -8, 5, -10, 12, -5, 6];

    rows.forEach((row, rowIndex) => {
      const rowSizes = row.map((index) => sizes[index]);
      const gap = this.compressedGap(rowSizes, maxWidth, baseGap);
      const rowWidth = rowSizes.reduce((sum, size) => sum + size.width, 0) + gap * Math.max(0, rowSizes.length - 1);
      const crowded = rows.length > 1 || !oneRowNaturallyFits;
      let cursorX = pos.x - rowWidth / 2 + (rowIndex === 0 && rows.length > 1 ? -18 : rows.length > 1 ? 18 : 0);
      row.forEach((candidateIndex, localIndex) => {
        const size = sizes[candidateIndex];
        const x = cursorX + size.width / 2 + (crowded ? jitterX[candidateIndex % jitterX.length] : 0);
        const y = centerLines[rowIndex] + (crowded ? jitterY[candidateIndex % jitterY.length] : 0);
        targets[candidateIndex] = {
          x,
          y,
          width: size.width,
          height: size.height,
          labelOffsetY: size.height / 2 + 24,
        };
        cursorX += size.width + gap;
      });
    });

    return targets;
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
