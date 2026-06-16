import "./style.css";

import { registerNavigation } from "./core/navigation";
import { setScene } from "./core/runtime";
import { BagScene } from "./scenes/BagScene";
import { BattleScene } from "./scenes/BattleScene";
import { LoadingScene } from "./scenes/LoadingScene";
import { WndMain } from "./scenes/WndMain";

registerNavigation({
  showMain: () => setScene(new WndMain()),
  showBag: (level, entryToast) => setScene(new BagScene(level, undefined, entryToast)),
  showBattle: (level, bag) => setScene(new BattleScene(level, bag)),
});

setScene(new LoadingScene());
