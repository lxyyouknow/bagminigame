import { AnimationPlaybackController } from "../src/scenes/animationPlaybackController.js";

function assertEqual(actual: unknown, expected: unknown, message: string): void {
  if (actual !== expected) throw new Error(`${message}，期望 ${String(expected)}，实际 ${String(actual)}`);
}

class FakeAnimation {
  children: FakeAnimation[] = [];
  destroyed = false;
  playCount = 0;
  stopCount = 0;

  constructor(public playing: boolean) {}

  play(): void {
    this.playing = true;
    this.playCount += 1;
  }

  stop(): void {
    this.playing = false;
    this.stopCount += 1;
  }
}

const running = new FakeAnimation(true);
const stopped = new FakeAnimation(false);
const nested = new FakeAnimation(true);
running.children.push(nested);

const controller = new AnimationPlaybackController();
controller.pause([running, stopped]);
assertEqual(running.playing, false, "暂停时应停止正在播放的根动画");
assertEqual(nested.playing, false, "暂停时应递归停止正在播放的子动画");
assertEqual(stopped.stopCount, 0, "暂停时不应重复停止原本未播放的动画");

controller.resume();
assertEqual(running.playing, true, "继续时应恢复根动画");
assertEqual(nested.playing, true, "继续时应恢复子动画");
assertEqual(stopped.playCount, 0, "继续时不应误启动原本未播放的动画");

controller.pause([running]);
running.destroyed = true;
controller.resume();
assertEqual(running.playCount, 1, "已销毁动画不应再次恢复");

console.log("animation-playback-controller tests ok");
