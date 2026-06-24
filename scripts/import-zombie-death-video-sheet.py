from __future__ import annotations

from pathlib import Path
import json
import shutil

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
INPUT_DIR = ROOT / "video-frames-20260624-125306_sheet"
SOURCE_DIR = ROOT / "public" / "game-assets" / "source" / "zombie-death-down-video-20260624-125306"
OUT_DIR = ROOT / "public" / "game-assets" / "enemies" / "zombie_death_down"
FRAME_DIR = OUT_DIR / "frames"

FRAME_W = 256
FRAME_H = 256
MAX_SUBJECT_W = 230
MAX_SUBJECT_H = 238
BOTTOM_PADDING = 10


def archive_source() -> None:
    if not INPUT_DIR.exists():
        raise FileNotFoundError(f"找不到源图集目录：{INPUT_DIR}")
    SOURCE_DIR.parent.mkdir(parents=True, exist_ok=True)
    if SOURCE_DIR.exists():
        shutil.rmtree(SOURCE_DIR)
    shutil.copytree(INPUT_DIR, SOURCE_DIR)


def read_texture_packer_frames(source_dir: Path) -> list[tuple[str, Image.Image]]:
    entries: list[tuple[str, int, Path, dict]] = []
    for json_path in sorted(source_dir.glob("spritesheet_*.json")):
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
            entries.append((name, order, sheet_path, info))

    if not entries:
        raise FileNotFoundError(f"源目录没有 spritesheet_*.json：{source_dir}")

    result: list[tuple[str, Image.Image]] = []
    for name, _order, sheet_path, info in sorted(entries, key=lambda item: item[1]):
        frame = info.get("frame")
        sprite_source = info.get("spriteSourceSize")
        source_size = info.get("sourceSize")
        if not isinstance(frame, dict) or not isinstance(sprite_source, dict) or not isinstance(source_size, dict):
            raise ValueError(f"{name} 缺少 frame/spriteSourceSize/sourceSize 数据")
        if info.get("rotated"):
            raise ValueError(f"{name} 是旋转帧，当前导入脚本暂不支持 rotated=true")

        sheet = Image.open(sheet_path).convert("RGBA")
        x = int(frame["x"])
        y = int(frame["y"])
        w = int(frame["w"])
        h = int(frame["h"])
        crop = sheet.crop((x, y, x + w, y + h))

        canvas = Image.new("RGBA", (int(source_size["w"]), int(source_size["h"])), (0, 0, 0, 0))
        canvas.alpha_composite(crop, (int(sprite_source["x"]), int(sprite_source["y"])))
        result.append((name, canvas))
    return result


def alpha_bbox_union(frames: list[Image.Image]) -> tuple[int, int, int, int]:
    boxes = [frame.getchannel("A").getbbox() for frame in frames]
    boxes = [box for box in boxes if box]
    if not boxes:
        raise RuntimeError("死亡动画没有检测到有效透明主体")
    return (
        min(box[0] for box in boxes),
        min(box[1] for box in boxes),
        max(box[2] for box in boxes),
        max(box[3] for box in boxes),
    )


def clean_edges(image: Image.Image) -> Image.Image:
    clean = image.copy()
    pixels = clean.load()
    width, height = clean.size
    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            if a < 16:
                pixels[x, y] = (0, 0, 0, 0)
            elif a < 88 and r > g + 24 and b > g + 24:
                pixels[x, y] = (min(r, g + 18), g, min(b, g + 18), max(0, a - 20))
    return clean


def normalize_frames(raw_frames: list[tuple[str, Image.Image]]) -> list[Image.Image]:
    source_frames = [frame for _name, frame in raw_frames]
    bbox = alpha_bbox_union(source_frames)
    cropped = [frame.crop(bbox) for frame in source_frames]
    max_w = max(frame.width for frame in cropped)
    max_h = max(frame.height for frame in cropped)
    scale = min(MAX_SUBJECT_W / max_w, MAX_SUBJECT_H / max_h, 1)

    result: list[Image.Image] = []
    for frame in cropped:
        resized = frame.resize(
            (max(1, round(frame.width * scale)), max(1, round(frame.height * scale))),
            Image.Resampling.LANCZOS,
        )
        resized = clean_edges(resized)
        canvas = Image.new("RGBA", (FRAME_W, FRAME_H), (0, 0, 0, 0))
        x = (FRAME_W - resized.width) // 2
        y = FRAME_H - resized.height - BOTTOM_PADDING
        canvas.alpha_composite(resized, (x, y))
        result.append(canvas)
    return result


def write_outputs(frames: list[Image.Image]) -> None:
    FRAME_DIR.mkdir(parents=True, exist_ok=True)
    for old in FRAME_DIR.glob("zombie-death-down-*.png"):
        old.unlink()

    for index, frame in enumerate(frames):
        frame.save(FRAME_DIR / f"zombie-death-down-{index:02d}.png", optimize=True)

    sheet = Image.new("RGBA", (FRAME_W * len(frames), FRAME_H), (0, 0, 0, 0))
    for index, frame in enumerate(frames):
        sheet.alpha_composite(frame, (index * FRAME_W, 0))
    sheet.save(OUT_DIR / "zombie-death-down-sheet.png", optimize=True)

    frames[0].save(
        OUT_DIR / "zombie-death-down.gif",
        save_all=True,
        append_images=frames[1:],
        duration=83,
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
    preview.convert("RGB").save(OUT_DIR / "zombie-death-down-contact-sheet.jpg", quality=92)

    metadata = {
        "name": "zombie_death_down",
        "source": str(SOURCE_DIR.relative_to(ROOT)),
        "sourceFormat": "TexturePacker JSON + PNG",
        "character": "miner_zombie",
        "frameWidth": FRAME_W,
        "frameHeight": FRAME_H,
        "frames": len(frames),
        "fps": 12,
        "loop": False,
        "direction": "down",
        "view": "top_down_three_quarter_front",
        "anchorX": 0.5,
        "anchorY": 0.92,
        "scale": 0.5,
        "runtimeFadeAfterComplete": 0.32,
        "usage": "小僵尸被击杀后的死亡动画；播完最后一帧后由战斗逻辑渐隐并释放",
    }
    (OUT_DIR / "metadata.json").write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    archive_source()
    raw_frames = read_texture_packer_frames(SOURCE_DIR)
    frames = normalize_frames(raw_frames)
    write_outputs(frames)
    print(f"已导入 {len(frames)} 帧：{OUT_DIR}")


if __name__ == "__main__":
    main()
