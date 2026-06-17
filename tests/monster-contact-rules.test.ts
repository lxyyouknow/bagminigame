import { stepMonsterContact } from "../src/scenes/monsterContactRules.js";

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}，期望 ${String(expected)}，实际 ${String(actual)}`);
  }
}

function run(): void {
  const first = stepMonsterContact({
    y: 90,
    speed: 50,
    slowTimer: 0,
    attackCooldown: 0,
    dt: 1,
    contactY: 100,
    attack: 20,
    attackInterval: 2,
    armor: 4,
    armorBonus: 0,
  });
  assertEqual(first.y, 100, "怪物到达接触线后应停住，不应穿过炮台");
  assertEqual(first.damage, 18.2, "首次抵达且冷却为 0 时应立刻造成一次伤害");
  assertEqual(first.attackCooldown, 2, "攻击后应重置攻击冷却");

  const second = stepMonsterContact({ ...first, dt: 1, contactY: 100, attack: 20, attackInterval: 2, armor: 4, armorBonus: 0, speed: 50, slowTimer: 0 });
  assertEqual(second.y, 100, "攻击冷却期间怪物仍应抵在接触线");
  assertEqual(second.damage, 0, "攻击冷却未结束时不应每帧扣血");
  assertEqual(second.attackCooldown, 1, "攻击冷却应随时间递减");

  const third = stepMonsterContact({ ...second, dt: 1, contactY: 100, attack: 20, attackInterval: 2, armor: 4, armorBonus: 0, speed: 50, slowTimer: 0 });
  assertEqual(third.damage, 18.2, "攻击冷却归零后应再次扣血");
}

run();
console.log("monster-contact-rules tests ok");
