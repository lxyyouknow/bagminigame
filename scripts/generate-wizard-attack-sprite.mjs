import { rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const scriptPath = join(rootDir, "tmp_import_wizard_attack.py");

const python = String.raw`
from pathlib import Path
from PIL import Image
import json

root = Path(${JSON.stringify(rootDir)})
source = root / "public" / "game-assets" / "source" / "wizard-attack-up-ai-green-sheet.png"
out_dir = root / "public" / "game-assets" / "characters" / "wizard_attack_up"
frame_dir = out_dir / "frames"
frame_dir.mkdir(parents=True, exist_ok=True)

if not source.exists():
    raise FileNotFoundError(f"找不到源 sprite sheet：{source}")

src = Image.open(source).convert("RGBA")
src_w, src_h = src.size
frame_count = 8
frame_w = 160
frame_h = 160
# AI 生成的 sprite sheet 不是严格等分网格，尤其释放帧的星星会跨格。
# 使用角色主体中心点裁剪，避免把相邻帧的半个角色切进当前帧。
frame_centers_x = [64, 136, 206, 278, 350, 424, 555, 64]
source_crop_w = 78

def is_key_color(r, g, b):
    # 图二的绿底有轻微压缩噪点；边缘截图还带白底，二者都转透明。
    green = g > 170 and r < 90 and b < 90
    white = r > 245 and g > 245 and b > 245
    return green or white

def remove_background(img):
    out = Image.new("RGBA", img.size, (0, 0, 0, 0))
    pixels = img.load()
    out_pixels = out.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            if a == 0 or is_key_color(r, g, b):
                continue
            out_pixels[x, y] = (r, g, b, a)
    return out

def trim_alpha(img):
    box = img.getbbox()
    if not box:
        return img
    return img.crop(box)

frames = []
for i in range(frame_count):
    center_x = frame_centers_x[i]
    left = max(0, min(src_w - source_crop_w, round(center_x - source_crop_w / 2)))
    right = min(src_w, left + source_crop_w)
    col = src.crop((left, 0, right, src_h))
    clean = remove_background(col)
    subject = trim_alpha(clean)

    canvas = Image.new("RGBA", (frame_w, frame_h), (0, 0, 0, 0))
    # 统一脚底锚点，左右居中。保持原图尺寸，不做二次放大，避免糊。
    x = (frame_w - subject.width) // 2
    y = max(0, frame_h - subject.height - 8)
    canvas.alpha_composite(subject, (x, y))
    frames.append(canvas)
    canvas.save(frame_dir / f"wizard-attack-up-{i:02d}.png")

sheet = Image.new("RGBA", (frame_w * frame_count, frame_h), (0, 0, 0, 0))
for i, frame in enumerate(frames):
    sheet.alpha_composite(frame, (i * frame_w, 0))
sheet.save(out_dir / "wizard-attack-up-sheet.png")

frames[0].save(
    out_dir / "wizard-attack-up.gif",
    save_all=True,
    append_images=frames[1:],
    duration=80,
    loop=0,
    disposal=2,
)

metadata = {
    "name": "wizard_attack_up",
    "source": str(source.relative_to(root)),
    "frameWidth": frame_w,
    "frameHeight": frame_h,
    "frames": frame_count,
    "fps": 12,
    "direction": "up",
    "view": "top_down_from_bottom",
    "anchorX": 0.5,
    "anchorY": 0.78,
    "usage": "由绿底 AI sprite sheet 导入，竖屏战斗中放在基地前方，朝屏幕上方释放魔法攻击"
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
console.log(`已从绿底 sheet 导入 Q 版魔法师攻击帧动画：${result.stdout.trim()}`);
