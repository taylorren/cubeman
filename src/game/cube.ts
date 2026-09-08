import type { Profession } from '../content/professions';

/**
 * A cube: one toy on the shelf and the world inside it. Owns rooms
 * (shared, immutable scenery content), props, and prop physics — the ball
 * belongs to the LIVING ROOM, not to whichever cubeman happens to occupy
 * the cube, so it keeps its position and rolls even when nobody is home.
 * Character state (position, stamina, mood) lives in Cubeman, never here.
 */
export class Cube {
  /** The ball lives in the living room. x is LCD space; v is LCD px/frame. */
  readonly ball = { x: 8, v: 0 };

  /** Door travel FX on a side wall: ticks since it began; the doorway
   *  opens, holds, and closes on its own (see DOOR_FX_TICKS). */
  doorFx: { dir: 'left' | 'right'; t: number } | null = null;
  /** Ladder travel FX: true while a cubeman is climbing in or out of this
   *  cube through the ceiling/floor hatch. */
  ladderOn = false;
  /** The room currently on display — owned by the CUBE, not by any one
   *  cubeman. All occupants of this cube stand in this same room, which is
   *  what makes shared-room occupancy (one resident + one visitor)
   *  renderable on the cube's single display. */
  currentSceneId: string;

  constructor(
    readonly id: string,
    readonly prof: Profession,
  ) {
    this.currentSceneId = prof.scenes[0]!.id; // hub/entry room
  }

  /** Scene content by id (scenes are immutable profession content). */
  scene(id: string) {
    return this.prof.scenes.find((s) => s.id === id)!;
  }

  /** The hub/entry room — where cross-cube travel enters and leaves. */
  hub() {
    return this.prof.scenes[0]!;
  }

  beginDoor(dir: 'left' | 'right'): void {
    this.doorFx = { dir, t: 0 };
  }

  /** The ladder hatch appears (climb in progress). */
  beginLadder(): void {
    this.ladderOn = true;
  }

  /** The ladder hatch disappears (climb finished). */
  endLadder(): void {
    this.ladderOn = false;
  }

  /**
   * Prop physics run every tick regardless of occupancy — the world
   * evolves on its own, even when the cube sits empty on the shelf.
   */
  tick(): void {
    // door FX run on their own clock: open, hold, close, gone
    if (this.doorFx && ++this.doorFx.t > DOOR_FX_TICKS) this.doorFx = null;
    if (this.ball.v === 0) return;
    this.ball.x += this.ball.v;
    this.ball.v *= 0.97; // floor friction
    if (this.ball.x < BALL_WALL_LO) {
      this.ball.x = BALL_WALL_LO;
      this.ball.v = Math.abs(this.ball.v) * 0.5; // bounce off the left wall
    }
    if (this.ball.x > BALL_EDGE_HI) {
      this.ball.x = BALL_EDGE_HI;
      this.ball.v = -Math.abs(this.ball.v) * 0.5; // bounce off the right wall
    }
    if (Math.abs(this.ball.v) < 0.05) this.ball.v = 0;
  }

  /** Draw the room a cubeman currently stands in, plus the ball if present. */
  drawRoom(ctx: CanvasRenderingContext2D, sceneId: string, frame: number): void {
    this.scene(sceneId).draw(ctx, frame);
    if (sceneId === this.hub().id) this.drawBall(ctx);
  }

  private drawBall(ctx: CanvasRenderingContext2D): void {
    const b = Math.round(this.ball.x);
    ctx.fillRect(b - 1, 42, 2, 1); // top
    ctx.fillRect(b - 2, 43, 1, 2); // left
    ctx.fillRect(b + 1, 43, 1, 2); // right
    ctx.fillRect(b - 1, 45, 2, 1); // bottom
  }
}

const BALL_WALL_LO = 2.5;
const BALL_EDGE_HI = 45.5;

/** Door FX lifetime in ticks: 8 opening, 8 held open, 8 closing. */
const DOOR_FX_TICKS = 24;

/** How "open" the doorway is at door-FX tick `t` (0 closed, 1 fully open). */
export function doorOpenness(t: number): number {
  if (t < 8) return t / 8;
  if (t < 16) return 1;
  return Math.max(0, 1 - (t - 16) / 8);
}