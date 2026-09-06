import './style.css';
import { Loop } from './core/loop';
import { LCD } from './render/lcd';
import { animExtent, sample, shiftX } from './render/skeleton';
import { professions } from './content/professions';
import * as shared from './content/professions/shared';
import type { Action } from './content/professions';
import type { Anim } from './render/skeleton';
import { Achievements } from './game/achievements';
import { GRACE_MS, STAMINA, stamina } from './game/stamina';

const FPS = 30;
const PX = 48;
const SCALE = 7;

const prof = professions.stickman;
const lcd = new LCD(document.getElementById('screen') as HTMLCanvasElement, PX, SCALE);

// --- Scenes: rooms of the cube (first = hub) ---------------------------------

let sceneIdx = 0;
const scene = () => prof.scenes[sceneIdx]!;
/** Timestamp of each room's last visit — drives fair room rotation. */
const roomLastVisited: Record<string, number> = {};

// --- Cubeman state machine (idle <-> action, auto-sleep) --------------------

type Mode = {
  anim: Anim;
  loop: boolean;
  action?: Action;
  /** For walking: destination x offset; movement handled in the tick. */
  walkTarget?: number;
  /** Called when a non-looping anim finishes (defaults to backToIdle). */
  onEnd?: () => void;
};

let mode: Mode = { anim: prof.idle, loop: true };
let frame = 0;
let busy = false;
let lastInteract = performance.now();
const SLEEP_AFTER_MS = 180_000;
/** Set on every accepted press: bed/flop routing waits for the grace period. */
let graceUntil = 0;
/** When the current sleep started — naps have a minimum duration. */
let sleepStartAt = 0;
/** Where this nap is happening — bed naps refill fully, flops partially. */
let sleptInBed = false;

// --- Position: the cubeman wanders around its cube ---------------------------

let x = 0; // current horizontal offset in author space (48-wide)
const WALK_SPEED = 0.3; // author px per frame

/** The cubeman's body-center on screen. */
const cx = (): number => 24 + LCD.BODY_SCALE * x;
const cxToTarget = (c: number): number => (c - 24) / LCD.BODY_SCALE;

/** Walkable body-center range, keeping clear of the current room's solids. */
function walkableCx(): [number, number] {
  let lo = 5;
  let hi = 43;
  for (const [a, b] of scene().solids ?? []) {
    if (a >= 24) hi = Math.min(hi, a - 4);
    else lo = Math.max(lo, b + 4);
  }
  return [lo, hi];
}

// --- The ball prop: lives in the living room, rolls with friction ------------

const ball = { x: 8, v: 0 };
const BALL_WALL_LO = 2.5;
const BALL_EDGE_HI = 45.5;

function drawBall(ctx: CanvasRenderingContext2D, bx: number): void {
  const b = Math.round(bx);
  ctx.fillRect(b - 1, 42, 2, 1); // top
  ctx.fillRect(b - 2, 43, 1, 2); // left
  ctx.fillRect(b + 1, 43, 1, 2); // right
  ctx.fillRect(b - 1, 45, 2, 1); // bottom
}

function tickBall(): void {
  if (scene().id !== 'living' || ball.v === 0) return;
  ball.x += ball.v;
  ball.v *= 0.97; // floor friction
  if (ball.x < BALL_WALL_LO) {
    ball.x = BALL_WALL_LO;
    ball.v = Math.abs(ball.v) * 0.5; // bounce off the left wall
  }
  if (ball.x > BALL_EDGE_HI) {
    ball.x = BALL_EDGE_HI;
    ball.v = -Math.abs(ball.v) * 0.5; // bounce off the right wall
  }
  if (Math.abs(ball.v) < 0.05) ball.v = 0;
}

function startAction(action: Action, spontaneous = false): void {
  busy = true;
  mode = { anim: action.anim, loop: false, action, onEnd: backToIdle };
  frame = 0;
  stamina.spend(action.effort ?? 8); // user presses still perform, but cost energy
  if (!spontaneous) {
    lastInteract = performance.now();
    graceUntil = lastInteract + GRACE_MS; // interaction beats recovery
  }
  // any ACTUAL action consumes the pending spontaneous slot (user-triggered
  // ones included) — idling/wandering never postpones it. Tired cubemen
  // space their tricks further apart.
  const slowdown = stamina.get() < STAMINA.TIRED ? STAMINA.TIRED_SLOWDOWN : 1;
  nextSpontaneous =
    performance.now() + randRange(SPONTANEOUS_MIN_MS, SPONTANEOUS_MAX_MS) * slowdown;
  achievements.record(action.id);
}

/** Pick an action, favoring cheaper ones when tired — flips stay possible,
 *  just rarer. */
function pickAction(pool: Action[]): Action {
  const tired = stamina.get() < STAMINA.TIRED;
  if (!tired) return pool[Math.floor(Math.random() * pool.length)]!;
  const weights = pool.map((a) => 1 / (a.effort ?? 8));
  let r = Math.random() * weights.reduce((s, w) => s + w, 0);
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i]!;
    if (r <= 0) return pool[i]!;
  }
  return pool[pool.length - 1]!;
}

// --- Stage discipline: wide actions need room -------------------------------

const extentCache = new Map<string, number>();
function actionExtent(a: Action): number {
  let e = extentCache.get(a.id);
  if (e === undefined) {
    e = animExtent(a.anim);
    extentCache.set(a.id, e);
  }
  return e;
}

/** Body-center band within which every *rendered* frame of the action stays
 *  ≥1px inside the display: joint reach = 24 + scale·(|x-offset| + extent),
 *  plus the joint's rendered radius (limb stroke or head disc, whichever is
 *  larger) must also fit. */
function safeBand(a: Action): [number, number] {
  const r = Math.max(LCD.LIMB_RADIUS, LCD.HEAD_RADIUS * LCD.BODY_SCALE);
  const half = 23 - r - LCD.BODY_SCALE * actionExtent(a);
  return [Math.max(3, 24 - half), Math.min(45, 24 + half)];
}

/** Run an action, strolling toward center stage first if the current spot
 *  is too cramped for it. (Room-crossing walks are intentional off-screen
 *  movement and go through startWalkTo directly — they are exempt.) */
function runAction(action: Action, spontaneous = false): void {
  const [lo, hi] = safeBand(action);
  if (cx() >= lo && cx() <= hi) {
    startAction(action, spontaneous);
    return;
  }
  const [wlo, whi] = walkableCx();
  const target = Math.min(whi, Math.max(wlo, Math.min(hi, Math.max(lo, cx()))));
  startWalkTo(target, () => startAction(action, spontaneous));
}

// --- Idle life: spontaneous tricks + wandering -------------------------------

const SPONTANEOUS_MIN_MS = 6_000;
const SPONTANEOUS_MAX_MS = 14_000;
const WANDER_MIN_MS = 2_500;
const WANDER_MAX_MS = 6_000;

let nextSpontaneous = performance.now() + randRange(SPONTANEOUS_MIN_MS, SPONTANEOUS_MAX_MS);
let nextWander = performance.now() + randRange(WANDER_MIN_MS, WANDER_MAX_MS);

function randRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/** Re-arm ONLY the wander timer — never the spontaneous deadline. */
function scheduleWander(): void {
  nextWander = performance.now() + randRange(WANDER_MIN_MS, WANDER_MAX_MS);
}

/** Walk to a body-center screen x, then continue with `next`. */
function startWalkTo(cxTarget: number, next: () => void): void {
  busy = true;
  mode = {
    anim: shared.walk,
    loop: true,
    walkTarget: cxToTarget(cxTarget),
    onEnd: next,
  };
}

/** Stroll to a random spot within the walkable range. Tired cubemen take
 *  short hops — but if they're somehow outside the walkable range (e.g. woke
 *  up on the bed spot), reaching valid ground wins over the hop limit. */
function startWander(): void {
  scheduleWander(); // re-arm even if we end up staying put
  const [lo, hi] = walkableCx();
  const here = cx();
  let target: number;
  if (here < lo || here > hi) {
    // outside walkable range: head for the nearest boundary
    target = here < lo ? lo : hi;
  } else {
    target = lo + Math.random() * (hi - lo);
    if (stamina.get() < STAMINA.TIRED) {
      // low energy: short hops only, still clamped into the walkable range
      target = Math.min(hi, Math.max(lo, Math.min(here + 6, Math.max(here - 6, target))));
    }
  }
  if (Math.abs(target - here) < 3) return; // too close — stay put
  startWalkTo(target, backToIdle);
}

// --- Room-to-room travel (the P2 crossing mechanic, rehearsed) ---------------

/** Walk off the current room's edge into the next room, then continue. */
function crossEdge(dir: 'left' | 'right', next: () => void): void {
  const edge = scene()[dir];
  if (edge.kind !== 'scene') return; // neighbor edges activate in P2
  stamina.spend(STAMINA.COST_CROSS);
  sceneIdx = prof.scenes.findIndex((s) => s.id === edge.id);
  roomLastVisited[scene().id] = performance.now();
  // enter from the opposite side and stroll a few steps inward
  x = cxToTarget(dir === 'right' ? 4 : 44);
  startWalkTo(dir === 'right' ? 11 : 37, next);
}

/** Route through rooms until `sceneId` is reached, then run `next`. */
function travelTo(sceneId: string, next: () => void): void {
  if (scene().id === sceneId) {
    next();
    return;
  }
  const dir = prof.scenes.findIndex((s) => s.id === sceneId) > sceneIdx ? 'right' : 'left';
  const edgeCx = dir === 'right' ? 45 : 3;
  startWalkTo(edgeCx, () => crossEdge(dir, () => travelTo(sceneId, next)));
}

/** Wander to a random OTHER room (internal doors only). */
function exploreRoom(): void {
  scheduleWander();
  // prefer the room visited longest ago so all rooms get screen time
  const others = prof.scenes
    .filter((s) => s.id !== scene().id)
    .sort((a, b) => (roomLastVisited[a.id] ?? 0) - (roomLastVisited[b.id] ?? 0));
  travelTo(others[0]!.id, backToIdle);
}

/** Amble over to the ball and give it a kick. */
function playBall(): void {
  scheduleWander();
  if (scene().id !== 'living') return;
  const [lo] = walkableCx();
  const stand = Math.max(lo + 1, ball.x - 4);
  if (Math.abs(cx() - stand) < 1.5) nudgeBall();
  else startWalkTo(stand, nudgeBall);
}

function nudgeBall(): void {
  ball.v = 1.6; // kick it toward the bed side
  stamina.spend(STAMINA.COST_KICK);
  backToIdle();
}

function backToIdle(): void {
  busy = false;
  mode = { anim: prof.idle, loop: true };
  frame = 0;
  scheduleWander(); // only wandering re-arms here; the spontaneous
  // deadline set by startAction stays until a real action runs
}

/** Too tired to walk to the bedroom — lie down right here for a while. */
function flopAsleep(): void {
  fallAsleep(false);
}

/** Wake up from a nap (stamina recovered enough). Resetting lastInteract
 *  prevents an immediate boredom-nap loop right after waking. */
function wakeFromSleep(): void {
  lastInteract = performance.now();
  busy = true;
  mode = { anim: shared.wake, loop: false, onEnd: backToIdle };
  frame = 0;
}

function perform(action: Action): void {
  if (busy && mode.anim !== prof.sleep && mode.anim !== shared.sleepEnter) return;
  // toy ignores presses mid-trick — but falling asleep or asleep can be interrupted
  if (mode.anim === prof.sleep || mode.anim === shared.sleepEnter) {
    // ...but a press wakes it up: stretch first, then do the action
    busy = true;
    mode = { anim: shared.wake, loop: false, onEnd: () => runAction(action) };
    frame = 0;
  } else {
    runAction(action);
  }
}

function fallAsleep(inBed = false): void {
  sleptInBed = inBed;
  busy = true;
  mode = {
    anim: shared.sleepEnter,
    loop: false,
    onEnd: () => {
      busy = false;
      mode = { anim: prof.sleep, loop: true };
      frame = 0;
      sleepStartAt = performance.now(); // minimum-nap clock starts now
    },
  };
  frame = 0;
}

// --- Achievements -----------------------------------------------------------

const banner = document.getElementById('banner')!;
let bannerTimer: ReturnType<typeof setTimeout> | undefined;

const achievements = new Achievements((a) => {
  banner.textContent = `🏆 Achievement unlocked — ${a.name}: ${a.desc}`;
  banner.hidden = false;
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => (banner.hidden = true), 3500);
  renderGoals();
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
// silhouettes; unlocked-but-unplaced ones become draggable in P2.
const rosterEl = document.getElementById('roster')!;
const roster: Array<{ id: string; name: string; note: string }> = [
  { id: 'stickman', name: 'Stickman', note: 'on the shelf' },
  { id: 'mystery-1', name: '???', note: 'keep playing to unlock' },
  { id: 'mystery-2', name: '???', note: 'keep playing to unlock' },
  { id: 'mystery-3', name: '???', note: 'keep playing to unlock' },
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


// --- Input -------------------------------------------------------------------

const buttons = [...document.querySelectorAll<HTMLButtonElement>('[data-action]')];

function trigger(spec: string): void {
  if (spec === 'random') {
    const pool = prof.actions;
    perform(pool[Math.floor(Math.random() * pool.length)]!);
    return;
  }
  const action = prof.actions[Number(spec)];
  if (action) perform(action);
}

buttons.forEach((b) => b.addEventListener('click', () => trigger(b.dataset.action!)));
document.addEventListener('keydown', (e) => {
  if (e.key >= '1' && e.key <= String(prof.actions.length)) trigger(String(Number(e.key) - 1));
  if (e.key === '0' || e.key === '*') trigger('random');
});

// --- "Z z z" overlay while asleep -------------------------------------------

function drawZ(ctx: CanvasRenderingContext2D, x: number, y: number, u: number): void {
  ctx.fillRect(x, y, 3 * u, u); // top bar
  ctx.fillRect(x + 2 * u, y + u, u, u); // diagonal
  ctx.fillRect(x, y + 2 * u, 3 * u, u); // bottom bar
}

function zzzOverlay(ctx: CanvasRenderingContext2D, frame: number): void {
  const cycle = (frame % 120) / 120;
  for (let i = 0; i < 3; i++) {
    const p = (cycle + i * 0.3) % 1;
    if (p > 0.85) continue; // brief gap before reappearing at the bottom
    // rises from the pillow (head is near the right wall in bed)
    const x = 42 - p * 7;
    const y = 36 - p * 22;
    drawZ(ctx, x, y, 1.1 + p * 1.1); // grows as it rises
  }
}

// --- Loop ----------------------------------------------------------------------

const loop = new Loop(
  FPS,
  () => {
    frame++;
    // sleep is the ONLY recovery channel
    if (mode.anim === prof.sleep) stamina.regen(STAMINA.REGEN_PER_TICK);
    tickBall();
    // walking: advance x toward the target, stop when arrived
    if (mode.walkTarget !== undefined) {
      const d = mode.walkTarget - x;
      if (Math.abs(d) <= WALK_SPEED) {
        x = mode.walkTarget;
        (mode.onEnd ?? backToIdle)();
      } else {
        x += Math.sign(d) * WALK_SPEED;
        stamina.spend(STAMINA.COST_WALK_PX * WALK_SPEED);
      }
    }
    if (!mode.loop && mode.walkTarget === undefined && frame >= mode.anim.dur)
      (mode.onEnd ?? backToIdle)();
    // rested enough? wake up (bed sleep ends at 90, flops at 55) — but only
    // after the minimum nap duration; a press can always interrupt sooner
    if (
      mode.anim === prof.sleep &&
      performance.now() - sleepStartAt >= STAMINA.MIN_NAP_MS &&
      stamina.get() >= (sleptInBed ? STAMINA.WAKE_FULL : STAMINA.WAKE_NAP)
    ) {
      wakeFromSleep();
      return;
    }
    // too drained even to walk to the bedroom? flop into an in-place nap
    // right here (checked BEFORE ordinary bed routing, which would otherwise
    // always win — the flop tier would be unreachable). Interaction grace
    // postpones both.
    if (
      !busy &&
      mode.anim === prof.idle &&
      performance.now() >= graceUntil &&
      stamina.get() < STAMINA.FLOP_BELOW
    ) {
      flopAsleep();
      return;
    }
    // nap time: low stamina or being ignored for 180s — travel to the
    // bedroom, walk to the bed, lie down (grace period postpones this too)
    if (
      !busy &&
      mode.anim === prof.idle &&
      performance.now() >= graceUntil &&
      (stamina.get() < STAMINA.SLEEP_AT ||
        performance.now() - lastInteract > SLEEP_AFTER_MS)
    ) {
      travelTo('bedroom', () => {
        const spot = scene().sleepSpot;
        if (spot && Math.abs(cx() - spot.cx) > 1.5)
          startWalkTo(spot.cx, () => fallAsleep(true));
        else fallAsleep(true);
      });
      return;
    }
    // spontaneous trick while idle — self-entertainment does NOT reset the
    // sleep timer (only the user's presses do). Exhausted cubemen skip tricks;
    // tired ones favor cheaper tricks (flips stay possible, just rarer).
    if (
      !busy &&
      mode.anim === prof.idle &&
      stamina.get() >= STAMINA.EXHAUSTED &&
      performance.now() >= nextSpontaneous
    ) {
      runAction(pickAction(prof.actions), true);
      return;
    }
    // wander / kick the ball / explore another room
    if (
      !busy &&
      mode.anim === prof.idle &&
      performance.now() >= nextWander
    ) {
      const roll = Math.random();
      if (roll < 0.15) exploreRoom();
      else if (roll < 0.5) playBall();
      else startWander();
    }
  },
  () =>
    lcd.draw(
      shiftX(sample(mode.anim, frame), x),
      frame,
      {
        behind: (c, f) => {
          scene().draw(c, f);
          if (scene().id === 'living') drawBall(c, ball.x);
        },
        front: mode.anim === prof.sleep ? zzzOverlay : undefined,
      },
    ),
);
loop.start();
