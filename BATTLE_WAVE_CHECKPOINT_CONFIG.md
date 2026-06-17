# 战斗波次中继与背包配置说明

本文给策划和后续调参用，说明“打一波 -> 领奖励 -> 回背包备战 -> 继续下一波”的配置方式。

## 玩法流程

当前第一关改为 10 波：

1. 主界面点击开始后进入背包。
2. 背包里摆放装备，点击“开始第 N 波”。
3. 战斗只刷当前这一波怪物。
4. 当前波怪物全部击杀后，播放获得金币提示。
5. 如果不是最后一波，自动回到背包，并按波次配置扩展背包。
6. 玩家可以重新摆放、合成、刷新装备，再点击开始下一波。
7. 第 10 波打完才进入最终胜利结算。

## `s_level.json`

关卡控制总波数和背包上限：

```json
{
  "id": 1,
  "initRows": 3,
  "initCols": 3,
  "maxRows": 5,
  "maxCols": 5,
  "winWave": 10,
  "waveGroupId": 101
}
```

字段说明：

- `initRows` / `initCols`：开局背包尺寸。
- `maxRows` / `maxCols`：波后自动扩展的最大尺寸。
- `winWave`：最终通关波数。
- `waveGroupId`：读取哪一组 `s_wave`。

## `s_wave.json`

每一行是一段刷怪配置，同一波可以写多行。

```json
{
  "waveGroupId": 101,
  "wave": 1,
  "time": 0.2,
  "monsterId": 1,
  "count": 5,
  "interval": 0.52,
  "spawn": "top",
  "rewardGold": 10,
  "expandCols": 1,
  "expandRows": 0
}
```

字段说明：

- `wave`：第几波。
- `time`：本波内开始刷怪时间。现在每次只打一波，会把当前波最早时间归一到 0.2 秒附近。
- `monsterId`：怪物 id，对应 `s_monster.json`。
- `count`：刷怪数量。
- `interval`：同一行怪物之间的刷出间隔。
- `rewardGold`：该波打完后额外发放的本局金币。
- `expandCols`：该波打完后扩几列，受关卡 `maxCols` 限制。
- `expandRows`：该波打完后扩几行，受关卡 `maxRows` 限制。

如果同一波写了多行：

- 怪物会合并成同一波刷出。
- `rewardGold` 会求和。
- `expandCols` / `expandRows` 会依次应用。

## `s_monster.json`

怪物新增攻速字段：

```json
{
  "id": 1,
  "name": "矿灯工",
  "hp": 65,
  "speed": 42,
  "attack": 18,
  "attackInterval": 1.35
}
```

字段说明：

- `speed`：怪物走向基地的速度。
- `attack`：贴脸攻击的基础伤害。
- `attackInterval`：贴脸后每隔多少秒扣一次血。

当前规则：

- 怪物走到基地接触线后会停住。
- 怪物不会穿过炮台，也不会因为碰到基地立刻死亡。
- 只有被装备打死后才算清怪。

## 背包底部按钮

现在背包底部三个按钮是：

- 左：广告刷新，成功后候选区 3 个装备必定是 2 级装备。
- 中：金币刷新，消耗 `s_economy.json` 的 `bag_refresh_gold_cost`，按普通商店池随机。
- 右：开始当前波，例如“开始第 3 波”。

相关经济配置：

```json
{ "key": "bag_refresh_quality2_ad", "value": 0, "adPlacement": "bag_refresh_quality2" }
{ "key": "bag_refresh_gold_cost", "value": 15, "adPlacement": "bag_refresh" }
```

## 调参建议

- 前 3 波建议给较多扩格，让玩家明显感受到背包成长。
- 中后期可以不再扩格，只给金币，让玩家通过刷新和合成提升战力。
- 如果怪物贴脸后掉血太快，优先调低 `attack` 或调高 `attackInterval`。
- 如果某波太拖，优先减少 `count` 或提高怪物 `speed`，不要只堆血量。
