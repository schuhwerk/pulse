# Workout Pulse

Single-file PWA. All code lives in `index.html`. Keep it that way — no build step, no bundler, deploys as one static file.

## Working with AI in this repo

To save tokens, **don't read the whole file**. Land in the right section first via `Grep`, then `Read` only that range with `offset`/`limit`. Edit diffs are cheap; whole-file reads are not.

## Finding sections in index.html

Sections are marked with greppable header comments. To jump to one, grep for its anchor and read 30–80 lines from the match:

```
Grep pattern="// ─── Player"     → jumps to the player section
Grep pattern="// ─── Audio"      → jumps to audio/beep
Grep pattern="<style>"            → jumps to CSS block
```

Anchors (script section comments — all match `^// ───`):

| Anchor (grep this)                  | Area                                                       |
|-------------------------------------|------------------------------------------------------------|
| `// ─── Service Worker`             | SW registration, update handling                           |
| `// ─── State`                      | constants, player state, hydration, share I/O              |
| `// ─── BUILTIN_TRAININGS`          | ~200 lines of exercise data — grep the next anchor to skip |
| `// ─── State / end-builtins`       | resumes State after the data block                         |
| `// ─── Navigation`                 | `load`, `save`, `routeHash`, `showView`                    |
| `// ─── Home View`                  | home rendering, training CRUD                              |
| `// ─── Detail View`                | detail rendering, exercise CRUD                            |
| `// ─── Reorder`                    | touch + mouse drag-reorder + tap-to-edit delegation        |
| `// ─── Add Exercise`               | wger search, filters, manual add                           |
| `// ─── Player`                     | start, prepause, exercise/rest cycle, finish               |
| `// ─── Audio`                      | `beep`, audio context lifecycle, volume                    |
| `// ─── Wake Lock`                  | screen wake lock + visibilitychange resync                 |
| `// ─── Settings / Import`          | settings modal, export/import, update check, reset         |
| `// ─── Modal`                      | modal open/close, esc                                      |
| `// ─── Helpers`                    | `autolink`, `wgerImg`, misc                                |
| `// ─── Init`                       | startup                                                    |

Non-script anchors: `<head>` (meta/manifest), `<style>` (all CSS), `<body>` (view markup).

**View HTML lives in `<body>`** (home, detail, player views, modal, toast). Grep `id="view-player"`, `id="view-detail"`, `id="view-home"` to jump to each. These don't have `// ───` anchors because they're outside the script block.

**Why anchors instead of line numbers**: line numbers go stale after every edit. Anchor comments do not. If you add a new section, add a matching `// ─── Name ───…` header so future greps still work.

When making a small change, prefer `Edit` with a tight `old_string` over rewriting larger blocks.

## Player state shape

The `pl` object (declared at the top of `// ─── State`) drives the player:

```
pl = { running, timer, tickAnchor, exerciseIdx, secondsLeft, isRest, isPrepause, training }
```

Phase is expressed as two booleans — only one is true at a time:

| Phase      | `isPrepause` | `isRest` | Notes                                                  |
|------------|--------------|----------|--------------------------------------------------------|
| GET READY  | `true`       | `false`  | 5s static pause at start; shows upcoming first exercise |
| EXERCISE   | `false`      | `false`  | active rep countdown                                   |
| REST       | `false`      | `true`   | between exercises; shows next exercise image           |

`beginPrepause` / `beginExercise` / `beginRest` set both flags explicitly. `startTick` uses `pl.tickAnchor = {startMs, startLeft, lastLeft}` so the timer stays accurate when `setInterval` is throttled in a backgrounded tab; the `visibilitychange` handler calls `tickStep()` to resync on return.

**`playerNext`** skips to the next segment in the natural flow (same order as `tickStep` expiry):
prepause → exercise 0 → rest 0 → exercise 1 → … → finishWorkout.

**`playerPrev`** works like an audio-player back button. "At start" is defined as `secondsLeft >= maxDur - 1` (within the first second of the segment):
- mid-segment → restart current segment
- at start, prepause → restart prepause
- at start, rest → `beginExercise()` (same `exerciseIdx` — the exercise that just finished)
- at start, exercise N > 0 → `exerciseIdx--; beginRest()` (the rest between N−1 and N)
- at start, exercise 0 → `beginPrepause()`

## Tests

Playwright specs live in `tests/*.spec.js`. Run with `bun run test`. Full details — fixtures, anchors, button indices, timing conventions — are in **[docs/TESTS.md](docs/TESTS.md)**.

**Any change to the player phase flow (prepause/exercise/rest transitions) requires updating `tests/player.spec.js` and usually `tests/smoke.spec.js`** — they assert specific `#pl-phase` text and click sequences. Each `test.describe` block has a `// ─── ` anchor comment you can grep to jump directly to the relevant section.

## Diagnostics / lint noise

`cspell.json` and `.htmlvalidate.json` are tuned to silence the project's intentional style (inline styles, implicit button types, project vocabulary like `Prepause`, `wger`, `svol`, etc.). If you introduce a new identifier that cspell flags, add it to `cspell.json` rather than letting it spam diagnostics on every edit.
