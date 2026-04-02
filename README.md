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

## Screen wake lock

Uses the [Screen Wake Lock API](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API) to keep the screen on while a workout is running. Supported in Chrome/Edge/Safari 16.4+. Falls back silently on unsupported browsers. Requires HTTPS (or localhost).
