# 🎮 Cubeman - Actions by Profession & Room



# Action Type

An action is something a cubeman does, when:

- he/she is wandering around and spontaneous. In this mode, even SECRET actions can be triggered to hint the user that there is more to explore. 

- a button clicks - reaction to outside world
  
  - In general, the mid button click ramdomly select a action from doable actions list, but it should never perform the SECRET action (if there should be one)
  
  - The other two button always trigger a specific action.

- For some professions, there may be "SECREET" actions associated. But the secret action for these professions can only be 1. 

- SECRET actions are always triggered by button press combination and unlocks something else (achievement, new profession, etc)



To summarize:

| Action             | Can do spontaneously | Assigned to which button(s)         |
| ------------------ | -------------------- | ----------------------------------- |
| 1                  | Y                    | Left, Middle                        |
| 2                  | Y                    | Right, Middle                       |
| 3                  | Y                    | Middle                              |
| 4 (SECRET, if any) | Y                    | None. Only by button press sequence |

*Table 1: Action - Button Relations*

**Slot ordering rule:** the Living Room actions are numbered so effort always
ascends — slot 1 is the *easiest* (lowest stamina cost), slot 2 is *harder*,
slot 3 is the *hardest* of the three. This gives the Left button (slot 1, see
Table 1) a safe low-cost action and the Right button (slot 2/3) progressively
more demanding ones. Ties (e.g. Musician 5/5, Botanist 3/3/3) keep any stable
order; SECRET (slot 4) is exempt from the rule.

# Room Type

For now, each cube has 3 rooms:

- Living Room

- Bed Room

- Bath Room



To summarize:

| Room Type   | Actions performed | By which button     |
| ----------- | ----------------- | ------------------- |
| Living Room | 1/2/3/4 (SECRET)  | As shown in table 1 |
| Bed Room    | 1/2/3/4 (SECRET)  | As shown in table 1 |
| Bath Room   | 1/2/3/4 (SECRET)  | As shown in table 1 |



**Note:** Different rooms may have different actions, but for convenience, they are all numberd as 1/2/3/4, and 4 is for some professions and is always the secret action. 



# The final table

> "?" means the action is still missing
>
> Actions are numbered per Table 1. Effort shown in parentheses. 
> `[SECRET]` = triggered only by button combo, never by button click. 
> `[stand:X]` = requires stand distance X. `★` = sound-producing (Musician ×3 + Astronomer's Rocket Launch).

| Id | Profession/Action | Living Room | Bed Room | Bath Room |
| -- | ----------------- | ----------- | -------- | --------- |
| 1 | **Sam the Sportsman** | • 1: Cheeky Wave (2)<br>• 2: Cartwheel (6)<br>• 3: Backflip (8) | • Meditation *(spontaneous only)*<br>• 1: Shave (2) *(gent)*<br>• 2: Getting Dressed (3) *(gent: shirt, lady: blouse)*<br>• 3: ? *(reserved)* | • Shower<br>• Bath<br>• Meditation *(spontaneous only)* |
| 2 | **Dorian the Dancer** | • 1: Jazz Hands (3)<br>• 2: Moonwalk (5)<br>• 3: Pirouette (7) | • Meditation *(spontaneous only)*<br>• 1: Shave (2) *(gent)*<br>• 2: Getting Dressed (3) *(gent: shirt, lady: blouse)*<br>• 3: ? *(reserved)* | • Shower<br>• Bath<br>• Meditation *(spontaneous only)* |
| 3 | **Miles the Musician** | • 1: Symphony No. 5 ★ (4)<br>• 2: Air Guitar ★ (5)<br>• 3: Ode to Joy ★ (6) | • Meditation *(spontaneous only)*<br>• 1: Shave (2) *(gent)*<br>• 2: Getting Dressed (3) *(gent: shirt, lady: blouse)*<br>• 3: ? *(reserved)* | • Shower<br>• Bath<br>• Meditation *(spontaneous only)* |
| 4 | **Chester the Chef** | • 1: Chef's Kiss (2)<br>• 2: Taste Test (3)<br>• 3: Flambé (5) | • Meditation *(spontaneous only)*<br>• 1: Shave (2) *(gent)*<br>• 2: Getting Dressed (3) *(gent: shirt, lady: blouse)*<br>• 3: ? *(reserved)* | • Shower<br>• Bath<br>• Meditation *(spontaneous only)* |
| 5 | **Pablo the Painter** | • 1: Brush Flourish (3)<br>• 2: Easel Painting (4) `[stand:30]`<br>• 3: Splatter (5) | • Meditation *(spontaneous only)*<br>• 1: Shave (2) *(gent)*<br>• 2: Getting Dressed (3) *(gent: shirt, lady: blouse)*<br>• 3: ? *(reserved)* | • Shower<br>• Bath<br>• Meditation *(spontaneous only)* |
| 6 | **Appleby the Astronomer** | • 1: Constellation Trace (3)<br>• 2: Stargazing (4) `[stand:30]`<br>• 3: Meteor Sighting (5)<br>• 4: Rocket Launch (4) `[SECRET]` ★ | • Meditation *(spontaneous only)*<br>• 1: Shave (2) *(gent)*<br>• 2: Getting Dressed (3) *(gent: shirt, lady: blouse)*<br>• 3: ? *(reserved)* | • Shower<br>• Bath<br>• Meditation *(spontaneous only)* |
| 7 | **Merlin the Magician** | • 1: Wand Wave (3)<br>• 2: Rabbit Hat (4) `[stand:34]`<br>• 3: Smoke & Mirrors (5) *(vanish in a smoke puff, reappear a step aside — ✅ implemented)*<br>• 4: Levitate (4) `[SECRET]` ★ *(rises high into the sky while rotating 90°/180° — ✅ implemented)* | • Meditation *(spontaneous only)*<br>• 1: Shave (2) *(gent)*<br>• 2: Getting Dressed (3) *(gent: shirt, lady: blouse)*<br>• 3: ? *(reserved)* | • Shower<br>• Bath<br>• Meditation *(spontaneous only)* |
| 8 | **Briar the Botanist** | • 1: Water the Beds (2)<br>• 2: Snip (3)<br>• 3: Sunrise (4)<br>• 4: Superbloom (5) `[SECRET]` | • Meditation *(spontaneous only)*<br>• 1: Hair Combing (2) *(lady)*<br>• 2: Getting Dressed (3) *(gent: shirt, lady: blouse)*<br>• 3: ? *(reserved)* | • Shower<br>• Bath<br>• Meditation *(spontaneous only)* |
| 9 | **Laura the Lawyer** | • 1: Gavel (2)<br>• 2: Present the Brief (3)<br>• 3: Objection! (4) | • Meditation *(spontaneous only)*<br>• 1: Hair Combing (2) *(lady)*<br>• 2: Getting Dressed (3) *(gent: shirt, lady: blouse)*<br>• 3: ? *(reserved)* | • Shower<br>• Bath<br>• Meditation *(spontaneous only)* |

**Room-agnostic actions:**

- **Meditation** — 🔔 **DESIGN RULE (do not forget):** Meditation is done in
  the **Bed Room and Bath Room only**, and **only spontaneously** (wandering
  mode). It is **never** a button-assigned action and **never** a Living Room
  action. Every profession has it.
  - **Designed visual — "Stargazer's Trance":** he settles **cross-legged into a
    lotus**, then the seated pose drifts a short distance off the ground and
    **bobs gently — no rotation**. A soft pulsing halo above the head and tiny
    star-sparkles orbiting him. Dreamlike but humble. One shared animation
    + one star/halo overlay for all 9 professions. Effort 2 (low; recovery
    action — 0 would break the tired-mode cheap-action weighting).
    **Rotation is Levitate's signature — Meditation never spins.**
    (Levitate itself stays a Magician-EXCLUSIVE secret: he rises high into
    the sky while rotating 90°/180° — the two must never be confused.)
- **Sam (Sportsman):** Backflip, Cartwheel, Cheeky Wave — no room restriction
- **Dorian (Dancer):** Pirouette, Moonwalk, Jazz Hands — no room restriction
- **Bathroom** (Shower, Bath) — available to all professions

**Bed Room:** first entries are in — Meditation (spontaneous only) for all,
plus two button-assigned actions, common to all professions with a lady/gent
variant each (following the same ascending-effort rule as the Living Room):

- **Meditation (spontaneous only)** — all professions, per the 🔔 rule above
- **1: Grooming (2)** — button-assigned. Gent: **Shave**; Lady: **Hair Combing**.
  Short mirror action, few frames.
- **2: Getting Dressed (3)** — button-assigned. Gent: putting on a **shirt**;
  Lady: putting on a **blouse**. One animation skeleton per variant; reuses the
  existing per-profession `presentation` body layer for the silhouette, so the
  animation authoring effort stays moderate (arm-raise + torso sweep, ~2x the
  grooming action).

Animation-effort note: each bedroom action needs 2 authored variants
(lady/gent), but the skeleton/timing is shared, so the real cost is 2 short
overlay variants per action, not 9 unique animations.

**Slot 3 of the Bed Room is RESERVED** — no action designed yet. One more
button-assigned slot (effort > 3 to keep the ascending rule) is set aside for
future ideas (e.g., bedtime-themed: reading a book, fluffing the pillow,
winding the alarm clock, saying goodnight).

All other Bed Room actions are still pending design. No code changes made —
design stage only.


