import { readFile } from "node:fs/promises";

const monsters = JSON.parse(await readFile("public/gamedata/s_monster.json", "utf8"));
const animations = JSON.parse(await readFile("public/gamedata/s_animation.json", "utf8"));
const bossSkills = JSON.parse(await readFile("public/gamedata/s_boss_skill.json", "utf8"));

const boss = monsters.find((monster) => monster.id === 5);
const roar = bossSkills.find((skill) => skill.key === "steel_captain_roar");

if (!boss) throw new Error("缺少 Boss monsterId 5");
if (!roar) throw new Error("缺少 Boss 怒吼技能 steel_captain_roar");
if (boss.roarSkillKey !== roar.key) throw new Error("Boss roarSkillKey 必须引用 s_boss_skill 中的怒吼技能");
if (roar.monsterId !== boss.id) throw new Error("怒吼技能 monsterId 必须指向 Boss");
if (roar.trigger !== "afterSpawn") throw new Error("当前怒吼应配置为 Boss 出生后延迟触发");
if (roar.delay !== 5) throw new Error(`怒吼出生后延迟应为 5 秒，实际为 ${roar.delay}`);
if (roar.cd !== 40) throw new Error(`怒吼 CD 应为 40 秒，实际为 ${roar.cd}`);
if (roar.duration !== 8) throw new Error(`怒吼强化持续时间应为 8 秒，实际为 ${roar.duration}`);
if (roar.speedMul !== 1.35) throw new Error(`怒吼移速倍率应为 1.35，实际为 ${roar.speedMul}`);
if (roar.attackMul !== 1.25) throw new Error(`怒吼攻击倍率应为 1.25，实际为 ${roar.attackMul}`);
if (!(roar.attackSpeedMul > 0)) throw new Error(`怒吼攻速倍率必须大于 0，实际为 ${roar.attackSpeedMul}`);
if (roar.target !== "otherMonsters") throw new Error("怒吼目标应为其他怪物，不应强化 Boss 自己");
if (!animations.some((animation) => animation.key === roar.animKey)) {
  throw new Error(`怒吼技能引用了不存在的动画：${roar.animKey}`);
}

console.log("boss-skill-config tests ok");
