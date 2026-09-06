import { animExtent, sample, shiftX } from '../render/skeleton';
import type { Anim } from '../render/skeleton';
import { LCD } from '../render/lcd';
import * as shared from '../content/professions/shared';
import type { Action, Profession } from '../content/professions';
import { GRACE_MS, STAMINA, Stamina } from './stamina';
import type { Cube } from './cube';
import type { Shelf } from './shelf';
import { gameLog } from '../core/debug';
import type { LogDetails } from '../core/debug';

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

  // --- Visiting a neighboring cube ---------------------------------------------

  /**
   * Autonomous "visit": A decides to visit a connected neighbor B.
   * Simple model — no animation of crossing:
   *   1. A decides (only from home, in the living room, to a connected cube)
   *   2. Check B is home (canAcceptVisitor) → A disappears from A's cube and
   *      appears in B's living room; the coordinator (VisitSession) starts.
   *   3. Not home → nothing happens, A continues its solo life.
   */
  private startVisit(): void {
    this.scheduleWander();
    this.log('visit.attempt');
    if (this.cube !== this.home || this.scene().id !== this.cube.hub().id) {
      this.log('visit.rejected', { reason: this.cube !== this.home ? 'not-home' : 'not-in-hub' });
      return;
    }
    // Resolve the neighbor from the SHELF's slot table — not the room's
    // scene-graph edge. In a 1×2 layout, cube-0's right neighbor is cube-1
    // because the shelf says so, regardless of what the room edges declare.
    const neighbor = this.visitableNeighbor();
    if (!neighbor) {
      this.log('visit.rejected', { reason: 'no-available-neighbor' });
      return;
    }
    const { dir, dest } = neighbor;
    if (!this.shelf.canAcceptVisitor(dest, this)) {
      this.log('visit.rejected', {
        reason: 'destination-unavailable',
        destination: dest.id,
        resident: this.shelf.residentOf(dest)?.debugState() ?? null,
      });
      return;
    }
    const from = this.cube.id;
    // teleport A into B's living room
    this.cube = dest;
    this.cube.currentSceneId = dest.hub().id;
    this.x = 0; // center of B's living room
    this.backToIdle();
    this.log('visit.arrived', { from, direction: dir });
    this.onVisitArrived?.(this);
  }

  /** The adjacent cube (if any) reachable via the shelf's slot table. */
  private visitableNeighbor(): { dir: 'left' | 'right'; dest: Cube } | null {
    for (const dir of ['left', 'right'] as const) {
      const dest = this.shelf.neighborOf(this.cube, dir);
      if (dest) return { dir, dest };
    }
    return null;
  }

  /** Return home (teleport). Used by the VisitSession when the visit ends:
   *  the visitor disappears from the host's cube and reappears in its own
   *  living room. Callback-safe — `next` always runs. */
  private returnHome(next: () => void): void {
    this.log('return.start');
    if (this.cube === this.home) {
      this.log('return.arrived', { from: this.cube.id, alreadyHome: true });
      next();
      return;
    }
    const from = this.cube.id;
    this.cube = this.home;
    this.cube.currentSceneId = this.home.hub().id;
    this.x = 0;
    this.log('return.arrived', { from, alreadyHome: false });
    next();
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

  /** Travel to the bedroom and lie down on the bed. Shared by the visit
   *  tired-return and the normal bedtime routing. */
  private routeToBed(): void {
    const goToSpot = (): void => {
      const spot = this.scene().sleepSpot;
      if (spot && Math.abs(this.cx() - spot.cx) > 1.5)
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
      if (this.x === this.mode.walkTarget) {
        this.log('walk.arrived');
        (this.mode.onEnd ?? (() => this.backToIdle()))();
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
      this.runAction(this.pickAction(this.prof.actions), true);
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
