export function shouldPreserveMonsterOverlayChild<T>(child: T, overlays: readonly (T | undefined)[]): boolean {
  return overlays.some((overlay) => overlay === child);
}
