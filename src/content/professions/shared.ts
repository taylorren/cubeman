import type { Action, Scene } from './types';
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
export function rectOutline(
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
 * The SHARED living-room arrangement. Every profession's hub room has the
 * same id and the same edges — same toy layout, same way to reach the
 * bedroom and neighbor cubes — but each profession supplies its OWN ambience
 * draw, so the room reads differently (Stickman: cozy window & plant;
 * Dancer: a little studio), while the underlying arrangement never changes.
 * Pass the profession's draw and you get a Scene with the fixed topology.
 */
export function makeLivingRoom(draw: Scene['draw']): Scene {
  return {
    id: 'living',
    name: 'Living room',
    left: { kind: 'neighbor', dir: 'left' },
    right: { kind: 'scene', id: 'bedroom' },
    up: { kind: 'neighbor', dir: 'up' },
    down: { kind: 'neighbor', dir: 'down' },
    draw,
  };
}

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
  up: { kind: 'wall' },
  down: { kind: 'wall' },
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
  up: { kind: 'wall' },
  down: { kind: 'wall' },
  solids: [[26, 46]], // the tub
  draw(ctx, frame) {
    ctx.fillRect(0, 46, 48, 2); // floor

    // Ceiling-mounted 花洒, horizontally centered over the bath mat below
    // (mat spans x8–16, so the head sits at x12): a straight pipe drops to a
    // wide flat head. It is the SINGLE fixture up here — the falling water is
    // drawn on the Shower action's front overlay, streaming straight off the
    // face and raining down onto the mat/standing spot below.
    ctx.fillRect(11, 1, 2, 5); // pipe from the ceiling (center x12)
    ctx.fillRect(9, 6, 6, 3); // 花洒 head (wide flat face, center x12)
    ctx.fillRect(11, 9, 2, 1); // lip the drops roll off

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

// --- Bathroom actions: shower & bath -----------------------------------------
// Shared by every profession (there's a bathroom in every cube). Both are
// room-locked: they only run in the bathroom (see `room` on Action) — pressing
// them elsewhere is a no-op, so the toy "showers" only in the tub.

/** Standing right below the showerhead under running water: arms raised,
 *  gentle bobbing, and an animated stream drawn OVER him. */
export const shower: Action = {
  id: 'shower',
  name: 'Shower',
  effort: 4,
  room: 'bathroom',
  stand: 12,
  /** Recover while under the running water — ~sleep's rate (4/s). */
  regen: 4 / 30,
  front: (ctx, frame) => {
    // Falling water from the spout (y≈10) down to his head/shoulders (~y26).
    // Droplets fall in a staggered cadence over the head's columns (x11–13);
    // over his dark body they merge silently, beside it they read as the
    // running stream.
    for (let i = 0; i < 4; i++) {
      const drop = (frame + i * 6) % 18;
      const x = 11 + (i % 3);
      const y = 11 + drop;
      if (y < 26) {
        ctx.fillRect(x, y, 1, 2);
        // a second, shorter droplet a few px below so the streak looks continuous
        const y2 = y + 6;
        if (y2 < 26) ctx.fillRect(x === 11 ? 13 : 11, y2, 1, 2);
      }
    }
  },
  anim: {
    dur: 48,
    loop: false,
    keys: [
      { t: 0, pose: pose() },
      // reach up, then stay under the stream with a little sway
      {
        t: 4,
        pose: pose({
          head: [24, 6], neck: [24, 11],
          eL: [19, 9], hL: [15, 3], eR: [29, 9], hR: [33, 3],
        }),
      },
      {
        t: 12,
        pose: pose({
          head: [24, 5.6], neck: [24, 10.6],
          eL: [19, 9], hL: [14, 2], eR: [29, 9], hR: [34, 2],
        }),
      },
      {
        t: 20,
        pose: pose({
          head: [24, 6], neck: [24, 11],
          eL: [19, 9], hL: [15, 3], eR: [29, 9], hR: [33, 3],
        }),
      },
      {
        t: 28,
        pose: pose({
          head: [24.4, 5.8], neck: [24.4, 10.8],
          eL: [19, 9], hL: [15, 3], eR: [29, 9], hR: [33, 3],
        }),
      },
      {
        t: 36,
        pose: pose({
          head: [24, 5.5], neck: [24, 10.5],
          eL: [19, 9], hL: [14, 2], eR: [29, 9], hR: [34, 2],
        }),
      },
      {
        t: 42,
        pose: pose({
          head: [24, 7], neck: [24, 12],
          eL: [19, 11], hL: [15, 6], eR: [29, 11], hR: [33, 6],
        }),
      },
      { t: 48, pose: pose() },
    ],
  },
};

/** Seated IN the tub: splash, then settle. The tub's near wall + water surface
 *  are drawn OVER him so only his head and arms peek above — reads as bathing. */

// Soak poses: seated pulled-down (contact), arms resting, and a couple of
// relaxed breathing variants so the long bath reads as settling in, not stuck.
const tubSeated = pose({
  head: [24, 13], neck: [24, 18], hip: [24, 27],
  kL: [21, 34], fL: [20, 40], kR: [27, 34], fR: [28, 40],
});
const tubArms = pose({
  head: [24, 12], neck: [24, 17], hip: [24, 28],
  kL: [21, 34], fL: [20, 40], kR: [27, 34], fR: [28, 40],
  eL: [18, 16], hL: [14, 12], eR: [30, 16], hR: [34, 12],
});
const tubSplashDown = pose({
  head: [24, 12.5], neck: [24, 17.5], hip: [24, 28],
  kL: [21, 34], fL: [20, 40], kR: [27, 34], fR: [28, 40],
  eL: [17, 20], hL: [13, 26], eR: [31, 20], hR: [35, 26],
});
const tubSplashUp = pose({
  head: [24, 12], neck: [24, 17], hip: [24, 28],
  kL: [21, 34], fL: [20, 40], kR: [27, 34], fR: [28, 40],
  eL: [18, 16], hL: [13, 14], eR: [30, 16], hR: [35, 14],
});
const tubRelax = pose({
  head: [24, 13], neck: [24, 18], hip: [24, 28],
  kL: [21, 34], fL: [20, 40], kR: [27, 34], fR: [28, 40],
  eL: [20, 22], hL: [18, 27], eR: [28, 22], hR: [30, 27],
});
const tubRelaxSoft = pose({
  // breathing out — head and shoulders settle a touch deeper
  head: [24, 13.4], neck: [24, 18.4], hip: [24, 28.5],
  kL: [21, 34], fL: [20, 40], kR: [27, 34], fR: [28, 40],
  eL: [20, 22], hL: [17, 27], eR: [28, 22], hR: [31, 27],
});
const tubRise = pose({
  head: [24, 11], neck: [24, 16], hip: [24, 28],
  kL: [21, 34], fL: [20, 40], kR: [27, 34], fR: [28, 40],
  eL: [20, 19], hL: [16, 22], eR: [28, 19], hR: [32, 22],
});

export const bath: Action = {
  id: 'bath',
  name: 'Bath',
  effort: 3,
  room: 'bathroom',
  /** A soak is more restorative than a shower — recovers ~8/s while immersed. */
  regen: 8 / 30,
  stand: 35,
  front: (ctx, frame) => {
    // The tub's NEAR wall sinks the bather below the water line (only his head
    // and arms stay above it). Instead of one solid black slab, the submerged
    // region reads as a MOSAIC of ceramic tiles — and it's ALIVE: the surface
    // line ripples, a glint of light cascades across the tiling (like sun on
    // water), and suds keep rising. A dark fill carved into small LCD tiles by
    // thin white grout lines frames the bather rather than masking him.
    const x0 = 29; // tub opening's left edge (tub lives on the right, x26-46)
    const x1 = 45;
    const bottom = 45;
    // gentle breathing of the waterline — sways a pixel up and back
    const ripple = (frame % 10) < 5 ? 1 : 0;
    const waterY = 33 + ripple;
    ctx.fillStyle = '#000';
    ctx.fillRect(x0, waterY, x1 - x0 + 1, bottom - waterY + 1);
    // carve staggered ceramic tiles with white grout (running-bond mosaic)
    ctx.fillStyle = '#fff';
    for (let y = waterY + 2, row = 0; y <= bottom; y += 4, row++) {
      ctx.fillRect(x0, y, x1 - x0 + 1, 1); // grout line under this course
      const off = (row % 2) * 2; // run a half-tile over on alternating courses
      for (let gx = x0 + 2 + off; gx < x1; gx += 4) {
        ctx.fillRect(gx, y, 1, Math.min(4, bottom - y + 1)); // vertical seam
      }
    }
    // a glinting tile sweeps across each course, then drops to the next — a
    // shimmer of light travelling down the tiling (water over the mosaic).
    ctx.fillStyle = '#fff';
    const t = frame % 120;
    const row = Math.floor(t / 24); // which course the glint is on (0..4)
    const sweep = (t % 24) / 24; // 0→1 across the row
    const gy = Math.min(bottom - 1, waterY + 2 + row * 4);
    const gx2 = Math.floor(x0 + 1 + sweep * (x1 - x0 - 4));
    ctx.fillRect(gx2, gy, 2, 1); // one lit tile
    ctx.fillStyle = '#000';
    // rising suds just above the surface
    const cycle = frame % 60;
    for (let i = 0; i < 3; i++) {
      const p = ((cycle / 60) + i * 0.33) % 1;
      if (p > 0.7) continue;
      const bx = 33 + i * 3;
      const by = waterY - 2 - Math.round(p * 5);
      ctx.fillRect(bx, by, 1, 1);
      ctx.fillRect(bx + 1, by, 1, 1);
    }
  },
  anim: {
    dur: 96,
    loop: false,
    keys: [
      // climb into the tub and sit
      { t: 0, pose: tubSeated },
      { t: 8, pose: tubArms },
      // splash down
      { t: 16, pose: tubSplashDown },
      // splash up again
      { t: 24, pose: tubSplashUp },
      // relax — settle in for a long soak (breathing gently)
      { t: 32, pose: tubRelax },
      { t: 40, pose: tubRelaxSoft },
      { t: 48, pose: tubRelax },
      { t: 56, pose: tubRelaxSoft },
      { t: 64, pose: tubRelax },
      { t: 72, pose: tubRelaxSoft },
      { t: 80, pose: tubRelax },
      // start to rise out of the water
      { t: 88, pose: tubRise },
      // stand up, done
      { t: 96, pose: pose() },
    ],
  },
};

// --- Social gestures (coordinated pair behaviors during a visit) --------------
// Played by BOTH cubemen at once (the VisitSession dispatches a shared beat),
// so they read as chatting / waving at each other. Authored at x=24 like all
// poses; each player shifts by its own position.

/** Talk face-to-face: nod left and right with a "talking" hand. */
export const chat: Anim = {
  dur: 30,
  loop: false,
  keys: [
    { t: 0, pose: pose() },
    {
      t: 8,
      pose: pose({
        head: [25.5, 8.5], neck: [25.5, 13.5],
        eR: [29, 10], hR: [32.5, 6],
      }),
    },
    {
      t: 16,
      pose: pose({
        head: [22.5, 8.5], neck: [22.5, 13.5],
        eL: [19, 10], hL: [15.5, 6],
      }),
    },
    {
      t: 24,
      pose: pose({
        head: [24, 9], neck: [24, 14],
        eR: [29, 10], hR: [33, 6],
      }),
    },
    { t: 30, pose: pose() },
  ],
};

/** A friendly wave hello/goodbye, one arm up and swaying. */
export const wave: Anim = {
  dur: 28,
  loop: false,
  keys: [
    { t: 0, pose: pose() },
    { t: 5, pose: pose({ eR: [27, 10], hR: [30, 5] }) },
    { t: 10, pose: pose({ eR: [27, 10], hR: [33, 6] }) },
    { t: 15, pose: pose({ eR: [27, 10], hR: [30, 6] }) },
    { t: 20, pose: pose({ eR: [28, 10], hR: [31, 5] }) },
    { t: 28, pose: pose() },
  ],
};

/** Face-to-face greeting: both look at each other, wave, and nod hello. */
export const greeting: Anim = {
  dur: 36,
  loop: false,
  keys: [
    { t: 0, pose: pose() },
    // look up (toward the other), arm rising
    {
      t: 6,
      pose: pose({
        head: [25, 8.5], neck: [25, 13.5],
        eR: [27, 12], hR: [29, 7],
      }),
    },
    // wave sway
    { t: 12, pose: pose({ eR: [27, 11], hR: [31, 6] }) },
    { t: 18, pose: pose({ eR: [27, 11], hR: [29, 7] }) },
    // nod + slight bow
    {
      t: 24,
      pose: pose({
        head: [24.5, 10], neck: [24.5, 14.5], hip: [24.5, 24.5],
        eR: [28, 12], hR: [30, 8],
      }),
    },
    { t: 36, pose: pose() },
  ],
};

/** A playful kick — one leg swings forward (used during shared ball play). */
export const kick: Anim = {
  dur: 24,
  loop: false,
  keys: [
    { t: 0, pose: pose() },
    // wind up
    {
      t: 5,
      pose: pose({
        head: [23.5, 9], neck: [23.5, 14], hip: [23.5, 24],
        kR: [29, 31], fR: [32, 38],
      }),
    },
    // kick forward
    {
      t: 11,
      pose: pose({
        head: [23, 8.5], neck: [23, 13.5], hip: [23, 24],
        kL: [20, 32], fL: [19, 40],
        kR: [26, 28], fR: [33, 22],
        eL: [19, 18], hL: [16, 23],
      }),
    },
    // recover
    {
      t: 17,
      pose: pose({
        head: [23.5, 9], neck: [23.5, 14], hip: [23.5, 24],
        kR: [28, 32], fR: [29, 40],
      }),
    },
    { t: 24, pose: pose() },
  ],
};

// --- Climb (up/down ladder transition) -------------------------------------
// The cubeman reaches up, pulls up, and steps onto the neighbor cube above
// (or lowers down to the cube below).

/** Stretch up to grab a ladder rung. Loops while climbing (reaches, pulls,
 *  releases — one cycle per rung) as the pose slides vertically. */
export const climbUp: Anim = {
  dur: 30,
  loop: true,
  keys: [
    { t: 0, pose: pose() },
    // reach up
    {
      t: 8,
      pose: pose({
        head: [24, 6], neck: [24, 11], hip: [24, 24],
        eL: [18, 9], hL: [15, 6],
        kL: [20, 33], fL: [19, 40],
        kR: [27, 33], fR: [29, 40],
      }),
    },
    // pull up onto tiptoes
    {
      t: 16,
      pose: pose({
        head: [24, 6], neck: [24, 10], hip: [24, 23],
        eR: [30, 9], hR: [33, 5],
        kL: [20, 33], fL: [20, 40],
        kR: [28, 33], fR: [30, 40],
      }),
    },
    { t: 30, pose: pose() },
  ],
};

/** Reach down and step off a ladder to the cube below. Loops while climbing
 *  down (reaches, steps, recovers) as the pose slides vertically. */
export const climbDown: Anim = {
  dur: 28,
  loop: true,
  keys: [
    { t: 0, pose: pose() },
    // reach down
    {
      t: 7,
      pose: pose({
        head: [24, 10], neck: [24, 15], hip: [24, 25],
        eR: [28, 18], hR: [30, 23],
        kL: [21, 32], fL: [20, 40],
        kR: [27, 32], fR: [29, 40],
      }),
    },
    // step down
    {
      t: 16,
      pose: pose({
        head: [24, 9], neck: [24, 14], hip: [24, 25],
        eR: [29, 18], hR: [31, 22],
        kL: [20, 33], fL: [19, 40],
        kR: [28, 33], fR: [30, 40],
      }),
    },
    { t: 28, pose: pose() },
  ],
};
