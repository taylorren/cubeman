# Cubeman Design Guide

The skill set for authoring professions, actions, and ambience.
Everything is **data-authored in a 48×48 LCD authoring space** and rendered
through a threshold rasterizer, so all content automatically looks like
native LCD segments.

## Screen model

| Constant | Value | Meaning |
|---|---|---|
| Author space | 48×48 | All poses and ambience are authored in this grid |
| `LCD.GROUND_Y` | 46 | Screen row of the floor (the floor is the bottom 2px rim, rows 46–47) |
| `LCD.AUTHOR_FEET_Y` | 40 | Y coordinate of a standing pose's feet in author space |
| `bodyScale` | 0.72 | Skeleton is drawn at 72%, pivoted so author feet land on the ground |

Rules of thumb:

- **Standing poses**: feet at y=40, head at y≈9. The renderer scales/pivots;
  never hand-shift poses to "move" the cubeman on screen.
- The cubeman is ~24px tall on screen (~half the screen), like the original toy.
- Leave headroom: actions may extend above y=6; things get clipped.
- **Density discipline**: 48px fills up fast. Ambience should stay out of the
  center band (y 10–40) where the cubeman moves.

## Skeleton

11 joints: `head, neck, hip, kL, fL, kR, fR, eL, hL, eR, hR`
(k=knee, f=foot, e=elbow, h=hand; L/R = left/right from viewer's perspective).

Helpers in `src/render/skeleton.ts`:

- `pose({...overrides})` — base standing pose merged with overrides. **Always
  build poses this way**; only override joints that move.
- `lerpPose(a, b, t)` — linear interpolation (used by `sample`; rarely needed directly).
- `rot(p, deg, cx, cy)` — rotate a whole pose around a pivot. Use for flips
  (tucked pose around body center) and cartwheels (spread pose around screen
  center). Clockwise = positive degrees.
- `sample(anim, frame)` — evaluate an animation at a frame (30fps).

## Animations

```ts
interface Anim { dur: number; loop: boolean; keys: Keyframe[] }
interface Keyframe { t: number; pose: Skeleton } // t in frames
```

Conventions (30 fps):

- **Non-looping**: first key at `t:0`, last key at `t:dur`. State machine
  auto-returns to idle (or chains via `onEnd`).
- **Looping** (idle/sleep): last key at `t < dur`; the wrap-around segment
  interpolates back to the first key smoothly.
- 4–6 frames per quarter-turn for spins; crouch/anticipation before jumps;
  landings need a crouch key before returning to base.
- Prefer **whole-body poses** over single-limb tweaks — weight shifts
  (hip/head x offsets) are what make actions read as "characterful".

## Profession anatomy

```ts
interface Profession {
  id: string; name: string;
  actions: Action[];        // 3 for now — profession-specific one-shots
  idle: Anim;               // shared — import from shared.ts
  sleep: Anim;              // shared
  ambience: Ambience;       // profession-specific home scenery
}
```

Register new professions in `src/content/professions/index.ts`.

### Shared behaviors (never re-author)

From `shared.ts`: `idle` (breathe/glance), `sleep` (lying + foot twitch),
`sleepEnter` (sit → slump → lie), `wake` (lie → sit → stretch).
Every profession gets them by importing; the state machine auto-sleeps after
30s idle and chains wake → action on any button press.

### Actions

```ts
{ id: 'backflip', name: 'Backflip', anim: { dur: 30, loop: false, keys: [...] } }
```

Name actions by their personality, not just mechanics ("Cheeky Wave" > "Wave").

### Ambience

```ts
interface Ambience { id: string; name: string; draw: Overlay }
type Overlay = (ctx: CanvasRenderingContext2D, frame: number) => void;
```

Drawn **behind** the skeleton in author space, before thresholding. Use plain
`ctx.fillRect` (1px units), the `rectOutline` helper from shared.ts, and
`LCD.GROUND_Y` for terrain. Subtle animation via `frame` (e.g. blinking sun).
Front-of-screen effects (like the sleep "Z z z") use the same `Overlay` type.

## State machine (what content plugs into)

```
idle ⇄ action₁..ₙ        button press starts action (ignored if busy)
idle → spontaneous action   every 6–14s in idle, a RANDOM profession action
                            plays on its own, wherever he is standing
                            (counts toward achievements; does NOT reset sleep timer)
idle → walk → idle          every 2.5–6s in idle, he strolls to a random spot
                            (shared `walk` cycle + shiftX; position is persistent)
idle → sleepEnter → sleep   after 30s without USER interaction (any spot)
sleep/wake → (stretch) → pressed action     any press wakes
```

Modes chain via `onEnd` callbacks (`src/main.ts`) — the same machinery that
will drive walk-to-edge → cross-cube transitions in P2.

**Spontaneity contract**: idle is not static — the cubeman performs a random
one of its own `actions` every 6–14 seconds. Consequences for content:

- Every action in the pool **must look good unprompted** (it may play with no
  user watching context, e.g. as the opener of a session).
- Spontaneous actions count toward achievements — so the action pool is also
  the idle personality. A profession's character emerges from what it does
  when nobody clicks.
- Auto-sleep still wins if the user walks away: **spontaneous actions do not
  reset the sleep timer** (only real user presses do), so an ignored cubeman
  still dozes off after 30s. Tune `SLEEP_AFTER_MS` / `SPONTANEOUS_*_MS` /
  `WANDER_*_MS` in `main.ts`, not the animations.
- **Timer independence**: the spontaneous deadline survives any amount of
  wandering/ball-play/room-hopping — only an *actual* action (spontaneous or
  user-triggered, via `startAction`) reschedules it. Wandering re-arms only
  its own timer, so walks can never starve tricks.
- **Wandering**: idle alternates between pausing (breathe/glance) and strolling
  to a random spot via the shared `walk` cycle, moved with `shiftX`. All
  position changes happen at render time — poses are authored at x=0 and never
  hand-shifted. `WANDER_RANGE` (±8 author px) keeps every pose, including the
  lying sleep pose, safely on screen.

## Ambience & props

Formula per cube (density discipline at 48×48): **1 interactive prop + 1
comfort item + 1 living element**, plus at most one passive scenic item
(e.g. a window). Thin details die in thresholding — design props as
recognizable silhouettes.

- **Interactive prop** (e.g. Stickman's ball): state lives in the game
  (`main.ts`), drawn in the `behind` pass after ambience; idle may trigger a
  prop behavior (walk over, nudge; prop has its own simple physics).
- **Comfort item** (bed): declared as `Ambience.sleepSpot { x1, x2, cx }` —
  at nap time the cubeman *walks to it first*, then plays sleepEnter on it.
- **Living element** (swaying plant, pulsing sun): frame-based motion in the
  ambience draw — cheap, sells "the cube is alive".
- **Solids**: `Ambience.solids` declares LCD-space x spans furniture blocks;
  the wander range clamps against them (no pathfinding — props sit in
  margins, walk range just avoids them). Solids constrain *wandering only*,
  not travel — he walks in front of furniture when passing through a room.

## Scenes (rooms within a cube)

A cube is a **scene graph**: `Profession.scenes: Scene[]`, first = hub.
Every room declares typed edges — `scene` (internal door), `neighbor`
(cube exit, only the hub declares these; activates in P2), or `wall`.
Walking off an edge hard-cuts to the adjacent room (entering from the
opposite side) — the same handoff P2 uses between cubes.

- Stickman's cube: **living room (hub) ⇄ bedroom ⇄ bathroom**.
- Nap time routes through the graph: travel to the bedroom, walk to the
  `sleepSpot`, then sleep there. Room states (ball position) persist per
  scene; dynamic props draw only in their own room.
- Idle room-hopping: ~15% of wander events explore another room.

## Checklist for a new profession

1. Create `src/content/professions/<id>.ts`: 3 actions + chosen ambience.
2. Design an **ambience that contrasts** existing ones (night vs day, indoors vs outdoors).
3. Remember: all 3 actions will fire **spontaneously during idle** — each must
   read well without user context and express the profession's character.
4. Register in `index.ts`; wire its unlock into achievements (`game/achievements.ts`).
5. Check density: nothing important in y 10–40 center band; ground at `GROUND_Y`.
6. Verify all actions from idle, sleep-entry/wake chaining, and the 30s auto-sleep.
