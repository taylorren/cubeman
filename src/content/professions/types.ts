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
  | { kind: 'neighbor'; dir: 'left' | 'right' }
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
}

/** A profession action: a named one-shot animation. */
export interface Action {
  id: string;
  name: string;
  anim: Anim;
  /** Stamina cost — drives autonomous trick selection (default 8). */
  effort?: number;
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
