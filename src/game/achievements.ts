export interface Achievement {
  id: string;
  name: string;
  desc: string;
  /** When omitted, the achievement can only be unlocked explicitly via
   *  Achievements.unlockById (e.g. visit/shelf milestones). */
  test?: (counts: Record<string, number>, total: number) => boolean;
  /** Hidden achievements render as "???" until earned — a discovery treat. */
  hidden?: boolean;
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
    desc: 'Try every action Sportsman knows',
    test: (c) => Object.keys(c).length >= 3,
  },
  {
    id: 'warmed-up',
    name: 'Warming Up',
    desc: 'Perform 10 actions — unlocks the Dancer!',
    test: (_c, total) => total >= 10,
  },
  {
    id: 'grace-note',
    name: 'Grace Note',
    desc: 'Try every action Dancer knows',
    test: (c) => !!c['pirouette'] && !!c['moonwalk'] && !!c['jazz-hands'],
  },
  {
    id: 'fresh-and-clean',
    name: 'Fresh & Clean',
    desc: 'Have a shower or a bath in the bathroom',
    hidden: true,
    test: (c) => (c['shower'] ?? 0) >= 1 || (c['bath'] ?? 0) >= 1,
  },
  {
    id: 'squeaky-clean',
    name: 'Squeaky Clean',
    desc: 'Have both a shower AND a bath',
    hidden: true,
    test: (c) => (c['shower'] ?? 0) >= 1 && (c['bath'] ?? 0) >= 1,
  },
  {
    id: 'showstopper',
    name: 'Showstopper',
    desc: 'Perform 25 total actions',
    test: (_c, total) => total >= 25,
  },
  {
    id: 'jam-session',
    name: 'Jam Session',
    desc: 'Perform 20 total actions — unlocks the Musician!',
    test: (_c, total) => total >= 20,
  },
  {
    id: 'culinary-arts',
    name: 'Culinary Arts',
    desc: 'Perform 30 total actions — unlocks the Chef!',
    test: (_c, total) => total >= 30,
  },
  {
    id: 'masterpiece',
    name: 'Masterpiece',
    desc: 'Perform 40 total actions — unlocks the Painter!',
    test: (_c, total) => total >= 40,
  },
  {
    id: 'stargazer',
    name: 'Stargazer',
    desc: 'Perform 50 total actions — unlocks the Astronomer!',
    test: (_c, total) => total >= 50,
  },
  {
    id: 'lift-off',
    name: 'Lift-Off',
    desc: 'Appleby knows a secret — try the buttons on his cube…',
    hidden: true,
  },
  {
    id: 'buddy-block',
    name: 'Buddy Block',
    desc: 'Expand the shelf to 2×3 — have 4 rooms receive a visitor',
  },
  {
    id: 'social-circle',
    name: 'Social Circle',
    desc: 'Expand the shelf to 7 slots — have one cubeman visit all 3 others',
  },
  {
    id: 'green-thumb',
    name: 'Green Thumb',
    desc: 'Perform 60 total actions — unlocks the Botanist!',
    test: (_c, total) => total >= 60,
  },
  {
    id: 'secret-garden',
    name: 'Secret Garden',
    desc: 'Briar knows a secret — try the buttons on her cube…',
    hidden: true,
  },
  {
    id: 'flight',
    name: 'Flight',
    desc: 'Merlin knows a secret — try the buttons on his cube…',
    hidden: true,
  },
];

const STORAGE_KEY = 'matchman.achievements.v1';

/** Wipe persisted achievement progress (used by the debug reset command). */
export function clearAchievementStorage(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // storage unavailable — nothing to wipe
  }
}

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
      if (!this.unlocked.has(a.id) && a.test?.(this.counts, this.total)) {
        this.unlocked.add(a.id);
        this.persist();
        this.onUnlock(a);
      }
    }
    this.persist();
  }

  /** Snapshot for UI panels (goals list). Hidden entries are marked so the
   *  UI can mask them with "???" until they are earned. */
  status(): Array<{ id: string; name: string; desc: string; done: boolean; hidden: boolean }> {
    return LIST.map((a) => ({
      id: a.id,
      name: a.name,
      desc: a.desc,
      done: this.unlocked.has(a.id),
      hidden: !!a.hidden,
    }));
  }

  /** Check if a specific achievement is unlocked (used for profession gating). */
  isUnlocked(id: string): boolean {
    return this.unlocked.has(id);
  }

  /**
   * Explicitly unlock an achievement outside the normal action-count tests
   * (e.g. shelf tier-ups, which are visit-milestone based). Returns the
   * achievement when it was newly unlocked, or null if already unlocked /
   * unknown id.
   */
  unlockById(id: string): Achievement | null {
    const a = LIST.find((entry) => entry.id === id);
    if (!a || this.unlocked.has(id)) return null;
    this.unlocked.add(id);
    this.persist();
    this.onUnlock(a);
    return a;
  }

  /** Human-readable status for the debug console. */
  progressSummary(): string {
    const done = LIST.filter((a) => this.unlocked.has(a.id));
    const locked = LIST.filter((a) => !this.unlocked.has(a.id));
    const lines = [`Achievements: ${done.length}/${LIST.length} unlocked (${this.total} total actions).`];
    for (const a of done) lines.push(`  ✓ ${a.name}`);
    for (const a of locked) lines.push(`  · ${a.hidden ? '???' : `${a.name} — ${a.desc}`}`);
    if (Object.keys(this.counts).length > 0) {
      lines.push(`  Actions: ${Object.entries(this.counts).map(([id, n]) => `${id}×${n}`).join(', ')}`);
    }
    return lines.join('\n');
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
