import type { Anim, Skeleton } from '../../render/skeleton';
import type { SoundId } from '../../core/sound';

/** Extra LCD elements drawn in 48×48 space, thresholded like the skeleton. */
export type Overlay = (ctx: CanvasRenderingContext2D, frame: number) => void;

/**
 * A body layer drawn WITH the skeleton, in the SAME body-scale transform, so
 * silhouette styling (hair, a skirt, an apron) tracks every pose — idle sway,
 * wandering, actions, sleep. The pose passed is the cubeman's CURRENT rendered
 * pose (already shifted to its screen position), so authored shapes anchor to
 * the live `head`/`hip` joints and move with the animation.
 */
export type BodyOverlay = (ctx: CanvasRenderingContext2D, frame: number, s: Skeleton) => void;

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
  /** Restrict the action to specific room(s) (scene ids in the profession's
   *  home cube), e.g. `'bathroom'` for shower/bath, `['bedroom', 'bathroom']`
   *  for Meditation. Outside those rooms the action is ignored — it "only
   *  happens" there. Omit for room-agnostic actions. */
  room?: string | string[];
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
  /** Synthesized sound to play when this action starts (default none). Sparse
   *  by design — only the Musician's actions produce sound. */
  sound?: SoundId;
  /** SECRET actions are excluded from the Surprise pool and from spontaneous
   *  play — they only fire via a hidden input combo. Used as profession
   *  unlock easter eggs. */
  secret?: boolean;
  /** SPONTANEOUS-ONLY actions (e.g. Meditation) never enter the button or
   *  Surprise pools — they only play in autonomous wandering mode. */
  spontaneousOnly?: boolean;
  /** When `secret`, the achievement id this action's hidden-combo UNLOCKS
   *  (e.g. `'lift-off'`). Lets each profession's secret grant its own
   *  achievement instead of a fixed one. */
  unlock?: string;
  /** When `secret`, the button sequence that triggers this action. Each
   *  entry is a button spec (`'0'`=left, `'1'`=right, `'random'`=middle star).
   *  Defaults to the classic LEFT→RIGHT→MIDDLE sweep if omitted. A longer or
   *  alternating pattern is harder to stumble into. */
  combo?: string[];
  /** When `secret`, the max ms allowed between the first and last combo
   *  press. Defaults to 1500ms. */
  comboWindow?: number;
}

/**
 * A cubeman profession: identity + its own actions + shared behaviors.
 * Social-mode repertoire (interactions) will attach here in P3.
 */
export interface Profession {
  id: string;
  name: string;
  /** Body presentation variant for shared gendered actions (bedroom
   *  grooming/dressing). Omit for the neutral (gent by default) figure. */
  gender?: 'lady' | 'gent';
  actions: Action[];
  /** Shared behaviors applied to every profession. */
  idle: Anim;
  sleep: Anim;
  /** Optional persistent body presentation (hair, clothing, silhouette).
   *  Drawn on top of the skeleton in the body-scale transform after the pose
   *  is drawn, so it inherits every animation. Omit for the neutral stickman. */
  presentation?: BodyOverlay;
  /**
   * Optional stamina ceiling. When omitted, defaults to the global STAMINA.MAX
   * (100). Useful for giving some characters a larger energy budget.
   */
  maxStamina?: number;
  scenes: Scene[];
}
