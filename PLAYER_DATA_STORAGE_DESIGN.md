# 玩家数据存储方案

本文档用于设计当前背包合成防守 Demo 的玩家数据存储方案。目标是先满足 H5 / 小游戏广告测试版本的进度、道具、关卡和奖励闭环，同时保留后续接入抖音/微信小游戏平台缓存和正式服务端的扩展空间。

## 设计目标

- 开始游戏需要真实消耗入场道具，例如主界面按钮上的 `🧨 x6`。
- 关卡是否解锁、是否通关、最高波次、胜利次数等信息需要持久化。
- 玩家长期资源和局内资源必须拆开，避免金币、刷新费用、结算奖励混在一起。
- v1 不依赖服务端，优先使用本地存档，保证广告 demo 可以快速上线测试。
- 存储接口要隔离平台差异，后续可以替换为抖音/微信小游戏本地缓存，或增加远端同步。
- 存档结构需要带版本号，方便后续字段扩展和迁移。

## 存储方式选型

### 推荐：本地存档 + 存储适配层

首版使用 `SaveService + StorageAdapter`。

- H5 浏览器环境：底层使用 `window.localStorage`。
- 抖音小游戏环境：底层可替换为 `tt.getStorageSync` / `tt.setStorageSync`。
- 微信小游戏环境：底层可替换为 `wx.getStorageSync` / `wx.setStorageSync`。
- 未来正式运营：在 `SaveService` 外增加远端同步服务，不让玩法代码直接调用网络接口。

推荐原因：

- 数据量很小，一份 JSON 存档足够。
- 不需要登录和服务端部署，适合快速广告投放验证。
- 对小游戏平台迁移友好。
- 玩法系统只依赖业务接口，不依赖具体存储 API。

### 暂不推荐：直接接服务端

当前不建议一开始就做服务端存档。服务端会引入账号、鉴权、网络失败、重试、数据冲突、部署和接口维护。对于广告 demo 来说，投入较重，并且会拖慢可玩版本迭代。

等项目进入长期运营或需要跨设备账号、排行榜、活动发奖、防刷校验时，再补远端同步更合适。

### 暂不推荐：IndexedDB

IndexedDB 适合大量结构化数据、离线数据库或二进制缓存。当前只需要保存玩家资源和关卡进度，`localStorage` 风格的 key/value 存储更简单直接。

## 模块设计

建议新增服务模块：

```text
src/services/
  SaveService.ts          # 玩家存档业务层
  StorageAdapter.ts       # 存储接口和平台适配
```

可选新增配置：

```text
public/gamedata/
  s_resource.json         # 长期资源定义，例如炸药、金币、体力
  s_level_reward.json     # 关卡入场消耗、首通奖励、重复奖励、失败奖励
```

如果想少加表，v1 也可以先把关卡入场消耗和奖励字段放到 `s_level.json`，后续内容多了再拆到 `s_level_reward.json`。

## 职责边界

### StorageAdapter

只负责读写字符串，不理解游戏业务。

建议接口：

```ts
interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
```

v1 实现：

- `LocalStorageAdapter`：浏览器 `window.localStorage`。
- `MemoryStorageAdapter`：本地存储不可用时的内存兜底，刷新页面会丢失，只用于防止游戏崩溃。

后续平台实现：

- `DouyinStorageAdapter`：抖音小游戏缓存 API。
- `WechatStorageAdapter`：微信小游戏缓存 API。

### SaveService

负责玩家存档的业务逻辑：

- 读取存档。
- 创建默认存档。
- 校验和修复异常存档。
- 执行版本迁移。
- 消耗资源。
- 增加资源。
- 更新关卡进度。
- 解锁下一关。
- 写回存档。

玩法代码只调用 `SaveService`，不直接操作 `localStorage`。

## 存档 Key

推荐使用稳定 key：

```text
backpack_defense_save_v1
```

实际测试版本会按账号分开存档：

```text
backpack_defense_save_v1:test_lxy
backpack_defense_save_v1:test_alt
```

## 测试账号登录方式

测试版本不接真实账号登录，先使用 URL 参数指定本地测试账号：

```text
http://localhost:5173/game.html?account=test_lxy
http://localhost:5173/game.html?account=test_alt
```

规则：

- `account` 只允许英文、数字、下划线和短横线，其他字符会被替换成 `_`。
- 不传 `account` 时，读取上次使用的测试账号。
- 从未指定过账号时，默认使用 `test_lxy`。
- 每个账号独立存档，方便同时测试新号、老号、资源不足、关卡已通关等状态。

开发调试时，浏览器控制台可使用：

```ts
__debugSave.account();
__debugSave.state();
__debugSave.switchAccount("test_alt");
__debugSave.reset();
__debugSave.addDynamite(30);
__debugSave.addCoin(500);
__debugSave.unlockAll();
```

如果后续要区分渠道或测试服，可以增加前缀：

```text
backpack_defense_dev_save_v1
backpack_defense_tiktok_save_v1
```

## 玩家存档结构

建议 v1 存档结构：

```ts
interface PlayerSaveData {
  version: 1;
  player: PlayerProfile;
  resources: PlayerResources;
  levels: Record<string, LevelProgress>;
  stats: PlayerStats;
  settings?: PlayerSaveSettings;
}

interface PlayerProfile {
  uid: string;
  createdAt: number;
  lastLoginAt: number;
}

interface PlayerResources {
  dynamite: number;
  coin: number;
  energy: number;
}

interface LevelProgress {
  unlocked: boolean;
  passed: boolean;
  bestWave: number;
  bestKills: number;
  winCount: number;
  playCount: number;
  lastPlayedAt: number;
}

interface PlayerStats {
  totalBattles: number;
  totalWins: number;
  totalKills: number;
  totalPlaySeconds: number;
}

interface PlayerSaveSettings {
  lastSelectedLevelId: number;
}
```

示例 JSON：

```json
{
  "version": 1,
  "player": {
    "uid": "local_1710000000000_ab12",
    "createdAt": 1710000000000,
    "lastLoginAt": 1710000000000
  },
  "resources": {
    "dynamite": 30,
    "coin": 440,
    "energy": 20
  },
  "levels": {
    "1": {
      "unlocked": true,
      "passed": false,
      "bestWave": 0,
      "bestKills": 0,
      "winCount": 0,
      "playCount": 0,
      "lastPlayedAt": 0
    },
    "2": {
      "unlocked": false,
      "passed": false,
      "bestWave": 0,
      "bestKills": 0,
      "winCount": 0,
      "playCount": 0,
      "lastPlayedAt": 0
    }
  },
  "stats": {
    "totalBattles": 0,
    "totalWins": 0,
    "totalKills": 0,
    "totalPlaySeconds": 0
  },
  "settings": {
    "lastSelectedLevelId": 1
  }
}
```

## 长期资源和局内资源

必须区分两类资源：

### 长期资源

存放在 `PlayerSaveData.resources`。

用于跨局保留：

- `dynamite`：开始游戏消耗道具。
- `coin`：主界面长期金币，可用于后续养成、商店、购买道具。
- `energy`：体力预留。

### 局内资源

保留在当前运行时状态，例如 `BagState.gold`。

用于单局内玩法：

- 背包刷新。
- 背包扩格。
- 战斗击杀收益。
- 本局临时强化。

当前代码中的 `BagState.gold` 建议语义上视为 `runGold`，不要直接等同于长期 `coin`。结算时可以把本局表现按规则转换为长期资源奖励。

## 配表建议

### 方案 A：少加表，扩展 s_level

在 `s_level.json` 增加：

```json
{
  "entryCostResource": "dynamite",
  "entryCostAmount": 6,
  "unlockNeedLevel": 0,
  "firstPassRewardCoin": 80,
  "repeatWinRewardCoin": 30,
  "loseRewardCoin": 10
}
```

优点：

- 改动少。
- 关卡相关配置集中。
- 适合当前 3 关 demo。

缺点：

- 后续奖励类型多了会让 `s_level` 变胖。

### 方案 B：新增 s_level_reward

新增 `public/gamedata/s_level_reward.json`：

```json
[
  {
    "levelId": 1,
    "entryCostResource": "dynamite",
    "entryCostAmount": 6,
    "unlockNeedLevel": 0,
    "firstPassRewards": [{ "resource": "coin", "amount": 80 }],
    "repeatWinRewards": [{ "resource": "coin", "amount": 30 }],
    "loseRewards": [{ "resource": "coin", "amount": 10 }]
  }
]
```

优点：

- 策划调奖励更清晰。
- 后续支持多奖励更自然，例如金币、炸药、皮肤碎片。

缺点：

- 需要新增 reader 和数据校验。

### 推荐

当前建议采用方案 A。等上线准备进入奖励、商店、体力、广告补领都变复杂时，再拆出 `s_level_reward.json`。

## 核心流程

### 首次进入游戏

1. Loading 阶段加载所有静态表。
2. 初始化 `SaveService`。
3. 从本地读取存档。
4. 如果没有存档，创建默认存档。
5. 如果存档版本低于当前版本，执行迁移。
6. 如果存档字段缺失或非法，按默认值修复。
7. 进入主界面。

默认存档建议：

- 第 1 关解锁。
- 第 2、3 关未解锁。
- 初始 `dynamite = 30`。
- 初始长期 `coin = 440`，对应当前主界面占位资源。
- 初始 `energy = 20`。

### 主界面显示

主界面顶部资源条读取 `SaveService.getResources()`。

关卡卡片读取：

- 是否解锁。
- 是否通关。
- 最高波次。
- 是否可以开始。

如果关卡未解锁：

- 地图显示锁定态资源。
- 开始按钮置灰或显示“未解锁”。
- 点击提示“通关上一关后解锁”。

### 开始游戏

点击开始按钮后：

1. 读取关卡入场消耗。
2. 检查关卡是否解锁。
3. 检查 `resources.dynamite >= entryCostAmount`。
4. 足够则扣除炸药并立即保存。
5. 进入背包界面。
6. 不足则弹提示，可引导广告补道具。

扣除时机建议放在进入背包前，而不是战斗开始时。这样玩家从主界面点“开始游戏”就是一次明确消耗。

如果后续希望更宽松，也可以改成“点击开始战斗时扣除”。但当前按钮文案就是入场消耗，所以 v1 建议主界面点击时扣除。

### 战斗结算

结算时调用：

```text
save.applyBattleResult(levelId, result)
```

结果包含：

- 是否胜利。
- 当前波次。
- 击杀数。
- 本局金币。
- 战斗时长。

胜利处理：

- `passed = true`。
- `winCount += 1`。
- `bestWave = max(bestWave, level.winWave)`。
- `bestKills = max(bestKills, kills)`。
- 解锁下一关。
- 首通发 `firstPassRewardCoin`。
- 重复通关发 `repeatWinRewardCoin`。

失败处理：

- `passed` 不变。
- `bestWave = max(bestWave, currentWave)`。
- `bestKills = max(bestKills, kills)`。
- 可发少量 `loseRewardCoin`，用于广告 demo 保持正反馈。

通用统计：

- `playCount += 1`。
- `lastPlayedAt = Date.now()`。
- `stats.totalBattles += 1`。
- `stats.totalKills += kills`。
- 胜利时 `stats.totalWins += 1`。

## 广告补给预留

道具不足时不要在按钮里直接写平台 SDK。

推荐流程：

1. 主界面点击开始。
2. 发现炸药不足。
3. 弹窗提示“炸药不足”。
4. 玩家选择“看广告领取”。
5. 调用 `AdService.showRewardedAd(placementId)`。
6. 广告成功后调用 `save.addResource("dynamite", amount)`。
7. 保存并刷新主界面。

广告点位和奖励数量建议放在 `s_economy.json`：

```json
{
  "key": "ad_reward_dynamite_amount",
  "value": 12,
  "adPlacement": "resource_dynamite",
  "desc": "炸药不足时看广告获得数量"
}
```

## 错误处理和兜底

### 存档 JSON 解析失败

处理方式：

- 备份坏档到另一个 key，例如 `backpack_defense_save_corrupt_v1`。
- 创建默认存档。
- 控制台输出中文警告。

### 存储不可用

可能原因：

- 浏览器隐私模式限制。
- 平台 API 异常。
- 存储容量不足。

处理方式：

- 降级到 `MemoryStorageAdapter`。
- 游戏继续可玩。
- 页面刷新后数据可能丢失。
- 控制台输出中文警告。

### 数据非法

例如资源为负数、关卡 id 不存在、字段缺失。

处理方式：

- 资源数量小于 0 时修正为 0。
- 静态表里存在的新关卡，自动补默认进度。
- 静态表里已删除的旧关卡进度可以保留，但运行时不显示。

## 版本迁移

存档必须有 `version`。

迁移函数建议：

```text
migrateSave(rawSave)
  v0 -> v1
  v1 -> v2
```

v1 阶段只需要保留结构，暂时没有复杂迁移。后续新增字段时，迁移函数补默认值，不要让旧玩家存档丢失。

## 调试工具

建议开发阶段提供简单调试入口，不放到正式 UI：

- 重置存档。
- 增加炸药。
- 增加金币。
- 解锁全部关卡。
- 清除通关记录。

实现方式可以是浏览器控制台挂载：

```ts
window.__debugSave = {
  reset,
  addDynamite,
  addCoin,
  unlockAll
};
```

上线包可以通过环境变量关闭。

## 与现有代码的接入点

### runtime.ts

新增全局单例：

```ts
export const save = new SaveService(...);
```

### LoadingScene.ts

在 `data.loadAll()` 后初始化存档：

```text
await data.loadAll()
save.init(data.levels)
```

### WndMain.ts

改造点：

- 顶部资源条读取长期资源。
- 关卡卡片读取通关和最高记录。
- 未解锁关卡显示锁定。
- 开始按钮检查并消耗入场道具。
- 资源不足时弹提示或广告补给弹窗。

### BagScene.ts

保留当前 `BagState.gold` 作为局内金币。

后续可以把显示文案从“金币”改成“局内金币”或只在代码命名中改成 `runGold`，避免和主界面长期金币混淆。

### BattleScene.ts

结算时调用 `save.applyBattleResult()`。

当前 `showResult(win)` 只打开结算弹窗，后续要在这里或结算确认前写入存档。

### WndResult.ts

结算面板显示真实奖励：

- 首通奖励。
- 重复通关奖励。
- 失败安慰奖励。
- 本局击杀/波次记录。

## 实现顺序建议

1. 新增存档类型定义和 `StorageAdapter`。
2. 新增 `SaveService`，支持默认存档、读取、保存、资源增减。
3. Loading 阶段初始化存档。
4. 主界面顶部资源条接真实长期资源。
5. 开始游戏接炸药消耗和不足提示。
6. 主界面关卡锁定、通关、最高波次接存档。
7. 战斗结算写入通关和奖励。
8. 增加调试方法，方便反复测试。
9. 最后再考虑是否拆 `s_level_reward.json`。

## 验证清单

每轮实现后至少验证：

- 首次进入游戏会创建默认存档。
- 刷新页面后资源和关卡进度不丢失。
- 开始第 1 关会扣除 `6` 个炸药。
- 炸药不足时不能进入关卡。
- 未解锁关卡不能开始。
- 通关第 1 关后第 2 关解锁。
- 失败不会错误解锁下一关。
- 最高波次只增不减。
- 首通奖励只发一次。
- 重复通关奖励可以重复发。
- 重置存档后回到默认状态。
- `npm run build` 通过。
- 浏览器打开 `game.html` 能从 Loading 进入主界面。

## 当前结论

本项目 v1 玩家数据存储采用“本地 JSON 存档 + SaveService 业务层 + StorageAdapter 平台适配层”。这套方案足够支撑开始游戏消耗、关卡解锁、通关记录、长期资源、结算奖励和广告补给，也不会把项目过早绑到服务端或具体小游戏平台。

等后续需要账号、跨设备、排行榜、活动奖励和防刷时，再在 `SaveService` 外增加远端同步，不重写玩法逻辑。
