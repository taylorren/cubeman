import { pose, rot } from '../../render/skeleton';
import type { Action, Profession } from './types';
import { livingRoom, bedroom, bathroom, idle, sleep } from './shared';

// --- Dancer: graceful, expressive, full of rhythm --------------------------
// Personality: fluid movements, spins, and dramatic poses. The dancer
// expresses emotion through flowing arm work and sweeping turns.

// --- Pirouette: a graceful spin on one toe -------------------------------
const arabesque = pose({
  head: [24, 8], neck: [24, 13], hip: [24, 24],
  kL: [21, 32], fL: [20, 40],
  kR: [24, 20], fR: [24, 12],
  eL: [18, 14], hL: [14, 10],
  eR: [30, 14], hR: [34, 10],
});

const pirouette: Action = {
  id: 'pirouette',
  name: 'Pirouette',
  effort: 7,
  anim: {
    dur: 36,
    loop: false,
    keys: [
      { t: 0, pose: pose() },
      // rise onto toes, arms up
      {
        t: 5,
        pose: pose({
          head: [24, 7], neck: [24, 12], hip: [24, 22],
          kL: [21, 30], fL: [20, 38],
          kR: [27, 30], fR: [28, 38],
          eL: [18, 10], hL: [14, 4],
          eR: [30, 10], hR: [34, 4],
        }),
      },
      // spin (clockwise turns)
      { t: 10, pose: rot(arabesque, 90, 24, 24) },
      { t: 16, pose: rot(arabesque, 180, 24, 24) },
      { t: 22, pose: rot(arabesque, 270, 24, 24) },
      { t: 28, pose: rot(arabesque, 360, 24, 24) },
      // land softly
      {
        t: 32,
        pose: pose({
          head: [24, 8], neck: [24, 13], hip: [24, 24],
          kL: [20, 33], fL: [19, 40],
          kR: [28, 33], fR: [29, 40],
        }),
      },
      { t: 36, pose: pose() },
    ],
  },
};

// --- Moonwalk: a smooth sliding step backward ----------------------------
const moonwalk: Action = {
  id: 'moonwalk',
  name: 'Moonwalk',
  effort: 5,
  anim: {
    dur: 32,
    loop: false,
    keys: [
      { t: 0, pose: pose() },
      // slide back, one foot glides
      {
        t: 6,
        pose: pose({
          head: [25, 8], neck: [25, 13], hip: [25, 23],
          kL: [20, 32], fL: [16, 38],
          kR: [28, 30], fR: [32, 38],
          eL: [20, 17], hL: [16, 20],
          eR: [30, 17], hR: [34, 20],
        }),
      },
      {
        t: 14,
        pose: pose({
          head: [25, 8], neck: [25, 13], hip: [25, 23],
          kL: [20, 30], fL: [14, 36],
          kR: [28, 32], fR: [34, 40],
          eL: [21, 17], hL: [17, 20],
          eR: [29, 17], hR: [33, 20],
        }),
      },
      // switch feet, keep gliding
      {
        t: 22,
        pose: pose({
          head: [25, 8], neck: [25, 13], hip: [25, 23],
          kL: [20, 32], fL: [16, 40],
          kR: [28, 30], fR: [32, 36],
          eL: [20, 17], hL: [16, 20],
          eR: [30, 17], hR: [34, 20],
        }),
      },
      { t: 32, pose: pose() },
    ],
  },
};

// --- Jazz Hands: a dramatic flourish with a bow ---------------------------
const jazzUp = pose({
  head: [24, 8], neck: [24, 13], hip: [24, 24],
  kL: [21, 32], fL: [20, 40],
  kR: [27, 32], fR: [28, 40],
  eL: [16, 14], hL: [10, 8],
  eR: [32, 14], hR: [38, 8],
});

const jazzHands: Action = {
  id: 'jazz-hands',
  name: 'Jazz Hands',
  effort: 3,
  anim: {
    dur: 40,
    loop: false,
    keys: [
      { t: 0, pose: pose() },
      // arms rise
      {
        t: 6,
        pose: pose({
          eL: [18, 14], hL: [14, 8],
          eR: [30, 14], hR: [34, 8],
        }),
      },
      // jazz hands up high
      { t: 12, pose: jazzUp },
      // shake shake shake
      {
        t: 16,
        pose: pose({
          head: [24, 8], neck: [24, 13], hip: [24, 24],
          kL: [21, 32], fL: [20, 40],
          kR: [27, 32], fR: [28, 40],
          eL: [15, 14], hL: [9, 7],
          eR: [33, 14], hR: [39, 7],
        }),
      },
      {
        t: 20,
        pose: pose({
          head: [24, 8], neck: [24, 13], hip: [24, 24],
          kL: [21, 32], fL: [20, 40],
          kR: [27, 32], fR: [28, 40],
          eL: [17, 14], hL: [11, 9],
          eR: [31, 14], hR: [37, 9],
        }),
      },
      // dramatic bow
      {
        t: 28,
        pose: pose({
          head: [24, 14], neck: [24, 18], hip: [24, 27],
          kL: [21, 34], fL: [20, 40],
          kR: [27, 34], fR: [28, 40],
          eL: [18, 22], hL: [14, 26],
          eR: [30, 22], hR: [34, 26],
        }),
      },
      { t: 40, pose: pose() },
    ],
  },
};

export const dancer: Profession = {
  id: 'dancer',
  name: 'Dancer',
  actions: [pirouette, moonwalk, jazzHands],
  idle,
  sleep,
  scenes: [livingRoom, bedroom, bathroom],
};