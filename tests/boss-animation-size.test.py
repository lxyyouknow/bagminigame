from pathlib import Path
from statistics import mean

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]


def frame_boxes(anim_key: str):
    frames = sorted((ROOT / "public" / "game-assets" / "enemies" / anim_key / "frames").glob("*.png"))
    boxes = []
    for frame in frames:
        image = Image.open(frame).convert("RGBA")
        box = image.getchannel("A").getbbox()
        if not box:
            raise AssertionError(f"{frame} 没有有效透明像素")
        boxes.append((frame.name, box, box[2] - box[0], box[3] - box[1]))
    return boxes


walk = frame_boxes("boss_walk_down")
attack = frame_boxes("boss_attack_down")
death = frame_boxes("boss_death_down")

walk_avg_h = mean(box[3] for box in walk)
attack_avg_h = mean(box[3] for box in attack)
death_intro_avg_h = mean(box[3] for box in death[:8])

min_ratio = 0.9
if attack_avg_h < walk_avg_h * min_ratio:
    raise AssertionError(
        f"Boss 攻击动画显示偏小：攻击平均高 {attack_avg_h:.1f}，行走平均高 {walk_avg_h:.1f}"
    )

if death_intro_avg_h < walk_avg_h * min_ratio:
    raise AssertionError(
        f"Boss 死亡动画前半段显示偏小：死亡前 8 帧平均高 {death_intro_avg_h:.1f}，行走平均高 {walk_avg_h:.1f}"
    )

print("boss-animation-size tests ok")
