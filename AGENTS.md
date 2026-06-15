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
    AssetManager.ts        # 图片/图集资源加载
    AudioManager.ts        # BGM/SFX/音量设置
  utils/
    display.ts             # 通用绘制、按钮、图标、拖拽点转换、随机权重
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
- 已有 `s_audio.json` 和 `s_audio_event.json`，用于背景音乐、按钮音效、背包音效、战斗音效、结算音效配置。
- 正式图片还没接入时，运行时会自动回退到 Pixi `Graphics` 占位图，不影响 demo 运行。
- 已接资源入口：按钮底图、顶部资源图标、关卡地图图、侧边入口图标、武器图标、肉鸽卡牌图标、结算奖励图标。
- 正式音频还没接入时，BGM 不播放，音效可使用轻量生成音作为占位反馈。

后续改动原则：

- 不要把新数值写死在 `src/main.ts`，优先加到 `public/gamedata/*.json`。
- 不要把正式图片路径写死在代码里，优先加到 `s_asset.json`，再通过表里的 `assetKey` 引用。
- 如果新增 UI 功能，优先独立成 `WndXxx` 或 `ComXxx`，不要继续把所有界面逻辑堆到一个函数里。
- 如果新增弹窗文案，优先加 `s_comstr.json`，再用 `confirmType` 或业务 id 调用。
- 如果新增音频，优先加 `s_audio.json` 和 `s_audio_event.json`，玩法代码只调用 `audio.playSfxEvent()` 或 `audio.playMusicEvent()`。
- 每轮交付前至少运行 `npm run build`。如果涉及浏览器交互，还要刷新 `http://localhost:5173/game.html` 做一次实际验证。
