/**
 * Shelf progression: the shelf starts at 2×2 (4 slots) and expands as the
 * cubemen build social connections through visits. Each milestone unlocks
 * more slots, up to 3×3 (9 slots).
 *
 * Milestones:
 *   Tier 0 (start): 2×2 = 4 slots — default
 *   Tier 1: 4 different rooms have each received a visitor → 2×3 = 6 slots
 *   Tier 2: 1 cubeman has visited all other 3 → 7 slots
 *   Tier 3: 2 cubemen have visited all other 3 → 8 slots
 *   Tier 4: all cubemen have visited all other 3, 10+ total visits → 3×3 = 9 slots
 */

export const MAX_CUBEMEN = 4;
export const TOTAL_SLOTS = 9; // always 3×3

export interface ShelfTier {
  tier: number;
  open: number; // number of open (unlocked) slots
  name: string;
  slots: number[]; // which slot indices are open (row-major: 0-2 row 0, 3-5 row 1, 6-8 row 2)
}

// Open slots arranged as a compact block at top-left:
// Tier 0 (4):  O O L    Tier 1 (6):  O O O    Tier 2+: full rows from top
//              O O L                 O O O
//              L L L                 L L L
// All names are alliterative.
export const SHELF_TIERS: ShelfTier[] = [
  { tier: 0, open: 4, name: 'Cozy Corner', slots: [0, 1, 3, 4] },
  { tier: 1, open: 6, name: 'Buddy Block', slots: [0, 1, 2, 3, 4, 5] },
  { tier: 2, open: 7, name: 'Social Circle', slots: [0, 1, 2, 3, 4, 5, 6] },
  { tier: 3, open: 8, name: 'Friendly Fold', slots: [0, 1, 2, 3, 4, 5, 6, 7] },
  { tier: 4, open: 9, name: 'Glorious Gala', slots: [0, 1, 2, 3, 4, 5, 6, 7, 8] },
];

import { machineScopedKey } from './placement-storage';

const PROGRESS_KEY = machineScopedKey('matchman.progress.v1');

interface SavedProgress {
  roomsReceivedVisitors: string[];
  cubemanVisits: Array<[string, string[]]>;
  totalVisits: number;
  currentTier: number;
}

export class ShelfProgression {
  /** Set of cube IDs that have received at least one visitor. */
  private roomsReceivedVisitors = new Set<string>();
  /** Per-cubeman: set of host cube IDs they've visited. */
  private cubemanVisits = new Map<string, Set<string>>();
  /** Total number of visits completed. */
  private totalVisits = 0;
  private currentTier = 0;

  constructor() {
    this.load();
  }

  /** Restore persisted progression, silently ignoring corrupt data. */
  private load(): void {
    try {
      const raw = localStorage.getItem(PROGRESS_KEY);
      if (raw === null) return;
      const data = JSON.parse(raw) as Partial<SavedProgress>;
      if (Array.isArray(data.roomsReceivedVisitors)) {
        this.roomsReceivedVisitors = new Set(data.roomsReceivedVisitors.filter((id) => typeof id === 'string'));
      }
      if (Array.isArray(data.cubemanVisits)) {
        for (const [id, hosts] of data.cubemanVisits) {
          if (typeof id === 'string' && Array.isArray(hosts)) {
            this.cubemanVisits.set(id, new Set(hosts.filter((h) => typeof h === 'string')));
          }
        }
      }
      if (typeof data.totalVisits === 'number') this.totalVisits = data.totalVisits;
      if (typeof data.currentTier === 'number' && data.currentTier >= 0 && data.currentTier < SHELF_TIERS.length) {
        this.currentTier = data.currentTier;
      }
    } catch (error) {
      console.warn('Could not restore shelf progression; starting fresh.', error);
    }
  }

  /** Persist progression; failures are non-fatal. */
  private persist(): void {
    try {
      const data: SavedProgress = {
        roomsReceivedVisitors: [...this.roomsReceivedVisitors],
        cubemanVisits: [...this.cubemanVisits.entries()].map(([id, hosts]) => [id, [...hosts]]),
        totalVisits: this.totalVisits,
        currentTier: this.currentTier,
      };
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(data));
    } catch (error) {
      console.warn('Could not save shelf progression.', error);
    }
  }

  /** Record a completed visit: visitor visited host's home cube. */
  recordVisit(visitorId: string, hostCubeId: string): void {
    this.totalVisits++;
    this.roomsReceivedVisitors.add(hostCubeId);

    if (!this.cubemanVisits.has(visitorId)) {
      this.cubemanVisits.set(visitorId, new Set());
    }
    this.cubemanVisits.get(visitorId)!.add(hostCubeId);
    this.persist();
  }

  /** Number of cubemen who have visited all `targetCount` other rooms. */
  private countCubemenVisitedAll(targetCount: number): number {
    let count = 0;
    for (const visited of this.cubemanVisits.values()) {
      if (visited.size >= targetCount) count++;
    }
    return count;
  }

  /** Compute the current tier based on visit milestones. */
  computeTier(): ShelfTier {
    // Tier 4: all 4 cubemen visited all 3 others, 10+ total visits
    if (
      this.countCubemenVisitedAll(3) >= MAX_CUBEMEN &&
      this.totalVisits >= 10
    ) {
      return SHELF_TIERS[4]!;
    }
    // Tier 3: 2 cubemen visited all other 3
    if (this.countCubemenVisitedAll(3) >= 2) {
      return SHELF_TIERS[3]!;
    }
    // Tier 2: 1 cubeman visited all other 3
    if (this.countCubemenVisitedAll(3) >= 1) {
      return SHELF_TIERS[2]!;
    }
    // Tier 1: 4 different rooms received visitors
    if (this.roomsReceivedVisitors.size >= 4) {
      return SHELF_TIERS[1]!;
    }
    // Tier 0: default
    return SHELF_TIERS[0]!;
  }

  /** Check if the tier changed after a visit. Returns the new tier if changed, else null. */
  checkTierUp(): ShelfTier | null {
    const newTier = this.computeTier();
    if (newTier.tier > this.currentTier) {
      this.currentTier = newTier.tier;
      this.persist();
      return newTier;
    }
    return null;
  }

  /** Progress toward the next tier, for the debug console. */
  progressSummary(): string {
    const tier = this.current();
    const next = SHELF_TIERS[tier.tier + 1] ?? null;
    if (!next) return `Shelf: ${tier.name} (final tier, ${tier.open}/9 slots). Total visits: ${this.totalVisits}.`;
    let detail: string;
    switch (tier.tier) {
      case 0:
        detail = `${this.roomsReceivedVisitors.size}/4 rooms visited`;
        break;
      case 1:
      case 2:
      case 3: {
        const need = tier.tier === 1 ? 1 : 2;
        detail = `${this.countCubemenVisitedAll(3)}/${need} cubemen have visited all 3 others`;
        break;
      }
      default:
        detail = `${this.countCubemenVisitedAll(3)}/4 visited all others, ${this.totalVisits}/10 total visits`;
    }
    return `Shelf: ${tier.name} (${tier.open}/9 slots). Next: ${next.name} — ${detail}. Total visits: ${this.totalVisits}.`;
  }

  /** Current tier info. */
  current(): ShelfTier {
    return SHELF_TIERS[this.currentTier]!;
  }

  /** Stats for debugging. */
  debugState() {
    return {
      totalVisits: this.totalVisits,
      roomsReceivedVisitors: [...this.roomsReceivedVisitors],
      cubemanVisits: Object.fromEntries(
        [...this.cubemanVisits.entries()].map(([k, v]) => [k, [...v]]),
      ),
      currentTier: this.currentTier,
    };
  }
}
