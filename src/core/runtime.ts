import { Application } from "pixi.js";
import { GameDataManager } from "../data/GameDataManager";
import { AdService } from "../services/AdService";
import { AssetManager } from "../services/AssetManager";
import { AudioManager } from "../services/AudioManager";

const root = document.querySelector<HTMLDivElement>("#game-root");

if (!root) {
  throw new Error("找不到 #game-root，无法启动游戏。");
}

export const app = new Application();

await app.init({
  background: "#172433",
  resizeTo: window,
  antialias: true,
  resolution: Math.min(window.devicePixelRatio || 1, 2),
  autoDensity: true,
});

root.appendChild(app.canvas);
app.stage.eventMode = "static";
app.stage.hitArea = app.screen;

export const data = new GameDataManager();
export const ads = new AdService();
export const assetManager = new AssetManager(data);
export const audio = new AudioManager(data);

let activeScene: Scene | undefined;
let uidSeed = 1;

export function nextUid(): number {
  return uidSeed++;
}

export interface Scene {
  container: Container;
  update(dt: number): void;
  destroy(): void;
}

export function setScene(scene: Scene): void {
  if (activeScene) {
    app.stage.removeChild(activeScene.container);
    activeScene.destroy();
  }
  activeScene = scene;
  app.stage.addChild(scene.container);
}

app.ticker.add((ticker) => {
  activeScene?.update(Math.min(ticker.deltaMS / 1000, 0.05));
});
