import { Container, Graphics, Rectangle, Sprite, Text, TextStyle, type DestroyOptions } from "pixi.js";
import type { ItemDef, ItemShapeDef, LevelDef, QualityDef, ThemeName } from "../types";
import { app, assetManager, audio, data } from "../core/runtime";
import { getTopResourceEntries, type TopResourceLabels } from "../ui/resourceMeta";
import { color, clamp01, weightedPick } from "./math";

export { color, clamp01, weightedPick };

export interface TextPaintOptions {
  strokeColor?: string;
  strokeWidth?: number;
}

export function text(content: string, size: number, fill = "#ffffff", weight: "400" | "700" = "400", paint: TextPaintOptions = {}): Text {
  const strokeWidth = paint.strokeWidth ?? 0;
  return new Text({
    text: content,
    style: new TextStyle({
      fill,
      stroke: strokeWidth > 0 ? { color: paint.strokeColor ?? "#000000", width: strokeWidth } : undefined,
      fontFamily: "Arial, PingFang SC, sans-serif",
      fontSize: size,
      fontWeight: weight,
      align: "center",
      lineHeight: Math.round(size * 1.25),
      wordWrap: true,
      wordWrapWidth: 360,
    }),
  });
}

export function uiAssetKey(uiKey: string, fallbackAssetKey?: string): string | undefined {
  return data.getUiSkin(uiKey)?.assetKey || fallbackAssetKey;
}

export function spriteFromUi(uiKey: string, width: number, height: number, fallbackAssetKey?: string): Sprite | undefined {
  return assetManager.sprite(uiAssetKey(uiKey, fallbackAssetKey), width, height);
}

export function spriteFromAsset(assetKey: string | undefined, width: number, height: number): Sprite | undefined {
  return assetManager.sprite(assetKey, width, height);
}

export function addImageOrFallback(parent: Container, sprite: Sprite | undefined, fallback: Container): Container {
  if (sprite) {
    parent.addChild(sprite);
    fallback.destroy({ children: true } as DestroyOptions);
    return sprite;
  }
  parent.addChild(fallback);
  return fallback;
}

export function button(label: string, width: number, height: number, bg: number, onTap: () => void): Container {
  const c = new Container();
  c.eventMode = "static";
  c.cursor = "pointer";
  const fallback = new Container();
  const g = new Graphics();
  g.roundRect(0, 0, width, height, 10).fill({ color: bg }).stroke({ color: 0xffffff, width: 2, alpha: 0.35 });
  fallback.addChild(g);
  const t = text(label, 16, "#ffffff", "700");
  t.anchor.set(0.5);
  t.position.set(width / 2, height / 2);
  addImageOrFallback(c, spriteFromUi("button_basic", width, height), fallback);
  c.addChild(t);
  c.on("pointerdown", (event) => {
    event.stopPropagation();
    audio.playSfxEvent("ui_click");
    onTap();
  });
  return c;
}

export function uiButton(uiKey: string, label: string, width: number, height: number, bg: number, onTap: () => void, fontSize = 20, pressScale?: number, triggerOnDown = false): Container {
  const c = new Container();
  c.eventMode = "static";
  c.cursor = "pointer";
  c.hitArea = new Rectangle(0, 0, width, height);
  const content = new Container();
  content.pivot.set(width / 2, height / 2);
  content.position.set(width / 2, height / 2);
  const skin = spriteFromUi(uiKey, width, height);
  if (skin) {
    content.addChild(skin);
  } else {
  const shadow = new Graphics();
  shadow.roundRect(3, 5, width, height, 12).fill({ color: 0x1a1a1a, alpha: 0.38 });
  const body = new Graphics();
  body.roundRect(0, 0, width, height, 12).fill({ color: bg });
  body.roundRect(0, 0, width, height, 12).stroke({ color: 0x24313c, width: 4, alpha: 0.85 });
  body.roundRect(6, 6, width - 12, height * 0.38, 9).fill({ color: 0xffffff, alpha: 0.22 });
    content.addChild(shadow, body);
  }
  const t = text(label, fontSize, "#ffffff", "700");
  t.anchor.set(0.5);
  t.position.set(width / 2, height / 2);
  content.addChild(t);
  c.addChild(content);
  let pressed = false;
  const downScale = pressScale ?? data.getUiSkin(uiKey)?.pressScale ?? 1;
  c.on("pointerdown", (event) => {
    event.stopPropagation();
    pressed = true;
    content.scale.set(downScale);
    audio.playSfxEvent("ui_click");
    if (triggerOnDown) {
      pressed = false;
      content.scale.set(1);
      onTap();
    }
  });
  c.on("pointerup", (event) => {
    event.stopPropagation();
    if (!pressed || triggerOnDown) return;
    pressed = false;
    content.scale.set(1);
    onTap();
  });
  c.on("pointerupoutside", () => {
    pressed = false;
    content.scale.set(1);
  });
  c.on("pointercancel", () => {
    pressed = false;
    content.scale.set(1);
  });
  return c;
}

export function glossyButton(label: string, width: number, height: number, bg: number, onTap: () => void, fontSize = 20, pressScale?: number): Container {
  const skinKey = bg === 0xffc23d || bg === 0xffb33d || bg === 0xffe05a ? "button_yellow" : bg === 0x2ebaf0 || bg === 0x33bfff ? "button_blue" : bg === 0x33d7ad || bg === 0x28c9b0 ? "button_green" : "button_white";
  return uiButton(skinKey, label, width, height, bg, onTap, fontSize, pressScale);
}

export function iconButton(label: string, bg: number, onTap: () => void): Container {
  const c = glossyButton(label, 70, 64, bg, onTap, 30);
  return c;
}

export function drawGradientBg(container: Container, theme: ThemeName): void {
  const w = app.screen.width;
  const h = app.screen.height;
  const g = new Graphics();
  const base = theme === "green" ? 0x89d66a : theme === "purple" ? 0x3b345f : 0x3c4650;
  const dark = theme === "green" ? 0x3f915b : theme === "purple" ? 0x19152e : 0x1b242c;
  g.rect(0, 0, w, h).fill({ color: dark });
  for (let i = 0; i < 18; i += 1) {
    const alpha = 0.08 + (i % 4) * 0.018;
    g.circle((i * 73) % w, (i * 131) % h, 90 + (i % 3) * 40).fill({ color: base, alpha });
  }
  container.addChildAt(g, 0);
}

export function drawAssetBg(container: Container, assetKey: string, fallbackTheme: ThemeName = "green"): void {
  const w = app.screen.width;
  const h = app.screen.height;
  const asset = data.getAsset(assetKey);
  const texture = assetManager.texture(assetKey);
  if (!texture) {
    drawGradientBg(container, fallbackTheme);
    return;
  }
  const bg = new Sprite(texture);
  const scale = Math.max(w / texture.width, h / texture.height);
  const bgW = texture.width * scale;
  const bgH = texture.height * scale;
  const alignX = asset?.bgAlignX ?? "center";
  const alignY = asset?.bgAlignY ?? "center";
  const x = alignX === "left" ? 0 : alignX === "right" ? w - bgW : (w - bgW) / 2;
  const y = alignY === "top" ? 0 : alignY === "bottom" ? h - bgH : (h - bgH) / 2;
  bg.scale.set(scale);
  bg.position.set(x + (asset?.bgOffsetX ?? 0), y + (asset?.bgOffsetY ?? 0));
  container.addChildAt(bg, 0);
}

export function drawGrassBg(container: Container, fallbackTheme: ThemeName = "green"): void {
  drawAssetBg(container, "bg_grass_cartoon", fallbackTheme);
}

export function drawMainBg(container: Container): void {
  drawGrassBg(container);
}

export function drawTopResourceBar(container: Container, labels?: TopResourceLabels): void {
  const entries = getTopResourceEntries(labels);
  entries.forEach((entry, index) => {
    const x = 24 + index * 150;
    const icon = new Container();
    const iconSprite = spriteFromUi(entry.uiKey, 38, 38);
    if (iconSprite) {
      iconSprite.anchor.set(0.5);
      iconSprite.position.set(x, 28);
      icon.addChild(iconSprite);
    } else {
      icon.addChild(new Graphics().circle(x, 28, 18).fill({ color: entry.color }).stroke({ color: 0x642b2b, width: 3 }));
    }
    const pill = new Graphics();
    pill.roundRect(x + 10, 12, 112, 30, 15).fill({ color: 0x2f2b2a, alpha: 0.9 });
    const nameText = text(entry.name, 10, "#ffd8ad", "700");
    nameText.anchor.set(0, 0.5);
    nameText.position.set(x + 26, 21);
    const valueText = text(entry.value, 18, "#ffffff", "700");
    valueText.anchor.set(1, 0.5);
    valueText.position.set(x + 112, 31);
    container.addChild(pill, icon, nameText, valueText);
  });
}

export function drawStageDiorama(level: LevelDef, scale = 1, locked = false): Container {
  const c = new Container();
  const mapKey = locked ? level.lockedMapAssetKey || level.mapAssetKey : level.mapAssetKey;
  const map = spriteFromAsset(mapKey, 320 * scale, 240 * scale);
  if (map) {
    map.anchor.set(0.5);
    c.addChild(map);
    return c;
  }
  const base = new Graphics();
  base.roundRect(-140 * scale, -64 * scale, 280 * scale, 196 * scale, 22 * scale).fill({ color: 0x262f61 });
  base.roundRect(-132 * scale, -58 * scale, 264 * scale, 126 * scale, 18 * scale).fill({ color: level.theme === "purple" ? 0x273057 : level.theme === "steel" ? 0x34414d : 0x435f74 });
  base.roundRect(-132 * scale, 64 * scale, 264 * scale, 70 * scale, 18 * scale).fill({ color: 0x151834 });
  base.stroke({ color: 0x121528, width: 4 * scale });
  c.addChild(base);

  const turret = new Graphics();
  turret.roundRect(-46 * scale, -48 * scale, 92 * scale, 76 * scale, 14 * scale).fill({ color: 0x786b51 }).stroke({ color: 0x2c261f, width: 3 * scale });
  turret.roundRect(-16 * scale, -88 * scale, 32 * scale, 52 * scale, 8 * scale).fill({ color: 0xd24e40 });
  turret.roundRect(-70 * scale, -18 * scale, 84 * scale, 20 * scale, 8 * scale).fill({ color: 0x29323a });
  c.addChild(turret);

  for (let i = 0; i < 8; i += 1) {
    const sx = (i % 4 < 2 ? -1 : 1) * (94 + (i % 2) * 28) * scale;
    const sy = (-34 + Math.floor(i / 2) * 32) * scale;
    const spike = new Graphics();
    spike.moveTo(sx, sy - 20 * scale).lineTo(sx + 18 * scale, sy + 16 * scale).lineTo(sx - 18 * scale, sy + 16 * scale).closePath();
    spike.fill({ color: 0x203a87 }).stroke({ color: 0x0e1d48, width: 3 * scale });
    c.addChild(spike);
  }

  const lock = new Graphics();
  if (locked) {
    lock.roundRect(-32 * scale, -8 * scale, 64 * scale, 52 * scale, 8 * scale).fill({ color: 0x202020, alpha: 0.8 });
    lock.circle(0, 10 * scale, 14 * scale).fill({ color: 0xdadada });
    c.addChild(lock);
  }
  return c;
}
export function createWeaponIcon(item: ItemDef, quality: QualityDef, size: number, assetKeyOverride?: string): Container {
  const c = new Container();
  const qColor = color(quality.color);
  const bg = new Graphics();
  bg.roundRect(-size / 2, -size / 2, size, size, 10).fill({ color: 0x233140, alpha: 0.95 });
  bg.stroke({ color: qColor, width: 4, alpha: 0.95 });
  c.addChild(bg);

  const art = spriteFromAsset(assetKeyOverride || item.iconAssetKey || `weapon_${item.icon}_icon`, size * 0.72, size * 0.72);
  if (art) {
    art.anchor.set(0.5);
    c.addChild(art);
    return c;
  }

  const icon = new Graphics();
  if (item.icon === "ball") {
    icon.circle(0, 0, size * 0.24).fill({ color: 0xf17a45 }).stroke({ color: 0x6d2b22, width: 3 });
    icon.moveTo(-size * 0.18, -size * 0.06).lineTo(size * 0.18, size * 0.06).stroke({ color: 0x69221e, width: 2 });
  } else if (item.icon === "bat") {
    icon.roundRect(-size * 0.3, -size * 0.08, size * 0.6, size * 0.16, 6).fill({ color: 0xa36b45 });
    icon.circle(size * 0.22, 0, size * 0.14).fill({ color: 0x69412e });
  } else if (item.icon === "spear") {
    icon.moveTo(0, -size * 0.34).lineTo(size * 0.14, -size * 0.1).lineTo(size * 0.04, -size * 0.1).lineTo(size * 0.04, size * 0.3).lineTo(-size * 0.04, size * 0.3).lineTo(-size * 0.04, -size * 0.1).lineTo(-size * 0.14, -size * 0.1).closePath();
    icon.fill({ color: 0x7fe6ff }).stroke({ color: 0x274a6c, width: 2 });
  } else if (item.icon === "shield") {
    icon.moveTo(0, -size * 0.3).lineTo(size * 0.25, -size * 0.12).lineTo(size * 0.16, size * 0.22).lineTo(0, size * 0.34).lineTo(-size * 0.16, size * 0.22).lineTo(-size * 0.25, -size * 0.12).closePath();
    icon.fill({ color: 0x75dc8a }).stroke({ color: 0x24573a, width: 3 });
  } else if (item.icon === "bomb") {
    icon.circle(0, size * 0.07, size * 0.22).fill({ color: 0x3e3e48 }).stroke({ color: 0xffd25a, width: 3 });
    icon.moveTo(size * 0.1, -size * 0.12).lineTo(size * 0.24, -size * 0.32).stroke({ color: 0xffd25a, width: 4 });
  } else {
    icon.circle(0, 0, size * 0.18).fill({ color: qColor });
    icon.roundRect(-size * 0.08, -size * 0.34, size * 0.16, size * 0.68, 4).fill({ color: 0x4b2a7d });
  }
  c.addChild(icon);
  return c;
}

export function createItemShapeView(item: ItemDef, shape: ItemShapeDef, _quality: QualityDef, cellSize: number, cellGap = 0, iconScale = 1): Container {
  const c = new Container();
  const assetKey = item.iconAssetKey || `weapon_${item.icon}_icon`;
  const xs = shape.cells.map(([x]) => x);
  const ys = shape.cells.map(([, y]) => y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const widthCells = maxX - minX + 1;
  const heightCells = maxY - minY + 1;
  const texture = assetManager.texture(assetKey);
  const textureAspect = texture ? texture.width / texture.height : 1;
  const shapeAspect = widthCells / heightCells;
  if (texture && item.bagIconMode === "single") {
    const totalW = widthCells * cellSize + (widthCells - 1) * cellGap;
    const totalH = heightCells * cellSize + (heightCells - 1) * cellGap;
    const fitScale = Math.min((totalW * 0.96 * iconScale) / texture.width, (totalH * 0.96 * iconScale) / texture.height);
    const art = spriteFromAsset(assetKey, texture.width * fitScale, texture.height * fitScale);
    if (art) {
      art.anchor.set(0.5);
      art.position.set(
        minX * (cellSize + cellGap) + totalW * 0.5,
        minY * (cellSize + cellGap) + totalH * 0.5 - 18 * iconScale,
      );
      c.addChild(art);
      return c;
    }
  }
  if (texture && widthCells > 1 && textureAspect > 1.25 && Math.abs(textureAspect - shapeAspect) < 0.35) {
    const totalW = widthCells * cellSize + (widthCells - 1) * cellGap;
    const totalH = heightCells * cellSize + (heightCells - 1) * cellGap;
    const art = spriteFromAsset(assetKey, totalW * 0.96 * iconScale, totalH * 0.96 * iconScale);
    if (art) {
      art.anchor.set(0.5);
      art.position.set(
        minX * (cellSize + cellGap) + totalW * 0.5,
        minY * (cellSize + cellGap) + totalH * 0.5 - 18 * iconScale,
      );
      c.addChild(art);
      return c;
    }
  }

  for (const [x, y] of shape.cells) {
    const iconSize = 150 * iconScale;
    const px = x * (cellSize + cellGap) + cellSize * 0.5;
    const py = y * (cellSize + cellGap) + cellSize * 0.5 - 25;
    const art = spriteFromAsset(assetKey, iconSize, iconSize);
    if (art) {
      art.anchor.set(0.5);
      art.position.set(px, py);
      c.addChild(art);
      continue;
    }

    const fallback = new Graphics();
    fallback.circle(px, py, iconSize * 0.32).fill({ color: 0x7fbf55, alpha: 0.95 });
    fallback.stroke({ color: 0x426f2a, width: 3, alpha: 0.9 });
    c.addChild(fallback);
  }
  return c;
}

export function screenPoint(event: PointerEvent): { x: number; y: number } {
  const rect = app.canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * app.screen.width,
    y: ((event.clientY - rect.top) / rect.height) * app.screen.height,
  };
}
