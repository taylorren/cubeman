/** 2D point in LCD pixel space (48×48 logical pixels). */
export type Vec2 = [number, number];

export type JointName =
  | 'head'
  | 'neck'
  | 'hip'
  | 'kL'
  | 'fL'
  | 'kR'
  | 'fR'
  | 'eL'
  | 'hL'
  | 'eR'
  | 'hR';

/** A stickman pose: position of every joint. */
export type Skeleton = Record<JointName, Vec2>;

export const JOINTS: JointName[] = [
  'head', 'neck', 'hip',
  'kL', 'fL', 'kR', 'fR',
  'eL', 'hL', 'eR', 'hR',
];

/** Neutral standing pose, centered in a 48×48 screen. */
export const BASE: Skeleton = {
  head: [24, 9],
  neck: [24, 14],
  hip: [24, 24],
  kL: [21, 32], fL: [20, 40],
  kR: [27, 32], fR: [28, 40],
  eL: [20, 19], hL: [17, 24],
  eR: [28, 19], hR: [31, 24],
};

/** Build a pose by overriding joints of the base pose. */
export const pose = (over: Partial<Skeleton> = {}): Skeleton => ({ ...BASE, ...over });

export function lerpPose(a: Skeleton, b: Skeleton, t: number): Skeleton {
  const out = {} as Skeleton;
  for (const j of JOINTS) {
    out[j] = [
      a[j][0] + (b[j][0] - a[j][0]) * t,
      a[j][1] + (b[j][1] - a[j][1]) * t,
    ];
  }
  return out;
}

/** Shift a whole pose horizontally (used for wandering around the cube). */
export function shiftX(p: Skeleton, dx: number): Skeleton {
  const out = {} as Skeleton;
  for (const j of JOINTS) out[j] = [p[j][0] + dx, p[j][1]];
  return out;
}

/** Offset every joint vertically (positive = down). Used for ladder travel,
 *  where the climber's pose slides out through the ceiling or floor. */
export function shiftY(p: Skeleton, dy: number): Skeleton {
  const out = {} as Skeleton;
  for (const j of JOINTS) out[j] = [p[j][0], p[j][1] + dy];
  return out;
}

/** Rotate every joint around a pivot (used for flips and cartwheels). */
export function rot(p: Skeleton, deg: number, cx = 24, cy = 24): Skeleton {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  const out = {} as Skeleton;
  for (const j of JOINTS) {
    const dx = p[j][0] - cx;
    const dy = p[j][1] - cy;
    out[j] = [cx + dx * c - dy * s, cy + dx * s + dy * c];
  }
  return out;
}

/** One keyframe: a pose at time `t` (in animation frames, 30fps). */
export interface Keyframe {
  t: number;
  pose: Skeleton;
}

export interface Anim {
  /** Total length in frames. */
  dur: number;
  loop: boolean;
  /** Sorted by `t`; first key must be at t=0. For looping anims the last key
   *  must be at t < dur — the wrap-around segment interpolates back to keys[0]. */
  keys: Keyframe[];
}

/** Sample a pose from keyframes at a given frame. */
export function sample(anim: Anim, frame: number): Skeleton {
  const { dur, keys, loop } = anim;
  const t = loop ? ((frame % dur) + dur) % dur : Math.min(frame, dur);
  const first = keys[0];
  const last = keys[keys.length - 1];

  if (loop && t >= last.t) {
    const span = dur - last.t + first.t;
    return lerpPose(last.pose, first.pose, (t - last.t) / span);
  }
  if (t <= first.t) return first.pose;
  if (t >= last.t) return last.pose;

  for (let i = 0; i < keys.length - 1; i++) {
    const k0 = keys[i];
    const k1 = keys[i + 1];
    if (t >= k0.t && t <= k1.t) {
      return lerpPose(k0.pose, k1.pose, (t - k0.t) / (k1.t - k0.t));
    }
  }
  return last.pose;
}

/** Largest horizontal deviation of any joint from the pose origin (x=24)
 *  across an animation's keyframes — how much room the anim needs on each
 *  side of the body center to stay on screen. (Interpolation between
 *  keyframes is per-joint linear, so keyframe maxima bound every frame.) */
export function animExtent(anim: Anim): number {
  let e = 0;
  for (const k of anim.keys)
    for (const j of JOINTS) e = Math.max(e, Math.abs(k.pose[j][0] - 24));
  return e;
}
