// Level builder: a grid seen from above. Pick a tool at the bottom, tap a square to use it,
// drag to move the view. The green button test-drives the level; finishing it once unlocks
// sharing. Levels save themselves on the device as you build.
import * as THREE from 'three';
import { V } from '../core.js';
import { circle, label } from '../draw.js';
import { Button } from '../ui.js';
import { playMusic, toggleMute, sfx } from '../audio.js';
import { Particles } from '../particles.js';
import { initPhysics, Sim } from '../game/sim.js';
import { WORLDS } from '../game/worlds.js';
import { GRID, newLevel, applyTool, compileLevel, problems, getCell, levelCode, cellCenter, MAX_CUSTOM_LEVELS } from '../game/custom.js';
import { VEHICLES } from '../game/vehicles.js';
import { LevelView } from '../render/levelView.js';
import { save, persist } from '../storage.js';
import { goWorkshop, startLevel } from './nav.js';
import { shareCode, Toast } from '../share.js';

const TOOLS = [
  ['deck', 'deck', '#5cc95a'], ['down', 'down', '#5cc95a'], ['ramp', 'ramp', '#f5962a'], ['jelly', 'jelly', '#f06fb0'], ['icing', 'ice', '#7ec8ff'],
  ['start', 'start', '#3b8fe8'], ['finish', 'finish', '#3b8fe8'], ['trampoline', 'trampoline', '#9b5de5'], ['boost', 'boost', '#9b5de5'],
  ['spring', 'springs', '#9b5de5'], ['cannon', 'cannon', '#9b5de5'], ['blocks', 'blocks', '#e8443a'], ['crate', 'crate', '#e8443a'],
  ['ball', 'ball', '#e8443a'], ['coin', 'coin', '#f7d43c'], ['star', 'star', '#f7d43c'], ['turn', 'turn', '#7a7690'], ['eraser', 'eraser', '#7a7690'],
];
const S = GRID.cell, W = GRID.cols * S, H = GRID.rows * S;

export class BuilderScene {
  constructor(game, level) {
    this.game = game;
    this.t = 0;
    // Edit a saved level in place, or start a new one (saved on the first change).
    this.L = level || newLevel(1);
    this.isNew = !save.customLevels.includes(this.L);
    this.tool = 'deck';
    this.undo = [];
    this.ready = false;
    this.toast = new Toast();
    this.fx = new Particles();
    this.back = new Button('back', '#f5962a', 32);
    this.sound = new Button('sound', '#3b8fe8', 32);
    this.worldBtn = new Button('world', '#3b8fe8', 32);
    this.undoBtn = new Button('retry', '#7a7690', 32);
    this.viewBtn = new Button('turn', '#7a7690', 32);
    this.play = new Button('play', '#5cc95a', 44); this.play.pulse = true;
    this.shareBtn = new Button('share', '#5cc95a', 32);
    this.tools = TOOLS.map(([id, icon, color]) => ({ id, btn: new Button(icon, color, 26) }));
    // Camera orbiting the board
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.5, 900);
    this.cam = { yaw: 0, pitch: 0.95, dist: 62, target: new THREE.Vector3(W / 2, 0, 0) };
    this.ray = new THREE.Raycaster();
    initPhysics().then(() => { this.ready = true; this.rebuild(); });
    this.onResize();
  }

  get stage() { return this.view ? { scene: this.view.scene, camera: this.camera } : null; }

  onResize() {
    const u = V.ui;
    this.back.x = V.safeL + 20 + this.back.r; this.back.y = V.safeT + 20 + this.back.r;
    [this.worldBtn, this.undoBtn, this.viewBtn].forEach((b, i) => { b.x = this.back.x + (i + 1) * (b.r * 2 + 16); b.y = this.back.y; });
    this.play.x = V.w - V.safeR - 24 - this.play.r; this.play.y = V.safeT + 20 + this.play.r;
    this.shareBtn.x = this.play.x - this.play.r - 20 - this.shareBtn.r; this.shareBtn.y = this.play.y;
    this.sound.x = this.shareBtn.x - this.shareBtn.r * 2 - 16; this.sound.y = this.play.y;
    // Tool palette: two rows at the bottom
    const n = TOOLS.length, perRow = Math.ceil(n / 2), r = this.tools[0].btn.r;
    const gap = Math.min(r * 2 + 14, (V.w - V.safeL - V.safeR - 30) / perRow);
    this.tools.forEach((o, i) => {
      const row = Math.floor(i / perRow), col = i % perRow;
      o.btn.x = V.w / 2 + (col - (perRow - 1) / 2) * gap;
      o.btn.y = V.h - V.safeB - 26 - r - (1 - row) * (r * 2 + 18 * u);
    });
    this.camera.aspect = this.game.r3d.aspect;
    this.cam.dist = V.portrait ? 82 : V.ui > 1 ? 54 : 62;
    this.camera.updateProjectionMatrix();
  }

  enter() { playMusic('calm'); }

  // Rebuild the 3D preview from the grid (cheap enough to do on every edit).
  rebuild() {
    if (!this.ready) return;
    const keepT = this.view ? this.view.t : 0;
    if (this.view) { this.view.dispose(); this.sim.free(); }
    const world = WORLDS[(this.L.world || 1) - 1];
    this.def = compileLevel(this.L, world.ground);
    this.sim = new Sim(this.def, VEHICLES[0]);
    this.view = new LevelView(this.sim, { quality: { ...this.game.r3d.q, decor: Math.min(0.5, this.game.r3d.q.decor) }, paint: '#3b8fe8' });
    this.view.t = keepT;
    this.addGrid();
  }

  addGrid() {
    const pts = [];
    for (let c = 0; c <= GRID.cols; c++) pts.push(c * S, 0.06, -H / 2, c * S, 0.06, H / 2);
    for (let r = 0; r <= GRID.rows; r++) pts.push(0, 0.06, -H / 2 + r * S, W, 0.06, -H / 2 + r * S);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const lines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.55 }));
    this.view.scene.add(lines);
    const board = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.08, depthWrite: false }));
    board.rotation.x = -Math.PI / 2; board.position.set(W / 2, 0.04, 0);
    this.view.scene.add(board);
    this.cursor = new THREE.Mesh(new THREE.BoxGeometry(S, 0.3, S), new THREE.MeshBasicMaterial({ color: '#ffe14d', transparent: true, opacity: 0.45, depthWrite: false }));
    this.cursor.visible = false;
    this.view.scene.add(this.cursor);
  }

  // Which square is under the finger: try each floor height from the top down.
  pickCell(p) {
    const ndc = new THREE.Vector2((p.x / V.w) * 2 - 1, -((p.y / V.h) * 2 - 1));
    this.ray.setFromCamera(ndc, this.camera);
    const o = this.ray.ray.origin, d = this.ray.ray.direction;
    for (let h = GRID.maxH; h >= 0; h--) {
      const y = h * GRID.step;
      if (Math.abs(d.y) < 1e-4) continue;
      const k = (y - o.y) / d.y;
      if (k <= 0) continue;
      const x = o.x + d.x * k, z = o.z + d.z * k;
      const c = Math.floor(x / S), r = Math.floor((z + H / 2) / S);
      if (c < 0 || r < 0 || c >= GRID.cols || r >= GRID.rows) continue;
      const cell = getCell(this.L, c, r);
      if (h === 0 || (cell && cell.h === h)) return { c, r };
    }
    return null;
  }

  onDown(p) {
    if (this.back.hit(p)) { sfx('tap'); goWorkshop(this.game); return; }
    if (this.sound.hit(p)) { toggleMute(); sfx('tap'); return; }
    if (this.worldBtn.hit(p)) { this.change(() => { this.L.world = (this.L.world % 4) + 1; }); sfx('whoosh'); return; }
    if (this.undoBtn.hit(p)) {
      const prev = this.undo.pop();
      if (prev) { this.L.cells = prev.cells; this.L.world = prev.world; this.L.verified = false; persist(); this.rebuild(); sfx('pop'); } else sfx('bump');
      return;
    }
    if (this.viewBtn.hit(p)) { this.cam.yaw += Math.PI / 2; sfx('whoosh'); return; }
    if (this.play.hit(p)) {
      const miss = problems(this.L);
      if (miss.length) { sfx('bump'); this.flash = miss[0]; this.flashT = 1.5; return; }
      sfx('pop'); this.store();
      startLevel(this.game, compileLevel(this.L, WORLDS[this.L.world - 1].ground), 'custom', { custom: this.L, from: 'builder' });
      return;
    }
    if (this.shareBtn.hit(p)) {
      if (!this.L.verified) { sfx('bump'); this.toast.show('Finish your level once, then share it', '#f5962a'); this.flash = 'play'; this.flashT = 1.5; return; }
      sfx('pop');
      shareCode(levelCode(this.L), 'level').then((r) => this.toast.show(r === 'copied' ? 'Level link copied' : 'Shared', '#5cc95a'));
      return;
    }
    for (const o of this.tools) if (o.btn.hit(p)) { this.tool = o.id; sfx('tap'); return; }
    this.drag = { x: p.x, y: p.y, sx: p.x, sy: p.y, moved: false };
  }

  onMove(p) {
    const d = this.drag;
    if (!d) return;
    if (!d.moved && Math.hypot(p.x - d.sx, p.y - d.sy) > 14) d.moved = true;
    if (!d.moved) return;
    // Pan the board under the finger.
    const k = this.cam.dist / V.h * 1.1, a = this.cam.yaw;
    const dx = (p.x - d.x) * k, dz = (p.y - d.y) * k;
    this.cam.target.x -= Math.cos(a) * dx + Math.sin(a) * dz;
    this.cam.target.z -= -Math.sin(a) * dx + Math.cos(a) * dz;
    this.cam.target.x = Math.max(-10, Math.min(W + 10, this.cam.target.x));
    this.cam.target.z = Math.max(-H, Math.min(H, this.cam.target.z));
    d.x = p.x; d.y = p.y;
  }

  onUp(p) {
    const d = this.drag;
    this.drag = null;
    if (!d || d.moved || !this.ready) return;
    const cell = this.pickCell(p);
    if (!cell) return;
    const before = JSON.stringify({ cells: this.L.cells, world: this.L.world });
    if (applyTool(this.L, this.tool, cell.c, cell.r)) {
      this.undo.push(JSON.parse(before));
      if (this.undo.length > 40) this.undo.shift();
      this.store();
      this.rebuild();
      this.showCursor(cell);
      sfx(this.tool === 'eraser' || this.tool === 'down' ? 'crunch' : 'pop');
    } else sfx('bump');
  }

  change(fn) {
    this.undo.push(JSON.parse(JSON.stringify({ cells: this.L.cells, world: this.L.world })));
    fn(); this.L.verified = false; this.store(); this.rebuild();
  }

  // Save on the device; a new level is added to "My levels" on its first change.
  store() {
    if (this.isNew) {
      if (save.customLevels.length >= MAX_CUSTOM_LEVELS) { this.toast.show('My levels is full: delete one first', '#e8443a'); return; }
      save.customLevels.push(this.L);
      this.isNew = false;
    }
    persist();
  }

  showCursor(cell) {
    if (!this.cursor) return;
    const c = getCell(this.L, cell.c, cell.r);
    const [x, z] = cellCenter(cell.c, cell.r);
    this.cursor.position.set(x, (c && c.h !== undefined ? c.h * GRID.step : 0) + 0.2, z);
    this.cursor.visible = true; this.cursorT = 0.6;
  }

  update(dt) {
    this.t += dt;
    this.fx.update(dt); this.toast.update(dt);
    if (this.flashT) this.flashT = Math.max(0, this.flashT - dt);
    if (this.cursorT !== undefined) { this.cursorT -= dt; if (this.cursorT <= 0 && this.cursor) this.cursor.visible = false; }
    const c = this.cam;
    this.camYaw = this.camYaw === undefined ? c.yaw : this.camYaw + (c.yaw - this.camYaw) * Math.min(1, dt * 6);
    this.camera.position.set(c.target.x + Math.sin(this.camYaw) * Math.cos(c.pitch) * c.dist, Math.sin(c.pitch) * c.dist, c.target.z + Math.cos(this.camYaw) * Math.cos(c.pitch) * c.dist);
    this.camera.lookAt(c.target);
    if (this.view) this.view.update(dt, 1, {});
  }

  draw(ctx) {
    const t = this.t;
    for (const o of this.tools) {
      if (o.id === this.tool) { circle(ctx, o.btn.x, o.btn.y, o.btn.r + 9); ctx.fillStyle = '#ffe14d'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = '#2a1f3d'; ctx.stroke(); }
      const flash = this.flashT && o.id === this.flash;
      o.btn.pulse = !!flash;
      o.btn.draw(ctx, t);
    }
    this.shareBtn.color = this.L.verified ? '#5cc95a' : '#9a96a6';
    this.play.pulse = !problems(this.L).length;
    for (const b of [this.back, this.sound, this.worldBtn, this.undoBtn, this.viewBtn, this.play, this.shareBtn]) b.draw(ctx, t);
    if (this.flashT && this.flash === 'play') { circle(ctx, this.play.x, this.play.y, this.play.r + 12 + Math.sin(t * 12) * 3); ctx.lineWidth = 5; ctx.strokeStyle = '#ffe14d'; ctx.stroke(); }
    if (this.L.verified) label(ctx, '✓', this.shareBtn.x + this.shareBtn.r * 0.8, this.shareBtn.y - this.shareBtn.r * 0.8, 26, '#5cc95a');
    if (!this.ready) label(ctx, '…', V.w / 2, V.h / 2, 60, '#ffffff');
    this.toast.draw(ctx, t);
    this.fx.draw(ctx);
  }
}
