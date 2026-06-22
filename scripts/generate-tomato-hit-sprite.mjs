import { rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const scriptPath = join(rootDir, "tmp_import_tomato_hit.py");

const python = String.raw`
from pathlib import Path
from PIL import Image, ImageDraw
from collections import deque
import json

root = Path(${JSON.stringify(rootDir)})
source = root / "public" / "game-assets" / "source" / "hit-tomato-burst-ai-transparent-sheet.png"
out_dir = root / "public" / "game-assets" / "effects" / "hit" / "tomato_burst"
frame_dir = out_dir / "frames"
frame_dir.mkdir(parents=True, exist_ok=True)

src = Image.open(source).convert("RGBA")
frame_count = 8
frame_size = 256
frame_centers_x = [153, 417, 692, 1014, 1343, 1601, 1834, 2050]
alpha = src.getchannel("A")
alpha_pixels = alpha.load()
visited = bytearray(src.width * src.height)
components_by_frame = [[] for _ in range(frame_count)]

# AI sheet 的大爆炸会跨过等分边界。按连通区域质心归属到最近帧中心，
# 可以保留完整爆炸，同时避免下一帧混入上一帧的半个爆炸。
for y in range(src.height):
    for x in range(src.width):
        offset = y * src.width + x
        if visited[offset] or alpha_pixels[x, y] < 64:
            continue
        queue = deque([(x, y)])
        visited[offset] = 1
        component = []
        sum_x = 0
        while queue:
            cx, cy = queue.popleft()
            component.append((cx, cy))
            sum_x += cx
            for nx, ny in ((cx - 1, cy), (cx + 1, cy), (cx, cy - 1), (cx, cy + 1)):
                if nx < 0 or ny < 0 or nx >= src.width or ny >= src.height:
                    continue
                next_offset = ny * src.width + nx
                if visited[next_offset] or alpha_pixels[nx, ny] < 64:
                    continue
                visited[next_offset] = 1
                queue.append((nx, ny))
        if len(component) < 3:
            continue
        center_x = sum_x / len(component)
        frame_index = min(range(frame_count), key=lambda i: abs(center_x - frame_centers_x[i]))
        components_by_frame[frame_index].append(component)

subjects = []
for index, components in enumerate(components_by_frame):
    points = [point for component in components for point in component]
    if not points:
        raise ValueError(f"番茄爆炸第 {index} 帧没有有效主体")
    min_x = min(x for x, _ in points)
    max_x = max(x for x, _ in points) + 1
    min_y = min(y for _, y in points)
    max_y = max(y for _, y in points) + 1
    subject = Image.new("RGBA", (max_x - min_x, max_y - min_y), (0, 0, 0, 0))
    subject_pixels = subject.load()
    source_pixels = src.load()
    for x, y in points:
        subject_pixels[x - min_x, y - min_y] = source_pixels[x, y]
    subjects.append(subject)

max_width = max(subject.width for subject in subjects)
max_height = max(subject.height for subject in subjects)
common_scale = min(224 / max_width, 224 / max_height, 1)
frames = []

for index, subject in enumerate(subjects):
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
    "usage": "番茄弹道命中怪物时在命中点播放，播完自动销毁",
    "slicing": "按透明连通区域质心归属到 8 个帧中心，避免跨格爆炸被切成两半"
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
