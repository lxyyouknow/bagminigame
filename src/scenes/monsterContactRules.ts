export interface MonsterContactInput {
  y: number;
  speed: number;
  slowTimer: number;
  attackCooldown: number;
  dt: number;
  contactY: number;
  attack: number;
  attackInterval: number;
  armor: number;
  armorBonus: number;
}

export interface MonsterContactResult {
  y: number;
  attackCooldown: number;
  damage: number;
  contacted: boolean;
}

export function stepMonsterContact(input: MonsterContactInput): MonsterContactResult {
  const speedMul = input.slowTimer > 0 ? 0.55 : 1;
  const nextY = Math.min(input.contactY, input.y + input.speed * speedMul * input.dt);
  const contacted = nextY >= input.contactY;
  const cooldown = Math.max(0, input.attackCooldown - input.dt);
  if (!contacted) {
    return { y: nextY, attackCooldown: cooldown, damage: 0, contacted };
  }
  if (cooldown > 0) {
    return { y: input.contactY, attackCooldown: cooldown, damage: 0, contacted };
  }
  return {
    y: input.contactY,
    attackCooldown: Math.max(0.1, input.attackInterval),
    damage: computeMonsterBaseDamage(input.attack, input.armor, input.armorBonus),
    contacted,
  };
}

export function computeMonsterBaseDamage(attack: number, armor: number, armorBonus: number): number {
  return Math.max(1, attack - (armor + armorBonus) * 0.45);
}
