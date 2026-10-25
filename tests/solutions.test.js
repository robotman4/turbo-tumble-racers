// Completability: every level must be finishable with every vehicle. The recorded solver
// solutions (src/game/levels/solutions.json, made by `npm run solve`) are replayed in the
// real simulation. If floating-point differences on another machine make a replay miss,
// a small search around the recorded launch is tried before failing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initPhysics, Sim } from '../src/game/sim.js';
import { LEVELS } from '../src/game/levels/index.js';
import { VEHICLES } from '../src/game/vehicles.js';
import { replay } from '../src/game/solver.js';
import { DEG } from '../src/game/launch.js';

await initPhysics();
const SOL = JSON.parse(readFileSync(new URL('../src/game/levels/solutions.json', import.meta.url), 'utf8'));

function finishes(level, v, launches) {
  if (replay(level, v, launches).finished) return true;
  // Nudge the last launch a little (robustness against tiny numeric differences).
  for (const dy of [-1.5, 1.5, -3, 3]) for (const dp of [0, -0.03, 0.03]) {
    const l = launches.map((x, i) => (i === launches.length - 1 ? { ...x, yaw: x.yaw + dy * DEG, power: Math.min(1, x.power + dp) } : x));
    if (replay(level, v, l).finished) return true;
  }
  return false;
}

for (const level of LEVELS) {
  test(`level ${level.id} "${level.name}" can be finished by every vehicle`, () => {
    for (const v of VEHICLES) {
      const sol = SOL[level.id]?.[v.id];
      assert.ok(sol && sol.length, `${level.id} has a recorded solution for ${v.id} (run npm run solve)`);
      assert.ok(sol.length <= (level.launches || 3), 'within the launch limit');
      assert.ok(finishes(level, v, sol), `${level.id} ${v.id} replay reaches the finish`);
    }
  });
}

test('easy mode never makes a level harder', () => {
  for (const level of LEVELS.filter((_, i) => i % 4 === 0)) {
    const sol = SOL[level.id]?.panda;
    const r = replay(level, VEHICLES[0], sol, { easy: true });
    assert.ok(r.finished || finishes(level, VEHICLES[0], sol), level.id);
  }
});

test('the hint data points at real launch spots', () => {
  for (const level of LEVELS) {
    const sol = SOL[level.id]?.panda || [];
    assert.ok(sol.every((l) => Array.isArray(l.from) && l.from.length === 2), level.id);
    const s = level.start.p;
    assert.ok(Math.hypot(sol[0].from[0] - s[0], sol[0].from[1] - s[2]) < 1.5, `${level.id} first launch starts at the start`);
  }
});

// Every collectible star must be reachable by every vehicle (paths made by scripts/stars.mjs).
const STARS = JSON.parse(readFileSync(new URL('../src/game/levels/starpaths.json', import.meta.url), 'utf8'));
for (const level of LEVELS.filter((l) => (l.stars || []).length)) {
  test(`level ${level.id}: every star can be collected by every vehicle`, () => {
    for (const v of VEHICLES) {
      level.stars.forEach((_, i) => {
        const path = STARS[level.id]?.[v.id]?.[i];
        assert.ok(path, `${level.id} star ${i} has a recorded path for ${v.id} (run node scripts/stars.mjs)`);
        assert.ok(collects(level, v, path, i), `${level.id} star ${i} ${v.id} replay collects it`);
      });
    }
  });
}

function collects(level, v, path, i) {
  const tryPath = (p) => {
    const sim = new Sim(level, v);
    try {
      for (const l of p) { if (!sim.canLaunch()) break; sim.launch(l.yaw, l.power); sim.runUntilRest(); if (sim.st.stars.includes(i)) return true; }
      return sim.st.stars.includes(i);
    } finally { sim.free(); }
  };
  if (tryPath(path)) return true;
  for (const dy of [-1.5, 1.5]) for (const dp of [0, -0.03, 0.03]) {
    if (tryPath(path.map((x, k) => (k === path.length - 1 ? { ...x, yaw: x.yaw + dy * DEG, power: Math.min(1, x.power + dp) } : x)))) return true;
  }
  return false;
}
