# Cubeman — Retro Cube Toy Simulation

A tiny browser toy where cubemen live in LCD cubes, build their own routines,
and (with a bit of prodding) unlock more roommates. Everything — sprites,
rooms, and sound — is synthesized at runtime, in the retro style of a classic
segment-display toy.

This README covers only **installing** and **playing**. For the internals, see
`docs/cubeman-design-guide.md`.

---

## Install

Requires **Node.js 18+** and **pnpm** (the repo uses pnpm workspaces).

```bash
# 1. Clone or copy the repo
git clone https://github.com/taylorren/cubeman.git
cd cubeman

# 2. Install dependencies
pnpm install

# 3. Start the dev server
pnpm dev
```

Then open the printed URL (usually `http://localhost:5173`) in your browser.

### Production build (optional)

```bash
pnpm build      # type-checks + builds to dist/
pnpm preview    # serve the production build
```

---

## How to play

You are given a shelf and one roommate, **Sam**. Everything else is earned.

### The shelf & the cubes

- The **shelf** holds up to 9 cubes arranged in a grid. Each cube is one
  cubeman's home — a little 3-room apartment (living room ⇄ bedroom ⇄
  bathroom) shown on its tiny LCD screen.
- **Open slots are light; locked slots are dim.** The shelf starts at 2×2
  (4 slots). Expand it by building friendships (see *Visits* below).
- Click a cube to select it.
- Pin a cube's buttons to make its cubeman act; he also acts on his own when
  idle.

### The controls on each cube

Every cube has **three buttons** below its screen — two action buttons
(left/right) and a **surprise (★)** button in the middle that plays one of its
actions at random.

- Left / right button → performs that specific action.
- ★ → a random action.
- Actions cost **stamina**; a tired cubeman recovers by **sleeping** (he
  wanders to bed near lights-out, or when exhausted) and **showering/bathing**
  in the bathroom.

### The cubemen roster (right rail)

The roster lists every cubeman with their frame color, an avatar, and their
status:

- A normal entry shows where they live: **Room N**.
- While out visiting, it shows **Room N → Room M** in gold.
- **Locked** entries show `?` and their unlock requirement.
- Use the **Move / Place / Store** buttons (or drag) to rearrange which
  resident lives in which slot. Two cubes are neighbors if they touch.

### Achievements (left rail)

The Achievements panel is a ladder — you always see your **current** goal and
the **next** one. Achieved ones hide by default; flip the small toggle in the
panel header to show everything.

Earning achievements unlocks **new cubemen**, each with their own profession:
a unique set of actions and a themed room.

| Resident | Profession | How to unlock |
| --- | --- | --- |
| Sam | Sportsman | Available from the start |
| Dorian | Dancer | 10 actions |
| Miles | Musician | 20 actions |
| Chester | Chef | 30 actions |
| Pablo | Painter | 40 actions |
| Appleby | Astronomer | 50 actions |
| Merlin | Magician | *A secret on Appleby's cube…* |
| Briar | Botanist | 60 actions |
| Laura | Lawyer | *A secret on Briar's cube…* |

(Only actions **you** trigger with the buttons count toward these — a cubeman
acting on their own doesn't earn progress.)

### Visits (expand the shelf)

Cubemen will journey to visit each other when two neighbors are friendly.
Every completed visit makes progress toward **shelf expansion tiers**, which
open more slots and unlock the corresponding achievement:

- **4 different rooms host a visitor** → 6 slots
- One cubeman visits everyone → 7 slots
- More visits open 8 and 9 slots.

Arrange residents next to each other to get the invites flowing.

---

## License

Released under the [MIT License](./LICENSE).

---

## Clearing your progress

Want a fresh start? In the browser DevTools console run:

```js
cubemanDebug.resetProgress()
```

This wipes achievements, shelf tier, and placed layout, then reloads — leaving
you with just Sam in the 2×2 corner. Other handy commands live on
`cubemanDebug` (`progress()`, `goToRoom(name, room)`, `snapshot()`, `audio()`).