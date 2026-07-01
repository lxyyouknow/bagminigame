import { Container, type DestroyOptions } from "pixi.js";

export abstract class GameWindow {
  readonly container = new Container();

  constructor() {
    this.container.eventMode = "static";
  }

  update(_dt: number): void {
  }

  destroy(): void {
    this.container.destroy({ children: true } as DestroyOptions);
  }
}
