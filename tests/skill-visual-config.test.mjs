import { access, readFile } from "node:fs/promises";

const skills = JSON.parse(await readFile("public/gamedata/s_skill.json", "utf8"));
const animations = JSON.parse(await readFile("public/gamedata/s_animation.json", "utf8"));
const assets = JSON.parse(await readFile("public/gamedata/s_asset.json", "utf8"));
const offensiveTypes = new Set(["projectile", "melee", "aoe", "dot"]);
const carrotSkillIds = new Set([211, 212, 213]);
const wheatSkillIds = new Set([221, 222, 223]);

for (const skill of skills) {
  if (offensiveTypes.has(skill.type)) {
    const expectedProjectile = carrotSkillIds.has(skill.id)
      ? "projectile_carrot_spin"
      : wheatSkillIds.has(skill.id)
        ? "projectile_wheat_arrow"
        : "projectile_tomato_spin";
    const expectedHit = carrotSkillIds.has(skill.id)
      ? "hit_carrot_split"
      : wheatSkillIds.has(skill.id)
        ? "hit_wheat_stuck"
        : "hit_tomato_burst";
    if (skill.projectileAnimKey !== expectedProjectile) {
      throw new Error(`Skill ${skill.id} projectile animation should be ${expectedProjectile}`);
    }
    if (skill.hitAnimKey !== expectedHit) {
      throw new Error(`Skill ${skill.id} hit animation should be ${expectedHit}`);
    }
    if (carrotSkillIds.has(skill.id)) {
      if (skill.impactSpinTurns !== -2) throw new Error(`Carrot skill ${skill.id} should spin counterclockwise on impact`);
      if (skill.impactSpinDuration !== 0.39) throw new Error(`Carrot skill ${skill.id} impact spin duration should be 0.39`);
    }
    if (wheatSkillIds.has(skill.id)) {
      if (skill.projectileRotateToTarget !== true) throw new Error(`Wheat skill ${skill.id} must rotate projectile toward target`);
      if (skill.hitUseProjectileRotation !== true) throw new Error(`Wheat skill ${skill.id} must keep projectile angle on hit`);
    }
    if (!(skill.speed > 0)) throw new Error(`Skill ${skill.id} projectile speed must be greater than 0`);
  } else if (skill.projectileAnimKey || skill.hitAnimKey) {
    throw new Error(`Support skill ${skill.id} should not configure offensive visual animations`);
  }
}

const expectedAnimations = [
  { key: "projectile_tomato_spin", loop: true, frames: 8, scale: 1 },
  { key: "projectile_carrot_spin", loop: true, frames: 8, scale: 1, fps: 22.4 },
  { key: "projectile_wheat_arrow", loop: true, frames: 8, scale: 0.78, fps: 18 },
  { key: "hit_tomato_burst", loop: false, frames: 8, scale: 0.6 },
  { key: "hit_carrot_split", loop: false, frames: 8, scale: 0.68 },
  { key: "hit_wheat_stuck", loop: false, frames: 8, scale: 0.78 },
];
for (const expected of expectedAnimations) {
  const animation = animations.find((row) => row.key === expected.key);
  if (!animation) throw new Error(`Missing animation config ${expected.key}`);
  if (animation.loop !== expected.loop) throw new Error(`Animation ${expected.key} has wrong loop setting`);
  if (animation.frames.length !== expected.frames) throw new Error(`Animation ${expected.key} should have ${expected.frames} frames`);
  if (animation.scale !== expected.scale) throw new Error(`Animation ${expected.key} scale should be ${expected.scale}`);
  if (expected.fps !== undefined && animation.fps !== expected.fps) throw new Error(`Animation ${expected.key} fps should be ${expected.fps}`);
  for (const frameKey of animation.frames) {
    const asset = assets.find((row) => row.key === frameKey);
    if (!asset?.url) throw new Error(`Animation frame ${frameKey} is missing an asset path`);
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

const wheatHit = animations.find((row) => row.key === "hit_wheat_stuck");
if (wheatHit?.hitHoldFrame !== 7 || wheatHit?.hitHoldDuration !== 1 || wheatHit?.hitFadeDuration !== 0.35) {
  throw new Error("Wheat hit animation should wobble, hold for 1 second, then fade out");
}

console.log("skill-visual-config tests ok");
