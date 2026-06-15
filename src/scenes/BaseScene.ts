import { Container, type DestroyOptions } from "pixi.js";
import type { Scene } from "../core/runtime";

export abstract class BaseScene implements Scene {
  container = new Container();
  protected disposed = false;

  update(_dt: number): void {}

  destroy(): void {
    this.disposed = true;
    this.container.destroy({ children: true } as DestroyOptions);
  }
}
