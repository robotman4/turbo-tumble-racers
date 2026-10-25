// Vehicles screen: browse the built-in and home-made cars on the turntable, pick one, buy paint
// jobs and upgrades with coins collected in the levels (no real money anywhere), and build,
// edit, share or import custom cars.
import { V } from '../core.js';
import { INK, circle, fs, rr, label, coinIcon, FONT } from '../draw.js';
import { Button, layoutTopRight, drawIcon } from '../ui.js';
import { playMusic, toggleMute, sfx } from '../audio.js';
import { Particles } from '../particles.js';
import { VEHICLES } from '../game/vehicles.js';
import { UPGRADES, MAX_UPGRADE, upgradeCost, buyUpgrade, customVehicle, applyUpgrades, carCode, decodeCar } from '../game/garage.js';
import { save, persist } from '../storage.js';
import { menuStage } from './title.js';
import { goTitle } from './nav.js';
import { shareCode, askCode, Toast } from '../share.js';

// Stats shown as 1–5 pips, derived from the vehicle data (upgrades included).
function stats(v) {
  return [
    ['Bounce', Math.round(1 + v.bounce * 7)],
    ['Float', Math.round(1 + (1.2 - v.gravity) * 10)],
    ['Power', Math.round(Math.min(5, 1 + v.impact * 2.2))],
  ].map(([n, k]) => [n, Math.max(1, Math.min(5, k))]);
}

export function allCars() {
  return [...VEHICLES, ...save.customCars.map(customVehicle)];
}

export class GarageScene {
  constructor(game) {
    this.game = game;
    this.t = 0;
    this.idx = Math.max(0, allCars().findIndex((v) => v.id === save.vehicle));
    this.back = new Button('back', '#f5962a', 34);
    this.sound = new Button('sound', '#3b8fe8', 34);
    this.left = new Button('left', '#3b8fe8', 42);
    this.right = new Button('right', '#3b8fe8', 42);
    this.newCar = new Button('plus', '#5cc95a', 36);
    this.importBtn = new Button('import', '#9b5de5', 30);
    this.editBtn = new Button('pencil', '#3b8fe8', 30);
    this.shareBtn = new Button('share', '#5cc95a', 30);
    this.delBtn = new Button('trash', '#e8443a', 30);
    this.ups = UPGRADES.map((u) => ({ u, b: new Button(u.icon, '#f5962a', 28) }));
    this.toast = new Toast();
    this.fx = new Particles();
    this.stage = menuStage(game);
    this.onResize();
  }
  get v() { const c = allCars(); return c[Math.min(this.idx, c.length - 1)]; }
  onResize() {
    this.back.x = V.safeL + 20 + this.back.r; this.back.y = V.safeT + 20 + this.back.r;
    layoutTopRight([this.sound]);
    const land = !V.portrait;
    this.cx = land ? V.w * 0.34 : V.w / 2;
    this.cy = land ? V.h * 0.5 : V.h * 0.27;
    this.left.x = land ? this.cx - 250 : V.safeL + 70; this.right.x = land ? this.cx + 250 : V.w - V.safeR - 70;
    this.left.y = this.right.y = this.cy;
    this.newCar.x = this.cx - 60; this.importBtn.x = this.cx + 60;
    this.newCar.y = this.importBtn.y = Math.min(V.h - V.safeB - 60, this.cy + (land ? 250 : 200));
    this.panel = land
      ? { x: V.w * 0.6, y: V.safeT + 110, w: Math.min(V.w * 0.36, 400), h: Math.min(560, V.h - V.safeT - V.safeB - 140) }
      : { x: 40, y: V.h * 0.48, w: V.w - 80, h: Math.min(V.h * 0.48, 620) };
    const P = this.panel;
    const n = this.ups.length, gap = Math.min(86 * V.ui, (P.w - 30) / n);
    this.ups.forEach(({ b }, i) => { b.x = P.x + P.w / 2 + (i - (n - 1) / 2) * gap; b.y = P.y + P.h * 0.6; });
    [this.editBtn, this.shareBtn, this.delBtn].forEach((b, i) => { b.x = P.x + P.w / 2 + (i - 1) * 90; b.y = P.y + P.h * 0.88; });
    this.stage.setAspect(this.game.r3d.aspect, this.cx / V.w, this.cy / V.h);
  }
  enter() { playMusic('menu'); }
  pick(i) {
    const n = allCars().length;
    this.idx = (i + n) % n;
    save.vehicle = this.v.id; persist();
    this.stage = menuStage(this.game);
    sfx(this.v.voice); sfx('pop');
  }
  swatches() {
    const P = this.panel, v = this.v, n = v.paints.length;
    const y = P.y + P.h * 0.88, gap = Math.min(86, (P.w - 40) / n);
    return v.paints.map((p, i) => ({ p, x: P.x + P.w / 2 + (i - (n - 1) / 2) * gap, y, r: 28 }));
  }
  customOf(v) { return save.customCars.find((c) => 'custom:' + c.id === v.id); }
  async onDown(p) {
    if (this.back.hit(p)) { sfx('tap'); goTitle(this.game); return; }
    if (this.sound.hit(p)) { toggleMute(); sfx('tap'); return; }
    if (this.left.hit(p)) { this.pick(this.idx - 1); return; }
    if (this.right.hit(p)) { this.pick(this.idx + 1); return; }
    if (this.newCar.hit(p)) { sfx('pop'); const m = await import('./carbuilder.js'); this.game.go(new m.CarBuilderScene(this.game, null)); return; }
    if (this.importBtn.hit(p)) {
      sfx('tap');
      const code = askCode('Paste a car code');
      if (!code) return;
      const c = decodeCar(code);
      if (!c) { this.toast.show('That code is not a car', '#e8443a'); sfx('bump'); return; }
      c.id = Date.now().toString(36);
      save.customCars.push(c); save.vehicle = 'custom:' + c.id; persist();
      this.idx = allCars().length - 1; this.stage = menuStage(this.game);
      this.fx.confetti(this.cx, this.cy, 40); sfx('fanfare');
      return;
    }
    const v = this.v, custom = this.customOf(v);
    for (const { u, b } of this.ups) {
      if (!b.hit(p)) continue;
      if (buyUpgrade(save, v.id, u.id)) { persist(); sfx('coin'); this.fx.burst(b.x, b.y, 10); this.stage.vehicle?.bump(0.4); }
      else { sfx('bump'); this.shakeUp = u.id; this.shakeT = 0.4; }
      return;
    }
    if (custom) {
      if (this.editBtn.hit(p)) { sfx('pop'); const m = await import('./carbuilder.js'); this.game.go(new m.CarBuilderScene(this.game, custom)); return; }
      if (this.shareBtn.hit(p)) { sfx('pop'); const r = await shareCode(carCode(custom), 'car'); this.toast.show(r === 'copied' ? 'Car code copied' : r === 'shared' ? 'Shared' : 'Car code: see the message', '#5cc95a'); return; }
      if (this.delBtn.hit(p)) {
        if (!this.confirmDel) { this.confirmDel = 2; sfx('alarm'); this.toast.show('Tap again to delete', '#e8443a'); return; }
        save.customCars = save.customCars.filter((c) => c !== custom);
        delete save.upgrades[v.id];
        save.vehicle = 'panda'; persist();
        this.idx = 0; this.stage = menuStage(this.game); this.confirmDel = 0; sfx('crunch');
        return;
      }
    } else {
      for (const s of this.swatches()) {
        if (Math.hypot(p.x - s.x, p.y - s.y) < s.r + 16) {
          const owned = save.paints[v.id].includes(s.p.id);
          if (!owned) {
            if (save.coins < s.p.cost) { sfx('bump'); this.shakeId = s.p.id; this.shakeT = 0.4; return; }
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
    }
    // Tapping the vehicle makes it talk.
    if (Math.hypot(p.x - this.cx, p.y - this.cy) < 180) { sfx(v.voice); this.stage.vehicle?.bump(0.4); this.stage.hop.t = 0; return; }
    this.fx.burst(p.x, p.y, 6); sfx('tap');
  }
  update(dt) {
    this.t += dt; this.fx.update(dt); this.toast.update(dt);
    if (this.shakeT) this.shakeT = Math.max(0, this.shakeT - dt);
    if (this.confirmDel) this.confirmDel = Math.max(0, this.confirmDel - dt);
    this.stage.update(dt, this.game.r3d.w, this.game.r3d.h);
  }
  draw(ctx) {
    const t = this.t, v = this.v, P = this.panel, custom = this.customOf(v);
    const ups = save.upgrades[v.id] || {};
    const shown = applyUpgrades(v, ups);
    rr(ctx, P.x, P.y + 8, P.w, P.h, 26); ctx.fillStyle = 'rgba(20,14,40,0.3)'; ctx.fill();
    rr(ctx, P.x, P.y, P.w, P.h, 26); fs(ctx, 'rgba(255,248,232,0.94)', 6);
    label(ctx, v.name, P.x + P.w / 2, P.y + P.h * 0.09, Math.min(38 * V.ui, P.w / 8), '#ffffff');
    stats(shown).forEach(([name, k], i) => {
      const y = P.y + P.h * (0.2 + i * 0.1);
      ctx.font = `800 ${21 * Math.min(V.ui, 1.25)}px ${FONT}`; ctx.fillStyle = INK; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(name, P.x + 26, y);
      for (let j = 0; j < 5; j++) { circle(ctx, P.x + P.w - 36 - (4 - j) * 32 * Math.min(V.ui, 1.2), y, 11 * Math.min(V.ui, 1.2)); fs(ctx, j < k ? ['#e8443a', '#3b8fe8', '#5cc95a'][i] : '#ddd6e8', 4); }
    });
    // Upgrades: icon, three pips, and the price of the next level
    for (const { u, b } of this.ups) {
      const lv = ups[u.id] || 0, cost = upgradeCost(u.id, lv);
      b.enabled = true;
      b.color = cost === null ? '#5cc95a' : save.coins >= cost ? '#f5962a' : '#b8b4c4';
      const bx = b.x;
      if (this.shakeUp === u.id && this.shakeT) b.x += Math.sin(this.shakeT * 60) * 5;
      b.draw(ctx, t); b.x = bx;
      for (let j = 0; j < MAX_UPGRADE; j++) { circle(ctx, b.x + (j - 1) * 16, b.y + b.r + 14, 6); fs(ctx, j < lv ? '#ffe14d' : '#ddd6e8', 3); }
      if (cost !== null) { coinIcon(ctx, b.x - 14, b.y + b.r + 36, 9); label(ctx, String(cost), b.x + 4, b.y + b.r + 37, 16, save.coins >= cost ? '#ffe14d' : '#ffffff', 'left'); }
    }
    if (custom) {
      for (const b of [this.editBtn, this.shareBtn, this.delBtn]) b.draw(ctx, t);
      if (this.confirmDel) { circle(ctx, this.delBtn.x, this.delBtn.y, this.delBtn.r + 8 + Math.sin(t * 12) * 2); ctx.lineWidth = 4; ctx.strokeStyle = '#e8443a'; ctx.stroke(); }
    } else {
      for (const s of this.swatches()) {
        const owned = save.paints[v.id].includes(s.p.id), sel = save.paint[v.id] === s.p.id;
        const sx = s.x + (this.shakeId === s.p.id && this.shakeT ? Math.sin(this.shakeT * 60) * 6 : 0);
        if (sel) { circle(ctx, sx, s.y, s.r + 9); fs(ctx, '#ffe14d', 4); }
        circle(ctx, sx, s.y, s.r); fs(ctx, s.p.color, 5);
        if (!owned) {
          circle(ctx, sx, s.y, s.r); ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fill();
          coinIcon(ctx, sx - 16, s.y + s.r + 16, 10);
          label(ctx, String(s.p.cost), sx + 6, s.y + s.r + 17, 18, save.coins >= s.p.cost ? '#ffe14d' : '#ffffff');
        }
      }
    }
    const cx = this.sound.x - this.sound.r - 140;
    coinIcon(ctx, cx, this.sound.y, 18);
    label(ctx, String(save.coins), cx + 26, this.sound.y + 2, 30, '#ffe14d', 'left');
    // Dots under the turntable: which car of how many
    const n = allCars().length;
    for (let i = 0; i < n; i++) { circle(ctx, this.cx + (i - (n - 1) / 2) * 22, this.left.y + this.left.r + 60, i === this.idx ? 8 : 5); fs(ctx, i === this.idx ? '#ffe14d' : '#ffffff', 3); }
    this.left.draw(ctx, t); this.right.draw(ctx, t);
    this.newCar.draw(ctx, t); this.importBtn.draw(ctx, t);
    this.back.draw(ctx, t); this.sound.draw(ctx, t);
    this.toast.draw(ctx, t);
    this.fx.draw(ctx);
  }
}
