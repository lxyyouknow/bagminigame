import { Container, type DestroyOptions } from "pixi.js";
import type { Scene } from "../core/runtime";
import type { LifecycleReason } from "../services/LifecycleService";

export abstract class BaseScene implements Scene {
  container = new Container();
  protected disposed = false;

  update(_dt: number): void {}

  onAppPause?(_reason: LifecycleReason): void;

  onAppResume?(_reason: LifecycleReason): void;

  destroy(): void {
    this.disposed = true;
    this.container.destroy({ children: true } as DestroyOptions);
  }
}
