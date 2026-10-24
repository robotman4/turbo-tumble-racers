// Small helpers that produce plain level data. Levels stay declarative: each helper returns
// ordinary objects ({ t: 'box', p, s, mat } and so on) that end up in the level definition.
//
// Conventions: metres, y up. Yaw in degrees, 0 = facing +x, positive turns toward -z.
// Box / cylinder `p` is the centre. Wedge `p` is the centre of its bottom face.

// Flat deck whose TOP surface is at `top`, spanning x0..x1.
export function slab(x0, x1, top, o = {}) {
  const th = o.th || 1;
  return { t: 'box', p: [(x0 + x1) / 2, top - th / 2, o.z || 0], s: [x1 - x0, th, o.w || 8], mat: o.mat };
}
// Deck running along z instead of x.
export function slabZ(z0, z1, top, o = {}) {
  const th = o.th || 1;
  return { t: 'box', p: [o.x || 0, top - th / 2, (z0 + z1) / 2], s: [o.w || 8, th, Math.abs(z1 - z0)], mat: o.mat };
}
export const box = (p, s, mat, r) => ({ t: 'box', p, s, mat, ...(r ? { r } : {}) });
export const cyl = (p, r, h, mat) => ({ t: 'cyl', p, r, h, mat });
// Ramp rising toward its yaw direction. Starts at x (low end) when yaw = 0.
export function ramp(x, y, z, len, h, o = {}) {
  const yaw = o.yaw || 0, a = (yaw * Math.PI) / 180;
  return { t: 'wedge', p: [x + Math.cos(a) * len / 2, y, z - Math.sin(a) * len / 2], s: [len, h, o.w || 6], yaw, mat: o.mat };
}
// Low wall / rail along x at the side of a deck.
export const rail = (x0, x1, top, z, mat = 'wood', h = 1) => box([(x0 + x1) / 2, top + h / 2, z], [x1 - x0, h, 0.5], mat);

// ---------- collectibles ----------
export function coinLine(a, b, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const k = n === 1 ? 0.5 : i / (n - 1);
    out.push([a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]);
  }
  return out;
}
// Coins along a jump arc from a to b with peak height h above the straight line.
export function coinArc(a, b, h, n) {
  return coinLine(a, b, n).map((p, i) => {
    const k = n === 1 ? 0.5 : i / (n - 1);
    return [p[0], p[1] + Math.sin(k * Math.PI) * h, p[2]];
  });
}
export function coinRing(c, r, n) {
  const out = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; out.push([c[0] + Math.cos(a) * r, c[1], c[2] + Math.sin(a) * r]); }
  return out;
}

// ---------- props ----------
// Wall of toy blocks across the course (along z), `rows` high, standing on `y0`.
export function blockWall(x, z, y0, cols, rows, o = {}) {
  const s = o.size || 0.8, out = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    out.push({ t: o.kind || 'block', p: [x, y0 + s / 2 + r * s, z + (c - (cols - 1) / 2) * s * 1.02], c: (r + c) % 6 });
  }
  return out;
}
export function tower(x, z, y0, rows, o = {}) {
  const s = o.size || 0.8, out = [];
  for (let r = 0; r < rows; r++) {
    for (const [dx, dz] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) {
      if (o.thin && (dx > 0)) continue;
      out.push({ t: o.kind || 'block', p: [x + dx * s * 1.02, y0 + s / 2 + r * s, z + dz * s * 1.02], c: r % 6 });
    }
  }
  return out;
}
export function pyramid(x, z, y0, base, o = {}) {
  const s = o.size || 0.8, out = [];
  for (let r = 0; r < base; r++) for (let c = 0; c < base - r; c++) {
    out.push({ t: o.kind || 'block', p: [x, y0 + s / 2 + r * s, z + (c - (base - r - 1) / 2) * s * 1.02], c: (r * 2 + c) % 6 });
  }
  return out;
}
export function crates(list) { return list.map((p) => ({ t: 'crate', p })); }
// Ten-pin triangle pointing toward -x (the side the player comes from) at yaw 0.
export function pins(x, z, y0, rows = 4) {
  const out = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c <= r; c++) out.push({ t: 'pin', p: [x + r * 0.75, y0 + 0.6, z + (c - r / 2) * 0.75] });
  return out;
}
export function dominoes(a, b, n, y0) {
  const out = [], yaw = Math.atan2(-(b[1] - a[1]), b[0] - a[0]) * 180 / Math.PI;
  for (let i = 0; i < n; i++) {
    const k = n === 1 ? 0 : i / (n - 1);
    out.push({ t: 'domino', p: [a[0] + (b[0] - a[0]) * k, y0 + 0.65, a[1] + (b[1] - a[1]) * k], yaw, c: i % 6 });
  }
  return out;
}
export const prop = (t, p, o = {}) => ({ t, p, ...o });
