import test from 'node:test';
import assert from 'node:assert/strict';
import { migrate, defaults, recordLevel, SAVE_VERSION, totalStars } from '../src/storage.js';

test('a template (v1) save migrates to the current version', () => {
  const old = { stars: [0, 3, 2], unlocked: 3, muted: true, bestTimes: [0, 10, 12] };
  const d = migrate(old);
  assert.equal(d.v, SAVE_VERSION);
  assert.equal(d.settings.muted, true);
  assert.equal(d.unlocked, 1);
  assert.deepEqual(d.levels, {});
});

test('missing or broken saves fall back to defaults', () => {
  assert.deepEqual(migrate(null), defaults());
  assert.deepEqual(migrate('nonsense'), defaults());
});

test('new fields are filled in and existing values kept', () => {
  const d = migrate({ v: SAVE_VERSION, coins: 77, settings: { easy: true }, levels: { '1-1': { stars: 2, best: 1800 } } });
  assert.equal(d.coins, 77);
  assert.equal(d.settings.easy, true);
  assert.equal(d.settings.music, true, 'new setting gets its default');
  assert.equal(d.levels['1-1'].best, 1800);
  assert.deepEqual(d.paints.panda, ['blue']);
});

test('recordLevel keeps the best results and unlocks the next level', () => {
  const d = defaults();
  let b = recordLevel('1-1', 0, { score: 1500, stars: 2, launches: 2, time: 9.43, coins: 3 }, d);
  assert.ok(b.first && b.score);
  assert.equal(d.unlocked, 2);
  assert.equal(d.coins, 3);
  b = recordLevel('1-1', 0, { score: 1200, stars: 1, launches: 1, time: 12, coins: 1 }, d);
  assert.equal(b.score, false);
  const r = d.levels['1-1'];
  assert.equal(r.best, 1500);
  assert.equal(r.stars, 2);
  assert.equal(r.bestLaunches, 1);
  assert.equal(r.bestTime, 9.4);
  assert.equal(r.plays, 2);
  assert.equal(d.coins, 4, 'coins collected add up across runs');
  recordLevel('1-2', 1, { score: 2000, stars: 3, launches: 1, time: 5, coins: 0 }, d);
  assert.equal(d.unlocked, 3);
  assert.equal(totalStars(d), 5);
});
