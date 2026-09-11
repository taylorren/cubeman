const STORAGE_KEY_PREFIX = 'matchman.shelf.v1';

/**
 * Storage keys are PLAIN (no machine scoping): localStorage is already
 * per-browser-profile, so per-device separation comes for free. An earlier
 * version scoped keys with a hash of userAgent/screen/timezone — any browser
 * update or OS change silently "lost" the shelf. loadScoped() recovers data
 * written by those old keys.
 */
let cachedRecoveryDone = new Set<string>();

/**
 * Read `prefix` from localStorage; if empty, recover the best value from any
 * stale machine-scoped key (`prefix.<8-hex>`) left by the old hashing scheme,
 * migrate it to the plain key, and remove the stale keys. `better` picks
 * between two candidate raw values (e.g. the one with the higher tier).
 */
export function loadScoped(
  prefix: string,
  better: (current: string | null, candidate: string) => string | null,
): string | null {
  try {
    let raw = localStorage.getItem(prefix);
    if (cachedRecoveryDone.has(prefix)) return raw;
    const stale: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key === null) continue;
      if (key !== prefix && key.startsWith(`${prefix}.`) &&
          /^[0-9a-f]{8}$/.test(key.slice(prefix.length + 1))) {
        stale.push(key);
        const candidate = localStorage.getItem(key);
        if (candidate !== null) raw = better(raw, candidate);
      }
    }
    if (raw !== null && raw !== localStorage.getItem(prefix)) {
      localStorage.setItem(prefix, raw);
    }
    for (const key of stale) localStorage.removeItem(key);
    cachedRecoveryDone.add(prefix);
    return raw;
  } catch (error) {
    console.warn('Shelf storage is unavailable.', error);
    return null;
  }
}

type SavedLayout = { slots: Array<string | null>; warning: string | null };

export function loadPlacement(availableIds: Set<string>, fallback: Array<string | null>): SavedLayout {
  const raw = loadScoped(STORAGE_KEY_PREFIX, (current, candidate) => current ?? candidate);
  if (raw === null) return { slots: [...fallback], warning: null };
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    console.warn('Saved shelf layout contains invalid JSON.', error);
    return { slots: [...fallback], warning: 'The saved shelf layout was invalid; using the starting layout.' };
  }
  if (!Array.isArray(data) || data.length !== fallback.length ||
      !data.every((id): id is string | null => id === null || typeof id === 'string')) {
    console.warn('Saved shelf layout has an invalid shape.');
    return { slots: [...fallback], warning: 'The saved shelf layout was invalid; using the starting layout.' };
  }
  const seen = new Set<string>();
  const slots: Array<string | null> = [];
  let repaired = false;
  for (const id of data) {
    if (id === null) slots.push(null);
    else if (!availableIds.has(id) || seen.has(id)) {
      repaired = true;
      slots.push(null);
    } else {
      seen.add(id);
      slots.push(id);
    }
  }
  if (repaired) console.warn('Removed locked, unknown, or duplicate cubes from the saved shelf.');
  return {
    slots,
    warning: repaired ? 'Unavailable or duplicate cubes were removed from the saved shelf.' : null,
  };
}

export function savePlacement(slots: ReadonlyArray<string | null>): string | null {
  try {
    localStorage.setItem(STORAGE_KEY_PREFIX, JSON.stringify(slots));
    return null;
  } catch (error) {
    console.warn('Could not save shelf placement.', error);
    return 'Placement changed for this session, but could not be saved.';
  }
}

/** Wipe the persisted shelf layout (used by the debug reset command). Also
 *  removes any stale machine-scoped copies. */
export function clearPlacementStorage(): void {
  try {
    localStorage.removeItem(STORAGE_KEY_PREFIX);
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key !== null && key.startsWith(`${STORAGE_KEY_PREFIX}.`)) {
        localStorage.removeItem(key);
      }
    }
  } catch {
    // storage unavailable — nothing to wipe
  }
}
