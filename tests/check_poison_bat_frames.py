from __future__ import annotations

from pathlib import Path
import json

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
FRAME_DIR = ROOT / "public" / "game-assets" / "enemies" / "poison_bat_fly_down" / "frames"
ASSET_TABLE = ROOT / "public" / "gamedata" / "s_asset.json"
ANIMATION_TABLE = ROOT / "public" / "gamedata" / "s_animation.json"
MONSTER_TABLE = ROOT / "public" / "gamedata" / "s_monster.json"
METADATA_PATH = ROOT / "public" / "game-assets" / "enemies" / "poison_bat_fly_down" / "metadata.json"


def fail(message: str) -> None:
    raise SystemExit(message)


metadata = json.loads(METADATA_PATH.read_text(encoding="utf-8"))
expected_frames = int(metadata["frames"])
if expected_frames < 8:
    fail(f"毒蝠飞行动画帧数过少：{expected_frames}")

monsters = json.loads(MONSTER_TABLE.read_text(encoding="utf-8"))
poison_bat = next((row for row in monsters if row.get("id") == 2), None)
if not poison_bat:
    fail("缺少 monsterId=2 毒蝠配置")
if poison_bat.get("runAnimKey") != "poison_bat_fly_down":
    fail(f"毒蝠应绑定 poison_bat_fly_down，实际 {poison_bat.get('runAnimKey')}")

animations = json.loads(ANIMATION_TABLE.read_text(encoding="utf-8"))
animation = next((row for row in animations if row.get("key") == "poison_bat_fly_down"), None)
if not animation:
    fail("缺少 poison_bat_fly_down 动画配置")
if len(animation.get("frames", [])) != expected_frames:
    fail(f"动画表帧数应为 {expected_frames}，实际 {len(animation.get('frames', []))}")

assets = {row["key"]: row for row in json.loads(ASSET_TABLE.read_text(encoding="utf-8"))}
for index, frame_key in enumerate(animation["frames"]):
    asset = assets.get(frame_key)
    if not asset:
        fail(f"s_asset 缺少帧 key：{frame_key}")
    if "poison-bat-1" not in asset.get("url", ""):
        fail(f"{frame_key} 缺少缓存版本号 poison-bat-1")

    frame_path = FRAME_DIR / f"poison-bat-fly-down-{index:02d}.png"
    if not frame_path.exists():
        fail(f"缺少运行时帧：{frame_path}")
    image = Image.open(frame_path).convert("RGBA")
    if image.size != (256, 256):
        fail(f"{frame_path.name} 尺寸应为 256x256，实际 {image.size}")
    box = image.getchannel("A").getbbox()
    if not box:
        fail(f"{frame_path.name} 没有透明主体")
    left, top, right, bottom = box
    if left <= 1 or right >= 255 or top <= 1 or bottom >= 255:
        fail(f"{frame_path.name} 边界过近，可能被裁切")

print("poison bat frame QA ok")
