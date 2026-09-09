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
  scenes: Scene[];          // rooms of the home cube; first = hub/entry room
}
```

Register new professions in `src/content/professions/index.ts`.

### Shared behaviors (never re-author)

From `shared.ts`: `idle` (breathe/glance), `sleep` (lying + foot twitch),
`sleepEnter` (sit → slump → lie), `wake` (lie → sit → stretch).
Every profession gets them by importing; the state machine auto-sleeps after
60s idle and chains wake → action on any button press.

### Body presentation (gender/clothing silhouettes)

The skeleton is a gender-neutral stick figure. To give a profession a
distinct **silhouette** — haircut, a skirt, an apron — add a
`presentation?: BodyOverlay` to it:

```ts
type BodyOverlay = (ctx, frame, s: Skeleton) => void;
```

It is drawn right after the skeleton **in the same body-scale transform** and
gets the cubeman's *current rendered pose* (already shifted to its screen
position), so you anchor shapes to the live `head`/`hip` joints and they track
every animation — idle sway, wandering, actions, sleep. The Botanist uses it
for a bob with a flower clip and an A-line skirt:

```ts
const presentation: BodyOverlay = (ctx, frame, s) => {
  hair(ctx, s.head[0], s.head[1]);   // drawn around the live head joint
  skirt(ctx, s.hip[0], s.hip[1]);    // flared from the live hip joint
};
```

Because it inherits the body-scale transform, it renders inside every drawing
path automatically (main display, visits, roster chips). Everything is the
same on-color, so it reads as a silhouette extension of the figure rather than
a costume overlay.

### Actions

```ts
{ id: 'backflip', name: 'Backflip', anim: { dur: 30, loop: false, keys: [...] } }
```

Name actions by their personality, not just mechanics ("Cheeky Wave" > "Wave").

Full `Action` shape (`src/content/professions/types.ts`):

```ts
interface Action {
  id: string; name: string;
  anim: Anim;                 // one-shot (loop: false)
  effort?: number;            // stamina cost, drives autonomous trick selection (default 8)
  room?: string;              // restrict to a scene id (e.g. 'bathroom') — a no-op elsewhere
  stand?: number;             // body-center SCREEN x to snap to before the animation plays
  front?: Overlay;            // LCD-space overlay drawn OVER the cubeman while it plays
  regen?: number;             // stamina recovered per tick while playing (sleep is the main channel)
  sound?: SoundId;            // synthesized sound to play on action start (Musician only)
}
```

Special fields used by the shared bathroom actions (import `shower`/`bath` from
`shared.ts` — they live in every cube):

- **`stand`** — fixture actions perform *at* a fixed spot so the overlay lines up
  with the scenery (the shower head, the tub). The cubeman snaps to `stand`
  before the animation starts; afterwards it strolls back out under its own
  wander logic.
- **`front`** — a per-sprite overlay drawn in full 48×48 LCD space *over* this
  cubeman while the action plays (the same channel as the sleep "Z z z").
  It can occlude or streak across the skeleton without touching the shared
  backdrop or other occupants:
  - the **shower** (`stand` under the head) streams animated falling water
    straight off the showerhead onto him;
  - the **bath** (`stand` in the tub) sinks him with a *living ceramic-tile
    mosaic* (a white-grout running bond carving a dark fill into staggered LCD
    tiles) so his lowered body reads as submerged tiling rather than a solid
    black mask — drift of the water line, a glint of light cascading down the
    tiles, and rising suds keep it animated. Its soak is intentionally LONG
    (~96 frames) and reads as: climb in → splash → settle → breathe gently —
    then Rise & stand out.
  - **Bath & shower also restore stamina** (`regen` per tick) while they play —
    a second recovery channel alongside sleep. Sleep remains the main charge;
    a therapeutic soak (bath, `regen: 8/30`) refills faster than a shower
    (`regen: 4/30`), making a trip to the bathroom a real refuel.

### Sound

Only the **Musician** profession produces sound — sparse by design (no footsteps,
UI blips, or ambient). Each of its three actions triggers a synthesized sound
via Web Audio API (`src/core/sound.ts`) — no audio files, just like the visuals
are synthesized pixels. The `Action.sound` field opts in; the action system
plays it on start.

| Action | Sound | Effort | Duration |
|--------|-------|--------|----------|
| Symphony No. 5 | Beethoven's G-G-G-Eb motif (brassy sawtooths) | 5 | 72 frames |
| Air Guitar | Classic rock solo (power chord → bend → run → sustain) | 4 | 84 frames |
| Ode to Joy | Beethoven's 9th melody (warm choir tones) | 6 | 96 frames |

All three are room-locked to the living room (where the keyboard and speakers
are). The shared `shower` and `bath` stay silent.

### Scenes (ambience per room)

```ts
interface Ambience { id: string; name: string; draw: Overlay;
  sleepSpot?: { x1: number; x2: number; cx: number };  // where he naps
  solids?: Array<[number, number]>;                    // unwalkable furniture spans
}
interface Scene extends Ambience {
  left: SceneEdge; right: SceneEdge;  // 'scene' | 'neighbor' | 'wall'
}
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
                            (counts toward achievements; does NOT reset sleep timer;
                            skipped below EXHAUSTED stamina, biased low-effort when tired)
idle → walk → idle          every 2.5–6s in idle, he strolls to a random spot
                            (shared `walk` cycle + shiftX; position is persistent;
                            targets clamp to the room's walkable range around solids;
                            short hops when tired)
idle → sleepEnter → sleep   after 60s without USER interaction OR stamina < SLEEP_AT,
                            he travels to the bedroom and lies down on its
                            `sleepSpot` (never sleeps standing wherever he happens
                            to be — except a stamina flop, see below)
sleep → wake                when rested: full tank (bed) or partial (flop), then stretch
sleep/wake → (stretch) → pressed action     any press wakes
```

Modes chain via `onEnd` callbacks inside the `Cubeman` runtime
(`src/game/cubeman.ts`) — the same machinery that drives walk-to-edge →
cross-cube visits, and `src/game/shelf.ts` resolves where a `neighbor` exit
leads. Each cubeman runs its own state machine; there is no module-level
gameplay state.

## Stamina (hidden energy budget, `src/game/stamina.ts`)

The cubeman has an invisible 0–100 `stamina` that shapes his **autonomous**
life. It is never shown as a bar — tiredness is communicated only through
behavior. **User presses always perform** (and still cost energy); only
self-directed behavior respects the budget. Target balance: **~2–3 minutes of
awake life per nap, 15–20s naps**. Stamina changes personality *before* it
interrupts activity.

- **Spending**: per-action `effort` (Stickman: backflip 8, cartwheel 6, wave 2;
  default 8), ball kick 2, walking 0.05 per screen pixel, room crossing 0.5.
- **Recovery**: **sleep is the ONLY recovery channel** — 4/s of sleep
  (bed: 25→90 in ~16s; flop: 8→55 in ~12s). Standing around regenerates
  nothing.
- **Tired (<55)**: tricks scheduled 1.4× farther apart and weighted toward
  cheaper ones (flips stay possible, just rarer); strolls become short hops.
- **Exhausted (<30)**: no autonomous tricks — gentle wandering only.
- **Bed (<25)**: walks to the bedroom and sleeps (even under active play).
- **Flop (<8)**: too drained to reach the bed — lies down *where he is*.
- **Waking**: bed at 90, flop at 55; naps last ≥6s before auto-waking
  (a press interrupts immediately).
- **Interaction priority**: every accepted press starts a 10s grace period in
  which neither bed-routing nor flopping begins; when the player stops,
  recovery resumes naturally.
- **Boredom**: after 180s of no interaction he naps too (independent of
  stamina; boring ≠ tired, both lead to naps).

Tune all thresholds/costs in `STAMINA` (one config object). New professions:
give each action an `effort` that reflects its spectacle. **One `Stamina`
instance per cubeman** — energy budgets are fully independent, even while
one cubeman visits another's cube (the visitor keeps its own tank, and only
it sleeps in its own bed). Regeneration happens in the `Cubeman` tick.

**Spontaneity contract**: idle is not static — the cubeman performs a random
one of its own `actions` every 6–14 seconds. Consequences for content:

- Every action in the pool **must look good unprompted** (it may play with no
  user watching context, e.g. as the opener of a session).
- Spontaneous actions count toward achievements — so the action pool is also
  the idle personality. A profession's character emerges from what it does
  when nobody clicks.
- Auto-sleep still wins if the user walks away: **spontaneous actions do not
  reset the sleep timer** (only real user presses do), so an ignored cubeman
  still dozes off after 60s. Tune `SLEEP_AFTER_MS` / `SPONTANEOUS_*_MS` /
  `WANDER_*_MS` in `main.ts`, not the animations.
- **Timer independence**: the spontaneous deadline survives any amount of
  wandering/ball-play/room-hopping — only an *actual* action (spontaneous or
  user-triggered, via `startAction`) reschedules it. Wandering re-arms only
  its own timer, so walks can never starve tricks.
- **Wandering**: idle alternates between pausing (breathe/glance) and strolling
  to a random spot via the shared `walk` cycle, moved with `shiftX`. All
  position changes happen at render time — poses are authored at x=0 and never
  hand-shifted. Targets are body-center screen x values clamped to the room's
  walkable range (`walkableCx()` = 5–43 minus `solids` margins).
- **Stage discipline**: actions are checked for horizontal reach
  (`animExtent` — max joint |x−24| over keyframes) *plus rendered thickness*
  (limb stroke half-width, head disc — `LCD.LIMB_RADIUS` / `HEAD_RADIUS`) and
  get a *safe body-center band*; if the cubeman stands outside it (e.g. against
  a wall), he first strolls back toward center stage, then performs. So wide
  moves (cartwheel) are never clipped by the bezel, and narrow spots near
  furniture still allow standing/idling. Intentional room-crossing walks off
  the screen edge are exempt — they use `startWalkTo` directly, not
  `runAction`.
- **Room-locked + fixture actions**: an action with `room` set (shower/bath)
  only plays *in* that room — elsewhere the press is a no-op (`action.rejected`
  is logged). An action with `stand` set snaps the cubeman to that fixture
  spot before playing (bypassing the center-stage band), because its `front`
  overlay is authored to align with scenery there. Both checks live in
  `runAction`, shared by user and spontaneous triggers.

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
- The **bathroom** keeps one clear water fixture up top — a ceiling-mounted
  花洒 directly above where the cubeman stands to shower — plus the bathtub on
  the right (declared a `solid`) and a bath mat. Avoid clustering several
  similar small shapes near one another (they started blurring together on the
  48px grid); a single readable fixture reads better than two ambiguous ones.
- Nap time routes through the graph: travel to the bedroom, walk to the
  `sleepSpot`, then sleep there. Room states (ball position) persist per
  scene; dynamic props draw only in their own room.
- Idle room-hopping: ~15% of wander events explore another room.

## Checklist for a new profession

1. Create `src/content/professions/<id>.ts`: 3 actions + the room scenes
   (`shared.ts` exports reusable rooms — import `idle`/`sleep` too).
2. Design **scenes that contrast** existing ones (night vs day, indoors vs
   outdoors); give the hub the `neighbor` edges for P2, internal rooms `scene`
   edges; declare `sleepSpot` + `solids` for furniture.
3. Remember: all 3 actions will fire **spontaneously during idle** — each must
   read well without user context and express the profession's character.
4. Register in `index.ts`; wire its unlock into achievements (`game/achievements.ts`).
5. Check density: nothing important in y 10–40 center band; ground at `GROUND_Y`.
6. Verify all actions from idle, sleep-entry/wake chaining, and the 60s auto-sleep.

## Two cubes, a shelf, and visiting (current phase)

The toy is now a small ecosystem of independent runtimes — not one big state
object. The split keeps character state and world state evolving separately:

- **`Cubeman`** (`src/game/cubeman.ts`) — one per character. Owns animation
  mode, position (`x`), stamina, timers, sleep, and the `home` cube. Its
  *current* cube is tracked separately from `home`, so visiting never changes
  ownership. Two `Cubeman` instances (Sticko & Pip) each use the Stickman
  profession for now.
- **`Cube`** (`src/game/cube.ts`) — one per toy. Owns rooms and props: the
  ball belongs to the living room and rolls even when the cube is empty. The
  room on display (`currentSceneId`) belongs to the cube, not any one cubeman.
- **`Shelf`** (`src/game/shelf.ts`) — a **row-major grid** of slots. Connections
  are derived from grid adjacency, never scene-array ordering: left/right stay
  within the same row; up/down move by `columns` slots. No diagonal connections
  or wrapping across row boundaries are allowed. `neighborOf(cube, dir)` returns
  a cube only when that adjacent slot is occupied. A cube is home to one
  resident plus **at most one visitor**, and is **closed** (curtained) while its
  resident is away.
  `Shelf.columns` drives both neighbor lookup and the CSS column count.
  **Multi-hop travel**: `pathTo(from, to)` searches the adjacency graph
  breadth-first (fewest hops wins; the shelf is tiny, 3×3 at most) and
  returns the legs of a route. Intermediate
  cubes must be *traversable*: resident home, no visitor inside, no guest
  inbound — you can't walk through a curtained room or through a room about to
  host a visit. The destination's acceptance is checked separately via
  `canAcceptVisitor`.
- **`ShelfProgression`** (`src/game/shelf-progression.ts`) — the shelf is always a
  **3×3 grid (9 slots)**. Progression unlocks more open slots as cubemen build
  social connections through visits:

  | Tier | Open | Locked | Name | Unlock condition |
  |------|------|--------|------|------------------|
  | 0 | 4 | 5 | Cozy Corner | Default (start) |
  | 1 | 6 | 3 | Growing Room | 4 different rooms have each received a visitor |
  | 2 | 7 | 2 | Social Circle | 1 cubeman has visited all other 3 |
  | 3 | 8 | 1 | Busy Block | 2 cubemen have visited all other 3 |
  | 4 | 9 | 0 | Grand Stage | All 4 cubemen visited all others, 20+ total visits |

  Locked slots render as greyed-out placeholders with a 🔒 icon and are
  non-interactive. The initial layout is:
  ```
  O O L
  O O L
  L L L
  ```
  where O = open slot, L = locked slot. When a visit completes, `checkTierUp()`
  fires and the shelf re-renders with more slots unlocked.
- **`Stamina`** (`src/game/stamina.ts`) — per-cubeman energy (see above).
- **Rendering** (`src/render/lcd.ts`, `src/main.ts`) — `LCD.drawBatch`
  composites several skeletons over one shared backdrop: a cube's display
  draws its current room, then **every** cubeman standing in it (resident +
  visitor, i.e. shared-room occupancy). A closed cube draws a curtain instead.
  Each sprite may carry its **own `front` overlay** (full 48×48 LCD space,
  drawn *over* just that cubeman) — used for the sleep "Z z z" and for
  in-progress action effects like the shower's water and the bath's tub wall.
  Cross-cube travel is animated as **room scenery driven by the CUBE**:
  `doorFx` (a doorway in the exit/entry side wall that opens, holds, closes)
  and `ladderOn` (the ceiling/floor hatch ladder, shown while a cubeman
  climbs in or out — the climber's pose slides vertically via `shiftY`).

**Autonomous visit** — a first-class cubeman behavior (not a button press),
coordinated by `VisitSession` (`src/game/visit.ts`). The model:

1. **A decides** — from its home living room, an idle cubeman sometimes picks a
   destination: any placed cube that `canAcceptVisitor` and is reachable via
   `pathTo` — an adjacent cube, or a multi-hop route through traversable
   cubes. Self-guards: only from home + living room, and never while a guest
   is already inbound (the host stays home to receive them).
2. **The trip** — A walks the route leg by leg (`travelRoute`): at each
   boundary the door opens on the correct side or the ladder hatch appears,
   the cubeman crosses, and the door closes behind. Each crossing costs
   `STAMINA.COST_CROSS`. `visitTarget` is set from departure to full arrival —
   it is how the shelf and other cubemen see an inbound guest (state alone
   can't, because the visitor's cube only changes at the crossing itself).
   Travel time is NOT stay time: the visit clock starts on arrival.
3. **The session** — when A has strolled into B's living room, the session
   starts: both are marked `inVisit` (A's solo autonomy is suspended, A's
   buttons go dead), pinned to B's living room, and social beats (chat/wave)
   fire every 5–9s.
4. **B not home / no route** → nothing happens; A continues its solo life.

The session ends on a 20–40s timer, or earlier if the visitor is tired (it goes
home to sleep). **Returning home is always allowed** — a cubeman can never be
stranded: the return also walks the multi-hop route (`returnHome` uses
`pathTo`; the teleport fallback exists only for the pathological case of the
home cube leaving the shelf mid-visit).

Internal room doors (`scene` edges) still use the scene graph within a cube;
`neighbor` edges and the shelf handle the cross-cube hop, kept distinct from
scene ordering.

**Headless regression sim** — `pnpm sim` (scripts/social-sim.mjs) loads the
game modules through Vite with stubbed browser globals and a fake clock, runs
a line layout where outer cubes require a 2-hop visit, and asserts: in-session
visitors always have a home host, multi-hop visits occur, and nobody ends up
stranded. Run it after any change to `Shelf`, `Cubeman` travel, or
`VisitSession`.


## Debugging cubeman behavior

Logging is enabled by default and records **visit boundaries only**: one
`visit.started` entry and one `visit.closed` entry per completed visit. No
spawn, movement, action, sleep, social-beat, or periodic status entries are
written. A fresh log file appears when the first visit starts, not at startup.
Open with `?debug=0` to disable logging, or run
`window.cubemanDebug.disable()` in the browser's developer console to stop it
for the current page. Use `window.cubemanDebug.enable()` to resume. Filter the
console by `[cubeman]`. While running `pnpm dev` or `pnpm preview`, events are
also posted to the local Vite server and appended to
`logs/cubeman-YYYY-MM-DD.jsonl` (UTC date). Each line is one JSON event. These
files survive page reloads and server restarts and are excluded from Git.

Events include a page-session ID, sequence number, UTC timestamp, visit ID,
host/visitor names, the visitor's home/current cube and room, and the visit's
end deadline. The start records its planned duration; the end records elapsed
time, timeout/tired/manual termination, whether sleep follows, and whether the
visitor actually returned home.

For a visitor that appears stuck, match `visit.started` with `visit.closed`
using its page-session and visit IDs. Full live state remains available through
`snapshot()` without adding entries to the log.

Browser console commands:

```js
window.cubemanDebug.snapshot() // current cubemen and active visits, even when logging is off
window.cubemanDebug.goToRoom('Sticko', 'bathroom') // order a cubeman to walk to one of its rooms (id or name)
copy(window.cubemanDebug.export()) // copy the latest 500 events as JSON (DevTools helper)
await window.cubemanDebug.flush() // wait for outstanding disk writes; rejects on failed delivery
window.cubemanDebug.status() // pending/written/failed counts and the latest delivery error
window.cubemanDebug.clear() // clear console-export history, NOT disk files
window.cubemanDebug.disable() // stop recording and console output
```

The console-export buffer retains the latest 500 events from the current page;
the disk files retain all successfully delivered events across pages and tabs.
Use the page-session ID together with a visit ID to correlate visits across
reloads. Enabling logging midway through a session records only subsequent
boundaries; it cannot recover earlier events. Reloading enables logging again unless the
URL contains `?debug=0`.

Writes are dispatched immediately, with keepalive requests for navigation.
Before deliberately reloading to investigate a problem, await `flush()` to
confirm outstanding writes have completed. Delivery or disk errors appear in
the console and `status()`; failed events may still be available in `export()`.
A static-only deployment needs an equivalent `/__cubeman/logs` backend: the
Vite logging endpoint is available in dev and preview, not in static build files.
Daily log files are not automatically deleted; remove old files when no longer
needed.
