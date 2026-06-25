import type { BossSkillDef } from "../src/types.js";
import { applyBossRoarBuff, stepBossRoarCooldown } from "../src/scenes/bossSkillRules.js";

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) throw new Error(`${message}，期望 ${String(expected)}，实际 ${String(actual)}`);
}

const roar: BossSkillDef = {
  key: "steel_captain_roar",
  monsterId: 5,
  trigger: "afterSpawn",
  animKey: "boss_roar_down",
  cd: 40,
  delay: 5,
  duration: 8,
  speedMul: 1.35,
  attackMul: 1.25,
  target: "otherMonsters",
  desc: "Boss 被攻击后怒吼，强化其他怪物",
};

const tooEarly = stepBossRoarCooldown({ skill: roar, cooldown: 0, dt: 0.2, bossWasHit: false, spawnAge: 4.9, targetCount: 3 });
assertEqual(tooEarly.shouldCast, false, "Boss 出生不到 5 秒不应怒吼");
assertEqual(tooEarly.cooldown, 0, "Boss 出生不到 5 秒不应进入怒吼 CD");

const charging = stepBossRoarCooldown({ skill: roar, cooldown: 12, dt: 1, bossWasHit: false, spawnAge: 5.2, targetCount: 3 });
assertEqual(charging.shouldCast, false, "怒吼冷却中被打不应触发");
assertEqual(charging.cooldown, 11, "怒吼冷却应随时间递减");

const ready = stepBossRoarCooldown({ skill: roar, cooldown: 0, dt: 0.2, bossWasHit: false, spawnAge: 5, targetCount: 3 });
assertEqual(ready.shouldCast, true, "Boss 出生 5 秒后且有其他怪物时应触发怒吼");
assertEqual(ready.cooldown, 40, "怒吼触发后应重置 CD");

const noTargets = stepBossRoarCooldown({ skill: roar, cooldown: 0, dt: 0.2, bossWasHit: false, spawnAge: 5, targetCount: 0 });
assertEqual(noTargets.shouldCast, false, "怒吼没有其他怪物可强化时不应空放");
assertEqual(noTargets.cooldown, 0, "怒吼没有目标时不应消耗 CD");

const withTargets = stepBossRoarCooldown({ skill: roar, cooldown: 0, dt: 0.2, bossWasHit: false, spawnAge: 6, targetCount: 3 });
assertEqual(withTargets.shouldCast, true, "怒吼有其他怪物可强化时才应触发");
assertEqual(withTargets.cooldown, 40, "怒吼有目标触发后应进入 CD");

const buff = applyBossRoarBuff(1, 1, 1, roar);
assertEqual(buff.speedMul, 1.35, "怒吼应按表提高其他怪物移动速度");
assertEqual(buff.attackMul, 1.25, "怒吼应按表提高其他怪物攻击力");
assertEqual(buff.attackSpeedMul, 1, "怒吼未配置攻速倍率时，不应额外改变攻击动画速度");

const speedBuff = applyBossRoarBuff(1, 1, 1, { ...roar, attackSpeedMul: 1.4 });
assertEqual(speedBuff.attackSpeedMul, 1.4, "怒吼配置攻速倍率时，应同步提高攻击频率和攻击动画速度");

console.log("boss-skill-rules tests ok");
