import { pose } from '../../render/skeleton';
import type { Action, Profession, Scene } from './types';
import { makeLivingRoom, bedroom, bathroom, rectOutline, idle, sleep, shower, bath, meditation, bedroomActions } from './shared';

// --- Actions ----------------------------------------------------------------

/**
 * Stargazing — lean to the telescope eyepiece, tweak the focus wheel,
 * nudge the tube, peer again. Snaps to the telescope so the eyepiece
 * always lines up.
 */
const stargazing: Action = {
  id: 'stargazing',
  name: 'Stargazing',
  room: 'living',
  stand: 30,
  effort: 4,
  anim: {
    dur: 72,
    loop: false,
    keys: [
      { t: 0, pose: pose() },
      // bend to the eyepiece
      {
        t: 8,
        pose: pose({
          head: [27, 10], neck: [26, 14.5], hip: [24, 24],
          eR: [29, 17], hR: [31, 13],
          eL: [21, 19], hL: [18, 24],
        }),
      },
      // peer... reach up to the focus wheel
      {
        t: 18,
        pose: pose({
          head: [26.5, 9], neck: [26, 13.5], hip: [24.5, 24],
          eR: [30, 12], hR: [32, 8],
          eL: [21, 18], hL: [18, 23],
        }),
      },
      // tweak tweak
      {
        t: 26,
        pose: pose({
          head: [26.5, 9], neck: [26, 13.5], hip: [24.5, 24],
          eR: [30, 11], hR: [33, 9],
          eL: [21, 18], hL: [18, 23],
        }),
      },
      // back to the eyepiece
      {
        t: 34,
        pose: pose({
          head: [27, 10], neck: [26, 14.5], hip: [24, 24],
          eR: [29, 17], hR: [31, 13],
          eL: [21, 19], hL: [18, 24],
        }),
      },
      // step back, tilt head up, nod approvingly
      {
        t: 50,
        pose: pose({
          head: [22.5, 8], neck: [23, 13.5], hip: [23.5, 24],
          eR: [28, 15], hR: [29, 11],
          eL: [19, 18], hL: [16, 23],
        }),
      },
      { t: 64, pose: pose() },
      { t: 72, pose: pose() },
    ],
  },
};

/**
 * Constellation Trace — point up and connect invisible stars: sweep an
 * arm across the sky dot by dot, then tap the last one twice.
 */
const constellationTrace: Action = {
  id: 'constellation-trace',
  name: 'Constellation Trace',
  room: 'living',
  effort: 3,
  anim: {
    dur: 60,
    loop: false,
    keys: [
      { t: 0, pose: pose() },
      // arm up, pointing at the first star
      {
        t: 6,
        pose: pose({
          head: [24, 8], neck: [24, 13],
          eR: [27, 9], hR: [29, 4],
          eL: [20, 18], hL: [16, 23],
        }),
      },
      // sweep left to the next star
      {
        t: 14,
        pose: pose({
          head: [22.5, 8], neck: [23, 13],
          eR: [26, 8], hR: [23, 3],
          eL: [19, 18], hL: [15, 23],
        }),
      },
      // sweep right — the long line of the pattern
      {
        t: 24,
        pose: pose({
          head: [25.5, 8], neck: [25, 13], hip: [24.5, 24],
          eR: [29, 9], hR: [34, 3],
          eL: [20, 18], hL: [17, 23],
        }),
      },
      // double-tap the last star
      {
        t: 32,
        pose: pose({
          head: [24, 7.5], neck: [24, 12.5],
          eR: [27, 8], hR: [28, 2],
          eL: [20, 18], hL: [16, 23],
        }),
      },
      {
        t: 38,
        pose: pose({
          head: [24, 7.5], neck: [24, 12.5],
          eR: [27, 8], hR: [29, 1],
          eL: [20, 18], hL: [16, 23],
        }),
      },
      { t: 52, pose: pose() },
      { t: 60, pose: pose() },
    ],
  },
};

/**
 * Meteor Sighting — a meteor streaks by: freeze, point with both arms,
 * bounce on the toes, then hop once with delight.
 */
const meteorSighting: Action = {
  id: 'meteor-sighting',
  name: 'Meteor Sighting',
  room: 'living',
  effort: 5,
  anim: {
    dur: 48,
    loop: false,
    keys: [
      { t: 0, pose: pose() },
      // spot it — snap upright, arm shoots up
      {
        t: 5,
        pose: pose({
          head: [24, 7.5], neck: [24, 12.5],
          eR: [27, 8], hR: [30, 2],
          eL: [20, 18], hL: [16, 23],
        }),
      },
      // both arms up, tracking it
      {
        t: 11,
        pose: pose({
          head: [24, 7.5], neck: [24, 12.5], hip: [24, 23.5],
          eR: [28, 8], hR: [32, 3],
          eL: [20, 8], hL: [16, 3],
          kL: [21, 28], fL: [21, 39], kR: [27, 28], fR: [27, 39],
        }),
      },
      // tiptoe bounce, following the streak
      {
        t: 19,
        pose: pose({
          head: [25, 7], neck: [25, 12], hip: [24.5, 23],
          eR: [29, 7], hR: [33, 1],
          eL: [21, 7], hL: [17, 2],
          kL: [21, 28], fL: [21, 39], kR: [27, 28], fR: [27, 39],
        }),
      },
      // little hop of delight
      {
        t: 27,
        pose: pose({
          head: [24, 6.5], neck: [24, 11.5], hip: [24, 22],
          eR: [28, 8], hR: [32, 4],
          eL: [20, 8], hL: [16, 4],
          kL: [21, 28], fL: [20, 35], kR: [27, 30], fR: [30, 37],
        }),
      },
      // land, hands back on hips, satisfied
      {
        t: 38,
        pose: pose({
          head: [24, 8.5], neck: [24, 13.5],
          eL: [19, 17], hL: [15, 22],
          eR: [29, 17], hR: [33, 22],
        }),
      },
      { t: 48, pose: pose() },
    ],
  },
};

/**
 * Rocket Launch — SECRET action, fired only by the hidden button combo on the
 * astronomer's cube. Appleby crouches and covers his ears for a countdown,
 * then a rocket (front overlay) roars up from beside him into the sky. He
 * stays put — no transformation — and a smoke puff marks the launch pad.
 */
const rocketLaunch: Action = {
  id: 'rocket-launch',
  name: 'Rocket Launch',
  room: 'living',
  effort: 4,
  secret: true,
  unlock: 'lift-off',
  sound: 'rocket',
  anim: {
    dur: 80,
    loop: false,
    keys: [
      { t: 0, pose: pose() },
      // crouch for the countdown
      {
        t: 8,
        pose: pose({
          head: [24, 12], neck: [24, 17], hip: [24, 27],
          kL: [20, 32], fL: [18, 40], kR: [28, 32], fR: [30, 40],
          eL: [20, 26], hL: [18, 32], eR: [28, 26], hR: [30, 32],
        }),
      },
      // fingers in ears — countdown...
      {
        t: 18,
        pose: pose({
          head: [24, 11.5], neck: [24, 16.5], hip: [24, 26.5],
          kL: [20, 31], fL: [18, 40], kR: [28, 31], fR: [30, 40],
          eR: [27, 10], hR: [24, 7],
          eL: [21, 10], hL: [24, 7],
        }),
      },
      // ...LIFTOFF! — straighten, eyes up, arm shooting out to track it
      {
        t: 34,
        pose: pose({
          head: [24.5, 7.5], neck: [24.5, 12.5], hip: [24, 24],
          eR: [28, 8], hR: [31, 2],
          eL: [20, 18], hL: [17, 23],
          kL: [21, 31], fL: [20, 40], kR: [27, 31], fR: [28, 40],
        }),
      },
      // tracking it higher, head thrown back
      {
        t: 52,
        pose: pose({
          head: [24.5, 7], neck: [24.5, 12],
          eR: [28, 7], hR: [33, 1],
          eL: [20, 18], hL: [17, 23],
        }),
      },
      // a satisfied step back and settle
      {
        t: 68,
        pose: pose({
          head: [24, 8.5], neck: [24, 13.5],
          eL: [19, 17], hL: [15, 22],
          eR: [29, 17], hR: [33, 22],
        }),
      },
      { t: 80, pose: pose() },
    ],
  },
  /**
   * Front overlay — a rocket launching from BESIDE Appleby (his body stays at
   * body-center x≈24; the rocket pad is at x≈33, clear of him). It sits on
   * the ground at countdown, then climbs with an exhaust flame past the top
   * of the screen; a little smoke lingers on the pad.
   */
  front(ctx, frame) {
    const t = frame / 80; // 0..1 across the action
    const padX = 33;

    // Countdown (0 → 0.42): rocket waits on the ground, flame flickering.
    if (t < 0.42) {
      const gentle = Math.floor(frame / 3) % 2 === 0;
      // pad smoke occasionally
      if (gentle && frame % 6 === 0) ctx.fillRect(padX - 1, 40, 3, 2);
      // exhaust under the tail
      ctx.fillRect(padX - 1, 39, 2, gentle ? 3 : 2);
      return;
    }

    // Liftoff (0.42 → 1): rocket climbs off the screen.
    const bt = (t - 0.42) / 0.58; // 0..1
    const y = Math.round(40 - bt * 48); // rises from the pad off the top
    const x = Math.round(padX - 1);
    if (y > -10) {
      // exhaust flame below the tail (flickers)
      const fh = Math.floor(frame / 2) % 2 === 0 ? 4 : 2;
      ctx.fillRect(x, y + 7, 3, fh);
      // body
      ctx.fillRect(x, y + 1, 3, 6);
      // nose cone
      ctx.fillRect(x + 1, y - 2, 1, 3);
      // fins
      ctx.fillRect(x - 1, y + 3, 1, 2);
      ctx.fillRect(x + 3, y + 3, 1, 2);
      // smoke plume at the pad, fading as he climbs
      const fade = Math.max(0, 1 - bt * 1.4);
      if (fade > 0) {
        const w = Math.round(4 + (1 - fade) * 3);
        ctx.fillRect(padX - w / 2, 42, w, 3);
      }
    }
  },
};

/**
 * The Astronomer's living room: a night-time observatory. A telescope on
 * a tripod points up through an open dome, stars twinkle across the top,
 * and a star chart is pinned on the left wall. Same arrangement as every
 * profession's hub.
 */
const livingRoom: Scene = makeLivingRoom((ctx, frame) => {
  // floor
  ctx.fillRect(0, 46, 48, 2);

  // === Night sky (top band): twinkling stars ===
  const stars: Array<[number, number]> = [
    [4, 4], [9, 6], [14, 3], [20, 5], [26, 3], [33, 5], [41, 4], [45, 7],
  ];
  for (let i = 0; i < stars.length; i++) {
    // each star blinks on its own phase
    if ((frame + i * 17) % 48 < 34) ctx.fillRect(stars[i]![0], stars[i]![1], 1, 1);
  }
  // a meteor streaks by every so often
  const meteor = frame % 240;
  if (meteor < 14) {
    ctx.fillRect(28 + meteor, 6 + Math.floor(meteor / 2), 1, 1); // head
    if (meteor > 3) ctx.fillRect(27 + meteor, 6 + Math.floor(meteor / 2), 1, 1); // tail
  }

  // === Dome opening (top-right) with the telescope tube poking out ===
  rectOutline(ctx, 33, 2, 14, 6); // dome aperture frame
  // telescope tube, angled up through the aperture
  ctx.fillRect(37, 8, 2, 5); // lower tube (vertical)
  ctx.fillRect(38, 4, 2, 4); // upper tube (tilted out the dome)
  ctx.fillRect(39, 3, 3, 1); // objective lens end
  ctx.fillRect(36, 13, 3, 1); // eyepiece

  // === Tripod (right side, the cubeman stands at x≈30 facing it) ===
  ctx.fillRect(35, 14, 1, 30); // left leg
  ctx.fillRect(42, 14, 1, 30); // right leg
  ctx.fillRect(38, 14, 1, 12); // center column
  ctx.fillRect(34, 29, 10, 1); // leg brace

  // === Star chart pinned on the wall (left) ===
  rectOutline(ctx, 3, 8, 11, 9);
  // dots of a tiny constellation on the chart
  ctx.fillRect(6, 11, 1, 1);
  ctx.fillRect(10, 12, 1, 1);
  ctx.fillRect(8, 14, 1, 1);
  ctx.fillRect(11, 15, 1, 1);
  // chart flickers under lamplight every few seconds
  const flicker = Math.floor(frame / 40) % 3;
  if (flicker === 1) ctx.fillRect(9, 13, 1, 1);

  // === Notebook and pencil on the floor (bottom-left) ===
  ctx.fillRect(4, 43, 5, 2); // notebook
  ctx.fillRect(10, 42, 3, 1); // pencil
});

export const astronomer: Profession = {
  id: 'astronomer',
  name: 'Astronomer',
  maxStamina: 150,
  actions: [stargazing, constellationTrace, meteorSighting, rocketLaunch, ...bedroomActions(), shower, bath, meditation],
  idle,
  sleep,
  scenes: [livingRoom, bedroom, bathroom],
};
