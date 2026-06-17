# 战斗地图滚动和特效帧动画方案

本文档给策划、美术和后续美术向 agent 使用。目标是把当前战斗从“绿色占位背景 + 简单几何特效”升级成接近参考视频的正式表现：地图持续推进、主角固定在下方攻击、怪物从上方压下来、弹道和命中特效清晰可见。

## 目标效果

参考视频的视觉重点不是角色真的一路向下走，而是：

- 地图层持续向下滚动，制造队伍向前推进的感觉。
- 主角和基地固定在屏幕下方安全区，保持玩家注意力。
- 怪物从上方进入战场，沿地图区域向下压迫。
- 攻击表现由“主角动作 + 可见弹道 + 命中特效 + 伤害数字”叠加组成。
- 受击反馈要明显，包括闪白、抖动、伤害数字、爆点、地面残留等。

## 地图方案

### 推荐方案：循环地图块

demo 阶段推荐先做循环地图块，而不是一张超长地图。

做法：

- 准备 2 到 3 张可以上下衔接的竖向地图块。
- 游戏中让地图块持续向下移动。
- 地图块滚出屏幕后，移动到最上方继续循环。
- 主角、基地、装备栏和 HUD 不跟地图一起滚动。

优点：

- 包体小。
- 实现快。
- 适合广告 demo。
- 后续可以直接扩展为多关卡、多主题地图。

### 地图资源规格

建议先做这些资源：

```text
public/game-assets/levels/
  battle-map-forest-01.webp
  battle-map-forest-02.webp
  battle-map-forest-03.webp
```

尺寸建议：

- 宽度：`720` 或 `768`。
- 高度：`1280` 到 `1600`。
- 格式：WebP 优先；如果需要透明层，再用 PNG。
- 构图：中间留主要战斗通道，两侧可以有树、石头、墙体、废墟等装饰。
- 上下边缘：尽量能自然衔接，不要出现明显断层。
- 画面下方不要画死 UI、基地和文字，这些由程序显示。

### 地图配置建议

后续可以新增或扩展配置表，例如 `s_battle_map.json`：

```json
{
  "key": "battle_map_forest",
  "tiles": ["battle_map_forest_01", "battle_map_forest_02", "battle_map_forest_03"],
  "scrollSpeed": 26,
  "loop": true,
  "theme": "forest",
  "spawnAreaTop": 120,
  "spawnAreaBottom": 520
}
```

字段含义：

- `tiles`：地图块资源 key 列表。
- `scrollSpeed`：地图向下滚动速度，单位可按像素/秒理解。
- `loop`：是否循环。
- `theme`：主题名，方便关卡引用。
- `spawnAreaTop` / `spawnAreaBottom`：怪物出生和活动区域的推荐范围。

### 后续升级方案：分段地图块

如果 demo 数据好，后续可以从循环地图块升级到分段地图：

- 入口段。
- 普通刷怪段。
- 精英怪段。
- 宝箱/补给段。
- Boss 段。

运行时按配置拼接，旧段回收，新段进入。这样可以做关卡节奏和场景变化，但第一版不建议过早复杂化。

## 特效方案

参考视频里的特效不是单一素材，而是多层叠加：

- 主角攻击帧动画。
- 弹道飞行帧动画。
- 命中特效帧动画。
- 地面持续特效帧动画。
- 怪物受击闪白、抖动和击退。
- 伤害数字上飘。
- 击杀爆点、金币飞行、音效和屏幕轻震。

单靠帧动画可以做到 70% 到 80% 的效果；再加代码层的抖动、闪白、拖尾、数字和震动，就能接近参考视频的广告 demo 质感。

## 特效资源类型

### 1. 弹道飞行物

用途：

- 火球。
- 冰锥。
- 魔法弹。
- 飞刀。
- 回旋斧。
- 毒液弹。

资源规格：

- 4 到 6 帧循环。
- 每帧 `128x128` 或 `160x160`。
- 透明 PNG 序列帧最佳。
- 如果是 sprite sheet，建议单行横排。
- 默认朝右或朝上都可以，程序可以按飞行方向旋转。

示例命名：

```text
public/game-assets/effects/projectiles/fx-fireball-fly-sheet.png
public/game-assets/effects/projectiles/fx-ice-lance-fly-sheet.png
public/game-assets/effects/projectiles/fx-magic-bolt-fly-sheet.png
```

### 2. 命中特效

用途：

- 小爆炸。
- 火花。
- 斩击。
- 毒液溅射。
- 冰裂。
- 雷击。

资源规格：

- 6 到 10 帧。
- 非循环。
- 每帧 `160x160` 或 `256x256`。
- 中心点就是命中点。
- 背景透明，或者纯绿 `#00ff00` 方便抠图。

示例命名：

```text
public/game-assets/effects/hit/fx-fire-hit-sheet.png
public/game-assets/effects/hit/fx-slash-hit-sheet.png
public/game-assets/effects/hit/fx-poison-splash-sheet.png
```

### 3. 地面持续特效

用途：

- 毒圈。
- 火圈。
- 冰霜区域。
- 闪电场。
- 治疗圈。

资源规格：

- 6 到 12 帧循环。
- 每帧 `256x256` 或 `384x384`。
- 透明背景。
- 特效主体尽量在画面中心，方便按怪物脚下或目标点摆放。
- 可以有半透明边缘，但不要带实底。

示例命名：

```text
public/game-assets/effects/ground/fx-poison-loop-sheet.png
public/game-assets/effects/ground/fx-fire-area-loop-sheet.png
public/game-assets/effects/ground/fx-ice-field-loop-sheet.png
```

### 4. 怪物动作和受击

最低成本方案：

- `run`：移动循环动画。
- `death`：死亡动画。
- 受击用代码闪白、抖动、缩放。

进阶方案：

- `idle`：待机。
- `run`：移动。
- `attack`：攻击。
- `hit`：受击 2 到 4 帧。
- `death`：死亡 6 到 10 帧。

示例命名：

```text
public/game-assets/enemies/slime/slime-run-sheet.png
public/game-assets/enemies/slime/slime-hit-sheet.png
public/game-assets/enemies/slime/slime-death-sheet.png
```

## Sprite Sheet 提交规则

策划或美术给资源时，最好同时说明这些信息：

```text
资源用途：火球飞行
动画 key 建议：fx_fireball_fly
帧数：6
播放方式：循环
帧尺寸：128x128
排列方式：单行横排
背景：透明 / 纯绿 #00ff00
锚点：中心
是否旋转：跟随飞行方向旋转
```

如果给的是 AI 生成图，要特别注意：

- AI sprite sheet 不一定严格等分。
- 不要默认按整图平均切帧。
- 需要先生成 contact sheet 检查每帧是否只有一个主体。
- 如果某帧跨格，要手动指定裁剪中心或边界。
- 如果最后一帧空白，可以复用第 0 帧做收尾。

## 配置表接入方向

### s_asset.json

每一帧需要有稳定资源 key：

```json
{
  "key": "fx_fireball_fly_00",
  "type": "image",
  "url": "/game-assets/effects/projectiles/fireball/frames/fx-fireball-fly-00.png",
  "preloadGroup": "battle",
  "fallbackKey": ""
}
```

### s_animation.json

动画配置示例：

```json
{
  "key": "fx_fireball_fly",
  "assetKey": "loose_frames",
  "frames": ["fx_fireball_fly_00", "fx_fireball_fly_01", "fx_fireball_fly_02"],
  "fps": 12,
  "loop": true,
  "anchorX": 0.5,
  "anchorY": 0.5,
  "scale": 1
}
```

### s_skill.json

后续建议给技能补这些字段：

```json
{
  "projectileAnimKey": "fx_fireball_fly",
  "hitFxAnimKey": "fx_fire_hit",
  "groundFxAnimKey": "",
  "castFxAnimKey": "fx_magic_cast",
  "soundKey": "battle_fireball"
}
```

含义：

- `projectileAnimKey`：飞行中的弹道动画。
- `hitFxAnimKey`：命中瞬间播放的动画。
- `groundFxAnimKey`：持续留在地面的动画。
- `castFxAnimKey`：主角释放瞬间的手部或法杖光效。
- `soundKey`：释放或命中音效事件。

## 层级规则

战斗里建议按下面层级：

```text
地图背景
地面持续特效
怪物
主角/基地
弹道
命中特效
伤害数字
HUD 和弹窗
```

注意：

- 弹道不能被基地和装备栏遮住。
- 地面毒圈应该在怪物脚下，不要盖住怪物主体。
- 伤害数字永远在最上层。
- 主角有攻击动作后，弹道仍然必须保留，不能只靠动作表达攻击。

## 落地优先级

第一阶段，先做最能提升广告观感的内容：

1. 主角攻击动画。
2. 可见弹道飞行物。
3. 命中特效。
4. 怪物 run/death。
5. 伤害数字、闪白、抖动。

第二阶段，再补范围和持续表现：

1. 毒圈、火圈、冰霜区。
2. 击杀爆点。
3. 金币飞行。
4. 屏幕轻震。
5. 怪物 hit/attack 动作。

第三阶段，做地图推进感：

1. 2 到 3 张循环地图块。
2. 地图块滚动。
3. 怪物按地图区域出生。
4. 关卡主题切换。
5. 分段地图和 Boss 段。

## 验收标准

策划验收时重点看：

- 地图是否有持续推进感，但 UI 不漂移。
- 主角攻击、弹道、命中三者是否能连起来看懂。
- 怪物受击是否有明确反馈。
- 伤害数字是否清楚但不遮挡太多。
- 多个怪物同时受击时画面是否乱。
- 手机竖屏下是否还清晰。
- 资源替换是否只需要改表和资源，不需要大改玩法代码。

