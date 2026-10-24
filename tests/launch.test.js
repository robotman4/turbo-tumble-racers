import test from 'node:test';
import assert from 'node:assert/strict';
import { aimFromDrag, launchVelocity, launchSpeed, assistAim, yawDir, yawTo, wrapAngle, MIN_SPEED, MAX_SPEED, DEG } from '../src/game/launch.js';

const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;
const veh = { speed: 1 };

test('pulling straight back launches straight ahead', () => {
  const a = aimFromDrag(0, 150, 0.7, 300);
  assert.ok(near(a.yaw, 0.7));
  assert.ok(near(a.power, 0.5));
});

test('pulling to the right launches to the left (slingshot)', () => {
  const a = aimFromDrag(100, 100, 0, 300);
  assert.ok(a.yaw > 0, 'positive yaw turns left (toward -z)');
  assert.ok(near(a.yaw, Math.PI / 4));
  const d = yawDir(a.yaw);
  assert.ok(d.z < 0);
});

test('tiny drags cancel, long drags are capped at full power', () => {
  assert.equal(aimFromDrag(2, 5, 0, 300), null);
  assert.equal(aimFromDrag(0, 2000, 0, 300).power, 1);
});

test('launch speed and direction follow power, pitch and vehicle', () => {
  assert.equal(launchSpeed(0, veh, {}), MIN_SPEED);
  assert.equal(launchSpeed(1, veh, {}), MAX_SPEED);
  assert.equal(launchSpeed(1, { speed: 1.1 }, { power: 0.5 }), MAX_SPEED * 1.1 * 0.5);
  const v = launchVelocity(0, 1, veh, { pitch: 30 });
  assert.ok(near(v.y, MAX_SPEED * Math.sin(30 * DEG)));
  assert.ok(near(v.x, MAX_SPEED * Math.cos(30 * DEG)));
  assert.ok(near(v.z, 0));
});

test('yawTo and yawDir agree', () => {
  for (const [x, z] of [[5, 0], [0, -5], [-3, 4], [2, 7]]) {
    const y = yawTo([0, 0, 0], [x, 0, z]);
    const d = yawDir(y);
    const l = Math.hypot(x, z);
    assert.ok(near(d.x, x / l) && near(d.z, z / l));
  }
  assert.ok(near(wrapAngle(3 * Math.PI), Math.PI) || near(wrapAngle(3 * Math.PI), -Math.PI));
});

test('aim assist pulls toward a nearby hint but ignores far ones', () => {
  const hint = { yaw: 10 * DEG, power: 0.8 };
  const a = assistAim({ yaw: 4 * DEG, power: 0.75 }, hint);
  assert.ok(a.yaw > 4 * DEG && a.yaw < 10 * DEG);
  assert.ok(a.power > 0.75 && a.power <= 0.8);
  const far = assistAim({ yaw: 60 * DEG, power: 0.5 }, hint);
  assert.equal(far.yaw, 60 * DEG);
});
