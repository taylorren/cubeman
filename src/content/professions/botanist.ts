import { pose } from '../../render/skeleton';
import type { Action, BodyOverlay, Profession, Scene } from './types';
import { makeLivingRoom, bedroom, bathroom, rectOutline, idle, sleep, shower, bath, meditation } from './shared';

// --- Body presentation: a woman -------------------------------------------------
//
// The skeleton is a neutral stick figure. Briar's femininity is drawn as a
// persistent BODY layer (the profession's `presentation`), anchored to the
// live `head`/`hip` joints so her bob and A-line dress track every pose —
// idle sway, wandering, actions, even sleep. It's authored in the same 48×48
// body-scale space as the skeleton and reads as a strong silhouette:
// shoulder-length bob with a flower clip, and a waist-fitted skirt that
// flares out over the hips. Legs stay visible below the hem.

/**
 * A little bob: a rounded cap over the dome, bangs across the forehead,
 * shoulder-length side locks, and a flower clip at the temple.
 */
function drawHair(ctx: CanvasRenderingContext2D, hx: number, hy: number): void {
  // crown — a band a touch wider than the bare head dome
  ctx.fillRect(hx - 3, hy - 5, 7, 1);
  ctx.fillRect(hx - 3.5, hy - 4, 8, 2); // mass wrapping the dome (head r≈3.1)
  // bangs across the forehead line
  ctx.fillRect(hx - 3, hy - 1, 6, 1);
  // side locks falling to the shoulders
  ctx.fillRect(hx - 4, hy + 2, 1, 4);
  ctx.fillRect(hx + 3, hy + 2, 1, 4);
  // flower clip at the right temple
  ctx.fillRect(hx + 2, hy - 6, 2, 2);
}

/**
 * A-line dress: a waist-fitted trapezoid from the hips flaring to a hem just
 * above the ankles, so the feet and shins stay visible.
 */
function drawSkirt(ctx: CanvasRenderingContext2D, px: number, py: number): void {
  const hem = Math.min(py + 13, 38);
  const steps = Math.max(1, hem - Math.round(py));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const w = 3 + (8 - 3) * t; // waist 3 → hem 8 (author px)
    ctx.fillRect(Math.round(px - w / 2), Math.round(py + i), Math.round(w), 1);
  }
  // waistband — a snug band so the dress reads as fitted, not a tent
  ctx.fillRect(Math.round(px - 2.5), Math.round(py), 5, 1);
}

const presentation: BodyOverlay = (ctx, _frame, s) => {
  // the silhouette is pose-driven — `frame` is part of the signature but unused.
  drawHair(ctx, s.head[0], s.head[1]);
  drawSkirt(ctx, s.hip[0], s.hip[1]);
};

// --- Actions --------------------------------------------------------------------

/**
 * Water the Beds — raise the watering can, tilt it toward the planter bed on
 * the right, and rain a curtain of droplets over the tulips.
 */
const water: Action = {
  id: 'water-beds',
  name: 'Water the Beds',
  room: 'living',
  effort: 2,
  anim: {
    dur: 72,
    loop: false,
    keys: [
      { t: 0, pose: pose() },
      // raise the can: right arm up and out, head toward the planter
      {
        t: 10,
        pose: pose({
          head: [25, 8.5], neck: [25, 13.5], hip: [25, 24],
          eR: [30, 12], hR: [33, 8],
          eL: [20, 18], hL: [16, 23],
        }),
      },
      // tilt to pour
      {
        t: 20,
        pose: pose({
          head: [26, 9], neck: [26, 14], hip: [25.5, 24],
          eR: [31, 14], hR: [34, 10],
          eL: [20, 18], hL: [16, 23],
        }),
      },
      // hold the pour (droplets fall in the front overlay, frames 20..46)
      {
        t: 24,
        pose: pose({
          head: [26, 9], neck: [26, 14], hip: [25.5, 24],
          eR: [31, 14], hR: [34, 10],
        }),
      },
      {
        t: 44,
        pose: pose({
          head: [26, 9], neck: [26, 14], hip: [25.5, 24],
          eR: [31, 14], hR: [34, 10],
        }),
      },
      // lift the can back upright
      {
        t: 54,
        pose: pose({
          head: [25, 8.5], neck: [25, 13.5],
          eR: [30, 12], hR: [33, 8],
        }),
      },
      { t: 64, pose: pose() },
      { t: 72, pose: pose() },
    ],
  },
  front: (ctx, frame) => {
    if (frame < 20 || frame > 44) return;
    // droplets arcing from the can toward the planter bed (x33–45)
    for (const dx of [0, 2, 4, 6]) {
      const y = 33 + ((frame + dx * 4) % 9) + dx;
      if (y < 44) ctx.fillRect(35 + dx, y, 1, 1);
    }
  },
};

/**
 * Snip-a-Snap — reach to a hanging bloom, snip it with a practiced clip, and
 * present the rose to whoever is watching.
 */
const snip: Action = {
  id: 'snip-a-snap',
  name: 'Snip-a-Snap',
  room: 'living',
  effort: 3,
  anim: {
    dur: 66,
    loop: false,
    keys: [
      { t: 0, pose: pose() },
      // reach up-right toward the bloom
      {
        t: 10,
        pose: pose({
          head: [25, 8], neck: [25, 13],
          eR: [30, 10], hR: [34, 5],
          eL: [20, 18], hL: [16, 23],
        }),
      },
      // the snip — a sharp little pinch
      {
        t: 17,
        pose: pose({
          head: [25, 8], neck: [25, 13],
          eR: [30, 11], hR: [33, 8],
        }),
      },
      { t: 24, pose: pose({ eR: [30, 11], hR: [33, 8] }) },
      // pluck — hand closes and draws the bloom down to her middle
      {
        t: 38,
        pose: pose({
          head: [24, 8], neck: [24, 13],
          eR: [28, 13], hR: [26, 16],
        }),
      },
      // present it (front overlay shows the rose at her hand)
      {
        t: 50,
        pose: pose({
          head: [24, 7.5], neck: [24, 12.5],
          eR: [26, 11], hR: [22, 10],
        }),
      },
      { t: 60, pose: pose() },
      { t: 66, pose: pose() },
    ],
  },
  front: (ctx, frame) => {
    if (frame < 40 || frame > 62) return;
    // a rose held up at the presented hand (around screen x22, y24)
    ctx.fillRect(21, 23, 3, 3); // bloom
    ctx.fillRect(22, 26, 1, 2); // stem
  },
};

/** Morning Sun — arms up in a Y toward the window sun, a gentle sway, then settle. */
const sunrise: Action = {
  id: 'morning-sun',
  name: 'Morning Sun',
  room: 'living',
  effort: 4,
  anim: {
    dur: 78,
    loop: false,
    keys: [
      { t: 0, pose: pose() },
      // arms rise to a Y
      {
        t: 12,
        pose: pose({
          head: [24, 8], neck: [24, 13], hip: [24, 23.5],
          eL: [19, 9], hL: [15, 4], eR: [29, 9], hR: [33, 4],
        }),
      },
      // reach tall, up onto tiptoes
      {
        t: 24,
        pose: pose({
          head: [24, 7], neck: [24, 12], hip: [24, 23],
          eL: [18, 8], hL: [14, 3], eR: [30, 8], hR: [34, 3],
          kL: [20, 32], fL: [20, 40], kR: [27, 32], fR: [28, 40],
        }),
      },
      // sway toward the sun (right)
      {
        t: 40,
        pose: pose({
          head: [25, 7.5], neck: [25, 12.5], hip: [25, 23.5],
          eL: [19, 9], hL: [15, 5], eR: [31, 9], hR: [35, 5],
        }),
      },
      // sway back (left)
      {
        t: 56,
        pose: pose({
          head: [23, 7.5], neck: [23, 12.5], hip: [23, 23.5],
          eL: [17, 9], hL: [13, 5], eR: [29, 9], hR: [33, 5],
        }),
      },
      // settle, arms down
      { t: 70, pose: pose() },
      { t: 78, pose: pose() },
    ],
  },
};

// --- The greenhouse (living room) -------------------------------------------------

/**
 * Superbloom — SECRET action, fired only by the hidden button combo on
 * Briar's cube (LEFT → LEFT → RIGHT → MIDDLE → RIGHT within 3s). She crouches into
 * soil, then throws her arms wide as a ring of blooms surges up around her
 * and petals swirl into the air. Stays put — no transformation — and the
 * blooms mark the spot where she drew them up.
 */
const superbloom: Action = {
  id: 'superbloom',
  name: 'Superbloom',
  secret: true,
  unlock: 'secret-garden',
  // Harder combo: LEFT → LEFT → RIGHT → MIDDLE → RIGHT within 3s. Five presses
  // with a left-double and a right bookend — no intuitive sweep to stumble into.
  combo: ['0', '0', '1', 'random', '1'],
  comboWindow: 3000,
  effort: 5,
  anim: {
    dur: 88,
    loop: false,
    keys: [
      { t: 0, pose: pose() },
      // crouch into the soil, hands low
      {
        t: 12,
        pose: pose({
          head: [24, 12], neck: [24, 17], hip: [24, 27],
          kL: [20, 32], fL: [18, 40], kR: [28, 32], fR: [30, 40],
          eL: [20, 26], hL: [18, 33], eR: [28, 26], hR: [30, 33],
        }),
      },
      // hands press into the ground — the seed
      {
        t: 22,
        pose: pose({
          head: [24, 13], neck: [24, 18], hip: [24, 27.5],
          kL: [20, 32], fL: [18, 40], kR: [28, 32], fR: [30, 40],
          eL: [22, 24], hL: [22, 28], eR: [26, 24], hR: [26, 28],
        }),
      },
      // arms sweep wide and up — the bloom follows in the front overlay
      {
        t: 34,
        pose: pose({
          head: [24, 8], neck: [24, 13], hip: [24, 25],
          eL: [18, 10], hL: [13, 6], eR: [30, 10], hR: [35, 6],
          kL: [20, 32], fL: [19, 40], kR: [28, 32], fR: [29, 40],
        }),
      },
      // hold the showcase, petals swirling
      {
        t: 48,
        pose: pose({
          head: [24, 7.5], neck: [24, 12.5], hip: [24, 24.5],
          eL: [18, 9], hL: [12, 5], eR: [30, 9], hR: [36, 5],
        }),
      },
      {
        t: 62,
        pose: pose({
          head: [24, 7.5], neck: [24, 12.5],
          eL: [18, 9], hL: [12, 5], eR: [30, 9], hR: [36, 5],
        }),
      },
      // gentle settle
      {
        t: 76,
        pose: pose({
          eL: [20, 18], hL: [16, 23], eR: [28, 18], hR: [32, 23],
        }),
      },
      { t: 88, pose: pose() },
    ],
  },
  front(ctx, frame) {
    // Ring of blooms surging up around her once the arms sweep wide
    // (frames 30+): short stems along the floor with heads that pop.
    if (frame < 30) return;
    const grow = Math.min(1, (frame - 30) / 26); // 0..1 bloom-in
    const sway = Math.floor(frame / 10) % 2;
    for (let i = 0; i < 5; i++) {
      const bx = 6 + i * 9;
      const stem = Math.round(3 + grow * 5);
      ctx.fillRect(bx, 44 - stem, 1, stem); // stem
      const top = 43 - stem;
      ctx.fillRect(bx - 1 + sway, top, 2, 2); // bloom head
    }
    // a few petals drifting higher (frames 40..82)
    if (frame > 40 && frame < 82) {
      const p = (frame - 40) / 42;
      for (let i = 0; i < 3; i++) {
        const px = 10 + ((frame + i * 9) % 20);
        const py = Math.round(30 - p * 10 - i);
        ctx.fillRect(px, py, 1, 1);
      }
    }
  },
};

// --- The greenhouse (living room) -------------------------------------------------

/**
 * Briar's living room: a quiet greenhouse. A row of tulips nods in a raised
 * planter on the right, a potted sprout and watering can sit on the left,
 * hanging vines drape the top, and a sun watches from the window.
 */
const livingRoom: Scene = makeLivingRoom((ctx, frame) => {
  ctx.fillRect(0, 46, 48, 2); // floor

  // === hanging vine leaves along the top ===
  for (const x of [4, 10, 16, 22, 28, 34, 40, 44]) {
    ctx.fillRect(x, 3, 2, 2);
  }
  ctx.fillRect(1, 4, 1, 5);   // a swooping tendril on the left
  ctx.fillRect(0, 8, 1, 1);

  // === window with the sun (top-left, softly pulsing) ===
  rectOutline(ctx, 5, 5, 8, 8);
  if (Math.floor(frame / 30) % 2 === 0) ctx.fillRect(7, 7, 3, 3); // warm core

  // === watering can + potted sprout (floor, left) ===
  ctx.fillRect(6, 41, 4, 4);  // can body
  ctx.fillRect(5, 40, 1, 1);  // handle
  ctx.fillRect(10, 40, 2, 1); // spout
  rectOutline(ctx, 14, 40, 6, 4); // pot
  ctx.fillRect(16, 36, 1, 4); // stem
  ctx.fillRect(15, 35, 3, 1); // first leaves

  // === raised planter bed (right) with a row of nodding tulips ===
  ctx.fillRect(32, 40, 14, 5); // bed body
  ctx.fillRect(32, 39, 14, 1); // soil line
  const sway = Math.floor(frame / 36) % 2;
  for (let i = 0; i < 4; i++) {
    const sx = 34 + i * 3;
    ctx.fillRect(sx, 38, 1, 2); // stem
    ctx.fillRect(sx - (i % 2) + sway, 35, 2, 3); // tulip head nods
  }
});

export const botanist: Profession = {
  id: 'botanist',
  name: 'Botanist',
  gender: 'lady',
  maxStamina: 120,
  presentation,
  actions: [water, snip, sunrise, superbloom, shower, bath, meditation],
  idle,
  sleep,
  scenes: [livingRoom, bedroom, bathroom],
};