from __future__ import annotations

from collections import deque
from pathlib import Path
import json

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "public" / "game-assets" / "source" / "zombie-walk-down-video-20260623-105208"
OUT_DIR = ROOT / "public" / "game-assets" / "enemies" / "zombie_walk_down"
FRAME_DIR = OUT_DIR / "frames"

FRAME_W = 256
FRAME_H = 256
MAX_SUBJECT_W = 224
MAX_SUBJECT_H = 236
BOTTOM_PADDING = 10


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
        if not isinstance(frame, dict):
            raise ValueError(f"{name} 缺少 frame 数据")
        if info.get("rotated"):
            raise ValueError(f"{name} 是旋转帧，当前导入脚本暂不支持 rotated=true")
        sheet = Image.open(sheet_path).convert("RGBA")
        x = int(frame["x"])
        y = int(frame["y"])
        w = int(frame["w"])
        h = int(frame["h"])
        result.append((name, sheet.crop((x, y, x + w, y + h))))
    return result


def keep_largest_alpha_component(image: Image.Image, threshold: int = 24) -> Image.Image:
    alpha = image.getchannel("A")
    pixels = alpha.load()
    width, height = alpha.size
    visited = bytearray(width * height)
    largest: list[tuple[int, int]] = []

    for y in range(height):
        for x in range(width):
            index = y * width + x
            if visited[index] or pixels[x, y] < threshold:
                continue
            queue = deque([(x, y)])
            visited[index] = 1
            component: list[tuple[int, int]] = []
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

    if not largest:
        raise RuntimeError("切帧后没有检测到怪物主体")

    mask = Image.new("L", image.size, 0)
    mask_pixels = mask.load()
    for x, y in largest:
        mask_pixels[x, y] = pixels[x, y]
    clean = image.copy()
    clean.putalpha(mask)
    return clean


def clean_resized_edges(image: Image.Image) -> Image.Image:
    clean = image.copy()
    pixels = clean.load()
    width, height = clean.size
    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            if a < 18:
                pixels[x, y] = (0, 0, 0, 0)
                continue
            # 导入的视频帧边缘可能有很薄的紫色抗锯齿，只收低透明边，不破坏角色暗色描边。
            if a < 96 and r > g + 28 and b > g + 28:
                pixels[x, y] = (min(r, g + 18), g, min(b, g + 18), max(0, a - 24))
    return clean


def normalize_frames(raw_frames: list[tuple[str, Image.Image]]) -> list[Image.Image]:
    subjects: list[Image.Image] = []
    boxes: list[tuple[int, int, int, int]] = []
    for name, raw in raw_frames:
        cell = keep_largest_alpha_component(raw)
        box = cell.getchannel("A").getbbox()
        if not box:
            raise RuntimeError(f"{name} 没有有效透明主体")
        subjects.append(cell.crop(box))
        boxes.append(box)

    max_w = max(subject.width for subject in subjects)
    max_h = max(subject.height for subject in subjects)
    scale = min(MAX_SUBJECT_W / max_w, MAX_SUBJECT_H / max_h, 1)

    frames: list[Image.Image] = []
    for subject in subjects:
        resized = subject.resize(
            (max(1, round(subject.width * scale)), max(1, round(subject.height * scale))),
            Image.Resampling.LANCZOS,
        )
        resized = clean_resized_edges(resized)
        canvas = Image.new("RGBA", (FRAME_W, FRAME_H), (0, 0, 0, 0))
        x = (FRAME_W - resized.width) // 2
        y = FRAME_H - resized.height - BOTTOM_PADDING
        canvas.alpha_composite(resized, (x, y))
        frames.append(canvas)
    return frames


def write_outputs(frames: list[Image.Image]) -> None:
    FRAME_DIR.mkdir(parents=True, exist_ok=True)
    for old in FRAME_DIR.glob("zombie-walk-down-*.png"):
        old.unlink()

    for index, frame in enumerate(frames):
        frame.save(FRAME_DIR / f"zombie-walk-down-{index:02d}.png", optimize=True)

    sheet = Image.new("RGBA", (FRAME_W * len(frames), FRAME_H), (0, 0, 0, 0))
    for index, frame in enumerate(frames):
        sheet.alpha_composite(frame, (index * FRAME_W, 0))
    sheet.save(OUT_DIR / "zombie-walk-down-sheet.png", optimize=True)

    frames[0].save(
        OUT_DIR / "zombie-walk-down.gif",
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
    preview.convert("RGB").save(OUT_DIR / "zombie-walk-down-contact-sheet.jpg", quality=92)

    metadata = {
        "name": "zombie_walk_down",
        "source": str(SOURCE_DIR.relative_to(ROOT)),
        "sourceFormat": "TexturePacker JSON + PNG",
        "character": "miner_zombie",
        "frameWidth": FRAME_W,
        "frameHeight": FRAME_H,
        "frames": len(frames),
        "fps": 12,
        "direction": "down",
        "view": "top_down_three_quarter_front",
        "anchorX": 0.5,
        "anchorY": 0.92,
        "scale": 0.5,
        "usage": "新手关第一种小僵尸，向屏幕下方行走；由 lxy 提供的视频序列帧图集导入",
    }
    (OUT_DIR / "metadata.json").write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8")


def main() -> None:
    raw_frames = read_texture_packer_frames(SOURCE_DIR)
    frames = normalize_frames(raw_frames)
    write_outputs(frames)
    print(f"已导入 {len(frames)} 帧：{OUT_DIR}")


if __name__ == "__main__":
    main()
