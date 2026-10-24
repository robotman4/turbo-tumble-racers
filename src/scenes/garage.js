// Vehicles screen: browse the vehicles on the turntable, pick one, and buy paint jobs with
// coins collected in the levels (no real money anywhere).
import { V } from '../core.js';
import { INK, circle, fs, rr, label, coinIcon, FONT } from '../draw.js';
import { Button, layoutTopRight } from '../ui.js';
import { playMusic, toggleMute, sfx } from '../audio.js';
import { Particles } from '../particles.js';
import { VEHICLES } from '../game/vehicles.js';
import { save, persist } from '../storage.js';
import { menuStage } from './title.js';
import { goTitle } from './nav.js';

// Stats shown as 1–5 pips, derived from the vehicle data.
function stats(v) {
  return [
    ['Bounce', Math.round(1 + v.bounce * 7)],
    ['Float', Math.round(1 + (1.2 - v.gravity) * 10)],
    ['Power', Math.round(Math.min(5, 1 + v.impact * 2.2))],
  ].map(([n, k]) => [n, Math.max(1, Math.min(5, k))]);
}

export class GarageScene {
  constructor(game) {
    this.game = game;
    this.t = 0;
    this.idx = Math.max(0, VEHICLES.findIndex((v) => v.id === save.vehicle));
    this.back = new Button('back', '#f5962a', 34);
    this.sound = new Button('sound', '#3b8fe8', 34);
    this.left = new Button('left', '#3b8fe8', 42);
    this.right = new Button('right', '#3b8fe8', 42);
    this.fx = new Particles();
    this.stage = menuStage(game);
    this.onResize();
  }
  get v() { return VEHICLES[this.idx]; }
  onResize() {
    this.back.x = V.safeL + 20 + this.back.r; this.back.y = V.safeT + 20 + this.back.r;
    layoutTopRight([this.sound]);
    const land = !V.portrait;
    this.cx = land ? V.w * 0.36 : V.w / 2;
    this.cy = land ? V.h * 0.5 : V.h * 0.36;
    this.left.x = this.cx - (land ? 260 : 300); this.right.x = this.cx + (land ? 260 : 300);
    if (!land) { this.left.x = V.safeL + 70; this.right.x = V.w - V.safeR - 70; }
    this.left.y = this.right.y = this.cy;
    this.panel = land ? { x: V.w * 0.64, y: 150, w: Math.min(V.w * 0.32, 380), h: 470 } : { x: 40, y: V.h * 0.58, w: V.w - 80, h: V.h * 0.36 };
    this.stage.setAspect(this.game.r3d.aspect, this.cx / V.w, this.cy / V.h);
  }
  enter() { playMusic('menu'); }
  pick(i) {
    this.idx = (i + VEHICLES.length) % VEHICLES.length;
    save.vehicle = this.v.id; persist();
    this.stage = menuStage(this.game);
    sfx(this.v.voice); sfx('pop');
  }
  swatches() {
    const P = this.panel, v = this.v, n = v.paints.length;
    const y = P.y + P.h - 70, gap = Math.min(86, (P.w - 40) / n);
    return v.paints.map((p, i) => ({ p, x: P.x + P.w / 2 + (i - (n - 1) / 2) * gap, y, r: 30 }));
  }
  onDown(p) {
    if (this.back.hit(p)) { sfx('tap'); goTitle(this.game); return; }
    if (this.sound.hit(p)) { toggleMute(); sfx('tap'); return; }
    if (this.left.hit(p)) { this.pick(this.idx - 1); return; }
    if (this.right.hit(p)) { this.pick(this.idx + 1); return; }
    for (const s of this.swatches()) {
      if (Math.hypot(p.x - s.x, p.y - s.y) < s.r + 16) {
        const v = this.v, owned = save.paints[v.id].includes(s.p.id);
        if (!owned) {
          if (save.coins < s.p.cost) { sfx('bump'); s.shake = 1; this.shakeId = s.p.id; this.shakeT = 0.4; return; }
          save.coins -= s.p.cost;
          save.paints[v.id].push(s.p.id);
          sfx('coin'); this.fx.confetti(s.x, s.y, 30);
        }
        save.paint[v.id] = s.p.id; persist();
        this.stage = menuStage(this.game);
        sfx('pop');
        return;
      }
    }
    // Tapping the vehicle makes it talk.
    if (Math.hypot(p.x - this.cx, p.y - this.cy) < 180) { sfx(this.v.voice); this.stage.vehicle?.bump(0.4); this.stage.hop.t = 0; return; }
    this.fx.burst(p.x, p.y, 6); sfx('tap');
  }
  update(dt) {
    this.t += dt; this.fx.update(dt);
    if (this.shakeT) this.shakeT = Math.max(0, this.shakeT - dt);
    this.stage.update(dt, this.game.r3d.w, this.game.r3d.h);
  }
  draw(ctx) {
    const t = this.t, v = this.v, P = this.panel;
    rr(ctx, P.x, P.y + 8, P.w, P.h, 26); ctx.fillStyle = 'rgba(20,14,40,0.3)'; ctx.fill();
    rr(ctx, P.x, P.y, P.w, P.h, 26); fs(ctx, 'rgba(255,248,232,0.94)', 6);
    label(ctx, v.name, P.x + P.w / 2, P.y + 48, Math.min(40, P.w / 8), '#ffffff');
    const st = stats(v);
    st.forEach(([name, k], i) => {
      const y = P.y + 110 + i * Math.min(70, (P.h - 220) / 3);
      ctx.font = `800 22px ${FONT}`; ctx.fillStyle = INK; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(name, P.x + 30, y);
      for (let j = 0; j < 5; j++) { circle(ctx, P.x + P.w - 40 - (4 - j) * 34, y, 12); fs(ctx, j < k ? ['#e8443a', '#3b8fe8', '#5cc95a'][i] : '#ddd6e8', 4); }
    });
    for (const s of this.swatches()) {
      const owned = save.paints[v.id].includes(s.p.id), sel = save.paint[v.id] === s.p.id;
      const sx = s.x + (this.shakeId === s.p.id && this.shakeT ? Math.sin(this.shakeT * 60) * 6 : 0);
      if (sel) { circle(ctx, sx, s.y, s.r + 9); fs(ctx, '#ffe14d', 4); }
      circle(ctx, sx, s.y, s.r); fs(ctx, s.p.color, 5);
      if (!owned) {
        circle(ctx, sx, s.y, s.r); ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fill();
        coinIcon(ctx, sx - 16, s.y + s.r + 18, 10);
        label(ctx, String(s.p.cost), sx + 6, s.y + s.r + 19, 18, save.coins >= s.p.cost ? '#ffe14d' : '#ffffff');
      }
    }
    coinIcon(ctx, V.w - V.safeR - 150, V.safeT + 120, 18);
    label(ctx, String(save.coins), V.w - V.safeR - 124, V.safeT + 122, 30, '#ffe14d', 'left');
    this.left.draw(ctx, t); this.right.draw(ctx, t);
    this.back.draw(ctx, t); this.sound.draw(ctx, t);
    this.fx.draw(ctx);
  }
}
