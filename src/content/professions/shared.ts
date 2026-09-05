import type { Scene } from './types';
import type { Anim } from '../../render/skeleton';
import { pose } from '../../render/skeleton';

/**
 * Behaviors shared by ALL professions — every cubeman idles and sleeps
 * the same way, regardless of profession.
 */

// --- Idle: breathe, glance around ------------------------------------------

export const idle: Anim = {
  dur: 96,
  loop: true,
  keys: [
    { t: 0, pose: pose() },
    {
      t: 18,
      pose: pose({
        head: [24, 8.6], neck: [24, 13.6],
        eL: [19.4, 18.4], hL: [16.4, 23.2],
        eR: [28.6, 18.4], hR: [31.6, 23.2],
      }),
    },
    { t: 42, pose: pose() },
    { t: 58, pose: pose({ head: [22, 9] }) },
    { t: 74, pose: pose({ head: [26, 9] }) },
    { t: 88, pose: pose() },
  ],
};

// --- Walk: simple scissor-step cycle (direction handled by the caller) ------

export const walk: Anim = {
  dur: 16,
  loop: true,
  keys: [
    {
      t: 0,
      pose: pose({ kL: [20, 30], fL: [17, 39.5], kR: [28, 30], fR: [31, 39.5] }),
    },
    {
      t: 4,
      pose: pose({
        head: [24, 8.7], neck: [24, 13.7],
        kL: [18, 30], fL: [13, 38], kR: [29, 31], fR: [34, 40],
        eL: [20, 19], hL: [16, 24], eR: [28, 19], hR: [33, 23],
      }),
    },
    {
      t: 8,
      pose: pose({ kL: [20, 30], fL: [17, 39.5], kR: [28, 30], fR: [31, 39.5] }),
    },
    {
      t: 12,
      pose: pose({
        head: [24, 8.7], neck: [24, 13.7],
        kL: [19, 31], fL: [14, 40], kR: [30, 30], fR: [35, 38],
        eL: [20, 19], hL: [15, 23], eR: [28, 19], hR: [32, 24],
      }),
    },
    { t: 16, pose: pose({ kL: [20, 30], fL: [17, 39.5], kR: [28, 30], fR: [31, 39.5] }) },
  ],
};

// --- Sleep: lying on its back, slow breathing, occasional twitch -------------

const lying = pose({
  head: [38, 36], neck: [34, 36], hip: [26, 36],
  kL: [20, 34], fL: [13, 36],
  kR: [19, 38], fR: [12, 40],
  eL: [32, 32], hL: [28, 34],
  eR: [33, 38], hR: [29, 39],
});

const lyingBreath = pose({
  head: [38, 35.4], neck: [34, 35.4], hip: [26, 35.4],
  kL: [20, 33.4], fL: [13, 35.4],
  kR: [19, 37.4], fR: [12, 39.4],
  eL: [32, 31.4], hL: [28, 33.4],
  eR: [33, 37.4], hR: [29, 38.4],
});

export const sleep: Anim = {
  dur: 150,
  loop: true,
  keys: [
    { t: 0, pose: lying },
    { t: 30, pose: lyingBreath },
    { t: 60, pose: lying },
    { t: 100, pose: lying },
    // little twitch: one foot kicks
    { t: 108, pose: pose({ ...lying, fL: [10, 32] }) },
    { t: 116, pose: lying },
    { t: 150, pose: lying },
  ],
};

/** Sitting pose used by both falling asleep and waking up. */
const sitting = pose({
  head: [24, 15], neck: [24, 20], hip: [24, 30],
  kL: [20, 34], fL: [18, 38],
  kR: [28, 34], fR: [30, 38],
  eL: [20, 25], hL: [18, 30],
  eR: [28, 25], hR: [30, 30],
});

/** Lying half-way between sitting and flat (sleep-entry midpoint). */
const slumping = pose({
  head: [35, 35], neck: [31, 35.5], hip: [25, 35.5],
  kL: [20, 34.5], fL: [14, 36.5],
  kR: [19, 37], fR: [13, 39],
  eL: [30, 32], hL: [27, 33.5],
  eR: [31, 37.5], hR: [28, 38.5],
});

/** Idle → sitting → slumping → lying (then the sleep loop takes over). */
export const sleepEnter: Anim = {
  dur: 24,
  loop: false,
  keys: [
    { t: 0, pose: pose() },
    { t: 8, pose: sitting },
    { t: 16, pose: slumping },
    { t: 24, pose: lying },
  ],
};

/** Outline of a rect from fillRects (no stroke state to manage). */
function rectOutline(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  ctx.fillRect(x, y, w, 1);
  ctx.fillRect(x, y + h - 1, w, 1);
  ctx.fillRect(x, y, 1, h);
  ctx.fillRect(x + w - 1, y, 1, h);
}

/**
 * "Living room" — the hub room of the Stickman's cube: window with a
 * pulsing sun, a swaying potted plant, and the ball he kicks around.
 * Its OUTER edges lead to neighbor cubes (declared for P2); the right
 * edge is the door to the bedroom.
 */
export const livingRoom: Scene = {
  id: 'living',
  name: 'Living room',
  left: { kind: 'neighbor', dir: 'left' }, // future: connected cube
  right: { kind: 'scene', id: 'bedroom' },
  draw(ctx, frame) {
    // floor — the bottom rim of the screen itself
    ctx.fillRect(0, 46, 48, 2);
    // grass tufts poking above the floor
    ctx.fillRect(8, 45, 2, 1);
    ctx.fillRect(14, 45, 1, 1);
    ctx.fillRect(20, 45, 2, 1);
    ctx.fillRect(38, 45, 2, 1);

    // window (top-left)
    rectOutline(ctx, 5, 5, 11, 9);
    ctx.fillRect(10, 5, 1, 9); // vertical pane divider

    // sun in the left pane, gently pulsing
    const pulse = Math.floor(frame / 45) % 2;
    ctx.fillRect(6, 7, 2, 2);
    if (pulse) {
      ctx.fillRect(7, 6, 1, 1); // ray top
      ctx.fillRect(7, 9, 1, 1); // ray bottom
      ctx.fillRect(5, 8, 1, 1); // ray left
      ctx.fillRect(8, 8, 1, 1); // ray right
    }

    // potted plant (bottom-left corner), stem sways gently
    const sway = Math.floor(frame / 45) % 2;
    ctx.fillRect(1, 42, 4, 4); // pot
    ctx.fillRect(0, 41, 6, 1); // pot rim
    ctx.fillRect(2 + sway, 36, 1, 5); // stem
    ctx.fillRect(0 + sway, 35, 2, 2); // left leaf
    ctx.fillRect(3 + sway, 35, 2, 2); // right leaf
    ctx.fillRect(1 + sway, 33, 2, 2); // top leaf
  },
};

/** The stickman portrait that hangs in the bedroom. */
function portrait(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  rectOutline(ctx, x, y, 8, 7);
  ctx.fillRect(x + 3, y + 2, 2, 1); // head
  ctx.fillRect(x + 3, y + 4, 2, 1); // body
  ctx.fillRect(x + 2, y + 3, 1, 1); // arms
  ctx.fillRect(x + 5, y + 3, 1, 1);
}

/**
 * "Bedroom" — where he naps: photo frame, floor lamp (glows softly),
 * and his bed on the right. Reached through the living room's right door.
 */
export const bedroom: Scene = {
  id: 'bedroom',
  name: 'Bedroom',
  left: { kind: 'scene', id: 'living' },
  right: { kind: 'scene', id: 'bathroom' },
  sleepSpot: { x1: 27, x2: 46, cx: 35.5 },
  solids: [[27, 46]], // the bed
  draw(ctx, frame) {
    ctx.fillRect(0, 46, 48, 2); // floor

    // photo frame on the wall — a tiny portrait of... a stickman
    portrait(ctx, 17, 6);

    // floor lamp (left): shade pulses like a dimmer
    const glow = Math.floor(frame / 45) % 2;
    ctx.fillRect(6, 44, 5, 2); // base
    ctx.fillRect(8, 33, 1, 11); // pole
    ctx.fillRect(5, 29, 7, 4); // shade
    if (glow) ctx.fillRect(6, 30, 5, 2); // lit inner shade

    // bed (right side): mattress, blanket fold, pillow, headboard
    ctx.fillRect(27, 43, 20, 3); // mattress
    ctx.fillRect(29, 43, 9, 1); // blanket fold
    ctx.fillRect(40, 41, 5, 2); // pillow
    ctx.fillRect(46, 37, 1, 6); // headboard
  },
};

/**
 * "Bathroom" — a bathtub with rising bubbles, a towel rack and a bath mat.
 * Bathing behavior itself arrives later; for now it's a room to visit.
 */
export const bathroom: Scene = {
  id: 'bathroom',
  name: 'Bathroom',
  left: { kind: 'scene', id: 'bedroom' },
  right: { kind: 'wall' },
  solids: [[26, 46]], // the tub
  draw(ctx, frame) {
    ctx.fillRect(0, 46, 48, 2); // floor

    // towel rack (top-left)
    ctx.fillRect(6, 8, 10, 1); // rail
    ctx.fillRect(3, 8, 1, 3); ctx.fillRect(18, 8, 1, 3); // brackets
    ctx.fillRect(9, 8, 4, 5); // towel
    ctx.fillRect(9, 12, 4, 1); // towel fold

    // bath mat
    ctx.fillRect(8, 45, 8, 1);

    // bathtub (right): rim, walls, feet, water line
    ctx.fillRect(26, 38, 21, 1); // rim
    ctx.fillRect(26, 39, 2, 6); // left wall
    ctx.fillRect(45, 39, 2, 6); // right wall
    ctx.fillRect(28, 44, 3, 1); ctx.fillRect(42, 44, 3, 1); // feet
    ctx.fillRect(28, 41, 17, 1); // water line
    // bubbles rising from the water
    const cycle = frame % 90;
    for (let i = 0; i < 3; i++) {
      const p = ((cycle / 90) + i * 0.33) % 1;
      if (p > 0.8) continue;
      ctx.fillRect(30 + i * 6 + (i % 2 ? 1 : 0), 40 - Math.round(p * 12), 1, 1);
    }
  },
};

/** Lying → sit up → big stretch → back to standing. */
export const wake: Anim = {
  dur: 30,
  loop: false,
  keys: [
    { t: 0, pose: lying },
    { t: 8, pose: sitting },
    {
      t: 18,
      pose: pose({
        head: [24, 8], neck: [24, 13],
        eL: [19, 10], hL: [16, 4],
        eR: [29, 10], hR: [32, 4],
      }),
    },
    {
      t: 24,
      pose: pose({
        head: [24, 7.5], neck: [24, 12.5],
        eL: [19, 9], hL: [15, 2],
        eR: [29, 9], hR: [33, 2],
      }),
    },
    { t: 30, pose: pose() },
  ],
};
