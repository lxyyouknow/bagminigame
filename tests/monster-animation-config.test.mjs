import { readFile } from "node:fs/promises";

const monsters = JSON.parse(await readFile("public/gamedata/s_monster.json", "utf8"));
const animations = JSON.parse(await readFile("public/gamedata/s_animation.json", "utf8"));
const yellowMonster = monsters.find((monster) => monster.id === 1);
const zombieWalk = animations.find((animation) => animation.key === "zombie_walk_down");

if (!yellowMonster) throw new Error("缺少黄色小怪配置：monsterId 1");
if (yellowMonster.name !== "小僵尸") {
  throw new Error(`黄色小怪应配置为小僵尸，实际为 ${yellowMonster.name}`);
}
if (yellowMonster.runAnimKey !== "zombie_walk_down") {
  throw new Error(`黄色小怪应绑定 zombie_walk_down，实际为 ${yellowMonster.runAnimKey ?? "未配置"}`);
}
if (!zombieWalk) throw new Error("缺少小僵尸行走动画配置：zombie_walk_down");
if (zombieWalk.scale !== 0.5) {
  throw new Error(`小僵尸显示缩放应保持为 0.5，实际为 ${zombieWalk.scale}`);
}

console.log("monster-animation-config tests ok");
