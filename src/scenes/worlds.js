// World selection: four big cards with progress and a lock until the previous world is done.
import { V, ease, TAU } from '../core.js';
import { INK, rr, fs, circle, ellipse, label, lockIcon, starPath } from '../draw.js';
import { Button, layoutTopRight, drawStarIcon } from '../ui.js';
import { playMusic, toggleMute, sfx } from '../audio.js';
import { Particles } from '../particles.js';
import { WORLDS } from '../game/worlds.js';
import { LEVELS, levelsOfWorld } from '../game/levels/index.js';
import { save } from '../storage.js';
import { goTitle, goLevels } from './nav.js';

export function worldUnlocked(w) {
  if (save.settings.debug) return true;
  const first = LEVELS.findIndex((l) => l.world === w.id);
  return first < save.unlocked;
}

export function drawWorldIcon(ctx, kind, x, y, s, t = 0) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  if (kind === 'duck') {
    ellipse(ctx, 0, 14, 40, 26); fs(ctx, '#ffd21a', 5);
    circle(ctx, 20, -16, 22); fs(ctx, '#ffd21a', 5);
    ctx.beginPath(); ctx.moveTo(38, -16); ctx.lineTo(58, -10); ctx.lineTo(38, -4); ctx.closePath(); fs(ctx, '#ff8a1a', 4);
    circle(ctx, 26, -22, 4); ctx.fillStyle = INK; ctx.fill();
    ctx.beginPath(); ctx.moveTo(-34, 4); ctx.lineTo(-48, -8); ctx.lineTo(-38, 14); ctx.closePath(); fs(ctx, '#ffd21a', 4);
  } else if (kind === 'lolly') {
    rr(ctx, -5, 0, 10, 60, 4); fs(ctx, '#ffffff', 4);
    circle(ctx, 0, -14, 34); fs(ctx, '#ff5ec4', 5);
    ctx.save(); circle(ctx, 0, -14, 30); ctx.clip();
    ctx.beginPath(); for (let a = 0; a < 18; a += 0.2) ctx.lineTo(Math.cos(a + t) * a * 1.7, -14 + Math.sin(a + t) * a * 1.7);
    ctx.lineWidth = 7; ctx.strokeStyle = '#ffffff'; ctx.stroke(); ctx.restore();
  } else if (kind === 'skull') {
    ctx.beginPath(); ctx.moveTo(-50, 10); ctx.lineTo(50, 10); ctx.lineTo(36, 34); ctx.lineTo(-36, 34); ctx.closePath(); fs(ctx, '#8a5a2b', 5);
    rr(ctx, -3, -50, 6, 60, 2); fs(ctx, '#6b4423', 3);
    ctx.beginPath(); ctx.moveTo(3, -46); ctx.quadraticCurveTo(36, -24, 3, 4); ctx.closePath(); fs(ctx, '#fff8e8', 4);
    ctx.beginPath(); ctx.moveTo(-3, -40); ctx.quadraticCurveTo(-30, -20, -3, 0); ctx.closePath(); fs(ctx, '#fff8e8', 4);
    rr(ctx, 2, -58, 20, 12, 2); fs(ctx, INK, 0);
    circle(ctx, 12, -52, 3); ctx.fillStyle = '#fff'; ctx.fill();
  } else if (kind === 'planet') {
    circle(ctx, 0, 0, 30); fs(ctx, '#ff8ad6', 5);
    ellipse(ctx, 0, 0, 52, 14, -0.3); ctx.lineWidth = 6; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 3; ctx.strokeStyle = '#ffe14d'; ctx.stroke();
    circle(ctx, -10, -8, 6); ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fill();
    for (let i = 0; i < 4; i++) { starPath(ctx, Math.cos(i * 1.7 + t) * 50, Math.sin(i * 2.3) * 40, 5, 2, 4, 0); ctx.fillStyle = '#ffffff'; ctx.fill(); }
  }
  ctx.restore();
}

export class WorldsScene {
  constructor(game, mode = 'adventure') {
    this.game = game; this.mode = mode;
    this.t = 0;
    this.back = new Button('back', '#f5962a', 34);
    this.sound = new Button('sound', '#3b8fe8', 34);
    this.fx = new Particles();
    this.onResize();
  }
  onResize() {
    this.back.x = V.safeL + 20 + this.back.r; this.back.y = V.safeT + 20 + this.back.r;
    layoutTopRight([this.sound]);
    const cols = V.w > V.h * 1.15 ? 4 : 2, rows = 4 / cols;
    const top = V.safeT + 120, bottom = V.h - V.safeB - 40;
    const left = V.safeL + 40, right = V.w - V.safeR - 40;
    const gap = 24;
    const cw = Math.min(330, (right - left - gap * (cols - 1)) / cols);
    const ch = Math.min(V.portrait ? 420 : 520, (bottom - top - gap * (rows - 1)) / rows);
    const x0 = V.w / 2 - (cw * cols + gap * (cols - 1)) / 2;
    this.cards = WORLDS.map((w, i) => ({ w, x: x0 + (i % cols) * (cw + gap), y: top + Math.floor(i / cols) * (ch + gap), cw, ch }));
  }
  enter() { playMusic('menu'); }
  onDown(p) {
    if (this.back.hit(p)) { sfx('tap'); goTitle(this.game); return; }
    if (this.sound.hit(p)) { toggleMute(); sfx('tap'); return; }
    for (const c of this.cards) {
      if (p.x > c.x && p.x < c.x + c.cw && p.y > c.y && p.y < c.y + c.ch) {
        if (!worldUnlocked(c.w)) { sfx('bump'); c.shake = 0.4; return; }
        sfx('pop'); goLevels(this.game, c.w.id, this.mode); return;
      }
    }
    this.fx.burst(p.x, p.y, 6); sfx('tap');
  }
  update(dt) { this.t += dt; this.fx.update(dt); for (const c of this.cards) if (c.shake) c.shake = Math.max(0, c.shake - dt); }
  draw(ctx) {
    const t = this.t;
    const g = ctx.createLinearGradient(0, 0, 0, V.h);
    g.addColorStop(0, '#5fbfff'); g.addColorStop(1, '#bfe9ff');
    ctx.fillStyle = g; ctx.fillRect(0, 0, V.w, V.h);
    // Soft moving stripes for a bit of life
    ctx.save(); ctx.globalAlpha = 0.12;
    for (let i = -2; i < V.w / 80 + 4; i++) { ctx.beginPath(); ctx.moveTo(i * 80 + (t * 20) % 80, 0); ctx.lineTo(i * 80 + 40 + (t * 20) % 80, 0); ctx.lineTo(i * 80 - 260 + (t * 20) % 80, V.h); ctx.lineTo(i * 80 - 300 + (t * 20) % 80, V.h); ctx.fillStyle = '#ffffff'; ctx.fill(); }
    ctx.restore();
    label(ctx, this.mode === 'challenge' ? 'Challenge' : 'Adventure', V.w / 2, V.safeT + 60, 48, this.mode === 'challenge' ? '#ffe14d' : '#ffffff');
    this.cards.forEach((c, i) => {
      const k = ease.outBack(Math.min(1, Math.max(0, this.t * 3 - i * 0.25)));
      const open = worldUnlocked(c.w);
      ctx.save();
      ctx.translate(c.x + c.cw / 2 + (c.shake ? Math.sin(c.shake * 60) * 8 : 0), c.y + c.ch / 2);
      ctx.scale(k, k);
      const x = -c.cw / 2, y = -c.ch / 2;
      rr(ctx, x, y + 8, c.cw, c.ch, 26); ctx.fillStyle = 'rgba(20,14,40,0.3)'; ctx.fill();
      const cg = ctx.createLinearGradient(0, y, 0, y + c.ch);
      cg.addColorStop(0, open ? c.w.card[0] : '#b8b4c4'); cg.addColorStop(1, open ? c.w.card[1] : '#7a7690');
      rr(ctx, x, y, c.cw, c.ch, 26); ctx.fillStyle = cg; ctx.fill(); ctx.lineWidth = 6; ctx.strokeStyle = INK; ctx.stroke();
      drawWorldIcon(ctx, c.w.icon, 0, y + c.ch * 0.36 + Math.sin(t * 2 + i) * 6, Math.min(1.6, c.ch / 260), t);
      label(ctx, c.w.short, 0, y + c.ch * 0.66, Math.min(40, c.cw / 6.5), '#ffffff');
      const lv = levelsOfWorld(c.w.id);
      const got = lv.reduce((s, l) => s + (save.levels[l.id]?.stars || 0), 0);
      drawStarIcon(ctx, -34, y + c.ch * 0.83, 20, got > 0);
      label(ctx, `${got}/${lv.length * 3}`, 0, y + c.ch * 0.83 + 2, 28, '#ffffff', 'left');
      if (!open) { ctx.fillStyle = 'rgba(40,30,60,0.35)'; rr(ctx, x, y, c.cw, c.ch, 26); ctx.fill(); lockIcon(ctx, 0, y + c.ch * 0.36, 1.6); }
      ctx.restore();
    });
    this.back.draw(ctx, t);
    this.sound.draw(ctx, t);
    this.fx.draw(ctx);
  }
}
