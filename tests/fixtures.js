// @ts-check
import { test as base, expect } from '@playwright/test';

/**
 * Shared fixture: opens index.html with a clean localStorage, stubs out
 * browser APIs the player touches (wakeLock, AudioContext) and blocks the
 * wger API so tests never hit the network.
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript(() => {
      // Fresh Playwright context already gives an empty localStorage — do not
      // clear here, because addInitScript runs on every navigation including
      // page.reload(), which would wipe state the test just wrote.

      // Silence audio — the player calls new AudioContext() for beeps.
      // @ts-ignore
      window.AudioContext = class { createOscillator(){return{connect(){},start(){},stop(){},frequency:{value:0}};} createGain(){return{connect(){},gain:{value:0,setValueAtTime(){},exponentialRampToValueAtTime(){}}};} get destination(){return{};} get currentTime(){return 0;} close(){} };
      // @ts-ignore
      window.webkitAudioContext = window.AudioContext;

      // Stub wake lock.
      // @ts-ignore
      navigator.wakeLock = { request: async () => ({ release: async () => {}, addEventListener(){} }) };
    });

    // Block wger API + images so tests are deterministic & offline.
    await page.route(/wger\.de/, route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ results: [] }),
    }));

    // Don't register the service worker during tests (avoids cache flakiness).
    await page.route('**/sw.js', route => route.fulfill({ status: 404, body: '' }));

    await use(page);
  },
});

/**
 * Seed localStorage with a known state before the page loads.
 * Call BEFORE `page.goto`. Exercises default to 2s/1s rest so timing tests
 * finish quickly even at real-time ticks.
 */
export async function seedState(page, state) {
  await page.addInitScript((s) => {
    // Only seed if empty — so reloads preserve mutations made during the test.
    if (!localStorage.getItem('pulse_data')) {
      localStorage.setItem('pulse_data', JSON.stringify(s));
    }
  }, state);
}

export function makeTraining(overrides = {}) {
  return {
    id: 't1',
    name: 'Test Workout',
    restSeconds: 1,
    exercises: [
      { id: 'e1', name: 'Alpha', emoji: '💪', s: 2, description: '' },
      { id: 'e2', name: 'Bravo', emoji: '🔥', s: 2, description: '' },
    ],
    ...overrides,
  };
}

export function makeState(trainings = [makeTraining()]) {
  return { trainings, settings: { restDefault: 8, audioEnabled: true }, _wgerEnriched: true };
}

export { expect };
