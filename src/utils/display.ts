import { Container, Graphics, Sprite, Text, TextStyle, type DestroyOptions } from "pixi.js";
import type { ItemDef, ItemShapeDef, LevelDef, QualityDef, ThemeName } from "../types";
import { app, assetManager, audio, data } from "../core/runtime";
import { getTopResourceEntries, type TopResourceLabels } from "../ui/resourceMeta";
import { color, clamp01, weightedPick } from "./math";

export { color, clamp01, weightedPick };

export function text(content: string, size: number, fill = "#ffffff", weight: "400" | "700" = "400"): Text {
  return new Text({
    text: content,
    style: new TextStyle({
      fill,
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

export function glossyButton(label: string, width: number, height: number, bg: number, onTap: () => void, fontSize = 20): Container {
  const c = new Container();
  c.eventMode = "static";
  c.cursor = "pointer";
  const skinKey = bg === 0xffc23d || bg === 0xffb33d || bg === 0xffe05a ? "button_yellow" : bg === 0x2ebaf0 || bg === 0x33bfff ? "button_blue" : bg === 0x33d7ad || bg === 0x28c9b0 ? "button_green" : "button_white";
  const skin = spriteFromUi(skinKey, width, height);
  if (skin) {
    c.addChild(skin);
  } else {
  const shadow = new Graphics();
  shadow.roundRect(3, 5, width, height, 12).fill({ color: 0x1a1a1a, alpha: 0.38 });
  const body = new Graphics();
  body.roundRect(0, 0, width, height, 12).fill({ color: bg });
  body.roundRect(0, 0, width, height, 12).stroke({ color: 0x24313c, width: 4, alpha: 0.85 });
  body.roundRect(6, 6, width - 12, height * 0.38, 9).fill({ color: 0xffffff, alpha: 0.22 });
    c.addChild(shadow, body);
  }
  const t = text(label, fontSize, "#ffffff", "700");
  t.anchor.set(0.5);
  t.position.set(width / 2, height / 2);
  c.addChild(t);
  c.on("pointerdown", (event) => {
    event.stopPropagation();
    audio.playSfxEvent("ui_click");
    onTap();
  });
  return c;
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

export function drawMainBg(container: Container): void {
  const w = app.screen.width;
  const h = app.screen.height;
  const g = new Graphics();
  g.rect(0, 0, w, h).fill({ color: 0xffb16f });
  g.rect(0, 0, w, h).fill({ color: 0xff805f, alpha: 0.22 });
  for (let i = 0; i < 20; i += 1) {
    const x = (i * 97) % w;
    const y = 110 + ((i * 143) % Math.max(1, h - 160));
    g.circle(x, y, 44).stroke({ color: 0xe87a52, width: 10, alpha: 0.08 });
    g.moveTo(x - 16, y).lineTo(x + 42, y).stroke({ color: 0xe87a52, width: 9, alpha: 0.08 });
  }
  container.addChildAt(g, 0);
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
export function createWeaponIcon(item: ItemDef, quality: QualityDef, size: number): Container {
  const c = new Container();
  const qColor = color(quality.color);
  const bg = new Graphics();
  bg.roundRect(-size / 2, -size / 2, size, size, 10).fill({ color: 0x233140, alpha: 0.95 });
  bg.stroke({ color: qColor, width: 4, alpha: 0.95 });
  c.addChild(bg);

  const art = spriteFromAsset(item.iconAssetKey || `weapon_${item.icon}_icon`, size * 0.72, size * 0.72);
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

export function createItemShapeView(item: ItemDef, shape: ItemShapeDef, quality: QualityDef, cellSize: number): Container {
  const c = new Container();
  const qColor = color(quality.color);
  for (const [x, y] of shape.cells) {
    const g = new Graphics();
    g.roundRect(x * cellSize, y * cellSize, cellSize - 4, cellSize - 4, 9);
    g.fill({ color: 0x233140, alpha: 0.92 });
    g.stroke({ color: qColor, width: 3 });
    c.addChild(g);
  }

  const maxX = Math.max(...shape.cells.map(([x]) => x));
  const maxY = Math.max(...shape.cells.map(([, y]) => y));
  const icon = createWeaponIcon(item, quality, Math.min(cellSize * 0.82, 58));
  icon.position.set((maxX + 1) * cellSize * 0.5 - 2, (maxY + 1) * cellSize * 0.5 - 2);
  c.addChild(icon);
  return c;
}

export function screenPoint(event: PointerEvent): { x: number; y: number } {
  const rect = app.canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * app.screen.width,
    y: ((event.clientY - rect.top) / rect.height) * app.screen.height,
  };
}
