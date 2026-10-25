// Home-made levels from the level builder. A level is a grid of cells; each cell can hold a
// floor (with a height), a ramp and one item. compileLevel() turns the grid into an ordinary
// level definition, so custom levels run on exactly the same simulation as the built-in ones.
// Pure logic (no DOM), unit tested.
import { tower, crates, prop } from './levels/kit.js';
import { b64e, b64d } from './garage.js';

export const GRID = { cols: 12, rows: 8, cell: 4, maxH: 3, step: 2 };
export const MATS = ['ground', 'jelly', 'icing'];
export const ITEMS = ['start', 'finish', 'trampoline', 'boost', 'spring', 'cannon', 'blocks', 'crate', 'ball', 'coin', 'star'];
const NEEDS_FLOOR = new Set(['start', 'finish', 'trampoline', 'boost', 'spring', 'cannon', 'blocks', 'crate', 'ball']);
export const MAX_CUSTOM_LEVELS = 30;

const key = (c, r) => `${c},${r}`;
export const cellCenter = (c, r) => [c * GRID.cell + GRID.cell / 2, ((r - GRID.rows / 2) + 0.5) * GRID.cell];
export const DIR_YAW = [0, 90, 180, 270]; // 0 = toward +x (away from the start side)

// A fresh level: a starting deck on the left and a finish deck on the right.
export function newLevel(world = 1) {
  const L = { id: Date.now().toString(36), world, cells: {}, verified: false };
  const mid = GRID.rows / 2 - 1;
  for (const c of [0, 1]) for (const r of [mid, mid + 1]) setCell(L, c, r, { h: 0 });
  for (const c of [GRID.cols - 2, GRID.cols - 1]) for (const r of [mid, mid + 1]) setCell(L, c, r, { h: 0 });
  setCell(L, 0, mid, { h: 0, item: { t: 'start', d: 0 } });
  setCell(L, GRID.cols - 1, mid, { h: 0, item: { t: 'finish', d: 0 } });
  return L;
}

export function getCell(L, c, r) { return L.cells[key(c, r)] || null; }
export function setCell(L, c, r, v) {
  if (c < 0 || r < 0 || c >= GRID.cols || r >= GRID.rows) return;
  if (!v || (v.h === undefined && !v.item)) delete L.cells[key(c, r)];
  else L.cells[key(c, r)] = v;
}
const cellsOf = (L) => Object.entries(L.cells).map(([k, v]) => { const [c, r] = k.split(',').map(Number); return { c, r, ...v }; });

// Apply one builder tool to a cell. Returns true when something changed.
export function applyTool(L, tool, c, r) {
  if (c < 0 || r < 0 || c >= GRID.cols || r >= GRID.rows) return false;
  const cur = getCell(L, c, r);
  const cell = cur ? { ...cur, item: cur.item ? { ...cur.item } : undefined } : {};
  const hasFloor = cell.h !== undefined;
  switch (tool) {
    case 'deck':
      if (!hasFloor) cell.h = 0;
      else if (cell.h < GRID.maxH) cell.h++;
      else return false;
      break;
    case 'down':
      if (!hasFloor) return false;
      if (cell.h > 0) cell.h--;
      else { delete cell.h; delete cell.ramp; delete cell.mat; if (cell.item && NEEDS_FLOOR.has(cell.item.t)) delete cell.item; }
      break;
    case 'ramp':
      if (!hasFloor) cell.h = 0;
      cell.ramp = cell.ramp === undefined ? 0 : (cell.ramp + 1) % 4;
      break;
    case 'jelly': case 'icing':
      if (!hasFloor) cell.h = 0;
      cell.mat = cell.mat === tool ? undefined : tool;
      if (!cell.mat) delete cell.mat;
      break;
    case 'turn':
      if (cell.item) cell.item.d = ((cell.item.d || 0) + 1) % 4;
      else if (cell.ramp !== undefined) cell.ramp = (cell.ramp + 1) % 4;
      else return false;
      break;
    case 'eraser':
      if (cell.item) delete cell.item;
      else if (cell.ramp !== undefined) delete cell.ramp;
      else if (hasFloor) { delete cell.h; delete cell.mat; }
      else return false;
      break;
    default: {
      if (!ITEMS.includes(tool)) return false;
      if (cell.item && cell.item.t === tool) { cell.item.d = ((cell.item.d || 0) + 1) % 4; break; }
      if (NEEDS_FLOOR.has(tool) && !hasFloor) cell.h = 0;
      // Only one start and one finish: placing one moves it.
      if (tool === 'start' || tool === 'finish') {
        for (const o of cellsOf(L)) if (o.item && o.item.t === tool && (o.c !== c || o.r !== r)) { const v = { ...getCell(L, o.c, o.r) }; delete v.item; setCell(L, o.c, o.r, v); }
      }
      cell.item = { t: tool, d: 0 };
    }
  }
  if (cell.mat === undefined) delete cell.mat;
  if (cell.ramp === undefined) delete cell.ramp;
  if (!cell.item) delete cell.item;
  setCell(L, c, r, Object.keys(cell).length ? cell : null);
  L.verified = false;
  return true;
}

export function problems(L) {
  const all = cellsOf(L);
  const out = [];
  if (!all.some((o) => o.item?.t === 'start')) out.push('start');
  if (!all.some((o) => o.item?.t === 'finish')) out.push('finish');
  return out;
}

// Grid -> level definition (same format as src/game/levels).
export function compileLevel(L, groundMat) {
  const S = GRID.cell, parts = [], gadgets = [], props = [], coins = [], stars = [];
  let start = null, finish = null;
  for (const o of cellsOf(L)) {
    const [x, z] = cellCenter(o.c, o.r);
    const hasFloor = o.h !== undefined;
    const top = hasFloor ? o.h * GRID.step : 0;
    if (hasFloor) {
      const mat = o.mat === 'jelly' ? 'jelly' : o.mat === 'icing' ? 'icing' : groundMat;
      const bottom = -1.5;
      parts.push({ t: 'box', p: [x, (top + bottom) / 2, z], s: [S, top - bottom, S], mat });
      if (o.ramp !== undefined) {
        const yaw = DIR_YAW[o.ramp];
        parts.push({ t: 'wedge', p: [x, top, z], s: [S, GRID.step, S], yaw, mat: mat === groundMat ? 'wood' : mat });
      }
    }
    const it = o.item;
    if (!it) continue;
    const yaw = DIR_YAW[it.d || 0], yawR = (yaw * Math.PI) / 180;
    const y = hasFloor ? top : 0;
    switch (it.t) {
      case 'start': start = { p: [x, y + 0.6, z], yaw: yawR }; break;
      case 'finish': finish = { p: [x, y, z], r: 3.2 }; break;
      case 'trampoline': gadgets.push({ t: 'trampoline', p: [x, y, z], r: 1.6, bounce: 15 }); break;
      case 'boost': gadgets.push({ t: 'boost', p: [x, y, z], yaw, speed: 22 }); break;
      case 'spring': gadgets.push({ t: 'spring', p: [x, y, z], yaw, pitch: 60, speed: 17 }); break;
      case 'cannon': gadgets.push({ t: 'cannon', p: [x, y + 1.6, z], yaw, pitch: 40, speed: 21 }); break;
      case 'blocks': props.push(...tower(x, z, y, 3)); break;
      case 'crate': props.push(...crates([[x - 0.65, y + 0.6, z], [x + 0.65, y + 0.6, z], [x, y + 1.8, z]])); break;
      case 'ball': props.push(prop('ball', [x, y + 0.7, z])); break;
      case 'coin': coins.push([x, y + 1.2, z]); break;
      case 'star': stars.push([x, y + 2, z]); break;
      default: break;
    }
  }
  const cx = (GRID.cols * S) / 2;
  return {
    id: 'custom-' + L.id, name: 'My Level', world: L.world || 1, launches: 3, custom: true,
    start: start || { p: [2, 0.6, 0], yaw: 0 },
    finish: finish || { p: [0, -100, 0], r: 0.1 },
    cam: [cx, 30, 30],
    parts: parts.length ? parts : [{ t: 'box', p: [2, -0.75, 0], s: [4, 1.5, 4] }],
    gadgets, props, coins, stars, routes: {},
  };
}

// ---------- share codes ----------
// Compact: [world, [c, r, h|-1, mat, ramp|-1, item|-1, dir], ...]
export function levelCode(L) {
  const rows = cellsOf(L).map((o) => [o.c, o.r, o.h ?? -1, MATS.indexOf(o.mat || 'ground'), o.ramp ?? -1, o.item ? ITEMS.indexOf(o.item.t) : -1, o.item?.d || 0]);
  return 'TTL1' + b64e(JSON.stringify([L.world || 1, rows]));
}

export function decodeLevel(code) {
  try {
    if (!code.startsWith('TTL1')) return null;
    const [world, rows] = JSON.parse(b64d(code.slice(4).trim()));
    if (![1, 2, 3, 4].includes(world) || !Array.isArray(rows) || rows.length > GRID.cols * GRID.rows) return null;
    const L = { id: Date.now().toString(36), world, cells: {}, verified: false };
    const int = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
    for (const r of rows) {
      const [c, rr, h, m, ramp, item, d] = r;
      if (!int(c, 0, GRID.cols - 1) || !int(rr, 0, GRID.rows - 1) || !int(h, -1, GRID.maxH) || !int(m, 0, MATS.length - 1) || !int(ramp, -1, 3) || !int(item, -1, ITEMS.length - 1) || !int(d, 0, 3)) return null;
      const v = {};
      if (h >= 0) v.h = h;
      if (m > 0) v.mat = MATS[m];
      if (ramp >= 0) v.ramp = ramp;
      if (item >= 0) v.item = { t: ITEMS[item], d };
      setCell(L, c, rr, v);
    }
    // A shared level was finished by its maker before sharing (sharing needs that).
    L.verified = !problems(L).length;
    return L;
  } catch (e) { return null; }
}
