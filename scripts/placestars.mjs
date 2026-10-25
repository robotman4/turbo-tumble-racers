#!/usr/bin/env node
// Level design helper: for stars that some vehicle can't reach, suggests the nearest spot on
// real flight paths that every vehicle passes through, and verifies it. Prints JSON:
//   { "<levelId>": { "<starIndex>": [x, y, z] } }
//   node scripts/placestars.mjs [levelId...]
import { readFileSync } from 'node:fs';
import { initPhysics, Sim, DT } from '../src/game/sim.js';
import { LEVELS } from '../src/game/levels/index.js';
import { VEHICLES } from '../src/game/vehicles.js';
import { yawTo, wrapAngle, DEG } from '../src/game/launch.js';

await initPhysics();
const SOL = JSON.parse(readFileSync(new URL('../src/game/levels/solutions.json', import.meta.url), 'utf8'));
const POW = [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1];
const OFF = [-30, -20, -12, -6, -3, 0, 3, 6, 12, 20, 30];
const key = (p) => p.map((x) => Math.round(x / 0.6)).join(',');

function startSnaps(sim, level, v) {
  const snaps = [sim.snapshot()];
  for (const l of (SOL[level.id]?.[v.id] || []).slice(0, -1)) { sim.launch(l.yaw, l.power); sim.runUntilRest(); if (sim.state === 'aim') snaps.push(sim.snapshot()); }
  return snaps;
}

// Every launch from the given spots aimed around `target`; calls fn(sim) after each step.
function sweep(level, v, target, fn) {
  const sim = new Sim(level, v);
  for (const snap of startSnaps(sim, level, v)) {
    sim.restore(snap);
    const p = sim.body().translation();
    const base = yawTo([p.x, p.y, p.z], target);
    for (const off of OFF) for (const pw of POW) {
      sim.restore(snap);
      sim.launch(wrapAngle(base + off * DEG), pw);
      for (let i = 0; i < 16 / DT; i++) { sim.step(); sim.out.length = 0; fn(sim); if (sim.state !== 'fly' && sim.state !== 'cannon') break; }
    }
  }
  sim.free();
}

function reaches(level, v, i) {
  let ok = false;
  sweep(level, v, level.stars[i], (sim) => { if (sim.st.stars.includes(i)) ok = true; });
  return ok;
}

const only = process.argv.slice(2);
const out = {};
for (const L of LEVELS) {
  if (only.length && !only.includes(L.id)) continue;
  for (const [i, s] of (L.stars || []).entries()) {
    if (VEHICLES.every((v) => reaches(L, v, i))) continue;
    // Points each vehicle flies through near the original star (in the air, on any launch).
    const sets = VEHICLES.map((v) => {
      const m = new Map();
      sweep(L, v, s, (sim) => {
        if (sim.st.air < 0.15) return;
        const t = sim.body().translation(), p = [t.x, t.y, t.z];
        if (Math.hypot(p[0] - s[0], p[2] - s[2]) > 14) return;
        m.set(key(p), p);
      });
      return m;
    });
    const common = [...sets[0].entries()].filter(([k]) => sets[1].has(k) && sets[2].has(k)).map(([, p]) => p);
    // Prefer close to the original spot, and keep it a jump (high) star where possible.
    common.sort((a, b) => (Math.hypot(a[0] - s[0], a[2] - s[2]) + Math.abs(a[1] - s[1]) * 1.5) - (Math.hypot(b[0] - s[0], b[2] - s[2]) + Math.abs(b[1] - s[1]) * 1.5));
    let placed = null;
    for (const p of common.slice(0, 12)) {
      const q = p.map((x) => Math.round(x * 2) / 2);
      const stars = L.stars.map((x, j) => (j === i ? q : x));
      const L2 = { ...L, stars };
      if (VEHICLES.every((v) => reaches(L2, v, i))) { placed = q; break; }
    }
    out[L.id] = out[L.id] || {};
    out[L.id][i] = placed;
    console.error(`${L.id} star ${i} [${s}] -> ${placed ? '[' + placed + ']' : 'NO SPOT FOUND'}`);
  }
}
console.log(JSON.stringify(out));
