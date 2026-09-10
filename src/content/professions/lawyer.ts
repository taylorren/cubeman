import { pose } from '../../render/skeleton';
import type { Action, BodyOverlay, Profession, Scene } from './types';
import { makeLivingRoom, bedroom, bathroom, rectOutline, idle, sleep, shower, bath, meditation } from './shared';

// --- Body presentation: a woman (the second one — tailored, not soft) ----------
//
// The skeleton is gender-neutral. Where Briar's presentation reads soft and
// flared (bob + A-line dress), Laura's reads sharp and tailored: a close-cropped
// crown with a low bun, a slim pair of spectacles, a blazer over the torso, and
// a straight pencil skirt that hugs the hips instead of flaring. Same
// pose-driven body layer — anchored to the live head/neck/hip joints — so the
// whole silhouette tracks every animation, but the two women look unmistakably
// different on the shelf.

/** Close-cropped crown + a low bun at the back of the head. */
function drawUpdo(ctx: CanvasRenderingContext2D, hx: number, hy: number): void {
  ctx.fillRect(hx - 3, hy - 4, 7, 2);   // crown
  ctx.fillRect(hx + 2, hy - 5, 2, 2);   // low bun
}

/** A slim pair of spectacles: two lenses joined by a bridge across the eyes. */
function drawSpectacles(ctx: CanvasRenderingContext2D, hx: number, hy: number): void {
  ctx.fillRect(hx - 2, hy, 1, 1);       // left lens
  ctx.fillRect(hx + 1, hy, 1, 1);       // right lens
  ctx.fillRect(hx - 1, hy, 2, 1);       // bridge
}

/** A blazer over the torso and a straight pencil skirt from the hips down. */
function drawTailoredSuit(ctx: CanvasRenderingContext2D, nx: number, ny: number, px: number, py: number): void {
  // blazer — a crisp column from the shoulder to the waist
  ctx.fillRect(Math.round(nx - 2), Math.round(ny + 1), 4, Math.max(1, Math.round(py) - Math.round(ny + 1)));
  // pencil skirt — a narrow straight column (not flared), hem above the ankles
  const hem = Math.min(Math.round(py) + 11, 37);
  for (let yy = Math.round(py); yy <= hem; yy++) {
    ctx.fillRect(Math.round(px - 1.5), yy, 3, 1);
  }
}

const presentation: BodyOverlay = (ctx, _frame, s) => {
  drawUpdo(ctx, s.head[0], s.head[1]);
  drawSpectacles(ctx, s.head[0], s.head[1]);
  drawTailoredSuit(ctx, s.neck[0], s.neck[1], s.hip[0], s.hip[1]);
};

// --- Actions --------------------------------------------------------------------

/**
 * Objection! — a hard wind-up, then the index finger shoots up and out with a
 * quick double-emphasis shake. Her signature beat.
 */
const objection: Action = {
  id: 'objection',
  name: 'Objection!',
  room: 'living',
  effort: 4,
  anim: {
    dur: 40,
    loop: false,
    keys: [
      { t: 0, pose: pose() },
      // wind up — pull the pointing arm down and back
      {
        t: 7,
        pose: pose({
          head: [23.5, 9], neck: [23.5, 14], hip: [23.5, 24],
          eR: [29, 20], hR: [31, 27],
          eL: [20, 18], hL: [16, 23],
        }),
      },
      // SHOOT the point up and out, leaning forward
      {
        t: 15,
        pose: pose({
          head: [23, 8.5], neck: [23, 13.5], hip: [23, 24],
          eR: [30, 9], hR: [34, 4],
          eL: [20, 18], hL: [16, 23],
        }),
      },
      // emphasis shake right
      { t: 22, pose: pose({ head: [23, 8.5], neck: [23, 13.5], hip: [23, 24], eR: [30, 10], hR: [33, 5] }) },
      // emphasis shake left (a beat later)
      { t: 30, pose: pose({ head: [23, 8.5], neck: [23, 13.5], hip: [23, 24], eR: [31, 9], hR: [35, 4] }) },
      { t: 38, pose: pose() },
      { t: 40, pose: pose() },
    ],
  },
};

/**
 * Slam the Gavel — raise high, pause, then swing down hard onto the bench.
 * A gavel overlay rides the raised hand, then drops to the strike.
 */
const gavel: Action = {
  id: 'gavel',
  name: 'Slam the Gavel',
  room: 'living',
  effort: 3,
  anim: {
    dur: 50,
    loop: false,
    keys: [
      { t: 0, pose: pose() },
      // raise high
      {
        t: 12,
        pose: pose({
          head: [24, 8], neck: [24, 13], hip: [24, 24],
          eR: [30, 8], hR: [34, 2],
          eL: [20, 18], hL: [16, 23],
        }),
      },
      // poised
      {
        t: 20,
        pose: pose({
          head: [24, 8], neck: [24, 13], hip: [24, 24],
          eR: [30, 8], hR: [34, 2],
        }),
      },
      // SLAM — the arm swings down to the mid strike
      {
        t: 28,
        pose: pose({
          head: [24, 9], neck: [24, 14], hip: [24, 24],
          eR: [31, 16], hR: [34, 22],
        }),
      },
      // hold the recess
      { t: 36, pose: pose({ head: [24, 9], neck: [24, 14], eR: [31, 16], hR: [34, 22] }) },
      { t: 44, pose: pose() },
      { t: 50, pose: pose() },
    ],
  },
  front: (ctx, frame) => {
    if (frame < 4 || frame > 27) return;
    // a gavel riding in the raised hand (screen pos of hR≈[34,2])
    ctx.fillRect(30, 15, 3, 2); // mallet head
    ctx.fillRect(32, 17, 1, 3); // handle
  },
};

/**
 * Present the Brief — both arms reach forward to proffer a scroll; the
 * document unrolls in front of her chest.
 */
const brief: Action = {
  id: 'present-brief',
  name: 'Present the Brief',
  room: 'living',
  effort: 3,
  anim: {
    dur: 58,
    loop: false,
    keys: [
      { t: 0, pose: pose() },
      // draw both hands up to the chest
      {
        t: 8,
        pose: pose({
          head: [24, 9], neck: [24, 14], hip: [24, 24],
          eL: [19, 14], hL: [17, 19], eR: [29, 14], hR: [31, 19],
        }),
      },
      // offer the scroll forward
      {
        t: 18,
        pose: pose({
          head: [24, 9], neck: [24, 14], hip: [24, 24],
          eL: [18, 16], hL: [15, 23], eR: [30, 16], hR: [33, 23],
        }),
      },
      // hold it out (scroll rides in the front overlay)
      { t: 26, pose: pose({ eL: [18, 16], hL: [15, 23], eR: [30, 16], hR: [33, 23] }) },
      { t: 40, pose: pose({ eL: [18, 16], hL: [15, 23], eR: [30, 16], hR: [33, 23] }) },
      // draw it back
      {
        t: 50,
        pose: pose({
          eL: [19, 14], hL: [17, 19], eR: [29, 14], hR: [31, 19],
        }),
      },
      { t: 58, pose: pose() },
    ],
  },
  front: (ctx, frame) => {
    if (frame < 18 || frame > 48) return;
    // a scroll across the offered hands (chest height, screen coords)
    ctx.fillRect(18, 27, 12, 5);        // paper
    ctx.fillRect(17, 26, 1, 2);         // left roll end
    ctx.fillRect(30, 26, 1, 2);         // right roll end
  },
};

// --- The chambers (living room) -------------------------------------------------

/**
 * Laura's living room: a quiet courtroom-chambers. A set of scales of justice
 * tips slowly on the left, a bench with a standing gavel and a stack of law
 * books sits on the right, and a marked case file lies on the floor.
 */
const livingRoom: Scene = makeLivingRoom((ctx, frame) => {
  ctx.fillRect(0, 46, 48, 2); // floor

  // === window (top-left) ===
  rectOutline(ctx, 4, 4, 7, 7);

  // === scales of justice (left floor), gently tipping ===
  ctx.fillRect(4, 40, 8, 4);      // base
  ctx.fillRect(7, 33, 1, 7);      // centre post
  ctx.fillRect(3, 33, 11, 1);     // beam
  const tip = Math.floor(frame / 36) % 2;
  ctx.fillRect(5 - tip, 34, 2, 1);  // left pan
  ctx.fillRect(9 + tip, 34, 2, 1);  // right pan

  // === bench (right) with a gavel and law books stacked on top ===
  ctx.fillRect(34, 41, 14, 4);   // bench block
  ctx.fillRect(35, 36, 4, 5);    // a tall book
  ctx.fillRect(40, 38, 4, 3);    // a shorter book
  ctx.fillRect(30, 42, 3, 1);    // gavel on the floor, laid flat
  ctx.fillRect(31, 43, 1, 1);    // mallet head

  // === a marked case file on the floor (front-left, out of the walk band) ===
  ctx.fillRect(13, 44, 7, 1);    // a spread file
  ctx.fillRect(14, 45, 1, 1);    // a silver tab
});

export const lawyer: Profession = {
  id: 'lawyer',
  name: 'Lawyer',
  gender: 'lady',
  maxStamina: 120,
  presentation,
  actions: [objection, gavel, brief, shower, bath, meditation],
  idle,
  sleep,
  scenes: [livingRoom, bedroom, bathroom],
};