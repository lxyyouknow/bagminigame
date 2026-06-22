import { chooseBalancedTarget, getInitialWeaponCooldown } from "../src/scenes/weaponAttackRules.js";

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

console.log("weapon-attack-rules tests ok");
