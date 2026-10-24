// Launch math: turning a finger drag into a direction and power, and power into a velocity.
// Pure functions, unit tested.

export const MIN_SPEED = 7;
export const MAX_SPEED = 25;
export const MIN_PULL = 0.12;   // shorter drags (as a fraction of the full pull) cancel the aim
export const DEG = Math.PI / 180;

// Yaw 0 faces +x; positive yaw turns toward -z (same as a Three.js rotation.y).
export const yawDir = (yaw) => ({ x: Math.cos(yaw), z: -Math.sin(yaw) });
export const yawTo = (from, to) => Math.atan2(-(to[2] - from[2]), to[0] - from[0]);

export function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

// Drag in screen space (dx right, dy down) while the camera looks along camYaw.
// Pulling back (down the screen) launches forward, like a slingshot. Any direction works.
export function aimFromDrag(dx, dy, camYaw, maxPull) {
  const len = Math.hypot(dx, dy);
  const power = Math.min(1, len / maxPull);
  if (power < MIN_PULL) return null;
  return { yaw: wrapAngle(camYaw + Math.atan2(dx, dy)), power };
}

export function launchSpeed(power, vehicle, level) {
  const p = Math.max(0, Math.min(1, power));
  return (MIN_SPEED + (MAX_SPEED - MIN_SPEED) * p) * (vehicle.speed || 1) * (level.power || 1);
}

export function launchVelocity(yaw, power, vehicle, level) {
  const pitch = (level.pitch ?? 32) * DEG;
  const s = launchSpeed(power, vehicle, level);
  const d = yawDir(yaw);
  return { x: d.x * Math.cos(pitch) * s, y: Math.sin(pitch) * s, z: d.z * Math.cos(pitch) * s };
}

// Easy Mode: pull the aim gently toward a known good direction when it is already close.
export function assistAim(aim, hint, strength = 0.6, windowDeg = 14) {
  if (!aim || !hint) return aim;
  const diff = wrapAngle(hint.yaw - aim.yaw);
  if (Math.abs(diff) > windowDeg * DEG) return aim;
  const yaw = wrapAngle(aim.yaw + diff * strength);
  const dp = hint.power - aim.power;
  const power = Math.abs(dp) < 0.15 ? aim.power + dp * strength * 0.5 : aim.power;
  return { yaw, power };
}
