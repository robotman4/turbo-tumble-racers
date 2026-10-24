// Example mini game: pop the floating balloons, then get 1-3 stars based on time.
// Replace this with the real game. It shows the patterns every scene uses:
// update/draw, onDown, tweens, particles, sounds, hint hand after idle, results.
import { V, R, ease, Tweens, dist } from '../core.js';
import { INK, circle, fs, drawHand, drawTreasure } from '../draw.js';
import { Button, layoutTopRight, drawStarIcon } from '../ui.js';
import { playMusic, toggleMute, sfx } from '../audio.js';
import { Particles } from '../particles.js';
import { recordLevel } from '../storage.js';
import { TitleScene } from './title.js';

const COLORS = ['#e8443a', '#f5962a', '#f7d43c', '#5cc95a', '#3b8fe8', '#9b5de5', '#f06fb0'];

export class PlayScene {
  constructor(game, level) {
    this.game = game;
    this.level = level;
    this.t = 0; this.timer = 0; this.idle = 0;
    this.tw = new Tweens();
    this.fx = new Particles();
    this.goal = 8;
    this.popped = 0;
    this.balloons = [];
    this.state = 'play';
    this.home = new Button('home', '#f5962a', 36);
    this.sound = new Button('sound', '#3b8fe8', 36);
    this.onResize();
    for (let i = 0; i < 5; i++) this.spawn(R.range(200, V.h));
  }
  onResize() { layoutTopRight([this.sound, this.home]); }
  enter() { playMusic('play'); }

  spawn(y = V.h + 80) {
    // Keep clear of the notch / rounded corners on iPhone.
    const x = R.range(V.safeL + 100, V.w - V.safeR - 100);
    this.balloons.push({ x, y, r: R.range(48, 62), c: R.pick(COLORS), sp: R.range(50, 90), ph: R() * 6, s: 1 });
  }

  onDown(p) {
    if (this.sound.hit(p)) { toggleMute(); sfx('tap'); return; }
    if (this.home.hit(p)) { sfx('tap'); this.game.go(new TitleScene(this.game)); return; }
    if (this.state === 'done') { this.game.go(new TitleScene(this.game)); return; }
    this.idle = 0;
    // Generous hit areas: small fingers miss.
    for (const b of this.balloons) {
      if (!b.popping && dist(p.x, p.y, b.x, b.y) < b.r + 30) { this.pop(b); return; }
    }
    this.fx.burst(p.x, p.y, 4);
  }

  pop(b) {
    b.popping = true;
    sfx('coin');
    this.fx.burst(b.x, b.y, 12);
    this.tw.add(b, { s: 1.4 }, 0.12, { onDone: () => { b.dead = true; } });
    this.popped++;
    if (this.popped >= this.goal) this.finish();
  }

  finish() {
    this.state = 'done';
    // Stars by time, never 0: every finished level is a success.
    const par = this.goal * 1.5;
    this.stars = this.timer <= par ? 3 : this.timer <= par * 2 ? 2 : 1;
    recordLevel(this.level, this.stars, Math.round(this.timer));
    sfx('fanfare');
    this.fx.confetti(V.w / 2, V.h / 2, 60);
    this.doneT = 0;
  }

  update(dt) {
    this.t += dt;
    if (this.state === 'play') { this.timer += dt; this.idle += dt; }
    if (this.state === 'done') this.doneT += dt;
    this.tw.update(dt);
    this.fx.update(dt);
    for (const b of this.balloons) { b.y -= b.sp * dt; b.x += Math.sin(this.t * 1.5 + b.ph) * 20 * dt; }
    this.balloons = this.balloons.filter((b) => !b.dead && b.y > -100);
    if (this.state === 'play') while (this.balloons.length < 5) this.spawn();
  }

  draw(ctx) {
    const t = this.t;
    const g = ctx.createLinearGradient(0, 0, 0, V.h);
    g.addColorStop(0, '#ff9ed2'); g.addColorStop(1, '#ffe0f2');
    ctx.fillStyle = g; ctx.fillRect(0, 0, V.w, V.h);
    for (const b of this.balloons) {
      ctx.beginPath(); ctx.moveTo(b.x, b.y + b.r); ctx.quadraticCurveTo(b.x + 10, b.y + b.r + 40, b.x, b.y + b.r + 80);
      ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
      ctx.save(); ctx.translate(b.x, b.y); ctx.scale(b.s, b.s * 1.1);
      circle(ctx, 0, 0, b.r); fs(ctx, b.c, 5);
      circle(ctx, -b.r * 0.35, -b.r * 0.35, b.r * 0.18); ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fill();
      ctx.restore();
    }
    this.fx.draw(ctx);
    // HUD: one slot per balloon to pop, no numbers.
    const x0 = V.safeL + 40, y0 = V.safeT + 50;
    for (let i = 0; i < this.goal; i++) {
      circle(ctx, x0 + i * 46, y0, 18); fs(ctx, i < this.popped ? '#ffe14d' : 'rgba(255,255,255,0.4)', 3);
    }
    // Hint hand after a few idle seconds.
    if (this.state === 'play' && this.idle > 4 && this.balloons[0]) {
      const b = this.balloons[0];
      drawHand(ctx, b.x + 10, b.y + 10, 1, Math.sin(t * 8) > 0 ? 1 : 0);
    }
    if (this.state === 'done') {
      ctx.fillStyle = `rgba(20,14,40,${Math.min(0.5, this.doneT)})`; ctx.fillRect(0, 0, V.w, V.h);
      for (let i = 0; i < 3; i++) {
        const k = ease.outElastic(Math.min(1, Math.max(0, (this.doneT - 0.4 - i * 0.4) * 2)));
        drawStarIcon(ctx, V.w / 2 + (i - 1) * 140, 360, 56, false);
        if (i < this.stars && k > 0) {
          ctx.save(); ctx.translate(V.w / 2 + (i - 1) * 140, 360); ctx.scale(k, k);
          drawStarIcon(ctx, 0, 0, 56, true); ctx.restore();
        }
      }
      drawTreasure(ctx, 'crown', V.w / 2, 230 + Math.sin(t * 3) * 6, t, 1.6);
    }
    this.home.draw(ctx, t);
    this.sound.draw(ctx, t);
  }
}
