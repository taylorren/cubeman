import { pose } from '../../render/skeleton';
import type { Action, Profession, Scene } from './types';
import { makeLivingRoom, bedroom, bathroom, idle, sleep, shower, bath } from './shared';

// --- Musician: expressive, rhythmic, lives for the jam ------------------------
// Personality: a little showy, head always bobbing to a beat only they hear.
// Three actions, each with a synthesized sound — the only profession that makes
// sound. Living room is a music corner: keyboard, speakers, floating notes.
// Actions: Symphony No. 5 (Beethoven's fate motif), Air Guitar (classic rock
// solo), Ode to Joy (Beethoven's 9th).

// --- Symphony No. 5: conducts Beethoven's famous G-G-G-Eb opening -----------
// The first four notes of fate knocking — a dramatic conductor's arc.
const conductUp = pose({
  head: [24, 9], neck: [24, 14], hip: [24, 24],
  kL: [21, 32], fL: [20, 40], kR: [27, 32], fR: [28, 40],
  eL: [18, 14], hL: [13, 8], eR: [30, 14], hR: [35, 8],
});
const conductBeat = pose({
  head: [24, 8.5], neck: [24, 13.5], hip: [24, 24],
  kL: [21, 32], fL: [20, 40], kR: [27, 32], fR: [28, 40],
  eL: [17, 13], hL: [11, 6], eR: [31, 13], hR: [37, 6],
});
const conductStrike = pose({
  head: [24, 8], neck: [24, 13], hip: [24, 24],
  kL: [21, 32], fL: [20, 40], kR: [27, 32], fR: [28, 40],
  eL: [16, 12], hL: [9, 4], eR: [32, 12], hR: [39, 4],
});
const conductHold = pose({
  head: [24, 9], neck: [24, 14], hip: [24, 24],
  kL: [21, 32], fL: [20, 40], kR: [27, 32], fR: [28, 40],
  eL: [15, 10], hL: [7, 4], eR: [33, 10], hR: [41, 4],
});
const conductResolve = pose({
  head: [24, 10], neck: [24, 15], hip: [24, 24],
  kL: [21, 32], fL: [20, 40], kR: [27, 32], fR: [28, 40],
  eL: [17, 13], hL: [11, 7], eR: [31, 13], hR: [37, 7],
});

const symphony5: Action = {
  id: 'symphony-5',
  name: 'Symphony No. 5',
  room: 'living',
  effort: 5,
  sound: 'symphony5',
  anim: {
    dur: 72,
    loop: false,
    keys: [
      // raise the baton
      { t: 0, pose: pose() },
      { t: 6, pose: conductUp },
      // three short beats (the three Gs)
      { t: 12, pose: conductBeat },
      { t: 18, pose: conductStrike },
      { t: 24, pose: conductBeat },
      // hold on the long Eb — arms wide, dramatic sustain
      { t: 32, pose: conductHold },
      { t: 42, pose: conductHold },
      { t: 52, pose: conductHold },
      // resolve and lower the baton
      { t: 60, pose: conductResolve },
      { t: 66, pose: conductUp },
      { t: 72, pose: pose() },
    ],
  },
};

// --- Air Guitar: a longer, classic rock-style solo ---------------------------
// Mimics the arc of a famous solo: stance → shred → bend → run → sustain.
const guitarStand = pose({
  head: [24, 9], neck: [24, 14], hip: [24, 24],
  kL: [21, 32], fL: [19, 40], kR: [27, 32], fR: [29, 40],
  eL: [18, 16], hL: [13, 12], eR: [30, 16], hR: [35, 12],
});
const guitarShred = pose({
  head: [24, 8], neck: [24, 13], hip: [25, 24],
  kL: [20, 32], fL: [18, 40], kR: [28, 32], fR: [30, 40],
  eL: [16, 14], hL: [9, 10], eR: [32, 14], hR: [39, 10],
});
const guitarLeanBack = pose({
  head: [25, 7.5], neck: [25, 12.5], hip: [26, 24],
  kL: [20, 32], fL: [18, 40], kR: [28, 32], fR: [30, 40],
  eL: [15, 13], hL: [7, 8], eR: [33, 13], hR: [41, 8],
});
const guitarKneel = pose({
  head: [24, 10], neck: [24, 15], hip: [24, 26],
  kL: [21, 32], fL: [20, 40], kR: [27, 32], fR: [29, 40],
  eL: [14, 12], hL: [5, 8], eR: [34, 12], hR: [43, 8],
});
const guitarPoint = pose({
  head: [24, 8], neck: [24, 13], hip: [24, 24],
  kL: [21, 32], fL: [20, 40], kR: [27, 32], fR: [29, 40],
  eL: [17, 14], hL: [11, 8], eR: [32, 10], hR: [40, 3],
});

const airGuitar: Action = {
  id: 'air-guitar',
  name: 'Air Guitar',
  room: 'living',
  effort: 4,
  sound: 'airGuitar',
  anim: {
    dur: 84,
    loop: false,
    keys: [
      // phrase 1: opening stance + power chord
      { t: 0, pose: pose() },
      { t: 6, pose: guitarStand },
      { t: 12, pose: guitarShred },
      { t: 18, pose: guitarLeanBack },
      { t: 24, pose: guitarShred },
      // phrase 2: bluesy bend (kneel + rise)
      { t: 30, pose: guitarKneel },
      { t: 36, pose: guitarStand },
      { t: 42, pose: guitarShred },
      // phrase 3: descending run (lean back, dramatic)
      { t: 48, pose: guitarLeanBack },
      { t: 54, pose: guitarShred },
      { t: 60, pose: guitarKneel },
      // phrase 4: sustained finish (point + hold)
      { t: 66, pose: guitarPoint },
      { t: 74, pose: guitarPoint },
      { t: 84, pose: pose() },
    ],
  },
};

// --- Symphony No. 9: conducts Beethoven's "Ode to Joy" ----------------------
// The famous melody — open, uplifting, arms-wide conducting.
const odeOpen = pose({
  head: [24, 9], neck: [24, 14], hip: [24, 24],
  kL: [21, 32], fL: [20, 40], kR: [27, 32], fR: [28, 40],
  eL: [14, 12], hL: [5, 6], eR: [34, 12], hR: [43, 6],
});
const odeSway = pose({
  head: [24, 8.5], neck: [24, 13.5], hip: [24, 24],
  kL: [21, 32], fL: [20, 40], kR: [27, 32], fR: [28, 40],
  eL: [13, 11], hL: [3, 5], eR: [35, 11], hR: [45, 5],
});
const odeLift = pose({
  head: [24, 8], neck: [24, 13], hip: [24, 24],
  kL: [21, 32], fL: [20, 40], kR: [27, 32], fR: [28, 40],
  eL: [12, 10], hL: [1, 3], eR: [36, 10], hR: [47, 3],
});
const odeResolve = pose({
  head: [24, 10], neck: [24, 15], hip: [24, 24],
  kL: [21, 32], fL: [20, 40], kR: [27, 32], fR: [28, 40],
  eL: [16, 13], hL: [9, 7], eR: [32, 13], hR: [39, 7],
});

const symphony9: Action = {
  id: 'symphony-9',
  name: 'Ode to Joy',
  room: 'living',
  effort: 6,
  sound: 'symphony9',
  anim: {
    dur: 96,
    loop: false,
    keys: [
      // raise arms — the melody opens
      { t: 0, pose: pose() },
      { t: 6, pose: odeOpen },
      // E E F G — sway with the rising phrase
      { t: 12, pose: odeSway },
      { t: 18, pose: odeOpen },
      { t: 24, pose: odeSway },
      // G F E D — lift on the long notes
      { t: 30, pose: odeLift },
      { t: 38, pose: odeOpen },
      { t: 44, pose: odeSway },
      // C C D E — the second phrase rises
      { t: 50, pose: odeOpen },
      { t: 56, pose: odeLift },
      { t: 62, pose: odeSway },
      // E D D — resolve, arms wide, hold
      { t: 68, pose: odeOpen },
      { t: 76, pose: odeOpen },
      { t: 84, pose: odeResolve },
      { t: 90, pose: odeOpen },
      { t: 96, pose: pose() },
    ],
  },
};

/**
 * Musician's living room: a little music corner — keyboard against the left
 * wall, a speaker/synth shelf on the right, and floating note symbols in the
 * ambience. Same arrangement as every profession's hub; Melody just dresses
 * it as a jam space.
 */
const livingRoom: Scene = makeLivingRoom((ctx, frame) => {
  // floor — the bottom rim of the screen itself
  ctx.fillRect(0, 46, 48, 2);

  // keyboard against the left wall: body + white/black keys
  ctx.fillRect(2, 33, 14, 5); // body
  ctx.fillRect(3, 32, 12, 1); // top rim
  for (let i = 0; i < 5; i++) ctx.fillRect(3 + i * 2, 33, 1, 4); // white keys
  for (let i = 0; i < 4; i++) ctx.fillRect(4 + i * 2, 33, 1, 2); // black keys

  // speaker/synth shelf on the right: two tweeters + a woofer with a beat LED
  ctx.fillRect(38, 20, 9, 14); // cabinet
  ctx.fillRect(39, 22, 3, 3); // tweeter L
  ctx.fillRect(44, 22, 2, 3); // tweeter R
  ctx.fillRect(40, 27, 5, 5); // woofer
  const beat = Math.floor(frame / 12) % 2;
  if (beat) ctx.fillRect(41, 28, 2, 2); // flashing beat LED

  // floating note symbols (animated — drift and toggle)
  const drift = Math.floor(frame / 20) % 2;
  ctx.fillRect(20 + drift, 10, 2, 1); // note stem
  ctx.fillRect(19 + drift, 11, 2, 1); // note head
  ctx.fillRect(26 - drift, 7, 2, 1); // note stem
  ctx.fillRect(25 - drift, 8, 2, 1); // note head
});

export const musician: Profession = {
  id: 'musician',
  name: 'Musician',
  actions: [symphony5, airGuitar, symphony9, shower, bath],
  idle,
  sleep,
  scenes: [livingRoom, bedroom, bathroom], // first = hub/entry room
};
