// Sharing home-made cars and levels without a server: everything travels in a short code.
// A share is a link (game URL + #code) through the share sheet, or the code on the clipboard.
// Opening such a link, or pasting the code, adds the car or level to this device.
import { V } from './core.js';
import { rr, fs, FONT, INK } from './draw.js';

export function shareUrl(code) { return location.origin + location.pathname + '#' + code; }

// Returns 'shared', 'copied' or 'shown'.
export async function shareCode(code, kind) {
  const url = shareUrl(code);
  try {
    if (navigator.share) { await navigator.share({ title: `Turbo Tumble ${kind}`, text: `My Turbo Tumble Racers ${kind}! Open the link, or paste this code in the game: ${code}`, url }); return 'shared'; }
  } catch (e) { if (e && e.name === 'AbortError') return 'shared'; }
  try { await navigator.clipboard.writeText(url); return 'copied'; } catch (e) { /* fall through */ }
  window.prompt('Copy this code:', code);
  return 'shown';
}

// Ask for a pasted code (or a whole shared link) and return just the code part.
export function askCode(msg) {
  const s = window.prompt(msg, '');
  if (!s) return null;
  const m = s.match(/TT[CL]1[A-Za-z0-9_-]+/);
  return m ? m[0] : s.trim();
}

// A code in the address bar (someone opened a shared link). Read once, then removed.
export function takeLinkCode() {
  const m = location.hash.match(/TT[CL]1[A-Za-z0-9_-]+/);
  if (!m) return null;
  try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* ignore */ }
  return m[0];
}

// Short message at the bottom of the screen (for grown-ups: share and import results).
export class Toast {
  constructor() { this.t = 0; this.msg = ''; }
  show(msg, color = '#3b8fe8') { this.msg = msg; this.color = color; this.t = 2.6; }
  update(dt) { this.t = Math.max(0, this.t - dt); }
  draw(ctx) {
    if (this.t <= 0) return;
    ctx.save();
    ctx.globalAlpha = Math.min(1, this.t * 3);
    ctx.font = `800 ${24 * Math.min(V.ui, 1.2)}px ${FONT}`;
    const w = ctx.measureText(this.msg).width + 50, h = 56, x = V.w / 2 - w / 2, y = V.h - V.safeB - 190;
    rr(ctx, x, y, w, h, 28); fs(ctx, this.color, 5);
    ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 6; ctx.strokeStyle = INK; ctx.lineJoin = 'round';
    ctx.strokeText(this.msg, V.w / 2, y + h / 2 + 1); ctx.fillText(this.msg, V.w / 2, y + h / 2 + 1);
    ctx.restore();
  }
}
