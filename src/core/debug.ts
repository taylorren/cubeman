type LogValue = string | number | boolean | null | readonly LogValue[] | { [key: string]: LogValue };
export type LogDetails = Record<string, LogValue>;

const MAX_EVENTS = 500;
const PERSISTED_EVENTS = new Set([
  'visit.started',
  'visit.closed',
  'sleep.request',
  'sleep.enter',
  'sleep.start',
  'wake.start',
]);
const events: string[] = [];
let enabled = false;
let sequence = 0;
const sessionId = Array.from(crypto.getRandomValues(new Uint32Array(4)), (n) => n.toString(16)).join('-');
const pending = new Set<Promise<void>>();
let written = 0;
let failed = 0;
let lastError: string | null = null;

async function persist(entry: string): Promise<void> {
  try {
    const response = await fetch('/__cubeman/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: entry,
      keepalive: true,
    });
    if (!response.ok) throw new Error(`Log server returned HTTP ${response.status}`);
    written++;
  } catch (error) {
    failed++;
    lastError = error instanceof Error ? error.message : String(error);
    console.error(`[cubeman] Log was NOT saved to logs/: ${lastError}. Check cubemanDebug.status().`);
  }
}

/** Local diagnostics. Serialized entries preserve event-time state
 *  rather than live objects that change when expanded in the console. */
export const gameLog = {
  get enabled(): boolean {
    return enabled;
  },

  setEnabled(value: boolean): void {
    enabled = value;
  },

  record(event: string, details: LogDetails = {}): void {
    if (!enabled || !PERSISTED_EVENTS.has(event)) return;
    const entry = JSON.stringify({
      ...details,
      sessionId,
      sequence: ++sequence,
      timestamp: new Date().toISOString(),
      timeMs: Math.round(performance.now()),
      event,
    });
    events.push(entry);
    if (events.length > MAX_EVENTS) events.shift();
    console.info(`[cubeman] ${entry}`);
    const write = persist(entry);
    pending.add(write);
    void write.then(() => pending.delete(write));
  },

  clear(): void {
    events.length = 0;
  },

  export(): string {
    return `[\n${events.join(',\n')}\n]`;
  },

  status() {
    return { sessionId, enabled, pending: pending.size, written, failed, lastError };
  },

  async flush(): Promise<void> {
    while (pending.size > 0) await Promise.all([...pending]);
    if (failed > 0) throw new Error(`${failed} log event(s) were not persisted: ${lastError}`);
  },
};
