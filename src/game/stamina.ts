/**
 * Hidden energy budget — the cubeman's self-directed life spends it;
 * ONLY sleep regenerates it. Deliberately invisible on screen: the player
 * reads tiredness through behavior (fewer tricks, shorter strolls, flopping),
 * never through a bar. User presses always perform — stamina only shapes
 * autonomous behavior.
 */

export const STAMINA = {
  MAX: 100,
  /** 4/s from elapsed sim time (30fps): 4/30 per tick. */
  REGEN_PER_TICK: 4 / 30,

  /** Autonomous tricks stop below this. */
  EXHAUSTED: 30,
  /** Tricks scheduled 1.4× farther apart + cheaper tricks favored below this. */
  TIRED: 55,
  /** Too drained to reach the bed — flops into an in-place nap. */
  FLOP_BELOW: 8,
  /** Auto-sleep (goes to bed) below this, even with recent interaction. */
  SLEEP_AT: 25,
  /** In-place nap ends (wake up) at this level. */
  WAKE_NAP: 55,
  /** Bed sleep ends (wake up) at this level. */
  WAKE_FULL: 90,
  /** A nap lasts at least this long before auto-waking (ms). */
  MIN_NAP_MS: 6_000,

  COST_KICK: 2,
  /** Stamina per screen pixel walked. */
  COST_WALK_PX: 0.05,
  COST_CROSS: 0.5,
  /** Spontaneous-trick schedule stretches by this when tired. */
  TIRED_SLOWDOWN: 1.4,
} as const;

/** After an accepted press, behavior-recovery (bed/flop) waits this long. */
export const GRACE_MS = 10_000;

let value: number = STAMINA.MAX;

export const stamina = {
  get: (): number => value,
  /** Consume energy, clamped at 0. */
  spend(n: number): void {
    value = Math.max(0, value - n);
  },
  /** Recover energy (sleep only), clamped at MAX. */
  regen(n: number): void {
    value = Math.min(STAMINA.MAX, value + n);
  },
};
