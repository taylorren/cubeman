import './style.css';
import { Loop } from './core/loop';
import { LCD } from './render/lcd';
import { sample } from './render/skeleton';
import { professions } from './content/professions';
import type { Overlay } from './content/professions';
import { Achievements } from './game/achievements';
import { Cube } from './game/cube';
import { Cubeman } from './game/cubeman';
import { Shelf } from './game/shelf';
import { VisitSession } from './game/visit';

const FPS = 30;
const PX = 48;
const SCALE = 7;

const prof = professions.stickman;

// --- World: two cubes on the shelf --------------------------------------------

// Each toy is its own little world: rooms, scenery and props belong to the
// CUBE; the characters living in them are separate Cubeman runtimes. Both
// cubes use the Stickman profession content for now.
const cubeA = new Cube('cube-0', prof);
const cubeB = new Cube('cube-1', prof);

const cubemen: Cubeman[] = [];
// Slots 0 and 1 are occupied and horizontally adjacent → connected.
// Empty slots stay unconnected: their neighbor exits behave as walls.
const shelf = new Shelf([cubeA, cubeB, null, null], cubemen);

// --- App-level progression (shared by all cubemen) -----------------------------

const banner = document.getElementById('banner')!;
let bannerTimer: ReturnType<typeof setTimeout> | undefined;

const achievements = new Achievements((a) => {
  banner.textContent = `🏆 Achievement unlocked — ${a.name}: ${a.desc}`;
  banner.hidden = false;
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => (banner.hidden = true), 3500);
  renderGoals();
});

/** Active visits — the coordinator owning each togetherness. */
const visits: VisitSession[] = [];

/** Run the visit once A has crossed into B's living room as a visitor. */
function beginVisit(visitor: Cubeman): void {
  const host = cubemen.find((c) => c.home === visitor.cube && c !== visitor);
  if (!host) return;
  // Don't start a second visit in the same host room concurrently.
  if (visits.some((v) => v.host === host && !v.isEnded)) return;
  visits.push(new VisitSession(host, visitor, performance.now()));
}

cubemen.push(
  new Cubeman({
    name: 'Sticko',
    profession: prof,
    home: cubeA,
    shelf,
    onAction: (a) => achievements.record(a.id),
    onVisitArrived: beginVisit,
  }),
  new Cubeman({
    name: 'Pip',
    profession: prof,
    home: cubeB,
    shelf,
    onAction: (a) => achievements.record(a.id),
    onVisitArrived: beginVisit,
  }),
);

// --- Shell: per-cube rendering surfaces and scoped controls ------------------

type Toy = { slot: HTMLElement; cubeman: Cubeman; lcd: LCD; buttons: HTMLButtonElement[] };

// Each cube gets its own rendering surface. Its cubeman is the resident;
// visitors render onto the SAME surface (shared-room occupancy).
const toys: Toy[] = cubemen.map((cubeman, i) => {
  const slot = document.querySelector<HTMLElement>(`.slot[data-slot="${i}"]`)!;
  const canvas = slot.querySelector('canvas')!;
  const buttons = [...slot.querySelectorAll<HTMLButtonElement>('button[data-action]')];
  return { slot, cubeman, lcd: new LCD(canvas, PX, SCALE), buttons };
});

let selected = 0;

function selectSlot(i: number): void {
  selected = i;
  for (const toy of toys) toy.slot.classList.toggle('selected', toy.slot === toys[i]!.slot);
}

toys.forEach((toy, i) => toy.slot.addEventListener('click', () => selectSlot(i)));
selectSlot(0);

function triggerFor(cubeman: Cubeman, spec: string): void {
  if (spec === 'random') {
    const pool = cubeman.prof.actions;
    cubeman.press(pool[Math.floor(Math.random() * pool.length)]!);
    return;
  }
  const action = cubeman.prof.actions[Number(spec)];
  if (action) cubeman.press(action);
}

// Buttons are scoped to their own cube; keys act on the SELECTED cube.
for (const b of document.querySelectorAll<HTMLButtonElement>('button[data-action]')) {
  const toy = toys[Number(b.dataset.cube)]!;
  b.addEventListener('click', () => triggerFor(toy.cubeman, b.dataset.action!));
}
document.addEventListener('keydown', (e) => {
  if (e.key === 'Tab') {
    e.preventDefault();
    selectSlot((selected + 1) % toys.length);
    return;
  }
  const toy = toys[selected]!;
  const n = toy.cubeman.prof.actions.length;
  if (e.key >= '1' && e.key <= String(n)) triggerFor(toy.cubeman, String(Number(e.key) - 1));
  if (e.key === '0' || e.key === '*') triggerFor(toy.cubeman, 'random');
});

// --- Shell panels: goals + roster ---------------------------------------------

const goalsEl = document.getElementById('goals')!;

function renderGoals(): void {
  goalsEl.replaceChildren(
    ...achievements.status().map((a) => {
      const li = document.createElement('li');
      li.className = 'goal' + (a.done ? ' done' : '');
      const state = document.createElement('span');
      state.className = 'goal-state';
      state.textContent = '✓';
      const box = document.createElement('span');
      const name = document.createElement('div');
      name.className = 'goal-name';
      name.textContent = a.name;
      const desc = document.createElement('div');
      desc.className = 'goal-desc';
      desc.textContent = a.desc;
      box.append(name, desc);
      li.append(state, box);
      return li;
    }),
  );
}
renderGoals();

// Roster: placed/unlocked/locked professions. Locked entries are mystery
// silhouettes; unlocked-but-unplaced ones become draggable in a later phase.
const rosterEl = document.getElementById('roster')!;
const roster: Array<{ id: string; name: string; note: string }> = [
  { id: 'stickman', name: 'Stickman', note: 'on the shelf' },
  { id: 'stickman-2', name: 'Stickman', note: 'on the shelf' },
  { id: 'mystery-1', name: '???', note: 'keep playing to unlock' },
  { id: 'mystery-2', name: '???', note: 'keep playing to unlock' },
];
for (const c of roster) {
  const li = document.createElement('li');
  const locked = c.id.startsWith('mystery');
  li.className = 'chip' + (locked ? ' chip-locked' : '');
  // Avatar: a real LCD-rendered portrait of the cubeman's standing pose
  // (locked entries stay mystery placeholders).
  let face: HTMLElement;
  if (locked) {
    const span = document.createElement('span');
    span.className = 'chip-face';
    span.textContent = '?';
    face = span;
  } else {
    const cv = document.createElement('canvas');
    cv.className = 'chip-face';
    cv.title = c.name;
    new LCD(cv, 48, 1).draw(sample(prof.idle, 0), 0, {});
    face = cv;
  }
  const box = document.createElement('span');
  const name = document.createElement('div');
  name.className = 'chip-name';
  name.textContent = c.name;
  const note = document.createElement('div');
  note.className = 'chip-note';
  note.textContent = c.note;
  box.append(name, note);
  li.append(face, box);
  rosterEl.append(li);
}

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
  // vertical folds hanging down — the "nobody's home" signal.
  ctx.fillRect(0, 4, 48, 1); // rod
  for (let x = 2; x < 47; x += 6) ctx.fillRect(x, 5, 2, 41); // folds
};

// --- Loop: ONE loop updates the world and renders every occupied slot -------

let wsFrame = 0;
const loop = new Loop(
  FPS,
  () => {
    // worlds evolve even when nobody is home (the ball keeps its roll)
    for (const cube of shelf.cubes()) cube.tick();
    for (const cubeman of cubemen) cubeman.tick();
    // advance visits and drop any that have ended (their visitor is
    // returning home on its own now)
    const now = performance.now();
    for (const v of visits) v.tick(now);
    for (let i = visits.length - 1; i >= 0; i--) if (visits[i]!.isEnded) visits.splice(i, 1);
  },
  () => {
    wsFrame++;
    // Each cube's display shows its current room, then EVERY cubeman
    // standing in that cube — the resident and any visitor share the
    // surface (shared-room occupancy). A cube whose resident is away shows
    // a curtain instead of characters, and its controls go dead.
    for (const toy of toys) {
      const cube = toy.cubeman.home;
      const closed = toy.cubeman.cube !== cube; // resident is out visiting
      const occupants = cubemen.filter((c) => c.cube === cube);
      // dead buttons for a visitor; host's stay live
      for (const b of toy.buttons) b.disabled = toy.cubeman.isVisitor;
      toy.slot.classList.toggle('curtained', closed);
      toy.lcd.drawBatch(wsFrame, {
        behind: (ctx, f) => cube.drawRoom(ctx, cube.currentSceneId, f),
        sprites: closed
          ? []
          : occupants.map((c) => ({
              skeleton: c.pose(),
              front: c.sleeping ? (ctx, _f) => zzzOverlay(ctx, c.animFrame) : undefined,
            })),
        front: closed ? curtainOverlay : undefined,
      });
    }
  },
);
loop.start();

