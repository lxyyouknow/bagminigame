export type LifecycleEventName = "visibilitychange" | "blur" | "focus" | "pagehide" | "pageshow";
export type LifecycleReason = LifecycleEventName | "manual";

export interface LifecycleEventTargetLike {
  addEventListener(name: LifecycleEventName, listener: () => void): void;
  removeEventListener(name: LifecycleEventName, listener: () => void): void;
}

type LifecycleServiceOptions = {
  target?: LifecycleEventTargetLike;
  isHidden?: () => boolean;
  onPause?: (reason: LifecycleReason) => void;
  onResume?: (reason: LifecycleReason) => void;
};

export class LifecycleService {
  private readonly target: LifecycleEventTargetLike;
  private readonly isHiddenFn: () => boolean;
  private readonly onPause: (reason: LifecycleReason) => void;
  private readonly onResume: (reason: LifecycleReason) => void;
  private readonly listeners: Array<[LifecycleEventName, () => void]> = [];
  private paused = false;
  private initialized = false;

  constructor(options: LifecycleServiceOptions = {}) {
    this.target = options.target ?? globalThis;
    this.isHiddenFn = options.isHidden ?? (() => Boolean(globalThis.document?.hidden));
    this.onPause = options.onPause ?? (() => {});
    this.onResume = options.onResume ?? (() => {});
  }

  init(): void {
    if (this.initialized) return;
    this.initialized = true;
    this.bind("visibilitychange", () => {
      if (this.isHiddenFn()) this.pause("visibilitychange");
      else this.resume("visibilitychange");
    });
    this.bind("blur", () => this.pause("blur"));
    this.bind("focus", () => {
      if (!this.isHiddenFn()) this.resume("focus");
    });
    this.bind("pagehide", () => this.pause("pagehide"));
    this.bind("pageshow", () => this.resume("pageshow"));
  }

  destroy(): void {
    for (const [name, listener] of this.listeners) {
      this.target.removeEventListener(name, listener);
    }
    this.listeners.length = 0;
    this.initialized = false;
  }

  isPaused(): boolean {
    return this.paused;
  }

  pause(reason: LifecycleReason = "manual"): void {
    if (this.paused) return;
    this.paused = true;
    this.onPause(reason);
  }

  resume(reason: LifecycleReason = "manual"): void {
    if (!this.paused) return;
    this.paused = false;
    this.onResume(reason);
  }

  private bind(name: LifecycleEventName, listener: () => void): void {
    this.target.addEventListener(name, listener);
    this.listeners.push([name, listener]);
  }
}
