from __future__ import annotations

from pathlib import Path
import json
import shutil

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
TMP_SOURCE_DIR = ROOT / "tmp" / "video-frames-20260623-221405_sheet"
SOURCE_DIR = ROOT / "public" / "game-assets" / "source" / "hero-pumpkin-slingshot-attack-up-video-20260623-221405"
OUT_DIR = ROOT / "public" / "game-assets" / "characters" / "hero_pumpkin_slingshot_attack_up"
FRAME_DIR = OUT_DIR / "frames"

FRAME_W = 256
FRAME_H = 256
MAX_SOURCE_W = 226
MAX_SOURCE_H = 226
FPS = 18


def ensure_source_copy() -> None:
    if SOURCE_DIR.exists():
        return
    if not TMP_SOURCE_DIR.exists():
        raise FileNotFoundError(f"找不到临时图集目录：{TMP_SOURCE_DIR}")
    shutil.copytree(TMP_SOURCE_DIR, SOURCE_DIR)


def sheet_index(path: Path) -> int:
    return int(path.stem.split("_")[1])


def read_texture_packer_frames(source_dir: Path) -> list[tuple[str, Image.Image]]:
    entries: list[tuple[int, str, Path, dict]] = []
    for json_path in sorted(source_dir.glob("spritesheet_*.json"), key=sheet_index):
        sheet_path = json_path.with_suffix(".png")
        if not sheet_path.exists():
            raise FileNotFoundError(f"找不到图集图片：{sheet_path}")
        data = json.loads(json_path.read_text(encoding="utf-8"))
        frames = data.get("frames")
        if not isinstance(frames, dict):
            raise ValueError(f"{json_path} 的 frames 不是 TexturePacker 字典格式")
        for name, info in frames.items():
            try:
                order = int(Path(name).stem)
            except ValueError as exc:
                raise ValueError(f"帧名需要能按数字排序：{name}") from exc
            entries.append((order, name, sheet_path, info))

    if not entries:
        raise FileNotFoundError(f"源目录没有 spritesheet_*.json：{source_dir}")

    result: list[tuple[str, Image.Image]] = []
    for _order, name, sheet_path, info in sorted(entries, key=lambda item: item[0]):
        if info.get("rotated"):
            raise ValueError(f"{name} 是旋转帧，当前导入脚本暂不支持 rotated=true")
        frame = info.get("frame")
        source_size = info.get("sourceSize")
        source_rect = info.get("spriteSourceSize")
        if not isinstance(frame, dict):
            raise ValueError(f"{name} 缺少 frame 数据")
        if not isinstance(source_size, dict) or not isinstance(source_rect, dict):
            raise ValueError(f"{name} 缺少 sourceSize 或 spriteSourceSize 数据")
        sheet = Image.open(sheet_path).convert("RGBA")
        x = int(frame["x"])
        y = int(frame["y"])
        w = int(frame["w"])
        h = int(frame["h"])
        trimmed = sheet.crop((x, y, x + w, y + h))
        restored = Image.new("RGBA", (int(source_size["w"]), int(source_size["h"])), (0, 0, 0, 0))
        restored.alpha_composite(trimmed, (int(source_rect["x"]), int(source_rect["y"])))
        result.append((name, restored))
    return result


def normalize_frames(raw_frames: list[tuple[str, Image.Image]]) -> list[Image.Image]:
    subjects = [raw for _name, raw in raw_frames]
    max_w = max(subject.width for subject in subjects)
    max_h = max(subject.height for subject in subjects)
    scale = min(MAX_SOURCE_W / max_w, MAX_SOURCE_H / max_h, 1)

    frames: list[Image.Image] = []
    for subject in subjects:
        resized = subject.resize(
            (max(1, round(subject.width * scale)), max(1, round(subject.height * scale))),
            Image.Resampling.LANCZOS,
        )
        canvas = Image.new("RGBA", (FRAME_W, FRAME_H), (0, 0, 0, 0))
        x = (FRAME_W - resized.width) // 2
        y = (FRAME_H - resized.height) // 2
        canvas.alpha_composite(resized, (x, y))
        frames.append(canvas)
    return frames


def write_outputs(frames: list[Image.Image]) -> None:
    FRAME_DIR.mkdir(parents=True, exist_ok=True)
    for old in FRAME_DIR.glob("hero-pumpkin-slingshot-attack-up-*.png"):
        old.unlink()

    for index, frame in enumerate(frames):
        frame.save(FRAME_DIR / f"hero-pumpkin-slingshot-attack-up-{index:02d}.png", optimize=True)

    sheet = Image.new("RGBA", (FRAME_W * len(frames), FRAME_H), (0, 0, 0, 0))
    for index, frame in enumerate(frames):
        sheet.alpha_composite(frame, (index * FRAME_W, 0))
    sheet.save(OUT_DIR / "hero-pumpkin-slingshot-attack-up-sheet.png", optimize=True)

    frames[0].save(
        OUT_DIR / "hero-pumpkin-slingshot-attack-up.gif",
        save_all=True,
        append_images=frames[1:],
        duration=round(1000 / FPS),
        loop=0,
        disposal=2,
        optimize=True,
    )

    cols = 8
    rows = (len(frames) + cols - 1) // cols
    preview = Image.new("RGBA", (cols * FRAME_W, rows * FRAME_H), (34, 42, 48, 255))
    draw = ImageDraw.Draw(preview)
    tile = 32
    for y in range(0, preview.height, tile):
      for x in range(0, preview.width, tile):
        if (x // tile + y // tile) % 2 == 0:
          draw.rectangle((x, y, x + tile - 1, y + tile - 1), fill=(48, 58, 64, 255))
    for index, frame in enumerate(frames):
        x = (index % cols) * FRAME_W
        y = (index // cols) * FRAME_H
        preview.alpha_composite(frame, (x, y))
        draw.text((x + 8, y + 8), str(index), fill=(255, 255, 255, 255))
    preview.convert("RGB").save(OUT_DIR / "hero-pumpkin-slingshot-attack-up-contact-sheet.jpg", quality=92)

    metadata = {
        "name": "hero_pumpkin_slingshot_attack_up",
        "source": str(SOURCE_DIR.relative_to(ROOT)),
        "sourceFormat": "TexturePacker JSON + PNG",
        "character": "pumpkin_slingshot_guardian",
        "frameWidth": FRAME_W,
        "frameHeight": FRAME_H,
        "frames": len(frames),
        "fps": FPS,
        "direction": "up",
        "view": "top_down_from_bottom",
        "anchorX": 0.5,
        "anchorY": 0.5,
        "scale": 1,
        "hitFrame": 30,
        "usage": "南瓜弹弓守卫主角攻击动画；由 tmp/video-frames-20260623-221405_sheet 原始图集复制留档后导入，源图不改写",
    }
    (OUT_DIR / "metadata.json").write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    ensure_source_copy()
    raw_frames = read_texture_packer_frames(SOURCE_DIR)
    frames = normalize_frames(raw_frames)
    write_outputs(frames)
    print(f"已导入南瓜弹弓守卫 {len(frames)} 帧：{OUT_DIR}")


if __name__ == "__main__":
    main()
