// @ts-check
import { test as base, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

/**
 * Read the live APP_VERSION string out of index.html so tests that care about
 * version behavior stay in sync with the pre-commit auto-bumped value instead
 * of a hardcoded literal that breaks on every version bump.
 */
const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const m = indexHtml.match(/APP_VERSION\s*=\s*'([^']+)'/);
if (!m) throw new Error('Could not find APP_VERSION in index.html');
export const APP_VERSION = m[1];

/**
 * Shared fixture: opens index.html with a clean localStorage, stubs out
 * browser APIs the player touches (wakeLock, AudioContext) and blocks the
 * wger API so tests never hit the network.
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript(() => {
      window['__DISABLE_SERVICE_WORKER__'] = true;
      window['__preInit'] = { ls: localStorage.getItem('pulse_data'), ss: sessionStorage.getItem('__pw_init') };
      // window.name is empty when a new tab opens (even with a persistent Chromium
      // profile), but survives page.reload() within the same tab.  Use it as a
      // once-per-tab guard: clear localStorage on the first navigation so stale data
      // from previous runs never bleeds into a test; skip on reload so in-test
      // mutations (e.g. volume change) persist across the reload.
      if (!sessionStorage.getItem('__pw_init')) {
        sessionStorage.setItem('__pw_init', '1');
        localStorage.clear();
      }
      // Silence audio — the player calls new AudioContext() for beeps.
      // @ts-ignore
      window.AudioContext = class { constructor(){ this.state='suspended'; } createOscillator(){return{connect(){},start(){},stop(){},frequency:{value:0},onended:null};} createGain(){return{connect(){},gain:{value:0,setValueAtTime(){},exponentialRampToValueAtTime(){}}};} get destination(){return{};} get currentTime(){return 0;} close(){return Promise.resolve();} suspend(){return Promise.resolve();} resume(){return Promise.resolve();} };
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
  return { trainings, settings: { restDefault: 8, audioEnabled: true } };
}

export { expect };
