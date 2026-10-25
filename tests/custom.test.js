import test from 'node:test';
import assert from 'node:assert/strict';
import { newLevel, applyTool, compileLevel, levelCode, decodeLevel, problems, getCell, GRID } from '../src/game/custom.js';
import { validateLevel } from '../src/game/levels/schema.js';
import { applyUpgrades, customVehicle, playerVehicle, buyUpgrade, carCode, decodeCar, UPGRADES } from '../src/game/garage.js';
import { defaults } from '../src/storage.js';
import { VEHICLES } from '../src/game/vehicles.js';
import { initPhysics, Sim } from '../src/game/sim.js';

await initPhysics();

test('a new custom level has a start and a finish and compiles to a valid level', () => {
  const L = newLevel(2);
  assert.deepEqual(problems(L), []);
  const def = compileLevel(L, 'candy');
  assert.deepEqual(validateLevel(def), []);
  assert.equal(def.world, 2);
});

test('builder tools: raise, lower, ramp, items, eraser', () => {
  const L = newLevel(1);
  assert.ok(applyTool(L, 'deck', 5, 3));
  assert.equal(getCell(L, 5, 3).h, 0);
  applyTool(L, 'deck', 5, 3); applyTool(L, 'deck', 5, 3);
  assert.equal(getCell(L, 5, 3).h, 2);
  applyTool(L, 'ramp', 5, 3); applyTool(L, 'ramp', 5, 3);
  assert.equal(getCell(L, 5, 3).ramp, 1, 'tapping a ramp again turns it');
  applyTool(L, 'trampoline', 6, 3);
  assert.equal(getCell(L, 6, 3).h, 0, 'items that need a floor get one');
  applyTool(L, 'coin', 7, 7);
  assert.equal(getCell(L, 7, 7).h, undefined, 'coins can float over the void');
  applyTool(L, 'start', 4, 4);
  const starts = Object.values(L.cells).filter((v) => v.item?.t === 'start');
  assert.equal(starts.length, 1, 'only one start');
  applyTool(L, 'eraser', 6, 3); applyTool(L, 'eraser', 6, 3);
  assert.equal(getCell(L, 6, 3), null);
  assert.equal(applyTool(L, 'deck', GRID.cols, 0), false, 'outside the grid does nothing');
  applyTool(L, 'eraser', 11, 3);
  assert.deepEqual(problems(L), ['finish']);
});

test('share codes round-trip and reject junk', () => {
  const L = newLevel(3);
  applyTool(L, 'boost', 3, 3); applyTool(L, 'boost', 3, 3); applyTool(L, 'jelly', 4, 4); applyTool(L, 'star', 6, 2);
  const back = decodeLevel(levelCode(L));
  assert.deepEqual(back.cells, L.cells);
  assert.equal(back.world, 3);
  assert.equal(decodeLevel('TTL1garbage'), null);
  assert.equal(decodeLevel('hello'), null);
  const car = { body: 'cart', driver: 'dino', paint: '#3b8fe8', name: 'Zoom' };
  assert.deepEqual(decodeCar(carCode(car)), { ...car, skin: undefined });
  assert.equal(decodeCar('TTC1xx'), null);
});

test('a straight custom course can be finished', () => {
  const L = newLevel(1);
  for (let c = 2; c < GRID.cols - 2; c++) applyTool(L, 'deck', c, 3);
  let finished = false;
  for (const p of [0.55, 0.6, 0.65, 0.7, 0.8]) {
    const s = new Sim(compileLevel(L, 'grass'), VEHICLES[0]);
    s.launch(0, p); s.runUntilRest();
    if (s.state !== 'finished') { s.launch(0, 0.5); s.runUntilRest(); }
    finished = finished || s.finished;
    s.free();
  }
  assert.ok(finished);
});

test('upgrades scale vehicle numbers within limits and cost coins', () => {
  const v = VEHICLES[0];
  const up = applyUpgrades(v, { turbo: 3, springs: 3, wings: 3, bumper: 3 });
  assert.ok(up.speed > v.speed && up.speed < v.speed * 1.2);
  assert.ok(up.bounce > v.bounce && up.bounce <= 0.85);
  assert.ok(up.gravity < v.gravity && up.gravity > v.gravity * 0.8);
  assert.ok(up.impact > v.impact);
  const s = defaults();
  assert.equal(buyUpgrade(s, 'panda', 'turbo'), false, 'no coins, no upgrade');
  s.coins = 1000;
  for (let i = 0; i < 3; i++) assert.ok(buyUpgrade(s, 'panda', 'turbo'));
  assert.equal(buyUpgrade(s, 'panda', 'turbo'), false, 'max level');
  assert.equal(s.upgrades.panda.turbo, 3);
  assert.equal(s.coins, 1000 - UPGRADES[0].costs.reduce((a, b) => a + b, 0));
});

test('custom cars drive like the built-in vehicle with the same body', () => {
  const c = customVehicle({ id: 'x', body: 'cart', driver: 'panda', paint: '#ffffff' });
  const chicken = VEHICLES.find((v) => v.id === 'chicken');
  for (const k of ['half', 'density', 'bounce', 'grip', 'gravity', 'speed', 'impact']) assert.deepEqual(c[k], chicken[k]);
  const s = defaults();
  s.customCars.push({ id: 'x', body: 'board', driver: 'chicken', paint: '#ff0000' });
  s.vehicle = 'custom:x';
  s.upgrades['custom:x'] = { wings: 2 };
  const pv = playerVehicle(s);
  assert.equal(pv.paint, '#ff0000');
  assert.ok(pv.def.gravity < VEHICLES[1].gravity);
});
