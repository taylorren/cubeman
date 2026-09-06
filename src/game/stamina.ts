/**
 * Hidden energy budget — the cubeman's self-directed life spends it;
 * ONLY sleep regenerates it. Deliberately invisible on screen: the player
 * reads tiredness through behavior (fewer tricks, shorter strolls, flopping),
 * never through a bar. User presses always perform — stamina only shapes
 * autonomous behavior.
 */

export const STAMINA = {
  MAX: 100,
  /** Full refill over ~50s of sleep (30fps): 100 / 1500 ticks. */
  REGEN_PER_TICK: 100 / 1500,

  /** Autonomous tricks stop below this. */
  EXHAUSTED: 30,
  /** Tricks get rarer + low-effort-biased below this. */
  TIRED: 60,
  /** Too drained to even wander — flops into an in-place nap. */
  FLOP_BELOW: 10,
  /** Auto-sleep (goes to bed) below this, even with recent interaction. */
  SLEEP_AT: 40,
  /** In-place nap ends (wake up) at this level. */
  WAKE_NAP: 60,
  /** Bed sleep ends (wake up) at this level. */
  WAKE_FULL: 100,

  COST_KICK: 5,
  COST_STROLL: 1.5,
  COST_CROSS: 2,
  /** Spontaneous-trick schedule stretches by this when tired. */
  TIRED_SLOWDOWN: 1.8,
} as const;

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
