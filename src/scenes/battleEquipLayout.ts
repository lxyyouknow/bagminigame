export interface BattleEquipSlot {
  x: number;
  y: number;
  width: number;
  height: number;
  index: number;
}

export interface BattleEquipLayoutResult {
  columns: number;
  rows: number;
  panelHeight: number;
  slots: BattleEquipSlot[];
}

export interface BattleBottomPanelRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BattleHudLayoutResult {
  base: BattleBottomPanelRect;
  hpBar: BattleBottomPanelRect;
  equip: BattleBottomPanelRect;
}

export function computeBattleEquipListLayout(
  itemCount: number,
  panelWidth: number,
  itemHeight: number,
  gap: number,
): BattleEquipLayoutResult {
  const clampedCount = Math.max(0, itemCount);
  const maxColumnsByWidth = Math.max(1, Math.floor((panelWidth + gap) / (itemHeight + gap)));
  const columns = Math.max(1, Math.min(5, maxColumnsByWidth, clampedCount <= 5 ? clampedCount || 1 : 5));
  const rows = Math.max(1, Math.ceil(clampedCount / columns));
  const slotWidth = Math.min(itemHeight, Math.floor((panelWidth - gap * Math.max(0, columns - 1)) / columns));
  const panelHeight = rows * itemHeight + Math.max(0, rows - 1) * gap;
  const slots: BattleEquipSlot[] = [];

  for (let index = 0; index < clampedCount; index += 1) {
    const col = index % columns;
    const row = Math.floor(index / columns);
    slots.push({
      index,
      x: col * (slotWidth + gap),
      y: row * (itemHeight + gap),
      width: slotWidth,
      height: itemHeight,
    });
  }

  return {
    columns,
    rows,
    panelHeight,
    slots,
  };
}

export function computeBattleBottomPanelRect(
  screenWidth: number,
  screenHeight: number,
  panelWidth: number,
  panelHeight: number,
  bottomOffset: number,
): BattleBottomPanelRect {
  return {
    x: Math.round((screenWidth - panelWidth) / 2),
    y: Math.round(screenHeight + bottomOffset - panelHeight),
    width: panelWidth,
    height: panelHeight,
  };
}

export function computeBattleHudLayout(
  screenWidth: number,
  screenHeight: number,
  baseWidth: number,
  baseHeight: number,
  equipWidth: number,
  equipHeight: number,
  equipBottomOffset: number,
): BattleHudLayoutResult {
  const equip = computeBattleBottomPanelRect(screenWidth, screenHeight, equipWidth, equipHeight, equipBottomOffset);
  const baseSafeHeight = Math.max(90, Math.min(baseHeight, Math.round(screenHeight * 0.24)));
  const baseSafeWidth = Math.min(baseWidth, screenWidth - 32);
  const baseBottomOverlap = Math.max(24, Math.round(baseSafeHeight * 0.28));
  const baseY = Math.max(Math.round(screenHeight * 0.34), equip.y - baseSafeHeight + baseBottomOverlap);
  const hpWidth = Math.min(screenWidth - 34, Math.max(260, equip.width - 12));
  const hpY = Math.max(0, equip.y - 20);

  return {
    base: {
      x: Math.round((screenWidth - baseSafeWidth) / 2),
      y: baseY,
      width: baseSafeWidth,
      height: baseSafeHeight,
    },
    hpBar: {
      x: Math.round((screenWidth - hpWidth) / 2),
      y: hpY,
      width: hpWidth,
      height: 14,
    },
    equip,
  };
}
