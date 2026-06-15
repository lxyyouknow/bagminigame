import { Container, Graphics, type DestroyOptions } from "pixi.js";
import type { BagState, DragSource, DropResult, LevelDef, PlacedItem } from "../types";
import { ads, app, audio, data, nextUid } from "../core/runtime";
import { showBattle } from "../core/navigation";
import { createItemShapeView, createWeaponIcon, drawGradientBg, screenPoint, text, button, weightedPick, color } from "../utils/display";
import { BaseScene } from "./BaseScene";

export class BagScene extends BaseScene {
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
      this.state.placed.push({ uid: nextUid(), itemId: this.draggingItemId, x: result.x, y: result.y, cdLeft: 0 });
      audio.playSfxEvent("bag_place");
      this.toast = "放置成功";
      this.toastTimer = 0.9;
    } else {
      audio.playSfxEvent("bag_invalid");
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
      this.state.placed.push({ uid: nextUid(), itemId: sourceItem.mergeToId, x, y, cdLeft: 0 });
    } else {
      this.state.candidates[this.firstEmptyCandidateIndex()] = sourceItem.mergeToId;
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
          this.state.placed.push({ uid: nextUid(), itemId: firstItem.mergeToId, x: a.x, y: a.y, cdLeft: 0 });
        } else {
          this.state.candidates[0] = firstItem.mergeToId;
        }
        this.toast = `合成 ${data.getItem(firstItem.mergeToId).name}`;
        audio.playSfxEvent("bag_merge");
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
    audio.playSfxEvent("bag_refresh");
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
    audio.playSfxEvent("bag_expand");
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
    showBattle(this.level, this.state);
  }
}
