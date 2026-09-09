import type { Anim } from '../../render/skeleton';

/** Extra LCD elements drawn in 48×48 space, thresholded like the skeleton. */
export type Overlay = (ctx: CanvasRenderingContext2D, frame: number) => void;

/**
 * Where a scene edge leads. Only the "hub" scene (the living room) may
 * declare `neighbor` edges — walking off those will enter a CONNECTED
 * cube in P2. Internal rooms link to each other via `scene` edges.
 */
export type SceneEdge =
  | { kind: 'scene'; id: string }
  | { kind: 'neighbor'; dir: 'left' | 'right' | 'up' | 'down' }
  | { kind: 'wall' };

/** Scenery drawn behind the cubeman — makes a cube feel like a place. */
export interface Ambience {
  id: string;
  name: string;
  draw: Overlay;
  /**
   * The cubeman's sleeping spot (bed etc.). `cx` is the body-center
   * SCREEN x he should stand at before lying down; x1..x2 is the
   * footprint in LCD space (used both to draw toward and to block walking).
   */
  sleepSpot?: { x1: number; x2: number; cx: number };
  /** LCD-space x spans the cubeman cannot walk through (furniture). */
  solids?: Array<[number, number]>;
}

/** One room of a cube: an ambience plus a typed edge map. */
export interface Scene extends Ambience {
  left: SceneEdge;
  right: SceneEdge;
  up: SceneEdge;
  down: SceneEdge;
}

/** A profession action: a named one-shot animation. */
export interface Action {
  id: string;
  name: string;
  anim: Anim;
  /** Stamina cost — drives autonomous trick selection (default 8). */
  effort?: number;
  /** Restrict the action to a specific room (a scene id in the profession's
   *  home cube), e.g. `'bathroom'` for shower/bath. Outside that room the
   *  action is ignored — it "only happens" there. */
  room?: string;
  /** The body-center SCREEN x this action is performed AT, e.g. a bathroom
   *  fixture: the cubeman snaps to this spot when the action starts, so it
   *  always lines up with the scenery drawn around it. Used by the shower
   *  (standing under the head) and the bath (seated inside the tub). When
   *  omitted the cubeman performs wherever it happens to stand. */
  stand?: number;
  /** Front overlay — drawn in FULL 48x48 LCD space OVER this cubeman while
   *  the action plays (the same channel as the Zzz sleep overlay), so it can
   *  occlude or streak in front of the skeleton. The shower uses it for falling
   *  water; the bath uses it for the tub's near wall + water surface. */
  front?: Overlay;
  /** Stamina recovered PER TICK while this action plays (default none). Lets
   *  therapeutic actions like shower/bath feed the energy budget in addition
   *  to sleep — a soak regens faster than an ordinary shower. */
  regen?: number;
}

/**
 * A cubeman profession: identity + its own actions + shared behaviors.
 * Social-mode repertoire (interactions) will attach here in P3.
 */
export interface Profession {
  id: string;
  name: string;
  actions: Action[];
  /** Shared behaviors applied to every profession. */
  idle: Anim;
  sleep: Anim;
  /** Rooms of this cubeman's home cube; the first is the hub/entry room. */
  scenes: Scene[];
}
