# 背包合成防守 Demo 音频配置和上线规范

本文档给后续音频向 agent、策划、技术美术使用。目标是让背景音乐、Boss 音乐、按钮音效、背包音效、战斗音效、结算音效都通过数据表配置，并适合上线小游戏的性能和浏览器限制。

## 当前音频目标

本项目是 H5 / 小游戏广告 demo，音频设计优先级：

1. 不影响性能和首屏加载。
2. 所有音频都能通过表配置和替换。
3. 背景音乐和音效分开控制。
4. 设置界面能调整总音量、背景音乐音量、战斗音效音量。
5. 设置界面能关闭音乐和音效。
6. 没有正式音频资源时，demo 仍然能运行，并使用轻量生成音做占位音效。

## 当前已实现

代码中已有 `AudioManager`：

- 加载 `s_audio.json` 和 `s_audio_event.json`。
- 支持音乐和音效两类。
- 支持 `preloadGroup` 分组预加载。
- 支持本地保存音量设置，使用 `localStorage`。
- 支持浏览器首次点击后解锁音频播放。
- 支持 BGM 同一时间只播放一首。
- 支持音效 `maxConcurrent` 并发限制。
- 支持事件冷却 `cooldownMs`，避免战斗命中音过密。
- 支持正式音频 `url`。
- 支持无正式音频时用 `generatedFreq` 生成短促占位音效。

设置界面已有：

- 总音量：`masterVolume`
- 背景音乐音量：`musicVolume`
- 战斗音效音量：`sfxVolume`
- 音乐开关：`mutedMusic`
- 音效开关：`mutedSfx`

## 音频目录

正式音频放在：

```text
public/game-assets/audio/
```

建议继续细分：

```text
public/game-assets/audio/
  music/
  sfx/
  ui/
  battle/
  result/
```

文件命名：

- 使用小写英文、数字、短横线或下划线。
- 不要使用空格。
- 示例：
  - `music/main-loop.mp3`
  - `music/battle-loop.mp3`
  - `music/boss-loop.mp3`
  - `ui/click-01.mp3`
  - `battle/hit-light-01.mp3`
  - `battle/merge-01.mp3`
  - `result/win-01.mp3`

## 音频表：s_audio

路径：

```text
public/gamedata/s_audio.json
```

字段：

- `key`：音频资源 key，稳定引用名。
- `type`：`music` 或 `sfx`。
- `url`：正式音频路径。留空时不加载正式音频。
- `preloadGroup`：预加载组，例如 `main`、`bag`、`battle`、`ui`。
- `loop`：是否循环。BGM 通常为 `true`，音效为 `false`。
- `volume`：单条音频默认音量，范围 `0~1`。
- `maxConcurrent`：同一音效最大同时播放数，用于防止卡顿。
- `generatedFreq`：无正式音频时的占位频率。BGM 填 `0`。
- `desc`：说明。

示例：

```json
{
  "key": "sfx_battle_hit",
  "type": "sfx",
  "url": "/game-assets/audio/battle/hit-light-01.mp3",
  "preloadGroup": "battle",
  "loop": false,
  "volume": 0.38,
  "maxConcurrent": 6,
  "generatedFreq": 260,
  "desc": "命中怪物"
}
```

## 音频事件表：s_audio_event

路径：

```text
public/gamedata/s_audio_event.json
```

字段：

- `event`：玩法或 UI 调用的事件 key。
- `audioKey`：引用 `s_audio.key`。
- `category`：`music` 或 `sfx`。
- `cooldownMs`：事件冷却时间，单位毫秒。
- `desc`：说明。

示例：

```json
{
  "event": "battle_hit",
  "audioKey": "sfx_battle_hit",
  "category": "sfx",
  "cooldownMs": 70,
  "desc": "命中怪物"
}
```

## 当前音频事件

音乐事件：

- `music_main`：进入选关/主界面。
- `music_battle`：进入普通战斗。
- `music_boss`：进入 Boss 战，当前预留。

UI 和背包：

- `ui_click`：所有按钮点击。
- `bag_place`：背包放置成功。
- `bag_invalid`：背包非法放置。
- `bag_merge`：武器合成成功。
- `bag_refresh`：候选区刷新。
- `bag_expand`：背包扩格。

战斗：

- `battle_shoot`：投射物发射。
- `battle_hit`：命中怪物。
- `battle_cast`：范围技能释放。
- `battle_level_up`：升级三选一弹窗。

结算：

- `result_win`：胜利结算。
- `result_lose`：失败结算。

## 后续如何接入正式音频

以按钮音为例：

1. 把音频放入：

```text
public/game-assets/audio/ui/click-01.mp3
```

2. 修改 `s_audio.json`：

```json
{
  "key": "sfx_ui_click",
  "type": "sfx",
  "url": "/game-assets/audio/ui/click-01.mp3",
  "preloadGroup": "ui",
  "loop": false,
  "volume": 0.7,
  "maxConcurrent": 4,
  "generatedFreq": 880,
  "desc": "通用按钮点击音"
}
```

3. 刷新游戏验证。

玩法代码不需要改，因为按钮调用的是：

```ts
audio.playSfxEvent("ui_click")
```

## 关卡和 Boss 音乐

当前 `music_boss` 已经预留，但 Boss 触发逻辑还没接入。后续建议：

- 在 `s_level` 增加 `musicEvent` 和 `bossMusicEvent`。
- 在 `s_monster` 的 Boss 出现时切换 `music_boss`。
- Boss 死亡后可以切回 `music_battle` 或进入结算。

推荐字段：

```json
{
  "musicEvent": "music_battle",
  "bossMusicEvent": "music_boss"
}
```

## 性能和包体建议

音乐：

- 使用 `.mp3` 或 `.m4a`。
- 单首 BGM 建议 30 到 60 秒可循环。
- H5 广告 demo 不要放太多 BGM，首版主界面 + 战斗 + Boss 最多 3 首。
- BGM 不要放进首屏强制加载，按场景预加载。

音效：

- 常用按钮音、命中音尽量短，建议 `0.05~0.3` 秒。
- 爆炸、升级、结算建议 `0.4~1.2` 秒。
- 高频音效必须设置 `cooldownMs` 和 `maxConcurrent`。
- 命中音、射击音不要过大，避免手机外放刺耳。

加载：

- `main`：主界面音乐、主界面按钮音。
- `bag`：背包放置、合成、刷新。
- `battle`：战斗 BGM、射击、命中、技能、结算。
- 没必要一次性加载全部音频。

## 移动端限制

浏览器和小游戏平台通常要求用户交互后才能播放音频。本项目做法：

- 首次 `pointerdown` 后解锁 AudioContext。
- BGM 播放失败时静默等待下一次用户操作。
- 按钮音效在点击时触发，天然满足用户交互条件。

注意：

- 不要在 loading 完成后立刻强行播放声音并报错。
- 设置界面调音量时应即时生效。
- 音乐关闭后应暂停 BGM，重新开启后继续播放当前场景音乐。

## 上线检查清单

上线前检查：

- `s_audio.json` 和 `s_audio_event.json` 是合法 JSON。
- 所有 `url` 都能在浏览器 Network 中 200 加载。
- 没有 404 音频。
- 手机首次点击后按钮音能播放。
- 设置界面能关闭音乐。
- 设置界面能关闭音效。
- 总音量调低后音乐和音效都变小。
- 音效音量调低后按钮/战斗音变小。
- 音乐音量调低后 BGM 变小。
- 战斗大量命中时没有明显卡顿。
- 静音状态进入战斗不会突然播放 BGM。

验证命令：

```bash
node -e "const fs=require('fs'); for (const f of fs.readdirSync('public/gamedata').filter(f=>f.endsWith('.json'))) JSON.parse(fs.readFileSync('public/gamedata/'+f,'utf8')); console.log('json ok')"
npm run build
```

浏览器验证：

```text
http://localhost:5173/game.html
```
