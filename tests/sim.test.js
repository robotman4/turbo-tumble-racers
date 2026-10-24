// Physics and game-rule checks on small purpose-built courses.
import test from 'node:test';
import assert from 'node:assert/strict';
import { initPhysics, Sim, DT } from '../src/game/sim.js';
import { VEHICLES } from '../src/game/vehicles.js';
import { PLAYGROUND } from '../src/game/levels/index.js';

await initPhysics();
const panda = VEHICLES[0];
const flat = (extra = {}) => ({
  id: 't', name: 'test', world: 1, launches: 3,
  start: { p: [0, 0.6, 0], yaw: 0 }, finish: { p: [200, 0, 0], r: 3 }, cam: [0, 10, 10],
  parts: [{ t: 'box', p: [20, -0.5, 0], s: [80, 1, 20] }],
  ...extra,
});

test('a launched vehicle flies, lands and settles ready for the next launch', () => {
  const sim = new Sim(flat(), panda);
  assert.ok(sim.launch(0, 0.6));
  assert.equal(sim.state, 'fly');
  assert.equal(sim.runUntilRest(), 'aim');
  const p = sim.vehiclePose().p;
  assert.ok(p[0] > 5, 'moved forward');
  assert.ok(sim.vehicleUp() > 0.7, 'ends upright');
  assert.equal(sim.launchesLeft, 2);
  sim.free();
});

test('running out of launches ends in the friendly out state', () => {
  const sim = new Sim(flat({ launches: 1 }), panda);
  sim.launch(0, 0.3);
  assert.equal(sim.runUntilRest(), 'out');
  assert.equal(sim.canLaunch(), false);
  sim.free();
});

test('falling off the course respawns, and the launch still counts', () => {
  const sim = new Sim(flat({ parts: [{ t: 'box', p: [0, -0.5, 0], s: [6, 1, 6] }] }), panda);
  sim.launch(0, 1);
  const events = [];
  for (let i = 0; i < 600 && sim.state === 'fly'; i++) { sim.step(); events.push(...sim.drain()); }
  assert.ok(events.some((e) => e.type === 'splash'));
  assert.equal(sim.state, 'aim');
  assert.equal(sim.launchesLeft, 2);
  assert.ok(Math.hypot(...sim.vehiclePose().p.filter((_, i) => i !== 1)) < 1, 'back at the launch spot');
  sim.free();
});

test('splashing on the last launch ends in the friendly out state', () => {
  const sim = new Sim(flat({ launches: 1, parts: [{ t: 'box', p: [0, -0.5, 0], s: [6, 1, 6] }] }), panda);
  sim.launch(0, 1);
  assert.equal(sim.runUntilRest(), 'out');
  sim.free();
});

test('reaching the finish zone finishes the level and scores it once', () => {
  const sim = new Sim(flat({ finish: { p: [14, 0, 0], r: 4 } }), panda);
  sim.launch(0, 0.55);
  sim.runUntilRest();
  assert.equal(sim.state, 'finished');
  assert.equal(sim.score.events.filter((e) => e.type === 'finish').length, 1);
  sim.free();
});

test('easy mode widens the finish and the collect radius', () => {
  const a = new Sim(flat(), panda), b = new Sim(flat(), panda, { easy: true });
  assert.ok(b.finishR > a.finishR);
  assert.ok(b.collectR > a.collectR);
  const c = new Sim(flat(), panda, { unlimited: true });
  assert.equal(c.launchesLeft, Infinity);
  a.free(); b.free(); c.free();
});

test('smashing a block wall scores each block once and makes debris events', () => {
  const blocks = [];
  for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) blocks.push({ t: 'block', p: [10, 0.4 + r * 0.8, (c - 1) * 0.82] });
  const sim = new Sim(flat({ props: blocks }), VEHICLES[2]);
  sim.launch(0, 0.35);
  const evs = [];
  for (let i = 0; i < 900 && sim.state === 'fly'; i++) { sim.step(); evs.push(...sim.drain()); }
  for (let i = 0; i < 120; i++) { sim.step(); evs.push(...sim.drain()); }
  const destroyed = sim.score.events.filter((e) => e.type === 'destroy');
  assert.ok(destroyed.length >= 2, `knocked ${destroyed.length} blocks`);
  assert.equal(new Set(destroyed.map((e) => e.id)).size, destroyed.length, 'no block scored twice');
  sim.free();
});

test('gadgets: a boost pad speeds the vehicle up, a trampoline throws it up', () => {
  const sim = new Sim(flat({ gadgets: [{ t: 'boost', p: [6, 0, 0], speed: 26 }] }), panda);
  sim.launch(0, 0.25);
  let maxV = 0, boosted = false;
  for (let i = 0; i < 300; i++) { sim.step(); for (const e of sim.drain()) if (e.type === 'boost') boosted = true; const v = sim.vehicleVel(); maxV = Math.max(maxV, Math.hypot(v.x, v.z)); }
  assert.ok(boosted && maxV > 20);
  sim.free();
  const t = new Sim(flat({ gadgets: [{ t: 'trampoline', p: [6, 0, 0], r: 2, bounce: 15 }] }), panda);
  t.launch(0, 0.18);
  let bounced = false, maxY = 0;
  for (let i = 0; i < 300; i++) { t.step(); for (const e of t.drain()) if (e.type === 'trampoline') bounced = true; maxY = Math.max(maxY, t.vehiclePose().p[1]); }
  assert.ok(bounced && maxY > 4, `bounced to ${maxY.toFixed(1)}`);
  t.free();
});

test('snapshots restore the exact same future', () => {
  const sim = new Sim(flat({ props: [{ t: 'ball', p: [8, 0.7, 0] }] }), panda);
  const snap = sim.snapshot();
  sim.launch(0.1, 0.7); sim.runUntilRest();
  const a = sim.vehiclePose().p;
  sim.restore(snap);
  sim.launch(0.1, 0.7); sim.runUntilRest();
  assert.deepEqual(sim.vehiclePose().p, a);
  sim.free();
});

test('speeds stay capped even after extreme impulses', () => {
  const sim = new Sim(flat(), panda);
  sim.launch(0, 1);
  sim.body().setLinvel({ x: 500, y: 0, z: 0 }, true);
  sim.step();
  const v = sim.vehicleVel();
  assert.ok(Math.hypot(v.x, v.y, v.z) <= 42.5);
  sim.free();
});

test('the playground builds and runs with unlimited launches', () => {
  const sim = new Sim(PLAYGROUND, panda, { unlimited: true });
  for (let k = 0; k < 4; k++) { assert.ok(sim.launch(k * 0.8, 0.8)); sim.runUntilRest(); }
  assert.equal(sim.state, 'aim');
  sim.free();
});

test('fixed timestep is 60 Hz', () => { assert.equal(DT, 1 / 60); });
