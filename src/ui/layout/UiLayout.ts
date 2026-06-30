import type { UiLayoutAnchor, UiLayoutDef } from "../../types.js";

export type { UiLayoutDef };

export interface UiLayoutReader {
  getUiLayout(scene: string, key: string): UiLayoutDef | undefined;
}

export function resolveUiLayoutPosition(layout: UiLayoutDef, screenWidth: number, screenHeight: number): { x: number; y: number } {
  const base = anchorBase(layout.anchor, screenWidth, screenHeight);
  return {
    x: Math.round(base.x + layout.x),
    y: Math.round(base.y + layout.y),
  };
}

export function withLayoutDefaults(layout: UiLayoutDef | undefined, defaults: UiLayoutDef): UiLayoutDef {
  return {
    ...defaults,
    ...layout,
  };
}

export function getUiLayout(data: UiLayoutReader, scene: string, key: string, defaults: UiLayoutDef): UiLayoutDef {
  return withLayoutDefaults(data.getUiLayout(scene, key), defaults);
}

export function resolveUiLayoutRect(layout: UiLayoutDef, screenWidth: number, screenHeight: number): { x: number; y: number; width: number; height: number } {
  const position = resolveUiLayoutPosition(layout, screenWidth, screenHeight);
  const centered =
    layout.anchor === "center" ||
    layout.anchor === "topCenter" ||
    layout.anchor === "bottomCenter" ||
    layout.anchor === "centerLeft" ||
    layout.anchor === "centerRight";
  return {
    x: centered ? Math.round(position.x - layout.width / 2) : position.x,
    y: layout.anchor === "center" || layout.anchor === "centerLeft" || layout.anchor === "centerRight" ? Math.round(position.y - layout.height / 2) : position.y,
    width: layout.width,
    height: layout.height,
  };
}

export function scaleUiLayoutSize(layout: UiLayoutDef): UiLayoutDef {
  const scale = layout.scale ?? 1;
  if (scale === 1) return layout;
  return {
    ...layout,
    width: Math.round(layout.width * scale),
    height: Math.round(layout.height * scale),
    iconSize: layout.iconSize === undefined ? undefined : Math.round(layout.iconSize * scale),
    fontSize: layout.fontSize === undefined ? undefined : Math.round(layout.fontSize * scale),
    strokeWidth: layout.strokeWidth === undefined ? undefined : Math.round(layout.strokeWidth * scale),
    barOffsetX: layout.barOffsetX === undefined ? undefined : Math.round(layout.barOffsetX * scale),
    barOffsetY: layout.barOffsetY === undefined ? undefined : Math.round(layout.barOffsetY * scale),
    barWidth: layout.barWidth === undefined ? undefined : Math.round(layout.barWidth * scale),
    barHeight: layout.barHeight === undefined ? undefined : Math.round(layout.barHeight * scale),
    textOffsetX: layout.textOffsetX === undefined ? undefined : Math.round(layout.textOffsetX * scale),
    textOffsetY: layout.textOffsetY === undefined ? undefined : Math.round(layout.textOffsetY * scale),
    gap: layout.gap === undefined ? undefined : Math.round(layout.gap * scale),
    rowGap: layout.rowGap === undefined ? undefined : Math.round(layout.rowGap * scale),
  };
}

function anchorBase(anchor: UiLayoutAnchor, screenWidth: number, screenHeight: number): { x: number; y: number } {
  switch (anchor) {
    case "topLeft":
      return { x: 0, y: 0 };
    case "topCenter":
      return { x: screenWidth / 2, y: 0 };
    case "topRight":
      return { x: screenWidth, y: 0 };
    case "centerLeft":
      return { x: 0, y: screenHeight / 2 };
    case "center":
      return { x: screenWidth / 2, y: screenHeight / 2 };
    case "centerRight":
      return { x: screenWidth, y: screenHeight / 2 };
    case "bottomLeft":
      return { x: 0, y: screenHeight };
    case "bottomCenter":
      return { x: screenWidth / 2, y: screenHeight };
    case "bottomRight":
      return { x: screenWidth, y: screenHeight };
  }
  return { x: 0, y: 0 };
}
