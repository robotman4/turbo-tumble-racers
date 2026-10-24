// Checks a level definition and returns a list of problems (empty = valid).
// Used by the tests so a typo in level data fails loudly instead of at play time.
import { SURFACES } from '../worlds.js';
import { PROP_KINDS } from '../sim.js';

const PART_TYPES = ['box', 'cyl', 'wedge'];
const GADGETS = ['boost', 'spring', 'trampoline', 'fan', 'gravity', 'cannon'];
const MOVERS = ['slider', 'float', 'spinner', 'pendulum', 'bridge'];

const vec = (v, n = 3) => Array.isArray(v) && v.length === n && v.every((x) => typeof x === 'number' && Number.isFinite(x));

export function validateLevel(L) {
  const errs = [];
  const e = (m) => errs.push(`${L.id || '?'}: ${m}`);
  if (typeof L.id !== 'string') e('missing id');
  if (typeof L.name !== 'string' || !L.name) e('missing name');
  if (![1, 2, 3, 4].includes(L.world)) e('world must be 1-4');
  if (!L.start || !vec(L.start.p)) e('start.p must be [x,y,z]');
  if (L.start && typeof L.start.yaw !== 'number') e('start.yaw must be a number');
  if (!L.finish || !vec(L.finish.p) || !(L.finish.r > 0)) e('finish needs p and r');
  if (!vec(L.cam)) e('cam must be [x,y,z]');
  if (!(Number.isInteger(L.launches) && L.launches >= 0)) e('launches must be an integer (0 = unlimited)');
  if (L.thresholds && !(L.thresholds.length === 2 && L.thresholds[0] < L.thresholds[1])) e('thresholds must be [two, three] ascending');
  if (!Array.isArray(L.parts) || !L.parts.length) e('needs at least one part');
  for (const [i, p] of (L.parts || []).entries()) {
    if (!PART_TYPES.includes(p.t)) e(`part ${i}: unknown type ${p.t}`);
    if (!vec(p.p)) e(`part ${i}: bad position`);
    if ((p.t === 'box' || p.t === 'wedge') && !(vec(p.s) && p.s.every((x) => x > 0))) e(`part ${i}: bad size`);
    if (p.t === 'cyl' && !(p.r > 0 && p.h > 0)) e(`part ${i}: bad cylinder`);
    if (p.mat && !SURFACES[p.mat]) e(`part ${i}: unknown surface ${p.mat}`);
  }
  for (const [i, p] of (L.props || []).entries()) {
    if (!PROP_KINDS[p.t]) e(`prop ${i}: unknown kind ${p.t}`);
    if (!vec(p.p)) e(`prop ${i}: bad position`);
  }
  for (const [i, g] of (L.gadgets || []).entries()) {
    if (!GADGETS.includes(g.t)) e(`gadget ${i}: unknown type ${g.t}`);
    if (!vec(g.p)) e(`gadget ${i}: bad position`);
    if ((g.t === 'fan' || g.t === 'gravity') && !vec(g.s)) e(`gadget ${i}: zone needs size s`);
    if (g.t === 'gravity' && !vec(g.g)) e(`gadget ${i}: gravity needs g`);
  }
  for (const [i, m] of (L.movers || []).entries()) {
    if (!MOVERS.includes(m.t)) e(`mover ${i}: unknown type ${m.t}`);
    if (!vec(m.p)) e(`mover ${i}: bad position`);
    if ((m.t === 'slider' || m.t === 'float' || m.t === 'spinner') && !vec(m.s)) e(`mover ${i}: needs size s`);
    if ((m.t === 'pendulum' || m.t === 'bridge') && !(m.len > 0)) e(`mover ${i}: needs len`);
  }
  for (const [i, c] of (L.coins || []).entries()) if (!vec(c)) e(`coin ${i}: bad position`);
  for (const [i, c] of (L.stars || []).entries()) if (!vec(c)) e(`star ${i}: bad position`);
  for (const [i, s] of (L.secrets || []).entries()) if (!vec(s.p)) e(`secret ${i}: bad position`);
  if (L.routes) for (const [k, r] of Object.entries(L.routes)) if (!Array.isArray(r) || !r.every((w) => vec(w, 2))) e(`route ${k}: waypoints must be [x,z]`);
  return errs;
}

// A cheap fingerprint of a course layout, used to make sure no two levels are copies.
export function layoutKey(L) {
  const r = (x) => Math.round(x);
  return JSON.stringify([
    (L.parts || []).map((p) => [p.t, p.mat, ...p.p.map(r)]),
    (L.gadgets || []).map((g) => g.t), (L.movers || []).map((m) => m.t),
    L.finish.p.map(r),
  ]);
}
