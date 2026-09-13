# Tests

Playwright end-to-end specs. All tests run in a real browser (Chromium) against the live `index.html`.

## Running

```
bun run test          # all specs, parallel workers
bun run test --ui     # interactive Playwright UI
bun run test tests/player.spec.js   # single file
```

## Fixtures (`tests/fixtures.js`)

`fixtures.js` provides the shared `test` fixture plus helpers:

| Export | Purpose |
|---|---|
| `test` | Extended Playwright `test`; stubs `AudioContext`, `navigator.wakeLock`, blocks wger network, disables SW |
| `seedState(page, state)` | Writes `pulse_data` to `localStorage` before `page.goto` — only seeds if empty so in-test mutations survive reloads |
| `makeTraining(overrides?)` | Returns a training with two exercises: **Alpha** (2 s) and **Bravo** (2 s), rest 1 s. Pass `overrides` to change exercises, durations, etc. |
| `makeState(trainings?)` | Wraps one or more trainings into the full app state shape |
| `APP_VERSION` | Extracted live from `index.html` — use this in tests that care about version strings |

Exercise defaults: `s: 2`, `restSeconds: 1`. The full 2-exercise workout finishes in ~6 real seconds.

## Spec files and anchors

Each `test.describe` block is prefixed with a greppable `// ─── ` anchor (same convention as `index.html`). To jump to a section: grep the anchor, then `Read` ~40 lines from the match.

| Anchor (grep this) | File | What it covers |
|---|---|---|
| `// ─── smoke: create → play → finish` | `smoke.spec.js` | Home renders, create training via FAB, add exercise, reach player, localStorage persistence, share-link helpers |
| `// ─── training CRUD` | `crud.spec.js` | Duration +10/−10, duplicate/remove exercise, delete/duplicate training, rename |
| `// ─── player: cycle, pause, skip, exit` | `player.spec.js` | Full exercise→rest→done cycle, pause halts timer, next-skip, exit to detail |
| `// ─── player: playerPrev navigation` | `player.spec.js` | Audio-player-style back: mid-segment restart vs. prev-segment navigation; uses 10 s exercises |
| `// ─── player: edge cases` | `player.spec.js` | Refuses to start with no exercises |
| `// ─── settings` | `settings.spec.js` | Volume persistence, reset-all, auto-update toggle, builtin-update modal (keep/update), ESC close |
| `// ─── share links & import` | `share-import.spec.js` | Share-link import confirm modal, invalid link toast, JSON backup overwrite, round-trip payload |

## Player test conventions

- **Skip prepause**: `page.locator('.player-controls button').nth(2).click()` (the Next button, index 2). All player tests that aren't specifically testing prepause call this first.
- **Button indices** in `.player-controls`: `nth(0)` = Prev, `nth(1)` = Play/Pause, `nth(2)` = Next.
- **Phase assertions**: check `#pl-phase` for `GET READY` / `EXERCISE` / `REST` / `DONE`.
- **Phase flow changes** (prepause/exercise/rest transitions, `playerPrev`/`playerNext` logic) require updating `player.spec.js`. Structural changes (e.g. adding a phase) usually also touch `smoke.spec.js`.
- **Timing**: `tickStep` fires every 1 000 ms from a wall-clock anchor. The `atStart` threshold in `playerPrev` is `secondsLeft >= maxDur - 1` — with 2 s default exercises this is always true; use `s: 10` exercises (as in the `playerPrev` describe) to test mid-segment state.

## What is NOT tested

- Audio (AudioContext is stubbed to a no-op)
- Wake lock (stubbed)
- Service worker / cache (SW blocked with 404)
- wger exercise search (network blocked, returns `{ results: [] }`)
- Drag-reorder (no Playwright touch/drag coverage yet)
