# 战斗角色、怪物、武器和特效帧动画资源设计

本文档是后续正式资源化的设计蓝图，给策划、美术、技术美术和后续 agent 使用。

当前先不要求改代码和现有表结构。本文只定义未来应该如何扩展，让主角、怪物、炮台底座、武器弹道、命中特效、地图滚动都能通过资源和配置替换，而不是继续依赖临时绘制。

## 设计目标

后续战斗表现希望从“占位图形”升级为“完整角色和特效动画系统”：

- 主角有站立、攻击、受击、死亡或失败等动作。
- 每一种怪物都有自己的移动、受击、攻击、死亡动作。
- 炮台底座或基地能配合地图滚动、受击、开火节奏做轻微晃动。
- 每一种武器有自己的飞行动作、命中特效和特殊效果。
- 地图能持续滚动，制造队伍向前推进的感觉。
- 策划和美术后续主要通过资源文件和配置表替换表现，尽量少改玩法代码。

## 核心思路

所有战斗表现拆成 5 类资源：

1. 角色动画：主角、守卫、炮台、NPC。
2. 怪物动画：小怪、精英怪、Boss。
3. 武器表现：弹道、飞行物、旋转武器、持续武器。
4. 命中特效：爆炸、斩击、毒液、火花、冰裂、雷击。
5. 地图和环境：滚动地图块、地面残留、环境粒子、镜头震动。

运行时不应该关心具体图片路径，而应该只使用 key：

```text
hero_mage_attack
enemy_slime_run
projectile_fireball_loop
hit_fire_burst
ground_poison_loop
base_wood_hit
```

资源路径由 `s_asset.json` 管，播放方式由 `s_animation.json` 管，技能和怪物只引用这些 key。

## 推荐资源目录

后续正式资源建议按类型拆目录：

```text
public/game-assets/
  source/
    # AI 原图、PSD、未切帧 sprite sheet、参考图
  characters/
    hero_mage/
      idle/
      attack/
      hit/
      death/
    base_wood/
      idle/
      hit/
      shake/
  enemies/
    slime/
      run/
      hit/
      attack/
      death/
    skeleton/
      run/
      hit/
      attack/
      death/
  effects/
    projectiles/
      fireball/
      knife/
      poison_bolt/
    hit/
      fire_burst/
      slash/
      poison_splash/
    ground/
      poison_loop/
      fire_area/
      ice_field/
    ui/
      level_up/
      coin_fly/
  levels/
    battle_map_forest/
    battle_map_ruins/
```

命名规则：

- 全部小写英文。
- 用短横线或下划线，不要空格。
- 源图可以放 `source/`，运行时资源放具体目录。
- 不要在运行时文件名里写 `final`、`new`、`v2` 这种版本噪音。

## 动作命名标准

### 主角动作

每个主角建议支持：

- `idle`：站立待机，循环。
- `attack`：普通攻击，非循环。
- `cast`：施法或蓄力，非循环或短循环。
- `hit`：受击，非循环。
- `death`：死亡或失败，非循环。
- `victory`：胜利展示，可选。

第一版最小资源：

- `idle`
- `attack`
- `hit`

当前魔法师主角已经验证过：

- 站立时停在第 0 帧。
- 攻击时播放 `wizard_attack_up`。
- 播完回到第 0 帧。

后续建议拆成更清晰的两个 key：

```text
hero_mage_idle
hero_mage_attack_up
```

### 怪物动作

每种怪物建议支持：

- `idle`：待机，循环。
- `run`：移动，循环。
- `attack`：攻击基地，非循环。
- `hit`：受击，非循环，2 到 4 帧即可。
- `death`：死亡，非循环。

第一版最小资源：

- `run`
- `death`

受击可以先用代码闪白、抖动、缩放补足。等美术资源足够，再加 `hit`。

### 炮台底座 / 基地动作

如果后续主角站在炮台或基地上，底座也可以动画化：

- `idle`：待机，轻微机械呼吸或火光。
- `attack`：开火或震动。
- `hit`：基地受击抖动、冒烟。
- `low_hp`：低血量破损状态，可选。
- `destroy`：基地被毁，可选。

地图滚动时，底座通常不真的跟地图走，而是在屏幕下方固定。为了配合“车队前进”感觉，可以加：

- 轻微上下晃动。
- 履带或轮子循环动画。
- 底部灰尘/烟雾循环动画。
- 背景地图滚动，基地只做小幅浮动。

## 武器和技能表现设计

每一种武器至少可以拆成 3 段表现：

```text
释放动作 -> 飞行动作 -> 命中特效
```

例如火球：

- 主角攻击动作：`hero_mage_attack_up`
- 释放特效：`cast_fire_flash`
- 弹道动画：`projectile_fireball_loop`
- 命中特效：`hit_fire_burst`
- 地面残留：无，或 `ground_fire_area_loop`

例如毒雾：

- 主角攻击动作：`hero_mage_attack_up`
- 弹道动画：`projectile_poison_bolt_loop`
- 命中特效：`hit_poison_splash`
- 地面持续：`ground_poison_loop`
- DOT 数值：走 `s_effect`

例如飞刀：

- 主角攻击动作：`hero_rogue_attack`
- 弹道动画：`projectile_knife_spin`
- 命中特效：`hit_slash_small`
- 是否旋转：跟随飞行方向旋转。

## 技能表现字段设计建议

后续可以在 `s_skill.json` 或单独 `s_skill_visual.json` 中扩展这些字段。

建议不要一次性强改当前表；可以先做新表验证。

```json
{
  "skillId": 201,
  "castAnimKey": "hero_mage_attack_up",
  "castFxAnimKey": "cast_magic_flash",
  "projectileAnimKey": "projectile_fireball_loop",
  "projectileRotateToTarget": true,
  "projectileScale": 1,
  "hitFxAnimKey": "hit_fire_burst",
  "groundFxAnimKey": "",
  "hitShake": 4,
  "hitFlashColor": "#ffffff",
  "soundEvent": "battle_fireball"
}
```

字段说明：

- `skillId`：绑定现有技能 id。
- `castAnimKey`：主角播放哪个攻击动作。
- `castFxAnimKey`：手部、法杖、炮口释放特效。
- `projectileAnimKey`：飞行动画。
- `projectileRotateToTarget`：弹道是否按飞行方向旋转。
- `projectileScale`：弹道缩放。
- `hitFxAnimKey`：命中特效。
- `groundFxAnimKey`：地面持续特效。
- `hitShake`：命中时怪物抖动强度。
- `hitFlashColor`：受击闪色。
- `soundEvent`：音效事件。

## 怪物表现字段设计建议

后续可以在 `s_monster.json` 里加视觉字段，或新建 `s_monster_visual.json`。

```json
{
  "monsterId": 301,
  "idleAnimKey": "enemy_slime_idle",
  "runAnimKey": "enemy_slime_run",
  "attackAnimKey": "enemy_slime_attack",
  "hitAnimKey": "enemy_slime_hit",
  "deathAnimKey": "enemy_slime_death",
  "shadowAssetKey": "enemy_shadow_soft",
  "hitFlashColor": "#ffffff",
  "hitShake": 3,
  "deathRemoveDelay": 0.35,
  "scale": 1
}
```

字段说明：

- `idleAnimKey`：待机动画。
- `runAnimKey`：移动动画。
- `attackAnimKey`：攻击基地动画。
- `hitAnimKey`：受击动画。
- `deathAnimKey`：死亡动画。
- `shadowAssetKey`：脚底阴影。
- `hitFlashColor`：受击闪色。
- `hitShake`：受击抖动幅度。
- `deathRemoveDelay`：死亡动画播完后多久移除。
- `scale`：整体缩放。

## 主角和基地表现字段设计建议

可以新建 `s_actor_visual.json` 或 `s_hero_visual.json`。

```json
{
  "key": "hero_mage",
  "idleAnimKey": "hero_mage_idle",
  "attackAnimKey": "hero_mage_attack_up",
  "hitAnimKey": "hero_mage_hit",
  "deathAnimKey": "hero_mage_death",
  "castSocketX": 34,
  "castSocketY": -96,
  "anchorX": 0.5,
  "anchorY": 0.78,
  "scale": 1.65
}
```

关键点：

- `castSocketX` / `castSocketY` 表示弹道从角色哪里发出，例如法杖顶端。
- 后续不同主角可以有不同发射点。
- 不要把弹道起点写死在屏幕底部或装备栏位置。

基地或炮台底座可以类似：

```json
{
  "key": "base_wood",
  "idleAnimKey": "base_wood_idle",
  "hitAnimKey": "base_wood_hit",
  "lowHpAnimKey": "base_wood_low_hp",
  "shakeOnAttack": 2,
  "shakeOnHit": 8,
  "scrollBob": 2
}
```

## 地图滚动和基地晃动

正式地图建议采用循环地图块：

- 2 到 3 张竖向地图块。
- 地图块持续向下滚动。
- 滚出屏幕后移动到最上方循环。
- 主角、基地、装备栏、HUD 固定在屏幕下方。

为了让基地和主角不像“贴在屏幕上”，可以加轻微动态：

- 基地 `scrollBob`：跟随地图滚动做 1 到 3 像素上下浮动。
- 主角 `idle`：循环呼吸或轻微摇晃。
- 炮台底座 `idle`：机械轻晃、履带动、火光动。
- 地图上加少量环境粒子，例如落叶、灰尘、雾气。

注意：

- 地图滚动不要影响 HUD。
- 地图滚动不要影响背包装备栏。
- 怪物可以使用世界坐标，显示时叠加 camera offset。
- 地面持续特效应该跟地图/怪物坐标走，不应该固定在屏幕 UI 上。

## 层级设计

推荐战斗层级从下到上：

```text
mapLayer              # 滚动地图块
groundFxLayer         # 毒圈、火圈、冰面等地面效果
monsterShadowLayer    # 怪物阴影
monsterLayer          # 怪物本体
baseLayer             # 基地、炮台底座
heroLayer             # 主角
projectileLayer       # 弹道、飞刀、魔法弹
hitFxLayer            # 命中特效、爆炸、斩击
damageTextLayer       # 伤害数字、金币数字
hudLayer              # 顶部/底部 UI、暂停按钮、装备栏
modalLayer            # 暂停、升级三选一、结算弹窗
```

层级经验：

- 主角不能被基地面板完全挡住。
- 弹道必须高于基地和主角，否则像没发射。
- 地面毒圈必须低于怪物，否则会盖住怪物。
- 伤害数字永远高于怪物和特效。
- 弹窗永远最高。

## 资源提交规格

### 透明 PNG 序列帧

最推荐：

```text
fx-fireball-fly-00.png
fx-fireball-fly-01.png
fx-fireball-fly-02.png
fx-fireball-fly-03.png
```

优点：

- 最容易接入。
- 不容易切错。
- 每帧可以单独检查。

### 绿底 sprite sheet

也可以：

```text
fx-fireball-fly-sheet.png
```

要求：

- 纯绿 `#00ff00` 或透明背景。
- 单行横排优先。
- 每帧尺寸一致。
- 如果不是严格网格，需要告诉每帧中心点或由技术手动调整。
- 不要带文字、编号、水印。

### 图集 atlas

后期资源多了建议打 atlas：

```text
battle-fx.atlas.json
battle-fx.png
```

优点：

- 减少请求数。
- 减少纹理切换。
- 更适合正式 H5。

第一版 demo 可以先 loose frames，验证效果后再打 atlas。

## 第一阶段落地建议

为了最快接近参考视频，建议按这个顺序做资源：

1. 主角 `idle` 和 `attack`。
2. 3 种基础弹道：火球、飞刀、毒液弹。
3. 3 种命中特效：火爆、小斩击、毒液溅射。
4. 1 种地面持续特效：毒圈或火圈。
5. 2 种怪物：普通小怪、精英怪，各有 `run` 和 `death`。
6. 受击代码反馈：闪白、抖动、伤害数字。
7. 2 到 3 张循环地图块。

这个组合能覆盖大部分广告 demo 画面：

- 角色有动作。
- 攻击有飞行路径。
- 命中有爆点。
- 怪物死亡有反馈。
- 地图有推进感。

## 第二阶段升级建议

第一阶段跑通后再补：

- 主角 `hit`、`death`、`victory`。
- 怪物 `hit`、`attack`。
- Boss 专属动作。
- 不同武器的专属释放特效。
- 地面残留淡出。
- 金币飞行。
- 屏幕轻震。
- 多主题地图块。

## 验收标准

策划验收时可以按下面检查：

- 主角不攻击时是否稳定站立，不乱滑。
- 主角攻击时是否能看出动作方向。
- 弹道是否从主角武器或法杖附近发出。
- 弹道是否清楚可见，而不是被 UI 或基地挡住。
- 命中特效是否出现在怪物身上或脚下。
- 怪物受击时是否有闪白、抖动或 hit 动作。
- 怪物死亡是否有清楚的消失过程。
- 地面持续特效是否在怪物脚下，不遮挡怪物主体。
- 地图滚动时 HUD 是否稳定不漂移。
- 多个怪物和多个特效同时出现时画面是否还能读清楚。

## 对现有设计的兼容性

这个方案可以在当前设计上逐步扩展，不需要推翻现有玩法：

- 当前 `s_asset.json` 已经能管理资源 key。
- 当前 `s_animation.json` 已经能描述帧动画。
- 当前 `s_skill.json` 已经有技能类型、CD、伤害、范围、颜色等基础字段。
- 当前 `s_monster.json` 已经有怪物数值字段。
- 后续只需要逐步增加视觉字段或新增视觉配置表。

推荐落地方式：

1. 先新增视觉配置表，不直接改动旧逻辑。
2. 让旧字段继续作为 fallback。
3. 新资源缺失时自动回退到当前占位表现。
4. 每接入一个资源类型，都保留 `game.html?animtest=<动画key>` 预览入口。

这样后续策划和美术可以逐步替换正式资源，不会因为某个资源缺失导致战斗不可玩。

