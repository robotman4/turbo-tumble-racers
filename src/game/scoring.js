// Scoring rules. Pure logic with no physics or rendering, so it is unit tested directly.

export const POINTS = {
  finish: 1000,
  coin: 50,
  star: 250,
  destroy: 25,     // each prop knocked over or broken, once per attempt
  chain: 40,       // extra when a prop was knocked by another prop, not by the vehicle
  combo: 15,       // extra per step of a combo (destructions close together)
  bigAir: 80,      // per second in the air, for jumps longer than a second
  flip: 150,       // each full flip or spin in the air
  landing: 100,    // landing upright after a big jump
  launchLeft: 300, // each unused launch when finishing
  secret: 500,
};
export const COMBO_WINDOW = 1.0; // seconds between destructions that keep a combo going

export class ScoreKeeper {
  constructor() {
    this.total = 0;
    this.events = [];       // { type, pts, id, t, label }
    this.seen = new Set();  // ids already scored this attempt
    this.combo = 0;
    this.lastDestroyT = -99;
    this.counts = { coin: 0, star: 0, destroy: 0, chain: 0, flip: 0, secret: 0 };
  }

  // Adds points once per id. Returns the event, or null if that id was already scored.
  add(type, pts, id = null, t = 0, extra = {}) {
    if (this.frozen) return null; // the result has been shown: nothing more counts
    if (id !== null) {
      const key = type + ':' + id;
      if (this.seen.has(key)) return null;
      this.seen.add(key);
    }
    const ev = { type, pts, id, t, ...extra };
    this.total += pts;
    this.events.push(ev);
    if (type in this.counts) this.counts[type]++;
    return ev;
  }

  // A prop was knocked over or broken. `chain` = it was hit by another prop.
  destroy(id, t, chain = false) {
    const ev = this.add('destroy', POINTS.destroy, id, t);
    if (!ev) return null;
    if (t - this.lastDestroyT <= COMBO_WINDOW) this.combo++;
    else this.combo = 1;
    this.lastDestroyT = t;
    if (this.combo >= 2) this.add('combo', POINTS.combo * (this.combo - 1), null, t, { combo: this.combo });
    if (chain) this.add('chain', POINTS.chain, id, t);
    return ev;
  }

  // Score a finished jump. Returns the list of events it produced.
  jump(airTime, turns, upright, t) {
    const out = [];
    if (airTime >= 1) {
      out.push(this.add('bigAir', Math.round(POINTS.bigAir * airTime), null, t, { air: airTime }));
      if (upright) out.push(this.add('landing', POINTS.landing, null, t));
    }
    const flips = Math.floor(turns);
    if (flips > 0) out.push(this.add('flip', POINTS.flip * flips, null, t, { flips }));
    return out;
  }

  finish(launchesLeft, t) {
    this.add('finish', POINTS.finish, 'finish', t);
    const left = Number.isFinite(launchesLeft) ? Math.max(0, launchesLeft) : 0;
    if (left > 0) this.add('launchLeft', POINTS.launchLeft * left, 'launchLeft', t, { left });
  }
}

// Score needed for 2 and 3 stars. Finishing always gives at least 1 star.
// Levels may set `thresholds: [two, three]`; otherwise it follows from what the level offers,
// so the thresholds stay consistent across all levels.
export function thresholds(level) {
  if (level.thresholds) return level.thresholds;
  const coins = (level.coins || []).length;
  const stars = (level.stars || []).length;
  const props = countProps(level);
  const launches = level.launches || 3;
  const potential = coins * POINTS.coin + stars * POINTS.star + Math.min(props, 30) * POINTS.destroy + (launches - 1) * POINTS.launchLeft;
  const two = POINTS.finish + Math.round((potential * 0.3) / 50) * 50;
  const three = POINTS.finish + Math.round((potential * 0.55) / 50) * 50;
  return [two, Math.max(three, two + 100)];
}

export function countProps(level) {
  return (level.props || []).length;
}

export function starsFor(score, th, finished = true) {
  if (!finished) return 0;
  if (score >= th[1]) return 3;
  if (score >= th[0]) return 2;
  return 1;
}

// Short labels for the floating score popups (numbers are fine for kids; words stay short).
export function popupLabel(ev) {
  switch (ev.type) {
    case 'combo': return `x${ev.combo}`;
    case 'flip': return ev.flips > 1 ? `${ev.flips}x FLIP` : 'FLIP';
    case 'bigAir': return 'BIG AIR';
    case 'landing': return 'NICE';
    case 'chain': return 'CHAIN';
    case 'secret': return 'SECRET';
    default: return null;
  }
}
