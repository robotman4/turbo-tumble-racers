// Progress saved on the device in localStorage. One player, no profiles.
// Change KEY per game so two games on the same domain never share a save.
const KEY = 'kidsgame.v1';
export const LEVELS = 10;

const defaults = () => ({ stars: Array(LEVELS + 1).fill(0), unlocked: 1, muted: false, bestTimes: Array(LEVELS + 1).fill(0) });

export const save = (() => {
  let data = defaults();
  try {
    const raw = localStorage.getItem(KEY);
    // Merge with defaults so saves from older versions get new fields.
    if (raw) data = Object.assign(defaults(), JSON.parse(raw));
  } catch (e) { /* private mode etc: play without saving */ }
  return data;
})();

export function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) { /* ignore */ }
}

export function recordLevel(level, stars, seconds) {
  save.stars[level] = Math.max(save.stars[level] || 0, stars);
  if (!save.bestTimes[level] || seconds < save.bestTimes[level]) save.bestTimes[level] = seconds;
  save.unlocked = Math.max(save.unlocked, Math.min(LEVELS, level + 1));
  persist();
}
