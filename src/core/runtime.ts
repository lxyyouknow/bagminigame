import { Application, type Container } from "pixi.js";
import { GameDataManager } from "../data/GameDataManager";
import { AdService } from "../services/AdService";
import { AnalyticsService } from "../services/AnalyticsService";
import { AssetManager } from "../services/AssetManager";
import { AudioManager } from "../services/AudioManager";
import { LifecycleService, type LifecycleReason } from "../services/LifecycleService";
import { SaveService } from "../services/SaveService";
import { createDefaultStorageAdapter } from "../services/StorageAdapter";
import { debugTrace } from "./debugTrace";

export const DESIGN_WIDTH = 720;
export const DESIGN_HEIGHT = 1440;

const root = document.querySelector<HTMLDivElement>("#game-root");

if (!root) {
  throw new Error("找不到 #game-root，无法启动游戏。");
}

export const app = new Application();

await app.init({
  background: "#172433",
  width: DESIGN_WIDTH,
  height: DESIGN_HEIGHT,
  antialias: true,
  resolution: Math.min(window.devicePixelRatio || 1, 2),
  autoDensity: true,
});

root.appendChild(app.canvas);
app.stage.eventMode = "static";
app.stage.hitArea = app.screen;

export const data = new GameDataManager();
export const ads = new AdService();
export const analytics = new AnalyticsService();
export const assetManager = new AssetManager(data);
export const audio = new AudioManager(data);
export const save = new SaveService(createDefaultStorageAdapter());
export const lifecycle = new LifecycleService({
  onPause: (reason) => handleAppPause(reason),
  onResume: (reason) => handleAppResume(reason),
});

let activeScene: Scene | undefined;
let uidSeed = 1;

export function nextUid(): number {
  return uidSeed++;
}

export interface Scene {
  container: Container;
  update(dt: number): void;
  onAppPause?(reason: LifecycleReason): void;
  onAppResume?(reason: LifecycleReason): void;
  destroy(): void;
}

export function setScene(scene: Scene): void {
  debugTrace("set_scene", { scene: scene.constructor.name });
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

function handleAppPause(reason: LifecycleReason): void {
  debugTrace("lifecycle_pause", { reason, scene: activeScene?.constructor.name });
  audio.pauseForLifecycle();
  activeScene?.onAppPause?.(reason);
}

function handleAppResume(reason: LifecycleReason): void {
  debugTrace("lifecycle_resume", { reason, scene: activeScene?.constructor.name });
  audio.resumeFromLifecycle();
  activeScene?.onAppResume?.(reason);
}
