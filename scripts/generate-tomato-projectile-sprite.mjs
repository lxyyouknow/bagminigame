import { rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const scriptPath = join(rootDir, "tmp_import_tomato_projectile.py");

const python = String.raw`
from pathlib import Path
from PIL import Image, ImageDraw
import json

root = Path(${JSON.stringify(rootDir)})
source = root / "public" / "game-assets" / "source" / "projectile-tomato-ai-transparent.png"
out_dir = root / "public" / "game-assets" / "effects" / "projectiles" / "tomato_spin"
frame_dir = out_dir / "frames"
frame_dir.mkdir(parents=True, exist_ok=True)

src = Image.open(source).convert("RGBA")
box = src.getchannel("A").getbbox()
if not box:
    raise ValueError("番茄透明源图没有有效主体")
subject = src.crop(box)

frame_count = 8
frame_size = 128
subject_size = 88
scale = min(subject_size / subject.width, subject_size / subject.height)
subject = subject.resize(
    (max(1, round(subject.width * scale)), max(1, round(subject.height * scale))),
    Image.Resampling.LANCZOS,
)

frames = []
for index in range(frame_count):
    angle = -index * (360 / frame_count)
    rotated = subject.rotate(angle, resample=Image.Resampling.BICUBIC, expand=True)
    canvas = Image.new("RGBA", (frame_size, frame_size), (0, 0, 0, 0))
    x = (frame_size - rotated.width) // 2
    y = (frame_size - rotated.height) // 2
    canvas.alpha_composite(rotated, (x, y))
    frames.append(canvas)
    canvas.save(frame_dir / f"projectile-tomato-spin-{index:02d}.png", optimize=True)

sheet = Image.new("RGBA", (frame_size * frame_count, frame_size), (0, 0, 0, 0))
for index, frame in enumerate(frames):
    sheet.alpha_composite(frame, (index * frame_size, 0))
sheet.save(out_dir / "projectile-tomato-spin-sheet.png", optimize=True)

frames[0].save(
    out_dir / "projectile-tomato-spin.gif",
    save_all=True,
    append_images=frames[1:],
    duration=70,
    loop=0,
    disposal=2,
    optimize=True,
)

preview = Image.new("RGBA", sheet.size, (38, 46, 50, 255))
draw = ImageDraw.Draw(preview)
for y in range(0, preview.height, 16):
    for x in range(0, preview.width, 16):
        if (x // 16 + y // 16) % 2 == 0:
            draw.rectangle((x, y, x + 15, y + 15), fill=(54, 64, 68, 255))
preview.alpha_composite(sheet)
preview.convert("RGB").save(out_dir / "projectile-tomato-spin-contact-sheet.jpg", quality=92)

metadata = {
    "name": "projectile_tomato_spin",
    "source": str(source.relative_to(root)),
    "rawSource": "public/game-assets/source/projectile-tomato-ai-magenta.png",
    "frameWidth": frame_size,
    "frameHeight": frame_size,
    "frames": frame_count,
    "fps": 14,
    "loop": True,
    "anchorX": 0.5,
    "anchorY": 0.5,
    "scale": 0.5,
    "generation": "单张独立番茄原图，脚本按 45 度递增旋转生成 8 帧；位移由战斗代码实现"
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
console.log(`已生成番茄旋转弹道帧动画：${result.stdout.trim()}`);
