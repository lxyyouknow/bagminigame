import { LifecycleService, type LifecycleEventName, type LifecycleEventTargetLike } from "../src/services/LifecycleService.js";

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}，期望 ${String(expected)}，实际 ${String(actual)}`);
  }
}

class FakeTarget implements LifecycleEventTargetLike {
  hidden = false;
  private listeners = new Map<LifecycleEventName, Array<() => void>>();

  addEventListener(name: LifecycleEventName, listener: () => void): void {
    this.listeners.set(name, [...(this.listeners.get(name) ?? []), listener]);
  }

  removeEventListener(name: LifecycleEventName, listener: () => void): void {
    this.listeners.set(name, (this.listeners.get(name) ?? []).filter((item) => item !== listener));
  }

  emit(name: LifecycleEventName): void {
    for (const listener of this.listeners.get(name) ?? []) listener();
  }
}

function run(): void {
  const target = new FakeTarget();
  const events: string[] = [];
  const lifecycle = new LifecycleService({
    target,
    isHidden: () => target.hidden,
    onPause: (reason) => events.push(`pause:${reason}`),
    onResume: (reason) => events.push(`resume:${reason}`),
  });

  lifecycle.init();
  target.hidden = true;
  target.emit("visibilitychange");
  target.emit("blur");
  assertEqual(events.join(","), "pause:visibilitychange", "隐藏后应只暂停一次");
  assert(lifecycle.isPaused(), "隐藏后生命周期应处于暂停态");

  target.hidden = false;
  target.emit("visibilitychange");
  target.emit("focus");
  assertEqual(events.join(","), "pause:visibilitychange,resume:visibilitychange", "显示后应只恢复一次");
  assert(!lifecycle.isPaused(), "显示后生命周期应恢复");

  target.emit("pagehide");
  target.emit("pageshow");
  assertEqual(events.join(","), "pause:visibilitychange,resume:visibilitychange,pause:pagehide,resume:pageshow", "pagehide/pageshow 应分发暂停恢复");

  lifecycle.destroy();
  target.hidden = true;
  target.emit("visibilitychange");
  assertEqual(events.length, 4, "destroy 后不应继续响应事件");
}

run();
console.log("lifecycle-service tests ok");
