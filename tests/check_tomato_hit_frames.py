from pathlib import Path
from PIL import Image

frame_dir = Path("public/game-assets/effects/hit/tomato_burst/frames")
frames = sorted(frame_dir.glob("hit-tomato-burst-*.png"))
if len(frames) != 8:
    raise AssertionError(f"番茄爆炸应有 8 帧，实际 {len(frames)} 帧")

boxes = []
for frame in frames:
    image = Image.open(frame).convert("RGBA")
    if image.size != (256, 256):
        raise AssertionError(f"{frame.name} 尺寸应为 256x256，实际 {image.size}")
    box = image.getchannel("A").getbbox()
    if not box:
        raise AssertionError(f"{frame.name} 没有有效像素")
    boxes.append(box)

burst_width = boxes[3][2] - boxes[3][0]
tail_width = boxes[7][2] - boxes[7][0]
if burst_width < 180:
    raise AssertionError(f"最大爆发帧宽度过小，可能被等分切断：{burst_width}")
if tail_width >= burst_width * 0.6:
    raise AssertionError(f"尾帧过大，可能混入相邻爆炸半帧：burst={burst_width}, tail={tail_width}")

print("tomato-hit-frame slicing tests ok")
