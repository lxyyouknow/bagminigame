import "./style.css";

import { registerNavigation } from "./core/navigation";
import { setScene } from "./core/runtime";
import { BagScene } from "./scenes/BagScene";
import { AnimationTestScene } from "./scenes/AnimationTestScene";
import { BattleScene } from "./scenes/BattleScene";
import { LoadingScene } from "./scenes/LoadingScene";
import { WndMain } from "./scenes/WndMain";

registerNavigation({
  showMain: () => setScene(new WndMain()),
  showBag: (level, entryToast, initialState) => setScene(new BagScene(level, initialState, entryToast)),
  showBattle: (level, bag) => setScene(new BattleScene(level, bag)),
});

const params = new URLSearchParams(window.location.search);

if (params.has("animtest")) {
  setScene(new AnimationTestScene());
} else {
  setScene(new LoadingScene());
}
