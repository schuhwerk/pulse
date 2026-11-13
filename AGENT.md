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
| `// ─── Reorder`                    | long-press drag-reorder + tap for exercises and trainings (`REORDER_LISTS`) |
| `// ─── Add Exercise`               | wger search, filters, manual add                           |
| `// ─── Exercise Form`              | shared form for Manual add + Edit (emoji tile, image URL)  |
| `// ─── Player`                     | start, prepause, exercise/rest cycle, finish               |
| `// ─── Player slide / swipe`        | `viewAt`/`slideTo` card + Up-next badge transitions, horizontal swipe |
| `// ─── Audio`                      | `beep`, audio context lifecycle, volume                    |
| `// ─── Wake Lock`                  | screen wake lock + visibilitychange resync                 |
| `// ─── Settings / Import`          | settings modal, export/import, update check, reset         |
| `// ─── Modal`                      | modal open/close, esc                                      |
| `// ─── Unsaved-changes guard`    | `guardForm`/`confirmDiscard`, beforeunload, add-view leave |
| `// ─── Helpers`                    | `autolink`, `wgerImg`, misc                                |
| `// ─── Init`                       | startup                                                    |

Non-script anchors: `<head>` (meta/manifest), `<style>` (all CSS), `<body>` (view markup).

**View HTML lives in `<body>`** (home, detail, player views, modal, toast). Grep `id="view-player"`, `id="view-detail"`, `id="view-home"` to jump to each. These don't have `// ───` anchors because they're outside the script block.

**Why anchors instead of line numbers**: line numbers go stale after every edit. Anchor comments do not. If you add a new section, add a matching `// ─── Name ───…` header so future greps still work.

When making a small change, prefer `Edit` with a tight `old_string` over rewriting larger blocks.

## Player state shape

The `pl` object (declared at the top of `// ─── State`) drives the player:

```
pl = { running, timer, tickAnchor, exerciseIdx, secondsLeft, phase, training }
```

`pl.phase` is one of:

| `phase`      | `#pl-phase` | Notes                                                   |
|--------------|-------------|---------------------------------------------------------|
| `'prepause'` | GET READY   | 5s static pause at start; shows upcoming first exercise |
| `'exercise'` | EXERCISE    | active rep countdown                                    |
| `'rest'`     | REST        | between exercises; shows next exercise image            |

`beginPrepause` / `beginExercise` / `beginRest` are thin wrappers around `beginSegment(phase)`, which sets the phase, resets `secondsLeft` from `segmentDuration()`, renders static content once (`renderSegment`) and starts the tick. `renderPlayer` only does per-tick updates (timer, progress bar, play/pause icon, and the `--p` 0…1 custom property on `#player-area` that drives the rising exercise wash). `renderSegment` sets `data-phase` on `#player-area`, which CSS uses for the phase glow and wash. `startTick` uses `pl.tickAnchor = {startMs, startLeft, lastLeft}` so the timer stays accurate when `setInterval` is throttled in a backgrounded tab; the `visibilitychange` handler calls `tickStep()` to resync on return.

**`playerNext`** skips to the next segment in the natural flow; `tickStep` calls it on expiry:
prepause → exercise 0 → rest 0 → exercise 1 → … → finishWorkout.

**Slide / swipe.** The flow is a strip of positions (`segOrd`: prepause=0, exercise N=2N+1, rest N=2N+2, done=2n). `viewAt(ord)` gives `{card, badge}`: prepause and rest show the upcoming exercise's card (`#pl-card`: emoji, name, description) with the `#pl-upnext` badge. `renderSegment` calls `slideTo`, which always slides the `#pl-phase` pill, and slides the card when it changes (old content as a `.pl-ghost` clone) or only the badge when the card stays; direction comes from the ord delta. Swiping left calls `playerNext`, right calls `playerBack` (strict previous segment, no restart).

**`playerPrev`** works like an audio-player back button. "At start" is defined as `secondsLeft >= segmentDuration() - 1` (within the first second of the segment):
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
