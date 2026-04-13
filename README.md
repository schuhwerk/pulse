# PULSE — Workout Timer

Minimalist body-weight workout timer. Runs entirely in the browser — no server, no account.
Inspired by [Feeel](https://gitlab.com/enjoyingfoss/feeel), built with the help of Claude.

## Features

- **Trainings** — create multiple named workout plans
- **Exercises** — add from the [wger.de](https://wger.de) database or manually; drag to reorder
- **Player** — countdown timer with audio beeps, rest phases, "up next" preview
- **PWA** — installable, works offline, prevents screen from going dark during a session
- **Data** — stored in `localStorage`; export/import as JSON

## Usage

Open `index.html` in a browser, or install it as an app via the browser's "Add to Home Screen" prompt.

For full functionality (wger search, service worker, wake lock) serve the files over HTTP/HTTPS — e.g.:

```bash
npx serve .
# or
python3 -m http.server
```

## Files

| File | Purpose |
|------|---------|
| `index.html` | Entire app (HTML + CSS + JS) |
| `manifest.json` | PWA manifest |
| `icon.svg` | App icon (dumbbell) |
| `images/` | Exercise illustrations (SVG) |
| `sw.js` | Service worker (caching + update flow) |
| `hooks/pre-commit` | Git hook: auto-bumps version on commit |

## License

Code and exercise illustrations © Vitus Schuhwerk, released under the [MIT License](LICENSE).

If you use or adapt this project or its images, please keep the license notice. A link back is appreciated but not required.

## Versioning

`APP_VERSION` in `index.html` and `CACHE_NAME` in `sw.js` are auto-bumped (patch) on every commit that touches `index.html`, via a pre-commit hook. If you bump the version manually before committing, the hook detects the change and skips.

After cloning, enable the hook:

```bash
git config core.hooksPath hooks
```

## Screen wake lock

Uses the [Screen Wake Lock API](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API) to keep the screen on while a workout is running. Supported in Chrome/Edge/Safari 16.4+. Falls back silently on unsupported browsers. Requires HTTPS (or localhost).

## Testing

Tests are written using Playwright. Run them with:

```bash
bun test
# or
bunx playwright test
```

**Note on seeing `console.log` output:** To keep the AI context window clean, `playwright.config.js` uses the `dot` reporter by default. This reporter hides successful test logs. If you need to see `console.log` output while debugging a passing test, override the reporter:

```bash
bunx playwright test --reporter=list
```

## Todo
- Remove the full-state backup -> only export trainings -> better merging.
- Should we update default trainings? How implement that simple?
