import { pose } from '../../render/skeleton';
import type { Action, Profession, Scene } from './types';
import { makeLivingRoom, bedroom, bathroom, rectOutline, idle, sleep, shower, bath } from './shared';

// --- Actions ----------------------------------------------------------------

/**
 * Wand Wave — flick the wand in a figure-eight, end with a grand point.
 */
const wandWave: Action = {
  id: 'wand-wave',
  name: 'Wand Wave',
  room: 'living',
  effort: 3,
  anim: {
    dur: 60,
    loop: false,
    keys: [
      { t: 0, pose: pose() },
      // wand raised
      {
        t: 8,
        pose: pose({
          head: [24, 8], neck: [24, 13],
          eR: [27, 9], hR: [29, 4],
          eL: [20, 18], hL: [16, 23],
        }),
      },
      // figure-eight: sweep left
      {
        t: 16,
        pose: pose({
          head: [22.5, 8], neck: [23, 13],
          eR: [26, 8], hR: [23, 3],
          eL: [19, 18], hL: [15, 23],
        }),
      },
      // sweep right
      {
        t: 24,
        pose: pose({
          head: [25.5, 8], neck: [25, 13], hip: [24.5, 24],
          eR: [29, 9], hR: [33, 4],
          eL: [20, 18], hL: [17, 23],
        }),
      },
      // dip through the middle
      {
        t: 32,
        pose: pose({
          head: [24, 8.5], neck: [24, 13.5],
          eR: [27, 12], hR: [25, 8],
          eL: [20, 18], hL: [16, 23],
        }),
      },
      // grand point at the sky
      {
        t: 42,
        pose: pose({
          head: [24, 7.5], neck: [24, 12.5],
          eR: [27, 8], hR: [30, 2],
          eL: [20, 18], hL: [16, 23],
        }),
      },
      // bow
      {
        t: 52,
        pose: pose({
          head: [21, 11], neck: [22, 16], hip: [24, 24.5],
          eR: [26, 18], hR: [24, 23],
          eL: [18, 19], hL: [14, 23],
        }),
      },
      { t: 60, pose: pose() },
    ],
  },
};

/**
 * Rabbit Hat — reach into the top hat (deep, deep...), and pull out a
 * rabbit that certainly was not there before.
 */
const rabbitHat: Action = {
  id: 'rabbit-hat',
  name: 'Rabbit Hat',
  room: 'living',
  stand: 34,
  effort: 4,
  anim: {
    dur: 84,
    loop: false,
    keys: [
      { t: 0, pose: pose() },
      // show the hat around
      {
        t: 10,
        pose: pose({
          head: [25, 8.5], neck: [25, 13.5],
          eR: [29, 16], hR: [33, 13],
          eL: [20, 18], hL: [16, 23],
        }),
      },
      // reach in — arm buried to the elbow
      {
        t: 24,
        pose: pose({
          head: [26, 9], neck: [26, 14], hip: [25, 24],
          eR: [30, 15], hR: [33, 17],
          eL: [20, 18], hL: [16, 23],
        }),
      },
      // dig deeper... wiggle...
      {
        t: 36,
        pose: pose({
          head: [26.5, 9.5], neck: [26, 14.5], hip: [25, 24],
          eR: [30, 16], hR: [33, 19],
          eL: [20, 18], hL: [16, 23],
        }),
      },
      // PULL — rabbit up high!
      {
        t: 52,
        pose: pose({
          head: [25, 7.5], neck: [25, 12.5],
          eR: [28, 8], hR: [30, 1],
          eL: [20, 18], hL: [16, 23],
        }),
      },
      // present it to the audience
      {
        t: 66,
        pose: pose({
          head: [24, 8.5], neck: [24, 13.5],
          eR: [28, 14], hR: [31, 10],
          eL: [20, 18], hL: [16, 23],
        }),
      },
      { t: 84, pose: pose() },
    ],
  },
  /** Front overlay: the rabbit rises out of the hat on the table at pull time. */
  front(ctx, frame) {
    if (frame < 40 || frame > 70) return;
    const t = (frame - 40) / 30; // 0..1
    const y = Math.round(24 - t * 12); // rises with the hand
    const x = 32;
    // the rabbit: ears, head, body
    ctx.fillRect(x + 1, y, 1, 3); // ear 1
    ctx.fillRect(x + 4, y, 1, 3); // ear 2
    ctx.fillRect(x, y + 3, 6, 3); // head
    ctx.fillRect(x + 1, y + 6, 4, 2); // body
  },
};

/**
 * Levitation — rise off the floor, hang there moon-walking the arms, and
 * settle back down like nothing happened.
 */
const levitate: Action = {
  id: 'levitate',
  name: 'Levitation',
  room: 'living',
  effort: 5,
  anim: {
    dur: 96,
    loop: false,
    keys: [
      { t: 0, pose: pose() },
      // mystical arm sweep
      {
        t: 10,
        pose: pose({
          head: [24, 8.5], neck: [24, 13.5],
          eR: [28, 14], hR: [31, 10],
          eL: [20, 14], hL: [17, 10],
        }),
      },
      // LIFT OFF the ground (whole pose shifted up, toes pointed)
      {
        t: 26,
        pose: pose({
          head: [24, 5], neck: [24, 10], hip: [24, 20.5],
          kL: [21, 25], fL: [21, 34], kR: [27, 25], fR: [27, 34],
          eL: [20, 15], hL: [16, 19], eR: [28, 15], hR: [32, 19],
        }),
      },
      // hang there — arms wide, serene
      {
        t: 44,
        pose: pose({
          head: [24, 4.5], neck: [24, 9.5], hip: [24, 20],
          kL: [21, 24.5], fL: [21, 33.5], kR: [27, 24.5], fR: [27, 33.5],
          eL: [19, 12], hL: [15, 16], eR: [29, 12], hR: [33, 16],
        }),
      },
      // drift sideways a touch
      {
        t: 60,
        pose: pose({
          head: [25, 4.5], neck: [25, 9.5], hip: [25, 20],
          kL: [22, 24.5], fL: [22, 33.5], kR: [28, 24.5], fR: [28, 33.5],
          eL: [20, 12], hL: [16, 16], eR: [30, 12], hR: [34, 16],
        }),
      },
      // settle back down
      {
        t: 78,
        pose: pose({
          head: [24, 7], neck: [24, 12], hip: [24, 22.5],
          kL: [21, 27], fL: [21, 37], kR: [27, 27], fR: [27, 37],
          eL: [20, 17], hL: [16, 22], eR: [28, 17], hR: [32, 22],
        }),
      },
      { t: 96, pose: pose() },
    ],
  },
};

/**
 * The Magician's living room: a small stage. Velvet curtains frame the
 * sides, a table with a top hat stands on the right, playing cards float
 * in the air, and a full moon watches from the window. Same arrangement as
 * every profession's hub.
 */
const livingRoom: Scene = makeLivingRoom((ctx, frame) => {
  // floor
  ctx.fillRect(0, 46, 48, 2);

  // === Velvet curtains (both sides, gently swaying) ===
  for (const side of [0, 1]) {
    const x0 = side === 0 ? 0 : 45;
    ctx.fillRect(x0, 2, 3, 44); // drape
    // scalloped inner edge that shifts with the sway
    const sway = Math.floor(frame / 40) % 2;
    const inner = side === 0 ? 3 : 44;
    for (let y = 4; y < 44; y += 6) {
      ctx.fillRect(inner, y + (sway ? 1 : 0), 1, 4);
    }
  }
  // curtain rod
  ctx.fillRect(0, 1, 48, 1);

  // === Table + top hat (right side; the cubeman stands at x≈34) ===
  ctx.fillRect(30, 34, 16, 1); // tabletop
  ctx.fillRect(31, 35, 1, 11); // table legs
  ctx.fillRect(44, 35, 1, 11);
  rectOutline(ctx, 34, 29, 7, 5); // the top hat
  ctx.fillRect(33, 33, 9, 1); // hat brim

  // === Floating playing cards (center-top, lazy spiral) ===
  const cards: Array<[number, number]> = [
    [17, 8], [22, 5], [27, 9],
  ];
  for (let i = 0; i < cards.length; i++) {
    const bob = Math.floor((frame + i * 30) / 24) % 2;
    rectOutline(ctx, cards[i]![0], cards[i]![1] + bob, 3, 4);
  }

  // === Full moon in the window (top-left) ===
  rectOutline(ctx, 4, 4, 9, 9);
  ctx.fillRect(7, 7, 4, 4); // moon face
  // a slow wink of moonlight
  if (Math.floor(frame / 50) % 2 === 0) ctx.fillRect(8, 12, 2, 1);

  // === Wand + rose on the floor (bottom-left) ===
  ctx.fillRect(4, 44, 6, 1); // wand
  ctx.fillRect(12, 43, 1, 3); // rose stem
  ctx.fillRect(11, 42, 3, 1); // rose bloom
});

export const magician: Profession = {
  id: 'magician',
  name: 'Magician',
  actions: [wandWave, rabbitHat, levitate, shower, bath],
  idle,
  sleep,
  scenes: [livingRoom, bedroom, bathroom],
};
