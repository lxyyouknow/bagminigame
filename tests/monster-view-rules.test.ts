import { shouldPreserveMonsterOverlayChild } from "../src/scenes/monsterViewRules.js";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const body = { name: "body" };
const hpTrack = { name: "hpTrack" };
const hpFill = { name: "hpFill" };

assert(!shouldPreserveMonsterOverlayChild(body, [hpTrack, hpFill]), "切换怪物动作时应替换本体动画");
assert(shouldPreserveMonsterOverlayChild(hpTrack, [hpTrack, hpFill]), "切换怪物动作时应保留 Boss 血条底板");
assert(shouldPreserveMonsterOverlayChild(hpFill, [hpTrack, hpFill]), "切换怪物动作时应保留 Boss 血条填充");

console.log("monster-view-rules tests ok");
