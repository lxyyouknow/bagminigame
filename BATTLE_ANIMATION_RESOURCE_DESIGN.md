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

## 当前技能表现字段

当前已经直接在 `s_skill.json` 接入弹道和命中特效字段：

```json
{
  "id": 201,
  "type": "projectile",
  "speed": 720,
  "projectileAnimKey": "projectile_tomato_spin",
  "hitAnimKey": "hit_tomato_burst"
}
```

字段说明：

- `speed`：弹道每秒移动像素，决定飞行速度，不由动画帧率决定。
- `projectileAnimKey`：弹道循环动画 key，对应 `s_animation.json`。
- `hitAnimKey`：命中时播放的非循环动画 key。
- 不配置 `projectileAnimKey` 时，运行时回退到原有代码占位表现。
- `shield`、`heal` 这类辅助技能不配置攻击弹道。

当前测试阶段，所有进攻型技能统一配置为番茄弹道和番茄爆炸。每种武器的速度直接在 `public/gamedata/s_skill.json` 修改：

- 番茄 `201/202/203`：`720/760/820`。
- 胡萝卜 `211/212/213`：`700/740/780`。
- 小麦 `221/222/223`：`850/900/960`。
- 辣椒 `241/242/243`：`680/720/760`。
- 卷心菜 `251/252`：`700/760`。

## 已验证资源：小僵尸、毒蝠、番茄弹道和命中爆炸

### 小僵尸移动

```text
源图集目录：public/game-assets/source/zombie-walk-down-video-20260623-105208/
运行帧目录：public/game-assets/enemies/zombie_walk_down/frames/
导入脚本：scripts/import-zombie-walk-video-sheet.py
生成入口：scripts/generate-zombie-walk-sprite.mjs
动画 key：zombie_walk_down
怪物字段：s_monster.json -> runAnimKey
规格：256x256，17 帧，12 FPS，loop=true，anchor=(0.5, 0.92)，scale=0.5
```

小僵尸来自 lxy 自行导出的 TexturePacker/Cocos 风格图集，不再要求固定 8 帧。导入脚本会读取 `spritesheet_*.json` 的真实帧坐标，按 `001.png`、`002.png` 这类数字帧名排序，重新归一化到 `256x256` 透明画布，再写入运行时散帧。

小僵尸是地面怪，锚点按脚底对齐：

- `anchorX=0.5`
- `anchorY=0.92`
- 每帧底部留安全边距，避免脚被裁切。
- QA 脚本：`tests/check_zombie_walk_frames.py`。

### 毒蝠飞行

```text
源图集目录：public/game-assets/source/poison-bat-fly-down-video-20260623-112242/
运行帧目录：public/game-assets/enemies/poison_bat_fly_down/frames/
导入脚本：scripts/import-poison-bat-fly-sheet.py
动画 key：poison_bat_fly_down
怪物字段：s_monster.json -> runAnimKey
规格：256x256，18 帧，15 FPS，loop=true，anchor=(0.5, 0.55)，scale=0.45
```

毒蝠同样来自多张 TexturePacker/Cocos 风格图集，源目录包含 `spritesheet_1/2/3.json + .png + .plist`。运行时只依赖 JSON 和 PNG，`.plist` 作为源文件留档。

毒蝠是飞行怪，翼展很宽，处理策略和地面怪不同：

- 画布仍统一 `256x256`，方便 `AnimatedSprite` 加载。
- 主体居中，而不是脚底对齐。
- `anchorY` 用 `0.55`，让阴影和碰撞点接近身体中心偏下。
- `scale` 用 `0.45`，避免翼展在战斗里过大。
- 帧率用 `15 FPS`，突出小型飞行敌人的速度感。
- QA 脚本：`tests/check_poison_bat_frames.py`。

## TexturePacker / 视频序列帧图集通用导入规范

以后 lxy 可以继续把不同动作导出成这种图集文件夹，帧数不需要固定。走路 17 帧、飞行 18 帧、攻击 12 帧、死亡 20 帧都可以，`s_animation.json.frames` 按实际帧数配置。

推荐交付目录：

```text
video-frames-20260623-112242_sheet/
  spritesheet_1.json
  spritesheet_1.png
  spritesheet_1.plist   # 可选，留档用
  spritesheet_2.json    # 帧多时可以拆多张
  spritesheet_2.png
```

导入后整理目录：

```text
public/game-assets/source/<asset-name>-video-<timestamp>/
  spritesheet_1.json
  spritesheet_1.png
  spritesheet_1.plist

public/game-assets/<category>/<anim-key>/
  frames/
    <file-prefix>-00.png
    <file-prefix>-01.png
  <file-prefix>-sheet.png
  <file-prefix>.gif
  <file-prefix>-contact-sheet.jpg
  metadata.json
```

适用类型：

- 主角：`public/game-assets/characters/<hero_action>/`
- 怪物：`public/game-assets/enemies/<monster_action>/`
- 武器弹道：`public/game-assets/effects/projectiles/<projectile_action>/`
- 命中特效：`public/game-assets/effects/hit/<hit_action>/`
- 地面持续特效：`public/game-assets/effects/ground/<ground_action>/`

### 源图集要求

- 每个文件夹只放一个动作，例如 `zombie_walk_down`、`poison_bat_fly_down`、`hero_guardian_attack_up`。
- 帧名必须能按数字排序，例如 `001.png`、`002.png`、`003.png`。
- 优先透明 PNG。黑色预览底没关系，只要 PNG alpha 是透明。
- `spritesheet_*.json` 必须包含每帧的 `frame.x/y/w/h`。
- 暂不支持 `rotated=true` 的旋转帧；导出图集时关闭旋转。
- 不要把多个角色、文字、水印、血条、UI 混进同一个动作图集。
- 同一个动作允许拆成多张 `spritesheet_1/2/3`，脚本会合并排序。

### 动画生成工具选择

- 不默认强制使用 `Agent Sprite Forge 2d`。如果 lxy 明确要求使用该工具，再按它的格式写提示词或接入输出。
- 普通小怪、简单弹道、简单命中特效可以尝试 Sprite Forge 这类序列帧工具，优点是出图快、结构稳定。
- Boss、主角、复杂攻击、复杂死亡这类高要求动画，优先按“角色设计图 -> 动作分镜 -> 视频/序列帧生成 -> TexturePacker 图集 -> 导入脚本”的流程处理，不把某个生成工具写成默认优先级。
- 文档和提示词应描述动作、方向、锚点、帧数、透明背景和导入规格，而不是绑定某一个具体生成工具。

### 导入脚本职责

导入脚本不要只是复制图片，应完成下面这些工作：

1. 读取 `spritesheet_*.json`。
2. 按帧名数字排序，得到完整动作帧序列。
3. 根据 JSON 坐标从对应 PNG 裁出每帧。
4. 保留最大 alpha 连通主体，避免碎片或相邻帧混入。
5. 用统一缩放系数归一化到固定透明画布。
6. 按动作类型决定锚点策略：
   - 地面角色：脚底对齐，常用 `anchorY=0.88~0.95`。
   - 飞行角色：身体中心偏下对齐，常用 `anchorY=0.5~0.65`。
   - 弹道/命中特效：中心对齐，常用 `anchorY=0.5`。
7. 输出运行时散帧、横排 sheet、GIF、contact sheet 和 `metadata.json`。
8. 清理低透明噪点或紫边，但不要破坏主体描边。

### 配置表写法

`s_asset.json` 每帧一个稳定 key：

```json
{
  "key": "poison_bat_fly_down_00",
  "type": "image",
  "url": "/game-assets/enemies/poison_bat_fly_down/frames/poison-bat-fly-down-00.png?v=poison-bat-1",
  "preloadGroup": "battle",
  "fallbackKey": "placeholder_enemy"
}
```

规则：

- `key` 不写版本号，保持长期稳定。
- `url` 可以加 `?v=<资源版本>`，防止浏览器继续加载旧图。
- `preloadGroup` 战斗资源一般用 `battle`。
- fallback 逐帧链式回退：第 0 帧回 `placeholder_enemy`，后续帧回上一帧。

`s_animation.json` 按实际帧数写完整数组：

```json
{
  "key": "poison_bat_fly_down",
  "assetKey": "loose_frames",
  "frames": [
    "poison_bat_fly_down_00",
    "poison_bat_fly_down_01",
    "poison_bat_fly_down_02"
  ],
  "fps": 15,
  "loop": true,
  "anchorX": 0.5,
  "anchorY": 0.55,
  "scale": 0.45
}
```

字段经验：

- `frames` 不要求固定 8 帧，必须和实际导出帧数一致。
- `fps` 控制原地动作速度，不控制怪物移动速度。
- 怪物移动速度仍由 `s_monster.json.speed` 控制。
- 武器弹道移动速度仍由 `s_skill.json.speed` 控制。
- `scale` 优先在配置表调，不要为了大小反复改每张 PNG。
- `anchor` 是碰撞点和显示对齐的关键，地面怪与飞行怪不能一套值硬套。

### 绑定入口

怪物绑定：

```json
{
  "id": 2,
  "name": "毒蝠",
  "runAnimKey": "poison_bat_fly_down",
  "attackAnimKey": ""
}
```

主角绑定：

```json
{
  "key": "hero_guardian",
  "idleAnimKey": "hero_guardian_idle",
  "attackAnimKey": "hero_guardian_attack_up"
}
```

当前主角还在 `BattleScene` 中使用固定 key，后续如果主角动作继续增多，应迁移到 `s_actor_visual.json` 或 `s_hero_visual.json`。

技能绑定：

```json
{
  "id": 201,
  "projectileAnimKey": "projectile_tomato_spin",
  "hitAnimKey": "hit_tomato_burst"
}
```

### QA 和验收

每个新动画至少保留一个针对性 QA 脚本，检查：

- `metadata.json.frames` 与 `s_animation.json.frames.length` 一致。
- `s_asset.json` 中每个帧 key 都存在。
- 每张运行时帧存在且尺寸一致。
- 每张运行时帧有透明主体，不是空帧。
- 内容没有贴到边界，避免裁翅膀、裁脚、漏出相邻角色。
- URL 带资源版本号，避免浏览器缓存旧图。

推荐命令：

```bash
python3 tests/check_zombie_walk_frames.py
python3 tests/check_poison_bat_frames.py
npm run test:monster-config
npm run test:monster-visual
node -e "const fs=require('fs'); for (const f of fs.readdirSync('public/gamedata').filter(f=>f.endsWith('.json'))) JSON.parse(fs.readFileSync('public/gamedata/'+f,'utf8')); console.log('json ok')"
npm run build
```

浏览器预览：

```text
http://localhost:<实际端口>/game.html?animtest=<动画key>&verify=<资源版本>
```

例如：

```text
game.html?animtest=zombie_walk_down&verify=miner-zombie-1
game.html?animtest=poison_bat_fly_down&verify=poison-bat-1
```

预览页要检查：

- 是否显示正确资源，而不是旧缓存或占位图。
- 帧数、FPS、循环状态是否符合配置。
- 控制台是否有 error/warn。
- 主体方向是否符合战斗方向，例如怪物从上往下冲向基地。

### Boss 多动作尺寸归一经验

大型 Boss 动作不要默认全部归一到 `256x256`。如果攻击或死亡动作有大幅挥击、横躺、白色冲击帧，`256x256` 会迫使脚本按“最大宽高”缩放，结果是站立本体明显变小。

当前 Boss 的最终规格：

- `boss_walk_down`：`256x256`，18 帧，12 FPS，loop=true，`anchor=(0.5,0.92)`，`scale=0.9`。
- `boss_attack_down`：`320x320`，19 帧，12 FPS，loop=false，`anchor=(0.5,0.92)`，`scale=0.9`，`hitFrame=15`。
- `boss_roar_down`：`256x256`，19 帧，12 FPS，loop=false，`anchor=(0.5,0.92)`，`scale=0.9`。
- `boss_death_down`：`320x320`，22 帧，12 FPS，loop=false，`anchor=(0.5,0.92)`，`scale=0.9`。

为什么攻击和死亡用 `320x320`：

- 攻击动作的冲击/挥击帧横向更宽，如果塞进 `256x256`，角色本体会被压小。
- 死亡动作后半段横躺更宽，如果按横躺最大宽度缩放，死亡前几帧站立状态会突然缩小。
- 使用更大画布后，攻击平均主体高度和行走动作基本一致，切换时不会明显跳尺寸。

当前尺寸回归数据：

```text
boss_walk_down   平均主体高约 240px
boss_attack_down 平均主体高约 240px
boss_death_down  前半段主体高接近行走；后半段横躺自然变矮
```

回归命令：

```bash
npm run test:boss-animation-size
```

后续接任何大型怪物多动作时，建议先跑一个包围盒统计脚本，至少看：

- 移动动作平均宽高。
- 攻击动作首帧、中段、末帧宽高。
- 死亡动作前 5 到 8 帧宽高。
- 这些值是否接近，不要只看 `s_animation.scale` 是否相同。

如果同角色不同动作看起来大小不一致，优先重新导出帧和统一画布；不要给 `attack/death` 单独配置不同 `scale`，否则后续层级、血条、命中点更难维护。

### 番茄旋转弹道

番茄弹道只需要美术或 AI 生成一张独立番茄，不需要画 8 个不同番茄。脚本按固定角度旋转生成序列帧：

```text
原始单图：public/game-assets/source/projectile-tomato-ai-magenta.png
透明单图：public/game-assets/source/projectile-tomato-ai-transparent.png
运行帧目录：public/game-assets/effects/projectiles/tomato_spin/frames/
生成脚本：scripts/generate-tomato-projectile-sprite.mjs
动画 key：projectile_tomato_spin
规格：128x128，8 帧，14 FPS，loop=true，anchor=(0.5, 0.5)
```

脚本输出角度为 `0/45/90/135/180/225/270/315` 度。序列帧只负责原地旋转；从主角到目标的位移由 `BattleScene` 根据技能 `speed` 计算。

### 番茄命中爆炸

```text
原始 AI sheet：public/game-assets/source/hit-tomato-burst-ai-magenta-sheet.png
透明源 sheet：public/game-assets/source/hit-tomato-burst-ai-transparent-sheet.png
运行帧目录：public/game-assets/effects/hit/tomato_burst/frames/
生成脚本：scripts/generate-tomato-hit-sprite.mjs
动画 key：hit_tomato_burst
规格：256x256，8 帧，18 FPS，loop=false，anchor=(0.5, 0.5)
```

爆炸 sheet 从左到右依次为挤压、开裂、最大爆发、碎块扩散、消散。切帧时所有帧使用同一缩放系数，不能把后期的小碎屑单独放大，否则爆炸会在结尾突然变大。

## 策划自行制作和配置流程

1. 把 AI 原图、美术源图或 TexturePacker 图集文件夹放入 `public/game-assets/source/` 留档。
2. 如果源图没有透明 alpha，使用纯色洋红 `#FF00FF` 或纯绿背景生成，再抠成透明 PNG。
3. 编写或复制现有导入脚本，输出统一尺寸的 `frames/*.png`、横排 sheet、GIF、contact sheet 和 `metadata.json`。
4. 如果是 TexturePacker/Cocos 风格图集，优先读取 JSON 真实坐标，不要按整图等分硬切。
5. 在 `s_asset.json` 为每一帧配置唯一 key、`url`、`preloadGroup: "battle"` 和逐帧 fallback。
6. 在 `s_animation.json` 配置动画 key、实际帧 key 数组、`fps`、`loop`、锚点和缩放。
7. 怪物在 `s_monster.json` 配 `runAnimKey/attackAnimKey`；技能在 `s_skill.json` 配 `projectileAnimKey/hitAnimKey`；主角后续走 `s_actor_visual.json` 或 `s_hero_visual.json`。
8. 使用 `game.html?animtest=<动画key>` 单独预览，再进入实战检查轨迹、命中点和层级。
9. 运行对应帧 QA、`npm run test:monster-visual`、`npm run test:skill-visual`、JSON 校验和 `npm run build`。

怪物攻击栏杆/基地的停靠点不放在 UI 布局里，统一走 `public/gamedata/s_battle_field.json`：

- `monsterContactMode`：默认 `fenceForeground`，怪物停止点跟随栏杆前景图实际位置，适配不同屏幕高度。
- `monsterContactY`：绝对接触线覆盖值。默认保持 `0`，只在特殊调试或特殊关卡中使用。
- `monsterContactOffsetY`：相对栏杆前景图的纵向偏移，用来微调怪物脚底/攻击点到栏杆前沿。
- `fenceForegroundAssetKey`：栏杆前景遮挡图，运行时层级高于怪物，保证怪物攻击栏杆时不会踩在栏杆上。
- `fenceCoversMonsters`：是否让栏杆盖住怪物，默认保持 `true`。
- `monsterAttackHitFrame`：后续攻击动画命中帧预留。
- `monsterAttackHitTime`：后续攻击动画命中时间预留。

这样下方基地、栏杆、地面美术换皮时，只需要切换或调整战场皮肤表，不会因为血条、装备栏或基地面板位置变化导致怪物走到错误位置。

## 运行时释放规则

- 弹道命中、目标提前死亡或战斗场景销毁时，立即从显示层移除并 `destroy`。
- 命中爆炸必须 `loop=false`，在 `onComplete` 中移除并 `destroy`。
- 怪物死亡动画必须 `loop=false`。怪物被击杀时先标记 `dead=true`，停止参与移动、碰撞和受击结算，再播放 `deathAnimKey`。
- 死亡动画播完后停在最后一帧，执行一个很短的渐隐，例如 `0.32s`，渐隐结束后再 `removeFromParent()` 并 `destroy({ children: true })`。
- 不要用伤害数字的 floating 队列复用死亡淡出，死亡淡出应使用独立释放队列，避免半透明初始帧或释放时机混乱。
- 暂停战斗时，弹道和命中特效也统一暂停；继续后恢复。
- 单帧纹理由 `AssetManager` 统一缓存和复用，不要每次攻击重新加载，也不要在单个特效结束时卸载共享纹理。

## 怪物攻击、技能和基地反馈实装经验

### 怪物攻击动作和伤害帧

怪物配置了 `attackAnimKey` 后，运行时不应该在接触栏杆的同一帧立刻扣基地血。正确流程：

```text
怪物走到 s_battle_field 接触线
-> 切 attackAnimKey
-> 等到 s_animation.hitFrame
-> 扣基地血、显示基地扣血数字、播放受击反馈
-> 攻击动画/冷却继续
```

当前关键配置：

- Boss 攻击：`boss_attack_down`，19 帧，`hitFrame=15`。
- 小僵尸攻击：`zombie_attack_down`，13 帧，`hitFrame=6`。
- 毒蝠攻击：`poison_bat_attack_down`，43 帧，`hitFrame=22`。

相关测试：

```bash
npm run test:monster-attack-animation
npm run test:monster-config
```

### Boss 怒吼技能

Boss 怒吼资源是普通怪物动作，但触发规则走 `s_boss_skill.json`：

```text
s_monster.roarSkillKey -> s_boss_skill.key -> s_boss_skill.animKey -> s_animation
```

当前 Boss 怒吼策略：

- `trigger=afterSpawn`
- `delay=5`
- `cd=40`
- `duration=8`
- 只强化 `otherMonsters`
- 速度倍率 `1.35`
- 攻击倍率 `1.25`

经验：

- 早期使用 `onHit` 会遇到高火力时 Boss 还没被打到、或被打到时已经没小怪，体感像技能失效。
- 改成出生 5 秒后自动吼，更适合买量 demo 展示。
- 没有其他存活怪时不触发、不消耗 CD，避免 Boss 空吼。
- 怒吼期间不要让攻击动画立刻覆盖怒吼动画。

相关测试：

```bash
npm run test:boss-skill-config
npm run test:boss-wave-config
```

### 基地受击震颤

不要做整屏震颤。旧方案移动 `BattleScene.container`，固定尺寸竖屏画布被整体平移后，会在边缘露出 renderer 黑底。

当前推荐做法是局部震颤：

- 背景和 HUD 不动。
- 只轻微移动栏杆前景层 `fieldForegroundLayer`。
- 基地/守卫局部层 `heroLayer` 做更小幅度跟随。
- 同时配合基地扣血数字和命中特效。

Boss 当前局部震颤参数：

```text
duration = 0.34
amplitude = 7
mode = local
```

相关测试：

```bash
npm run test:base-damage-feedback
```

## 怪物死亡动画接入实装经验

2026-06-24 已接入小僵尸死亡动画 `zombie_death_down`，流程可作为后续毒蝠、精英怪和 Boss 死亡动画模板。

### 资源目录

```text
原始图集：
video-frames-20260624-125306_sheet/

归档源文件：
public/game-assets/source/zombie-death-down-video-20260624-125306/

运行时资源：
public/game-assets/enemies/zombie_death_down/
  frames/
    zombie-death-down-00.png
    zombie-death-down-01.png
    ...
    zombie-death-down-18.png
  zombie-death-down-sheet.png
  zombie-death-down.gif
  zombie-death-down-contact-sheet.jpg
  metadata.json

导入脚本：
scripts/import-zombie-death-video-sheet.py
```

### 配置表

`s_monster.json`：

```json
{
  "id": 1,
  "name": "小僵尸",
  "runAnimKey": "zombie_walk_down",
  "attackAnimKey": "",
  "deathAnimKey": "zombie_death_down"
}
```

`s_animation.json`：

```json
{
  "key": "zombie_death_down",
  "assetKey": "loose_frames",
  "frames": [
    "zombie_death_down_00",
    "zombie_death_down_01",
    "zombie_death_down_02"
  ],
  "fps": 12,
  "loop": false,
  "anchorX": 0.5,
  "anchorY": 0.92,
  "scale": 0.5
}
```

`s_asset.json`：

```json
{
  "key": "zombie_death_down_00",
  "type": "image",
  "url": "/game-assets/enemies/zombie_death_down/frames/zombie-death-down-00.png?v=zombie-death-1",
  "preloadGroup": "battle",
  "fallbackKey": "placeholder_enemy"
}
```

注意：

- `deathAnimKey` 缺失或资源加载失败时，运行时应回退到旧逻辑：立即销毁怪物节点。
- `death` 动画的 `anchorX/anchorY/scale` 应尽量和 `run` 动画一致，避免击杀瞬间跳位或缩放突变。
- `metadata.json.runtimeFadeAfterComplete` 可记录运行时淡出时长；当前小僵尸为 `0.32` 秒。
- 图集导入时要优先使用 TexturePacker JSON 的 `spriteSourceSize/sourceSize` 还原原始帧位置，再统一全局包围盒和缩放，避免每帧重新居中造成倒地动作抖动。
- 根目录临时 `video-frames-*` 文件夹不要直接作为运行时资源；导入后要复制归档到 `public/game-assets/source/`，运行时只读 `public/game-assets/enemies/<anim-key>/frames/`。

### 代码行为

当前 `BattleScene.killMonster()` 的死亡流程：

```text
怪物 hp <= 0
-> monster.dead = true
-> 如果 monster.def.deathAnimKey 能创建动画：
   清空怪物当前显示子节点
   播放 death 动画
   onComplete 停到最后一帧
   fadeAndRelease 线性渐隐
   releaseCombatVisual 销毁容器
-> 如果没有 death 动画：
   立即 destroy，保持旧回退
-> 结算金币、经验、击杀数和升级检查
```

这个顺序保证死亡动画播放期间怪物不再被寻路、碰撞、攻击锁定或重复受击，但视觉上仍留在 `monsterLayer` 里完成死亡表现。

### 验证命令

每次新增或替换怪物死亡动画后至少执行：

```bash
npm run test:monster-visual
npm run test:monster-config
node -e "const fs=require('fs'); for (const f of fs.readdirSync('public/gamedata').filter(f=>f.endsWith('.json'))) JSON.parse(fs.readFileSync('public/gamedata/'+f,'utf8')); console.log('json ok')"
npm run build
```

浏览器检查：

- `game.html?animtest=zombie_death_down` 单独看帧动画是否完整。
- 实战击杀小僵尸，确认死亡动画播放完才渐隐消失。
- 多只小僵尸同时死亡时，确认不会残留透明节点或继续被攻击锁定。
- 暂停/升级弹窗出现时，确认死亡动画和淡出节奏不会和战斗状态冲突。

## 武器动画接入与合并冲突经验

### 保持唯一的表现入口

当前进攻型武器的标准入口是 `s_skill.json`：

```text
projectileAnimKey -> 飞行动画
hitAnimKey        -> 命中动画
speed             -> 弹道位移速度
```

`s_item.json` 中可以继续保留背包图标、战斗栏图标或未来专属静态资源，但不要再新增一条优先级更高的 `projectileAssetKey` 攻击分支覆盖 `s_skill`。如果后续确实需要胡萝卜回旋、辣椒爆炸等专属逻辑，应通过明确的技能表现类型接入，并保证普通流程仍能执行命中特效。

一次实际冲突曾把所有弹道写成 `impactType: "carrotSpin"`，导致命中处理提前 `return`，`hit_tomato_burst` 永远没有播放。命中流程必须保持：

```text
弹道到达目标
-> 根据技能类型结算单体或范围效果
-> 播放 hitAnimKey
-> 销毁弹道
-> 命中特效播放完成后自销毁
```

特殊攻击可以替换其中某一段，但不能在没有替代命中特效的情况下提前结束整条流程。

### AI 爆炸 sheet 不要直接等宽硬切

AI 生成的爆炸、烟雾、液体飞溅经常跨过视觉格子边界。即使画面看起来是横向 8 帧，直接按 `sheet.width / 8` 裁切也可能出现：

- 最大爆炸右半边被切进下一帧。
- 下一帧出现半个旧爆炸和半个新爆炸。
- 尾帧混入相邻帧碎片，看起来像两个爆点。
- 背景抠图残留低透明噪点，导致每帧包围盒接近整张图高度。

当前 `generate-tomato-hit-sprite.mjs` 使用的可靠方法：

1. 先用 Alpha 阈值去掉低透明背景噪点。
2. 在整张 sheet 上寻找透明像素连通区域。
3. 根据连通区域质心离哪个帧中心最近，把完整区域归属给该帧。
4. 每一帧使用统一缩放系数，保持爆炸从大到小的真实比例。
5. 输出 contact sheet，人工检查最大帧完整、尾帧足够小。

`tests/check_tomato_hit_frames.py` 会检查最大爆发帧宽度和尾帧比例，防止合并后重新退回错误切法。

### 攻击节奏不要从零 CD 同时起跑

如果背包中所有武器在开战时都是 `cdLeft = 0`，第一只怪出现的同一帧会触发全部武器攻击，形成一串弹道重叠。当前规则为：

- 每次进入战斗时，所有武器先进入一次完整技能 CD。
- 根据武器 uid 增加少量确定性错峰。
- 错峰值配置在 `s_economy.json` 的 `battle_initial_cd_stagger`，当前为 `0.08` 秒。
- 最小初始 CD 不低于 `0.25` 秒。

这样第一批怪物有时间展开，玩家也能先看到战场状态，再看到武器依次开火。

### 目标选择要考虑在途弹道

只按“离基地最近”选目标时，同一帧内的多件武器会全部锁定同一只怪。当前目标优先级为：

1. 过滤死亡目标。
2. 统计每只怪当前已经有多少在途弹道。
3. 优先选择在途弹道最少的怪物。
4. 数量相同时，再遵守原技能的最近目标或集群目标规则。

场上只有一只怪时仍允许集中攻击；场上有多只怪时则自然分流。规则测试入口是 `npm run test:weapon-attack`。

### 武器动画回归检查

每次合并攻击表现代码后至少执行：

```bash
npm run test:skill-visual
npm run test:weapon-attack
npx tsc --noEmit
npm run build
```

浏览器至少确认：开战初始 CD、首轮弹道不堆叠、不同怪物能被分流锁定、命中爆炸完整、暂停时弹道和爆炸停止、特效播放完成后不残留。

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
