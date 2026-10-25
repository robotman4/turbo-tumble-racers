// Gameplay: one level (or the playground). Owns the simulation, the 3D view, the camera and
// the HUD, and turns finger drags into launches.
import * as THREE from 'three';
import { V, ease, clamp } from '../core.js';
import { INK, rr, fs, circle, label, panel, coinIcon, drawHand, FONT } from '../draw.js';
import { Button, layoutTopRight, drawStarIcon, drawIcon } from '../ui.js';
import { playMusic, toggleMute, sfx } from '../audio.js';
import { Particles } from '../particles.js';
import { Sim, DT, initPhysics } from '../game/sim.js';
import { aimFromDrag, assistAim, yawTo, yawDir, wrapAngle } from '../game/launch.js';
import { thresholds, starsFor, popupLabel } from '../game/scoring.js';
import { levelById, levelIndex, LEVELS } from '../game/levels/index.js';
import SOLUTIONS from '../game/levels/solutions.json';
import { playerVehicle, BODIES } from '../game/garage.js';
import { save, persist, recordLevel } from '../storage.js';
import { LevelView } from '../render/levelView.js';
import { CameraRig } from '../render/camera.js';
import { goTitle, goLevels, startLevel, goBuilder, goWorkshop } from './nav.js';
import { debugState } from '../debug.js';

export const warmUp = () => initPhysics();

const IDLE_HINT = 5;
const proj = new THREE.Vector3();

export class PlayScene {
  // levelId may also be a level definition (custom levels); opts.custom is the builder's grid.
  constructor(game, levelId, mode = 'adventure', opts = {}) {
    this.game = game;
    this.mode = mode;
    this.level = typeof levelId === 'object' ? levelId : levelById(levelId);
    this.opts = opts;
    const pv = playerVehicle(save);
    this.vehicleDef = pv.def;
    this.paint = pv.paint;
    // Custom cars drive like the built-in vehicle with the same body, so they share its hints.
    this.hintId = pv.base.custom ? BODIES[pv.base.body] : pv.base.id;
    this.t = 0; this.acc = 0; this.idle = 0; this.time = 0; this.timing = false;
    this.ready = false;
    this.paused = false;
    this.result = null; this.resultT = 0;
    this.drag = null; this.aim = null; this.pred = null;
    this.popups = [];
    this.lastPower = 0;
    this.score = 0; this.shownScore = 0;
    this.hitFace = 0;
    this.ui = new Particles();
    this.btnPause = new Button('pause', '#f5962a', 32);
    this.btnRetry = new Button('retry', '#3b8fe8', 32);
    this.btnEye = new Button('eye', '#9b5de5', 32);
    this.btnReset = new Button('reset', '#5cc95a', 32);
    this.btnHome = new Button('home', '#f5962a', 32);
    // Overlay buttons
    this.oResume = new Button('play', '#5cc95a', 56);
    this.oRetry = new Button('retry', '#3b8fe8', 46);
    this.oMap = new Button('map', '#f5962a', 46);
    this.oHome = new Button('home', '#9b5de5', 46);
    this.oSound = new Button('sound', '#3b8fe8', 40);
    this.oNext = new Button('next', '#5cc95a', 60); this.oNext.pulse = true;
    this.easy = !!save.settings.easy;
    initPhysics().then(() => this.setup());
  }

  setup() {
    const playground = this.mode === 'playground';
    this.sim = new Sim(this.level, this.vehicleDef, { easy: this.easy, unlimited: playground || (this.easy && save.settings.unlimited) });
    this.view = new LevelView(this.sim, { quality: this.game.r3d.q, paint: this.paint });
    this.rig = new CameraRig(this.level, this.view.b);
    this.rig.setAspect(this.game.r3d.aspect);
    if (playground) this.rig.introLen = 1.6;
    this.th = thresholds(this.level);
    this.solutions = (SOLUTIONS[this.level.id] || {})[this.hintId] || [];
    this.ready = true;
    this.introT = 0;
    this.onResize();
    playMusic(playground ? 'play' : this.sim.world.music);
    debugState.scene = this;
    const boot = document.getElementById('boot');
    if (boot) boot.remove();
  }

  get stage() { return this.ready ? { scene: this.view.scene, camera: this.rig.camera } : null; }

  onResize() {
    const top = this.mode === 'playground' ? [this.btnPause, this.btnReset, this.btnEye] : [this.btnPause, this.btnRetry, this.btnEye];
    layoutTopRight(top);
    this.hudTop = top;
    if (this.rig) this.rig.setAspect(this.game.r3d.aspect);
    const cx = V.w / 2, cy = V.h / 2;
    this.oResume.x = cx; this.oResume.y = cy - 30;
    const row = [this.oRetry, this.oMap, this.oHome, this.oSound];
    row.forEach((b, i) => { b.x = cx + (i - 1.5) * 120 * Math.min(1, V.w / 700); b.y = cy + 110; });
  }

  enter() {}
  exit() { if (this.view) this.view.dispose(); if (this.sim) this.sim.free(); if (debugState.scene === this) debugState.scene = null; }

  // ---------- helpers ----------
  toScreen(p) {
    proj.set(p[0], p[1], p[2]).project(this.rig.camera);
    return { x: ((proj.x + 1) / 2) * V.w, y: ((1 - proj.y) / 2) * V.h, behind: proj.z > 1 };
  }
  maxPull() { return Math.min(V.w, V.h) * 0.36; }
  hint() {
    // Use the recorded solution launch that starts closest to where the vehicle is now.
    const p = this.sim.body().translation();
    let best = null, bd = 3.5;
    for (const l of this.solutions) {
      const d = Math.hypot(l.from[0] - p.x, l.from[1] - p.z);
      if (d < bd) { bd = d; best = l; }
    }
    if (best) return { yaw: best.yaw, power: best.power };
    return { yaw: yawTo([p.x, p.y, p.z], this.level.finish.p), power: 0.75 };
  }
  addPopup(text, p, color = '#ffffff', size = 34) { this.popups.push({ text, p, color, size, t: 0 }); }

  // ---------- input ----------
  onDown(p) {
    if (!this.ready) return;
    this.idle = 0;
    if (this.result) return this.onDownResult(p);
    if (this.paused) return this.onDownPause(p);
    if (this.btnPause.hit(p)) { this.paused = true; sfx('tap'); return; }
    if (this.mode === 'playground' && this.btnReset.hit(p)) { sfx('pop'); this.restart(true); return; }
    if (this.mode !== 'playground' && this.btnRetry.hit(p)) { sfx('pop'); this.restart(); return; }
    if (this.btnEye.hit(p)) { sfx('tap'); this.rig.toggleOverview(this.rig.mode !== 'overview'); return; }
    if (this.rig.mode === 'intro') { this.rig.skipIntro(); return; }
    if (this.rig.mode === 'overview') { this.drag = { x: p.x, y: p.y, overview: true }; return; }
    if (this.sim.state === 'cannon') { this.sim.fireCannon(); return; }
    if (this.sim.canLaunch()) {
      this.drag = { x: p.x, y: p.y, camYaw: this.rig.yaw };
      this.aim = null;
    } else {
      this.ui.burst(p.x, p.y, 5);
    }
  }
  onMove(p) {
    if (!this.drag) return;
    if (this.drag.overview) { this.rig.dragOverview(p.x - this.drag.x, p.y - this.drag.y); this.drag.x = p.x; this.drag.y = p.y; return; }
    this.drag.cx = p.x; this.drag.cy = p.y;
    let aim = aimFromDrag(p.x - this.drag.x, p.y - this.drag.y, this.drag.camYaw, this.maxPull());
    if (aim && this.easy) aim = assistAim(aim, this.hint());
    this.aim = aim;
    if (aim) {
      this.pred = this.sim.predict(aim.yaw, aim.power, this.easy ? 3.2 : 2.6);
      const step = Math.floor(aim.power * 8);
      if (step !== this.lastPower) { sfx('stretch', aim.power); this.lastPower = step; }
    } else this.pred = null;
  }
  onUp() {
    const d = this.drag;
    this.drag = null;
    if (!d || d.overview) return;
    if (this.aim && this.sim.canLaunch()) {
      this.sim.launch(this.aim.yaw, this.aim.power);
      if (!this.timing && this.mode === 'challenge') this.timing = true;
      if (this.mode !== 'challenge') this.timing = true;
    }
    this.aim = null; this.pred = null; this.lastPower = 0;
  }

  onDownPause(p) {
    if (this.oResume.hit(p)) { this.paused = false; sfx('tap'); return; }
    if (this.oRetry.hit(p)) { this.paused = false; sfx('pop'); this.restart(); return; }
    if (this.oMap.hit(p)) { sfx('tap'); this.leave('map'); return; }
    if (this.oHome.hit(p)) { sfx('tap'); this.leave('home'); return; }
    if (this.oSound.hit(p)) { toggleMute(); sfx('tap'); return; }
  }
  onDownResult(p) {
    if (this.resultT < 0.8) return;
    if (this.oRetry.hit(p)) { sfx('pop'); this.restart(); return; }
    if (this.oMap.hit(p)) { sfx('tap'); this.leave('map'); return; }
    if (this.result.kind === 'win' && this.oNext.visible && this.oNext.hit(p)) { sfx('pop'); this.next(); return; }
  }

  leave(where) {
    if (where === 'home' || this.mode === 'playground') goTitle(this.game);
    else if (this.mode === 'custom') { if (this.opts.from === 'builder') goBuilder(this.game, this.opts.custom); else goWorkshop(this.game); }
    else goLevels(this.game, this.level.world, this.mode);
  }
  next() {
    const i = levelIndex(this.level.id);
    const n = LEVELS[i + 1];
    if (n) startLevel(this.game, n.id, this.mode); else goTitle(this.game);
  }

  // Fast retry: rebuild the level in place without leaving the scene.
  restart(keepCamera = false) {
    const cam = this.rig?.camera;
    this.view.dispose(); this.sim.free();
    this.result = null; this.resultT = 0; this.popups = []; this.time = 0; this.timing = false;
    this.paused = false; this.drag = null; this.aim = null; this.pred = null; this.score = this.shownScore = 0;
    this.setup();
    // Keep the camera where it is so a retry is instant instead of replaying the fly-in.
    this.rig.mode = 'launch'; this.rig.pos.copy(cam.position);
    if (!keepCamera) this.introT = 99;
  }

  // ---------- simulation events ----------
  handle(ev) {
    this.view.onEvent(ev);
    const sim = this.sim;
    switch (ev.type) {
      case 'launch': sfx('launch'); if (Math.random() < 0.6) sfx(this.vehicleDef.voice); break;
      case 'hit':
        if (ev.mat === 'jelly' || ev.mat === 'rubber' || ev.mat === 'crystal') sfx('boing');
        else if (ev.dv > 6) { sfx('crash', ev.dv / 5); this.rig.shake(ev.dv / 20); this.hitFace = 0.5; }
        else sfx('bump');
        break;
      case 'clack': sfx('clack', ev.dv); break;
      case 'break': sfx('crunch'); break;
      case 'coin': sfx('coin'); break;
      case 'star': sfx('star', 2); this.addPopup('+250', ev.p, '#ffe14d', 40); break;
      case 'secret': sfx('secret'); this.addPopup('SECRET!', ev.p, '#e0c8ff', 46); break;
      case 'score': {
        const txt = popupLabel(ev.ev);
        if (ev.ev.type === 'combo') sfx('combo', ev.ev.combo);
        if (txt) this.addPopup(txt, ev.p, ev.ev.type === 'combo' ? '#ff9ad6' : '#7ee8ff', 40);
        else if (ev.ev.type === 'destroy') this.addPopup('+' + ev.ev.pts, ev.p, '#ffffff', 26);
        break;
      }
      case 'boost': sfx('zap'); break;
      case 'spring': sfx('spring'); break;
      case 'trampoline': sfx('boing'); break;
      case 'cannonIn': sfx('pop'); break;
      case 'cannonFire': sfx('boom'); this.rig.shake(0.8); break;
      case 'splash': sfx('splash'); break;
      case 'splashProp': sfx('splash'); break;
      case 'land': if (ev.air > 1) { sfx('bump'); if (ev.air > 1.6) sfx('whee'); } break;
      case 'flipUp': sfx('jump'); break;
      case 'respawn': sfx('pop'); break;
      case 'finish': this.onFinish(); break;
      case 'settle': if (ev.state === 'out') { this.resultDelay = 0.6; } break;
      default: break;
    }
  }

  onFinish() {
    if (this.mode === 'playground') return;
    sfx('fanfare'); sfx(this.vehicleDef.voice);
    this.timing = false;
    const sim = this.sim;
    const stars = starsFor(sim.score.total, this.th, true);
    const res = { kind: 'win', score: sim.score.total, stars, launches: sim.st.used, time: this.time, coins: sim.st.coins.length };
    if (this.mode === 'custom') {
      // Home-made levels: finishing one proves it can be done, which unlocks sharing.
      // No coins or records, so building coin-stuffed levels can't be used to farm coins.
      if (this.opts.custom) { this.opts.custom.verified = true; persist(); }
      this.better = {};
    } else this.better = recordLevel(this.level.id, levelIndex(this.level.id), res);
    this.pendingResult = res;
    this.resultDelay = 1.8;
  }

  // ---------- frame ----------
  update(dt) {
    this.t += dt;
    this.ui.update(dt);
    if (!this.ready) return;
    const sim = this.sim;
    if (!this.paused) {
      this.acc += dt;
      let n = 0;
      while (this.acc >= DT && n < 5) {
        // Developer autoplay of a solver solution: launch the moment the vehicle can.
        if (this.autoplay && this.autoplay.length && sim.canLaunch()) { const l = this.autoplay.shift(); sim.launch(l.yaw, l.power); this.timing = true; }
        sim.step();
        for (const ev of sim.drain()) this.handle(ev);
        this.acc -= DT; n++;
      }
      if (n === 5) this.acc = 0;
      if (this.timing) this.time += dt;
      if (sim.state === 'aim' && !this.drag && this.rig.mode !== 'intro') this.idle += dt; else if (sim.state !== 'aim') this.idle = 0;
      // Live aim preview keeps following moving platforms.
      if (this.aim && this.drag) this.pred = sim.predict(this.aim.yaw, this.aim.power, this.easy ? 3.2 : 2.6);
      if (this.resultDelay !== undefined) {
        this.resultDelay -= dt;
        if (this.resultDelay <= 0) {
          this.resultDelay = undefined;
          if (this.pendingResult) { this.result = this.pendingResult; this.pendingResult = null; this.resultT = 0; this.starSfx = 0; }
          else if (sim.state === 'out') { this.result = { kind: 'out' }; this.resultT = 0; sfx('bounce'); }
        }
      }
    }
    if (this.result) this.resultT += dt;
    this.introT += dt;
    this.hitFace = Math.max(0, this.hitFace - dt);
    const alpha = this.acc / DT;
    this.view.update(this.paused ? 0 : dt, this.paused ? 1 : alpha, { aimPower: this.aim ? this.aim.power : 0, hit: this.hitFace > 0 ? 1 : 0 });
    this.view.setAim(this.pred, this.aim?.power || 0, this.t);
    const v = sim.vehicleVel();
    this.rig.update(dt, { target: this.view.vpos, vel: v, sim, aimYaw: this.drag && !this.drag.overview ? this.drag.camYaw : sim.st.aimYaw });
    if (debugState.colliders) this.view.setDebug(true); else if (this.view.debugLines) this.view.setDebug(false);
    this.score = sim.score.total;
    this.shownScore += (this.score - this.shownScore) * Math.min(1, dt * 8);
    for (const pp of this.popups) pp.t += dt;
    this.popups = this.popups.filter((pp) => pp.t < 1.3);
  }

  // ---------- drawing (2D overlay) ----------
  draw(ctx) {
    const t = this.t;
    if (!this.ready) return;
    const sim = this.sim;
    // Score popups in the world
    for (const pp of this.popups) {
      const s = this.toScreen(pp.p);
      if (s.behind) continue;
      const k = ease.outBack(Math.min(1, pp.t * 4));
      ctx.globalAlpha = Math.min(1, (1.3 - pp.t) * 3);
      label(ctx, pp.text, s.x, s.y - 40 - pp.t * 60, pp.size * k, pp.color);
      ctx.globalAlpha = 1;
    }
    // Slingshot band from the vehicle to the finger
    if (this.drag && !this.drag.overview && this.drag.cx !== undefined) {
      const vs = this.toScreen([this.view.vpos.x, this.view.vpos.y, this.view.vpos.z]);
      const dx = this.drag.cx - this.drag.x, dy = this.drag.cy - this.drag.y;
      const len = Math.min(Math.hypot(dx, dy), this.maxPull());
      const a = Math.atan2(dy, dx);
      const ex = vs.x + Math.cos(a) * len, ey = vs.y + Math.sin(a) * len;
      const pw = this.aim ? this.aim.power : 0;
      ctx.beginPath(); ctx.moveTo(vs.x, vs.y); ctx.lineTo(ex, ey);
      ctx.lineCap = 'round'; ctx.lineWidth = 16 - pw * 6; ctx.strokeStyle = INK; ctx.stroke();
      ctx.lineWidth = 9 - pw * 4; ctx.strokeStyle = this.aim ? `hsl(${50 - pw * 50},100%,55%)` : '#ffffff'; ctx.stroke();
      circle(ctx, ex, ey, 18); fs(ctx, '#ffffff', 5);
      // Power ring around the knob
      if (this.aim) { ctx.beginPath(); ctx.arc(ex, ey, 28, -Math.PI / 2, -Math.PI / 2 + pw * Math.PI * 2); ctx.lineWidth = 8; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 4; ctx.strokeStyle = '#ffe14d'; ctx.stroke(); }
    }
    // Hint: the hand pulls back from the vehicle in the right direction.
    const tutorial = this.level.tutorial && !this.sim.st.used && levelIndex(this.level.id) >= 0;
    if (sim.canLaunch() && !this.drag && this.rig.mode === 'launch' && !this.result && !this.paused && (this.idle > IDLE_HINT || (tutorial && this.idle > 0.6))) this.drawHint(ctx, t);
    // Cannon with tap-to-fire: pulse a hand on the screen centre.
    if (sim.state === 'cannon' && sim.gadgets[sim.st.cannon.g].def.tap) drawHand(ctx, V.w / 2 + 30, V.h / 2 + 30, 1.1, Math.sin(t * 10) > 0 ? 1 : 0);
    this.drawHud(ctx, t);
    if (this.introBanner(ctx, t)) { /* drawn */ }
    if (this.paused) this.drawPause(ctx, t);
    if (this.result) this.drawResult(ctx, t);
    this.ui.draw(ctx);
  }

  drawHint(ctx, t) {
    const h = this.hint(), vp = this.view.vpos;
    const vs = this.toScreen([vp.x, vp.y, vp.z]);
    // Screen direction that launches along the hint: pull opposite to it.
    const rel = wrapAngle(h.yaw - this.rig.yaw);
    const pull = this.maxPull() * h.power;
    const ang = Math.PI / 2 - rel; // straight down the screen when rel = 0
    // Keep the demonstration on screen even for long pulls.
    let tx = vs.x + Math.cos(ang) * pull, ty = vs.y + Math.sin(ang) * pull;
    const lim = Math.min(1, (V.h - V.safeB - 90 - vs.y) / Math.max(1, ty - vs.y), (V.w - 60 - vs.x) / Math.max(1, tx - vs.x), (vs.x - 60) / Math.max(1, vs.x - tx));
    if (lim < 1) { tx = vs.x + (tx - vs.x) * Math.max(0.3, lim); ty = vs.y + (ty - vs.y) * Math.max(0.3, lim); }
    const k = (t * 0.7) % 1, m = ease.inOutQuad(Math.min(1, k / 0.7));
    const hx = vs.x + (tx - vs.x) * m, hy = vs.y + (ty - vs.y) * m;
    ctx.globalAlpha = 0.85;
    ctx.setLineDash([6, 10]); ctx.beginPath(); ctx.moveTo(vs.x, vs.y); ctx.lineTo(tx, ty); ctx.lineWidth = 5; ctx.strokeStyle = '#ffffff'; ctx.stroke(); ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    drawHand(ctx, hx + 8, hy + 6, 1.1 * V.ui, k < 0.1 || k > 0.85 ? 0 : 1);
  }

  introBanner(ctx, t) {
    if (this.sim.st.used || this.introT > 3.2) return false;
    const k = Math.min(1, this.introT * 3) * Math.min(1, (3.2 - this.introT) * 3);
    if (k <= 0) return false;
    const y = V.h * 0.3;
    ctx.globalAlpha = k;
    const idx = levelIndex(this.level.id);
    const big = this.mode === 'playground' ? '' : String(idx + 1);
    if (big) label(ctx, big, V.w / 2, y - 50, 80, '#ffe14d');
    label(ctx, this.level.name, V.w / 2, y + 20, 40, '#ffffff');
    ctx.globalAlpha = 1;
    return true;
  }

  drawHud(ctx, t) {
    const sim = this.sim;
    const sl = V.safeL + 24, st = V.safeT + 22, u = V.ui;
    // Launches left
    if (Number.isFinite(sim.maxLaunches)) {
      for (let i = 0; i < sim.maxLaunches; i++) {
        const x = sl + 30 * u + i * 62 * u, y = st + 30 * u;
        const left = i < sim.launchesLeft;
        circle(ctx, x, y + 4, 26 * u); ctx.fillStyle = 'rgba(20,14,40,0.3)'; ctx.fill();
        circle(ctx, x, y, 26 * u); fs(ctx, left ? this.paint : '#9a96a6', 4);
        ctx.save(); ctx.translate(x, y); drawIcon(ctx, 'car', 20 * u); ctx.restore();
        if (left && i === sim.launchesLeft - 1 && sim.canLaunch()) { circle(ctx, x, y, 30 * u + Math.sin(t * 6) * 2); ctx.lineWidth = 4; ctx.strokeStyle = '#ffe14d'; ctx.stroke(); }
      }
    } else {
      const x = sl + 30 * u, y = st + 30 * u;
      circle(ctx, x, y, 26 * u); fs(ctx, this.paint, 4);
      ctx.save(); ctx.translate(x, y); drawIcon(ctx, 'infinity', 22 * u); ctx.restore();
    }
    // Score and collectibles, top centre
    const cx = V.w / 2, w = 230 * u;
    rr(ctx, cx - w / 2, st, w, 54 * u, 27 * u); fs(ctx, 'rgba(26,20,70,0.55)', 0);
    label(ctx, String(Math.round(this.shownScore)), cx, st + 28 * u, 36 * u, '#ffffff');
    const L = this.level, row = st + 80 * u;
    const nCoins = (L.coins || []).length, nStars = (L.stars || []).length;
    let x = cx - (nStars ? 100 : 40) * u;
    if (nCoins) { coinIcon(ctx, x, row, 15 * u); label(ctx, `${sim.st.coins.length}/${nCoins}`, x + 22 * u, row + 2, 24 * u, '#ffe14d', 'left'); x += 130 * u; }
    if (nStars) { drawStarIcon(ctx, x, row, 17 * u, sim.st.stars.length > 0); label(ctx, `${sim.st.stars.length}/${nStars}`, x + 22 * u, row + 2, 24 * u, '#ffffff', 'left'); }
    if (this.mode === 'challenge') label(ctx, `${this.time.toFixed(1)}s`, cx, row + 40 * u, 26 * u, '#7ee8ff');
    if (this.easy) { ctx.save(); ctx.translate(sl + 30 * u, st + 92 * u); ctx.globalAlpha = 0.85; drawIcon(ctx, 'turtle', 18 * u); ctx.restore(); }
    for (const b of this.hudTop) b.draw(ctx, t);
    if (this.rig.mode === 'overview') { circle(ctx, this.btnEye.x, this.btnEye.y, this.btnEye.r + 8); ctx.lineWidth = 4; ctx.strokeStyle = '#ffe14d'; ctx.stroke(); }
  }

  drawPause(ctx, t) {
    ctx.fillStyle = 'rgba(20,14,40,0.55)'; ctx.fillRect(0, 0, V.w, V.h);
    const w = Math.min(V.w - 40, 620);
    panel(ctx, V.w / 2 - w / 2, V.h / 2 - 160, w, 360, 'rgba(255,248,232,0.95)');
    this.oResume.draw(ctx, t);
    for (const b of [this.oRetry, this.oMap, this.oHome, this.oSound]) b.draw(ctx, t);
  }

  drawResult(ctx, t) {
    const r = this.result, k = ease.outBack(Math.min(1, this.resultT * 2.5));
    ctx.fillStyle = `rgba(20,14,40,${Math.min(0.5, this.resultT)})`; ctx.fillRect(0, 0, V.w, V.h);
    const w = Math.min(V.w - 40, 640), h = Math.min(V.h - 60, 470);
    const x = V.w / 2 - w / 2, y = V.h / 2 - h / 2;
    ctx.save(); ctx.translate(V.w / 2, V.h / 2); ctx.scale(k, k); ctx.translate(-V.w / 2, -V.h / 2);
    panel(ctx, x, y, w, h, 'rgba(255,248,232,0.97)');
    const by = y + h - 70;
    if (r.kind === 'win') {
      // Stars pop in one by one.
      for (let i = 0; i < 3; i++) {
        const sk = ease.outElastic(clamp((this.resultT - 0.5 - i * 0.35) * 2, 0, 1));
        const sx = V.w / 2 + (i - 1) * 120, sy = y + 90 - (i === 1 ? 18 : 0);
        drawStarIcon(ctx, sx, sy, 48, false);
        if (i < r.stars && sk > 0) {
          ctx.save(); ctx.translate(sx, sy); ctx.scale(sk, sk); drawStarIcon(ctx, 0, 0, 48, true); ctx.restore();
          if (this.starSfx === i && this.resultT > 0.55 + i * 0.35) { sfx('star', i); this.ui.burst(sx, sy, 10); this.starSfx++; }
        }
      }
      const shown = Math.round(r.score * clamp(this.resultT / 1.4, 0, 1));
      label(ctx, String(shown), V.w / 2, y + 190, 64, '#ffe14d');
      if (this.better?.score && !this.better.first && this.resultT > 1.4) {
        ctx.save(); ctx.translate(V.w / 2 + 170, y + 165); ctx.rotate(0.2 + Math.sin(t * 4) * 0.05);
        rr(ctx, -70, -20, 140, 40, 12); fs(ctx, '#e8443a', 4); label(ctx, 'BEST!', 0, 2, 26, '#ffffff'); ctx.restore();
      }
      const L = this.level, sim = this.sim;
      const items = [];
      if ((L.coins || []).length) items.push(['coin', `${sim.st.coins.length}/${L.coins.length}`]);
      if ((L.stars || []).length) items.push(['star', `${sim.st.stars.length}/${L.stars.length}`]);
      items.push(['smash', String(sim.score.counts.destroy)]);
      if (this.mode === 'challenge') items.push(['time', `${r.time.toFixed(1)}s`], ['car', `${r.launches}`]);
      items.forEach(([kind, txt], i) => {
        const ix = V.w / 2 + (i - (items.length - 1) / 2) * 120, iy = y + 270;
        if (kind === 'coin') coinIcon(ctx, ix - 30, iy, 16);
        else if (kind === 'star') drawStarIcon(ctx, ix - 30, iy, 18, true);
        else if (kind === 'smash') { rr(ctx, ix - 44, iy - 14, 28, 28, 6); fs(ctx, '#f5962a', 4); }
        else if (kind === 'car') { ctx.save(); ctx.translate(ix - 30, iy); drawIcon(ctx, 'car', 16); ctx.restore(); }
        else if (kind === 'time') { circle(ctx, ix - 30, iy, 15); fs(ctx, '#7ee8ff', 4); }
        label(ctx, txt, ix - 6, iy + 2, 26, '#ffffff', 'left');
      });
      const hasNext = this.mode !== 'playground' && this.mode !== 'custom' && levelIndex(this.level.id) < LEVELS.length - 1;
      this.oNext.visible = hasNext;
      const bs = hasNext ? [this.oRetry, this.oMap, this.oNext] : [this.oRetry, this.oMap];
      bs.forEach((b, i) => { b.x = V.w / 2 + (i - (bs.length - 1) / 2) * 150; b.y = by; b.draw(ctx, t); });
    } else {
      // Out of launches: no blame, just a big friendly retry.
      label(ctx, 'Try again!', V.w / 2, y + 90, 52, '#ffffff');
      ctx.save(); ctx.translate(V.w / 2, y + 200); ctx.rotate(Math.sin(t * 3) * 0.15); drawIcon(ctx, 'car', 60); ctx.restore();
      this.oRetry.pulse = true;
      const bs = [this.oMap, this.oRetry];
      bs.forEach((b, i) => { b.x = V.w / 2 + (i - 0.5) * 170; b.y = by; b.draw(ctx, t); });
    }
    ctx.restore();
  }
}
