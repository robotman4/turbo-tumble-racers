// Boot: canvases, resize, input, main loop and scene switching.
// Two stacked canvases: WebGL (#gl) for the 3D world and a 2D canvas (#game) on top for UI.
// A scene that shows 3D exposes `stage` ({ scene, camera }) and the loop renders it first.
import { V } from './core.js';
import { unlockAudio } from './audio.js';
import { Renderer3D } from './render/renderer.js';
import { save, restoreNativeSave } from './storage.js';
import { TitleScene } from './scenes/title.js';
import { initDebug } from './debug.js';
import './pwa.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const glCanvas = document.getElementById('gl');
const safeEl = document.getElementById('safe');

// Measure the canvas as CSS actually laid it out (full screen). iOS sometimes reports a stale
// or too small window.innerHeight (after rotating, coming back to the app, around the home
// indicator), which used to leave a strip of page background at the bottom.
let lastW = 0, lastH = 0;
function screenSize() {
  const r = canvas.getBoundingClientRect();
  return [Math.round(r.width) || window.innerWidth, Math.round(r.height) || window.innerHeight];
}

// iOS home-screen apps with the black-translucent status bar report a window one status bar
// too short in portrait (e.g. 797 instead of 844). Fixed-position elements are clipped to that
// short window, which left a strip of page background at the bottom, while normal page content
// is still painted below it. So in that case the page and both canvases switch from fixed to
// absolute layout at the full screen height. `window.__gapFix` shows in the info panel.
const pageEls = [document.documentElement, document.body];
// The fix changes the layout, which fires another resize. So once it is on, it stays on until
// the orientation changes; undoing it on every resize made it flicker on and off.
let gapFor = null;
function setGapLayout(full) {
  for (const el of [...pageEls, canvas, glCanvas]) {
    if (full) Object.assign(el.style, { position: 'absolute', top: '0', bottom: 'auto', height: full + 'px' });
    else for (const k of ['position', 'top', 'bottom', 'height']) el.style[k] = '';
  }
  window.__gapFix = !!full;
}
function fixStandaloneGap() {
  const portrait = window.matchMedia('(orientation: portrait)').matches;
  const key = portrait ? 'portrait' : 'landscape';
  if (gapFor && gapFor !== key) { setGapLayout(0); gapFor = null; }
  if (gapFor) return;
  const app = navigator.standalone || ['standalone', 'fullscreen'].some((m) => window.matchMedia(`(display-mode: ${m})`).matches);
  if (!app) return;
  const full = portrait ? Math.max(screen.width, screen.height) : Math.min(screen.width, screen.height);
  const short = full - window.innerHeight;
  if (short < 2 || short > 120) return;
  setGapLayout(full);
  gapFor = key;
}

function resize() {
  fixStandaloneGap();
  const [w, h] = screenSize();
  lastW = w; lastH = h;
  V.dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(w * V.dpr);
  canvas.height = Math.round(h * V.dpr);
  // The short side is always 768 logical units: landscape is 768 high, portrait 768 wide.
  if (w >= h) { V.h = 768; V.w = (768 * w) / h; } else { V.w = 768; V.h = (768 * h) / w; }
  V.portrait = w < h;
  V.scale = canvas.height / V.h;
  V.ui = Math.min(w, h) < 500 ? 1.35 : 1;
  const cs = getComputedStyle(safeEl);
  const k = V.h / h;
  V.safeL = parseFloat(cs.paddingLeft) * k || 0;
  V.safeR = parseFloat(cs.paddingRight) * k || 0;
  V.safeT = parseFloat(cs.paddingTop) * k || 0;
  V.safeB = parseFloat(cs.paddingBottom) * k || 0;
  if (game.r3d) game.r3d.resize();
  if (game.scene && game.scene.onResize) game.scene.onResize();
}

export const game = {
  scene: null,
  r3d: null,
  next: null,
  fade: 0,
  fadeDir: 0,
  t: 0,
  // Switch scene with a short fade through dark.
  go(scene) {
    if (this.fadeDir === 1) return;
    this.next = scene;
    this.fadeDir = 1;
  },
};

window.addEventListener('resize', resize);
// iOS settles the final size a little after rotating or returning, so check again a few times.
const resizeSoon = () => [50, 250, 600].forEach((ms) => setTimeout(resize, ms));
window.addEventListener('orientationchange', resizeSoon);
window.addEventListener('pageshow', resizeSoon);
document.addEventListener('visibilitychange', () => { if (!document.hidden) resizeSoon(); });
if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);
// Safety net: if the canvas box and its pixel size ever disagree, fix it.
setInterval(() => { const [w, h] = screenSize(); if (w !== lastW || h !== lastH) resize(); }, 1000);

// ---------- input: one finger at a time ----------
let activeId = null;
const toLogical = (e) => {
  const r = canvas.getBoundingClientRect();
  return { x: ((e.clientX - r.left) / r.width) * V.w, y: ((e.clientY - r.top) / r.height) * V.h };
};
canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  unlockAudio();
  if (activeId !== null) return;
  activeId = e.pointerId;
  try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  if (game.fadeDir === 0 && game.scene && game.scene.onDown) game.scene.onDown(toLogical(e));
});
canvas.addEventListener('pointermove', (e) => {
  e.preventDefault();
  if (e.pointerId !== activeId) return;
  if (game.scene && game.scene.onMove) game.scene.onMove(toLogical(e));
});
const up = (e) => {
  if (e.pointerId !== activeId) return;
  activeId = null;
  if (game.scene && game.scene.onUp) game.scene.onUp(toLogical(e));
};
canvas.addEventListener('pointerup', up);
canvas.addEventListener('pointercancel', up);
// Stop iOS from scrolling / zooming / long-press menus.
document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('contextmenu', (e) => e.preventDefault());

// ---------- loop ----------
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  game.t += dt;
  if (game.fadeDir === 1) {
    game.fade += dt / 0.3;
    if (game.fade >= 1) {
      game.fade = 1;
      if (game.scene && game.scene.exit) game.scene.exit();
      game.scene = game.next; game.next = null;
      if (game.scene.enter) game.scene.enter();
      game.fadeDir = -1;
      activeId = null;
    }
  } else if (game.fadeDir === -1) {
    game.fade -= dt / 0.35;
    if (game.fade <= 0) { game.fade = 0; game.fadeDir = 0; }
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(V.scale, 0, 0, V.scale, 0, 0);
  if (game.scene) {
    game.scene.update(dt);
    const stage = game.scene.stage;
    glCanvas.style.visibility = stage ? 'visible' : 'hidden';
    if (stage) { game.r3d.adapt(dt); game.r3d.render(stage); }
    game.scene.draw(ctx);
  }
  if (game.fade > 0) {
    ctx.fillStyle = `rgba(20,14,40,${game.fade})`;
    ctx.fillRect(0, 0, V.w, V.h);
  }
  requestAnimationFrame(frame);
}

// The store apps first bring back a save that iOS may have cleared (no-op on the web).
restoreNativeSave().finally(() => {
  game.r3d = new Renderer3D(glCanvas);
  game.r3d.setQuality(save.settings.quality);
  resize();
  window.__game = game; // handy for debugging in the browser console
  window.__V = V;
  // Test hook: jump straight into a level from Playwright or the console.
  window.__startLevel = (id, mode) => import('./scenes/nav.js').then((m) => m.startLevel(game, id, mode || (id === 'playground' ? 'playground' : 'adventure')));
  initDebug(game);
  game.scene = new TitleScene(game);
  if (game.scene.enter) game.scene.enter();
  requestAnimationFrame(frame);
  // The menus are ready: remove the loading spinner from index.html.
  const bootEl = document.getElementById('boot');
  if (bootEl) bootEl.remove();
});
