import type { SkillDef } from "../src/types.js";
import { isOffensiveSkill, shouldUseVisualProjectile, usesAreaImpact } from "../src/scenes/skillVisualRules.js";

function assertEqual(actual: unknown, expected: unknown, message: string): void {
  if (actual !== expected) throw new Error(`${message}，期望 ${String(expected)}，实际 ${String(actual)}`);
}

function skill(type: SkillDef["type"], visual = true): SkillDef {
  return {
    id: 1,
    name: "测试技能",
    type,
    attack: 10,
    cd: 1,
    range: 500,
    speed: 720,
    radius: 30,
    targetRule: "nearest",
    effectId: 0,
    color: "#ff0000",
    projectileAnimKey: visual ? "projectile_tomato_spin" : "",
    hitAnimKey: visual ? "hit_tomato_burst" : "",
  };
}

for (const type of ["projectile", "melee", "aoe", "dot"] as const) {
  const current = skill(type);
  assertEqual(isOffensiveSkill(current), true, `${type} 应属于进攻型技能`);
  assertEqual(shouldUseVisualProjectile(current), true, `${type} 配置动画后应使用视觉弹道`);
}

assertEqual(usesAreaImpact(skill("projectile")), false, "普通投射物命中应只伤害目标");
assertEqual(usesAreaImpact(skill("melee")), true, "近战临时番茄命中后应结算原范围伤害");
assertEqual(usesAreaImpact(skill("aoe")), true, "AOE 番茄命中后应结算范围伤害");
assertEqual(usesAreaImpact(skill("dot")), true, "DOT 番茄命中后应结算范围效果");
assertEqual(shouldUseVisualProjectile(skill("shield")), false, "护盾技能不应发射番茄");
assertEqual(shouldUseVisualProjectile(skill("heal")), false, "治疗技能不应发射番茄");
assertEqual(shouldUseVisualProjectile(skill("projectile", false)), false, "未配置弹道动画时应保留原表现回退");

console.log("skill-visual-rules tests ok");
