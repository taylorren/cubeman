import './style.css';
import { Loop } from './core/loop';
import { LCD } from './render/lcd';
import { sample } from './render/skeleton';
import { professions } from './content/professions';
import type { Overlay } from './content/professions';
import { Achievements, clearAchievementStorage } from './game/achievements';
import { Cube, doorOpenness } from './game/cube';
import { Cubeman } from './game/cubeman';
import { Shelf } from './game/shelf';
import { ShelfProgression, SHELF_TIERS, TOTAL_SLOTS } from './game/shelf-progression';
import { VisitSession } from './game/visit';
import { gameLog } from './core/debug';
import { loadPlacement, savePlacement } from './game/placement-storage';

const FPS = 30;
const PX = 48;
const SCALE = 7;

gameLog.setEnabled(new URLSearchParams(window.location.search).get('debug') !== '0');

type ResidentDefinition = { id: string; name: string; professionId: string; unlock?: string };
const definitions: ResidentDefinition[] = [
  { id: 'cube-0', name: 'Sticko', professionId: 'stickman' },
  { id: 'cube-2', name: 'Dizzy', professionId: 'dancer', unlock: 'warmed-up' },
  { id: 'cube-4', name: 'Maestro', professionId: 'musician', unlock: 'jam-session' },
  { id: 'cube-6', name: 'Chandler', professionId: 'chef', unlock: 'culinary-arts' },
];
const cubemen: Cubeman[] = [];
const cubesById = new Map<string, Cube>();
const shelf = new Shelf(Array(TOTAL_SLOTS).fill(null), cubemen, 3);
const shelfEl = document.getElementById('shelf')!;
shelfEl.style.setProperty('--shelf-n', '3');
const slots = [...shelfEl.querySelectorAll<HTMLElement>('.slot[data-slot]')];
const goalsEl = document.getElementById('goals')!;
const rosterEl = document.getElementById('roster')!;
const statusEl = document.getElementById('shelf-status')!;
const banner = document.getElementById('banner')!;
let bannerTimer: ReturnType<typeof setTimeout> | undefined;
let selectedCube: Cube | null = null;
let placingCube: Cube | null = null;

const achievements = new Achievements((a) => {
  banner.textContent = `🏆 Achievement unlocked — ${a.name}: ${a.desc}`;
  banner.hidden = false;
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => (banner.hidden = true), 3500);
  ensureUnlockedCubemen();
  renderGoals();
  renderRoster();
});

const visits: VisitSession[] = [];
const shelfProgress = new ShelfProgression();

function beginVisit(visitor: Cubeman): void {
  const host = cubemen.find((c) => c.home === visitor.cube && c !== visitor);
  if (!host) {
    gameLog.record('visit.session-rejected', { reason: 'no-host', visitor: visitor.debugState() });
    return;
  }
  // Don't start a second visit in the same host room concurrently.
  if (visits.some((v) => v.host === host && !v.isEnded)) {
    gameLog.record('visit.session-rejected', {
      reason: 'host-already-in-session',
      visitor: visitor.debugState(),
      host: host.debugState(),
    });
    return;
  }
  const session = new VisitSession(host, visitor, performance.now());
  session.onVisitEnd = (v, h) => {
    shelfProgress.recordVisit(v.name, h.home.id);
    const tier = shelfProgress.checkTierUp();
    if (tier) onShelfTierUp(tier);
    // Progress is debug-only: never surfaced in the UI.
    console.debug('[shelf-progression]', shelfProgress.progressSummary());
  };
  visits.push(session);
}

function onShelfTierUp(tier: typeof SHELF_TIERS[number]): void {
  renderShelf();
  banner.textContent = `🎉 Shelf expanded — ${tier.name}! Now ${tier.open} open slots.`;
  banner.hidden = false;
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => (banner.hidden = true), 3500);
}

function ensureUnlockedCubemen(): void {
  for (const definition of definitions) {
    if (cubesById.has(definition.id) ||
        (definition.unlock && !achievements.isUnlocked(definition.unlock))) continue;
    const profession = professions[definition.professionId];
    if (!profession) throw new Error(`Unknown profession: ${definition.professionId}`);
    const cube = new Cube(definition.id, profession);
    cubesById.set(cube.id, cube);
    cubemen.push(new Cubeman({
      name: definition.name,
      profession,
      home: cube,
      shelf,
      onAction: (action) => achievements.record(action.id),
      onVisitArrived: beginVisit,
    }));
  }
}

const debugControls = {
  enable(): void {
    gameLog.setEnabled(true);
    gameLog.record('debug.snapshot', debugControls.snapshot());
  },
  disable(): void {
    gameLog.setEnabled(false);
  },
  clear: () => gameLog.clear(),
  export: () => gameLog.export(),
  status: () => gameLog.status(),
  flush: () => gameLog.flush(),
  /** Wipe persisted progression (achievements → goals and cubeman unlocks)
   *  and reload, so a fresh session starts with only Sticko. */
  resetProgress(): void {
    clearAchievementStorage();
    window.location.reload();
  },
  snapshot: () => ({
    cubemen: cubemen.map((c) => ({ ...c.debugState(), slot: shelf.slotOf(c.home) })),
    visits: visits.map((v) => v.debugState()),
    layout: shelf.slots.map((cube) => cube?.id ?? null),
  }),
  /** Order a cubeman to walk to one of its rooms, e.g.
   *  `cubemanDebug.goToRoom('Sticko', 'bathroom')`. Room matches by id or name. */
  goToRoom(name: string, room: string): string {
    const cubeman = cubemen.find((c) => c.name.toLowerCase() === name.toLowerCase());
    if (!cubeman) {
      return `Unknown cubeman "${name}". Known: ${cubemen.map((c) => c.name).join(', ')}.`;
    }
    return cubeman.goToRoom(room);
  },
};

declare global {
  interface Window {
    cubemanDebug: typeof debugControls;
  }
}
window.cubemanDebug = debugControls;
document.addEventListener('visibilitychange', () => {
  gameLog.record('page.visibility', { state: document.visibilityState });
});

// Rendering surfaces belong to cubes, not slots: moving a toy never rebinds
// its buttons, resets its character, or swaps another resident's canvas.
type Toy = { element: HTMLElement; lcd: LCD; buttons: HTMLButtonElement[] };
const toys = new Map<Cube, Toy>();

function resident(cube: Cube): Cubeman {
  const cubeman = shelf.residentOf(cube);
  if (!cubeman) throw new Error(`Cube ${cube.id} has no resident.`);
  return cubeman;
}

function setStatus(message: string): void {
  statusEl.textContent = message;
}

function updateSelection(): void {
  slots.forEach((slot, i) => {
    const cube = shelf.slots[i];
    slot.classList.toggle('selected', cube !== null && cube === selectedCube);
    slot.classList.toggle('placement-target', placingCube !== null);
  });
  document.getElementById('cancel-placement')!.hidden = placingCube === null;
}

function selectCube(cube: Cube): void {
  selectedCube = cube;
  updateSelection();
}

function cancelPlacement(): void {
  placingCube = null;
  updateSelection();
  setStatus('Choose Move or Place in the roster to arrange the shelf.');
}

function startPlacement(cube: Cube): boolean {
  if (!shelf.canRearrange(cube)) {
    setStatus('Wait until the visit ends before moving this cube.');
    return false;
  }
  placingCube = cube;
  updateSelection();
  setStatus(shelf.slotOf(cube) < 0
    ? `Choose an empty slot for ${resident(cube).name}. Escape cancels.`
    : `Choose a slot for ${resident(cube).name}; occupied slots swap. Escape cancels.`);
  return true;
}

function finishPlacement(cube: Cube): void {
  placingCube = null;
  selectedCube = shelf.slotOf(cube) >= 0 ? cube : shelf.cubes()[0] ?? null;
  const warning = savePlacement(shelf.slots.map((c) => c?.id ?? null));
  renderShelf();
  renderRoster();
  setStatus(warning ?? 'Shelf saved. Adjacent cubes can visit; diagonal cubes are not connected.');
}

function chooseSlot(index: number): void {
  if (placingCube) {
    const cube = placingCube;
    const result = shelf.place(cube, index);
    if (!result.ok) {
      setStatus(result.reason);
      return;
    }
    finishPlacement(cube);
  } else {
    const cube = shelf.slots[index];
    if (cube) selectCube(cube);
    else setStatus('Drag a cube here or use the roster to place one.');
  }
}

function storeCube(cube: Cube): void {
  const result = shelf.store(cube);
  if (!result.ok) {
    setStatus(result.reason);
    return;
  }
  finishPlacement(cube);
}

function triggerFor(cubeman: Cubeman, spec: string): void {
  if (spec === 'random') {
    // Surprise picks among the actions usable where the cubeman is now
    // (room-locked actions like shower/bath only enter the pool in the bathroom)
    const pool = cubeman.actionsInCurrentRoom();
    cubeman.press(pool[Math.floor(Math.random() * pool.length)]!);
    return;
  }
  const action = cubeman.prof.actions[Number(spec)];
  if (action) cubeman.press(action);
}

function toyFor(cube: Cube): Toy {
  const existing = toys.get(cube);
  if (existing) return existing;
  const cubeman = resident(cube);
  const element = document.createElement('div');
  element.className = `cube cube-${cube.prof.id}`;
  const bezel = document.createElement('div');
  bezel.className = 'bezel';
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-label', `${cubeman.name}'s LCD world`);
  bezel.append(canvas);
  const controls = document.createElement('div');
  controls.className = 'buttons';
  const buttons: HTMLButtonElement[] = [];
  // Exactly three buttons: the first two actions on either side, and a
  // middle "Surprise" that picks one of the actions at random. Unlabeled.
  const actions = cube.prof.actions;
  const layout: Array<{ spec: string; star?: boolean }> = [
    { spec: '0' },
    { spec: 'random', star: true },
    { spec: '1' },
  ];
  for (const entry of layout) {
    const isRandom = entry.spec === 'random';
    const action = isRandom ? undefined : actions[Number(entry.spec)];
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn' + (isRandom ? ' btn-star' : '');
    button.value = entry.spec;
    button.setAttribute('aria-label',
      `${cubeman.name}: ${action ? action.name : 'Surprise (one of all actions)'}`);
    button.title = action?.name ?? 'Surprise';
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      selectCube(cube);
      triggerFor(cubeman, entry.spec);
    });
    buttons.push(button);
    controls.append(button);
  }
  element.append(bezel, controls);
  const toy = { element, lcd: new LCD(canvas, PX, SCALE), buttons };
  toys.set(cube, toy);
  return toy;
}

function renderShelf(): void {
  const tier = shelfProgress.current();
  const openSet = new Set(tier.slots);
  slots.forEach((slot, i) => {
    const cube = shelf.slots[i];
    const locked = !openSet.has(i);
    slot.classList.toggle('slot-empty', cube === null && !locked);
    slot.classList.toggle('slot-locked', locked);
    slot.dataset.locked = locked ? 'true' : 'false';
    slot.classList.remove('curtained', 'drag-over');
    if (locked) {
      slot.replaceChildren();
      slot.draggable = false;
      return;
    }
    if (cube) {
      slot.replaceChildren(toyFor(cube).element);
      // Enable drag-and-drop for rearranging cubes
      slot.draggable = true;
      slot.dataset.slotIndex = String(i);
    } else {
      slot.replaceChildren();
      slot.draggable = false;
    }
  });
  updateSelection();
}

slots.forEach((slot, index) => {
  slot.addEventListener('click', () => chooseSlot(index));
  // Drag-and-drop for rearranging cubes on the shelf
  slot.addEventListener('dragstart', (event) => {
    const cube = shelf.slots[index];
    if (!cube || !shelf.canRearrange(cube)) {
      event.preventDefault();
      return;
    }
    startPlacement(cube);
    event.dataTransfer?.setData('text/plain', String(index));
    event.dataTransfer!.effectAllowed = 'move';
  });
  slot.addEventListener('dragover', (event) => {
    if (!placingCube) return;
    event.preventDefault();
    event.dataTransfer!.dropEffect = 'move';
    slot.classList.add('drag-over');
  });
  slot.addEventListener('dragleave', () => slot.classList.remove('drag-over'));
  slot.addEventListener('drop', (event) => {
    event.preventDefault();
    slot.classList.remove('drag-over');
    if (placingCube) chooseSlot(index);
  });
  slot.addEventListener('dragend', () => {
    for (const slotEl of slots) slotEl.classList.remove('drag-over');
  });
});
document.getElementById('cancel-placement')!.addEventListener('click', cancelPlacement);

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && placingCube) {
    e.preventDefault();
    cancelPlacement();
    return;
  }
  if (e.ctrlKey || e.metaKey || e.altKey ||
      (e.target instanceof HTMLElement && e.target.closest('input, textarea, select, [contenteditable="true"]'))) return;
  // 3-button toy layout: keys 1/2 = first two actions, 0 or * = Surprise
  const spec = e.key === '0' || e.key === '*' ? 'random' :
    e.key === '1' ? '0' : e.key === '2' ? '1' : null;
  if (spec === null) return;
  if (!selectedCube) {
    setStatus('Place and select a cube first.');
    return;
  }
  triggerFor(resident(selectedCube), spec);
});

// --- Shell panels: goals + roster ---------------------------------------------

function renderGoals(): void {
  goalsEl.replaceChildren(
    ...achievements.status().map((a) => {
      const li = document.createElement('li');
      li.className = 'goal' + (a.done ? ' done' : '');
      const state = document.createElement('span');
      state.className = 'goal-state';
      state.textContent = a.done ? '✓' : '';
      state.setAttribute('aria-label', a.done ? 'Completed' : 'Not completed');
      const box = document.createElement('span');
      const name = document.createElement('div');
      name.className = 'goal-name';
      // hidden achievements stay a mystery until earned
      name.textContent = a.hidden && !a.done ? '???' : a.name;
      const desc = document.createElement('div');
      desc.className = 'goal-desc';
      desc.textContent = a.hidden && !a.done ? 'Keep exploring to discover…' : a.desc;
      box.append(name, desc);
      li.append(state, box);
      return li;
    }),
  );
}

/** The unlock requirement text for a locked cubeman, sourced from the
 *  achievement list so hints can never drift from the actual requirement. */
function lockedNote(unlockId?: string): string {
  const a = achievements.status().find((s) => s.id === unlockId);
  return a ? `Locked · ${a.name}: ${a.desc}` : 'Locked';
}

function renderRoster(): void {
  rosterEl.replaceChildren();
  for (const definition of definitions) {
    const cube = cubesById.get(definition.id);
    const profession = professions[definition.professionId]!;
    const li = document.createElement('li');
    li.className = 'chip' + (cube ? '' : ' chip-locked');
    let face: HTMLElement;
    if (cube) {
      const canvas = document.createElement('canvas');
      canvas.className = `chip-face chip-face-${profession.id}`;
      new LCD(canvas, 48, 1).draw(sample(profession.idle, 0), 0);
      face = canvas;
    } else {
      face = document.createElement('span');
      face.className = 'chip-face';
      face.textContent = '?';
    }
    const box = document.createElement('div');
    box.className = 'chip-details';
    const name = document.createElement('div');
    name.className = 'chip-name';
    name.textContent = `${definition.name} the ${profession.name}`;
    const note = document.createElement('div');
    note.className = 'chip-note';
    const slot = cube ? shelf.slotOf(cube) : -1;
    // locked chips show their unlock requirement straight from the
    // achievement list — one source of truth, no hardcoded hints
    note.textContent = !cube
      ? lockedNote(definition.unlock)
      : slot >= 0 ? `Slot ${slot + 1}` : 'Stored · place on an empty slot to play';
    box.append(name, note);
    if (cube) {
      const actions = document.createElement('div');
      actions.className = 'placement-actions';
      const move = document.createElement('button');
      move.type = 'button';
      move.className = 'placement-control';
      move.textContent = slot >= 0 ? 'Move' : 'Place';
      move.dataset.placementCube = cube.id;
      move.setAttribute('aria-label', `${slot >= 0 ? 'Move' : 'Place'} ${definition.name}`);
      move.addEventListener('click', () => startPlacement(cube));
      actions.append(move);
      if (slot >= 0) {
        const store = document.createElement('button');
        store.type = 'button';
        store.className = 'placement-control';
        store.textContent = 'Store';
        store.dataset.placementCube = cube.id;
        store.setAttribute('aria-label', `Store ${definition.name}`);
        store.addEventListener('click', () => storeCube(cube));
        actions.append(store);
      }
      box.append(actions);
      li.draggable = true;
      li.addEventListener('dragstart', (event) => {
        if (!startPlacement(cube)) {
          event.preventDefault();
          return;
        }
        event.dataTransfer?.setData('text/plain', cube.id);
      });
      li.addEventListener('dragend', () => {
        for (const slotEl of slots) slotEl.classList.remove('drop-target');
        if (placingCube) cancelPlacement();
      });
    }
    li.append(face, box);
    rosterEl.append(li);
  }
  updatePlacementAvailability();
}

function updatePlacementAvailability(): void {
  for (const button of rosterEl.querySelectorAll<HTMLButtonElement>('button[data-placement-cube]')) {
    const cube = cubesById.get(button.dataset.placementCube!);
    button.disabled = !cube || !shelf.canRearrange(cube);
  }
}

ensureUnlockedCubemen();
const saved = loadPlacement(new Set(cubesById.keys()), ['cube-0', null, null, null, null, null, null, null, null]);
saved.slots.forEach((id, index) => {
  if (id === null) return;
  const result = shelf.place(cubesById.get(id)!, index);
  if (!result.ok) throw new Error(result.reason);
});
selectedCube = shelf.cubes()[0] ?? null;
renderGoals();
renderShelf();
renderRoster();
setStatus(saved.warning ?? 'Move or drag cubes from the roster to choose which neighbors connect.');

// --- "Z z z" overlay while asleep -------------------------------------------

function drawZ(ctx: CanvasRenderingContext2D, x: number, y: number, u: number): void {
  ctx.fillRect(x, y, 3 * u, u); // top bar
  ctx.fillRect(x + 2 * u, y + u, u, u); // diagonal
  ctx.fillRect(x, y + 2 * u, 3 * u, u); // bottom bar
}

const zzzOverlay: Overlay = (ctx, frame) => {
  const cycle = (frame % 120) / 120;
  for (let i = 0; i < 3; i++) {
    const p = (cycle + i * 0.3) % 1;
    if (p > 0.85) continue; // brief gap before reappearing at the bottom
    // rises from the pillow (head is near the right wall in bed)
    const x = 42 - p * 7;
    const y = 36 - p * 22;
    drawZ(ctx, x, y, 1.1 + p * 1.1); // grows as it rises
  }
};

const curtainOverlay: Overlay = (ctx) => {
  // A dropped curtain across an empty, closed cube: a rod at the top and
  // horizontal folds hanging down — the "nobody's home" signal.
  ctx.fillRect(0, 4, 48, 1); // rod
  for (let y = 7; y < 44; y += 6) ctx.fillRect(2, y, 44, 2); // folds
};

// --- Travel scenery: ladder hatch + doors ------------------------------------

function drawLadder(ctx: CanvasRenderingContext2D): void {
  // A ladder through the ceiling/floor hatch, shown while a cubeman is
  // climbing in or out at the room's ladder position (body-center x = 24).
  for (const rx of [20, 28]) ctx.fillRect(rx, 5, 1, 39); // rails
  for (let y = 9; y < 44; y += 5) ctx.fillRect(20, y, 9, 1); // rungs
}

function drawDoor(ctx: CanvasRenderingContext2D, dir: 'left' | 'right', open: number): void {
  // A doorway in a side wall: the opening grows upward from the floor as
  // the door retracts into the wall, then shrinks again as it closes.
  const w = 4;
  const x = dir === 'right' ? 48 - w : 0;
  const top = 10;
  const height = 30;
  const opening = Math.round(open * height);
  if (opening > 0) ctx.fillRect(x, top + height - opening, w, opening);
  // frame posts so the doorway reads even when fully open
  ctx.fillRect(x, top - 1, w, 1);
  ctx.fillRect(x, top + height, w, 1);
}

// --- Loop: ONE loop updates the world and renders every occupied slot -------

let wsFrame = 0;
const loop = new Loop(
  FPS,
  () => {
    // worlds evolve even when nobody is home (the ball keeps its roll)
    for (const cube of shelf.cubes()) cube.tick();
    for (const cubeman of cubemen) {
      if (shelf.slotOf(cubeman.home) >= 0) cubeman.tick();
    }
    // advance visits and drop any that have ended (their visitor is
    // returning home on its own now)
    const now = performance.now();
    for (const v of visits) v.tick(now);
    for (let i = visits.length - 1; i >= 0; i--) if (visits[i]!.isEnded) visits.splice(i, 1);
    updatePlacementAvailability();
  },
  () => {
    wsFrame++;
    // Each cube's display shows its current room, then EVERY cubeman
    // standing in that cube — the resident and any visitor share the
    // surface (shared-room occupancy). A cube whose resident is away shows
    // a curtain instead of characters, and its controls go dead.
    for (const cube of shelf.cubes()) {
      const toy = toyFor(cube);
      const cubeman = resident(cube);
      const slot = slots[shelf.slotOf(cube)]!;
      const closed = cubeman.cube !== cube; // resident is out visiting
      const occupants = cubemen.filter((c) => c.cube === cube);
      // dead buttons for a visitor; host's stay live
      for (const b of toy.buttons) b.disabled = cubeman.isVisitor;
      slot.classList.toggle('curtained', closed);
      toy.lcd.drawBatch(wsFrame, {
        behind: (ctx, f) => {
          cube.drawRoom(ctx, cube.currentSceneId, f);
          // travel scenery: ladder hatch and doors live in the room itself
          if (cube.ladderOn) drawLadder(ctx);
          if (cube.doorFx) drawDoor(ctx, cube.doorFx.dir, doorOpenness(cube.doorFx.t));
        },
        sprites: closed
          ? []
          : occupants.map((c) => {
              const overlay = c.actionOverlay;
              let front: Overlay | undefined;
              if (c.sleeping) front = (ctx) => zzzOverlay(ctx, c.animFrame);
              // an in-progress action overlay (e.g. shower stream, tub near-wall)
              else if (overlay) front = (ctx) => overlay(ctx, c.animFrame);
              return { skeleton: c.pose(), front };
            }),
        front: closed ? curtainOverlay : undefined,
      });
    }
  },
);
loop.start();
