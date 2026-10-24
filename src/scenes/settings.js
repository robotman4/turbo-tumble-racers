// Settings: music, sound effects, Easy Mode (and unlimited launches), graphics quality,
// reset progress (with a confirmation) and the developer mode switch.
import { V } from '../core.js';
import { INK, rr, fs, label, panel, FONT } from '../draw.js';
import { Button, layoutTopRight } from '../ui.js';
import { playMusic, toggleMute, sfx, setMusicOn, setSfxOn } from '../audio.js';
import { Particles } from '../particles.js';
import { save, persist, resetProgress } from '../storage.js';
import { menuStage, resetMenuStage } from './title.js';
import { goTitle } from './nav.js';
import { setDebug } from '../debug.js';

const QUALITIES = ['auto', 'low', 'medium', 'high'];
const QNAME = { auto: 'Auto', low: 'Low', medium: 'Medium', high: 'High' };

export class SettingsScene {
  constructor(game) {
    this.game = game;
    this.t = 0;
    this.back = new Button('back', '#f5962a', 34);
    this.sound = new Button('sound', '#3b8fe8', 34);
    this.music = new Button('music', '#3b8fe8', 46);
    this.sfxBtn = new Button('sfx', '#3b8fe8', 46);
    this.easy = new Button('turtle', '#5cc95a', 46);
    this.unlim = new Button('infinity', '#5cc95a', 46);
    this.quality = new Button('sparkle', '#9b5de5', 46);
    this.reset = new Button('trash', '#e8443a', 46);
    this.dev = new Button('bug', '#7a7690', 30);
    this.yes = new Button('check', '#5cc95a', 52);
    this.no = new Button('close', '#e8443a', 52);
    this.grid = [this.music, this.sfxBtn, this.easy, this.unlim, this.quality, this.reset];
    this.confirm = false;
    this.fx = new Particles();
    this.stage = menuStage(game);
    this.onResize();
  }
  onResize() {
    this.back.x = V.safeL + 20 + this.back.r; this.back.y = V.safeT + 20 + this.back.r;
    layoutTopRight([this.sound]);
    const cols = V.portrait ? 2 : 3, rows = Math.ceil(this.grid.length / cols);
    const gx = Math.min(250, (V.w - V.safeL - V.safeR - 80) / cols), gy = 170 * Math.min(1, V.ui);
    const top = V.portrait ? V.h * 0.42 : 260;
    this.grid.forEach((b, i) => { b.x = V.w / 2 + ((i % cols) - (cols - 1) / 2) * gx; b.y = top + Math.floor(i / cols) * gy; });
    this.dev.x = V.w - V.safeR - 50; this.dev.y = V.h - V.safeB - 50;
    this.yes.x = V.w / 2 - 90; this.no.x = V.w / 2 + 90; this.yes.y = this.no.y = V.h / 2 + 60;
    this.stage.setAspect(this.game.r3d.aspect, 0.5, V.portrait ? 0.2 : 0.85);
    this.refresh();
  }
  refresh() {
    const s = save.settings;
    this.music.off = !s.music; this.music.caption = 'Music';
    this.sfxBtn.off = !s.sfx; this.sfxBtn.caption = 'Sounds';
    this.easy.off = !s.easy; this.easy.caption = 'Easy Mode';
    this.unlim.off = !s.unlimited; this.unlim.enabled = s.easy; this.unlim.caption = 'No limit';
    this.quality.caption = `Graphics: ${QNAME[s.quality] || 'Auto'}`;
    this.reset.caption = 'Reset';
    this.dev.off = !s.debug;
  }
  enter() { playMusic('menu'); }
  onDown(p) {
    const s = save.settings;
    if (this.confirm) {
      if (this.yes.hit(p)) { resetProgress(); this.confirm = false; sfx('pop'); this.fx.confetti(V.w / 2, V.h / 2, 40); resetMenuStage(); this.stage = menuStage(this.game); this.refresh(); return; }
      if (this.no.hit(p)) { this.confirm = false; sfx('tap'); }
      return;
    }
    if (this.back.hit(p)) { sfx('tap'); goTitle(this.game); return; }
    if (this.sound.hit(p)) { toggleMute(); sfx('tap'); return; }
    if (this.music.hit(p)) { setMusicOn(!s.music); sfx('tap'); }
    else if (this.sfxBtn.hit(p)) { setSfxOn(!s.sfx); sfx('pop'); }
    else if (this.easy.hit(p)) { s.easy = !s.easy; if (!s.easy) s.unlimited = false; persist(); sfx('pop'); }
    else if (this.unlim.hit(p)) { s.unlimited = !s.unlimited; persist(); sfx('pop'); }
    else if (this.quality.hit(p)) {
      s.quality = QUALITIES[(QUALITIES.indexOf(s.quality) + 1) % QUALITIES.length]; persist();
      this.game.r3d.setQuality(s.quality);
      resetMenuStage(); this.stage = menuStage(this.game); this.onResize();
      sfx('pop');
    } else if (this.reset.hit(p)) { this.confirm = true; sfx('alarm'); }
    else if (this.dev.hit(p)) { s.debug = !s.debug; persist(); setDebug(s.debug); sfx('tap'); }
    else { this.fx.burst(p.x, p.y, 6); sfx('tap'); }
    this.refresh();
  }
  update(dt) { this.t += dt; this.fx.update(dt); this.stage.update(dt, this.game.r3d.w, this.game.r3d.h); }
  draw(ctx) {
    const t = this.t;
    const cols = V.portrait ? 2 : 3, rows = Math.ceil(this.grid.length / cols);
    const pw = Math.min(V.w - V.safeL - V.safeR - 40, cols * 250 + 40), ph = rows * 170 + 70;
    panel(ctx, V.w / 2 - pw / 2, this.grid[0].y - 90, pw, ph, 'rgba(26,20,70,0.55)', 30, 0);
    label(ctx, 'Settings', V.w / 2, V.safeT + 60, 48, '#ffffff');
    for (const b of this.grid) b.draw(ctx, t);
    this.dev.draw(ctx, t);
    this.back.draw(ctx, t); this.sound.draw(ctx, t);
    if (this.confirm) {
      ctx.fillStyle = 'rgba(20,14,40,0.6)'; ctx.fillRect(0, 0, V.w, V.h);
      const w = Math.min(560, V.w - 60);
      panel(ctx, V.w / 2 - w / 2, V.h / 2 - 150, w, 300);
      ctx.font = `800 28px ${FONT}`; ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('Delete all progress?', V.w / 2, V.h / 2 - 80);
      ctx.font = `20px ${FONT}`; ctx.fillStyle = '#5a4f70';
      ctx.fillText('Stars, scores, coins and paint jobs.', V.w / 2, V.h / 2 - 40);
      this.yes.draw(ctx, t); this.no.draw(ctx, t);
    }
    this.fx.draw(ctx);
  }
}
