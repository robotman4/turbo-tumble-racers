#!/usr/bin/env node
// Finds a winning set of launches for every level and vehicle and writes them to
// src/game/levels/solutions.json. The tests replay these, the game uses them for hints.
//   node scripts/solve.mjs            all levels
//   node scripts/solve.mjs 1-3 2-1    only these levels (others are kept)
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { initPhysics } from '../src/game/sim.js';
import { LEVELS } from '../src/game/levels/index.js';
import { VEHICLES } from '../src/game/vehicles.js';
import { solve } from '../src/game/solver.js';

const OUT = fileURLToPath(new URL('../src/game/levels/solutions.json', import.meta.url));
await initPhysics();
const only = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const data = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : {};
let failed = 0;
for (const level of LEVELS) {
  if (only.length && !only.includes(level.id)) continue;
  data[level.id] = data[level.id] || {};
  for (const v of VEHICLES) {
    const t0 = Date.now();
    const r = solve(level, v);
    const ms = Date.now() - t0;
    if (r) {
      data[level.id][v.id] = r.launches;
      console.log(`${level.id} ${v.id.padEnd(8)} ok   launches=${r.launches.length} score=${r.score} ${ms}ms`);
    } else {
      failed++;
      delete data[level.id][v.id];
      console.log(`${level.id} ${v.id.padEnd(8)} FAIL ${ms}ms`);
    }
  }
}
writeFileSync(OUT, JSON.stringify(data, null, 1) + '\n');
console.log(failed ? `${failed} unsolved` : 'all solved');
process.exit(failed ? 1 : 0);
