// @ts-check
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  retries: 0,
  // AI-friendly output: `dot` prints one char per test, full detail only on
  // failures. No HTML report, no traces, no screenshots — a clean run is
  // ~5 lines total, small enough to paste into a chat without truncation.
  reporter: [['dot']],
  quiet: true,
  use: {
    // Use `localhost` (not 127.0.0.1) — index.html skips the player countdown
    // when hostname==='localhost', which makes player timing tests much faster.
    baseURL: 'http://localhost:5173',
    trace: 'off',
    screenshot: 'off',
    video: 'off',
  },
  webServer: {
    // `bun` has no single-line built-in static server, and adding a JS server
    // would pull a dep; python3 is universally available and zero-install.
    command: 'python3 -m http.server 5173 --bind 127.0.0.1',
    url: 'http://localhost:5173/index.html',
    reuseExistingServer: !process.env.CI,
    // Silence access logs — dozens of GET lines per run is pure noise.
    stdout: 'ignore',
    stderr: 'ignore',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
