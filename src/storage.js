// Progress saved on the device in localStorage. One player, no profiles.
// The save is versioned: bump SAVE_VERSION and add a step to MIGRATIONS whenever the shape changes,
// so older saves on players' devices are upgraded instead of lost.
const KEY = 'turbotumble.save';
const OLD_KEYS = ['kidsgame.v1']; // template save, migrated once if found
export const SAVE_VERSION = 2;

export function defaults() {
  return {
    v: SAVE_VERSION,
    levels: {},          // id -> { stars, best, bestLaunches, bestTime, plays }
    unlocked: 1,         // number of adventure levels unlocked, in order
    vehicle: 'panda',
    coins: 0,            // coins collected over all runs (spent on paint jobs)
    paints: { panda: ['blue'], dino: ['green'], chicken: ['red'] },
    paint: { panda: 'blue', dino: 'green', chicken: 'red' },
    upgrades: {},        // car id -> { turbo, springs, wings, bumper } levels 0-3
    customCars: [],      // car builder: { id, body, driver, paint, skin, name }
    customLevels: [],    // level builder: { id, world, cells, verified }
    settings: { muted: false, music: true, sfx: true, easy: false, unlimited: false, quality: 'auto', debug: false },
    seenTips: {},
  };
}

// Each step upgrades a save from version N to N + 1.
export const MIGRATIONS = {
  // v1: the template's save ({ stars: [], unlocked, muted, bestTimes: [] }, no `v`).
  1: (old) => {
    const d = defaults();
    d.v = 2;
    d.settings.muted = !!old.muted;
    return d;
  },
};

export function migrate(raw) {
  let d = raw && typeof raw === 'object' ? raw : null;
  if (!d) return defaults();
  let v = d.v || 1;
  while (v < SAVE_VERSION) {
    const step = MIGRATIONS[v];
    d = step ? step(d) : defaults();
    v = d.v = v + 1;
  }
  // Fill in any fields added since (keeps old values, adds new defaults).
  const base = defaults();
  const out = { ...base, ...d, settings: { ...base.settings, ...(d.settings || {}) } };
  out.paints = { ...base.paints, ...(d.paints || {}) };
  out.paint = { ...base.paint, ...(d.paint || {}) };
  out.levels = d.levels && typeof d.levels === 'object' ? d.levels : {};
  out.upgrades = d.upgrades && typeof d.upgrades === 'object' ? d.upgrades : {};
  out.customCars = Array.isArray(d.customCars) ? d.customCars : [];
  out.customLevels = Array.isArray(d.customLevels) ? d.customLevels : [];
  out.v = SAVE_VERSION;
  return out;
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return migrate(JSON.parse(raw));
    for (const k of OLD_KEYS) {
      const old = localStorage.getItem(k);
      if (old) return migrate(JSON.parse(old));
    }
  } catch (e) { /* private mode, no storage or broken JSON: play without saving */ }
  return defaults();
}

export const save = load();

// iOS may clear a web view's localStorage when the device runs low on space, so the store apps
// (NATIVE build) also keep the save in native storage (Capacitor Preferences) and restore it.
/* global __NATIVE__ */
const NATIVE = typeof __NATIVE__ !== 'undefined' && __NATIVE__;
let nativePrefs = null;
export async function restoreNativeSave() {
  if (!NATIVE) return;
  try {
    const { Preferences } = await import('@capacitor/preferences');
    nativePrefs = Preferences;
    if (localStorage.getItem(KEY)) return;
    const { value } = await Preferences.get({ key: KEY });
    if (!value) return;
    const d = migrate(JSON.parse(value));
    for (const k of Object.keys(save)) delete save[k];
    Object.assign(save, d);
    localStorage.setItem(KEY, value);
  } catch (e) { /* play on with what localStorage has */ }
}

export function persist() {
  const json = JSON.stringify(save);
  try { localStorage.setItem(KEY, json); } catch (e) { /* ignore */ }
  if (nativePrefs) nativePrefs.set({ key: KEY, value: json }).catch(() => {});
}

export function resetProgress() {
  // Progress goes; settings and the player's own creations (cars, levels) stay.
  const keep = save.settings, cars = save.customCars, lvls = save.customLevels;
  const d = defaults();
  for (const k of Object.keys(save)) delete save[k];
  Object.assign(save, d, { settings: { ...keep }, customCars: cars || [], customLevels: lvls || [] });
  persist();
}

// Record a finished level. Returns what improved (for the "new best" ribbon).
// `index` is the level's position in the adventure order (0-based).
export function recordLevel(id, index, result, data = save) {
  const prev = data.levels[id] || { stars: 0, best: 0, bestLaunches: 0, bestTime: 0, plays: 0 };
  const rec = { ...prev, plays: (prev.plays || 0) + 1 };
  const better = { score: result.score > prev.best, stars: result.stars > prev.stars, first: !prev.stars };
  rec.stars = Math.max(prev.stars, result.stars);
  rec.best = Math.max(prev.best, result.score);
  if (!prev.bestLaunches || result.launches < prev.bestLaunches) rec.bestLaunches = result.launches;
  if (!prev.bestTime || result.time < prev.bestTime) rec.bestTime = Math.round(result.time * 10) / 10;
  data.levels[id] = rec;
  if (index >= 0) data.unlocked = Math.max(data.unlocked, index + 2);
  data.coins += result.coins || 0;
  if (data === save) persist();
  return better;
}

export const levelRecord = (id) => save.levels[id] || null;
export const totalStars = (data = save) => Object.values(data.levels).reduce((s, r) => s + (r.stars || 0), 0);
