# 战斗波次中继与背包配置说明

本文给策划和后续调参用，说明“打一波 -> 领奖励 -> 回背包备战 -> 继续下一波”的配置方式。

## 玩法流程

当前关卡默认按 10 波设计：

1. 主界面点击开始后进入背包。
2. 背包里摆放装备，点击“开始第 N 波”。
3. 战斗只刷当前这一波怪物。
4. 当前波怪物全部击杀后，播放获得金币提示。
5. 如果不是最后一波，自动回到背包，并按波次配置扩展背包。
6. 玩家可以重新摆放、合成、刷新装备，再点击开始下一波。
7. 配置的最终波数打完才进入最终胜利结算，当前 1-6 关均为第 10 波。

## `s_battle_tuning.json`

关卡整体难度、人物/基地数值和升级经验曲线统一放在：

```text
public/gamedata/s_battle_tuning.json
```

`s_level.battleTuningId` 引用这张表。常用字段：

- `baseHpMul`：基地最大生命倍率。
- `baseArmorAdd`：基地护甲附加值。
- `expNeedBase` / `expNeedPerLevel`：局内升级经验曲线。
- `monsterHpMul` / `monsterAttackMul` / `monsterSpeedMul`：整关怪物倍率。
- `monsterArmorAdd`：整关怪物护甲附加值。
- `monsterGoldMul` / `monsterExpMul`：击杀奖励倍率。
- `waveRewardGoldMul`：清波金币奖励倍率。

调参建议：

- 整关太简单或太难，优先调 `s_battle_tuning`。
- 某一波想做尖峰压力，调 `s_wave` 的单波倍率字段。
- 怪物基础定位变化，例如让 Boss 基础血量更高，再改 `s_monster`。

## `s_level.json`

关卡控制总波数和背包上限：

```json
{
  "id": 1,
  "initRows": 3,
  "initCols": 3,
  "maxRows": 5,
  "maxCols": 5,
  "battleTuningId": 1,
  "winWave": 10,
  "waveGroupId": 101
}
```

字段说明：

- `initRows` / `initCols`：开局背包尺寸。
- `maxRows` / `maxCols`：波后自动扩展的最大尺寸。
- `battleTuningId`：读取哪一组战斗难度参数。
- `winWave`：最终通关波数。
- `waveGroupId`：读取哪一组 `s_wave`。

## `s_wave.json`

每一行是一段刷怪配置，同一波可以写多行。新版波次不要求“每波只有一种怪”，推荐把一波拆成 2 段：

- 第一段刷基础怪或铺场怪，例如小僵尸。
- 第二段延迟刷高速怪、厚血怪、精英怪或 Boss 护卫。

同一个 `waveGroupId + wave` 下的多行会合并成同一波，全部怪清完后才会结算并回背包。

```json
{
  "waveGroupId": 101,
  "wave": 1,
  "time": 0.2,
  "monsterId": 1,
  "count": 8,
  "interval": 0.84,
  "spawn": "top",
  "rewardGold": 10,
  "monsterHpMul": 1.1,
  "monsterAttackMul": 1.05,
  "monsterSpeedMul": 1,
  "rewardGoldMul": 1,
  "expandCols": 1,
  "expandRows": 0
}
```

字段说明：

- `wave`：第几波。
- `time`：本波内这一段开始刷怪时间。现在每次只打一波，会把当前波最早时间归一到 0.2 秒附近，所以 `time` 主要用于控制同波多段怪物的先后顺序。
- `monsterId`：怪物 id，对应 `s_monster.json`。
- `count`：这一段刷怪数量。
- `interval`：这一段怪物之间的刷出间隔，越大则持续时间越长。
- `rewardGold`：该波打完后额外发放的本局金币。
- `monsterHpMul`：该行刷出的怪物血量倍率，会与整关难度叠乘。
- `monsterArmorAdd`：该行刷出的怪物护甲附加值，会与整关护甲附加值相加。
- `monsterAttackMul`：该行刷出的怪物攻击倍率，会与整关难度叠乘。
- `monsterSpeedMul`：该行刷出的怪物速度倍率，会与整关难度叠乘。
- `monsterGoldMul`：该行刷出的怪物击杀金币倍率，会与整关难度叠乘。
- `monsterExpMul`：该行刷出的怪物击杀经验倍率，会与整关难度叠乘。
- `rewardGoldMul`：该行清波奖励倍率，会与整关清波奖励倍率叠乘。
- `expandCols`：该波打完后扩几列，受关卡 `maxCols` 限制。
- `expandRows`：该波打完后扩几行，受关卡 `maxRows` 限制。

如果同一波写了多行：

- 怪物会合并成同一波刷出。
- `rewardGold` 会求和。
- 每一行的单波倍率只影响该行刷出的怪物。
- `expandCols` / `expandRows` 会依次应用。

刷怪持续时间计算：

```text
这一段结束时间 = time + (count - 1) * interval
这一波持续出怪时间 = 同波所有行的最大结束时间
```

例如：

```json
[
  { "waveGroupId": 101, "wave": 2, "time": 0.2, "monsterId": 1, "count": 8, "interval": 0.84 },
  { "waveGroupId": 101, "wave": 2, "time": 1.2, "monsterId": 2, "count": 4, "interval": 0.9 }
]
```

这表示第 2 波先刷小僵尸，再插入毒蝠；两段都刷完且怪物全部击杀后才会清波。

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
- 如果每波一下就出完，优先增加 `count` 或调大 `interval`。
- 如果一波只出现单一怪物，给同一个 `wave` 再加一行不同 `monsterId`。
- 如果怪物贴脸后掉血太快，优先调低 `attack` 或调高 `attackInterval`。
- 如果整关曲线不对，优先调 `s_battle_tuning`；如果只是某一波爆点不对，优先调 `s_wave` 单波倍率。
- 如果某波太拖，优先减少 `count` 或提高怪物 `speed`，不要只堆血量。
