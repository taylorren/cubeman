---
name: add-profession
description: Checklist for adding a new cubeman profession (character) to this repo. Use when the user asks to add a new profession/cubeman/resident/character. Captures every integration point, including the ones historically overlooked (avatar frame, button colors, naming, shelf balance).
---

# Adding a new cubeman profession

Every profession follows the same integration surface. This skill records the
full checklist — including the spots that were **missed in past sessions**
(marked ⚠️ OVERLOOKED) so they don't get missed again.

## 0. Gather context first

Read before writing anything:

- `docs/cubeman-design-guide.md` — profession anatomy, density rules, "Checklist
  for a new profession" section
- `src/content/professions/types.ts` — `Profession`, `Action`, `Scene` shapes
- `src/content/professions/shared.ts` — reusable `idle`, `sleep`, `walk`,
  `shower`, `bath`, `makeLivingRoom`, `bedroom`, `bathroom`, `rectOutline`
- The most recent profession file (e.g. `src/content/professions/astronomer.ts`)
  as the reference pattern for pose keys and scene drawing

## 1. Naming rules

- The resident's name MUST alliterate with the profession
  (Sticko/Stickman, Dizzy/Dancer, Maestro/Musician, Chandler/Chef,
  Pablo/Painter, Appleby/Astronomer).
- The unlock achievement name should also read well and its `desc` must end
  with "— unlocks the <Profession>!".
- Cube IDs follow the even-number pattern: `cube-0`, `cube-2`, … next free:
  `cube-12`. IDs are persisted in save data — never renumber existing ones.
  Resident NAMES are display-only (save keys use cube IDs) and may be renamed.

## 2. The profession file — `src/content/professions/<id>.ts`

- Exactly 3 signature actions (+ shared `shower`, `bath`). Each must read well
  when fired spontaneously from idle — no context, no user input.
- Actions restricted to a room set `room: 'living'` etc.; actions that must
  line up with scenery set `stand: <x>`.
- Hub = `makeLivingRoom(draw)`; scenes: `[livingRoom, bedroom, bathroom]`
  (first is hub, ids are fixed). Respect density: nothing important in the
  y 10–40 center band; floor at y 46–47; 48×48 LCD space.
- Contrast the existing professions' rooms (day/night, indoor/outdoor).
- Export `export const <id>: Profession` with `id`, `name`, `actions`, `idle`,
  `sleep`, `scenes`.

## 3. Registration & unlock (4 files)

1. `src/content/professions/index.ts` — import + add to `professions` record.
2. `src/game/achievements.ts` — add to `LIST`, threshold follows the ladder
   (10, 20, 30, 40, 50, …):
   ```ts
   { id: '<id-unlock>', name: '<Name>', desc: 'Perform <N> total actions — unlocks the <Profession>!', test: (_c, total) => total >= <N> },
   ```
3. `src/main.ts` — add to `definitions`:
   ```ts
   { id: 'cube-<n>', name: '<ResidentName>', professionId: '<id>', unlock: '<id-unlock>' },
   ```
4. ⚠️ OVERLOOKED — `src/game/shelf-progression.ts`: `MAX_CUBEMEN` (currently 4)
   hardcodes the final shelf tier's "all cubemen visited all others" condition.
   With each new resident, decide whether to bump it or the tier condition is
   intentionally loosened. Surface this to the user; don't silently leave it
   stale.

## 4. Styling — `src/style.css` (⚠️ historically missed 2 of 3 spots)

The frame color per profession (`#hex`) must be applied in THREE places:

1. Cube shell frame:
   ```css
   .cube-<id> { background: #hex; }
   ```
2. ⚠️ OVERLOOKED — control buttons must match the frame (without this the
   buttons fall back to default blue and clash with every non-blue cube):
   ```css
   .cube-<id> .btn {
     background: linear-gradient(#lighter, #hex 60%, #darker);
     box-shadow:
       inset 0 2px 1px rgba(255, 255, 255, 0.4),
       inset 0 -3px 4px rgba(<dark-tint-of-hex>, 0.5),
       0 4px 0 #darkest,
       0 7px 10px rgba(0, 0, 0, 0.35);
   }
   .cube-<id> .btn:active {
     box-shadow:
       inset 0 2px 1px rgba(255, 255, 255, 0.3),
       inset 0 -2px 3px rgba(<dark-tint-of-hex>, 0.45),
       0 1px 0 #darkest,
       0 2px 4px rgba(0, 0, 0, 0.35);
   }
   ```
   Copy the Dancer/Chef blocks and swap the four color values.
3. ⚠️ OVERLOOKED — roster avatar frame in the right rail (`renderRoster()`
   emits `chip-face-<profession>`; without this the avatar frame falls back to
   default blue and collides with Painter):
   ```css
   .chip-face-<id> { border-color: #hex; }
   ```

Pick a frame color distinct from all existing ones (green #15803d,
purple #7640a8, amber #b45309, red #b91c1c, blue #274bb0, indigo #4338ca)
and thematically fitting the profession's room.

## 5. Validate

```bash
npm run build        # tsc --noEmit + vite build — must be clean
npm run sim          # social-sim headless — must PASS
npm run sim:goto     # goto-room-sim headless — must PASS
```

Then verify in the browser (`npm run dev`):

- Unlock the new resident (`cubemanDebug.progress()` shows thresholds; the
  fastest path is manually testing with a fresh `cubemanDebug.resetProgress()`
  or temporarily lowering the threshold).
- All 3 actions fire from idle and from their buttons; buttons match frame.
- Roster avatar frame matches the cube frame (⚠️ the spot most often missed).
- Sleep-entry/wake chaining and the 60s auto-sleep still route to the bedroom.
- Room navigation: living ⇄ bedroom ⇄ bathroom, ladder/doors between cubes.

## 6. Things that are NOT part of a new profession

- No favicon/AI indexing/SEO changes needed.
- No persistence migrations: saves key by cube ID; new resident simply won't
  exist in old saves until unlocked (that's expected).
- `cubemanDebug` console commands (`progress`, `goToRoom`, `snapshot`) pick up
  the new resident automatically.
