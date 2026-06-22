import { rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const scriptPath = join(rootDir, "tmp_import_tomato_hit.py");

const python = String.raw`
from pathlib import Path
from PIL import Image, ImageDraw
import json

root = Path(${JSON.stringify(rootDir)})
source = root / "public" / "game-assets" / "source" / "hit-tomato-burst-ai-transparent-sheet.png"
out_dir = root / "public" / "game-assets" / "effects" / "hit" / "tomato_burst"
frame_dir = out_dir / "frames"
frame_dir.mkdir(parents=True, exist_ok=True)

src = Image.open(source).convert("RGBA")
frame_count = 8
frame_size = 256
cells = []
boxes = []

for index in range(frame_count):
    left = round(index * src.width / frame_count)
    right = round((index + 1) * src.width / frame_count)
    cell = src.crop((left, 0, right, src.height))
    box = cell.getchannel("A").getbbox()
    if not box:
        raise ValueError(f"番茄爆炸第 {index} 帧没有有效主体")
    cells.append(cell)
    boxes.append(box)

max_width = max(box[2] - box[0] for box in boxes)
max_height = max(box[3] - box[1] for box in boxes)
common_scale = min(224 / max_width, 224 / max_height, 1)
frames = []

for index, (cell, box) in enumerate(zip(cells, boxes)):
    subject = cell.crop(box)
    resized = subject.resize(
        (max(1, round(subject.width * common_scale)), max(1, round(subject.height * common_scale))),
        Image.Resampling.LANCZOS,
    )
    canvas = Image.new("RGBA", (frame_size, frame_size), (0, 0, 0, 0))
    x = (frame_size - resized.width) // 2
    y = (frame_size - resized.height) // 2
    canvas.alpha_composite(resized, (x, y))
    frames.append(canvas)
    canvas.save(frame_dir / f"hit-tomato-burst-{index:02d}.png", optimize=True)

sheet = Image.new("RGBA", (frame_size * frame_count, frame_size), (0, 0, 0, 0))
for index, frame in enumerate(frames):
    sheet.alpha_composite(frame, (index * frame_size, 0))
sheet.save(out_dir / "hit-tomato-burst-sheet.png", optimize=True)

frames[0].save(
    out_dir / "hit-tomato-burst.gif",
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
preview.convert("RGB").save(out_dir / "hit-tomato-burst-contact-sheet.jpg", quality=92)

metadata = {
    "name": "hit_tomato_burst",
    "source": str(source.relative_to(root)),
    "rawSource": "public/game-assets/source/hit-tomato-burst-ai-magenta-sheet.png",
    "frameWidth": frame_size,
    "frameHeight": frame_size,
    "frames": frame_count,
    "fps": 18,
    "loop": False,
    "anchorX": 0.5,
    "anchorY": 0.5,
    "scale": 0.5,
    "usage": "番茄弹道命中怪物时在命中点播放，播完自动销毁"
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
console.log(`已生成番茄命中爆炸帧动画：${result.stdout.trim()}`);
