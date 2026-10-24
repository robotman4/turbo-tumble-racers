// Developer mode: a small DOM panel (text is fine here, it is for grown-ups) to load any
// level, show FPS and vehicle coordinates, draw collision shapes, reset the vehicle,
// run the level solver and play its solution, inspect scoring events and test GPU context loss.
// Turn it on in Settings (bug button) or with ?debug in the URL.
import { save, persist } from './storage.js';

export const debugState = { on: false, scene: null, colliders: false };
let game = null, panel = null, fpsT = 0, frames = 0, fps = 0;

export function initDebug(g) {
  game = g;
  if (/[?&]debug\b/.test(location.search)) { save.settings.debug = true; persist(); }
  setDebug(save.settings.debug);
}

export function setDebug(on) {
  debugState.on = on;
  if (on && !panel) build();
  if (panel) panel.style.display = on ? 'block' : 'none';
}

function btn(text, fn) {
  const b = document.createElement('button');
  b.textContent = text;
  b.style.cssText = 'margin:2px;padding:4px 8px;font:12px monospace;border-radius:6px;border:1px solid #888;background:#fff;cursor:pointer;';
  b.addEventListener('pointerdown', (e) => { e.stopPropagation(); fn(); });
  return b;
}

async function build() {
  panel = document.createElement('div');
  panel.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:20;background:rgba(20,14,40,0.82);color:#fff;font:12px monospace;padding:8px;border-radius:10px;max-width:360px;touch-action:auto;';
  panel.addEventListener('pointerdown', (e) => e.stopPropagation());
  const info = document.createElement('pre');
  info.style.cssText = 'margin:0 0 6px 0;white-space:pre-wrap;';
  panel.appendChild(info);
  const sel = document.createElement('select');
  sel.style.cssText = 'font:12px monospace;margin:2px;';
  const { LEVELS } = await import('./game/levels/index.js');
  for (const l of [...LEVELS, { id: 'playground', name: 'Playground' }]) { const o = document.createElement('option'); o.value = l.id; o.textContent = `${l.id} ${l.name}`; sel.appendChild(o); }
  panel.appendChild(sel);
  const nav = () => import('./scenes/nav.js');
  panel.appendChild(btn('Load', async () => (await nav()).startLevel(game, sel.value, sel.value === 'playground' ? 'playground' : 'adventure')));
  panel.appendChild(btn('Colliders', () => { debugState.colliders = !debugState.colliders; }));
  panel.appendChild(btn('Reset car', () => debugState.scene?.sim?.resetVehicle()));
  panel.appendChild(btn('Solve+play', async () => {
    const s = debugState.scene;
    if (!s || !s.sim) return;
    info.textContent = 'solving…';
    await new Promise((r) => setTimeout(r, 30));
    const { solve } = await import('./game/solver.js');
    const r = solve(s.level, s.vehicleDef, { simOpts: { easy: s.easy } });
    if (!r) { info.textContent = 'no solution found'; return; }
    s.restart(); s.autoplay = r.launches.map((l) => ({ ...l }));
  }));
  panel.appendChild(btn('Lose GL', () => game.r3d.loseContext()));
  panel.appendChild(btn('Hide', () => setDebug(false)));
  const log = document.createElement('pre');
  log.style.cssText = 'margin:6px 0 0 0;max-height:120px;overflow:auto;white-space:pre-wrap;color:#bfe8ff;';
  panel.appendChild(log);
  document.body.appendChild(panel);
  const tick = (now) => {
    frames++;
    if (now - fpsT > 500) { fps = Math.round((frames * 1000) / (now - fpsT)); fpsT = now; frames = 0; }
    const s = debugState.scene;
    if (debugState.on && s && s.sim) {
      const p = s.sim.vehiclePose().p, v = s.sim.vehicleVel();
      info.textContent = `FPS ${fps}  dpr ${game.r3d.dpr.toFixed(2)}  ${game.r3d.qKey}\n` +
        `${s.level.id} ${s.vehicleDef.id}  state ${s.sim.state}  t ${s.sim.t.toFixed(1)}\n` +
        `pos ${p.map((x) => x.toFixed(2)).join(', ')}\nvel ${Math.hypot(v.x, v.y, v.z).toFixed(1)}  air ${s.sim.st.air.toFixed(2)}  cam ${s.rig.mode}\n` +
        `score ${s.sim.score.total}  launches ${s.sim.st.used}/${s.sim.maxLaunches}`;
      log.textContent = s.sim.score.events.slice(-8).reverse().map((e) => `${e.t.toFixed(1)}s ${e.type} +${e.pts}`).join('\n');
    } else if (debugState.on) info.textContent = `FPS ${fps}  dpr ${game.r3d.dpr.toFixed(2)}`;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
