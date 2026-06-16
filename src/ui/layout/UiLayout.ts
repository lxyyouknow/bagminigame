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
