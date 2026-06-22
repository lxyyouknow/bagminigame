import type { DragSource } from "../types.js";

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ShapeOriginInput {
  pointerX: number;
  pointerY: number;
  gridLeft: number;
  gridTop: number;
  pitch: number;
  visualCenterX: number;
  visualCenterY: number;
}

export interface DragTarget {
  key: string;
  centerX: number;
  centerY: number;
}

export interface NearestDragTarget<T extends DragTarget> {
  target: T;
  distance: number;
}

function isPointInRect(x: number, y: number, rect: Rect): boolean {
  return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
}

export function shouldShowInvalidDropHint(x: number, y: number, gridRect: Rect, candidateRects: Rect[]): boolean {
  void candidateRects;
  if (isPointInRect(x, y, gridRect)) return true;
  return false;
}

export function shouldToastInvalidDrop(x: number, y: number, gridRect: Rect, candidateRects: Rect[]): boolean {
  return shouldShowInvalidDropHint(x, y, gridRect, candidateRects);
}

export function shouldDetachPlacedOnRelease(x: number, y: number, gridRect: Rect): boolean {
  return !isPointInRect(x, y, gridRect);
}

export function shapeOriginFromPointer(input: ShapeOriginInput): { x: number; y: number } {
  return {
    x: Math.round((input.pointerX - input.visualCenterX - input.gridLeft) / input.pitch),
    y: Math.round((input.pointerY - input.visualCenterY - input.gridTop) / input.pitch),
  };
}

export function findNearestDragTarget<T extends DragTarget>(
  pointerX: number,
  pointerY: number,
  targets: T[],
  maxDistance = Number.POSITIVE_INFINITY,
): NearestDragTarget<T> | undefined {
  let nearest: NearestDragTarget<T> | undefined;
  for (const target of targets) {
    const distance = Math.hypot(pointerX - target.centerX, pointerY - target.centerY);
    if (distance > maxDistance || (nearest && distance >= nearest.distance)) continue;
    nearest = { target, distance };
  }
  return nearest;
}

export function isSameDragSource(source: DragSource, target: DragSource, sourceRemoved: boolean): boolean {
  if (sourceRemoved || source.type !== target.type) return false;
  if (source.type === "placed" && target.type === "placed") return source.uid === target.uid;
  if (source.type === "candidate" && target.type === "candidate") return source.index === target.index;
  return false;
}
