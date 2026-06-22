from pathlib import Path
import json
import shutil

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public/game-assets/source/farm-guardian-attack-ai-magenta-sheet.png"
OUT_DIR = ROOT / "public/game-assets/characters/wizard_attack_up"
FRAME_DIR = OUT_DIR / "frames"
FRAME_SIZE = (160, 160)
FRAME_COUNT = 8
GRID_COLUMNS = 4
GRID_ROWS = 2


def remove_magenta_background(cell: Image.Image) -> Image.Image:
    """移除 AI sheet 的品红底和白色分隔线，并保留角色内部暖色。"""
    source = cell.convert("RGBA")
    cleaned_pixels = []
    for red, green, blue, alpha in source.getdata():
        is_white_gutter = red > 232 and green > 232 and blue > 232
        is_magenta = (
            red > 140
            and blue > 120
            and green < min(red, blue) * 0.65
        )
        if is_white_gutter or is_magenta:
            cleaned_pixels.append((0, 0, 0, 0))
        else:
            cleaned_pixels.append((red, green, blue, alpha))

    cleaned = Image.new("RGBA", source.size, (0, 0, 0, 0))
    cleaned.putdata(cleaned_pixels)
    box = cleaned.getchannel("A").getbbox()
    if not box:
        raise RuntimeError("切帧后没有检测到角色主体")
    return cleaned.crop(box)


def slice_source_sheet(sheet: Image.Image) -> list[Image.Image]:
    frames = []
    for row in range(GRID_ROWS):
        top = round(row * sheet.height / GRID_ROWS)
        bottom = round((row + 1) * sheet.height / GRID_ROWS)
        for column in range(GRID_COLUMNS):
            left = round(column * sheet.width / GRID_COLUMNS)
            right = round((column + 1) * sheet.width / GRID_COLUMNS)
            # AI sheet 的白色分隔线贴着网格边界，先内缩再去色可避免残线进入主体 bbox。
            inset = 6
            cell = sheet.crop((left + inset, top + inset, right - inset, bottom - inset))
            frames.append(remove_magenta_background(cell))

    if len(frames) != FRAME_COUNT:
        raise RuntimeError(f"应切出 {FRAME_COUNT} 帧，实际切出 {len(frames)} 帧")
    return frames


def clean_resized_edges(subject: Image.Image) -> Image.Image:
    """去掉缩放插值带回来的品红色，并轻收低透明外沿。"""
    cleaned_pixels = []
    for red, green, blue, alpha in subject.convert("RGBA").getdata():
        if alpha < 24:
            cleaned_pixels.append((0, 0, 0, 0))
            continue

        # 品红污染的特征是红、蓝都高于绿；只压低较小的一侧，保留原有暖色。
        if alpha < 250 and min(red, blue) - green > 8:
            if red <= blue:
                red = green + 8
            else:
                blue = green + 8

        contracted_alpha = min(255, round((alpha - 24) * 255 / 231))
        cleaned_pixels.append((red, green, blue, contracted_alpha))

    cleaned = Image.new("RGBA", subject.size, (0, 0, 0, 0))
    cleaned.putdata(cleaned_pixels)
    return cleaned


def normalize_frames(subjects: list[Image.Image]) -> list[Image.Image]:
    """所有帧使用同一缩放比例，保留蹲下、伸展和后坐的真实轮廓差异。"""
    max_width = max(subject.width for subject in subjects)
    max_height = max(subject.height for subject in subjects)
    scale = min(108 / max_width, 102 / max_height)

    frames = []
    for subject in subjects:
        width = max(1, round(subject.width * scale))
        height = max(1, round(subject.height * scale))
        resized = subject.resize((width, height), Image.Resampling.LANCZOS)
        resized = clean_resized_edges(resized)

        canvas = Image.new("RGBA", FRAME_SIZE, (0, 0, 0, 0))
        left = round((FRAME_SIZE[0] - width) / 2)
        top = 153 - height
        canvas.alpha_composite(resized, (left, top))
        frames.append(canvas)

    return frames


def write_outputs(frames: list[Image.Image]) -> None:
    if FRAME_DIR.exists():
        shutil.rmtree(FRAME_DIR)
    FRAME_DIR.mkdir(parents=True, exist_ok=True)

    for index, frame in enumerate(frames):
        frame.save(FRAME_DIR / f"wizard-attack-up-{index:02d}.png", optimize=True)

    sheet = Image.new("RGBA", (FRAME_SIZE[0] * FRAME_COUNT, FRAME_SIZE[1]), (0, 0, 0, 0))
    for index, frame in enumerate(frames):
        sheet.alpha_composite(frame, (index * FRAME_SIZE[0], 0))
    sheet.save(OUT_DIR / "wizard-attack-up-sheet.png", optimize=True)

    frames[0].save(
        OUT_DIR / "wizard-attack-up.gif",
        save_all=True,
        append_images=frames[1:],
        duration=83,
        loop=0,
        disposal=2,
        optimize=True,
    )

    metadata = {
        "name": "wizard_attack_up",
        "character": "farm_guardian",
        "source": str(SOURCE.relative_to(ROOT)),
        "sourceGrid": [GRID_COLUMNS, GRID_ROWS],
        "frameWidth": FRAME_SIZE[0],
        "frameHeight": FRAME_SIZE[1],
        "frames": FRAME_COUNT,
        "fps": 12,
        "direction": "up",
        "view": "top_down_from_bottom",
        "anchorX": 0.5,
        "anchorY": 0.78,
        "hitFrame": 4,
        "pipeline": "grid_4x2",
        "usage": "菜园小守卫下蹲蓄力、抬起种子发射杖发射，并在后坐后回到待机姿势",
    }
    (OUT_DIR / "metadata.json").write_text(
        json.dumps(metadata, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def main() -> None:
    if not SOURCE.exists():
        raise FileNotFoundError(f"找不到主角攻击 sprite sheet：{SOURCE}")
    subjects = slice_source_sheet(Image.open(SOURCE))
    frames = normalize_frames(subjects)
    write_outputs(frames)
    print(f"已生成菜园小守卫明显动作攻击动画：{OUT_DIR}")


if __name__ == "__main__":
    main()
