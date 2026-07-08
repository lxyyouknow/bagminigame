export interface DebugTraceEntry {
  seq: number;
  ts: number;
  event: string;
  params: Record<string, unknown>;
  stack?: string;
}

const maxEntries = 80;
const storageKey = "backpack_debug_trace_v1";
let seq = 0;
const entries: DebugTraceEntry[] = loadStoredEntries();
seq = entries.reduce((max, entry) => Math.max(max, entry.seq), 0);

function installDebugApi(): void {
  const target = globalThis as typeof globalThis & {
    __debugTrace?: {
      history: () => DebugTraceEntry[];
      clear: () => void;
    };
  };
  if (target.__debugTrace) return;
  target.__debugTrace = {
    history: () => entries.map((entry) => ({ ...entry, params: { ...entry.params } })),
    clear: () => {
      entries.length = 0;
      persistEntries();
    },
  };
}

export function debugTrace(event: string, params: Record<string, unknown> = {}, includeStack = false): void {
  installDebugApi();
  const entry: DebugTraceEntry = {
    seq: ++seq,
    ts: Date.now(),
    event,
    params: { ...params },
    stack: includeStack ? new Error().stack : undefined,
  };
  entries.push(entry);
  if (entries.length > maxEntries) entries.shift();
  persistEntries();
  console.info(`[DebugTrace] ${event} ${JSON.stringify(params)}`);
  if (includeStack && entry.stack) console.info(entry.stack);
}

function loadStoredEntries(): DebugTraceEntry[] {
  const storage = getStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DebugTraceEntry[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry) => typeof entry?.seq === "number" && typeof entry.event === "string")
      .slice(-maxEntries);
  } catch {
    return [];
  }
}

function persistEntries(): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(storageKey, JSON.stringify(entries.slice(-maxEntries)));
  } catch {
    // 调试日志写入失败不应该影响玩家流程。
  }
}

function getStorage(): Storage | undefined {
  if (typeof window === "undefined") return undefined;
  return window.sessionStorage ?? window.localStorage;
}
