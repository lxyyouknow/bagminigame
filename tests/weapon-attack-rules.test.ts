import { chooseBalancedTarget, getInitialWeaponCooldown, isMonsterTargetable, resolveProjectileAimPoint } from "../src/scenes/weaponAttackRules.js";

function assertEqual(actual: unknown, expected: unknown, message: string): void {
  if (actual !== expected) throw new Error(`${message}，期望 ${String(expected)}，实际 ${String(actual)}`);
}

const targets = [
  { uid: 1, y: 320, cluster: 3 },
  { uid: 2, y: 260, cluster: 1 },
  { uid: 3, y: 220, cluster: 2 },
];

assertEqual(
  chooseBalancedTarget(targets, "nearest", new Map(), (target) => target.cluster)?.uid,
  1,
  "没有在途弹道时应保持原来的最靠近基地优先",
);
assertEqual(
  chooseBalancedTarget(targets, "nearest", new Map([[1, 2]]), (target) => target.cluster)?.uid,
  2,
  "已有弹道集中到最近目标时应优先选择无弹道目标",
);
assertEqual(
  chooseBalancedTarget(targets, "cluster", new Map([[1, 1], [2, 1], [3, 1]]), (target) => target.cluster)?.uid,
  1,
  "在途弹道数量相同时应继续遵守集群优先规则",
);

assertEqual(getInitialWeaponCooldown(1.2, 1, 7, 0.08), 1.36, "开战应进入完整 CD 并加入确定性错峰");
assertEqual(getInitialWeaponCooldown(0.1, 1, 5, 0.08), 0.25, "初始 CD 不应低于最小攻击间隔");
assertEqual(isMonsterTargetable(194, 230), false, "怪物刚从顶部 UI 后方露头时不应被武器锁定");
assertEqual(isMonsterTargetable(230, 230), true, "怪物走出顶部 UI 遮挡区后才允许被武器锁定");

const liveAim = resolveProjectileAimPoint({ dead: false, x: 200, y: 320 }, { targetX: 180, targetY: 300 });
assertEqual(liveAim.targetAlive, true, "目标存活时弹道应继续追踪目标");
assertEqual(liveAim.targetX, 200, "目标存活时应更新弹道最后目标 X");
assertEqual(liveAim.targetY, 320, "目标存活时应更新弹道最后目标 Y");

const deadAim = resolveProjectileAimPoint({ dead: true, x: 240, y: 360 }, { targetX: 200, targetY: 320 });
assertEqual(deadAim.targetAlive, false, "目标死亡时弹道应切换为表现命中模式");
assertEqual(deadAim.targetX, 200, "目标死亡时弹道应继续飞向最后记录的目标 X，不应原地消失");
assertEqual(deadAim.targetY, 320, "目标死亡时弹道应继续飞向最后记录的目标 Y，不应追随死亡表现漂移");

console.log("weapon-attack-rules tests ok");
