const STORAGE_KEY = 'matchman.shelf.v1';

type SavedLayout = { slots: Array<string | null>; warning: string | null };

export function loadPlacement(availableIds: Set<string>, fallback: Array<string | null>): SavedLayout {
  let raw: string | null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(slots));
    return null;
  } catch (error) {
    console.warn('Could not save shelf placement.', error);
    return 'Placement changed for this session, but could not be saved.';
  }
}
