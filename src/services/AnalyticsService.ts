export type AnalyticsEventName =
  | "loading_complete"
  | "login_start_game"
  | "main_show"
  | "level_start_click"
  | "level_start_success"
  | "level_start_failed"
  | "battle_start"
  | "battle_wave_clear"
  | "battle_result"
  | "rogue_option_select";

export type AnalyticsParams = Record<string, string | number | boolean | null | undefined>;

export interface AnalyticsEvent {
  seq: number;
  ts: number;
  userId: string;
  event: AnalyticsEventName;
  params: AnalyticsParams;
}

type AnalyticsOptions = {
  now?: () => number;
  logger?: (line: string, event: AnalyticsEvent) => void;
};

export class AnalyticsService {
  private readonly now: () => number;
  private readonly logger: (line: string, event: AnalyticsEvent) => void;
  private events: AnalyticsEvent[] = [];
  private seq = 0;
  private userId = "anonymous";

  constructor(options: AnalyticsOptions = {}) {
    this.now = options.now ?? (() => Date.now());
    this.logger = options.logger ?? ((line) => console.info(line));
  }

  setUserId(userId: string): void {
    this.userId = userId || "anonymous";
  }

  track(event: AnalyticsEventName, params: AnalyticsParams = {}): void {
    const nextEvent: AnalyticsEvent = {
      seq: ++this.seq,
      ts: this.now(),
      userId: this.userId,
      event,
      params: { ...params },
    };
    this.events.push(nextEvent);
    this.logger(`[Analytics Mock] ${event} ${JSON.stringify(nextEvent.params)}`, this.cloneEvent(nextEvent));
  }

  getEvents(): AnalyticsEvent[] {
    return this.events.map((event) => this.cloneEvent(event));
  }

  clear(): void {
    this.events = [];
  }

  private cloneEvent(event: AnalyticsEvent): AnalyticsEvent {
    return {
      ...event,
      params: { ...event.params },
    };
  }
}
