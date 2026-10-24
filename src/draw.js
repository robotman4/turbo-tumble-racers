// Shared drawing helpers: rounded shapes with the thick dark outline, collectibles, hint hand and arrow.
import { TAU, shade } from './core.js';

export const INK = '#2a1f3d';

export function rr(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
export function circle(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); }
export function ellipse(ctx, x, y, rx, ry, rot = 0) { ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU); }
export function fs(ctx, fill, lw = 4) {
  ctx.fillStyle = fill; ctx.fill();
  if (lw) { ctx.lineWidth = lw; ctx.strokeStyle = INK; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke(); }
}
export function starPath(ctx, x, y, r1, r2, n = 5, rot = -Math.PI / 2) {
  ctx.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? r2 : r1, a = rot + (i * Math.PI) / n;
    ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  ctx.closePath();
}
// Glossy cylinder shading over the current path (call after the path is set).
export function tubeShade(ctx, x0, x1) {
  ctx.save();
  ctx.clip();
  const g = ctx.createLinearGradient(x0, 0, x1, 0);
  g.addColorStop(0, 'rgba(255,255,255,0.05)');
  g.addColorStop(0.18, 'rgba(255,255,255,0.45)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.08)');
  g.addColorStop(0.75, 'rgba(0,0,0,0.05)');
  g.addColorStop(1, 'rgba(0,0,0,0.28)');
  ctx.fillStyle = g;
  ctx.fillRect(x0 - 5, -2000, x1 - x0 + 10, 4000);
  ctx.restore();
}

// ---------------- treasures ----------------
export const TREASURES = ['gem', 'coin', 'chest', 'crown', 'egg'];
const GEM_COLORS = ['#3ee0ff', '#ff5ec4', '#5cf27a', '#b07bff', '#ff8a3d'];

export function drawTreasure(ctx, type, x, y, t, s = 1, hue = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  // soft glow
  const g = ctx.createRadialGradient(0, 0, 4, 0, 0, 44);
  g.addColorStop(0, 'rgba(255,255,200,0.55)'); g.addColorStop(1, 'rgba(255,255,200,0)');
  ctx.fillStyle = g; circle(ctx, 0, 0, 44); ctx.fill();
  if (type === 'gem') {
    const c = GEM_COLORS[hue % GEM_COLORS.length];
    ctx.beginPath(); ctx.moveTo(-22, -8); ctx.lineTo(-12, -20); ctx.lineTo(12, -20); ctx.lineTo(22, -8); ctx.lineTo(0, 22); ctx.closePath();
    fs(ctx, c);
    ctx.beginPath(); ctx.moveTo(-22, -8); ctx.lineTo(22, -8); ctx.moveTo(-8, -8); ctx.lineTo(0, 22); ctx.lineTo(8, -8);
    ctx.lineWidth = 2; ctx.strokeStyle = shade(c, -0.4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-12, -16); ctx.lineTo(-4, -16); ctx.lineTo(-8, -10); ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fill();
  } else if (type === 'coin') {
    const w = Math.abs(Math.cos(t * 3));
    ellipse(ctx, 0, 0, 22 * Math.max(0.25, w), 22); fs(ctx, '#ffcc1a');
    ellipse(ctx, 0, 0, 15 * Math.max(0.25, w), 15); ctx.lineWidth = 2; ctx.strokeStyle = '#c98a00'; ctx.stroke();
    if (w > 0.5) { starPath(ctx, 0, 0, 9 * w, 4 * w); ctx.fillStyle = '#fff3a0'; ctx.fill(); }
  } else if (type === 'chest') {
    rr(ctx, -24, -8, 48, 28, 4); fs(ctx, '#a0602d');
    ctx.beginPath(); ctx.moveTo(-24, -6); ctx.quadraticCurveTo(0, -30, 24, -6); ctx.closePath(); fs(ctx, '#c47a3a');
    ctx.fillStyle = '#ffcc1a';
    ctx.fillRect(-26, -9, 52, 6); ctx.strokeRect(-26, -9, 52, 6);
    rr(ctx, -6, -6, 12, 14, 3); fs(ctx, '#ffcc1a', 2);
    circle(ctx, -14, -14, 4); ctx.fillStyle = '#3ee0ff'; ctx.fill();
    circle(ctx, 12, -15, 4); ctx.fillStyle = '#ff5ec4'; ctx.fill();
  } else if (type === 'crown') {
    ctx.beginPath(); ctx.moveTo(-24, 14); ctx.lineTo(-26, -14); ctx.lineTo(-12, 0); ctx.lineTo(0, -20); ctx.lineTo(12, 0); ctx.lineTo(26, -14); ctx.lineTo(24, 14); ctx.closePath();
    fs(ctx, '#ffcc1a');
    circle(ctx, 0, 6, 5); fs(ctx, '#ff3d5e', 2);
    circle(ctx, -14, 7, 3.5); fs(ctx, '#3ee0ff', 2);
    circle(ctx, 14, 7, 3.5); fs(ctx, '#5cf27a', 2);
  } else if (type === 'egg') {
    ellipse(ctx, 0, 0, 18, 23); fs(ctx, '#ffd84d');
    ctx.save(); ellipse(ctx, 0, 0, 18, 23); ctx.clip();
    ctx.fillStyle = '#ff7ab8'; ctx.fillRect(-20, -6, 40, 6);
    ctx.fillStyle = '#4dc3ff'; ctx.fillRect(-20, 6, 40, 5);
    ctx.restore();
    ellipse(ctx, 0, 0, 18, 23); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke();
  }
  // twinkle
  const tw = (Math.sin(t * 4 + x * 0.1) + 1) / 2;
  starPath(ctx, 16, -18, 7 * tw + 2, 2, 4, 0); ctx.fillStyle = '#ffffff'; ctx.fill();
  ctx.restore();
}

// ---------------- flame ----------------
export function drawFlame(ctx, x, y, len, t, w = 40) {
  if (len <= 2) return;
  const layers = [['#ff3d1a', 1], ['#ff9a1a', 0.75], ['#ffe14d', 0.5], ['#ffffff', 0.25]];
  for (const [c, k] of layers) {
    const fl = len * k * (0.85 + Math.sin(t * 50 + k * 10) * 0.08 + Math.random() * 0.1);
    const ww = w * (0.4 + k * 0.6);
    ctx.beginPath();
    ctx.moveTo(x - ww / 2, y);
    ctx.quadraticCurveTo(x - ww * 0.6, y + fl * 0.45, x, y + fl);
    ctx.quadraticCurveTo(x + ww * 0.6, y + fl * 0.45, x + ww / 2, y);
    ctx.closePath();
    ctx.fillStyle = c; ctx.fill();
  }
}

// Pointing hand used for hints.
export function drawHand(ctx, x, y, s = 1, press = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s * (1 - press * 0.1), s * (1 - press * 0.1));
  ctx.rotate(-0.35);
  rr(ctx, -8, -4, 16, 40, 8); fs(ctx, '#ffe0c2');
  rr(ctx, -14, 22, 44, 46, 16); fs(ctx, '#ffe0c2');
  rr(ctx, -16, 70, 48, 14, 4); fs(ctx, '#4d8fe8');
  ctx.restore();
}

// Arrow pointing in a direction (used at screen edges and for "launch now").
export function drawArrow(ctx, x, y, angle, s = 1, color = '#ffe14d') {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(s, s);
  ctx.beginPath();
  ctx.moveTo(30, 0); ctx.lineTo(0, -26); ctx.lineTo(0, -12); ctx.lineTo(-28, -12); ctx.lineTo(-28, 12); ctx.lineTo(0, 12); ctx.lineTo(0, 26);
  ctx.closePath();
  fs(ctx, color, 5);
  ctx.restore();
}
