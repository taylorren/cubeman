import type { Cube } from './cube';
import type { Cubeman } from './cubeman';

/** Direction across the shelf. */
export const SHELF_DIRECTIONS = ['left', 'right', 'up', 'down'] as const;
export type Dir = typeof SHELF_DIRECTIONS[number];
export type PlacementResult = { ok: true } | { ok: false; reason: string };

/**
 * The shelf: a row-major grid of slots, some holding cubes. Connections
 * between cubes are DERIVED from slot adjacency — never from scene-array
 * ordering — and are looked up at walk time. A `neighbor` exit resolves to
 * a specific cube when the adjacent slot is occupied; otherwise the exit
 * behaves as a wall. Placement changes preserve cube identity and reject
 * moves involving a resident or guest currently participating in a visit.
 */
export class Shelf {
  /** Slots fill each row from left to right before starting the next row. */
  readonly slots: Array<Cube | null>;
  /** Every living cubeman — the source of truth for shared-room occupancy. */
  private readonly cubemen: Cubeman[];

  constructor(
    slots: Array<Cube | null>,
    cubemen: Cubeman[],
    readonly columns = 2,
  ) {
    if (!Number.isInteger(columns) || columns < 1)
      throw new RangeError('Shelf columns must be a positive integer.');
    this.slots = [...slots];
    this.cubemen = cubemen;
  }

  cubes(): Cube[] {
    return this.slots.filter((c): c is Cube => c !== null);
  }

  slotOf(cube: Cube): number {
    return this.slots.indexOf(cube);
  }

  canRearrange(cube: Cube): boolean {
    const resident = this.residentOf(cube);
    return resident !== undefined && resident.cube === cube &&
      !this.cubemen.some((c) =>
        (c.home === cube || c.cube === cube) && (c.inVisitMode || c.cube !== c.home));
  }

  /** Move to an empty slot, or swap two placed cubes. Stored cubes need an
   *  empty slot so placing one never silently shelves another resident. */
  place(cube: Cube, target: number): PlacementResult {
    if (!Number.isInteger(target) || target < 0 || target >= this.slots.length)
      return { ok: false, reason: 'Choose a valid shelf slot.' };
    const source = this.slotOf(cube);
    if (source === target) return { ok: true };
    if (!this.canRearrange(cube))
      return { ok: false, reason: 'Wait until this cubeman and its visitor are home before moving it.' };
    const occupant = this.slots[target];
    if (occupant && source < 0)
      return { ok: false, reason: 'Choose an empty slot for a stored cube.' };
    if (occupant && !this.canRearrange(occupant))
      return { ok: false, reason: 'The destination cube is in a visit. Choose another slot or wait.' };
    if (source >= 0) this.slots[source] = occupant;
    this.slots[target] = cube;
    return { ok: true };
  }

  store(cube: Cube): PlacementResult {
    const slot = this.slotOf(cube);
    if (slot < 0) return { ok: false, reason: 'This cube is already stored.' };
    if (!this.canRearrange(cube))
      return { ok: false, reason: 'Wait until the visit ends before storing this cube.' };
    this.slots[slot] = null;
    return { ok: true };
  }

  /**
   * Resolve an orthogonal shelf direction. Returns the connected cube on that
   * side, or null when the exit is unconnected (= wall).
   */
  neighborOf(cube: Cube, dir: Dir): Cube | null {
    const i = this.slots.indexOf(cube);
    if (i < 0) return null;
    const column = i % this.columns;
    switch (dir) {
      case 'left':
        return column > 0 ? this.slots[i - 1] ?? null : null;
      case 'right':
        return column < this.columns - 1 ? this.slots[i + 1] ?? null : null;
      case 'up':
        return this.slots[i - this.columns] ?? null;
      case 'down':
        return this.slots[i + this.columns] ?? null;
    }
  }

  /**
   * Visiting capacity: one resident plus AT MOST one visitor, and never
   * the same cubeman twice. Keeps shared-room occupancy sane. Also, a cube
   * is CLOSED (curtain down) while its resident is away visiting — you can't
   * visit someone who isn't home, so it won't accept a visitor then.
   */
  canAcceptVisitor(cube: Cube, visitor: Cubeman): boolean {
    if (visitor.cube === cube) return false; // already inside
    const resident = this.residentOf(cube);
    if (resident && resident.cube !== cube) return false; // resident is away (closed)
    return !this.cubemen.some((c) => c !== visitor && c.cube === cube && c.home !== cube);
  }

    /** The cubeman whose HOME is `cube` (its resident owner). */
  residentOf(cube: Cube): Cubeman | undefined {
    return this.cubemen.find((c) => c.home === cube);
  }

  /**
   * Determine which orthogonal direction `dest` lies from `cube` on the shelf,
   * or null if they are not adjacent. Used to know which edge a cubeman must
   * walk to when crossing between cubes.
   */
  exitDirection(cube: Cube, dest: Cube): Dir | null {
    const from = this.slots.indexOf(cube);
    const to = this.slots.indexOf(dest);
    if (from < 0 || to < 0) return null;
    const fCol = from % this.columns;
    const tCol = to % this.columns;
    const fRow = Math.floor(from / this.columns);
    const tRow = Math.floor(to / this.columns);
    if (fRow === tRow) {
      if (fCol - tCol === 1) return 'left';
      if (tCol - fCol === 1) return 'right';
    }
    if (fCol === tCol) {
      if (fRow - tRow === 1) return 'up';
      if (tRow - fRow === 1) return 'down';
    }
    return null;
  }
}
