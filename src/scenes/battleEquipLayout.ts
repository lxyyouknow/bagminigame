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

export function computeBattleEquipListLayout(
  itemCount: number,
  panelWidth: number,
  itemHeight: number,
  gap: number,
): BattleEquipLayoutResult {
  const clampedCount = Math.max(0, itemCount);
  const columns = Math.max(1, Math.min(5, clampedCount <= 5 ? clampedCount || 1 : 5));
  const rows = Math.max(1, Math.ceil(clampedCount / columns));
  const slotWidth = Math.floor((panelWidth - gap * Math.max(0, columns - 1)) / columns);
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
