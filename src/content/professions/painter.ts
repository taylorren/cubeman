import { pose } from '../../render/skeleton';
import type { Action, Profession, Scene } from './types';
import { makeLivingRoom, bedroom, bathroom, rectOutline, idle, sleep, shower, bath } from './shared';

// --- Actions ----------------------------------------------------------------

/**
 * Easel Painting — stand at the easel and dab brush strokes onto the
 * canvas: reach, touch, sweep, step back, then lean in for detail.
 * Snaps to the easel so the strokes always line up with the canvas.
 */
const easelPainting: Action = {
  id: 'easel-painting',
  name: 'Easel Painting',
  room: 'living',
  stand: 30,
  effort: 4,
  anim: {
    dur: 72,
    loop: false,
    keys: [
      { t: 0, pose: pose() },
      // reach toward the canvas with the brush
      {
        t: 8,
        pose: pose({
          head: [25, 8.5], neck: [25, 13.5], hip: [25, 24],
          eR: [29, 15], hR: [33, 12],
          eL: [20, 19], hL: [17, 24],
        }),
      },
      // dab dab — two quick touches
      {
        t: 14,
        pose: pose({
          head: [25, 8.5], neck: [25, 13.5], hip: [25, 24],
          eR: [29, 13], hR: [34, 10],
          eL: [20, 19], hL: [17, 24],
        }),
      },
      {
        t: 20,
        pose: pose({
          head: [25, 8.5], neck: [25, 13.5], hip: [25, 24],
          eR: [30, 16], hR: [34, 14],
          eL: [20, 19], hL: [17, 24],
        }),
      },
      {
        t: 26,
        pose: pose({
          head: [25, 8.5], neck: [25, 13.5], hip: [25, 24],
          eR: [29, 13], hR: [34, 10],
          eL: [20, 19], hL: [17, 24],
        }),
      },
      // step back, tilt head, appraise
      {
        t: 40,
        pose: pose({
          head: [22, 9], neck: [22.5, 14], hip: [23, 24],
          eR: [27, 19], hR: [26, 24],
          eL: [18, 20], hL: [14, 25],
        }),
      },
      {
        t: 50,
        pose: pose({
          head: [22.5, 9.5], neck: [23, 14.5], hip: [23.5, 24],
          eR: [27, 20], hR: [26, 25],
          eL: [18.5, 20], hL: [15, 25],
        }),
      },
      // lean in for the detail stroke
      {
        t: 58,
        pose: pose({
          head: [26, 8], neck: [26, 13], hip: [25.5, 24],
          eR: [30, 12], hR: [34, 9],
          eL: [20, 18], hL: [17, 23],
        }),
      },
      { t: 68, pose: pose() },
      { t: 72, pose: pose() },
    ],
  },
};

/**
 * Splatter — fling the brush arm wide, flinging paint; then look at the
 * mess with delighted surprise, hands on cheeks.
 */
const splatter: Action = {
  id: 'splatter',
  name: 'Splatter',
  room: 'living',
  effort: 5,
  anim: {
    dur: 48,
    loop: false,
    keys: [
      { t: 0, pose: pose() },
      // wind up — arm across the body
      {
        t: 8,
        pose: pose({
          head: [24, 8.5], neck: [24, 13.5],
          eR: [21, 16], hR: [18, 20],
        }),
      },
      // FLING — arm sweeps up and out, body twists
      {
        t: 14,
        pose: pose({
          head: [23, 8], neck: [23, 13], hip: [23.5, 24],
          eR: [29, 10], hR: [34, 5],
          eL: [19, 18], hL: [15, 22],
          kR: [27, 30], fR: [31, 39],
        }),
      },
      // follow-through, arm high
      {
        t: 20,
        pose: pose({
          head: [23, 8], neck: [23, 13], hip: [23.5, 24],
          eR: [28, 8], hR: [31, 3],
          eL: [19, 18], hL: [15, 22],
        }),
      },
      // freeze — look at the mess
      {
        t: 30,
        pose: pose({
          head: [23, 9], neck: [23.5, 14],
          eR: [27, 11], hR: [26, 7],
          eL: [21, 11], hL: [22, 7],
        }),
      },
      // delighted gasp — hop in place
      {
        t: 38,
        pose: pose({
          head: [24, 7], neck: [24, 12], hip: [24, 23],
          kL: [20, 29], fL: [18, 38],
          kR: [28, 29], fR: [30, 38],
          eR: [27, 11], hR: [26, 7],
          eL: [21, 11], hL: [22, 7],
        }),
      },
      { t: 48, pose: pose() },
    ],
  },
};

/**
 * Brush Flourish — twirl the brush overhead in a grand arc, finish with a
 * proud bow to an imaginary gallery audience.
 */
const brushFlourish: Action = {
  id: 'brush-flourish',
  name: 'Brush Flourish',
  room: 'living',
  effort: 3,
  anim: {
    dur: 60,
    loop: false,
    keys: [
      { t: 0, pose: pose() },
      // brush raised, start of the twirl
      {
        t: 8,
        pose: pose({
          head: [24, 8.5], neck: [24, 13.5],
          eR: [28, 10], hR: [30, 5],
          eL: [20, 18], hL: [16, 23],
        }),
      },
      // sweep left overhead
      {
        t: 16,
        pose: pose({
          head: [22.5, 8.5], neck: [23, 13.5], hip: [23, 24],
          eR: [26, 8], hR: [22, 3],
          eL: [19, 18], hL: [15, 23],
        }),
      },
      // sweep right — full arc
      {
        t: 24,
        pose: pose({
          head: [25.5, 8.5], neck: [25, 13.5], hip: [25, 24],
          eR: [29, 9], hR: [33, 4],
          eL: [20, 18], hL: [17, 23],
        }),
      },
      // finish high with a flourish
      {
        t: 30,
        pose: pose({
          head: [24, 8], neck: [24, 13],
          eR: [27, 8], hR: [27, 2],
          eL: [20, 18], hL: [16, 23],
        }),
      },
      // bow — bend at the waist, arm sweeping low
      {
        t: 42,
        pose: pose({
          head: [20, 12], neck: [21, 17], hip: [24, 25],
          kL: [21, 31], fL: [19, 40],
          kR: [27, 31], fR: [29, 40],
          eR: [23, 20], hR: [21, 25],
          eL: [17, 19], hL: [13, 23],
        }),
      },
      { t: 52, pose: pose() },
      { t: 60, pose: pose() },
    ],
  },
};

/**
 * Painter's living room: a sunlit studio. An easel with a canvas on the
 * right, paint pots and a jar of brushes bottom-left, and a window letting
 * in the light. Same arrangement as every profession's hub.
 */
const livingRoom: Scene = makeLivingRoom((ctx, frame) => {
  // floor
  ctx.fillRect(0, 46, 48, 2);

  // === Easel + Canvas (right side, the cubeman stands at x≈30) ===
  // canvas
  rectOutline(ctx, 33, 13, 12, 14);
  // a little painting on the canvas — a sun and hills, slowly "growing"
  const stroke = Math.floor(frame / 90) % 3;
  ctx.fillRect(36, 17, 3, 2); // sun
  if (stroke >= 1) ctx.fillRect(35, 23, 8, 1); // hill line
  if (stroke >= 2) {
    ctx.fillRect(36, 22, 2, 1); // hill bump
    ctx.fillRect(40, 22, 2, 1);
  }
  // easel legs
  ctx.fillRect(33, 27, 1, 18); // left leg
  ctx.fillRect(44, 27, 1, 18); // right leg
  ctx.fillRect(38, 24, 1, 21); // center leg
  // ledge
  ctx.fillRect(31, 27, 16, 1);

  // === Paint pots (bottom-left) ===
  ctx.fillRect(2, 42, 3, 3); // pot 1
  ctx.fillRect(6, 43, 3, 2); // pot 2
  ctx.fillRect(10, 42, 3, 3); // pot 3
  // brush jar
  ctx.fillRect(14, 41, 3, 4);
  ctx.fillRect(15, 38, 1, 3); // brush sticking out

  // === Window (top-left), light beam toward the easel ===
  rectOutline(ctx, 2, 3, 11, 8);
  ctx.fillRect(7, 3, 1, 8); // pane divider
  // shimmering light
  const shimmer = Math.floor(frame / 30) % 2;
  if (shimmer) {
    ctx.fillRect(14, 12, 1, 1);
    ctx.fillRect(16, 14, 1, 1);
    ctx.fillRect(18, 16, 1, 1);
  }
});

export const painter: Profession = {
  id: 'painter',
  name: 'Painter',
  actions: [easelPainting, splatter, brushFlourish, shower, bath],
  idle,
  sleep,
  scenes: [livingRoom, bedroom, bathroom],
};