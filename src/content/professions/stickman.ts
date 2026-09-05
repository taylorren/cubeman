import { pose, rot } from '../../render/skeleton';
import type { Action, Profession } from './types';
import { livingRoom, bedroom, bathroom, idle, sleep } from './shared';

// --- Actions (3 for now — the array is the extension point) ----------------

// Tucked ball used mid-backflip.
const tuck = pose({
  head: [24, 20], neck: [24, 17], hip: [24, 25],
  kL: [20, 22], fL: [22, 18], kR: [28, 22], fR: [26, 18],
  eL: [21, 21], hL: [23, 24], eR: [27, 21], hR: [25, 24],
});

const crouch = pose({
  head: [24, 12], neck: [24, 17], hip: [24, 27],
  kL: [20, 33], fL: [19, 40], kR: [28, 33], fR: [29, 40],
  eL: [19, 22], hL: [15, 27], eR: [29, 22], hR: [33, 27],
});

const backflip: Action = {
  id: 'backflip',
  name: 'Backflip',
  anim: {
    dur: 30,
    loop: false,
    keys: [
      { t: 0, pose: pose() },
      { t: 5, pose: crouch },
      // tucked spin (clockwise = backwards on screen)
      { t: 9, pose: rot(tuck, 90, 24, 22) },
      { t: 13, pose: rot(tuck, 180, 24, 22) },
      { t: 17, pose: rot(tuck, 270, 24, 22) },
      { t: 21, pose: rot(tuck, 360, 24, 22) },
      { t: 26, pose: crouch },
      { t: 30, pose: pose() },
    ],
  },
};

// Spread-eagle pose used mid-cartwheel.
const spread = pose({
  head: [24, 16], neck: [24, 19], hip: [24, 25],
  kL: [19, 27], fL: [14, 31], kR: [29, 27], fR: [34, 31],
  eL: [21, 12], hL: [18, 6], eR: [27, 12], hR: [30, 6],
});

const cartwheel: Action = {
  id: 'cartwheel',
  name: 'Cartwheel',
  anim: {
    dur: 30,
    loop: false,
    keys: [
      { t: 0, pose: pose() },
      { t: 5, pose: rot(pose(), -25, 24, 38) },
      { t: 10, pose: rot(spread, -90, 24, 24) },
      { t: 15, pose: rot(spread, -180, 24, 24) },
      { t: 20, pose: rot(spread, -270, 24, 24) },
      { t: 25, pose: rot(spread, -360, 24, 24) },
      { t: 30, pose: pose() },
    ],
  },
};

const cheekyWave: Action = {
  id: 'cheeky-wave',
  name: 'Cheeky Wave',
  anim: {
    dur: 44,
    loop: false,
    keys: [
      { t: 0, pose: pose() },
      // lean left, arm up
      {
        t: 5,
        pose: pose({
          head: [22.5, 9], neck: [22.5, 14], hip: [23, 24],
          eL: [18.5, 19], hL: [15.5, 24],
          eR: [26.5, 12], hR: [29.5, 6],
        }),
      },
      // arm swings out
      {
        t: 10,
        pose: pose({
          head: [23, 9], neck: [23, 14], hip: [23.5, 24],
          eL: [19, 19], hL: [16, 24],
          eR: [27.5, 11], hR: [32.5, 8],
        }),
      },
      // lean right, arm up
      {
        t: 15,
        pose: pose({
          head: [25.5, 9], neck: [25.5, 14], hip: [26, 24],
          eL: [21, 19], hL: [18, 24],
          eR: [29.5, 12], hR: [32.5, 6],
        }),
      },
      {
        t: 20,
        pose: pose({
          head: [25, 9], neck: [25, 14], hip: [25.5, 24],
          eL: [20.5, 19], hL: [17.5, 24],
          eR: [28.5, 11], hR: [33.5, 8],
        }),
      },
      // one more left lean + wave
      {
        t: 25,
        pose: pose({
          head: [22.5, 9], neck: [22.5, 14], hip: [23, 24],
          eL: [18.5, 19], hL: [15.5, 24],
          eR: [26.5, 12], hR: [29.5, 6],
        }),
      },
      { t: 32, pose: pose() },
      // cheeky little bow, hand on belly
      {
        t: 38,
        pose: pose({
          head: [24, 12.5], neck: [24, 16.5], hip: [24, 25.5],
          kL: [21, 31.5], fL: [20, 39.5],
          kR: [27, 31.5], fR: [28, 39.5],
          eL: [22, 20], hL: [24.5, 25],
          eR: [26, 20], hR: [24, 25],
        }),
      },
      { t: 44, pose: pose() },
    ],
  },
};

export const stickman: Profession = {
  id: 'stickman',
  name: 'Stickman',
  actions: [backflip, cartwheel, cheekyWave], // ← add new actions here to expand
  idle,
  sleep,
  scenes: [livingRoom, bedroom, bathroom], // first = hub/entry room
};
