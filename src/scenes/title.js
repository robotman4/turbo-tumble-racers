// Title screen: logo, big play button, sound and update buttons.
import { V } from '../core.js';
import { INK, circle, fs } from '../draw.js';
import { Button, layoutTopRight, updateButton, layoutTopLeft, tapUpdate } from '../ui.js';
import { playMusic, toggleMute, sfx } from '../audio.js';
import { Particles } from '../particles.js';
import { pwa } from '../pwa.js';
import { InfoPanel } from '../info.js';
import { Gift } from '../celebrate.js';
import { PlayScene } from './play.js';

export const GAME_TITLE = 'MY GAME';

export class TitleScene {
  constructor(game) {
    this.game = game;
    this.t = 0;
    this.play = new Button('play', '#5cc95a', 80);
    this.play.pulse = true;
    this.sound = new Button('sound', '#3b8fe8', 36);
    this.infoBtn = new Button('info', '#9b5de5', 36);
    this.info = new InfoPanel();
    this.updBtn = updateButton();
    this.fx = new Particles();
    // Just updated: show a present to open.
    this.gift = pwa.justUpdated ? new Gift() : null;
    pwa.justUpdated = false;
    this.onResize();
  }
  onResize() {
    this.play.x = V.w / 2; this.play.y = 470;
    layoutTopLeft(this.updBtn);
    layoutTopRight([this.sound, this.infoBtn]);
  }
  enter() { playMusic('menu'); }
  onDown(p) {
    if (this.info.onDown(p, this.fx)) return;
    if (this.gift && !this.gift.done) { this.gift.onDown(p); return; }
    this.updBtn.visible = pwa.ready;
    if (this.updBtn.hit(p)) { tapUpdate(this.updBtn, this.fx); return; }
    if (this.infoBtn.hit(p)) { this.info.show(); return; }
    if (this.sound.hit(p)) { toggleMute(); sfx('tap'); return; }
    if (this.play.hit(p)) { sfx('pop'); this.game.go(new PlayScene(this.game, 1)); return; }
    // Tapping anywhere does something fun.
    this.fx.burst(p.x, p.y, 8);
    sfx('tap');
  }
  update(dt) { this.t += dt; this.fx.update(dt); this.info.update(dt); if (this.gift) this.gift.update(dt); }
  draw(ctx) {
    const t = this.t;
    const g = ctx.createLinearGradient(0, 0, 0, V.h);
    g.addColorStop(0, '#5fbfff'); g.addColorStop(1, '#c9f0ff');
    ctx.fillStyle = g; ctx.fillRect(0, 0, V.w, V.h);
    // ground
    ctx.beginPath(); ctx.moveTo(0, 640);
    for (let x = 0; x <= V.w; x += 20) ctx.lineTo(x, 640 + Math.sin(x * 0.01 + t * 0.3) * 6);
    ctx.lineTo(V.w, V.h); ctx.lineTo(0, V.h); ctx.closePath();
    fs(ctx, '#5cc04a', 4);
    // Wobbly multicolour logo
    ctx.save();
    ctx.translate(V.w / 2, 190 + Math.sin(t * 1.5) * 6);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '900 96px "Arial Rounded MT Bold", "Trebuchet MS", Arial, sans-serif';
    const colors = ['#e8443a', '#f5962a', '#f7d43c', '#5cc95a', '#3b8fe8', '#9b5de5'];
    let x = -ctx.measureText(GAME_TITLE).width / 2;
    for (let i = 0; i < GAME_TITLE.length; i++) {
      const ch = GAME_TITLE[i], cw = ctx.measureText(ch).width, y = Math.sin(t * 4 + i * 0.6) * 6;
      ctx.lineWidth = 16; ctx.strokeStyle = INK; ctx.lineJoin = 'round';
      ctx.strokeText(ch, x + cw / 2, y);
      ctx.fillStyle = colors[i % colors.length]; ctx.fillText(ch, x + cw / 2, y);
      x += cw;
    }
    ctx.restore();
    // sun
    circle(ctx, V.w - 160, 140, 50); fs(ctx, '#ffe14d');
    this.play.draw(ctx, t);
    this.updBtn.visible = pwa.ready || this.updBtn.spinning;
    this.updBtn.draw(ctx, t);
    this.sound.draw(ctx, t);
    this.infoBtn.draw(ctx, t);
    this.info.draw(ctx, t);
    this.fx.draw(ctx);
    if (this.gift) this.gift.draw(ctx, t);
  }
}
