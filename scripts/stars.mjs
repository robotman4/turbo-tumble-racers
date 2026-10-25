#!/usr/bin/env node
// Records, for every star and every vehicle, a sequence of launches that collects it
// (a prefix of the level's recorded solution plus one launch aimed around the star).
// Writes src/game/levels/starpaths.json; the tests replay these so every star stays reachable.
//   node scripts/stars.mjs [levelId...]
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { initPhysics, Sim } from '../src/game/sim.js';
import { LEVELS } from '../src/game/levels/index.js';
import { VEHICLES } from '../src/game/vehicles.js';
import { yawTo, wrapAngle, DEG } from '../src/game/launch.js';

await initPhysics();
const SOL = JSON.parse(readFileSync(new URL('../src/game/levels/solutions.json', import.meta.url), 'utf8'));
const OUT = fileURLToPath(new URL('../src/game/levels/starpaths.json', import.meta.url));
const data = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : {};
const POW = [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1];
const OFF = [0, -3, 3, -6, 6, -12, 12, -20, 20, -30, 30];

function findPath(level, v, i) {
  const sim = new Sim(level, v);
  const sol = SOL[level.id]?.[v.id] || [];
  const starts = [{ snap: sim.snapshot(), prefix: [] }];
  for (let k = 0; k < sol.length - 1; k++) {
    sim.launch(sol[k].yaw, sol[k].power); sim.runUntilRest();
    if (sim.state !== 'aim') break;
    starts.push({ snap: sim.snapshot(), prefix: sol.slice(0, k + 1) });
  }
  try {
    for (const { snap, prefix } of starts) {
      sim.restore(snap);
      const p = sim.body().translation();
      const base = yawTo([p.x, p.y, p.z], level.stars[i]);
      for (const off of OFF) for (const power of POW) {
        sim.restore(snap);
        const yaw = wrapAngle(base + off * DEG);
        sim.launch(yaw, power); sim.runUntilRest();
        if (sim.st.stars.includes(i)) return [...prefix.map(({ yaw, power }) => ({ yaw, power })), { yaw, power }];
      }
    }
    return null;
  } finally { sim.free(); }
}

const only = process.argv.slice(2);
let missing = 0;
for (const L of LEVELS) {
  if (only.length && !only.includes(L.id)) continue;
  data[L.id] = {};
  for (const v of VEHICLES) {
    data[L.id][v.id] = {};
    (L.stars || []).forEach((_, i) => {
      const path = findPath(L, v, i);
      if (path) data[L.id][v.id][i] = path; else { missing++; console.log(`${L.id} star ${i} ${v.id}: UNREACHABLE`); }
    });
  }
  console.log(`${L.id} done`);
}
writeFileSync(OUT, JSON.stringify(data) + '\n');
console.log(missing ? `${missing} star/vehicle pairs unreachable` : 'every star reachable by every vehicle');
process.exit(missing ? 1 : 0);
