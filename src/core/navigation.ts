import type { BagState, LevelDef } from "../types";
import type { RunSessionState } from "../scenes/runSessionState";
import { debugTrace } from "./debugTrace";

type NavigationHandlers = {
  showLogin: () => void;
  showMain: () => void;
  showLevelLoading: (level: LevelDef, entryToast?: string) => void;
  showRun: (level: LevelDef, entryToast?: string, initialState?: BagState, restoredSession?: RunSessionState) => void;
  showBag: (level: LevelDef, entryToast?: string, initialState?: BagState) => void;
  showBattle: (level: LevelDef, bag: BagState) => void;
};

const handlers: NavigationHandlers = {
  showLogin: () => { throw new Error("导航未初始化：showLogin"); },
  showMain: () => { throw new Error("导航未初始化：showMain"); },
  showLevelLoading: () => { throw new Error("导航未初始化：showLevelLoading"); },
  showRun: () => { throw new Error("导航未初始化：showRun"); },
  showBag: () => { throw new Error("导航未初始化：showBag"); },
  showBattle: () => { throw new Error("导航未初始化：showBattle"); },
};

export function registerNavigation(nextHandlers: NavigationHandlers): void {
  Object.assign(handlers, nextHandlers);
}

export function showLogin(): void {
  handlers.showLogin();
}

export function showMain(): void {
  debugTrace("navigation_show_main", {}, true);
  handlers.showMain();
}

export function showLevelLoading(level: LevelDef, entryToast?: string): void {
  handlers.showLevelLoading(level, entryToast);
}

export function showRun(level: LevelDef, entryToast?: string, initialState?: BagState, restoredSession?: RunSessionState): void {
  handlers.showRun(level, entryToast, initialState, restoredSession);
}

export function showBag(level: LevelDef, entryToast?: string, initialState?: BagState): void {
  handlers.showBag(level, entryToast, initialState);
}

export function showBattle(level: LevelDef, bag: BagState): void {
  handlers.showBattle(level, bag);
}
