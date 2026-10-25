// "My levels": levels made in the level builder. Start a new one, or pick one to play, edit,
// share or delete. Shared levels come in through a link or a pasted code.
import { V, ease } from '../core.js';
import { INK, rr, fs, circle, label } from '../draw.js';
import { Button, layoutTopRight, drawIcon } from '../ui.js';
import { playMusic, toggleMute, sfx } from '../audio.js';
import { Particles } from '../particles.js';
import { WORLDS } from '../game/worlds.js';
import { compileLevel, decodeLevel, levelCode, problems, MAX_CUSTOM_LEVELS } from '../game/custom.js';
import { save, persist } from '../storage.js';
import { goTitle, goBuilder, startLevel } from './nav.js';
import { drawWorldIcon } from './worlds.js';
import { shareCode, askCode, Toast } from '../share.js';

export class WorkshopScene {
  constructor(game) {
    this.game = game;
    this.t = 0;
    this.sel = -1;
    this.back = new Button('back', '#f5962a', 34);
    this.sound = new Button('sound', '#3b8fe8', 34);
    this.importBtn = new Button('import', '#9b5de5', 34);
    this.acts = { play: new Button('play', '#5cc95a', 30), edit: new Button('pencil', '#3b8fe8', 30), share: new Button('share', '#5cc95a', 30), del: new Button('trash', '#e8443a', 30) };
    this.toast = new Toast();
    this.fx = new Particles();
    this.onResize();
  }
  onResize() {
    this.back.x = V.safeL + 20 + this.back.r; this.back.y = V.safeT + 20 + this.back.r;
    layoutTopRight([this.sound, this.importBtn]);
    const n = save.customLevels.length + 1;
    const cols = V.w > V.h ? 5 : 3, gap = 20;
    const left = V.safeL + 40, right = V.w - V.safeR - 40, top = V.safeT + 120;
    const tw = Math.min(190, (right - left - gap * (cols - 1)) / cols), th = tw * 0.9;
    const x0 = V.w / 2 - (tw * cols + gap * (cols - 1)) / 2;
    this.tiles = [];
    for (let i = 0; i < n; i++) this.tiles.push({ i: i - 1, x: x0 + (i % cols) * (tw + gap), y: top + Math.floor(i / cols) * (th + gap), w: tw, h: th });
  }
  enter() { playMusic('menu'); }
  actionButtons(tile) {
    const L = save.customLevels[tile.i];
    const list = [];
    if (!problems(L).length) list.push(['play', this.acts.play]);
    list.push(['edit', this.acts.edit]);
    list.push(['share', this.acts.share]);
    list.push(['del', this.acts.del]);
    const y = Math.min(tile.y + tile.h + 44, V.h - V.safeB - 50);
    list.forEach(([, b], k) => { b.x = Math.max(V.safeL + 50, Math.min(V.w - V.safeR - 50, tile.x + tile.w / 2 + (k - (list.length - 1) / 2) * 76)); b.y = y; });
    return list;
  }
  onDown(p) {
    if (this.back.hit(p)) { sfx('tap'); goTitle(this.game); return; }
    if (this.sound.hit(p)) { toggleMute(); sfx('tap'); return; }
    if (this.importBtn.hit(p)) { sfx('tap'); this.importCode(askCode('Paste a level code')); return; }
    if (this.sel >= 0) {
      const tile = this.tiles.find((x) => x.i === this.sel), L = save.customLevels[this.sel];
      for (const [act, b] of this.actionButtons(tile)) {
        if (!b.hit(p)) continue;
        if (act === 'play') { sfx('pop'); startLevel(this.game, compileLevel(L, WORLDS[L.world - 1].ground), 'custom', { custom: L, from: 'workshop' }); }
        if (act === 'edit') { sfx('pop'); goBuilder(this.game, L); }
        if (act === 'share') {
          if (!L.verified) { sfx('bump'); this.toast.show('Finish it once first, then share it', '#f5962a'); return; }
          sfx('pop'); shareCode(levelCode(L), 'level').then((r) => this.toast.show(r === 'copied' ? 'Level link copied' : 'Shared', '#5cc95a'));
        }
        if (act === 'del') {
          if (!this.confirmDel) { this.confirmDel = 2; sfx('alarm'); this.toast.show('Tap again to delete', '#e8443a'); return; }
          save.customLevels.splice(this.sel, 1); persist(); this.sel = -1; this.confirmDel = 0; sfx('crunch'); this.onResize();
        }
        return;
      }
    }
    for (const tl of this.tiles) {
      if (p.x > tl.x && p.x < tl.x + tl.w && p.y > tl.y && p.y < tl.y + tl.h) {
        if (tl.i < 0) {
          if (save.customLevels.length >= MAX_CUSTOM_LEVELS) { sfx('bump'); this.toast.show('Full: delete a level first', '#e8443a'); return; }
          sfx('pop'); goBuilder(this.game, null); return;
        }
        this.sel = this.sel === tl.i ? -1 : tl.i; this.confirmDel = 0; sfx('tap'); return;
      }
    }
    this.sel = -1;
    this.fx.burst(p.x, p.y, 6); sfx('tap');
  }
  importCode(code) {
    if (!code) return;
    const L = decodeLevel(code);
    if (!L) { this.toast.show('That code is not a level', '#e8443a'); sfx('bump'); return; }
    if (save.customLevels.length >= MAX_CUSTOM_LEVELS) { this.toast.show('Full: delete a level first', '#e8443a'); return; }
    save.customLevels.push(L); persist(); this.onResize();
    this.sel = save.customLevels.length - 1;
    sfx('fanfare'); this.fx.confetti(V.w / 2, V.h / 2, 50);
  }
  update(dt) { this.t += dt; this.fx.update(dt); this.toast.update(dt); if (this.confirmDel) this.confirmDel = Math.max(0, this.confirmDel - dt); }
  draw(ctx) {
    const t = this.t;
    const g = ctx.createLinearGradient(0, 0, 0, V.h);
    g.addColorStop(0, '#ffb35c'); g.addColorStop(1, '#ffe2b8');
    ctx.fillStyle = g; ctx.fillRect(0, 0, V.w, V.h);
    ctx.save(); ctx.globalAlpha = 0.12; ctx.translate(V.w - 140, V.h - 140); drawIcon(ctx, 'hammer', 120); ctx.restore();
    label(ctx, 'My levels', V.w / 2, V.safeT + 60, 46, '#ffffff');
    this.tiles.forEach((tl, k) => {
      const kk = ease.outBack(Math.min(1, Math.max(0, t * 4 - k * 0.08)));
      ctx.save(); ctx.translate(tl.x + tl.w / 2, tl.y + tl.h / 2); ctx.scale(kk, kk);
      const x = -tl.w / 2, y = -tl.h / 2;
      rr(ctx, x, y + 7, tl.w, tl.h, 20); ctx.fillStyle = 'rgba(20,14,40,0.3)'; ctx.fill();
      if (tl.i < 0) {
        rr(ctx, x, y, tl.w, tl.h, 20); fs(ctx, '#5cc95a', 6);
        drawIcon(ctx, 'plus', tl.h * 0.3);
      } else {
        const L = save.customLevels[tl.i], w = WORLDS[(L.world || 1) - 1];
        const cg = ctx.createLinearGradient(0, y, 0, y + tl.h); cg.addColorStop(0, w.card[0]); cg.addColorStop(1, w.card[1]);
        rr(ctx, x, y, tl.w, tl.h, 20); ctx.fillStyle = cg; ctx.fill(); ctx.lineWidth = 6; ctx.strokeStyle = this.sel === tl.i ? '#ffe14d' : INK; ctx.stroke();
        drawWorldIcon(ctx, w.icon, 0, -6, tl.h / 260, t);
        label(ctx, String(tl.i + 1), x + 26, y + 26, 28, '#ffffff');
        if (L.verified) { circle(ctx, -x - 24, y + 24, 16); fs(ctx, '#5cc95a', 4); label(ctx, '✓', -x - 24, y + 25, 22, '#ffffff'); }
      }
      ctx.restore();
    });
    if (this.sel >= 0) {
      const tile = this.tiles.find((x) => x.i === this.sel);
      for (const [act, b] of this.actionButtons(tile)) {
        b.draw(ctx, t);
        if (act === 'share' && !save.customLevels[this.sel].verified) { circle(ctx, b.x, b.y, b.r); ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fill(); }
        if (act === 'del' && this.confirmDel) { circle(ctx, b.x, b.y, b.r + 8); ctx.lineWidth = 4; ctx.strokeStyle = '#e8443a'; ctx.stroke(); }
      }
    }
    this.back.draw(ctx, t); this.sound.draw(ctx, t); this.importBtn.draw(ctx, t);
    this.toast.draw(ctx, t);
    this.fx.draw(ctx);
  }
}
