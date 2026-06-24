import { rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const scriptPath = join(rootDir, "tmp_generate_hit_tomato_splash_small.py");

const python = String.raw`
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter
import json
import math

root = Path(${JSON.stringify(rootDir)})
out_dir = root / "public" / "game-assets" / "effects" / "hit" / "hit_tomato_splash_small"
frame_dir = out_dir / "frames"
frame_dir.mkdir(parents=True, exist_ok=True)

frame_size = 256
frame_count = 8
center = (128, 128)

red = (228, 45, 38)
deep_red = (158, 25, 30)
juice = (255, 86, 53)
orange = (255, 150, 35)
yellow = (255, 236, 94)
leaf = (72, 176, 78)
leaf_dark = (38, 112, 55)

def clamp(v, lo, hi):
    return max(lo, min(hi, v))

def with_alpha(color, alpha):
    return (color[0], color[1], color[2], clamp(int(alpha), 0, 255))

def star_points(cx, cy, outer, inner, points=6, rotation=-math.pi / 2):
    pts = []
    for i in range(points * 2):
        radius = outer if i % 2 == 0 else inner
        angle = rotation + i * math.pi / points
        pts.append((cx + math.cos(angle) * radius, cy + math.sin(angle) * radius))
    return pts

def blob(draw, cx, cy, rx, ry, fill, outline, alpha, outline_alpha=None):
    if outline_alpha is None:
        outline_alpha = alpha
    box = (cx - rx, cy - ry, cx + rx, cy + ry)
    draw.ellipse(box, fill=with_alpha(fill, alpha), outline=with_alpha(outline, outline_alpha), width=3)

def draw_leaf(draw, cx, cy, angle, size, alpha):
    p1 = (cx + math.cos(angle) * size, cy + math.sin(angle) * size)
    p2 = (cx + math.cos(angle + 2.35) * size * 0.55, cy + math.sin(angle + 2.35) * size * 0.55)
    p3 = (cx + math.cos(angle - 2.35) * size * 0.55, cy + math.sin(angle - 2.35) * size * 0.55)
    draw.polygon([p1, p2, p3], fill=with_alpha(leaf, alpha), outline=with_alpha(leaf_dark, alpha * 0.82))

droplets = [
    (-0.25, -34, 9, 6, 1.00),
    (0.40, 38, 8, 6, 0.92),
    (1.08, 42, 6, 5, 0.78),
    (1.92, 35, 7, 5, 0.86),
    (2.65, 29, 5, 4, 0.72),
    (3.36, 39, 8, 5, 0.82),
    (4.12, 30, 6, 4, 0.70),
    (4.88, 37, 7, 5, 0.84),
    (5.58, 31, 5, 4, 0.76),
]

leaf_bits = [
    (0.72, 44, 7),
    (2.88, 38, 6),
    (5.20, 34, 5),
]

profiles = [
    {"main": 0.18, "alpha": 255, "star": 0.00, "spread": 0.10, "fade": 0.00},
    {"main": 0.55, "alpha": 255, "star": 0.92, "spread": 0.36, "fade": 0.00},
    {"main": 0.92, "alpha": 248, "star": 0.72, "spread": 0.72, "fade": 0.04},
    {"main": 0.78, "alpha": 230, "star": 0.38, "spread": 0.96, "fade": 0.12},
    {"main": 0.48, "alpha": 176, "star": 0.00, "spread": 1.00, "fade": 0.34},
    {"main": 0.26, "alpha": 126, "star": 0.00, "spread": 0.96, "fade": 0.55},
    {"main": 0.10, "alpha": 78, "star": 0.00, "spread": 0.88, "fade": 0.72},
    {"main": 0.00, "alpha": 42, "star": 0.00, "spread": 0.78, "fade": 0.86},
]

frames = []
for index, profile in enumerate(profiles):
    frame = Image.new("RGBA", (frame_size, frame_size), (0, 0, 0, 0))
    layer = Image.new("RGBA", (frame_size, frame_size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    cx, cy = center
    alpha = profile["alpha"]
    spread = profile["spread"]
    fade_factor = 1.0 - profile["fade"]

    if profile["star"] > 0:
        outer = 19 + 13 * profile["star"]
        inner = outer * 0.36
        draw.polygon(star_points(cx, cy, outer, inner, points=6), fill=with_alpha(yellow, 215 * profile["star"]))
        draw.polygon(star_points(cx, cy, outer * 0.68, inner * 0.54, points=6, rotation=-math.pi / 2 + 0.16), fill=with_alpha(orange, 190 * profile["star"]))

    if profile["main"] > 0:
        main_scale = profile["main"]
        blob(draw, cx - 3, cy + 1, 9 + 16 * main_scale, 7 + 12 * main_scale, juice, deep_red, alpha * 0.95)
        blob(draw, cx + 9, cy - 4, 6 + 9 * main_scale, 5 + 7 * main_scale, red, deep_red, alpha * 0.82)
        blob(draw, cx - 10, cy + 7, 5 + 7 * main_scale, 4 + 5 * main_scale, red, deep_red, alpha * 0.72)

    # 短小汁液线条只在中前段出现，避免变成大范围爆炸。
    if index in (1, 2, 3):
        for angle, dist, rx, ry, strength in droplets[:7]:
            sx = cx + math.cos(angle) * 16 * spread
            sy = cy + math.sin(angle) * 16 * spread
            ex = cx + math.cos(angle) * dist * spread
            ey = cy + math.sin(angle) * dist * spread
            line_alpha = alpha * strength * (0.62 if index == 3 else 0.85)
            draw.line((sx, sy, ex, ey), fill=with_alpha(deep_red, line_alpha), width=5)
            draw.line((sx, sy, ex, ey), fill=with_alpha(juice, line_alpha), width=3)

    for angle, dist, rx, ry, strength in droplets:
        dot_alpha = alpha * strength * fade_factor
        if index == 0:
            dot_alpha *= 0.18
        dx = cx + math.cos(angle) * dist * spread
        dy = cy + math.sin(angle) * dist * spread
        if index >= 6:
            rx *= 0.58
            ry *= 0.58
        if dot_alpha > 8:
            blob(draw, dx, dy, rx, ry, red if angle % 1.3 > 0.45 else juice, deep_red, dot_alpha, dot_alpha * 0.68)

    if index in (2, 3, 4, 5):
        for angle, dist, size in leaf_bits:
            draw_leaf(draw, cx + math.cos(angle) * dist * spread, cy + math.sin(angle) * dist * spread, angle + 0.7, size, alpha * 0.72 * fade_factor)

    if index >= 5:
        # 末尾只保留轻量残点，方便运行时自然销毁。
        draw.ellipse((cx - 23, cy + 12, cx - 18, cy + 17), fill=with_alpha(red, alpha * 0.44))
        draw.ellipse((cx + 19, cy - 19, cx + 24, cy - 14), fill=with_alpha(juice, alpha * 0.38))
        draw.ellipse((cx + 7, cy + 24, cx + 11, cy + 28), fill=with_alpha(deep_red, alpha * 0.28))

    layer = layer.filter(ImageFilter.GaussianBlur(0.15))
    frame.alpha_composite(layer)
    frames.append(frame)
    frame.save(frame_dir / f"hit-tomato-splash-small-{index:02d}.png", optimize=True)

sheet = Image.new("RGBA", (frame_size * frame_count, frame_size), (0, 0, 0, 0))
for index, frame in enumerate(frames):
    sheet.alpha_composite(frame, (index * frame_size, 0))
sheet.save(out_dir / "hit-tomato-splash-small-sheet.png", optimize=True)

frames[0].save(
    out_dir / "hit-tomato-splash-small.gif",
    save_all=True,
    append_images=frames[1:],
    duration=58,
    loop=0,
    disposal=2,
    optimize=True,
)

preview = Image.new("RGBA", sheet.size, (38, 46, 50, 255))
draw = ImageDraw.Draw(preview)
for y in range(0, preview.height, 24):
    for x in range(0, preview.width, 24):
        if (x // 24 + y // 24) % 2 == 0:
            draw.rectangle((x, y, x + 23, y + 23), fill=(54, 64, 68, 255))
preview.alpha_composite(sheet)
preview.convert("RGB").save(out_dir / "hit-tomato-splash-small-contact-sheet.jpg", quality=92)

metadata = {
    "name": "hit_tomato_splash_small",
    "frameWidth": frame_size,
    "frameHeight": frame_size,
    "frames": frame_count,
    "fps": 18,
    "loop": False,
    "anchorX": 0.5,
    "anchorY": 0.5,
    "suggestedLayer": "hitFxLayer",
    "suggestedScale": 0.42,
    "maxSplashRadiusPx": 62,
    "transparentSafeMarginPx": 66,
    "usage": "番茄 projectile 普通命中怪物但未击杀时播放的小型命中特效，不作为击杀爆炸使用",
    "artNotes": [
        "Q版卡通农场防守风格，主色为番茄红汁液，辅以少量橙黄色中心星芒和绿色叶片碎屑",
        "主体集中在中心，飞溅半径小，避免遮住怪物读形",
        "最后帧只保留低透明红色残点，便于短时间淡出"
    ],
    "exports": {
        "spriteSheet": "hit-tomato-splash-small-sheet.png",
        "gifPreview": "hit-tomato-splash-small.gif",
        "framesDir": "frames"
    }
}
(out_dir / "metadata.json").write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8")

print(out_dir)
`;

await writeFile(scriptPath, python, "utf8");
const result = spawnSync("python3", [scriptPath], { encoding: "utf8" });
await rm(scriptPath, { force: true });
if (result.status !== 0) {
  console.error(result.stderr || result.stdout);
  process.exit(result.status ?? 1);
}
console.log(`已生成小型番茄普通命中特效：${result.stdout.trim()}`);
