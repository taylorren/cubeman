import { pose } from '../../render/skeleton';
import type { Action, Profession, Scene } from './types';
import { makeLivingRoom, bedroom, bathroom, rectOutline, idle, sleep, shower, bath, meditation, bedroomActions } from './shared';

// --- Actions ----------------------------------------------------------------

/**
 * Flambé — toss the pan, flames burst up. The cook leans back in shock,
 * then recovers as the fire settles. Room-locked to the living room.
 */
const flambe: Action = {
  id: 'flambe',
  name: 'Flambé',
  room: 'living',
  effort: 5,
  anim: {
    dur: 60,
    loop: false,
    keys: [
      { t: 0, pose: pose() },
      // grab the pan, lean forward
      { t: 8, pose: pose({ head: [24, 11], eL: [20, 18], hL: [18, 24], eR: [28, 18], hR: [30, 24] }) },
      // toss up — lean back, arms high
      { t: 16, pose: pose({ head: [24, 8], eL: [18, 10], hL: [14, 4], eR: [30, 10], hR: [34, 4] }) },
      // FLAMES — shock, lean way back
      { t: 24, pose: pose({ head: [22, 7], neck: [23, 13], hip: [25, 24], eL: [17, 8], hL: [12, 2], eR: [31, 8], hR: [36, 2] }) },
      // hold the shock
      { t: 36, pose: pose({ head: [22, 7], neck: [23, 13], hip: [25, 24], eL: [17, 9], hL: [13, 4], eR: [31, 9], hR: [35, 4] }) },
      // recover, lower arms
      { t: 48, pose: pose({ head: [24, 10], eL: [20, 17], hL: [17, 22], eR: [28, 17], hR: [31, 22] }) },
      { t: 60, pose: pose() },
    ],
  },
};

/**
 * Taste Test — scoop from pot, blow on it, taste, and react with a
 * delighted shrug. Room-locked to the living room.
 */
const tasteTest: Action = {
  id: 'taste-test',
  name: 'Taste Test',
  room: 'living',
  effort: 3,
  anim: {
    dur: 48,
    loop: false,
    keys: [
      { t: 0, pose: pose() },
      // lean toward the pot, scoop
      { t: 8, pose: pose({ head: [25, 11], neck: [25, 15], hip: [25, 25], eL: [29, 18], hL: [32, 22], eR: [21, 18], hR: [18, 22] }) },
      // lift spoon to mouth, blow
      { t: 16, pose: pose({ head: [25, 10], neck: [25, 14], hip: [25, 25], eL: [28, 14], hL: [30, 8], eR: [22, 14], hR: [20, 8] }) },
      // taste — pause, thinking
      { t: 24, pose: pose({ head: [25, 10], neck: [25, 14], hip: [25, 25], eL: [28, 15], hL: [30, 10], eR: [22, 15], hR: [20, 10] }) },
      // delighted! shrug + open hands
      { t: 32, pose: pose({ head: [24, 9], neck: [24, 14], hip: [24, 25], eL: [19, 13], hL: [15, 8], eR: [29, 13], hR: [33, 8] }) },
      { t: 40, pose: pose() },
      { t: 48, pose: pose() },
    ],
  },
};

/**
 * Chef's Kiss — the classic Italian chef's kiss. Pinch the fingers, kiss
 * them away, and beam. Room-locked to the living room.
 */
const chefsKiss: Action = {
  id: 'chefs-kiss',
  name: "Chef's Kiss",
  room: 'living',
  effort: 2,
  anim: {
    dur: 36,
    loop: false,
    keys: [
      { t: 0, pose: pose() },
      // raise hand to mouth, pinch fingers
      { t: 8, pose: pose({ head: [24, 10], eL: [21, 14], hL: [24, 8], eR: [28, 16], hR: [31, 22] }) },
      // kiss — lips to fingertips
      { t: 14, pose: pose({ head: [23, 9], eL: [21, 13], hL: [23, 7], eR: [28, 16], hR: [31, 22] }) },
      // fling fingers away with a flourish
      { t: 20, pose: pose({ head: [24, 9], eL: [20, 12], hL: [16, 6], eR: [28, 16], hR: [31, 22] }) },
      // beam — proud, hands on hips
      { t: 28, pose: pose({ head: [24, 9], eL: [19, 18], hL: [17, 24], eR: [29, 18], hR: [31, 24] }) },
      { t: 36, pose: pose() },
    ],
  },
};

/**
 * Chef's living room: a cozy kitchenette. Stove with a pan on the right,
 * a pot bubbling on the left, utensil rack in the corner, and steam
 * rising from the pot. Same arrangement as every profession's hub.
 */
const livingRoom: Scene = makeLivingRoom((ctx, frame) => {
  // floor
  ctx.fillRect(0, 46, 48, 2);

  // === Stove + Pan (right side) ===
  // stove body
  ctx.fillRect(34, 34, 12, 12);
  // stove top
  ctx.fillRect(33, 33, 14, 1);
  // pan on the stove
  ctx.fillRect(36, 30, 8, 3);
  ctx.fillRect(35, 31, 1, 1); // handle left
  ctx.fillRect(44, 31, 1, 1); // handle right
  // pan rim
  ctx.fillRect(36, 29, 8, 1);

  // === Bubbling Pot (left side) ===
  ctx.fillRect(6, 36, 10, 8); // pot body
  ctx.fillRect(5, 35, 12, 1); // pot rim
  ctx.fillRect(8, 33, 1, 1); // left handle
  ctx.fillRect(14, 33, 1, 1); // right handle

  // steam from the pot — animated, rising and wobbling
  const steamPhase = Math.floor(frame / 20) % 4;
  const steamX = 9 + steamPhase;
  ctx.fillRect(steamX, 30, 1, 1);
  ctx.fillRect(steamX + 1, 28, 1, 1);
  ctx.fillRect(steamX - 1, 26, 1, 1);
  ctx.fillRect(steamX + 2, 24, 1, 1);

  // === Utensil rack (top-right corner) ===
  ctx.fillRect(44, 4, 1, 12); // vertical bar
  ctx.fillRect(43, 5, 1, 1); // hook 1
  ctx.fillRect(43, 8, 1, 1); // hook 2
  ctx.fillRect(43, 11, 1, 1); // hook 3
  // hanging utensils (little dashes)
  ctx.fillRect(42, 6, 1, 3);
  ctx.fillRect(42, 9, 1, 3);
  ctx.fillRect(42, 12, 1, 3);

  // === Window (top-left) ===
  rectOutline(ctx, 2, 3, 10, 7);
  ctx.fillRect(7, 3, 1, 7); // pane divider

  // little plant on the windowsill
  ctx.fillRect(3, 9, 3, 2); // small pot
  ctx.fillRect(4, 7, 1, 2); // stem
  ctx.fillRect(3, 6, 1, 1); // leaf
  ctx.fillRect(5, 6, 1, 1); // leaf
});

export const chef: Profession = {
  id: 'chef',
  name: 'Chef',
  maxStamina: 150,
  actions: [flambe, tasteTest, chefsKiss, ...bedroomActions(), shower, bath, meditation],
  idle,
  sleep,
  scenes: [livingRoom, bedroom, bathroom],
};
