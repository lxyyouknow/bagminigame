import { rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const scriptPath = join(rootDir, "tmp_import_zombie_walk.py");

const python = String.raw`
from pathlib import Path
from PIL import Image, ImageDraw
from collections import deque
import json

root = Path(${JSON.stringify(rootDir)})
source = root / "public" / "game-assets" / "source" / "zombie-walk-down-ai-transparent-sheet.png"
out_dir = root / "public" / "game-assets" / "enemies" / "zombie_walk_down"
frame_dir = out_dir / "frames"
frame_dir.mkdir(parents=True, exist_ok=True)

if not source.exists():
    raise FileNotFoundError(f"找不到透明源 sprite sheet：{source}")

src = Image.open(source).convert("RGBA")
frame_count = 8
frame_w = 256
frame_h = 256
max_subject_w = 224
max_subject_h = 236
frames = []

def keep_largest_alpha_component(image, threshold=24):
    alpha = image.getchannel("A")
    pixels = alpha.load()
    width, height = alpha.size
    visited = bytearray(width * height)
    largest = []
    for y in range(height):
        for x in range(width):
            index = y * width + x
            if visited[index] or pixels[x, y] < threshold:
                continue
            queue = deque([(x, y)])
            visited[index] = 1
            component = []
            while queue:
                cx, cy = queue.popleft()
                component.append((cx, cy))
                for nx, ny in ((cx - 1, cy), (cx + 1, cy), (cx, cy - 1), (cx, cy + 1)):
                    if nx < 0 or ny < 0 or nx >= width or ny >= height:
                        continue
                    next_index = ny * width + nx
                    if visited[next_index] or pixels[nx, ny] < threshold:
                        continue
                    visited[next_index] = 1
                    queue.append((nx, ny))
            if len(component) > len(largest):
                largest = component
    mask = Image.new("L", image.size, 0)
    mask_pixels = mask.load()
    for x, y in largest:
        mask_pixels[x, y] = pixels[x, y]
    clean = image.copy()
    clean.putalpha(mask)
    return clean

for i in range(frame_count):
    left = round(i * src.width / frame_count)
    right = round((i + 1) * src.width / frame_count)
    cell = keep_largest_alpha_component(src.crop((left, 0, right, src.height)))
    alpha = cell.getchannel("A")
    box = alpha.getbbox()
    if not box:
        raise ValueError(f"第 {i} 帧没有有效主体")
    subject = cell.crop(box)
    scale = min(max_subject_w / subject.width, max_subject_h / subject.height, 1)
    resized = subject.resize(
        (max(1, round(subject.width * scale)), max(1, round(subject.height * scale))),
        Image.Resampling.LANCZOS,
    )
    canvas = Image.new("RGBA", (frame_w, frame_h), (0, 0, 0, 0))
    x = (frame_w - resized.width) // 2
    y = frame_h - resized.height - 10
    canvas.alpha_composite(resized, (x, y))
    frames.append(canvas)
    canvas.save(frame_dir / f"zombie-walk-down-{i:02d}.png", optimize=True)

sheet = Image.new("RGBA", (frame_w * frame_count, frame_h), (0, 0, 0, 0))
for i, frame in enumerate(frames):
    sheet.alpha_composite(frame, (i * frame_w, 0))
sheet.save(out_dir / "zombie-walk-down-sheet.png", optimize=True)

frames[0].save(
    out_dir / "zombie-walk-down.gif",
    save_all=True,
    append_images=frames[1:],
    duration=110,
    loop=0,
    disposal=2,
    optimize=True,
)

preview = Image.new("RGBA", sheet.size, (34, 42, 48, 255))
draw = ImageDraw.Draw(preview)
tile = 32
for y in range(0, preview.height, tile):
    for x in range(0, preview.width, tile):
        if (x // tile + y // tile) % 2 == 0:
            draw.rectangle((x, y, x + tile - 1, y + tile - 1), fill=(48, 58, 64, 255))
preview.alpha_composite(sheet)
preview.convert("RGB").save(out_dir / "zombie-walk-down-contact-sheet.jpg", quality=92)

metadata = {
    "name": "zombie_walk_down",
    "source": str(source.relative_to(root)),
    "rawSource": "public/game-assets/source/zombie-walk-down-ai-magenta-sheet.png",
    "frameWidth": frame_w,
    "frameHeight": frame_h,
    "frames": frame_count,
    "fps": 9,
    "direction": "down",
    "view": "top_down_three_quarter_front",
    "anchorX": 0.5,
    "anchorY": 0.92,
    "scale": 0.26,
    "attackAnimationReserved": "zombie_attack_down",
    "usage": "蔬菜种植防守主题的小僵尸，向屏幕下方行走；接触基地后暂时继续播放 walk，后续替换 attack 动画"
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
console.log(`已生成小僵尸向下行走帧动画：${result.stdout.trim()}`);
