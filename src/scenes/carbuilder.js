// Car builder: choose a body (it decides how the car drives), a driver and a paint colour.
// Bodies drive exactly like the built-in vehicles (kart = Panda Kart, board = Dino Board,
// cart = Chicken Cart), so every home-made car can finish every level.
import { V } from '../core.js';
import { circle, fs, rr, label, FONT, INK } from '../draw.js';
import { Button, layoutTopRight } from '../ui.js';
import { playMusic, toggleMute, sfx } from '../audio.js';
import { Particles } from '../particles.js';
import { customVehicle, CAR_PAINTS, DRIVERS } from '../game/garage.js';
import { save, persist } from '../storage.js';
import { previewOnStage } from './title.js';
import { goGarage } from './nav.js';

const BODY_LIST = ['kart', 'board', 'cart'];
const VOICE = { panda: 'honk', dino: 'rawr', chicken: 'bawk' };

export class CarBuilderScene {
  constructor(game, existing) {
    this.game = game;
    this.t = 0;
    this.existing = existing;
    this.car = existing ? { ...existing } : { body: 'kart', driver: 'dino', paint: '#f06fb0' };
    this.back = new Button('back', '#f5962a', 34);
    this.sound = new Button('sound', '#3b8fe8', 34);
    this.ok = new Button('check', '#5cc95a', 52); this.ok.pulse = true;
    this.bodies = BODY_LIST.map((b) => ({ id: b, btn: new Button(b, '#3b8fe8', 38) }));
    this.drivers = DRIVERS.map((d) => ({ id: d, btn: new Button(d, '#9b5de5', 38) }));
    this.fx = new Particles();
    this.refresh();
    this.onResize();
  }
  refresh() { this.stage = previewOnStage(this.game, customVehicle({ ...this.car, id: 'preview' }), this.car.paint); }
  onResize() {
    this.back.x = V.safeL + 20 + this.back.r; this.back.y = V.safeT + 20 + this.back.r;
    layoutTopRight([this.sound]);
    const land = !V.portrait;
    this.cx = land ? V.w * 0.32 : V.w / 2;
    this.cy = land ? V.h * 0.52 : V.h * 0.27;
    this.P = land ? { x: V.w * 0.56, y: V.safeT + 100, w: Math.min(V.w * 0.4, 440), h: Math.min(600, V.h - V.safeT - V.safeB - 120) }
      : { x: 40, y: V.h * 0.47, w: V.w - 80, h: Math.min(V.h * 0.5, 640) };
    const P = this.P, row = (k) => P.y + P.h * k;
    this.bodies.forEach((o, i) => { o.btn.x = P.x + P.w / 2 + (i - 1) * 110; o.btn.y = row(0.14); });
    this.drivers.forEach((o, i) => { o.btn.x = P.x + P.w / 2 + (i - 1) * 110; o.btn.y = row(0.4); });
    const cols = 5, gap = Math.min(76, (P.w - 40) / cols);
    this.swatches = CAR_PAINTS.map((c, i) => ({ c, x: P.x + P.w / 2 + ((i % cols) - (cols - 1) / 2) * gap, y: row(0.63) + Math.floor(i / cols) * 70, r: 26 }));
    this.ok.x = P.x + P.w / 2; this.ok.y = row(0.92);
    this.stage.setAspect(this.game.r3d.aspect, this.cx / V.w, this.cy / V.h);
  }
  enter() { playMusic('menu'); }
  onDown(p) {
    if (this.back.hit(p)) { sfx('tap'); goGarage(this.game); return; }
    if (this.sound.hit(p)) { toggleMute(); sfx('tap'); return; }
    for (const o of this.bodies) if (o.btn.hit(p)) { this.car.body = o.id; sfx('pop'); this.refresh(); this.onResize(); return; }
    for (const o of this.drivers) if (o.btn.hit(p)) { this.car.driver = o.id; sfx(VOICE[o.id]); this.refresh(); this.onResize(); return; }
    for (const s of this.swatches) if (Math.hypot(p.x - s.x, p.y - s.y) < s.r + 14) { this.car.paint = s.c; sfx('pop'); this.refresh(); this.onResize(); return; }
    if (this.ok.hit(p)) {
      if (this.existing) Object.assign(this.existing, this.car);
      else {
        const c = { ...this.car, id: Date.now().toString(36), name: `Car ${save.customCars.length + 1}` };
        save.customCars.push(c);
        save.vehicle = 'custom:' + c.id;
      }
      persist();
      sfx('fanfare'); this.fx.confetti(this.cx, this.cy, 50);
      setTimeout(() => goGarage(this.game), 700);
      return;
    }
    if (Math.hypot(p.x - this.cx, p.y - this.cy) < 180) { sfx(VOICE[this.car.driver]); this.stage.vehicle?.bump(0.4); this.stage.hop.t = 0; return; }
    this.fx.burst(p.x, p.y, 6); sfx('tap');
  }
  update(dt) { this.t += dt; this.fx.update(dt); this.stage.update(dt, this.game.r3d.w, this.game.r3d.h); }
  draw(ctx) {
    const t = this.t, P = this.P;
    rr(ctx, P.x, P.y + 8, P.w, P.h, 26); ctx.fillStyle = 'rgba(20,14,40,0.3)'; ctx.fill();
    rr(ctx, P.x, P.y, P.w, P.h, 26); fs(ctx, 'rgba(255,248,232,0.94)', 6);
    const sel = (b) => { circle(ctx, b.x, b.y, b.r + 10); fs(ctx, '#ffe14d', 4); };
    for (const o of this.bodies) { if (o.id === this.car.body) sel(o.btn); o.btn.draw(ctx, t); }
    // How each body drives, in a few words for the grown-ups.
    ctx.font = `800 18px ${FONT}`; ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText({ kart: 'Balanced', board: 'Light and floaty', cart: 'Heavy and strong' }[this.car.body], P.x + P.w / 2, P.y + P.h * 0.25);
    for (const o of this.drivers) { if (o.id === this.car.driver) sel(o.btn); o.btn.draw(ctx, t); }
    for (const s of this.swatches) {
      if (s.c === this.car.paint) { circle(ctx, s.x, s.y, s.r + 8); fs(ctx, '#ffe14d', 4); }
      circle(ctx, s.x, s.y, s.r); fs(ctx, s.c, 5);
    }
    this.ok.draw(ctx, t);
    label(ctx, this.existing ? this.existing.name : 'New car', this.cx, V.safeT + 60, 42, '#ffffff');
    this.back.draw(ctx, t); this.sound.draw(ctx, t);
    this.fx.draw(ctx);
  }
}
