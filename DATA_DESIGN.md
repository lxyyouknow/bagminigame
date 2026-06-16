# 背包合成防守 Demo 数据设计说明

本文档给后续数据向 agent 或策划使用。目标是让关卡、难度、武器、怪物、经济、肉鸽强化尽量通过 `public/gamedata/` 修改，不直接改玩法代码。

## 当前数据目录

所有运行时配置表放在：

```text
public/gamedata/
```

当前表：

- `s_level.json`：关卡主表。
- `s_wave.json`：波次刷怪表。
- `s_monster.json`：怪物表。
- `s_item.json`：背包武器/物品表。
- `s_item_shape.json`：背包形状表。
- `s_quality.json`：品质和合成表。
- `s_skill.json`：武器技能表。
- `s_effect.json`：技能附加效果表。
- `s_rogue_option.json`：升级三选一强化表。
- `s_economy.json`：经济、消耗、经验、广告点位表。
- `s_comstr.json`：通用弹窗文案表。
- `s_asset.json`：资源 key 到图片/图集/音效路径。
- `s_ui.json`：UI 皮肤 key 到资源 key。
- `s_ui_layout.json`：UI 布局配置，当前主要界面已接入，用于位置、尺寸、字号、显隐。
- `s_audio.json`：背景音乐、按钮音、背包音、战斗音、结算音的资源和性能配置。
- `s_audio_event.json`：玩法事件到音频 key 的映射。
- `s_animation.json`：帧动画配置，当前为预留和少量占位。

## UI 布局配置：s_ui_layout

路径：

```text
public/gamedata/s_ui_layout.json
```

目标是让策划或美术 agent 调整界面摆放时，只改配置表，不改功能代码。当前 `Loading`、主界面、背包、战斗 HUD、暂停、设置、确认、三选一、结算等主要界面已接入。

常用字段：

- `scene`：界面名，例如 `loading`、`main`、`bag`、`battle`、`pause`、`setting`、`confirm`、`rogue`、`result`。
- `key`：组件 key，例如 `side_minigame`、`side_game_circle`、`start_button`。
- `anchor`：屏幕基准点，支持 `topLeft`、`topCenter`、`topRight`、`centerLeft`、`center`、`centerRight`、`bottomLeft`、`bottomCenter`、`bottomRight`。
- `x` / `y`：相对基准点偏移。
- `width` / `height`：组件尺寸。
- `iconSize`：图标尺寸，可选。
- `labelOffsetY`：文字相对图标中心的纵向偏移，可选。
- `fontSize`：字号，可选。
- `scale`：关卡预览图等组件的缩放，可选。
- `gap`：列表、候选槽、卡牌组、装备栏的间距，可选。
- `visible`：是否显示。
- `desc`：中文说明。

例子：右侧“小游戏”按钮偏左或偏右，只改这一行的 `x`；偏上或偏下，只改 `y`。

```json
{
  "scene": "main",
  "key": "side_minigame",
  "anchor": "topRight",
  "x": -78,
  "y": 104,
  "width": 64,
  "height": 82,
  "iconSize": 52,
  "labelOffsetY": 28,
  "fontSize": 14,
  "visible": true,
  "desc": "主界面右侧小游戏入口，x 为相对右边缘偏移"
}
```

原则：

- 调位置、尺寸、字号、显隐：只改 `s_ui_layout.json`。
- 换图片：改 `s_asset.json` 和 `s_ui.json`。
- 改点击行为、打开新系统、扣资源、跳转：才改 `src/scenes/WndMain.ts` 等功能代码。
- 后续策划提示词只要是“界面元素摆放不满意”，默认先查 `s_ui_layout.json` 的 `scene/key/desc`，不要全局搜索代码。

## 当前 3 关定位

第 1 关：`1. 失落荒野`

- 教学关。
- 初始背包 `3x3`。
- `winWave = 3`。
- 武器池偏基础：弹力球、短棍、长矛、盾帽。
- 目标是让玩家理解拖拽、放置、开始战斗、基础合成。

第 2 关：`2. 毒雾裂谷`

- 组合关。
- 初始背包 `3x3`，最大可扩到 `4x4`。
- `winWave = 5`。
- 开始引入范围爆炸、更多怪物和更明显的升级三选一。
- 目标是让玩家感受到空间规划和技能组合。

第 3 关：`3. 钢铁围城`

- 压力关。
- 初始背包 `4x4`，最大 `4x5`。
- `winWave = 6`。
- 加入更复杂形状、史诗品质、小 Boss。
- 目标是测试背包规划、合成和强化选择的压力。

## 关卡配置：s_level

核心字段：

- `id`：关卡 id。
- `name`：显示名。
- `desc`：策划备注/描述。
- `theme`：战斗背景占位主题，目前支持 `green`、`purple`、`steel`。
- `initRows` / `initCols`：初始背包行列。
- `maxRows` / `maxCols`：最大扩展行列。
- `initGold`：开局金币。
- `baseHp`：我方基地生命。
- `baseArmor`：我方护甲。
- `waveGroupId`：引用 `s_wave` 的波次组。
- `shopPoolId`：引用 `s_item.pools`，决定该关刷新池。
- `roguePoolId`：决定该关可出现哪些肉鸽选项。
- `winWave`：结算显示和胜利波次数。
- `mapAssetKey`：主界面关卡地图正式图资源 key。
- `lockedMapAssetKey`：锁定态或未通关态关卡图资源 key。

调关卡难度优先顺序：

1. 调 `s_wave` 的怪物数量、间隔和出现时间。
2. 调 `s_monster` 的血量、速度、护甲、攻击。
3. 调 `s_level` 的 `baseHp`、`baseArmor`、初始金币、背包大小。
4. 调 `s_item` 的刷新权重和关卡池。
5. 调 `s_skill` 的伤害、CD、范围。

## 波次配置：s_wave

字段：

- `waveGroupId`：波次组，和 `s_level.waveGroupId` 对应。
- `wave`：第几波。
- `time`：从战斗开始后的刷怪时间点，单位秒。
- `monsterId`：怪物 id。
- `count`：本组刷怪数量。
- `interval`：每只怪之间的间隔。
- `spawn`：出生点策略，目前为预留。
- `rewardGold`：波次奖励预留。

建议：

- 教学关前 3 到 5 秒不要刷太多怪，让玩家看到武器攻击。
- 第 2 关开始可以用小怪密集波测试 AOE。
- Boss 波建议单独一行，`count = 1`，怪物表 `boss = true`。
- 如果战斗时间太长，优先减少怪物血量或波次间隔，而不是单纯加我方伤害。

## 怪物配置：s_monster

字段：

- `hp`：生命。
- `armor`：护甲，直接降低伤害。
- `speed`：移动速度。
- `attack`：撞到基地时造成的伤害。
- `gold`：击杀金币。
- `exp`：击杀经验。
- `radius`：碰撞和占位体积。
- `color`：当前占位图颜色。
- `boss`：是否 Boss。

后续美术接入时，建议增加：

- `idleAnimKey`
- `runAnimKey`
- `attackAnimKey`
- `hitAnimKey`
- `deathAnimKey`
- `hitSize`
- `shadowAssetKey`

## 武器配置：s_item

字段：

- `id`：具体物品 id。不同品质是不同 id。
- `baseId`：同一武器族 id，用于合成判断。
- `name`：显示名。
- `quality`：品质 id，引用 `s_quality`。
- `shapeId`：形状 id，引用 `s_item_shape`。
- `icon`：代码占位绘制类型。
- `iconAssetKey`：正式武器图标资源 key。
- `skillId`：战斗技能，引用 `s_skill`。
- `mergeToId`：合成后的物品 id，`0` 表示不能继续合成。
- `weight`：刷新权重。
- `pools`：出现在哪些商店池/关卡池。

合成规则当前是：

- `baseId` 相同。
- `quality` 相同。
- `mergeToId` 不为 0。
- 当前实现是两件合成一件更高品质。

新增武器流程：

1. 在 `s_item_shape` 里确认或新增形状。
2. 在 `s_skill` 里新增技能。
3. 在 `s_item` 里按品质新增 1 到 N 行。
4. 配好 `mergeToId` 链。
5. 把该武器加入对应 `pools`。
6. 在 `s_asset` 里加 `weapon_xxx_icon`，有图时填 `url`。

## 形状配置：s_item_shape

字段：

- `id`：形状 id。
- `name`：显示名/策划备注。
- `cells`：占用格子坐标数组，例如 `[[0,0],[1,0]]`。
- `allowRotate`：是否允许旋转，当前 v1 预留但还没实现旋转。
- `previewScale`：预览缩放预留。

坐标规则：

- `[0,0]` 是拖拽物的左上基准格。
- 横向向右 x 增加。
- 纵向向下 y 增加。

## 品质配置：s_quality

字段：

- `id`：品质 id。
- `name`：品质名称。
- `color`：品质边框颜色。
- `attackMul`：攻击倍率。
- `mergeNeed`：合成需求数量，当前代码实际按 2 件合成，字段为后续扩展。
- `nextQuality`：下一品质 id。

建议品质节奏：

- 白/绿品质用于教学和前期。
- 蓝/紫品质用于第 2、3 关。
- 如果后续加入橙色品质，要同步增加 `s_item.mergeToId` 链和刷新权重。

## 技能配置：s_skill / s_effect

`s_skill` 字段：

- `type`：攻击类型，目前支持 `projectile`、`melee`、`aoe`、`dot`、`shield`、`heal`。
- `attack`：基础攻击力。
- `cd`：冷却时间。
- `range`：射程预留。
- `speed`：投射物速度。
- `radius`：范围半径。
- `targetRule`：目标规则，目前常用 `lowestY`、`cluster`。
- `effectId`：附加效果，引用 `s_effect`。
- `color`：占位特效颜色。

`s_effect` 字段：

- `type`：效果类型，例如 `slow`、`shield`、`heal`。
- `value`：效果值。
- `duration`：持续时间。

后续建议扩展字段：

- `projectileAssetKey`
- `hitFxAssetKey`
- `castFxAssetKey`
- `soundKey`
- `shakePower`
- `hitFrame`

## 肉鸽三选一：s_rogue_option

字段：

- `id`：选项 id。
- `poolId`：池 id。当前逻辑是 `poolId <= level.roguePoolId` 的选项可出现。
- `title` / `desc`：显示文字。
- `icon`：图标占位字段。
- `weight`：随机权重。
- `effectType`：效果类型。
- `effectTarget`：效果目标。
- `effectValue`：效果值。
- `maxStack`：最大叠加次数预留。

当前已支持的 `effectType`：

- `attackMul`：总攻击倍率。
- `cdMul`：冷却倍率，通常小于 1 表示更快。
- `heal`：立即回血。
- `radiusMul`：范围倍率。
- `dotBoost`：持续伤害流派增强。
- `armorAdd`：护甲增加。
- `qualityAttackMul`：指定品质攻击增强。
- `overload`：过载攻击增强。
- `repair`：维修回血并加护甲。

## 经济和广告：s_economy

字段：

- `key`：经济项 key。
- `value`：数值。
- `adPlacement`：广告点位 id。
- `desc`：说明。

当前关键项：

- `bag_refresh_free_count`：免费刷新次数。
- `bag_refresh_gold_cost`：金币刷新价格。
- `bag_expand_gold_cost`：扩格价格。
- `exp_need_base`：升级经验基数。

广告原则：

- 玩法层只调用 `AdService.showRewardedAd(placementId)`。
- 点位 id 放在数据表，不在按钮里硬编码真实 SDK。
- 当前 demo mock 广告永远返回成功。

## 通用文案：s_comstr

用于通用确认框 `WndConfirm`。

字段：

- `id`：文案 id。
- `confirmType`：确认行为类型。
- `title`：标题。
- `content`：正文。
- `cancelText`：取消按钮。
- `confirmText`：确认按钮。

当前：

- `id = 1` / `confirmType = 1`：战斗中退出当前关卡并回到主界面。
- `id = 2` / `confirmType = 2`：重新开始当前关卡预留。

新增确认类功能时，先加 `s_comstr`，再在对应 UI 模块里调用。

## 音频配置：s_audio / s_audio_event

音频详细说明见 `AUDIO_DESIGN.md`。

`s_audio` 控制具体音频资源：

- `key`：音频资源 key。
- `type`：`music` 或 `sfx`。
- `url`：正式音频路径，留空时使用占位策略。
- `preloadGroup`：预加载组，例如 `main`、`bag`、`battle`、`ui`。
- `loop`：是否循环。
- `volume`：单条音频基础音量。
- `maxConcurrent`：同一音效最大并发数。
- `generatedFreq`：无正式音效时的生成音频率，BGM 填 `0`。

`s_audio_event` 控制玩法调用：

- `event`：玩法事件 key，例如 `ui_click`、`bag_merge`、`battle_hit`。
- `audioKey`：引用 `s_audio.key`。
- `category`：`music` 或 `sfx`。
- `cooldownMs`：事件冷却，防止高频音效卡顿。

新增音频时，不要在玩法代码里写音频路径。先加 `s_audio`，再加 `s_audio_event`，玩法只调用事件 key。

## 数据修改验证

每次改数据表后至少执行：

```bash
node -e "const fs=require('fs'); for (const f of fs.readdirSync('public/gamedata').filter(f=>f.endsWith('.json'))) JSON.parse(fs.readFileSync('public/gamedata/'+f,'utf8')); console.log('json ok')"
npm run build
```

如果涉及难度、关卡、刷新池、合成链，还要在浏览器打开：

```text
http://localhost:5173/game.html
```

至少验证：

- 能进选关。
- 能进背包。
- 候选武器能刷新。
- 武器能拖入背包。
- 能进入战斗。
- 能结算或失败。
