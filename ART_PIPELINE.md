# 背包合成防守 Demo 美术换皮和资源接入说明

本文档给美术同学、技术美术和后续美术向 agent 使用。目标是让 UI、关卡地图、武器图标、怪物动作、攻击特效、结算奖励等可以通过替换资源和改表完成，不必改玩法逻辑。

## 当前美术状态

当前 demo 是“高完成度占位风格”：

- 主界面是橙色背景、关卡卡片、左右切换按钮、顶部资源条。
- 背包界面是绿色占位背景、格子背包、三格候选武器。
- 战斗界面是简化地图、怪物占位动画、子弹/范围圈/伤害数字。
- 暂停、设置、确认、结算、升级三选一都有基础 UI。

目前正式图还没有接入，但代码已经支持：

- `s_asset.json` 配置资源 key 到图片路径。
- `s_ui.json` 配置 UI 皮肤 key。
- `s_ui_layout.json` 配置主要界面 UI 的位置、尺寸、字号、显隐。
- 有正式图时使用 Pixi `Sprite`。
- 没有正式图时自动回退到代码绘制的占位 UI。

## 资源目录

美术资源放在：

```text
public/game-assets/
  source/        # 原始文件，例如 PSD、AI、未压缩序列帧、参考图
  optimized/     # 后续压缩后的图集或 WebP/PNG
  placeholders/  # 临时占位图
  ui/            # 按钮、面板、资源条、弹窗、图标
  levels/        # 关卡地图/选关预览图
  weapons/       # 背包武器图标、武器战斗表现
  effects/       # 攻击特效、命中特效、升级、合成、金币飞行
  enemies/       # 怪物帧动画、怪物图集
  characters/    # 我方角色、基地、守卫、NPC
  audio/         # 音效和音乐
```

命名建议：

- 使用小写英文、数字、短横线或下划线。
- 不要使用空格。
- 不要在运行时文件名里写 `final`、`new`、`v2` 这类版本噪音。
- 示例：
  - `ui/button-yellow.png`
  - `ui/panel-pause.webp`
  - `levels/level-map-1.webp`
  - `weapons/weapon-bat-icon.png`
  - `effects/fx-fire-hit-sheet.png`
  - `enemies/slime-run-sheet.png`

## 资源表：s_asset

资源 key 到实际文件路径在：

```text
public/gamedata/s_asset.json
```

一行示例：

```json
{
  "key": "ui_button_yellow",
  "type": "image",
  "url": "/game-assets/ui/button-yellow.png",
  "preloadGroup": "ui",
  "fallbackKey": "ui_button_basic"
}
```

字段说明：

- `key`：代码和其他表引用的稳定资源 key。
- `type`：资源类型，当前常用 `image`，预留 `spritesheet`、`audio`、`generated`。
- `url`：资源路径。留空表示暂时不用正式图，自动走占位。
- `preloadGroup`：预加载组，例如 `boot`、`main`、`bag`、`battle`、`ui`。
- `fallbackKey`：加载失败或没图时的备用资源 key。
- `frame`：图集内帧名预留。

注意：

- 不要在代码里写图片路径。
- 美术替换图片时优先保持 `key` 不变，只改 `url`。
- 如果换皮需要多套主题，可以后续复制一套 `s_asset_skin_xxx.json` 或增加 `skin` 字段。

## UI 皮肤表：s_ui

UI 皮肤入口在：

```text
public/gamedata/s_ui.json
```

当前已接入的 UI key：

- `button_basic`：普通小按钮底图。
- `button_yellow`：主按钮，开始、确定、继续挑战。
- `button_blue`：取消、设置等次级按钮。
- `button_green`：功能按钮、主页按钮等。
- `button_white`：左右切换按钮。
- `resource_energy_icon`：顶部体力/能量图标。
- `resource_ticket_icon`：顶部门票/火箭道具图标。
- `resource_coin_icon`：顶部金币/星币图标。
- `side_minigame_icon`：主界面右侧小游戏入口。
- `side_game_circle_icon`：主界面右侧游戏圈入口。
- `rogue_option_icon`：升级三选一卡牌默认图标。
- `result_exp_icon`：结算 EXP 图标。
- `result_coin_icon`：结算金币图标。

换按钮皮肤流程：

1. 把按钮图片放到 `public/game-assets/ui/`。
2. 在 `s_asset.json` 找到对应资源 key，例如 `ui_button_yellow`。
3. 填写 `url`，例如 `/game-assets/ui/button-yellow.png`。
4. 刷新游戏验证。

## UI 布局表：s_ui_layout

界面布局入口：

```text
public/gamedata/s_ui_layout.json
```

用途：

- 调整 Loading、主界面、背包、战斗 HUD、暂停、设置、确认、三选一、结算等主要界面的按钮、入口、关卡图、标题、记录条、开始按钮、面板、卡牌、进度条位置。
- 调整图标大小、文字偏移、字号、显隐。
- 让策划或美术 agent 能只改表，不碰功能代码。

主界面右侧入口示例：

- `side_minigame`：小游戏入口。
- `side_game_circle`：游戏圈入口。

如果按钮偏了，优先调：

- `x`：横向偏移。`anchor = topRight` 时，`x` 是相对屏幕右边缘的偏移，通常为负数。
- `y`：纵向偏移。
- `iconSize`：圆形图标大小。
- `labelOffsetY`：文字离图标中心的距离。
- `fontSize`：文字字号。

不要为了调位置改 `src/scenes/` 或 `src/windows/`。只有新增按钮功能、改点击逻辑或新增组件类型时，才需要技术同学改代码。

给策划或美术 agent 的默认规则：

- 界面元素偏移、大小、字号、显隐：改 `public/gamedata/s_ui_layout.json`。
- 图片、按钮底图、图标、关卡图：改 `public/gamedata/s_asset.json` 和 `public/gamedata/s_ui.json`。
- 功能行为、跳转、消耗、奖励：再改 TypeScript 功能代码。

## 关卡地图图

关卡图在 `s_level.json` 中配置：

- `mapAssetKey`：普通关卡预览图。
- `lockedMapAssetKey`：锁定态关卡预览图。

资源 key 在 `s_asset.json`：

- `level_map_1`
- `level_map_2`
- `level_map_3`
- `level_map_2_locked`
- `level_map_3_locked`

推荐尺寸：

- 选关预览图：`640x480` 或 `960x720`，透明 PNG 或 WebP。
- 构图中心要放主建筑/角色/敌人。
- 外轮廓最好有厚描边，适合广告 demo 快速识别。
- 图片里不要带关卡名，关卡名由 UI 文本显示。

## 武器图标

背包武器的精确占格尺寸、单格/多格图片规范、当前种菜皮肤和后续完整武器图换皮方式，见：

```text
WEAPON_IMAGE_SIZE_GUIDE.md
```

武器图标在 `s_item.json` 里配置：

- `icon`：代码占位绘制类型。
- `iconAssetKey`：正式图标资源 key。

当前武器资源 key：

- `weapon_ball_icon`
- `weapon_bat_icon`
- `weapon_spear_icon`
- `weapon_shield_icon`
- `weapon_bomb_icon`
- `weapon_staff_icon`

资源放置建议：

```text
public/game-assets/weapons/weapon-bat-icon.png
```

推荐尺寸：

- 单个图标：`128x128` 或 `256x256`。
- 透明背景。
- 图标主体不要贴边，留 8 到 12 像素安全边距。
- 不要把品质框画进武器图标里，品质框由程序根据 `s_quality.color` 绘制。

## 面板和弹窗

当前面板大部分仍然用代码占位绘制，但后续建议逐步资源化：

- 暂停标题条：`ui_pause_title`
- 暂停面板：`ui_pause_panel`
- 设置面板：`ui_setting_panel`
- 确认框面板：`ui_confirm_panel`
- 结算面板：`ui_result_panel`
- 三选一卡牌底图：`ui_rogue_card`
- 背包棋盘底板：`ui_bag_board`
- 背包格子：`ui_bag_cell`
- 候选物品槽：`ui_bag_slot`

推荐做法：

- 按钮、面板尽量做可九宫格切片的图。
- 如果暂时不接九宫格，先提供固定尺寸 PNG/WebP。
- 所有文字尽量由程序显示，图片里少写中文，方便多语言和调参。

## 帧动画资源接入经验

当前项目已经验证过一条可用的帧动画链路：

```text
AI/美术原始 sprite sheet
-> public/game-assets/source/ 留底
-> 脚本切成透明 PNG 单帧
-> public/game-assets/characters|enemies|effects/.../frames/
-> s_asset.json 配置每一帧 asset key
-> s_animation.json 配置动画 key、fps、loop、anchor、scale
-> Pixi AnimatedSprite 播放
```

### 当前已接入示例：主角魔法师

当前战斗里已经把临时炮台替换为 Q 版魔法师主角：

- 原始绿底 sheet：`public/game-assets/source/wizard-attack-up-ai-green-sheet.png`
- 透明帧目录：`public/game-assets/characters/wizard_attack_up/frames/`
- 横排透明 sheet：`public/game-assets/characters/wizard_attack_up/wizard-attack-up-sheet.png`
- GIF 预览：`public/game-assets/characters/wizard_attack_up/wizard-attack-up.gif`
- 生成脚本：`scripts/generate-wizard-attack-sprite.mjs`
- 动画 key：`wizard_attack_up`
- 预览入口：`game.html?animtest=wizard_attack_up`

这个主角的运行规则：

- 不攻击时停在第 0 帧，作为站立状态。
- 背包武器触发攻击时播放 `wizard_attack_up`。
- 播完攻击动画后回到第 0 帧。
- 原来的弹道不能删除，表现应该是“主角挥杖/施法，把弹道从法杖附近打出去”。

### AI sprite sheet 切帧注意事项

AI 生成的 sprite sheet 经常不是严格网格，不能默认按整张图平均切成 4/6/8 格。

这次魔法师曾出现过两个问题：

- 按 8 等分切图时，中间释放帧的星星和法杖跨到相邻格，导致浏览器里像“两个主角从右往左滑动”。
- 最后一格实际是白边或空白，不是完整角色帧，直接使用会导致动画末尾闪空。

后续处理 AI sheet 时，优先按下面流程：

1. 先把原图放进 `public/game-assets/source/`，不要只留临时目录。
2. 用脚本做 chroma key 抠图，绿底或白边都转透明。
3. 先生成 contact sheet 检查每一帧是否只有一个主体。
4. 如果原图不是严格网格，手动指定每帧中心点或裁剪边界，不要硬按等分切。
5. 如果结尾缺帧，可以先复用第 0 帧收回，避免空白闪烁。
6. 每帧建议统一画布，例如 `160x160`、`256x256`，主体锚点对齐脚底或中心。
7. 更新 `s_asset.json` 和 `s_animation.json` 后，打开 `game.html?animtest=<动画key>` 预览。

### 动画表字段建议

`s_animation.json` 当前字段：

```json
{
  "key": "wizard_attack_up",
  "assetKey": "loose_frames",
  "frames": ["wizard_attack_up_00", "wizard_attack_up_01"],
  "fps": 12,
  "loop": false,
  "anchorX": 0.5,
  "anchorY": 0.78,
  "scale": 1,
  "hitFrame": 4,
  "soundKey": "sfx_magic_cast"
}
```

字段说明：

- `key`：动画 key，代码和数据表引用它。
- `assetKey`：当前 loose frame 可填 `loose_frames`；后续接图集时可填 atlas key。
- `frames`：帧 asset key 数组，必须在 `s_asset.json` 里能找到。
- `fps`：播放帧率。主角攻击建议 10 到 14，小怪移动 8 到 12，爆炸 12 到 18。
- `loop`：站立/移动可循环，攻击/死亡通常非循环。
- `anchorX` / `anchorY`：锚点。角色建议脚底附近，例如 `0.5 / 0.75~0.85`。
- `scale`：默认播放缩放。实际战斗里仍可按场景需要二次放大。
- `hitFrame`：伤害或弹道发射帧。后续如果要严格“挥到第几帧才发射”，优先用这个字段。
- `soundKey`：建议和 `s_audio_event.json` 对齐，播放时只用事件 key，不硬写音频路径。

### 战斗层级经验

替换炮台、怪物、弹道时要注意 Pixi 层级：

- `battleLayer`：地图背景、怪物、范围特效等战场对象。
- `uiLayer`：基地、血条、底部装备栏、按钮、弹窗入口等 HUD。
- `projectileLayer`：飞行弹道。弹道必须在基地/主角上方可见，否则会被底部 UI 遮住。
- 主角当前插在基地面板上方、状态文字和血条附近，要避免被血条和装备栏压住。

常见问题：

- 主角看不见：大概率被基地或装备栏 UI 遮住，先查层级，再查资源。
- 弹道看不见：可能起点在底部 UI 下面，或 projectile 层级低于 UI。
- 主角像在滑动：多半不是 AnimatedSprite 播放错，而是源 sheet 切帧切进了相邻角色。
- 动画变成粗糙占位：检查浏览器实际加载的帧是不是 AI sheet 导出的资源，而不是脚本临时绘制资源。

## 怪物动作

当前怪物是代码绘制的圆形占位，并用缩放/上下浮动模拟帧动画。后续建议改成 spritesheet。

标准动作名：

- `idle`：待机。
- `run`：移动。
- `attack`：攻击。
- `hit`：受击。
- `death`：死亡。

建议资源：

```text
public/game-assets/enemies/slime-idle-sheet.png
public/game-assets/enemies/slime-run-sheet.png
public/game-assets/enemies/slime-death-sheet.png
```

后续表字段建议加到 `s_monster.json`：

- `idleAnimKey`
- `runAnimKey`
- `attackAnimKey`
- `hitAnimKey`
- `deathAnimKey`
- `shadowAssetKey`

怪物替换建议：

- 小怪至少先做 `run` 和 `death`，能明显提升战斗质感。
- 如果资源紧张，`idle` 和 `run` 可以共用一套循环动画。
- 怪物移动时不要再叠加过强的代码缩放/上下浮动，避免和帧动画打架。
- 怪物死亡动画非循环，播完后再销毁节点。
- 怪物受击可以先用代码闪白/抖动，后续再接 `hitAnimKey`。

动画配置写在 `s_animation.json`：

```json
{
  "key": "enemy_slime_run",
  "assetKey": "enemy_slime_run_sheet",
  "frames": ["slime_run_0001", "slime_run_0002", "slime_run_0003"],
  "fps": 10,
  "loop": true,
  "anchorX": 0.5,
  "anchorY": 0.75,
  "scale": 1
}
```

推荐帧率：

- 小怪移动：8 到 12 fps。
- 攻击：10 到 15 fps。
- 死亡：12 到 18 fps，非循环。
- UI 闪光/奖励：12 到 18 fps。

## 攻击特效

当前攻击表现：

- 投射物：代码发光子弹和拖尾。
- AOE/毒圈：代码圆形范围圈。
- 伤害数字：Pixi Text。
- 命中特效：简单 Graphics 闪圈。

后续建议扩展资源 key：

在 `s_skill.json` 增加：

- `projectileAssetKey`：飞行物图片或动画。
- `castFxAssetKey`：释放特效。
- `hitFxAssetKey`：命中特效。
- `areaFxAssetKey`：范围持续特效。
- `soundKey`：释放或命中音效。

在 `s_animation.json` 增加：

- `fx_fire_hit`
- `fx_bomb_explosion`
- `fx_poison_loop`
- `fx_shield_cast`
- `fx_heal`
- `fx_coin_fly`
- `fx_level_up`
- `fx_merge`

特效资源建议：

- 爆炸：spritesheet，`512x512` 单帧或图集，8 到 12 帧。
- 弹道：可以先做 4 到 6 帧循环飞行物，例如火球、冰锥、魔法弹、飞刀。飞行时节点按运动方向旋转。
- 毒圈：可循环 spritesheet 或单张透明贴图旋转/缩放。
- 护盾：半透明 PNG/WebP 或循环帧动画。
- 金币飞行：小图标 + 程序轨迹。

弹道替换原则：

- 不要因为主角有攻击动作就删除弹道。广告 demo 里“角色动作 + 可见弹道 + 命中特效”组合最清楚。
- 弹道起点应该来自主角武器或法杖附近，不要继续用装备栏或屏幕底部硬编码点。
- 弹道动画、命中特效、范围特效都走 `s_skill.json` 的资源 key，再查 `s_animation.json`。
- 释放帧可以用 `hitFrame` 控制。先播放主角攻击动画，到了 `hitFrame` 再生成弹道，效果会更跟手。
- 弹道层级建议高于基地和主角，低于弹窗；不要被底部 UI 遮住。

## UI 动效建议

当前已有基础交互，但后续可加强：

- 按钮点击：缩放到 0.94 再回弹。
- 候选刷新：三格依次翻牌。
- 合成：两个物品吸附到目标点，播放 `fx_merge`。
- 放置成功：格子绿色闪光。
- 非法放置：红色震动。
- 关卡切换：地图图左右滑入，标题跟随淡入。
- 结算奖励：奖励图标从小到大弹出，金币数字滚动。

这些动效应由 UI 模块调用资源 key，不要把具体图片路径写进动效代码。

## 可选包装方向

当前玩法可以换成不同美术题材，数据结构不需要大改：

1. 废土机甲防守
   - 关卡图：废土平台、战车、炮塔。
   - 武器：扳手、电锯、火箭筒、能量盾。
   - 怪物：变异虫、机械小兵、废土 Boss。

2. 魔法背包塔防
   - 关卡图：浮空岛、魔法阵、城堡。
   - 武器：法球、魔杖、符文盾、爆裂药瓶。
   - 怪物：史莱姆、幽灵、石像。

3. 赛博玩具防守
   - 关卡图：桌面、玩具城堡、电子零件。
   - 武器：弹珠、玩具枪、磁铁、无人机。
   - 怪物：积木怪、发条虫、遥控 Boss。

4. 海盗宝藏背包
   - 关卡图：甲板、宝箱、海岛。
   - 武器：炮弹、短刀、鱼叉、朗姆酒。
   - 怪物：骷髅、水怪、海盗船长。

## 美术接入检查清单

每次换图后检查：

- `s_asset.json` 是合法 JSON。
- `url` 以 `/game-assets/...` 开头。
- 浏览器 Network 没有 404。
- 主界面关卡图没有拉伸变形。
- 按钮文字没有被图案遮挡。
- 武器图标在背包小格子里能看清。
- 肉鸽三选一卡牌图标不遮挡标题和描述。
- 结算奖励图标不遮挡数量。
- 手机竖屏下没有 UI 溢出。

验证命令：

```bash
node -e "const fs=require('fs'); for (const f of fs.readdirSync('public/gamedata').filter(f=>f.endsWith('.json'))) JSON.parse(fs.readFileSync('public/gamedata/'+f,'utf8')); console.log('json ok')"
npm run build
```

浏览器验证：

```text
http://localhost:5173/game.html
```

至少看：

- 主界面。
- 背包界面。
- 战斗界面。
- 暂停弹窗。
- 升级三选一。
- 结算界面。
