import type { Cube } from './cube';
import type { Cubeman } from './cubeman';

/** Direction across the shelf. */
export type Dir = 'left' | 'right';

/**
 * The shelf: an ordered row of slots, some holding cubes. Connections
 * between cubes are DERIVED from slot adjacency — never from scene-array
 * ordering — and are looked up at walk time. A `neighbor` exit resolves to
 * a specific cube when the adjacent slot is occupied; otherwise the exit
 * behaves as a wall. Dragging/rearrangement is deferred; placement is
 * fixed for now.
 */
export class Shelf {
  /** Slot i's left neighbor is slot i-1; its right neighbor is slot i+1. */
  readonly slots: Array<Cube | null>;
  /** Every living cubeman — the source of truth for shared-room occupancy. */
  private readonly cubemen: Cubeman[];

  constructor(slots: Array<Cube | null>, cubemen: Cubeman[]) {
    this.slots = slots;
    this.cubemen = cubemen;
  }

  cubes(): Cube[] {
    return this.slots.filter((c): c is Cube => c !== null);
  }

  /**
   * Resolve a `neighbor` scene edge. Returns the connected cube on that
   * side, or null when the exit is unconnected (= wall).
   */
  neighborOf(cube: Cube, dir: Dir): Cube | null {
    const i = this.slots.indexOf(cube);
    if (i < 0) return null;
    const j = dir === 'left' ? i - 1 : i + 1;
    return this.slots[j] ?? null;
  }

  /**
   * Visiting capacity: one resident plus AT MOST one visitor, and never
   * the same cubeman twice. Keeps shared-room occupancy sane.
   */
  canAcceptVisitor(cube: Cube, visitor: Cubeman): boolean {
    if (visitor.cube === cube) return false; // already inside
    return !this.cubemen.some((c) => c !== visitor && c.cube === cube && c.home !== cube);
  }
}
