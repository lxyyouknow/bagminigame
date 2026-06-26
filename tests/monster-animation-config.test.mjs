import { access, readFile } from "node:fs/promises";

const monsters = JSON.parse(await readFile("public/gamedata/s_monster.json", "utf8"));
const animations = JSON.parse(await readFile("public/gamedata/s_animation.json", "utf8"));
const assets = JSON.parse(await readFile("public/gamedata/s_asset.json", "utf8"));
const yellowMonster = monsters.find((monster) => monster.id === 1);
const poisonBat = monsters.find((monster) => monster.id === 2);
const boss = monsters.find((monster) => monster.id === 5);
const zombieWalk = animations.find((animation) => animation.key === "zombie_walk_down");
const zombieAttack = animations.find((animation) => animation.key === "zombie_attack_down");
const zombieDeath = animations.find((animation) => animation.key === "zombie_death_down");
const poisonBatFly = animations.find((animation) => animation.key === "poison_bat_fly_down");
const poisonBatAttack = animations.find((animation) => animation.key === "poison_bat_attack_down");
const poisonBatDeath = animations.find((animation) => animation.key === "poison_bat_death_down");
const bossWalk = animations.find((animation) => animation.key === "boss_walk_down");
const bossAttack = animations.find((animation) => animation.key === "boss_attack_down");
const bossRoar = animations.find((animation) => animation.key === "boss_roar_down");
const bossDeath = animations.find((animation) => animation.key === "boss_death_down");

if (!yellowMonster) throw new Error("缺少黄色小怪配置：monsterId 1");
if (yellowMonster.name !== "小僵尸") {
  throw new Error(`黄色小怪应配置为小僵尸，实际为 ${yellowMonster.name}`);
}
if (yellowMonster.runAnimKey !== "zombie_walk_down") {
  throw new Error(`黄色小怪应绑定 zombie_walk_down，实际为 ${yellowMonster.runAnimKey ?? "未配置"}`);
}
if (yellowMonster.attackAnimKey !== "zombie_attack_down") {
  throw new Error(`小僵尸应绑定 zombie_attack_down 攻击动画，实际为 ${yellowMonster.attackAnimKey ?? "未配置"}`);
}
if ((yellowMonster.attackDistance ?? 0) !== 0) {
  throw new Error(`小僵尸应贴近栏杆攻击，attackDistance 应为 0，实际为 ${yellowMonster.attackDistance ?? "未配置"}`);
}
if (yellowMonster.deathAnimKey !== "zombie_death_down") {
  throw new Error(`小僵尸应绑定 zombie_death_down 死亡动画，实际为 ${yellowMonster.deathAnimKey ?? "未配置"}`);
}
if (!zombieWalk) throw new Error("缺少小僵尸行走动画配置：zombie_walk_down");
if (zombieWalk.scale !== 0.58) {
  throw new Error(`小僵尸显示缩放应为 0.58，实际为 ${zombieWalk.scale}`);
}
if (!zombieAttack) throw new Error("缺少小僵尸攻击动画配置：zombie_attack_down");
if (zombieAttack.loop !== false) throw new Error("小僵尸攻击动画不应循环");
if (zombieAttack.frames.length !== 13) {
  throw new Error(`小僵尸攻击动画应为 13 帧，实际为 ${zombieAttack.frames.length}`);
}
if (zombieAttack.hitFrame !== 6) {
  throw new Error(`小僵尸攻击动画 hitFrame 应为 6，实际为 ${zombieAttack.hitFrame ?? "未配置"}`);
}
if (zombieAttack.scale !== zombieWalk.scale || zombieAttack.anchorY !== zombieWalk.anchorY) {
  throw new Error("小僵尸攻击动画应和行走动画保持相同 scale/anchorY，避免贴脸攻击瞬间跳动");
}
for (const frameKey of zombieAttack.frames) {
  const asset = assets.find((row) => row.key === frameKey);
  if (!asset?.url) throw new Error(`小僵尸攻击帧缺少资源配置：${frameKey}`);
  await access(`public${asset.url.split("?")[0]}`);
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
if (poisonBat.attackAnimKey !== "poison_bat_attack_down") {
  throw new Error(`毒蝠应绑定 poison_bat_attack_down 攻击动画，实际为 ${poisonBat.attackAnimKey ?? "未配置"}`);
}
if (poisonBat.attackDistance !== 150) {
  throw new Error(`毒蝠放大后应使用 150 攻击距离校准喷射落点，实际为 ${poisonBat.attackDistance ?? "未配置"}`);
}
if (poisonBat.deathAnimKey !== "poison_bat_death_down") {
  throw new Error(`毒蝠应绑定 poison_bat_death_down 死亡动画，实际为 ${poisonBat.deathAnimKey ?? "未配置"}`);
}
if (!poisonBatFly) throw new Error("缺少毒蝠飞行动画配置：poison_bat_fly_down");
if (poisonBatFly.scale !== 0.65) {
  throw new Error(`毒蝠显示缩放应为 0.65，实际为 ${poisonBatFly.scale}`);
}
if (!poisonBatAttack) throw new Error("缺少毒蝠攻击动画配置：poison_bat_attack_down");
if (poisonBatAttack.loop !== false) throw new Error("毒蝠攻击动画不应循环");
if (poisonBatAttack.frames.length !== 43) {
  throw new Error(`毒蝠攻击动画应为 43 帧，实际为 ${poisonBatAttack.frames.length}`);
}
if (poisonBatAttack.hitFrame !== 22) {
  throw new Error(`毒蝠攻击动画 hitFrame 应为 22，实际为 ${poisonBatAttack.hitFrame ?? "未配置"}`);
}
if (poisonBatAttack.scale !== poisonBatFly.scale) {
  throw new Error("毒蝠攻击动画应和飞行动画保持相同 scale，避免切动作时本体变大或变小");
}
if (poisonBatAttack.anchorY !== 0.31) {
  throw new Error(`毒蝠攻击动画应使用 0.31 锚点以保留向下攻击延展，实际为 ${poisonBatAttack.anchorY}`);
}
for (const frameKey of poisonBatAttack.frames) {
  const asset = assets.find((row) => row.key === frameKey);
  if (!asset?.url) throw new Error(`毒蝠攻击帧缺少资源配置：${frameKey}`);
  await access(`public${asset.url.split("?")[0]}`);
}
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

if (!boss) throw new Error("缺少 Boss 配置：monsterId 5");
if (boss.runAnimKey !== "boss_walk_down") {
  throw new Error(`Boss 应绑定 boss_walk_down 行走动画，实际为 ${boss.runAnimKey ?? "未配置"}`);
}
if (boss.attackAnimKey !== "boss_attack_down") {
  throw new Error(`Boss 应绑定 boss_attack_down 攻击动画，实际为 ${boss.attackAnimKey ?? "未配置"}`);
}
if ((boss.attackDistance ?? 0) !== 0) {
  throw new Error(`Boss 当前应保持近战攻击栏杆，attackDistance 应为 0，实际为 ${boss.attackDistance ?? "未配置"}`);
}
if (boss.roarSkillKey !== "steel_captain_roar") {
  throw new Error(`Boss 应绑定 steel_captain_roar 怒吼技能，实际为 ${boss.roarSkillKey ?? "未配置"}`);
}
if (boss.deathAnimKey !== "boss_death_down") {
  throw new Error(`Boss 应绑定 boss_death_down 死亡动画，实际为 ${boss.deathAnimKey ?? "未配置"}`);
}
if (!bossWalk) throw new Error("缺少 Boss 行走动画配置：boss_walk_down");
if (bossWalk.scale !== 1) throw new Error(`Boss 显示缩放应为 1，实际为 ${bossWalk.scale}`);
if (!bossAttack) throw new Error("缺少 Boss 攻击动画配置：boss_attack_down");
if (!bossRoar) throw new Error("缺少 Boss 怒吼动画配置：boss_roar_down");
if (!bossDeath) throw new Error("缺少 Boss 死亡动画配置：boss_death_down");
if (bossWalk.frames.length !== 18) throw new Error(`Boss 行走动画应为 18 帧，实际为 ${bossWalk.frames.length}`);
if (bossAttack.frames.length !== 19) throw new Error(`Boss 攻击动画应为 19 帧，实际为 ${bossAttack.frames.length}`);
if (bossRoar.frames.length !== 19) throw new Error(`Boss 怒吼动画应为 19 帧，实际为 ${bossRoar.frames.length}`);
if (bossDeath.frames.length !== 22) throw new Error(`Boss 死亡动画应为 22 帧，实际为 ${bossDeath.frames.length}`);
if (bossAttack.loop !== false || bossRoar.loop !== false || bossDeath.loop !== false) throw new Error("Boss 攻击、怒吼和死亡动画不应循环");
if (bossAttack.hitFrame !== 15) throw new Error(`Boss 攻击动画 hitFrame 应为 15，实际为 ${bossAttack.hitFrame ?? "未配置"}`);
if (bossAttack.damageFrame !== 15) throw new Error(`Boss 攻击动画 damageFrame 应为第 15 帧，实际为 ${bossAttack.damageFrame ?? "未配置"}`);
if (bossAttack.shakeFrame !== 15) throw new Error(`Boss 攻击动画 shakeFrame 应为第 15 帧，实际为 ${bossAttack.shakeFrame ?? "未配置"}`);
if (
  bossAttack.scale !== bossWalk.scale ||
  bossAttack.anchorY !== bossWalk.anchorY ||
  bossRoar.scale !== bossWalk.scale ||
  bossRoar.anchorY !== bossWalk.anchorY ||
  bossDeath.scale !== bossWalk.scale ||
  bossDeath.anchorY !== bossWalk.anchorY
) {
  throw new Error("Boss 四个动作应保持相同 scale/anchorY，避免切动作时跳位");
}
for (const animation of [bossWalk, bossAttack, bossRoar, bossDeath]) {
  for (const frameKey of animation.frames) {
    const asset = assets.find((row) => row.key === frameKey);
    if (!asset?.url) throw new Error(`Boss 动画帧缺少资源配置：${frameKey}`);
    await access(`public${asset.url.split("?")[0]}`);
  }
}

console.log("monster-animation-config tests ok");
