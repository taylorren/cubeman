const STORAGE_KEY_PREFIX = 'matchman.shelf.v1';

/**
 * A stable identifier for this machine base. Different devices (or browser
 * profiles with different platform characteristics) each get their own id,
 * so the shelf layout is preserved per machine rather than shared.
 */
let cachedStorageKey: string | null = null;

function machineBase(): string {
  if (cachedStorageKey !== null) return cachedStorageKey;
  const components = [
    navigator.userAgent,
    String(screen.width),
    String(screen.height),
    Intl.DateTimeFormat().resolvedOptions().timeZone ?? '',
  ];
  // FNV-1a over the joined components — deterministic per machine base.
  let hash = 0x811c9dc5;
  for (const component of components) {
    for (let i = 0; i < component.length; i++) {
      hash ^= component.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
  }
  cachedStorageKey = hash.toString(16).padStart(8, '0');
  return cachedStorageKey;
}

/** A per-machine-base storage key for the given feature prefix. */
export function machineScopedKey(prefix: string): string {
  return `${prefix}.${machineBase()}`;
}

function storageKey(): string {
  const key = machineScopedKey(STORAGE_KEY_PREFIX);
  // One-time migration: layouts saved before per-machine scoping move to
  // the machine-scoped key so existing placements are preserved.
  try {
    const legacy = localStorage.getItem(STORAGE_KEY_PREFIX);
    if (legacy !== null) {
      localStorage.setItem(key, legacy);
      localStorage.removeItem(STORAGE_KEY_PREFIX);
    }
  } catch (error) {
    console.warn('Could not migrate the saved shelf layout.', error);
  }
  return key;
}

type SavedLayout = { slots: Array<string | null>; warning: string | null };

export function loadPlacement(availableIds: Set<string>, fallback: Array<string | null>): SavedLayout {
  let raw: string | null;
  try {
    raw = localStorage.getItem(storageKey());
  } catch (error) {
    console.warn('Shelf storage is unavailable.', error);
    return { slots: [...fallback], warning: 'Shelf storage is unavailable; placement is session-only.' };
  }
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
    localStorage.setItem(storageKey(), JSON.stringify(slots));
    return null;
  } catch (error) {
    console.warn('Could not save shelf placement.', error);
    return 'Placement changed for this session, but could not be saved.';
  }
}
