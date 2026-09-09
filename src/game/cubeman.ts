import { animExtent, sample, shiftX, shiftY } from '../render/skeleton';
import type { Anim } from '../render/skeleton';
import { LCD } from '../render/lcd';
import * as shared from '../content/professions/shared';
import type { Action, Overlay, Profession } from '../content/professions';
import { GRACE_MS, STAMINA, Stamina } from './stamina';
import type { Cube } from './cube';
import type { Dir, Shelf } from './shelf';
import { gameLog } from '../core/debug';
import type { LogDetails } from '../core/debug';
import { playSound } from '../core/sound';

function randRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

// --- Tuning: idle life + visiting --------------------------------------------

const SPONTANEOUS_MIN_MS = 6_000;
const SPONTANEOUS_MAX_MS = 14_000;
const WANDER_MIN_MS = 2_500;
const WANDER_MAX_MS = 6_000;
/** Boredom nap after this long without interaction. */
const SLEEP_AFTER_MS = 300_000;
const WALK_SPEED = 0.3; // author px per frame
/** If more than this much wall-clock time passes between ticks (e.g. tab was
 *  backgrounded), reset all timers to "now + interval" instead of bursting. */
const MAX_DELTA_MS = 1000;

/** Wander-roll odds of autonomously deciding to visit a neighbor. */
const VISIT_CHANCE = 0.06;

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
  /** Called right after this cubeman arrives in a neighbor's living room as
   *  a visitor — the app layer builds the VisitSession from here. */
  onVisitArrived?: (visitor: Cubeman) => void;
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
  private readonly onVisitArrived?: (visitor: Cubeman) => void;

  /** Where the cubeman currently is — NOT necessarily its home cube. */
  cube: Cube;

  /** The cube this cubeman is currently TRAVELING to visit (set at departure,
   *  cleared on arrival). Lets the shelf see pending guests that haven't
   *  started their VisitSession yet — departure-time checks only. */
  visitTarget: Cube | null = null;

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
  private lastTick = 0;
  /** Timestamp of each room's last visit — drives fair room rotation. */
  private roomLastVisited: Record<string, number> = {};
  /** Set while participating in a visit: whether THIS one is the visitor.
   *  Suppresses solo autonomy (living-room-only) and deadens visitor keys. */
  private inVisit: { isVisitor: boolean } | null = null;

  constructor(opts: CubemanOpts) {
    this.name = opts.name;
    this.prof = opts.profession;
    this.home = opts.home;
    this.cube = opts.home;
    this.shelf = opts.shelf;
    this.onAction = opts.onAction;
    this.onVisitArrived = opts.onVisitArrived;
    this.mode = { anim: this.prof.idle, loop: true };
    this.nextSpontaneous = performance.now() + randRange(SPONTANEOUS_MIN_MS, SPONTANEOUS_MAX_MS);
    this.nextWander = performance.now() + randRange(WANDER_MIN_MS, WANDER_MAX_MS);
    this.log('cubeman.spawn');
  }

  /** A read-only snapshot: no runtime objects or callbacks escape. */
  debugState() {
    const anim = this.mode.anim;
    const mode = this.mode.action?.id ??
      (this.mode.walkTarget !== undefined ? 'walk' :
        anim === this.prof.idle ? 'idle' :
          anim === this.prof.sleep ? 'sleep' :
            anim === shared.sleepEnter ? 'sleep-enter' :
              anim === shared.wake ? 'wake' :
                anim === shared.chat ? 'chat' :
                  anim === shared.wave ? 'wave' : 'animation');
    return {
      name: this.name,
      home: this.home.id,
      cube: this.cube.id,
      room: this.cube.currentSceneId,
      mode,
      busy: this.busy,
      frame: this.frame,
      cx: Number(this.cx().toFixed(2)),
      stamina: Number(this.energy.toFixed(2)),
      role: this.inVisit ? (this.isVisitor ? 'visitor' : 'host') : 'solo',
      walkTargetCx: this.mode.walkTarget === undefined
        ? null : Number((24 + LCD.BODY_SCALE * this.mode.walkTarget).toFixed(2)),
      graceUntilMs: Math.round(this.graceUntil),
      nextActionAtMs: Math.round(this.nextSpontaneous),
      nextWanderAtMs: Math.round(this.nextWander),
    };
  }

  private log(event: string, details: LogDetails = {}): void {
    if (gameLog.enabled) gameLog.record(event, { cubeman: this.debugState(), ...details });
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
    if (action.sound) playSound(action.sound); // synthesized sound (Musician only)
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
    this.log('action.start', { action: action.id, source: spontaneous ? 'autonomous' : 'input' });
    // progress (achievements) counts only actions the player explicitly
    // triggered — a cubeman's autonomous living shouldn't earn player goals.
    if (!spontaneous) this.onAction?.(action);
  }

  /** Pick an action, favoring cheaper ones when tired — flips stay possible,
   *  just rarer. */
  private pickAction(pool: Action[]): Action | undefined {
    // only offer actions usable in the current room (room-locked actions
    // like shower/bath are hidden until the cubeman is in the bathroom)
    const usable = pool.filter((a) => !a.room || a.room === this.currentRoom);
    if (usable.length === 0) return undefined;
    const tired = this.stamina.get() < STAMINA.TIRED;
    if (!tired) return usable[Math.floor(Math.random() * usable.length)]!;
    const weights = usable.map((a) => 1 / (a.effort ?? 8));
    let r = Math.random() * weights.reduce((s, w) => s + w, 0);
    for (let i = 0; i < usable.length; i++) {
      r -= weights[i]!;
      if (r <= 0) return usable[i]!;
    }
    return usable[usable.length - 1]!;
  }

  /** All the profession's actions the cubeman could perform right now —
   *  room-locked ones are excluded until the cubeman is in that room. */
  actionsInCurrentRoom(): Action[] {
    return this.prof.actions.filter((a) => !a.room || a.room === this.currentRoom);
  }

  /** The id of the room the cubeman currently stands in. */
  get currentRoom(): string {
    return this.cube.currentSceneId;
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
    // room-locked actions only run in their room — a shower while in the
    // living room is ignored, so it "only happens" in the bathroom.
    if (action.room && this.currentRoom !== action.room) {
      this.log('action.rejected', { action: action.id, requiredRoom: action.room, room: this.currentRoom });
      return;
    }
    // fixture actions (action.stand set, e.g. shower/bath in the bathroom):
    // perform AT that fixture spot. Snap there so the action's front overlay
    // (water stream, tub near-wall) always lines up with the skeleton.
    if (action.stand !== undefined) {
      if (Math.abs(this.cx() - action.stand) > 1) this.x = this.cxToTarget(action.stand);
      this.startAction(action, spontaneous);
      return;
    }
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
    this.log('walk.start', { targetCx: cxTarget });
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
  /** Cross an internal room edge (scene → scene) within the SAME cube.
   *  Cross-cube travel is handled by direct teleport in startVisit/returnHome,
   *  so this only ever sees `scene` edges and walls now. */
  private crossEdge(dir: 'left' | 'right', next: () => void): void {
    const edge = this.scene()[dir];
    if (edge.kind !== 'scene') {
      this.log('room.blocked', { direction: dir, edge: edge.kind });
      next();
      return;
    }
    const from = this.cube.currentSceneId;
    this.stamina.spend(STAMINA.COST_CROSS);
    this.cube.currentSceneId = edge.id;
    this.roomLastVisited[this.scene().id] = performance.now();
    // enter from the opposite side and stroll a few steps inward
    this.x = this.cxToTarget(dir === 'right' ? 4 : 44);
    this.log('room.enter', { from, direction: dir });
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

    // --- Visiting a neighboring cube --------------------------------------------

  /**
   * The entry x (in author space) where a cubeman should appear when arriving
   * at a room's edge from a given direction, plus the exit x where it walks TO
   * before leaving.
   *
   * - left  door: exit at x=3,  enter from x=45 (arrive from the left)
   * - right door: exit at x=45, enter from x=3  (arrive from the right)
   * - up/down:    exit at x=24 (ladder center), enter from x=24
   */
  private static readonly EXIT_X: Record<Dir, number> = { left: 3, right: 45, up: 24, down: 24 };
  private static readonly ENTRY_X: Record<Dir, number> = { left: 45, right: 3, up: 24, down: 24 };

  /** Author-px stepped through the doorway when crossing left/right. */
  private static readonly DOOR_STEP = 7;
  /** Ticks spent climbing out of (and then into) a cube via the ladder. */
  private static readonly CLIMB_TICKS = 32;
  /** Author-px of vertical travel so the climber fully clears the screen. */
  private static readonly CLIMB_SHIFT = 46;

  /** Ladder travel in progress (see crossCube); advances in tick(). */
  private climb: {
    dir: 'up' | 'down';
    phase: 'exit' | 'enter';
    dest: Cube;
    next: () => void;
    ticks: number;
  } | null = null;
  /** Vertical pose offset while climbing (positive = toward the floor). */
  private climbY = 0;

      /** Walk to the exit edge, cross ONE cube boundary, then call `next` just
   *  inside the destination (no walk-in — the caller decides where to head
   *  next, which is what makes multi-hop routes chainable).
   *  Left/right: the door on the exit wall opens, the cubeman steps through
   *  the doorway, the cube swaps, and the door on the entry wall closes
   *  behind them. Up/down: the ladder hatch appears, the cubeman climbs out
   *  through the ceiling/floor (pose slides off-screen), the cube swaps, and
   *  they climb in through the floor/ceiling of the destination. */
  private crossCube(dir: Dir, dest: Cube, next: () => void): void {
    const edgeX = Cubeman.EXIT_X[dir];
    this.startWalkTo(edgeX, () => {
      // crossing a cube boundary costs the same as crossing an internal door
      this.stamina.spend(STAMINA.COST_CROSS);
      if (dir === 'left' || dir === 'right') {
        // door opens in the wall we're exiting through; it closes itself
        this.cube.beginDoor(dir);
        this.busy = true;
        this.mode = {
          anim: shared.walk,
          loop: true,
          // step through the doorway — past the wall edge, clipped by the screen
          walkTarget: this.x + (dir === 'left' ? -Cubeman.DOOR_STEP : Cubeman.DOOR_STEP),
          onEnd: () => {
            this.swapCube(dest, dir);
            // door opens ahead of us in the room we're entering, then closes
            this.cube.beginDoor(dir === 'left' ? 'right' : 'left');
            next();
          },
        };
        this.frame = 0;
      } else {
        // ladder: hatch appears, we climb out vertically (climb state
        // advances in tick(), swaps cubes at the halfway point)
        this.cube.beginLadder();
        this.busy = true;
        this.mode = { anim: dir === 'up' ? shared.climbUp : shared.climbDown, loop: true };
        this.frame = 0;
        this.climb = { dir, phase: 'exit', dest, next, ticks: 0 };
      }
    });
  }

  /** Land in `dest` after crossing in `dir`: swap the cube, set the entry
   *  position, and log the crossing. */
  private swapCube(dest: Cube, dir: Dir): void {
    const from = this.cube.id;
    this.cube = dest;
    this.cube.currentSceneId = dest.hub().id;
    this.x = this.cxToTarget(Cubeman.ENTRY_X[dir]);
    this.log('cube.cross', { from, to: dest.id, direction: dir });
  }

  /**
   * Autonomous "visit": A decides to visit another cubeman's cube.
   *   1. A decides (only from home, in the living room)
   *   2. Pick a reachable destination: any placed cube whose route exists and
   *      whose host can accept a visitor — adjacency is enough for a single
   *      hop, but multi-hop routes through traversable cubes work too
   *   3. Walk the route leg by leg (door or ladder crossings), arrive in the
   *      host's living room
   *   4. The VisitSession starts from the onVisitArrived callback
   */
  private startVisit(): void {
    this.scheduleWander();
    this.log('visit.attempt');
    if (this.cube !== this.home || this.scene().id !== this.cube.hub().id) {
      this.log('visit.rejected', { reason: this.cube !== this.home ? 'not-home' : 'not-in-hub' });
      return;
    }
    // A guest is already on the way to see me — stay home to receive them.
    // (Without this, the resident could depart while the visitor is en route,
    // leaving the visitor arriving at a closed, empty cube.)
    if (this.shelf.isExpectingVisitor(this.home, this)) {
      this.log('visit.rejected', { reason: 'guest-inbound' });
      return;
    }
    const plan = this.pickVisitDestination();
    if (!plan) {
      this.log('visit.rejected', { reason: 'no-available-neighbor' });
      return;
    }
    // Walk the whole route, then stroll into the host's living room. The
    // onVisitArrived callback starts the VisitSession once we've fully
    // arrived. visitTarget is set for the whole trip — including every
    // intermediate hop — so other cubemen can see a guest is inbound (and
    // the host knows to stay home) from departure to arrival.
    this.visitTarget = plan.dest;
    this.travelRoute(plan.route, () => {
      this.startWalkTo(24, () => {
        this.visitTarget = null;
        this.log('visit.arrived', { direction: plan.route[0]!.dir, hops: plan.route.length });
        this.onVisitArrived?.(this);
      });
    });
  }

  /** Every placed cube this cubeman could visit right now: reachable through
   *  traversable cubes, with a host that can accept a visitor. Picks one at
   *  random so all reachable friends get their share of visits. */
  private pickVisitDestination(): { route: Array<{ dir: Dir; dest: Cube }>; dest: Cube } | null {
    const candidates: Array<{ route: Array<{ dir: Dir; dest: Cube }>; dest: Cube }> = [];
    for (const cube of this.shelf.cubes()) {
      if (cube === this.home) continue;
      if (!this.shelf.canAcceptVisitor(cube, this)) continue;
      const route = this.shelf.pathTo(this.home, cube);
      if (route && route.length > 0) candidates.push({ route, dest: cube });
    }
    return candidates.length > 0 ? candidates[Math.floor(Math.random() * candidates.length)]! : null;
  }

  /** Walk a route leg by leg. Each leg crosses one cube boundary (door or
   *  ladder); between legs the cubeman walks across the intermediate room
   *  toward the next exit. `next` fires after the final leg's arrival. */
  private travelRoute(legs: Array<{ dir: Dir; dest: Cube }>, next: () => void): void {
    if (legs.length === 0) {
      next();
      return;
    }
    const [leg, ...rest] = legs;
    this.crossCube(leg.dir, leg.dest, () => {
      if (rest.length > 0) {
        // head across this room toward the next leg's exit edge
        this.startWalkTo(Cubeman.EXIT_X[rest[0]!.dir], () => this.travelRoute(rest, next));
      } else {
        next();
      }
    });
  }

  /** Walk the route home (multi-hop when the shelf arrangement requires it),
   *  stroll into the home living room, then run `next`. Used by VisitSession
   *  to return the visitor home and by sleep routing. */
  private returnHome(next: () => void): void {
    this.log('return.start');
    if (this.cube === this.home) {
      this.log('return.arrived', { from: this.cube.id, alreadyHome: true });
      next();
      return;
    }
    const fromId = this.cube.id;
    const route = this.shelf.pathTo(this.cube, this.home);
    if (!route) {
      // No shelf-level path (e.g. the home cube was stored mid-visit —
      // placement guards make this rare) — fall back to teleport.
      this.cube = this.home;
      this.cube.currentSceneId = this.home.hub().id;
      this.x = 0;
      this.log('return.arrived', { from: fromId, alreadyHome: false });
      next();
      return;
    }
    this.travelRoute(route, () => {
      this.startWalkTo(24, () => {
        this.log('return.arrived', { from: fromId, alreadyHome: false });
        next();
      });
    });
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
    this.log('ball.kick', { ballX: Number(this.cube.ball.x.toFixed(2)) });
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
    this.log('wake.start', { reason: 'rested' });
  }

  /** A press on a sleeping cubeman wakes it: stretch first, then act. */
  press(action: Action): void {
    // Dead buttons while visiting: A is in B's room, so A's own toy can't
    // trigger an action. (The host's buttons keep working — those are B's.)
    if (this.isVisitor) {
      this.log('input.ignored', { action: action.id, reason: 'visiting' });
      return;
    }
    if (this.busy && this.mode.anim !== this.prof.sleep && this.mode.anim !== shared.sleepEnter) {
      this.log('input.ignored', { action: action.id, reason: 'busy' });
      return;
    }
    this.log('input.accepted', { action: action.id });
    // toy ignores presses mid-trick — but falling asleep or asleep can be interrupted
    if (this.mode.anim === this.prof.sleep || this.mode.anim === shared.sleepEnter) {
      // ...but a press wakes it up: stretch first, then do the action
      this.busy = true;
      this.mode = { anim: shared.wake, loop: false, onEnd: () => this.runAction(action) };
      this.frame = 0;
      this.log('wake.start', { reason: 'input', action: action.id });
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
        this.log('sleep.start', {
          inBed: this.sleptInBed,
          earliestWakeAtMs: Math.round(this.sleepStartAt + STAMINA.MIN_NAP_MS),
          wakeStamina: this.sleptInBed ? STAMINA.WAKE_FULL : STAMINA.WAKE_NAP,
        });
      },
    };
    this.frame = 0;
    this.log('sleep.enter', { inBed });
  }

  // --- Visit coordinator surface (called by VisitSession) -----------------------

  /** Is this cubeman currently participating in a visit? */
  get inVisitMode(): boolean {
    return this.inVisit !== null;
  }

  /** True when THIS cubeman is the visitor (its keys are dead). */
  get isVisitor(): boolean {
    return this.inVisit?.isVisitor ?? false;
  }

  /** Body-center x on screen (for the session's positioning logic). */
  get posX(): number {
    return this.x;
  }

  /** Busy = mid-animation; the session waits for both to be free for beats. */
  get isBusy(): boolean {
    return this.busy;
  }

  /** Live stamina read (the session uses it to decide when to go home to
   *  sleep). Solo sleep routing is suspended during a visit, so this is the
   *  only tether to the energy budget while together. */
  get energy(): number {
    return this.stamina.get();
  }

  /** Enter the together state. `isVisitor` gates keys and solo autonomy. */
  setInVisit(isVisitor: boolean): void {
    this.inVisit = { isVisitor };
  }

  clearInVisit(): void {
    this.inVisit = null;
  }

  /** Cancel any pending movement or animation and stand idle. Used by the
   *  VisitSession to stop the host mid-walk (e.g. en route to the bedroom)
   *  when a visit begins — otherwise the host keeps walking away from the
   *  living room while the visitor arrives. */
  resetMovement(): void {
    this.busy = false;
    this.mode = { anim: this.prof.idle, loop: true };
    this.frame = 0;
  }

    /** Place this cubeman at a specific author-space x and stand idle — the
   *  VisitSession uses this to seat the visitor and host at separate spots. */
  setPosition(x: number): void {
    this.x = x;
    this.busy = false;
    this.mode = { anim: this.prof.idle, loop: true };
    this.frame = 0;
  }

  /** Play a shared social gesture (a beat the session dispatched to BOTH
   *  participants together). Freely enters a one-shot pose cycle. */
  playSocial(anim: Anim): void {
    if (this.busy) {
      this.log('social.ignored', { reason: 'busy' });
      return;
    }
    this.busy = true;
    this.mode = { anim, loop: false, onEnd: () => this.backToIdle() };
    this.frame = 0;
    this.log('social.start');
  }

  /** End the visit from this side: clear the session state and walk home.
   *  A visitor always returns home even if the other is visiting *its* home
   *  at the same moment (seat capacity is only enforced at departure). */
  beginReturnHome(after = () => this.backToIdle()): void {
    this.clearInVisit();
    this.returnHome(after);
  }

  /** Leave the visit AND go straight to bed on arriving home — the
   *  visitor's "tired → home to sleep" exit. Routes through the bedroom to
   *  the sleepSpot (the living room has no bed, so a direct check there would
   *  flop in the wrong room). */
  returnHomeToSleep(): void {
    this.beginReturnHome(() => this.routeToBed());
  }

  /** Programmatic/debug directive: send this cubeman to one of ITS rooms (a
   *  scene of its home cube, matched by id or name — e.g. 'bathroom' or
   *  'Bathroom'). If it is away on a visit it returns home first, then walks
   *  to the room. Cancels any activity in progress so the order takes effect.
   *  Returns a human-readable status line (used by the console `goToRoom`). */
  goToRoom(roomId: string): string {
    const scenes = this.home.prof.scenes;
    const wanted = roomId.toLowerCase();
    const target =
      scenes.find((s) => s.id.toLowerCase() === wanted) ??
      scenes.find((s) => s.name.toLowerCase() === wanted);
    if (!target) {
      return `"${this.name}" has no room matching \"${roomId}\". ` +
        `Available: ${scenes.map((s) => `${s.id} (${s.name})`).join(', ')}.`;
    }
    this.log('debug.goto-room', { room: target.id, roomName: target.name });
    this.resetMovement(); // force-cancel current action/walk so the order holds
    // goToRoom works from anywhere: leave any visit and head home, then the
    // final leg walks from the home hub to the requested room.
    this.beginReturnHome(() => this.travelTo(target.id, () => this.backToIdle()));
    return `Sent "${this.name}" to "${target.name}" (${target.id}).`;
  }

  /** Travel to the bedroom and lie down on the bed. Shared by the visit
   *  tired-return and the normal bedtime routing. */
  private routeToBed(): void {
    const goToSpot = (): void => {
      const spot = this.scene().sleepSpot;
      // Even a small offset can push the lying head beyond the screen.
      if (spot && this.x !== this.cxToTarget(spot.cx))
        this.startWalkTo(spot.cx, () => this.fallAsleep(true));
      else this.fallAsleep(true);
    };
    if (this.scene().id === 'bedroom') goToSpot();
    else this.travelTo('bedroom', goToSpot);
  }

  // --- Simulation tick -----------------------------------------------------------

  /** One fixed-timestep update: autonomous life, movement, recovery. */
  tick(): void {
    this.frame++;
    // If too much wall-clock time passed since the last tick (e.g. the tab was
    // backgrounded), reset all timers to "now + interval" instead of bursting
    // through every due action at once — that burst is what freezes the browser.
    const now = performance.now();
    if (this.lastTick !== 0 && now - this.lastTick > MAX_DELTA_MS) {
      this.nextSpontaneous = now + randRange(SPONTANEOUS_MIN_MS, SPONTANEOUS_MAX_MS);
      this.nextWander = now + randRange(WANDER_MIN_MS, WANDER_MAX_MS);
      this.graceUntil = now;
    }
    this.lastTick = now;
    // sleep is the PRIMARY recovery channel; a therapeutic action in progress
    // (shower/bath) also regens energy at its own rate while it plays.
    if (this.mode.anim === this.prof.sleep) this.stamina.regen(STAMINA.REGEN_PER_TICK);
    else if (this.mode.action?.regen !== undefined) this.stamina.regen(this.mode.action.regen);

    // ladder travel: climb out of this cube, swap at the ceiling/floor,
    // climb into the destination, then hand control back to walking
    if (this.climb) {
      const c = this.climb;
      c.ticks++;
      const p = Math.min(1, c.ticks / Cubeman.CLIMB_TICKS);
      if (c.phase === 'exit') {
        // slide out through the ceiling (up) or floor (down)
        this.climbY = (c.dir === 'up' ? -p : p) * Cubeman.CLIMB_SHIFT;
        if (c.ticks >= Cubeman.CLIMB_TICKS) {
          this.cube.endLadder();
          this.swapCube(c.dest, c.dir);
          this.cube.beginLadder();
          this.climb = { ...c, phase: 'enter', ticks: 0 };
        }
      } else {
        // climb in from the floor (up) or ceiling (down) of the new room
        this.climbY = (c.dir === 'up' ? 1 : -1) * (1 - p) * Cubeman.CLIMB_SHIFT;
        if (c.ticks >= Cubeman.CLIMB_TICKS) {
          this.climbY = 0;
          this.climb = null;
          this.cube.endLadder();
          c.next();
        }
      }
      return; // the climb consumes this tick — no walking or autonomy
    }

    // walking: advance x toward the target, stop when arrived. Cost is
    // charged per SCREEN pixel actually moved (author px × BODY_SCALE),
    // including the final (possibly shorter) arrival step.
    if (this.mode.walkTarget !== undefined) {
      const d = this.mode.walkTarget - this.x;
      const step = Math.sign(d) * Math.min(Math.abs(d), WALK_SPEED);
      this.x += step;
      this.stamina.spend(STAMINA.COST_WALK_PX * Math.abs(step) * LCD.BODY_SCALE);
      if (this.x === this.mode.walkTarget) {
        this.log('walk.arrived');
        const mode = this.mode;
        (this.mode.onEnd ?? (() => this.backToIdle()))();
        // A zero-length walk (already at the target) would re-fire its onEnd
        // every tick if the callback didn't take over the mode (e.g. an
        // arrival callback that couldn't start a session). Settle to idle
        // instead so arrival callbacks fire exactly once.
        if (this.mode === mode) this.backToIdle();
      }
    }
    if (!this.mode.loop && this.mode.walkTarget === undefined && this.frame >= this.mode.anim.dur) {
      this.log('animation.end');
      (this.mode.onEnd ?? (() => this.backToIdle()))();
    }

    // In a visit, this cubeman does NOT steer itself: the VisitSession
    // dispatches social beats and judges when it goes home. Keep the anim
    // clock/movement above, but skip all solo autonomy and sleep routing.
    if (this.inVisit) return;

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
      this.log('sleep.request', { reason: 'exhausted', kind: 'flop' });
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
      this.log('sleep.request', {
        reason: this.stamina.get() < STAMINA.SLEEP_AT ? 'low-stamina' : 'inactivity',
        kind: 'bed',
      });
      const bedtime = (): void => this.routeToBed();
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
      const action = this.pickAction(this.prof.actions);
      if (action) this.runAction(action, true);
      return;
    }
    // autonomous life when idle: maybe visit a neighbor, otherwise explore /
    // play / wander. A visit is only possible from home's living room and
    // only across a connected edge — startVisit() no-ops otherwise.
    if (!this.busy && this.mode.anim === this.prof.idle && now >= this.nextWander) {
      if (Math.random() < VISIT_CHANCE) {
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

  /** The ladder direction while a climb transition anim is playing (drives
   *  the ladder overlay on the cube's display), or null otherwise. */
  get climbing(): Dir | null {
    if (this.mode.anim === shared.climbUp) return 'up';
    if (this.mode.anim === shared.climbDown) return 'down';
    return null;
  }

  /** This cubeman's own animation clock (for per-cubeman overlay timing). */
  get animFrame(): number {
    return this.frame;
  }

  /** Front overlay of the in-progress action (e.g. the shower stream, the tub's
   *  near wall) — rendered over this cubeman while the action plays. Null when
   *  there is none (idling, walking, sleeping, etc.). */
  get actionOverlay(): Overlay | null {
    return this.mode.action?.front ?? null;
  }

  /** The cubeman's current rendered pose, shifted to its screen position.
   *  The caller composites this onto a cube's shared backdrop via LCD.
   *  climbY slides the pose vertically while traveling via ladder. */
  pose() {
    return shiftY(shiftX(sample(this.mode.anim, this.frame), this.x), this.climbY);
  }
}
