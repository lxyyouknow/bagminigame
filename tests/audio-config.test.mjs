import { readFile } from "node:fs/promises";

const audioRows = JSON.parse(await readFile("public/gamedata/s_audio.json", "utf8"));
const eventRows = JSON.parse(await readFile("public/gamedata/s_audio_event.json", "utf8"));

const audioByKey = new Map(audioRows.map((row) => [row.key, row]));
const eventByKey = new Map(eventRows.map((row) => [row.event, row]));

for (const event of eventRows) {
  if (!audioByKey.has(event.audioKey)) {
    throw new Error(`音频事件 ${event.event} 引用了不存在的 audioKey：${event.audioKey}`);
  }
}

for (const key of ["bgm_main", "bgm_bag", "bgm_battle", "bgm_boss"]) {
  const row = audioByKey.get(key);
  if (!row) throw new Error(`缺少重要背景音乐配置：${key}`);
  if (row.type !== "music") throw new Error(`${key} 必须是 music 类型`);
  if (!row.url && row.generatedFreq !== 0) throw new Error(`${key} 未接正式音频时应保持静音占位，避免单频测试 BGM 刺耳`);
}

const requiredEvents = [
  "music_main",
  "music_bag",
  "music_battle",
  "music_boss",
  "ui_click",
  "bag_place",
  "bag_merge",
  "monster_zombie_attack",
  "monster_bat_attack",
  "monster_boss_attack",
  "monster_boss_roar",
];

for (const eventKey of requiredEvents) {
  const event = eventByKey.get(eventKey);
  if (!event) throw new Error(`缺少重要音频事件：${eventKey}`);
  const audio = audioByKey.get(event.audioKey);
  if (!audio) throw new Error(`音频事件 ${eventKey} 找不到资源：${event.audioKey}`);
  if (event.category !== audio.type) {
    throw new Error(`音频事件 ${eventKey} 的 category=${event.category} 与资源 type=${audio.type} 不一致`);
  }
}

console.log("audio-config tests ok");
