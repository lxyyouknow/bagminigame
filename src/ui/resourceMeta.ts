import type { ResourceKey } from "../services/SaveService.js";

export interface TopResourceLabels {
  energy?: string;
  dynamite?: string;
  coin?: string;
}

export interface TopResourceEntry {
  key: "energy" | "dynamite" | "coin";
  name: string;
  value: string;
  color: number;
  uiKey: string;
}

const RESOURCE_NAME: Record<ResourceKey, string> = {
  dynamite: "钥匙",
  coin: "金币",
  energy: "体力",
};

export function getResourceDisplayName(resource: ResourceKey): string {
  return RESOURCE_NAME[resource];
}

export function getTopResourceEntries(labels?: TopResourceLabels): TopResourceEntry[] {
  return [
    { key: "energy", name: "体力", value: labels?.energy ?? "20", color: 0xff384e, uiKey: "resource_energy_icon" },
    { key: "dynamite", name: "钥匙", value: labels?.dynamite ?? "30", color: 0xffc34a, uiKey: "resource_ticket_icon" },
    { key: "coin", name: "金币", value: labels?.coin ?? "440", color: 0x39b8ff, uiKey: "resource_coin_icon" },
  ];
}

export function formatConsumeToast(resource: ResourceKey, amount: number, remaining: number): string {
  return `已消耗${getResourceDisplayName(resource)} x${amount}，剩余 ${remaining}`;
}
