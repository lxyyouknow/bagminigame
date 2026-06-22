import type { SkillDef } from "../types.js";

export function isOffensiveSkill(skill: SkillDef): boolean {
  return skill.type !== "shield" && skill.type !== "heal";
}

export function shouldUseVisualProjectile(skill: SkillDef): boolean {
  return isOffensiveSkill(skill) && Boolean(skill.projectileAnimKey);
}

export function usesAreaImpact(skill: SkillDef): boolean {
  return skill.type !== "projectile";
}
