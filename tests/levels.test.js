import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, PLAYGROUND } from '../src/game/levels/index.js';
import { validateLevel, layoutKey } from '../src/game/levels/schema.js';
import { thresholds } from '../src/game/scoring.js';

test('32 levels, 8 per world, unique ids and names', () => {
  assert.equal(LEVELS.length, 32);
  for (const w of [1, 2, 3, 4]) assert.equal(LEVELS.filter((l) => l.world === w).length, 8, `world ${w}`);
  assert.equal(new Set(LEVELS.map((l) => l.id)).size, 32);
  assert.equal(new Set(LEVELS.map((l) => l.name)).size, 32);
});

test('every level definition is valid', () => {
  const errs = [...LEVELS, PLAYGROUND].flatMap(validateLevel);
  assert.deepEqual(errs, []);
});

test('no two levels share a layout', () => {
  const keys = LEVELS.map(layoutKey);
  assert.equal(new Set(keys).size, keys.length);
});

test('levels in a world introduce mechanics instead of repeating one', () => {
  for (const w of [1, 2, 3, 4]) {
    const ls = LEVELS.filter((l) => l.world === w);
    const kinds = new Set(ls.flatMap((l) => [...(l.gadgets || []).map((g) => g.t), ...(l.movers || []).map((m) => m.t), ...(l.parts || []).map((p) => p.mat).filter(Boolean)]));
    assert.ok(kinds.size >= 3, `world ${w} uses at least three different mechanics`);
  }
});

test('every level has something to collect and consistent star thresholds', () => {
  for (const l of LEVELS) {
    assert.ok((l.coins || []).length > 0, `${l.id} has coins`);
    const th = thresholds(l);
    assert.ok(th[0] < th[1], `${l.id} thresholds ordered`);
  }
});
