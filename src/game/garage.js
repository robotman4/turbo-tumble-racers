// Garage data: upgrades bought with coins, and custom cars from the car builder.
// Pure logic (no DOM), unit tested.
//
// Upgrades only scale the vehicle numbers from vehicles.js a little, so every car stays in the
// range the level solver has tested. Custom cars take their physics from the body they use
// (kart = Panda Kart, board = Dino Board, cart = Chicken Cart); the driver and paint are looks.
import { VEHICLES, vehicleById } from './vehicles.js';

export const MAX_UPGRADE = 3;
export const UPGRADES = [
  { id: 'turbo', icon: 'turbo', name: 'Turbo', costs: [80, 160, 300], apply: (v, n) => ({ speed: v.speed * (1 + 0.04 * n) }) },
  { id: 'springs', icon: 'springs', name: 'Springs', costs: [60, 140, 260], apply: (v, n) => ({ bounce: Math.min(0.85, v.bounce + 0.08 * n) }) },
  { id: 'wings', icon: 'wings', name: 'Wings', costs: [80, 160, 300], apply: (v, n) => ({ gravity: v.gravity * (1 - 0.04 * n) }) },
  { id: 'bumper', icon: 'bumper', name: 'Bumper', costs: [60, 120, 220], apply: (v, n) => ({ impact: v.impact * (1 + 0.3 * n) }) },
];

export const BODIES = { kart: 'panda', board: 'dino', cart: 'chicken' };
export const DRIVERS = ['panda', 'dino', 'chicken'];
const VOICE = { panda: 'honk', dino: 'rawr', chicken: 'bawk' };
export const CAR_PAINTS = ['#e8443a', '#f5962a', '#f7d43c', '#5cc95a', '#3fd4a4', '#3b8fe8', '#9b5de5', '#f06fb0', '#ffffff', '#2a2438'];

export function upgradeCost(id, level) {
  const u = UPGRADES.find((x) => x.id === id);
  return u && level < MAX_UPGRADE ? u.costs[level] : null;
}

export function applyUpgrades(def, ups = {}) {
  let v = { ...def };
  for (const u of UPGRADES) {
    const n = Math.max(0, Math.min(MAX_UPGRADE, ups[u.id] || 0));
    if (n) v = { ...v, ...u.apply(v, n) };
  }
  return v;
}

export function customVehicle(c) {
  const base = vehicleById(BODIES[c.body] || 'panda');
  return {
    ...base, id: 'custom:' + c.id, name: c.name || 'My Car', custom: true,
    body: c.body in BODIES ? c.body : 'kart', driver: DRIVERS.includes(c.driver) ? c.driver : 'panda',
    skin: c.skin, voice: VOICE[c.driver] || base.voice,
    paints: [{ id: 'own', color: c.paint || '#3b8fe8', cost: 0 }],
  };
}

// The vehicle definition a save is playing with (custom or built-in, upgrades applied),
// plus the paint colour to draw it with.
export function playerVehicle(save) {
  let def;
  if (String(save.vehicle).startsWith('custom:')) {
    const c = (save.customCars || []).find((x) => 'custom:' + x.id === save.vehicle);
    def = c ? customVehicle(c) : VEHICLES[0];
  } else def = vehicleById(save.vehicle);
  const paint = def.custom ? def.paints[0].color : (def.paints.find((p) => p.id === save.paint[def.id]) || def.paints[0]).color;
  return { def: applyUpgrades(def, save.upgrades?.[def.id]), base: def, paint };
}

// Buy the next level of an upgrade. Returns true when bought.
export function buyUpgrade(save, carId, upId) {
  const ups = (save.upgrades[carId] = save.upgrades[carId] || {});
  const cost = upgradeCost(upId, ups[upId] || 0);
  if (cost === null || save.coins < cost) return false;
  save.coins -= cost;
  ups[upId] = (ups[upId] || 0) + 1;
  return true;
}

// ---------- share codes (no server: the whole thing travels in the code) ----------
const b64e = (s) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64d = (s) => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))));

export function carCode(c) { return 'TTC1' + b64e(JSON.stringify({ b: c.body, d: c.driver, p: c.paint, s: c.skin || null, n: c.name || '' })); }
export function decodeCar(code) {
  try {
    if (!code.startsWith('TTC1')) return null;
    const o = JSON.parse(b64d(code.slice(4).trim()));
    if (!(o.b in BODIES) || !DRIVERS.includes(o.d) || !/^#[0-9a-f]{6}$/i.test(o.p)) return null;
    return { body: o.b, driver: o.d, paint: o.p, skin: o.s && /^#[0-9a-f]{6}$/i.test(o.s) ? o.s : undefined, name: String(o.n || '').slice(0, 20) };
  } catch (e) { return null; }
}
export { b64e, b64d };
