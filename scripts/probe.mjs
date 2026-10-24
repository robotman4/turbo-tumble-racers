#!/usr/bin/env node
// Level design helper: tries a grid of first launches and prints where the vehicle ends up.
//   node scripts/probe.mjs <levelId> [vehicle] [yawDeg]
import { initPhysics, Sim } from '../src/game/sim.js';
import { levelById } from '../src/game/levels/index.js';
import { vehicleById } from '../src/game/vehicles.js';

await initPhysics();
const [id = '1-1', vid = 'panda', yawArg] = process.argv.slice(2);
const L = levelById(id), V = vehicleById(vid);
const yaws = yawArg !== undefined ? [Number(yawArg)] : [-10, -5, 0, 5, 10];
for (const yd of yaws) {
  const row = [];
  for (const p of [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]) {
    const sim = new Sim(L, V);
    sim.launch(((L.start.yaw || 0) * 180 / Math.PI + yd) * Math.PI / 180, p);
    let maxX = -1e9, events = new Set();
    const t0 = sim.t;
    while (sim.t - t0 < 16) {
      sim.step();
      for (const e of sim.drain()) if (!['hit', 'clack', 'score', 'coin', 'land'].includes(e.type)) events.add(e.type);
      maxX = Math.max(maxX, sim.body().translation().x);
      if (sim.state !== 'fly' && sim.state !== 'cannon') break;
    }
    const q = sim.vehiclePose().p.map((x) => x.toFixed(0));
    row.push(`${p}:${sim.state[0]}(${q.join(',')})mx${maxX.toFixed(0)}${[...events].filter((e) => e !== 'launch' && e !== 'settle').map((e) => e[0]).join('')}`);
    sim.free();
  }
  console.log(`yaw ${yd}: ` + row.join(' '));
}
