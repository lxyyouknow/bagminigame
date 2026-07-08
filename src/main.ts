import "./style.css";

import { registerNavigation } from "./core/navigation";
import { setScene } from "./core/runtime";
import { debugTrace } from "./core/debugTrace";
import { BagScene } from "./scenes/BagScene";
import { AnimationTestScene } from "./scenes/AnimationTestScene";
import { BattleScene } from "./scenes/BattleScene";
import { LevelLoadingScene } from "./scenes/LevelLoadingScene";
import { LoginScene } from "./scenes/LoginScene";
import { LoadingScene } from "./scenes/LoadingScene";
import { RunScene } from "./scenes/RunScene";

registerNavigation({
  showLogin: () => setScene(new LoginScene()),
  showMain: () => setScene(new LoginScene()),
  showLevelLoading: (level, entryToast) => setScene(new LevelLoadingScene(level, entryToast)),
  showRun: (level, entryToast, initialState, restoredSession) => setScene(new RunScene(level, initialState, entryToast, restoredSession)),
  showBag: (level, entryToast, initialState) => setScene(new BagScene(level, initialState, entryToast)),
  showBattle: (level, bag) => setScene(new BattleScene(level, bag)),
});

debugTrace("app_boot", { href: window.location.href, userAgent: navigator.userAgent });
window.addEventListener("pagehide", () => debugTrace("page_hide", { href: window.location.href }));
window.addEventListener("beforeunload", () => debugTrace("before_unload", { href: window.location.href }));
window.addEventListener("error", (event) => {
  debugTrace("window_error", { message: event.message, filename: event.filename, lineno: event.lineno, colno: event.colno });
});
window.addEventListener("unhandledrejection", (event) => {
  const reason = event.reason instanceof Error ? event.reason.message : String(event.reason);
  debugTrace("window_unhandled_rejection", { reason });
});

const params = new URLSearchParams(window.location.search);

if (params.has("animtest")) {
  setScene(new AnimationTestScene());
} else {
  setScene(new LoadingScene());
}
