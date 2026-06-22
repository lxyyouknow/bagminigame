from collections import deque
import json
from pathlib import Path

from PIL import Image, ImageChops


ROOT = Path(__file__).resolve().parents[1]
FRAME_DIR = ROOT / "public/game-assets/characters/wizard_attack_up/frames"
METADATA_PATH = ROOT / "public/game-assets/characters/wizard_attack_up/metadata.json"
EXPECTED_SIZE = (160, 160)
EXPECTED_COUNT = 8


def count_large_components(alpha: Image.Image, min_pixels: int = 80) -> int:
    """统计角色级连通块，小型独立光点不会被误判成第二个角色。"""
    width, height = alpha.size
    pixels = alpha.load()
    visited = set()
    large_components = 0

    for y in range(height):
        for x in range(width):
            if (x, y) in visited or pixels[x, y] <= 16:
                continue
            queue = deque([(x, y)])
            visited.add((x, y))
            size = 0
            while queue:
                px, py = queue.popleft()
                size += 1
                for nx, ny in ((px - 1, py), (px + 1, py), (px, py - 1), (px, py + 1)):
                    if not (0 <= nx < width and 0 <= ny < height):
                        continue
                    if (nx, ny) in visited or pixels[nx, ny] <= 16:
                        continue
                    visited.add((nx, ny))
                    queue.append((nx, ny))
            if size >= min_pixels:
                large_components += 1

    return large_components


def count_magenta_edge_pixels(frame: Image.Image) -> int:
    """统计与透明区相邻的品红污染像素，防止抠底颜色在缩放后形成毛边。"""
    pixels = frame.load()
    width, height = frame.size
    count = 0
    for y in range(1, height - 1):
        for x in range(1, width - 1):
            red, green, blue, alpha = pixels[x, y]
            if alpha <= 8:
                continue
            touches_transparent = any(
                pixels[nx, ny][3] <= 8
                for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1))
            )
            if touches_transparent and min(red, blue) - green > 12:
                count += 1
    return count


def main() -> None:
    metadata = json.loads(METADATA_PATH.read_text(encoding="utf-8"))
    assert metadata.get("character") == "farm_guardian", "当前动画还不是菜园小守卫资源"
    assert metadata.get("pipeline") == "grid_4x2", "攻击动画还没有切换到独立关键姿势帧"

    frames = sorted(FRAME_DIR.glob("wizard-attack-up-*.png"))
    assert len(frames) == EXPECTED_COUNT, f"应有 {EXPECTED_COUNT} 帧，实际 {len(frames)} 帧"

    for frame_path in frames:
        frame = Image.open(frame_path).convert("RGBA")
        assert frame.size == EXPECTED_SIZE, f"{frame_path.name} 尺寸错误：{frame.size}"

        alpha = frame.getchannel("A")
        assert alpha.getbbox(), f"{frame_path.name} 是空帧"
        assert count_large_components(alpha) == 1, f"{frame_path.name} 检测到两个角色级主体"

        border = Image.new("L", EXPECTED_SIZE, 0)
        border.paste(alpha.crop((0, 0, 3, 160)), (0, 0))
        border.paste(alpha.crop((157, 0, 160, 160)), (157, 0))
        assert border.getbbox() is None, f"{frame_path.name} 左右边缘有内容，存在串帧风险"
        magenta_edges = count_magenta_edge_pixels(frame)
        assert magenta_edges <= 30, f"{frame_path.name} 仍有 {magenta_edges} 个品红毛边像素"

    ready = Image.open(frames[0]).getchannel("A").point(lambda value: 255 if value > 200 else 0)
    fire = Image.open(frames[4]).getchannel("A").point(lambda value: 255 if value > 200 else 0)
    silhouette_delta = sum(value > 0 for value in ImageChops.difference(ready, fire).getdata())
    assert silhouette_delta >= 1600, f"攻击关键帧轮廓变化不足：{silhouette_delta} 像素"

    print("farm guardian frame QA ok")


if __name__ == "__main__":
    main()
