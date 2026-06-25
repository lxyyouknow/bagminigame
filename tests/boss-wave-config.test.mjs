import { readFile } from "node:fs/promises";

const waves = JSON.parse(await readFile("public/gamedata/s_wave.json", "utf8"));
const wave3 = waves.filter((row) => row.waveGroupId === 101 && row.wave === 3);
const bossRows = wave3.filter((row) => row.monsterId === 5);

if (bossRows.length !== 1) throw new Error(`第 3 波应只有 1 行 Boss 配置，实际为 ${bossRows.length}`);

const bossTime = bossRows[0].time;
const beforeRows = wave3.filter((row) => row.monsterId !== 5 && row.time < bossTime);
const afterRows = wave3.filter((row) => row.monsterId !== 5 && row.time > bossTime);
const afterLastSpawnTime = Math.max(...afterRows.map((row) => row.time + (Math.max(0, row.count - 1) * row.interval)));

if (beforeRows.length < 2) throw new Error("第 3 波 Boss 出场前应至少有两组前锋怪");
if (afterRows.length < 2) throw new Error("第 3 波 Boss 出场后应至少有两组增援怪");
if (afterLastSpawnTime < bossTime + 6) {
  throw new Error(`Boss 出场后增援持续时间太短，最后刷怪时间 ${afterLastSpawnTime}，Boss 时间 ${bossTime}`);
}

console.log("boss-wave-config tests ok");
