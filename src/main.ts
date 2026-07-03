import "./style.css";

import { registerNavigation } from "./core/navigation";
import { setScene } from "./core/runtime";
import { BagScene } from "./scenes/BagScene";
import { AnimationTestScene } from "./scenes/AnimationTestScene";
import { BattleScene } from "./scenes/BattleScene";
import { LevelLoadingScene } from "./scenes/LevelLoadingScene";
import { LoginScene } from "./scenes/LoginScene";
import { LoadingScene } from "./scenes/LoadingScene";
import { RunScene } from "./scenes/RunScene";
import { WndMain } from "./scenes/WndMain";

registerNavigation({
  showLogin: () => setScene(new LoginScene()),
  showMain: () => setScene(new WndMain()),
  showLevelLoading: (level, entryToast) => setScene(new LevelLoadingScene(level, entryToast)),
  showRun: (level, entryToast, initialState) => setScene(new RunScene(level, initialState, entryToast)),
  showBag: (level, entryToast, initialState) => setScene(new BagScene(level, initialState, entryToast)),
  showBattle: (level, bag) => setScene(new BattleScene(level, bag)),
});

const params = new URLSearchParams(window.location.search);

if (params.has("animtest")) {
  setScene(new AnimationTestScene());
} else {
  setScene(new LoadingScene());
}
