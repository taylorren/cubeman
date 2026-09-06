import { animExtent, sample, shiftX } from '../render/skeleton';
import type { Anim } from '../render/skeleton';
import { LCD } from '../render/lcd';
import * as shared from '../content/professions/shared';
import type { Action, Profession } from '../content/professions';
import { GRACE_MS, STAMINA, Stamina } from './stamina';
import type { Cube } from './cube';
import type { Shelf } from './shelf';

function randRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

// --- Tuning: idle life + visiting --------------------------------------------

const SPONTANEOUS_MIN_MS = 6_000;
const SPONTANEOUS_MAX_MS = 14_000;
const WANDER_MIN_MS = 2_500;
const WANDER_MAX_MS = 6_000;
/** Boredom nap after this long without interaction. */
const SLEEP_AFTER_MS = 180_000;
const WALK_SPEED = 0.3; // author px per frame

/** How long a visit lasts before the cubeman heads home on its own. */
const VISIT_MIN_MS = 20_000;
const VISIT_MAX_MS = 40_000;
/** Wander-roll odds of autonomously deciding to visit a neighbor. */
const VISIT_CHANCE = 0.12;

type Mode = {
  anim: Anim;
  loop: boolean;
  action?: Action;
  /** For walking: destination x offset; movement handled in tick(). */
  walkTarget?: number;
  /** Called when a non-looping anim finishes (defaults to backToIdle). */
  onEnd?: () => void;
};

export interface CubemanOpts {
  name: string;
  profession: Profession;
  /** The cube this cubeman lives in and always returns to. */
  home: Cube;
  /** Shelf: resolves neighbor exits and visitor capacity. */
  shelf: Shelf;
  /** App-level progression hook (achievements record every action). */
  onAction?: (action: Action) => void;
}

/**
 * One cubeman: a self-directed little life on a shelf. Owns ALL character
 * state — animation mode, position, timers, stamina, sleep — and none of
 * its surroundings; rooms, scenery and props belong to the Cube it is
 * currently inside. Location is tracked as (current cube, room index),
 * with the home cube kept separately so visiting never changes ownership.
 */
export class Cubeman {
  readonly name: string;
  readonly prof: Profession;
  readonly home: Cube;
  private readonly shelf: Shelf;
  private readonly onAction?: (action: Action) => void;

  /** Where the cubeman currently is — NOT necessarily its home cube. */
  cube: Cube;

  private mode: Mode;
  private frame = 0;
  private busy = false;

  /** Current horizontal offset in author space (48-wide). */
  private x = 0;

  private readonly stamina = new Stamina();
  private lastInteract = performance.now();
  private graceUntil = 0;
  private sleepStartAt = 0;
  private sleptInBed = false;
  private nextSpontaneous: number;
  private nextWander: number;
  /** Timestamp of each room's last visit — drives fair room rotation. */
  private roomLastVisited: Record<string, number> = {};
  /** While visiting a neighbor: when to head home (0 = at home). */
  private visitingUntil = 0;

  constructor(opts: CubemanOpts) {
    this.name = opts.name;
    this.prof = opts.profession;
    this.home = opts.home;
    this.cube = opts.home;
    this.shelf = opts.shelf;
    this.onAction = opts.onAction;
    this.mode = { anim: this.prof.idle, loop: true };
    this.nextSpontaneous = performance.now() + randRange(SPONTANEOUS_MIN_MS, SPONTANEOUS_MAX_MS);
    this.nextWander = performance.now() + randRange(WANDER_MIN_MS, WANDER_MAX_MS);
  }

  // --- Position helpers ------------------------------------------------------

  /** The cubeman's body-center on screen. */
  private cx(): number {
    return 24 + LCD.BODY_SCALE * this.x;
  }

  private cxToTarget(c: number): number {
    return (c - 24) / LCD.BODY_SCALE;
  }

  private scene() {
    return this.cube.scene(this.cube.currentSceneId);
  }

  /** Walkable body-center range, keeping clear of the current room's solids. */
  private walkableCx(): [number, number] {
    let lo = 5;
    let hi = 43;
    for (const [a, b] of this.scene().solids ?? []) {
      if (a >= 24) hi = Math.min(hi, a - 4);
      else lo = Math.max(lo, b + 4);
    }
    return [lo, hi];
  }

  // --- Actions ---------------------------------------------------------------

  private startAction(action: Action, spontaneous = false): void {
    this.busy = true;
    this.mode = { anim: action.anim, loop: false, action, onEnd: () => this.backToIdle() };
    this.frame = 0;
    this.stamina.spend(action.effort ?? 8); // user presses still perform, but cost energy
    if (!spontaneous) {
      this.lastInteract = performance.now();
      this.graceUntil = this.lastInteract + GRACE_MS; // interaction beats recovery
    }
    // any ACTUAL action consumes the pending spontaneous slot (user-triggered
    // ones included) — idling/wandering never postpones it. Tired cubemen
    // space their tricks further apart.
    const slowdown = this.stamina.get() < STAMINA.TIRED ? STAMINA.TIRED_SLOWDOWN : 1;
    this.nextSpontaneous =
      performance.now() + randRange(SPONTANEOUS_MIN_MS, SPONTANEOUS_MAX_MS) * slowdown;
    this.onAction?.(action);
  }

  /** Pick an action, favoring cheaper ones when tired — flips stay possible,
   *  just rarer. */
  private pickAction(pool: Action[]): Action {
    const tired = this.stamina.get() < STAMINA.TIRED;
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

  private static readonly extentCache = new Map<string, number>();

  private static actionExtent(a: Action): number {
    let e = Cubeman.extentCache.get(a.id);
    if (e === undefined) {
      e = animExtent(a.anim);
      Cubeman.extentCache.set(a.id, e);
    }
    return e;
  }

  /** Body-center band within which every *rendered* frame of the action stays
   *  ≥1px inside the display: joint reach = 24 + scale·(|x-offset| + extent),
   *  plus the joint's rendered radius (limb stroke or head disc, whichever is
   *  larger) must also fit. */
  private safeBand(a: Action): [number, number] {
    const r = Math.max(LCD.LIMB_RADIUS, LCD.HEAD_RADIUS * LCD.BODY_SCALE);
    const half = 23 - r - LCD.BODY_SCALE * Cubeman.actionExtent(a);
    return [Math.max(3, 24 - half), Math.min(45, 24 + half)];
  }

  /** Run an action, strolling toward center stage first if the current spot
   *  is too cramped for it. (Room-crossing walks are intentional off-screen
   *  movement and go through startWalkTo directly — they are exempt.) */
  private runAction(action: Action, spontaneous = false): void {
    const [lo, hi] = this.safeBand(action);
    if (this.cx() >= lo && this.cx() <= hi) {
      this.startAction(action, spontaneous);
      return;
    }
    const [wlo, whi] = this.walkableCx();
    const target = Math.min(whi, Math.max(wlo, Math.min(hi, Math.max(lo, this.cx()))));
    this.startWalkTo(target, () => this.startAction(action, spontaneous));
  }

  // --- Idle life: wandering + room/cube travel --------------------------------

  /** Re-arm ONLY the wander timer — never the spontaneous deadline. */
  private scheduleWander(): void {
    this.nextWander = performance.now() + randRange(WANDER_MIN_MS, WANDER_MAX_MS);
  }

  /** Walk to a body-center screen x, then continue with `next`. */
  private startWalkTo(cxTarget: number, next: () => void): void {
    this.busy = true;
    this.mode = {
      anim: shared.walk,
      loop: true,
      walkTarget: this.cxToTarget(cxTarget),
      onEnd: next,
    };
  }

  /** Stroll to a random spot within the walkable range. Tired cubemen take
   *  short hops — but if they're somehow outside the walkable range (e.g. woke
   *  up on the bed spot), reaching valid ground wins over the hop limit. */
  private startWander(): void {
    this.scheduleWander(); // re-arm even if we end up staying put
    const [lo, hi] = this.walkableCx();
    const here = this.cx();
    let target: number;
    if (here < lo || here > hi) {
      // outside walkable range: head for the nearest boundary
      target = here < lo ? lo : hi;
    } else {
      target = lo + Math.random() * (hi - lo);
      if (this.stamina.get() < STAMINA.TIRED) {
        // low energy: short hops only, still clamped into the walkable range
        target = Math.min(hi, Math.max(lo, Math.min(here + 6, Math.max(here - 6, target))));
      }
    }
    if (Math.abs(target - here) < 3) return; // too close — stay put
    this.startWalkTo(target, () => this.backToIdle());
  }

  // --- Room-to-room travel, and visits between cubes ---------------------------

  /**
   * Cross the current room's edge, then continue. Internal `scene` edges
   * hop to another room of the SAME cube; `neighbor` edges are shelf-level
   * exits: the shelf resolves them to a connected cube, and an unconnected
   * exit behaves exactly like a wall (no-op, callback still fires).
   */
  private crossEdge(dir: 'left' | 'right', next: () => void): void {
    const edge = this.scene()[dir];
    if (edge.kind === 'scene') {
      this.stamina.spend(STAMINA.COST_CROSS);
      this.cube.currentSceneId = edge.id;
      this.roomLastVisited[this.scene().id] = performance.now();
      // enter from the opposite side and stroll a few steps inward
      this.x = this.cxToTarget(dir === 'right' ? 4 : 44);
      this.startWalkTo(dir === 'right' ? 11 : 37, next);
      return;
    }
    if (edge.kind !== 'neighbor') { next(); return; } // wall — stay put
    const dest = this.shelf.neighborOf(this.cube, dir);
    if (!dest) { next(); return; } // no cube connected on this side: it's a wall
    // The visit proper: leave this cube, appear in the neighbor's hub.
    // (Visitor CAPACITY is enforced at the point of departure in
    // startVisit, not here — so a cubeman can ALWAYS return home even if
    // the other is visiting there right now.)
    this.stamina.spend(STAMINA.COST_CROSS);
    this.cube = dest;
    this.cube.currentSceneId = dest.hub().id;
    this.roomLastVisited[this.scene().id] = performance.now();
    this.x = this.cxToTarget(dir === 'right' ? 4 : 44);
    this.startWalkTo(dir === 'right' ? 11 : 37, next);
  }

  /** Route through rooms of the CURRENT cube until `sceneId`, then `next`. */
  private travelTo(sceneId: string, next: () => void): void {
    if (this.scene().id === sceneId) {
      next();
      return;
    }
    const scenes = this.cube.prof.scenes;
    const cur = scenes.findIndex((s) => s.id === this.cube.currentSceneId);
    const dir = scenes.findIndex((s) => s.id === sceneId) > cur ? 'right' : 'left';
    const edgeCx = dir === 'right' ? 45 : 3;
    this.startWalkTo(edgeCx, () => {
      this.crossEdge(dir, () => this.travelTo(sceneId, next));
    });
  }

  /** Wander to a random OTHER room (internal doors only). */
  private exploreRoom(): void {
    this.scheduleWander();
    // prefer the room visited longest ago so all rooms get screen time
    const others = this.cube.prof.scenes
      .filter((s) => s.id !== this.scene().id)
      .sort((a, b) => (this.roomLastVisited[a.id] ?? 0) - (this.roomLastVisited[b.id] ?? 0));
    this.travelTo(others[0]!.id, () => this.backToIdle());
  }

  // --- Visiting a neighboring cube ---------------------------------------------

  /**
   * Autonomous "visit": walk into a connected neighbor's living room for a
   * while. It triggers ONLY from home AND only from the living room (the
   * hub) — that is where the neighbor exits live — and only when a neighbor
   * is actually connected. If any of those conditions fail this is a clean
   * no-op, so the caller never needs to check again.
   */
  private startVisit(): void {
    this.scheduleWander();
    if (this.cube !== this.home || this.scene().id !== this.cube.hub().id) return;
    const dir = this.connectedNeighborDir();
    if (!dir) return; // not connected → no visit (exit behaves as a wall)
    const dest = this.shelf.neighborOf(this.cube, dir);
    if (!dest) return; // not connected → no visit (exit behaves as a wall)
    if (!this.shelf.canAcceptVisitor(dest, this)) return; // host already has a visitor
    this.crossEdge(dir, () => {
      // arrived in the neighbor's living room — set the "head home by" clock
      this.visitingUntil = performance.now() + randRange(VISIT_MIN_MS, VISIT_MAX_MS);
      this.backToIdle();
    });
  }

  /**
   * Walk back into the home cube (via the shelf connection), then `next`.
   * Neighbor exits only exist on the living room, so if we've wandered
   * deeper into the neighbor's rooms, first route back to its hub, then
   * cross out. Explicitly callback-safe: if no connection leads home, `next`
   * still runs — the cubeman never freezes waiting for a door that isn't there.
   */
  private returnHome(next: () => void): void {
    if (this.cube === this.home) {
      this.visitingUntil = 0;
      next();
      return;
    }
    const crossOut = (): void => {
      const dir = ['left', 'right'].find(
        (d) =>
          this.scene()[d as 'left' | 'right'].kind === 'neighbor' &&
          this.shelf.neighborOf(this.cube, d as 'left' | 'right') === this.home,
      );
      if (!dir) {
        this.visitingUntil = 0;
        next();
        return;
      }
      const edgeCx = dir === 'right' ? 45 : 3;
      this.startWalkTo(edgeCx, () =>
        this.crossEdge(dir as 'left' | 'right', () => {
          this.visitingUntil = 0; // home again
          next();
        }),
      );
    };
    if (this.scene().id === this.cube.hub().id) crossOut();
    else this.travelTo(this.cube.hub().id, crossOut);
  }

  /** A neighbor exit that actually leads to a connected cube, or null. */
  private connectedNeighborDir(): 'left' | 'right' | null {
    const dirs: Array<'left' | 'right'> = [];
    for (const d of ['left', 'right'] as const) {
      if (this.scene()[d].kind === 'neighbor' && this.shelf.neighborOf(this.cube, d)) dirs.push(d);
    }
    return dirs.length === 0 ? null : dirs[Math.floor(Math.random() * dirs.length)]!;
  }

  // --- The ball (a prop of whatever cube we're visiting) ------------------------

  /** Amble over to the ball and give it a kick. */
  private playBall(): void {
    this.scheduleWander();
    if (this.scene().id !== this.cube.hub().id) return;
    const [lo] = this.walkableCx();
    const stand = Math.max(lo + 1, this.cube.ball.x - 4);
    if (Math.abs(this.cx() - stand) < 1.5) this.nudgeBall();
    else this.startWalkTo(stand, () => this.nudgeBall());
  }

  private nudgeBall(): void {
    this.cube.ball.v = 1.6; // kick it toward the bed side
    this.stamina.spend(STAMINA.COST_KICK);
    this.backToIdle();
  }

  // --- Sleep family --------------------------------------------------------------

  private backToIdle(): void {
    this.busy = false;
    this.mode = { anim: this.prof.idle, loop: true };
    this.frame = 0;
    this.scheduleWander(); // only wandering re-arms here; the spontaneous
    // deadline set by startAction stays until a real action runs
  }

  /** Too tired to walk to the bedroom — lie down right here for a while.
   *  The lying pose reaches ~14 author-px to the RIGHT of body center (the
   *  head), so flopping near the right wall would clip the head off-screen.
   *  Same stage discipline as actions: slide just enough to the left first. */
  private sleepBand(): [number, number] {
    const r = Math.max(LCD.LIMB_RADIUS, LCD.HEAD_RADIUS * LCD.BODY_SCALE);
    const extent = Math.max(
      animExtent(shared.sleepEnter),
      animExtent(this.prof.sleep),
      animExtent(shared.wake),
    );
    const half = 23 - r - LCD.BODY_SCALE * extent;
    return [Math.max(3, 24 - half), Math.min(45, 24 + half)];
  }

  private flopAsleep(): void {
    const [lo, hi] = this.sleepBand();
    if (this.cx() >= lo && this.cx() <= hi) {
      this.fallAsleep(false);
      return;
    }
    const [wlo, whi] = this.walkableCx();
    const target = Math.min(whi, Math.max(wlo, Math.min(hi, Math.max(lo, this.cx()))));
    this.startWalkTo(target, () => this.fallAsleep(false));
  }

  /** Wake up from a nap (stamina recovered enough). Resetting lastInteract
   *  prevents an immediate boredom-nap loop right after waking. */
  private wakeFromSleep(): void {
    this.lastInteract = performance.now();
    this.busy = true;
    this.mode = { anim: shared.wake, loop: false, onEnd: () => this.backToIdle() };
    this.frame = 0;
  }

  /** A press on a sleeping cubeman wakes it: stretch first, then act. */
  press(action: Action): void {
    if (this.busy && this.mode.anim !== this.prof.sleep && this.mode.anim !== shared.sleepEnter)
      return;
    // toy ignores presses mid-trick — but falling asleep or asleep can be interrupted
    if (this.mode.anim === this.prof.sleep || this.mode.anim === shared.sleepEnter) {
      // ...but a press wakes it up: stretch first, then do the action
      this.busy = true;
      this.mode = { anim: shared.wake, loop: false, onEnd: () => this.runAction(action) };
      this.frame = 0;
    } else {
      this.runAction(action);
    }
  }

  private fallAsleep(inBed = false): void {
    this.sleptInBed = inBed;
    this.busy = true;
    this.mode = {
      anim: shared.sleepEnter,
      loop: false,
      onEnd: () => {
        this.busy = false;
        this.mode = { anim: this.prof.sleep, loop: true };
        this.frame = 0;
        this.sleepStartAt = performance.now(); // minimum-nap clock starts now
      },
    };
    this.frame = 0;
  }

  // --- Simulation tick -----------------------------------------------------------

  /** One fixed-timestep update: autonomous life, movement, recovery. */
  tick(): void {
    this.frame++;
    // sleep is the ONLY recovery channel
    if (this.mode.anim === this.prof.sleep) this.stamina.regen(STAMINA.REGEN_PER_TICK);

    // walking: advance x toward the target, stop when arrived. Cost is
    // charged per SCREEN pixel actually moved (author px × BODY_SCALE),
    // including the final (possibly shorter) arrival step.
    if (this.mode.walkTarget !== undefined) {
      const d = this.mode.walkTarget - this.x;
      const step = Math.sign(d) * Math.min(Math.abs(d), WALK_SPEED);
      this.x += step;
      this.stamina.spend(STAMINA.COST_WALK_PX * Math.abs(step) * LCD.BODY_SCALE);
      if (this.x === this.mode.walkTarget) (this.mode.onEnd ?? (() => this.backToIdle()))();
    }
    if (!this.mode.loop && this.mode.walkTarget === undefined && this.frame >= this.mode.anim.dur)
      (this.mode.onEnd ?? (() => this.backToIdle()))();

    const now = performance.now();
    // rested enough? wake up (bed sleep ends at 90, flops at 55) — but only
    // after the minimum nap duration; a press can always interrupt sooner
    if (
      this.mode.anim === this.prof.sleep &&
      now - this.sleepStartAt >= STAMINA.MIN_NAP_MS &&
      this.stamina.get() >= (this.sleptInBed ? STAMINA.WAKE_FULL : STAMINA.WAKE_NAP)
    ) {
      this.wakeFromSleep();
      return;
    }
    // too drained even to walk to the bedroom? flop into an in-place nap
    // right here — but RETURN HOME FIRST if visiting (a visitor napping in
    // someone else's bed would be strange). Interaction grace postpones all
    // recovery routing.
    if (
      !this.busy &&
      this.mode.anim === this.prof.idle &&
      now >= this.graceUntil &&
      this.stamina.get() < STAMINA.FLOP_BELOW
    ) {
      if (this.cube !== this.home) this.returnHome(() => this.flopAsleep());
      else this.flopAsleep();
      return;
    }
    // nap time: low stamina or being ignored for 180s. Return-home-before-
    // sleep is explicit: a visitor always travels back to its own bedroom
    // (grace period postpones this too).
    if (
      !this.busy &&
      this.mode.anim === this.prof.idle &&
      now >= this.graceUntil &&
      (this.stamina.get() < STAMINA.SLEEP_AT || now - this.lastInteract > SLEEP_AFTER_MS)
    ) {
      const bedtime = (): void => {
        const spot = this.scene().sleepSpot;
        if (spot && Math.abs(this.cx() - spot.cx) > 1.5)
          this.startWalkTo(spot.cx, () => this.fallAsleep(true));
        else this.fallAsleep(true);
      };
      if (this.cube !== this.home) this.returnHome(bedtime);
      else bedtime();
      return;
    }
    // spontaneous trick while idle — self-entertainment does NOT reset the
    // sleep timer (only the user's presses do). Exhausted cubemen skip tricks;
    // tired ones favor cheaper tricks (flips stay possible, just rarer).
    if (
      !this.busy &&
      this.mode.anim === this.prof.idle &&
      this.stamina.get() >= STAMINA.EXHAUSTED &&
      now >= this.nextSpontaneous
    ) {
      this.runAction(this.pickAction(this.prof.actions), true);
      return;
    }
    // autonomous life when idle: maybe visit a neighbor, otherwise explore /
    // play / wander. A visit is only possible from home's living room and
    // only across a connected edge — startVisit() no-ops otherwise.
    if (!this.busy && this.mode.anim === this.prof.idle && now >= this.nextWander) {
      if (this.visitingUntil) {
        // Visiting: stay for a while, then head home.
        if (now >= this.visitingUntil) {
          this.returnHome(() => this.backToIdle());
          return;
        }
      } else if (Math.random() < VISIT_CHANCE) {
        this.startVisit();
        return;
      }
      const roll = Math.random();
      if (roll < 0.15) this.exploreRoom();
      else if (roll < 0.5) this.playBall();
      else this.startWander();
    }
  }

  // --- Rendering -------------------------------------------------------------------

  /** True while the sleep loop anim is playing (drives the "Z z z" overlay). */
  get sleeping(): boolean {
    return this.mode.anim === this.prof.sleep;
  }

  /** This cubeman's own animation clock (for per-cubeman overlay timing). */
  get animFrame(): number {
    return this.frame;
  }

  /** The cubeman's current rendered pose, shifted to its screen position.
   *  The caller composites this onto a cube's shared backdrop via LCD. */
  pose() {
    return shiftX(sample(this.mode.anim, this.frame), this.x);
  }
}
