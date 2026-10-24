// Level selection for one world: number, name, stars and best score per level.
// In Challenge mode the tiles show best time and fewest launches instead.
import { V, ease } from '../core.js';
import { INK, rr, label, lockIcon, FONT } from '../draw.js';
import { Button, layoutTopRight, drawStarIcon } from '../ui.js';
import { playMusic, toggleMute, sfx } from '../audio.js';
import { Particles } from '../particles.js';
import { worldById } from '../game/worlds.js';
import { LEVELS, levelsOfWorld, levelIndex } from '../game/levels/index.js';
import { save } from '../storage.js';
import { goWorlds, startLevel, preloadPlay } from './nav.js';
import { drawWorldIcon } from './worlds.js';

export const levelUnlocked = (id) => save.settings.debug || levelIndex(id) < save.unlocked;

export class LevelsScene {
  constructor(game, worldId, mode = 'adventure') {
    this.game = game; this.world = worldById(worldId); this.mode = mode;
    this.levels = levelsOfWorld(worldId);
    this.t = 0;
    this.back = new Button('back', '#f5962a', 34);
    this.sound = new Button('sound', '#3b8fe8', 34);
    this.fx = new Particles();
    this.onResize();
  }
  onResize() {
    this.back.x = V.safeL + 20 + this.back.r; this.back.y = V.safeT + 20 + this.back.r;
    layoutTopRight([this.sound]);
    const cols = V.w > V.h ? 4 : 2, rows = Math.ceil(this.levels.length / cols);
    const top = V.safeT + 120, bottom = V.h - V.safeB - 30;
    const left = V.safeL + 40, right = V.w - V.safeR - 40, gap = 22;
    const tw = Math.min(240, (right - left - gap * (cols - 1)) / cols);
    const th = Math.min(250, (bottom - top - gap * (rows - 1)) / rows);
    const x0 = V.w / 2 - (tw * cols + gap * (cols - 1)) / 2;
    this.tiles = this.levels.map((l, i) => ({ l, x: x0 + (i % cols) * (tw + gap), y: top + Math.floor(i / cols) * (th + gap), w: tw, h: th }));
  }
  enter() { playMusic('menu'); preloadPlay(); }
  onDown(p) {
    if (this.back.hit(p)) { sfx('tap'); goWorlds(this.game, this.mode); return; }
    if (this.sound.hit(p)) { toggleMute(); sfx('tap'); return; }
    for (const tl of this.tiles) {
      if (p.x > tl.x && p.x < tl.x + tl.w && p.y > tl.y && p.y < tl.y + tl.h) {
        if (!levelUnlocked(tl.l.id)) { sfx('bump'); tl.shake = 0.4; return; }
        sfx('pop'); startLevel(this.game, tl.l.id, this.mode); return;
      }
    }
    this.fx.burst(p.x, p.y, 6); sfx('tap');
  }
  update(dt) { this.t += dt; this.fx.update(dt); for (const tl of this.tiles) if (tl.shake) tl.shake = Math.max(0, tl.shake - dt); }
  draw(ctx) {
    const t = this.t, W = this.world;
    const g = ctx.createLinearGradient(0, 0, 0, V.h);
    g.addColorStop(0, W.card[0]); g.addColorStop(1, W.card[1]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, V.w, V.h);
    ctx.save(); ctx.globalAlpha = 0.15; drawWorldIcon(ctx, W.icon, V.w - 160, V.h - 150, 3, t); ctx.restore();
    label(ctx, W.name, V.w / 2, V.safeT + 60, Math.min(48, V.w / 16), '#ffffff');
    const firstIdx = LEVELS.indexOf(this.levels[0]);
    this.tiles.forEach((tl, i) => {
      const k = ease.outBack(Math.min(1, Math.max(0, t * 4 - i * 0.12)));
      const open = levelUnlocked(tl.l.id), rec = save.levels[tl.l.id];
      const isNext = open && !rec && this.mode === 'adventure';
      ctx.save();
      ctx.translate(tl.x + tl.w / 2 + (tl.shake ? Math.sin(tl.shake * 60) * 8 : 0), tl.y + tl.h / 2);
      const pulse = isNext ? 1 + Math.sin(t * 5) * 0.03 : 1;
      ctx.scale(k * pulse, k * pulse);
      const x = -tl.w / 2, y = -tl.h / 2;
      rr(ctx, x, y + 7, tl.w, tl.h, 22); ctx.fillStyle = 'rgba(20,14,40,0.3)'; ctx.fill();
      rr(ctx, x, y, tl.w, tl.h, 22); ctx.fillStyle = open ? '#fff8e8' : '#cfcadb'; ctx.fill(); ctx.lineWidth = 6; ctx.strokeStyle = isNext ? '#ffcc1a' : INK; ctx.stroke();
      if (isNext) { rr(ctx, x - 6, y - 6, tl.w + 12, tl.h + 12, 26); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke(); }
      label(ctx, String(firstIdx + i + 1), 0, y + tl.h * 0.25, Math.min(64, tl.h * 0.26), open ? W.card[0] : '#9a96a6');
      ctx.font = `800 ${Math.min(20, tl.w / 10)}px ${FONT}`; ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(tl.l.name, 0, y + tl.h * 0.5);
      if (!open) { lockIcon(ctx, 0, y + tl.h * 0.76, 1.1); ctx.restore(); return; }
      for (let s = 0; s < 3; s++) drawStarIcon(ctx, (s - 1) * 40, y + tl.h * 0.7, 17, (rec?.stars || 0) > s);
      ctx.font = `800 ${Math.min(19, tl.w / 11)}px ${FONT}`; ctx.fillStyle = '#5a4f70';
      if (rec) {
        const txt = this.mode === 'challenge' ? `${rec.bestTime}s · ${rec.bestLaunches}x` : `${rec.best}`;
        ctx.fillText(txt, 0, y + tl.h * 0.88);
      }
      ctx.restore();
    });
    this.back.draw(ctx, t);
    this.sound.draw(ctx, t);
    this.fx.draw(ctx);
  }
}
