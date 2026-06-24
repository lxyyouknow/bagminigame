import { access, readFile } from "node:fs/promises";

const monsters = JSON.parse(await readFile("public/gamedata/s_monster.json", "utf8"));
const animations = JSON.parse(await readFile("public/gamedata/s_animation.json", "utf8"));
const assets = JSON.parse(await readFile("public/gamedata/s_asset.json", "utf8"));
const yellowMonster = monsters.find((monster) => monster.id === 1);
const poisonBat = monsters.find((monster) => monster.id === 2);
const zombieWalk = animations.find((animation) => animation.key === "zombie_walk_down");
const zombieDeath = animations.find((animation) => animation.key === "zombie_death_down");
const poisonBatFly = animations.find((animation) => animation.key === "poison_bat_fly_down");
const poisonBatDeath = animations.find((animation) => animation.key === "poison_bat_death_down");

if (!yellowMonster) throw new Error("缺少黄色小怪配置：monsterId 1");
if (yellowMonster.name !== "小僵尸") {
  throw new Error(`黄色小怪应配置为小僵尸，实际为 ${yellowMonster.name}`);
}
if (yellowMonster.runAnimKey !== "zombie_walk_down") {
  throw new Error(`黄色小怪应绑定 zombie_walk_down，实际为 ${yellowMonster.runAnimKey ?? "未配置"}`);
}
if (yellowMonster.deathAnimKey !== "zombie_death_down") {
  throw new Error(`小僵尸应绑定 zombie_death_down 死亡动画，实际为 ${yellowMonster.deathAnimKey ?? "未配置"}`);
}
if (!zombieWalk) throw new Error("缺少小僵尸行走动画配置：zombie_walk_down");
if (zombieWalk.scale !== 0.5) {
  throw new Error(`小僵尸显示缩放应保持为 0.5，实际为 ${zombieWalk.scale}`);
}
if (!zombieDeath) throw new Error("缺少小僵尸死亡动画配置：zombie_death_down");
if (zombieDeath.loop !== false) throw new Error("小僵尸死亡动画不应循环");
if (zombieDeath.frames.length !== 19) {
  throw new Error(`小僵尸死亡动画应为 19 帧，实际为 ${zombieDeath.frames.length}`);
}
if (zombieDeath.scale !== zombieWalk.scale || zombieDeath.anchorY !== zombieWalk.anchorY) {
  throw new Error("小僵尸死亡动画应和行走动画保持相同 scale/anchorY，避免击杀瞬间跳动");
}
for (const frameKey of zombieDeath.frames) {
  const asset = assets.find((row) => row.key === frameKey);
  if (!asset?.url) throw new Error(`小僵尸死亡帧缺少资源配置：${frameKey}`);
  await access(`public${asset.url.split("?")[0]}`);
}

if (!poisonBat) throw new Error("缺少毒蝠配置：monsterId 2");
if (poisonBat.runAnimKey !== "poison_bat_fly_down") {
  throw new Error(`毒蝠应绑定 poison_bat_fly_down，实际为 ${poisonBat.runAnimKey ?? "未配置"}`);
}
if (poisonBat.deathAnimKey !== "poison_bat_death_down") {
  throw new Error(`毒蝠应绑定 poison_bat_death_down 死亡动画，实际为 ${poisonBat.deathAnimKey ?? "未配置"}`);
}
if (!poisonBatFly) throw new Error("缺少毒蝠飞行动画配置：poison_bat_fly_down");
if (!poisonBatDeath) throw new Error("缺少毒蝠死亡动画配置：poison_bat_death_down");
if (poisonBatDeath.loop !== false) throw new Error("毒蝠死亡动画不应循环");
if (poisonBatDeath.frames.length !== 17) {
  throw new Error(`毒蝠死亡动画应为 17 帧，实际为 ${poisonBatDeath.frames.length}`);
}
if (poisonBatDeath.scale !== poisonBatFly.scale || poisonBatDeath.anchorY !== poisonBatFly.anchorY) {
  throw new Error("毒蝠死亡动画应和飞行动画保持相同 scale/anchorY，避免击杀瞬间跳动");
}
for (const frameKey of poisonBatDeath.frames) {
  const asset = assets.find((row) => row.key === frameKey);
  if (!asset?.url) throw new Error(`毒蝠死亡帧缺少资源配置：${frameKey}`);
  await access(`public${asset.url.split("?")[0]}`);
}

console.log("monster-animation-config tests ok");
