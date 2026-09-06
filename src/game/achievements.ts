export interface Achievement {
  id: string;
  name: string;
  desc: string;
  test: (counts: Record<string, number>, total: number) => boolean;
}

const LIST: Achievement[] = [
  {
    id: 'first-move',
    name: 'First Steps',
    desc: 'Perform your first action',
    test: (_c, total) => total >= 1,
  },
  {
    id: 'triple-threat',
    name: 'Triple Threat',
    desc: 'Try every action Stickman knows',
    test: (c) => Object.keys(c).length >= 3,
  },
  {
    id: 'warmed-up',
    name: 'Warming Up',
    desc: 'Perform 10 actions',
    test: (_c, total) => total >= 10,
  },
];

const STORAGE_KEY = 'matchman.achievements.v1';

/**
 * Tracks action usage and unlocks achievements. Progression unlocks
 * (new professions in P1) will hook into onUnlock.
 */
export class Achievements {
  private counts: Record<string, number> = {};
  private total = 0;
  private unlocked = new Set<string>();

  constructor(private readonly onUnlock: (a: Achievement) => void) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw) as {
          counts: Record<string, number>;
          total: number;
          unlocked: string[];
        };
        this.counts = data.counts ?? {};
        this.total = data.total ?? 0;
        this.unlocked = new Set(data.unlocked ?? []);
      }
    } catch {
      // corrupted storage — start fresh
    }
  }

  record(actionId: string): void {
    this.counts[actionId] = (this.counts[actionId] ?? 0) + 1;
    this.total++;
    for (const a of LIST) {
      if (!this.unlocked.has(a.id) && a.test(this.counts, this.total)) {
        this.unlocked.add(a.id);
        this.persist();
        this.onUnlock(a);
      }
    }
    this.persist();
  }

  /** Snapshot for UI panels (goals list). */
  status(): Array<{ id: string; name: string; desc: string; done: boolean }> {
    return LIST.map((a) => ({
      id: a.id,
      name: a.name,
      desc: a.desc,
      done: this.unlocked.has(a.id),
    }));
  }

  private persist(): void {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          counts: this.counts,
          total: this.total,
          unlocked: [...this.unlocked],
        }),
      );
    } catch {
      // storage unavailable — progress is session-only
    }
  }
}
