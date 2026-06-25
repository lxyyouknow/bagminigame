from __future__ import annotations

from argparse import ArgumentParser
from collections import deque
from pathlib import Path
import json
import shutil

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]


def parse_args():
    parser = ArgumentParser(description="导入 TexturePacker/Cocos 风格动作图集，输出运行时透明序列帧。")
    parser.add_argument("--source", required=True, help="源图集目录，包含 spritesheet_*.json/png")
    parser.add_argument("--source-name", required=True, help="归档到 public/game-assets/source/ 下的目录名")
    parser.add_argument("--out", required=True, help="运行时输出目录，例如 public/game-assets/enemies/boss_walk_down")
    parser.add_argument("--key", required=True, help="动画 key，例如 boss_walk_down")
    parser.add_argument("--prefix", required=True, help="输出帧文件前缀，例如 boss-walk-down")
    parser.add_argument("--category", default="boss", help="metadata 中记录的角色或资源类别")
    parser.add_argument("--fps", type=int, required=True)
    parser.add_argument("--anchor-x", type=float, default=0.5)
    parser.add_argument("--anchor-y", type=float, default=0.92)
    parser.add_argument("--scale", type=float, default=0.55)
    parser.add_argument("--frame-width", type=int, default=256)
    parser.add_argument("--frame-height", type=int, default=256)
    parser.add_argument("--max-subject-width", type=int, default=238)
    parser.add_argument("--max-subject-height", type=int, default=244)
    parser.add_argument("--bottom-padding", type=int, default=8)
    parser.add_argument("--hit-frame", type=int, default=-1)
    parser.add_argument("--loop", action="store_true")
    parser.add_argument("--usage", default="")
    return parser.parse_args()


def archive_source(source_dir: Path, source_name: str) -> Path:
    target = ROOT / "public" / "game-assets" / "source" / source_name
    if target.exists():
        shutil.rmtree(target)
    shutil.copytree(source_dir, target)
    return target


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
    sheet_cache: dict[Path, Image.Image] = {}
    for name, _order, sheet_path, info in sorted(entries, key=lambda item: item[1]):
        frame = info.get("frame")
        if not isinstance(frame, dict):
            raise ValueError(f"{name} 缺少 frame 数据")
        if info.get("rotated"):
            raise ValueError(f"{name} 是旋转帧，当前导入脚本暂不支持 rotated=true")
        sheet = sheet_cache.get(sheet_path)
        if sheet is None:
            sheet = Image.open(sheet_path).convert("RGBA")
            sheet_cache[sheet_path] = sheet
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
        raise RuntimeError("切帧后没有检测到主体")

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
            if a < 92 and r > g + 32 and b > g + 32:
                pixels[x, y] = (min(r, g + 18), g, min(b, g + 18), max(0, a - 24))
    return clean


def normalize_frames(raw_frames: list[tuple[str, Image.Image]], args) -> list[Image.Image]:
    subjects: list[Image.Image] = []
    for name, raw in raw_frames:
        cell = keep_largest_alpha_component(raw)
        box = cell.getchannel("A").getbbox()
        if not box:
            raise RuntimeError(f"{name} 没有有效透明主体")
        subjects.append(cell.crop(box))

    max_w = max(subject.width for subject in subjects)
    max_h = max(subject.height for subject in subjects)
    scale = min(args.max_subject_width / max_w, args.max_subject_height / max_h, 1)

    frames: list[Image.Image] = []
    for subject in subjects:
        resized = subject.resize(
            (max(1, round(subject.width * scale)), max(1, round(subject.height * scale))),
            Image.Resampling.LANCZOS,
        )
        resized = clean_resized_edges(resized)
        canvas = Image.new("RGBA", (args.frame_width, args.frame_height), (0, 0, 0, 0))
        x = (args.frame_width - resized.width) // 2
        y = args.frame_height - resized.height - args.bottom_padding
        canvas.alpha_composite(resized, (x, y))
        frames.append(canvas)
    return frames


def write_outputs(frames: list[Image.Image], source_archive: Path, args) -> None:
    out_dir = ROOT / args.out
    frame_dir = out_dir / "frames"
    frame_dir.mkdir(parents=True, exist_ok=True)
    for old in frame_dir.glob(f"{args.prefix}-*.png"):
        old.unlink()

    for index, frame in enumerate(frames):
        frame.save(frame_dir / f"{args.prefix}-{index:02d}.png", optimize=True)

    sheet = Image.new("RGBA", (args.frame_width * len(frames), args.frame_height), (0, 0, 0, 0))
    for index, frame in enumerate(frames):
        sheet.alpha_composite(frame, (index * args.frame_width, 0))
    sheet.save(out_dir / f"{args.prefix}-sheet.png", optimize=True)

    duration = round(1000 / max(1, args.fps))
    frames[0].save(
        out_dir / f"{args.prefix}.gif",
        save_all=True,
        append_images=frames[1:],
        duration=duration,
        loop=0 if args.loop else 1,
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
    preview.convert("RGB").save(out_dir / f"{args.prefix}-contact-sheet.jpg", quality=92)

    metadata = {
        "name": args.key,
        "source": str(source_archive.relative_to(ROOT)),
        "sourceFormat": "TexturePacker JSON + PNG",
        "category": args.category,
        "frameWidth": args.frame_width,
        "frameHeight": args.frame_height,
        "frames": len(frames),
        "fps": args.fps,
        "loop": args.loop,
        "direction": "down",
        "anchorX": args.anchor_x,
        "anchorY": args.anchor_y,
        "scale": args.scale,
        "hitFrame": None if args.hit_frame < 0 else args.hit_frame,
        "usage": args.usage,
    }
    (out_dir / "metadata.json").write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8")


def main() -> None:
    args = parse_args()
    source = Path(args.source)
    source_archive = archive_source(source, args.source_name)
    raw_frames = read_texture_packer_frames(source_archive)
    frames = normalize_frames(raw_frames, args)
    write_outputs(frames, source_archive, args)
    print(f"已导入 {len(frames)} 帧：{ROOT / args.out}")


if __name__ == "__main__":
    main()
