import test from 'node:test';
import assert from 'node:assert/strict';
import { ScoreKeeper, POINTS, thresholds, starsFor, COMBO_WINDOW } from '../src/game/scoring.js';

test('the same object only scores once per attempt', () => {
  const s = new ScoreKeeper();
  assert.ok(s.destroy('p1', 1));
  assert.equal(s.destroy('p1', 1.2), null);
  assert.equal(s.counts.destroy, 1);
  assert.ok(s.add('coin', POINTS.coin, 'c0'));
  assert.equal(s.add('coin', POINTS.coin, 'c0'), null);
  assert.equal(s.total, POINTS.destroy + POINTS.coin);
});

test('quick destructions build a combo, slow ones reset it', () => {
  const s = new ScoreKeeper();
  s.destroy('a', 0, false);
  s.destroy('b', 0.5, false);
  s.destroy('c', 0.9, false);
  assert.equal(s.combo, 3);
  const comboPts = s.events.filter((e) => e.type === 'combo').reduce((a, e) => a + e.pts, 0);
  assert.equal(comboPts, POINTS.combo * 1 + POINTS.combo * 2);
  s.destroy('d', 0.9 + COMBO_WINDOW + 0.5, false);
  assert.equal(s.combo, 1);
});

test('props knocked by other props count as a chain reaction', () => {
  const s = new ScoreKeeper();
  s.destroy('a', 0, true);
  assert.equal(s.counts.chain, 1);
  assert.equal(s.total, POINTS.destroy + POINTS.chain);
});

test('jumps: big air, upright landing and flips', () => {
  const s = new ScoreKeeper();
  s.jump(0.5, 0.4, true, 1);
  assert.equal(s.total, 0, 'short hops score nothing');
  s.jump(2, 2.3, true, 3);
  assert.equal(s.total, Math.round(POINTS.bigAir * 2) + POINTS.landing + POINTS.flip * 2);
});

test('finishing gives the finish bonus plus unused launches', () => {
  const s = new ScoreKeeper();
  s.finish(2, 5);
  assert.equal(s.total, POINTS.finish + 2 * POINTS.launchLeft);
  s.finish(2, 6);
  assert.equal(s.total, POINTS.finish + 2 * POINTS.launchLeft, 'finish only counts once');
  const u = new ScoreKeeper();
  u.finish(Infinity, 1);
  assert.equal(u.total, POINTS.finish, 'unlimited launches give no launch bonus');
});

test('stars: never 0 when finished, 1-3 by threshold', () => {
  const th = [1500, 2200];
  assert.equal(starsFor(0, th, true), 1);
  assert.equal(starsFor(1499, th, true), 1);
  assert.equal(starsFor(1500, th, true), 2);
  assert.equal(starsFor(5000, th, true), 3);
  assert.equal(starsFor(5000, th, false), 0);
});

test('default thresholds grow with what a level offers and stay ordered', () => {
  const small = thresholds({ coins: [[0, 0, 0]], launches: 3 });
  const big = thresholds({ coins: Array(10).fill([0, 0, 0]), stars: [[0, 0, 0], [0, 0, 0]], props: Array(20).fill({}), launches: 3 });
  assert.ok(small[0] < small[1]);
  assert.ok(big[0] > small[0] && big[1] > small[1]);
  assert.ok(small[0] > POINTS.finish, 'two stars needs more than just finishing');
  assert.deepEqual(thresholds({ thresholds: [1, 2] }), [1, 2]);
});
