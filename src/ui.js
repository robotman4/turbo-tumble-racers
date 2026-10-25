// Round icon buttons. No text, only symbols.
import { INK, circle, ellipse, fs, rr, starPath, label } from './draw.js';
import { V, dist, shade } from './core.js';
import { isMuted, sfx } from './audio.js';
import { pwa } from './pwa.js';

export class Button {
  constructor(icon, color, r = 44) {
    this.icon = icon; this.color = color; this.r0 = r;
    this.x = 0; this.y = 0; this.enabled = true; this.pulse = false; this.pressed = 0; this.visible = true;
  }
  // Buttons grow on small (phone) screens so they stay easy to hit.
  get r() { return this.r0 * V.ui; }
  hit(p) { return this.visible && this.enabled && dist(p.x, p.y, this.x, this.y) < this.r + 14; }
  draw(ctx, t) {
    if (!this.visible) return;
    let s = (this.pulse ? 1 + Math.sin(t * 6) * 0.07 : 1) * (1 - this.pressed * 0.12);
    if (this.spinning) s = 1.25 + Math.sin(t * 20) * 0.05;
    ctx.save();
    ctx.translate(this.x, this.y);
    if (this.spinning) ctx.rotate(t * 14);
    ctx.scale(s, s);
    if (this.pulse) {
      ctx.globalAlpha = 0.35 + Math.sin(t * 6) * 0.2;
      circle(ctx, 0, 0, this.r + 16); ctx.fillStyle = '#fff27a'; ctx.fill();
      ctx.globalAlpha = 1;
    }
    const col = this.enabled ? this.color : '#9a96a6';
    circle(ctx, 0, 6, this.r); ctx.fillStyle = shade(this.enabled ? this.color : '#9a96a6', -0.35); ctx.fill();
    circle(ctx, 0, 0, this.r); fs(ctx, col, 5);
    ctx.beginPath(); ctx.arc(0, 0, this.r * 0.75, Math.PI * 1.1, Math.PI * 1.45); ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.stroke();
    drawIcon(ctx, this.icon, this.r, t);
    // Settings toggles show a small red cross when off.
    if (this.off) {
      ctx.beginPath(); ctx.moveTo(-this.r * 0.6, this.r * 0.6); ctx.lineTo(this.r * 0.6, -this.r * 0.6);
      ctx.lineWidth = this.r * 0.22; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = this.r * 0.11; ctx.strokeStyle = '#ff5e5e'; ctx.stroke();
    }
    ctx.restore();
    if (this.caption) label(ctx, this.caption, this.x, this.y + this.r + 22 * V.ui, 20 * V.ui, '#ffffff');
  }
}

export function drawIcon(ctx, icon, r, t = 0) {
  const k = r / 44;
  ctx.save();
  ctx.scale(k, k);
  ctx.fillStyle = '#ffffff'; ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  if (icon === 'play' || icon === 'next') {
    ctx.beginPath(); ctx.moveTo(-12, -20); ctx.lineTo(20, 0); ctx.lineTo(-12, 20); ctx.closePath(); ctx.fill(); ctx.stroke();
    if (icon === 'next') { rr(ctx, -24, -18, 8, 36, 3); }
  } else if (icon === 'home') {
    ctx.beginPath(); ctx.moveTo(-22, 0); ctx.lineTo(0, -20); ctx.lineTo(22, 0); ctx.lineTo(16, 0); ctx.lineTo(16, 20); ctx.lineTo(-16, 20); ctx.lineTo(-16, 0); ctx.closePath();
    ctx.fill(); ctx.stroke();
    rr(ctx, -5, 6, 10, 14, 2); ctx.fillStyle = INK; ctx.fill();
  } else if (icon === 'sound' || icon === 'sfx') {
    ctx.beginPath(); ctx.moveTo(-20, -8); ctx.lineTo(-10, -8); ctx.lineTo(2, -18); ctx.lineTo(2, 18); ctx.lineTo(-10, 8); ctx.lineTo(-20, 8); ctx.closePath();
    ctx.fill(); ctx.stroke();
    if (icon === 'sound' && isMuted()) {
      ctx.beginPath(); ctx.moveTo(8, -10); ctx.lineTo(22, 10); ctx.moveTo(22, -10); ctx.lineTo(8, 10); ctx.lineWidth = 6; ctx.strokeStyle = '#ffffff'; ctx.stroke();
    } else {
      ctx.beginPath(); ctx.arc(4, 0, 10, -0.8, 0.8); ctx.moveTo(4 + Math.cos(-0.8) * 18, Math.sin(-0.8) * 18); ctx.arc(4, 0, 18, -0.8, 0.8);
      ctx.lineWidth = 5; ctx.strokeStyle = '#ffffff'; ctx.stroke();
    }
  } else if (icon === 'launch') {
    // little rocket
    ctx.rotate(-0.6);
    ctx.beginPath(); ctx.moveTo(0, -28); ctx.quadraticCurveTo(14, -14, 12, 14); ctx.lineTo(-12, 14); ctx.quadraticCurveTo(-14, -14, 0, -28); ctx.closePath();
    ctx.fill(); ctx.stroke();
    circle(ctx, 0, -6, 5); ctx.fillStyle = '#4aa8e0'; ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-12, 6); ctx.lineTo(-20, 18); ctx.lineTo(-10, 14); ctx.moveTo(12, 6); ctx.lineTo(20, 18); ctx.lineTo(10, 14);
    ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-7, 16); ctx.quadraticCurveTo(0, 34 + Math.sin(t * 30) * 4, 7, 16); ctx.fillStyle = '#ffb81a'; ctx.fill(); ctx.stroke();
  } else if (icon === 'retry') {
    ctx.beginPath(); ctx.arc(0, 0, 16, -Math.PI * 0.2, Math.PI * 1.5); ctx.lineWidth = 12; ctx.strokeStyle = INK; ctx.stroke();
    ctx.lineWidth = 6; ctx.strokeStyle = '#ffffff'; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(2, -26); ctx.lineTo(14, -16); ctx.lineTo(0, -8); ctx.closePath(); ctx.fillStyle = '#fff'; ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.fill(); ctx.stroke();
  } else if (icon === 'update') {
    // Arrow down into a tray: "get the new version".
    ctx.beginPath(); ctx.moveTo(-8, -22); ctx.lineTo(8, -22); ctx.lineTo(8, -4); ctx.lineTo(18, -4); ctx.lineTo(0, 14); ctx.lineTo(-18, -4); ctx.lineTo(-8, -4); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-22, 8); ctx.lineTo(-22, 20); ctx.lineTo(22, 20); ctx.lineTo(22, 8);
    ctx.lineWidth = 10; ctx.stroke(); ctx.lineWidth = 5; ctx.strokeStyle = '#ffffff'; ctx.stroke();
  } else if (icon === 'info') {
    circle(ctx, 0, -15, 6); ctx.fill(); ctx.stroke();
    rr(ctx, -6, -4, 12, 26, 4); ctx.fill(); ctx.stroke();
  } else if (icon === 'close') {
    ctx.beginPath(); ctx.moveTo(-14, -14); ctx.lineTo(14, 14); ctx.moveTo(14, -14); ctx.lineTo(-14, 14);
    ctx.lineWidth = 14; ctx.strokeStyle = INK; ctx.stroke();
    ctx.lineWidth = 7; ctx.strokeStyle = '#ffffff'; ctx.stroke();
  } else if (icon === 'star') {
    starPath(ctx, 0, 0, 24, 11); ctx.fillStyle = '#ffe14d'; ctx.fill(); ctx.stroke();
  } else if (icon === 'pause') {
    rr(ctx, -16, -18, 11, 36, 4); ctx.fill(); ctx.stroke();
    rr(ctx, 5, -18, 11, 36, 4); ctx.fill(); ctx.stroke();
  } else if (icon === 'eye') {
    ctx.beginPath(); ctx.moveTo(-24, 0); ctx.quadraticCurveTo(0, -24, 24, 0); ctx.quadraticCurveTo(0, 24, -24, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    circle(ctx, 0, 0, 9); ctx.fillStyle = '#3b8fe8'; ctx.fill(); ctx.stroke();
    circle(ctx, 0, 0, 4); ctx.fillStyle = INK; ctx.fill();
  } else if (icon === 'gear') {
    ctx.beginPath();
    for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2, r = i % 2 ? 16 : 23; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    circle(ctx, 0, 0, 7); ctx.fillStyle = '#9b5de5'; ctx.fill(); ctx.stroke();
  } else if (icon === 'car') {
    rr(ctx, -24, -6, 48, 16, 6); ctx.fill(); ctx.stroke();
    rr(ctx, -12, -18, 22, 14, 6); ctx.fill(); ctx.stroke();
    for (const x of [-13, 13]) { circle(ctx, x, 12, 7); ctx.fillStyle = INK; ctx.fill(); circle(ctx, x, 12, 3); ctx.fillStyle = '#ffcc1a'; ctx.fill(); }
  } else if (icon === 'trophy') {
    ctx.beginPath(); ctx.moveTo(-16, -20); ctx.lineTo(16, -20); ctx.lineTo(14, -2); ctx.quadraticCurveTo(0, 12, -14, -2); ctx.closePath(); ctx.fillStyle = '#ffe14d'; ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(-17, -10, 7, Math.PI * 0.5, Math.PI * 1.5); ctx.moveTo(17, -17); ctx.arc(17, -10, 7, -Math.PI * 0.5, Math.PI * 0.5); ctx.lineWidth = 4; ctx.stroke();
    rr(ctx, -4, 4, 8, 10, 2); ctx.fillStyle = '#ffe14d'; ctx.fill(); ctx.stroke();
    rr(ctx, -13, 13, 26, 8, 3); ctx.fill(); ctx.stroke();
  } else if (icon === 'map') {
    ctx.beginPath(); ctx.moveTo(-22, -16); ctx.lineTo(-8, -20); ctx.lineTo(8, -16); ctx.lineTo(22, -20); ctx.lineTo(22, 16); ctx.lineTo(8, 20); ctx.lineTo(-8, 16); ctx.lineTo(-22, 20); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-8, -20); ctx.lineTo(-8, 16); ctx.moveTo(8, -16); ctx.lineTo(8, 20); ctx.lineWidth = 3; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-15, 8); ctx.lineTo(0, -2); ctx.lineTo(14, -8); ctx.setLineDash([3, 4]); ctx.strokeStyle = '#e8443a'; ctx.stroke(); ctx.setLineDash([]);
  } else if (icon === 'music') {
    ctx.beginPath(); ctx.moveTo(-6, 12); ctx.lineTo(-6, -18); ctx.lineTo(18, -22); ctx.lineTo(18, 8); ctx.lineWidth = 6; ctx.strokeStyle = INK; ctx.stroke();
    ctx.lineWidth = 3; ctx.strokeStyle = '#ffffff'; ctx.stroke();
    ctx.lineWidth = 4; ctx.strokeStyle = INK;
    ellipse(ctx, -12, 13, 8, 6, -0.4); ctx.fill(); ctx.stroke();
    ellipse(ctx, 12, 9, 8, 6, -0.4); ctx.fill(); ctx.stroke();
  } else if (icon === 'turtle') {
    ellipse(ctx, 0, 2, 20, 13); ctx.fillStyle = '#5cc95a'; ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-10, 2); ctx.lineTo(0, -6); ctx.lineTo(10, 2); ctx.lineTo(0, 10); ctx.closePath(); ctx.lineWidth = 3; ctx.stroke();
    circle(ctx, 22, -2, 6); ctx.fillStyle = '#9be27a'; ctx.fill(); ctx.lineWidth = 4; ctx.stroke();
    for (const x of [-12, 10]) { rr(ctx, x - 3, 12, 6, 7, 2); ctx.fillStyle = '#9be27a'; ctx.fill(); ctx.stroke(); }
  } else if (icon === 'infinity') {
    ctx.beginPath();
    for (let i = 0; i <= 40; i++) { const a = (i / 40) * Math.PI * 2, d = 1 + Math.sin(a) ** 2; ctx.lineTo((20 * Math.cos(a)) / d, (20 * Math.sin(a) * Math.cos(a)) / d); }
    ctx.lineWidth = 12; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 6; ctx.strokeStyle = '#ffffff'; ctx.stroke();
  } else if (icon === 'sparkle') {
    starPath(ctx, -4, 2, 20, 6, 4, 0); ctx.fill(); ctx.stroke();
    starPath(ctx, 14, -14, 9, 3, 4, 0); ctx.fillStyle = '#ffe14d'; ctx.fill(); ctx.lineWidth = 3; ctx.stroke();
  } else if (icon === 'trash') {
    rr(ctx, -14, -12, 28, 32, 4); ctx.fill(); ctx.stroke();
    rr(ctx, -19, -19, 38, 8, 3); ctx.fill(); ctx.stroke();
    ctx.beginPath(); for (const x of [-6, 0, 6]) { ctx.moveTo(x, -6); ctx.lineTo(x, 14); } ctx.lineWidth = 3; ctx.stroke();
  } else if (icon === 'check') {
    ctx.beginPath(); ctx.moveTo(-18, 0); ctx.lineTo(-5, 14); ctx.lineTo(20, -14);
    ctx.lineWidth = 16; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 8; ctx.strokeStyle = '#ffffff'; ctx.stroke();
  } else if (icon === 'ball') {
    circle(ctx, 0, 0, 22); ctx.fill(); ctx.stroke();
    ctx.save(); circle(ctx, 0, 0, 22); ctx.clip();
    ctx.fillStyle = '#e8443a'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 24, -1.6, -0.6); ctx.fill();
    ctx.fillStyle = '#3b8fe8'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 24, 0.5, 1.5); ctx.fill();
    ctx.fillStyle = '#ffe14d'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 24, 2.6, 3.6); ctx.fill();
    ctx.restore(); circle(ctx, 0, 0, 22); ctx.stroke();
  } else if (icon === 'back' || icon === 'left' || icon === 'right') {
    ctx.save(); if (icon === 'right') ctx.scale(-1, 1);
    ctx.beginPath(); ctx.moveTo(-20, 0); ctx.lineTo(2, -20); ctx.lineTo(2, -8); ctx.lineTo(20, -8); ctx.lineTo(20, 8); ctx.lineTo(2, 8); ctx.lineTo(2, 20); ctx.closePath();
    ctx.fill(); ctx.stroke(); ctx.restore();
  } else if (icon === 'bug') {
    ellipse(ctx, 0, 4, 13, 17); ctx.fill(); ctx.stroke();
    circle(ctx, 0, -15, 8); ctx.fill(); ctx.stroke();
    ctx.beginPath(); for (const y of [-2, 6, 14]) { ctx.moveTo(-13, y); ctx.lineTo(-22, y - 4); ctx.moveTo(13, y); ctx.lineTo(22, y - 4); } ctx.stroke();
  } else if (icon === 'flag') {
    ctx.beginPath(); ctx.moveTo(-14, 22); ctx.lineTo(-14, -22); ctx.lineWidth = 6; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-12, -20); ctx.lineTo(20, -12); ctx.lineTo(-12, -2); ctx.closePath(); ctx.fillStyle = '#e8443a'; ctx.lineWidth = 4; ctx.fill(); ctx.stroke();
  } else if (icon === 'turbo') {
    ctx.beginPath(); ctx.moveTo(6, -24); ctx.lineTo(-14, 4); ctx.lineTo(0, 4); ctx.lineTo(-6, 24); ctx.lineTo(16, -6); ctx.lineTo(2, -6); ctx.closePath();
    ctx.fillStyle = '#ffe14d'; ctx.fill(); ctx.stroke();
  } else if (icon === 'springs') {
    ctx.beginPath(); ctx.moveTo(-14, 20);
    for (let i = 0; i < 6; i++) ctx.lineTo(i % 2 ? -14 : 14, 14 - i * 6);
    ctx.lineTo(0, -18); ctx.lineWidth = 9; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 4; ctx.strokeStyle = '#ffffff'; ctx.stroke();
    rr(ctx, -18, -24, 36, 8, 3); ctx.fillStyle = '#e8443a'; ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.fill(); ctx.stroke();
  } else if (icon === 'wings') {
    for (const sx of [-1, 1]) {
      ctx.save(); ctx.scale(sx, 1);
      ctx.beginPath(); ctx.moveTo(2, 4); ctx.quadraticCurveTo(14, -24, 28, -18); ctx.quadraticCurveTo(22, -4, 26, 0); ctx.quadraticCurveTo(16, 8, 2, 8); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
  } else if (icon === 'bumper') {
    rr(ctx, -24, -10, 48, 20, 9); ctx.fillStyle = '#c3cad8'; ctx.fill(); ctx.stroke();
    for (const x of [-12, 0, 12]) { rr(ctx, x - 3, -6, 6, 12, 2); ctx.fillStyle = '#ffe14d'; ctx.fill(); }
  } else if (icon === 'kart' || icon === 'board' || icon === 'cart') {
    if (icon === 'kart') { rr(ctx, -24, -6, 48, 16, 6); ctx.fill(); ctx.stroke(); rr(ctx, -18, -14, 10, 10, 3); ctx.fill(); ctx.stroke(); }
    if (icon === 'board') { rr(ctx, -26, 0, 52, 8, 4); ctx.fillStyle = '#ffcc1a'; ctx.fill(); ctx.stroke(); }
    if (icon === 'cart') { rr(ctx, -22, -14, 44, 24, 4); ctx.fillStyle = '#c98a50'; ctx.fill(); ctx.stroke(); }
    const r = icon === 'board' ? 5 : icon === 'cart' ? 9 : 7, y = icon === 'board' ? 12 : 12;
    for (const x of [-14, 14]) { circle(ctx, x, y, r); ctx.fillStyle = INK; ctx.fill(); circle(ctx, x, y, r * 0.45); ctx.fillStyle = '#ffcc1a'; ctx.fill(); }
  } else if (icon === 'panda' || icon === 'dino' || icon === 'chicken') {
    const skin = icon === 'dino' ? '#5cc95a' : '#ffffff';
    if (icon === 'panda') for (const x of [-15, 15]) { circle(ctx, x, -16, 8); ctx.fillStyle = INK; ctx.fill(); }
    if (icon === 'chicken') for (const x of [-7, 0, 7]) { circle(ctx, x, -21 - (x === 0 ? 3 : 0), 6); ctx.fillStyle = '#e8443a'; ctx.fill(); ctx.stroke(); }
    if (icon === 'dino') for (const x of [-12, 0, 12]) { ctx.beginPath(); ctx.moveTo(x - 5, -18); ctx.lineTo(x, -28); ctx.lineTo(x + 5, -18); ctx.fillStyle = '#ff9a3d'; ctx.fill(); ctx.stroke(); }
    circle(ctx, 0, 0, 21); ctx.fillStyle = skin; ctx.fill(); ctx.stroke();
    for (const x of [-8, 8]) {
      if (icon === 'panda') { ellipse(ctx, x, -2, 6, 8); ctx.fillStyle = INK; ctx.fill(); }
      circle(ctx, x, -3, 3.5); ctx.fillStyle = icon === 'panda' ? '#ffffff' : INK; ctx.fill();
    }
    if (icon === 'chicken') { ctx.beginPath(); ctx.moveTo(-6, 5); ctx.lineTo(0, 15); ctx.lineTo(6, 5); ctx.closePath(); ctx.fillStyle = '#ffb81a'; ctx.fill(); ctx.stroke(); }
    else { ctx.beginPath(); ctx.arc(0, 6, 7, 0.2, Math.PI - 0.2); ctx.lineWidth = 3; ctx.stroke(); }
  } else if (icon === 'wrench') {
    ctx.save(); ctx.rotate(-0.8);
    rr(ctx, -5, -6, 10, 34, 4); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, -14, 13, 0.35 * Math.PI + Math.PI, -0.35 * Math.PI + Math.PI * 3); ctx.fill(); ctx.stroke();
    rr(ctx, -5, -30, 10, 12, 2); ctx.fillStyle = '#9a96a6'; ctx.fill();
    ctx.restore();
  } else if (icon === 'hammer') {
    ctx.save(); ctx.rotate(-0.7);
    rr(ctx, -4, -6, 8, 34, 3); ctx.fillStyle = '#c98a50'; ctx.fill(); ctx.stroke();
    rr(ctx, -18, -22, 36, 16, 4); ctx.fillStyle = '#c3cad8'; ctx.fill(); ctx.stroke();
    ctx.restore();
  } else if (icon === 'share') {
    rr(ctx, -18, -4, 36, 26, 5); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-6, -12); ctx.lineTo(0, -22); ctx.lineTo(6, -12); ctx.moveTo(0, -22); ctx.lineTo(0, 8);
    ctx.lineWidth = 9; ctx.stroke(); ctx.lineWidth = 4; ctx.strokeStyle = '#ffffff'; ctx.stroke();
  } else if (icon === 'plus') {
    ctx.beginPath(); ctx.moveTo(-18, 0); ctx.lineTo(18, 0); ctx.moveTo(0, -18); ctx.lineTo(0, 18);
    ctx.lineWidth = 15; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 8; ctx.strokeStyle = '#ffffff'; ctx.stroke();
  } else if (icon === 'pencil') {
    ctx.save(); ctx.rotate(0.8);
    rr(ctx, -6, -24, 12, 38, 3); ctx.fillStyle = '#ffcc1a'; ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-6, 14); ctx.lineTo(0, 26); ctx.lineTo(6, 14); ctx.closePath(); ctx.fillStyle = '#ffe0c2'; ctx.fill(); ctx.stroke();
    ctx.restore();
  } else if (icon === 'import') {
    rr(ctx, -20, -22, 40, 44, 6); ctx.fill(); ctx.stroke();
    ctx.font = `900 13px ${'Arial'}`; ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('ABC', 0, -8);
    ctx.beginPath(); ctx.moveTo(-8, 6); ctx.lineTo(0, 15); ctx.lineTo(8, 6); ctx.lineWidth = 4; ctx.stroke();
  } else if (icon === 'deck' || icon === 'ice') {
    ctx.beginPath(); ctx.moveTo(-22, -4); ctx.lineTo(0, -16); ctx.lineTo(22, -4); ctx.lineTo(0, 8); ctx.closePath(); ctx.fillStyle = icon === 'ice' ? '#e6fbff' : '#86dc5e'; ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-22, -4); ctx.lineTo(-22, 6); ctx.lineTo(0, 18); ctx.lineTo(22, 6); ctx.lineTo(22, -4); ctx.lineTo(0, 8); ctx.closePath(); ctx.fillStyle = '#a0703f'; ctx.fill(); ctx.stroke();
  } else if (icon === 'up' || icon === 'down') {
    ctx.save(); if (icon === 'down') ctx.scale(1, -1);
    ctx.beginPath(); ctx.moveTo(0, -22); ctx.lineTo(18, 0); ctx.lineTo(7, 0); ctx.lineTo(7, 20); ctx.lineTo(-7, 20); ctx.lineTo(-7, 0); ctx.lineTo(-18, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  } else if (icon === 'ramp') {
    ctx.beginPath(); ctx.moveTo(-24, 14); ctx.lineTo(22, 14); ctx.lineTo(22, -16); ctx.closePath(); ctx.fillStyle = '#ffcc1a'; ctx.fill(); ctx.stroke();
  } else if (icon === 'jelly') {
    ctx.beginPath(); ctx.moveTo(-22, 14); ctx.quadraticCurveTo(-24, -14, 0, -14); ctx.quadraticCurveTo(24, -14, 22, 14); ctx.closePath(); ctx.fillStyle = '#ff8ad6'; ctx.fill(); ctx.stroke();
    circle(ctx, -8, -4, 4); ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fill();
  } else if (icon === 'start') {
    ctx.beginPath(); ctx.moveTo(-10, 22); ctx.lineTo(-10, -22); ctx.lineWidth = 6; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-8, -20); ctx.lineTo(20, -12); ctx.lineTo(-8, -2); ctx.closePath(); ctx.fillStyle = '#5cc95a'; ctx.lineWidth = 4; ctx.fill(); ctx.stroke();
  } else if (icon === 'finish') {
    ctx.beginPath(); ctx.moveTo(-14, 22); ctx.lineTo(-14, -22); ctx.lineWidth = 6; ctx.stroke();
    ctx.save(); rr(ctx, -12, -22, 32, 20, 2); ctx.clip();
    for (let y = 0; y < 4; y++) for (let x = 0; x < 6; x++) { ctx.fillStyle = (x + y) % 2 ? INK : '#ffffff'; ctx.fillRect(-12 + x * 6, -22 + y * 5, 6, 5); }
    ctx.restore(); rr(ctx, -12, -22, 32, 20, 2); ctx.lineWidth = 4; ctx.stroke();
  } else if (icon === 'trampoline') {
    ellipse(ctx, 0, 0, 24, 9); ctx.fillStyle = '#3b8fe8'; ctx.fill(); ctx.stroke();
    ellipse(ctx, 0, 0, 16, 5); ctx.fillStyle = INK; ctx.fill();
    for (const x of [-16, 16]) { ctx.beginPath(); ctx.moveTo(x, 5); ctx.lineTo(x, 18); ctx.stroke(); }
  } else if (icon === 'boost') {
    rr(ctx, -20, -20, 40, 40, 6); ctx.fillStyle = '#2fd2ff'; ctx.fill(); ctx.stroke();
    ctx.beginPath(); for (const y of [4, 16]) { ctx.moveTo(-12, y); ctx.lineTo(0, y - 12); ctx.lineTo(12, y); } ctx.lineWidth = 5; ctx.strokeStyle = '#ffffff'; ctx.stroke();
  } else if (icon === 'cannon') {
    circle(ctx, -6, 12, 9); ctx.fillStyle = '#8a5a2b'; ctx.fill(); ctx.stroke();
    ctx.save(); ctx.rotate(-0.6); rr(ctx, -12, -10, 40, 18, 8); ctx.fillStyle = '#3a3a4a'; ctx.fill(); ctx.stroke(); ctx.restore();
  } else if (icon === 'blocks') {
    for (const [x, y, c] of [[-12, 8, '#e8443a'], [12, 8, '#3b8fe8'], [0, -12, '#f7d43c']]) { rr(ctx, x - 10, y - 10, 20, 20, 4); ctx.fillStyle = c; ctx.fill(); ctx.stroke(); }
  } else if (icon === 'crate') {
    rr(ctx, -18, -18, 36, 36, 4); ctx.fillStyle = '#d9ad74'; ctx.fill(); ctx.stroke();
    rr(ctx, -5, -18, 10, 36, 1); ctx.fillStyle = '#c9a06a'; ctx.fill();
  } else if (icon === 'coin') {
    circle(ctx, 0, 0, 20); ctx.fillStyle = '#ffcc1a'; ctx.fill(); ctx.stroke();
    starPath(ctx, 0, 0, 10, 5); ctx.fillStyle = '#fff3a0'; ctx.fill();
  } else if (icon === 'eraser') {
    ctx.save(); ctx.rotate(-0.6); rr(ctx, -22, -11, 44, 22, 5); ctx.fillStyle = '#ff8ab0'; ctx.fill(); ctx.stroke();
    rr(ctx, 4, -11, 18, 22, 5); ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.stroke(); ctx.restore();
  } else if (icon === 'turn') {
    ctx.beginPath(); ctx.arc(0, 0, 16, Math.PI * 0.9, Math.PI * 2.2); ctx.lineWidth = 12; ctx.strokeStyle = INK; ctx.stroke();
    ctx.lineWidth = 6; ctx.strokeStyle = '#ffffff'; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(20, 2); ctx.lineTo(10, 14); ctx.lineTo(24, 16); ctx.closePath(); ctx.fillStyle = '#fff'; ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.fill(); ctx.stroke();
  } else if (icon === 'world') {
    circle(ctx, 0, 0, 20); ctx.fillStyle = '#5fbfff'; ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-14, -6); ctx.quadraticCurveTo(-4, -16, 4, -6); ctx.quadraticCurveTo(10, 4, -2, 8); ctx.closePath(); ctx.fillStyle = '#5cc95a'; ctx.fill();
    } else if (icon === 'reset') {
    ctx.beginPath(); ctx.arc(0, 0, 16, 0.3, Math.PI * 1.75); ctx.lineWidth = 12; ctx.strokeStyle = INK; ctx.stroke();
    ctx.lineWidth = 6; ctx.strokeStyle = '#ffffff'; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(18, -16); ctx.lineTo(18, 2); ctx.lineTo(2, -6); ctx.closePath(); ctx.fillStyle = '#fff'; ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.fill(); ctx.stroke();
  }
  ctx.restore();
}

// Place standard top-right buttons respecting the notch / safe area.
export function layoutTopRight(buttons) {
  let x = V.w - V.safeR - 20 - (buttons[0] ? buttons[0].r : 40);
  for (const b of buttons) { b.x = x; x -= b.r * 2 + 20; }
  for (const b of buttons) b.y = 20 + b.r + V.safeT;
}

export function drawStarIcon(ctx, x, y, r, filled, t = 0) {
  starPath(ctx, x, y, r, r * 0.48);
  fs(ctx, filled ? '#ffe14d' : 'rgba(255,255,255,0.35)', Math.max(3, r * 0.12));
  if (filled) {
    ctx.beginPath(); ctx.arc(x - r * 0.15, y - r * 0.1, r * 0.25, Math.PI, Math.PI * 1.5); ctx.lineWidth = r * 0.1; ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.stroke();
  }
}

// Update button, top-left. Only visible when a new version has been downloaded.
export function updateButton() {
  const b = new Button('update', '#5cc95a', 36);
  b.pulse = true;
  return b;
}
export function layoutTopLeft(b) {
  b.x = V.safeL + 20 + b.r;
  b.y = 20 + b.r + V.safeT;
}

// Tap on the update button: spin and sparkle for a moment, then reload into the new version.
export function tapUpdate(btn, fx) {
  if (btn.spinning) return;
  btn.spinning = true; btn.pulse = false;
  sfx('ready');
  fx.burst(btn.x, btn.y, 16);
  fx.confetti(btn.x, btn.y, 30);
  setTimeout(() => pwa.apply(), 800);
}
