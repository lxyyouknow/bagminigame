# lxy 小游戏协作说明

## 基本偏好

- 用户称呼为 `lxy`。
- lxy 是游戏开发者，做过几年 H5 游戏，主要使用 Egret、Cocos 和 TypeScript，也用 Unity + Lua 做过手游。
- 后续经常会提供游戏案例、视频、录屏、截图或参考链接。默认目标是快速分析玩法、UI、动效和核心循环，并直接做出高度相似、可运行的小游戏 demo。
- 所有提示、README、代码注释、策划说明和交付文档默认尽量使用中文。
- demo 主要用于广告投放和收益测试，默认优先级：
  1. 高还原度
  2. 尽快出可玩版本
  3. 核心玩法闭环完整
  4. 实现简单直接，避免过度设计
  5. 优先使用适合快速落地的 TypeScript 工作流，除非 lxy 明确指定别的引擎

## 参考素材默认拆解

当 lxy 提供参考素材时，默认拆解并输出：

- 核心玩法
- 新手引导
- UI 布局
- 数值和奖励循环
- 动效节奏
- 广告创意常见做法
- 可复刻 demo 的技术建议

如果信息足够，不要停留在泛泛分析上，应该直接进入方案或实现。

## 视频分析默认流程

当 lxy 提供游戏视频、录屏或动效参考时，优先使用本机 `ffmpeg` / `ffprobe` 快速分析，不要只凭口述猜测玩法。

1. 先读取视频信息：

```bash
ffprobe -hide_banner -show_format -show_streams <video>
```

重点确认时长、分辨率、帧率、编码和音频情况。

2. 再生成总览图：

```bash
ffmpeg -i <video> -vf "fps=1,scale=360:-1,tile=5x4" /tmp/video_contact_sheet.jpg
```

如果视频超过 20 秒且该命令会输出多张图，应改成按间隔抽帧并限制单张输出，例如：

```bash
ffmpeg -y -i <video> -vf "fps=1/7,scale=360:-1,tile=5x4" -frames:v 1 /tmp/video_contact_sheet.jpg
```

3. 必要时按关键时间点抽帧：

```bash
ffmpeg -ss <秒数> -i <video> -frames:v 1 /tmp/frame_<秒数>.jpg
```

4. 分析输出默认包含：核心玩法、新手引导、UI 布局、数值和奖励循环、动效节奏、广告创意常见做法、可复刻 demo 的技术建议。

如果 `ffmpeg` 或 `ffprobe` 不可用，先修复视频工具链，再继续拆解视频。

## 当前背包合成防守 Demo 方案

本项目参考视频是一个竖屏背包合成防守玩法，核心循环是：

选关 -> 背包格子摆放武器 -> 同武器同品质合成升品 -> 免费/金币/广告刷新候选武器 -> 开始战斗 -> 自动攻击防守 -> 升级三选一肉鸽强化 -> 获得金币 -> 回到背包继续扩格/刷新/强化。

### 引擎建议

- demo 阶段默认推荐 `Vite + TypeScript + PixiJS`。
- 原因：该玩法重点是 2D UI、格子拖拽、背包形状判定、自动战斗、帧动画和 H5 广告测试。PixiJS 比 Three.js 更直接，比 Cocos 工程更轻，启动快、包体小、便于手机局域网分享测试。
- 如果 demo 点击率高，先继续用 PixiJS 做一版完整 H5 验证版。
- 如果后期要长期产品化、多平台发行、小游戏平台/App 包、多渠道 SDK、编辑器协作和大量 prefab/动画管线，再优先评估转 Cocos Creator。
- Godot 是好引擎，但不作为当前 H5 广告 demo 首选。它更适合完整独立游戏、PC/Steam/App 或偏海外独游管线；Web 导出、广告平台适配和 playable ads 轻量化不如 PixiJS/Cocos 顺手。

### 背包玩法约定

- 背包格子、初始大小、扩展格子、扩展消耗、广告扩展入口都必须走配置表。
- 武器形状必须走表配置，支持 `1x1`、`1x2`、`2x1`、L 型、T 型、长条型等多格占用。
- v1 默认不做旋转，但数据结构预留 `allowRotate`。
- 候选区默认 3 个武器，数量、刷新权重、免费次数、金币刷新价格、广告刷新次数都走配置。
- 同武器、同品质、同等级满足规则时合成下一品质；合成目标、合成数量、品质颜色、品质倍率都走表。
- 所有广告接口先预留 mock：`showRewardedAd(placementId)`，不要把广告逻辑写死到玩法逻辑里。

### 战斗玩法约定

- 竖屏 9:16，战斗视角为上半屏刷怪、下方我方堡垒/角色、底部显示已装备武器和 CD 遮罩。
- 背包里的武器映射成战斗技能，按 CD 自动攻击。
- 武器表需要可配置：攻击力、CD、射程、攻击方式、特殊效果、图标、战斗动画、音效。
- 攻击类型至少预留：近战、投射物、范围爆炸、持续毒圈、护盾、治疗、召唤。
- 我方属性至少包含生命值、护甲、金币、经验、等级。
- 战斗中升级触发三选一肉鸽强化，选项池、权重、出现条件、效果和广告刷新都走表。
- 战斗获得金币，金币可用于背包刷新、扩展格子等。

### 数据表建议

沿用 `web3d-game-starter` 的静态表思想：

- `public/gamedata/` 放策划友好的 JSON 表。
- `src/game_data/` 一表一个 TypeScript reader。
- `GameDataManager` 在 loading 阶段统一加载全部必要表。
- 游戏逻辑读取表结构，不把数值硬编码进玩法代码。

建议表：

- `s_level`：关卡名、背景、初始背包、波次组、通关奖励。
- `s_bag_grid`：初始格子、扩展格子、扩展消耗、广告扩展 placement。
- `s_item`：武器 id、名称、品质、形状 id、图标、技能 id、合成目标。
- `s_item_shape`：格子坐标数组、是否允许旋转、预览尺寸。
- `s_quality`：品质颜色、攻击倍率、合成数量、下一品质。
- `s_weapon_skill`：攻击力、CD、射程、攻击方式、特效、音效。
- `s_effect`：伤害、范围、持续时间、减速、护盾、治疗等效果参数。
- `s_wave`：刷怪时间轴、怪物组、数量、间隔、奖励。
- `s_monster`：血量、速度、护甲、金币、经验、动画资源。
- `s_rogue_option`：升级三选一池、出现条件、权重、效果、是否广告刷新。
- `s_economy`：刷新价格、免费次数、金币奖励、广告点位配置。
- `s_asset`：图片、图集、帧动画、音效 key 到实际路径的映射。

### 美术和资源约定

- demo 可先使用占位图、AI 草图或简单几何图形，但资源 key 和替换目录必须从第一版预留。
- UI 使用 PNG/WebP 九宫格、按钮、卡牌、品质边框、格子底板。
- 武器在背包内使用 icon，战斗中使用技能特效。
- 怪物和角色优先使用 spritesheet 帧动画，动作名建议固定为 `idle`、`run`、`attack`、`hit`、`death`。
- 特效优先使用 spritesheet，例如火焰爆炸、毒液、闪电、护盾、金币飞行。
- 资源目录建议：

```text
public/
  game-assets/
    source/
    optimized/
    placeholders/
    ui/
    characters/
    enemies/
    weapons/
    effects/
    audio/
  gamedata/
```

### 手机端和性能约定

- 竖屏 9:16 优先，适配安全区。
- Pixi 渲染 DPR 手机端默认限制到 `1.5` 或 `2`。
- 武器、怪物、UI 和特效尽量走图集，避免大量散图请求。
- 怪物、子弹、伤害数字、金币飞行全部使用对象池。
- 怪物数量设置上限，超出时合批刷怪或降低特效密度。
- 碰撞使用简单圆形/矩形，必要时加空间分区。
- CD 遮罩、血条、伤害数字尽量在 Pixi/Canvas 内完成，减少 DOM。

### 启动和交付约定

- 根目录必须有点击即可启动的入口，至少包含 Mac 和 Win：
  - `启动游戏.command`
  - `启动游戏.bat`
  - 可选 `启动游戏.sh`
- 所有启动脚本统一委托同一个 Node/Vite server，不要各写一套逻辑。
- 支持启动 web server 后直接分享到手机测试，启动时尽量打印本机局域网地址。
- `game.html` 作为游戏入口，通过 dev server 打开，不使用 `file://`。
- `npm run start`、`npm run dev`、`npm run start:game` 应该走同一条启动链路，避免不同入口行为不一致。
- 启动脚本不要写死项目绝对路径，必须按脚本所在目录 `cd`，这样项目改名、移动、压缩给别人后仍能运行。
- 启动脚本不要假设端口一定是 `5173`。如果端口被占用，Vite 可能自动切到新端口，脚本必须读取实际端口再打印电脑和手机访问地址。
- Mac/Win 点击入口只负责检查 Node/npm、必要时安装依赖、再调用统一 server 脚本；不要在 `.command`、`.bat` 里复制复杂逻辑。
- 如果出现“我打开的是旧版本/卡 loading/手机打不开”，先确认浏览器访问的是当前 server 输出的真实 URL，而不是旧端口、旧目录或旧服务。

### Loading 卡住排查约定

当游戏卡在 loading，不要先假设是资源缺失或目录改名，按下面顺序查：

1. 先确认 dev server 正常返回：

```bash
curl -I http://localhost:5173/game.html
```

2. 再确认 `public/gamedata/*.json` 都能返回 `200`，尤其是新增表。
3. 刷新浏览器，读取控制台 error/warn；Pixi 游戏大部分内容都在 canvas 内，DOM 没有文字不代表没进游戏。
4. 检查 loading 阶段的 async 链路：`data.loadAll()`、`audio.init()`、`assetManager.preloadGroups()`、`showMain()`。
5. 如果 loading 进度到 90% 左右但不跳转，优先怀疑 `showMain()` 或主界面构造阶段运行时报错。
6. `LoadingScene` 应保留 try/catch 和中文错误提示，不要让玩家只看到静止进度条。

本项目 2026-06-15 曾出现一次卡 loading，根因不是中文根目录改名，而是音频模块运行时错误：

- `AudioManager.playMusicEvent/playSfxEvent` 里误写成 `this.this.data`。
- Vite 默认构建没有做完整 TypeScript 类型检查，`npm run build` 仍可能通过。
- 同时存在 `AudioManager -> utils/display -> core/runtime -> AudioManager` 的循环依赖风险。

修复经验：

- 纯工具函数不要放在依赖 runtime 的 UI 工具文件里。
- `color`、`clamp01`、`weightedPick` 这类纯函数应放到 `src/utils/math.ts`。
- service 层不要依赖 `utils/display.ts`，因为 display 会依赖 `app/audio/data/assetManager` 等运行时单例。
- 涉及 loading 和启动链路的修改，除了 `npm run build`，还必须刷新浏览器并确认能从 Loading 进入选关界面。

## 当前项目制作进度快照

这个项目当前是 `Vite + TypeScript + PixiJS` 的竖屏 H5 demo。后续新对话接手时，先读本文件，再按任务类型读：

- 数据、数值、关卡、武器、怪物、肉鸽、经济：读 `DATA_DESIGN.md`。
- 美术换皮、UI 图片、关卡图、武器图标、怪物动作、攻击特效：读 `ART_PIPELINE.md`。
- 音频、BGM、按钮音、战斗音效、音量设置、上线小游戏音频限制：读 `AUDIO_DESIGN.md`。

项目根目录已经改为英文 ASCII 路径：

```text
/Users/lxy/MiniGameWork/backpack-mini-game
```

原因：中文路径对当前 H5 构建产物上线 TikTok 不构成直接影响，但后续接 CI、TikTok playable 打包脚本、Cocos/Godot 迁移、Windows 协作、第三方 SDK 或命令行工具时，英文路径更稳。

已完成的玩法闭环：

- Loading -> 选关主界面 -> 背包界面 -> 战斗界面 -> 升级三选一 -> 暂停/设置/确认 -> 结算 -> 回选关。
- 选关界面已经做成左右切换关卡卡片。第一关不显示左箭头，最后一关不显示右箭头。
- 背包支持多格形状、候选区 3 个物品、拖拽放置、非法提示、同武器同品质合成、候选区之间合成、格子内合成。
- 候选武器用掉后保留空位，不自动补货，玩家需要手动刷新。
- 拖拽时有视觉提示：可放置、可合成、不可放置。
- 战斗支持自动攻击、CD 遮罩、刷怪波次、金币/经验、升级三选一、暂停、设置、结算。
- 暂停弹窗底部有三个按钮：回主界面、继续挑战、设置。回主界面会调用通用确认弹窗。
- 通用确认弹窗读取 `public/gamedata/s_comstr.json`，通过 `confirmType` 区分功能。

当前 UI 模块命名约定：

- `WndMain`：选关主界面。
- `BagScene`：背包界面，目前后续可改名或拆成 `WndBag`。
- `BattleScene`：战斗地图和战斗逻辑管理。
- `WndPause`：局内暂停界面。
- `WndSetting`：设置界面。
- `WndConfirm`：通用确认框。
- `WndRogueOption`：局内升级三选一。
- `WndResult`：结算界面。

当前源码目录结构：

```text
src/
  main.ts                  # 只负责注册场景导航和启动 Loading
  types.ts                 # 全局数据和运行时类型
  core/
    runtime.ts             # Pixi Application、全局 service 单例、setScene
    navigation.ts          # 场景跳转注册，避免窗口/场景互相循环引用
  data/
    GameDataManager.ts     # 所有 gamedata 表读取和查询
  services/
    AdService.ts           # 广告 mock
    AnalyticsService.ts    # 埋点 mock，后续替换为平台/三方统计 SDK
    AssetManager.ts        # 图片/图集资源加载
    AudioManager.ts        # BGM/SFX/音量设置
    LifecycleService.ts    # 前后台/失焦/恢复生命周期分发
    SaveService.ts         # 玩家本地存档、资源、关卡进度和结算奖励
    StorageAdapter.ts      # localStorage/平台缓存/内存兜底适配层
  utils/
    math.ts                # 纯工具函数，不依赖 runtime
    display.ts             # 通用绘制、按钮、图标、拖拽点转换
  windows/
    GameWindow.ts
    WndConfirm.ts
    WndPause.ts
    WndSetting.ts
    WndRogueOption.ts
    WndResult.ts
  scenes/
    BaseScene.ts
    LoadingScene.ts
    WndMain.ts             # 选关主界面
    BagScene.ts            # 背包玩法界面
    BattleScene.ts         # 战斗地图和战斗逻辑
```

后续新增 UI 界面时，优先放到 `src/windows/`。新增完整游戏阶段时，优先放到 `src/scenes/`。不要再把窗口类、战斗类、数据类塞回 `src/main.ts`。

当前资源化进度：

- 已有 `AssetManager`，读取 `public/gamedata/s_asset.json` 中配置了 `url` 的图片资源。
- 已有 `s_ui.json`，用于按钮、资源图标、侧边入口、肉鸽图标、结算图标等 UI 皮肤 key。
- 已有 `s_ui_layout.json`，用于主要界面 UI 位置、尺寸、字号、显隐等布局配置。策划或美术 agent 调整界面时，优先改这个表，不要改功能代码。
- 已有 `s_audio.json` 和 `s_audio_event.json`，用于背景音乐、按钮音效、背包音效、战斗音效、结算音效配置。
- 正式图片还没接入时，运行时会自动回退到 Pixi `Graphics` 占位图，不影响 demo 运行。
- 已接资源入口：按钮底图、顶部资源图标、关卡地图图、侧边入口图标、武器图标、肉鸽卡牌图标、结算奖励图标。
- 正式音频还没接入时，BGM 不播放，音效可使用轻量生成音作为占位反馈。

## 上线接入索引

本项目已经补齐 4 个上线准备基础服务：玩家存档、埋点、广告、生命周期。后续真的接微信、抖音、TikTok playable 或服务端时，先读本节，不要全局搜索。

### 玩家存档和测试账号

相关文件：

- `PLAYER_DATA_STORAGE_DESIGN.md`：玩家数据存储完整方案。
- `src/services/SaveService.ts`：玩家资源、关卡解锁、通关记录、奖励结算。
- `src/services/StorageAdapter.ts`：底层存储适配，当前默认 `localStorage`，不可用时内存兜底。
- `src/core/runtime.ts`：导出全局 `save` 单例。
- `src/scenes/LoadingScene.ts`：`data.loadAll()` 后调用 `save.init(data.levels)`。
- `src/scenes/WndMain.ts`：显示测试账号、长期资源、最高记录、关卡锁定；点击开始时扣入场道具。
- `src/scenes/BattleScene.ts`：结算时调用 `save.applyBattleResult()` 写入通关和奖励。
- `public/gamedata/s_level.json`：每关 `entryCostResource`、`entryCostAmount`、`firstPassRewardCoin`、`repeatWinRewardCoin`、`loseRewardCoin`。

测试版本账号规则：

- URL 参数指定本地测试账号：`game.html?account=test_lxy`、`game.html?account=test_alt`。
- 不传 `account` 时沿用上次账号；从未指定过时默认 `test_lxy`。
- 每个账号独立存档，key 形如 `backpack_defense_save_v1:test_lxy`。
- 控制台调试入口：`__debugSave.account()`、`__debugSave.state()`、`__debugSave.switchAccount("test_alt")`、`__debugSave.reset()`、`__debugSave.addDynamite(30)`、`__debugSave.addCoin(500)`、`__debugSave.unlockAll()`。

正式接入建议：

- 微信小游戏本地缓存：新增 `WechatStorageAdapter`，内部使用 `wx.getStorageSync/wx.setStorageSync`，再在 `runtime.ts` 替换 `createDefaultStorageAdapter()`。
- 抖音小游戏本地缓存：新增 `DouyinStorageAdapter`，内部使用 `tt.getStorageSync/tt.setStorageSync`。
- 正式运营跨设备：保留 `SaveService` 业务接口，在外层增加远端同步，例如 `RemoteSaveSyncService`；服务端用微信/抖音登录后的 `openid/unionid` 或平台用户 id 保存权威数据，本地 storage 只做缓存。
- 不要让 `WndMain`、`BattleScene`、`BagScene` 直接调用平台缓存或服务端接口，统一走 `save`。

### 埋点统计

相关文件：

- `src/services/AnalyticsService.ts`：埋点 mock，当前记录内存事件并 `console.info` 输出。
- `src/core/runtime.ts`：导出全局 `analytics` 单例。
- `src/scenes/LoadingScene.ts`：`loading_complete`。
- `src/scenes/WndMain.ts`：`main_show`、`level_start_click`、`level_start_success`、`level_start_failed`。
- `src/scenes/BattleScene.ts`：`battle_start`、`rogue_option_select`、`battle_result`。

当前事件：

- `loading_complete`：Loading 完成。
- `main_show`：进入主界面。
- `level_start_click`：点击开始游戏。
- `level_start_success`：扣入场道具成功。
- `level_start_failed`：关卡未解锁或资源不足。
- `battle_start`：进入战斗。
- `rogue_option_select`：选择肉鸽强化。
- `battle_result`：战斗结算，包含胜负、波次、击杀、本局金币、奖励金币、战斗时长。

正式接入建议：

- 接平台或三方 SDK 时，优先只改 `AnalyticsService.track()`。
- 事件名和参数尽量保持稳定，方便广告投放对比不同版本数据。
- 不要在玩法代码里直接写 SDK 调用。玩法只调用 `analytics.track(event, params)`。
- 后续广告投放建议至少补：广告请求、广告成功、广告失败、资源不足弹窗曝光、结算确认、留存关键节点。

### 激励广告

相关文件：

- `src/services/AdService.ts`：广告 mock，支持 `success`、`failed`、`canceled`、`busy`。
- `src/core/runtime.ts`：导出全局 `ads` 单例。
- `src/scenes/BagScene.ts`：金币不足时，刷新候选区和扩格调用 `ads.showRewardedAd()`。
- `src/data/GameDataManager.ts`：`getEconomyAdPlacement(key)` 读取经济表里的广告点位。
- `public/gamedata/s_economy.json`：`bag_refresh_gold_cost`、`bag_expand_gold_cost` 等配置 `adPlacement`。

当前返回结构：

```ts
{
  ok: boolean;
  placementId: string;
  status: "success" | "failed" | "canceled" | "busy";
  message: string;
}
```

调试入口：

```ts
__debugAds.setOutcome("bag_refresh", "canceled");
__debugAds.setOutcome("bag_expand", "failed");
__debugAds.setOutcome("bag_refresh", "success");
__debugAds.clearOutcome("bag_refresh");
__debugAds.history();
```

正式接入建议：

- 微信/抖音/TikTok 接广告 SDK 时，优先只改 `AdService.showRewardedAd()`。
- 点位 id 必须继续来自 `s_economy.json` 或功能表，不要写死在按钮逻辑里。
- SDK 的关闭、失败、超时、未加载、频控，都要映射成 `canceled/failed/busy` 这类稳定状态。
- 发奖励只看 `result.ok`，不要在按钮回调里假设广告一定成功。

### 小游戏生命周期

相关文件：

- `src/services/LifecycleService.ts`：监听页面 `visibilitychange`、`blur`、`focus`、`pagehide`、`pageshow`。
- `src/core/runtime.ts`：生命周期统一分发到 `activeScene?.onAppPause/onAppResume`，并调用音频暂停/恢复。
- `src/services/AudioManager.ts`：`pauseForLifecycle()`、`resumeFromLifecycle()`。
- `src/scenes/BattleScene.ts`：后台或失焦时自动打开暂停弹窗。

当前策略：

- 进后台、失焦、页面隐藏：暂停 BGM/AudioContext；战斗中自动暂停。
- 回前台：恢复音频；不自动继续战斗，等待玩家点“继续挑战”。
- 这是市面小游戏常见处理，避免玩家切出去后回来已经死亡。

正式接入建议：

- 微信小游戏：在平台启动层桥接 `wx.onHide(() => lifecycle.pause("manual"))`、`wx.onShow(() => lifecycle.resume("manual"))`。
- 抖音小游戏：桥接 `tt.onHide/tt.onShow`。
- 如果平台没有浏览器 `document/window` 事件，要保留 `LifecycleService` 接口，只替换事件来源。
- 场景层不要直接监听平台生命周期。新增场景需要响应后台时，实现 `onAppPause(reason)` / `onAppResume(reason)`。

### UI 控件和预制件替代方案

PixiJS 没有 Cocos 那种编辑器 prefab。当前统一按钮入口在 `src/utils/display.ts` 的 `button()`、`glossyButton()`，皮肤 key 来自 `public/gamedata/s_ui.json`，主要界面布局来自 `public/gamedata/s_ui_layout.json`。

当前主要界面已经接入布局配置：

- `src/ui/layout/UiLayout.ts`：把 `anchor + x/y` 解析成屏幕坐标。
- `public/gamedata/s_ui_layout.json`：主要界面 UI 的位置、尺寸、字号、显隐。
- `src/data/GameDataManager.ts`：读取 `s_ui_layout` 并提供 `data.getUiLayout(scene, key)`。
- `src/scenes/WndMain.ts`、`BagScene.ts`、`BattleScene.ts`、`LoadingScene.ts` 和 `src/windows/Wnd*.ts`：功能逻辑仍在代码里，UI 摆放读布局表。

例如右侧“小游戏 / 游戏圈”按钮歪了，优先改：

```text
public/gamedata/s_ui_layout.json
```

对应 key：

- `side_minigame`
- `side_game_circle`

当前 `scene` 覆盖：

- `loading`：Loading 角色、进度条、提示、错误文本。
- `main`：主界面头像区、右侧入口、关卡图、切关箭头、记录、开始按钮、toast。
- `bag`：背包标题、资源文本、棋盘、候选区、底部按钮、toast。
- `battle`：暂停按钮、战斗标题、波次条、状态文本、基地面板、装备栏。
- `pause`：暂停标题、内容面板、关卡信息、底部三个按钮。
- `setting`：设置面板、音量行、开关、提示、确定按钮。
- `confirm`：确认框面板、标题、图标、内容、取消/确认按钮。
- `rogue`：三选一标题、卡牌组。
- `result`：结算图标、标题、结果文本、奖励面板、奖励卡、确定按钮。

字段说明：

- `anchor`：基准点，例如 `topRight` 表示以屏幕右上角为基准。
- `x` / `y`：相对基准点偏移。`topRight` 下 `x` 通常是负数，表示离右边缘多少像素。
- `width` / `height`：组件尺寸。
- `iconSize`：图标尺寸。
- `labelOffsetY`：文字相对图标中心的纵向偏移。
- `fontSize`：字号。
- `visible`：是否显示。

如果只是调位置、字号、尺寸、显隐，不要改 scene/window 功能代码。只有新增功能、改点击逻辑、增加新组件类型时才改代码。

后续收到策划或美术 agent 的界面调整提示词时，默认判断规则：

- “按钮/文本/面板/卡牌/进度条/入口太上、太下、偏左、偏右、太大、太小、字号不对、隐藏/显示”：优先改 `s_ui_layout.json`。
- “换按钮图、换图标、换背景、换关卡图”：优先改 `s_asset.json` 和 `s_ui.json`。
- “点击后做什么、消耗什么、跳到哪里、奖励什么”：才改 `src/scenes/` 或 `src/windows/` 功能代码。

后续如果 UI 增多，建议升级为代码组件：

```text
src/ui/components/ComButton.ts
src/ui/components/ComPanel.ts
src/ui/theme.ts
```

原则：

- 场景和窗口不要手写多套按钮样式，统一调用组件工厂，例如 `createButton({ variant: "primary", text, onTap })`。
- `variant` 映射 `s_ui.json` 的 `button_yellow/button_blue/button_green/button_white`。
- 点击缩放、禁用态、广告角标、红点、音效、九宫格都放在 `ComButton`，不要散落在各个 scene/window。
- 正式 UI 图片路径仍然走 `s_asset.json`，按钮语义和默认尺寸走 `s_ui.json`。
- UI 摆放、默认字号、默认尺寸走 `s_ui_layout.json`，不要散落在各个 scene/window。

### 测试和验证命令

当前新增了轻量测试脚本：

```bash
npm run test:save        # 玩家存档、账号、资源消耗、关卡解锁、奖励
npm run test:analytics   # 埋点事件结构和历史记录
npm run test:ad          # 激励广告成功/失败/取消/忙碌
npm run test:lifecycle   # 前后台、失焦、恢复生命周期
npm run test:ui-layout   # UI 布局锚点解析和默认值合并
```

上线准备或改这些服务时，至少执行：

```bash
npm run test:save
npm run test:analytics
npm run test:ad
npm run test:lifecycle
npm run test:ui-layout
node -e "const fs=require('fs'); for (const f of fs.readdirSync('public/gamedata').filter(f=>f.endsWith('.json'))) JSON.parse(fs.readFileSync('public/gamedata/'+f,'utf8')); console.log('json ok')"
npm run build
```

后续改动原则：

- 不要把新数值写死在 `src/main.ts`，优先加到 `public/gamedata/*.json`。
- 不要把正式图片路径写死在代码里，优先加到 `s_asset.json`，再通过表里的 `assetKey` 引用。
- 如果新增 UI 功能，优先独立成 `WndXxx` 或 `ComXxx`，不要继续把所有界面逻辑堆到一个函数里。
- 如果新增弹窗文案，优先加 `s_comstr.json`，再用 `confirmType` 或业务 id 调用。
- 如果新增音频，优先加 `s_audio.json` 和 `s_audio_event.json`，玩法代码只调用 `audio.playSfxEvent()` 或 `audio.playMusicEvent()`。
- 每轮交付前至少运行 `npm run build`。如果涉及浏览器交互，还要刷新 `http://localhost:5173/game.html` 做一次实际验证。
- 如果启动脚本显示的端口不是 `5173`，浏览器和手机都必须使用脚本输出的新端口。
