// Headless level solver: searches for a sequence of launches that finishes a level.
// Used by `npm run solve` (records solutions), the tests (proves every level can be
// finished with every vehicle) and the in-game developer panel. No rendering.
import { Sim } from './sim.js';
import { yawTo, wrapAngle, DEG } from './launch.js';

const OFFSETS = [0, -5, 5, -10, 10, -16, 16, -24, 24, -35, 35];
const POWERS = [0.3, 0.42, 0.54, 0.64, 0.74, 0.82, 0.9, 0.96, 1];

function evaluate(sim) {
  const L = sim.level, p = sim.body().translation();
  if (sim.finished) return 1e6 + sim.score.total;
  const F = L.finish.p;
  // Progress along the route if there is one, otherwise straight distance to the finish.
  const d = Math.hypot(p.x - F[0], p.z - F[2]) + Math.max(0, F[1] - p.y) * 1.5;
  return -d * 10 + sim.score.total * 0.01;
}

function baseYaws(sim) {
  const L = sim.level, t = sim.body().translation(), here = [t.x, t.y, t.z];
  const out = [sim.st.aimYaw, yawTo(here, L.finish.p)];
  for (const route of Object.values(L.routes || {})) {
    for (const w of route) {
      const pt = [w[0], 0, w[1]];
      if (Math.hypot(pt[0] - here[0], pt[2] - here[2]) > 4) out.push(yawTo(here, pt));
    }
  }
  // Drop near-duplicates.
  const uniq = [];
  for (const y of out) if (!uniq.some((u) => Math.abs(wrapAngle(u - y)) < 3 * DEG)) uniq.push(y);
  return uniq;
}

// Beam search over launches. Returns { launches, score, finished } or null.
export function solve(level, vehicle, opts = {}) {
  const beam = opts.beam || 3, maxLaunches = Math.min(level.launches || 3, opts.maxLaunches || 3);
  const sim = new Sim(level, vehicle, opts.simOpts || {});
  let frontier = [{ snap: sim.snapshot(), launches: [], val: -Infinity }];
  let best = null;
  try {
    for (let depth = 0; depth < maxLaunches; depth++) {
      const next = [];
      for (const node of frontier) {
        sim.restore(node.snap);
        const bases = baseYaws(sim);
        const tried = [];
        for (const base of bases) for (const off of OFFSETS) {
          const yaw = wrapAngle(base + off * DEG);
          if (tried.some((y) => Math.abs(wrapAngle(y - yaw)) < 2 * DEG)) continue;
          tried.push(yaw);
          for (const power of POWERS) {
            sim.restore(node.snap);
            const fp = sim.body().translation(), from = [Math.round(fp.x * 100) / 100, Math.round(fp.z * 100) / 100];
            sim.launch(yaw, power);
            sim.runUntilRest(opts.maxT || 16);
            const val = evaluate(sim);
            const launches = [...node.launches, { yaw, power, from }];
            if (sim.finished) {
              if (!best || val > best.val) best = { launches, val, score: sim.score.total, finished: true };
            } else if (sim.state === 'aim') {
              next.push({ val, launches, snap: null, yaw, power, parent: node });
            }
          }
        }
        if (best && opts.firstHit !== false) break;
      }
      if (best) break;
      // Keep the best few distinct positions for the next launch.
      next.sort((a, b) => b.val - a.val);
      frontier = [];
      for (const n of next) {
        if (frontier.length >= beam) break;
        sim.restore(n.parent.snap);
        sim.launch(n.yaw, n.power);
        sim.runUntilRest(opts.maxT || 16);
        const t = sim.body().translation();
        if (frontier.some((f) => Math.hypot(f.pos[0] - t.x, f.pos[2] - t.z) < 1.5)) continue;
        frontier.push({ snap: sim.snapshot(), launches: n.launches, val: n.val, pos: [t.x, t.y, t.z] });
      }
      if (!frontier.length) break;
    }
  } finally {
    sim.free();
  }
  return best ? { launches: best.launches, score: best.score, finished: true } : null;
}

// Replays launches exactly as the game would (each one as soon as the vehicle is at rest).
export function replay(level, vehicle, launches, simOpts = {}) {
  const sim = new Sim(level, vehicle, simOpts);
  try {
    for (const l of launches) {
      if (sim.state !== 'aim') break;
      sim.launch(l.yaw, l.power);
      sim.runUntilRest(16);
      if (sim.finished) break;
    }
    return { finished: sim.finished, score: sim.score.total, used: sim.st.used, pos: sim.vehiclePose().p };
  } finally {
    sim.free();
  }
}
