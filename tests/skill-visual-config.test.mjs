import { access, readFile } from "node:fs/promises";

const skills = JSON.parse(await readFile("public/gamedata/s_skill.json", "utf8"));
const animations = JSON.parse(await readFile("public/gamedata/s_animation.json", "utf8"));
const assets = JSON.parse(await readFile("public/gamedata/s_asset.json", "utf8"));
const offensiveTypes = new Set(["projectile", "melee", "aoe", "dot"]);
const carrotSkillIds = new Set([211, 212, 213]);

for (const skill of skills) {
  if (offensiveTypes.has(skill.type)) {
    const expectedProjectile = carrotSkillIds.has(skill.id) ? "projectile_carrot_spin" : "projectile_tomato_spin";
    const expectedHit = carrotSkillIds.has(skill.id) ? "hit_carrot_split" : "hit_tomato_burst";
    if (skill.projectileAnimKey !== expectedProjectile) {
      throw new Error(`技能 ${skill.id} 的弹道动画应为 ${expectedProjectile}`);
    }
    if (skill.hitAnimKey !== expectedHit) {
      throw new Error(`技能 ${skill.id} 的命中特效应为 ${expectedHit}`);
    }
    if (carrotSkillIds.has(skill.id)) {
      if (skill.impactSpinTurns !== -2) throw new Error(`胡萝卜技能 ${skill.id} 应在命中后逆时针旋转 2 圈`);
      if (skill.impactSpinDuration !== 0.39) throw new Error(`胡萝卜技能 ${skill.id} 命中后旋转时间应为 0.39`);
    }
    if (!(skill.speed > 0)) throw new Error(`技能 ${skill.id} 的弹道速度必须大于 0`);
  } else if (skill.projectileAnimKey || skill.hitAnimKey) {
    throw new Error(`辅助技能 ${skill.id} 不应配置番茄攻击动画`);
  }
}

const expectedAnimations = [
  { key: "projectile_tomato_spin", loop: true, frames: 8, scale: 1 },
  { key: "projectile_carrot_spin", loop: true, frames: 8, scale: 1, fps: 22.4 },
  { key: "hit_tomato_burst", loop: false, frames: 8, scale: 0.6 },
  { key: "hit_carrot_split", loop: false, frames: 8, scale: 0.68 },
];
for (const expected of expectedAnimations) {
  const animation = animations.find((row) => row.key === expected.key);
  if (!animation) throw new Error(`缺少动画配置 ${expected.key}`);
  if (animation.loop !== expected.loop) throw new Error(`动画 ${expected.key} 的 loop 配置错误`);
  if (animation.frames.length !== expected.frames) throw new Error(`动画 ${expected.key} 应配置 ${expected.frames} 帧`);
  if (animation.scale !== expected.scale) throw new Error(`动画 ${expected.key} 的 scale 应为 ${expected.scale}`);
  if (expected.fps !== undefined && animation.fps !== expected.fps) throw new Error(`动画 ${expected.key} 的 fps 应为 ${expected.fps}`);
  for (const frameKey of animation.frames) {
    const asset = assets.find((row) => row.key === frameKey);
    if (!asset?.url) throw new Error(`动画帧 ${frameKey} 未在 s_asset.json 配置路径`);
    await access(`public${asset.url}`);
  }
}

const carrotProjectile = animations.find((row) => row.key === "projectile_carrot_spin");
const expectedCarrotFrameOrder = [
  "projectile_carrot_spin_00",
  "projectile_carrot_spin_07",
  "projectile_carrot_spin_06",
  "projectile_carrot_spin_05",
  "projectile_carrot_spin_04",
  "projectile_carrot_spin_03",
  "projectile_carrot_spin_02",
  "projectile_carrot_spin_01",
];
if (JSON.stringify(carrotProjectile?.frames) !== JSON.stringify(expectedCarrotFrameOrder)) {
  throw new Error("Carrot projectile frames must play in reverse order for counterclockwise flight");
}

console.log("skill-visual-config tests ok");
