export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
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
