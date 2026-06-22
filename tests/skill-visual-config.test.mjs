import { access, readFile } from "node:fs/promises";

const skills = JSON.parse(await readFile("public/gamedata/s_skill.json", "utf8"));
const animations = JSON.parse(await readFile("public/gamedata/s_animation.json", "utf8"));
const assets = JSON.parse(await readFile("public/gamedata/s_asset.json", "utf8"));
const offensiveTypes = new Set(["projectile", "melee", "aoe", "dot"]);

for (const skill of skills) {
  if (offensiveTypes.has(skill.type)) {
    if (skill.projectileAnimKey !== "projectile_tomato_spin") {
      throw new Error(`技能 ${skill.id} 未统一配置番茄旋转弹道`);
    }
    if (skill.hitAnimKey !== "hit_tomato_burst") {
      throw new Error(`技能 ${skill.id} 未统一配置番茄爆炸命中特效`);
    }
    if (!(skill.speed > 0)) throw new Error(`技能 ${skill.id} 的弹道速度必须大于 0`);
  } else if (skill.projectileAnimKey || skill.hitAnimKey) {
    throw new Error(`辅助技能 ${skill.id} 不应配置番茄攻击动画`);
  }
}

const expectedAnimations = [
  { key: "projectile_tomato_spin", loop: true, frames: 8, scale: 1 },
  { key: "hit_tomato_burst", loop: false, frames: 8, scale: 0.5 },
];
for (const expected of expectedAnimations) {
  const animation = animations.find((row) => row.key === expected.key);
  if (!animation) throw new Error(`缺少动画配置 ${expected.key}`);
  if (animation.loop !== expected.loop) throw new Error(`动画 ${expected.key} 的 loop 配置错误`);
  if (animation.frames.length !== expected.frames) throw new Error(`动画 ${expected.key} 应配置 ${expected.frames} 帧`);
  if (animation.scale !== expected.scale) throw new Error(`动画 ${expected.key} 的 scale 应为 ${expected.scale}`);
  for (const frameKey of animation.frames) {
    const asset = assets.find((row) => row.key === frameKey);
    if (!asset?.url) throw new Error(`动画帧 ${frameKey} 未在 s_asset.json 配置路径`);
    await access(`public${asset.url}`);
  }
}

console.log("skill-visual-config tests ok");
