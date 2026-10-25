// Main menu: logo, 3D vehicle on a turntable, Play plus Playground, Challenge, Vehicles and Settings.
import { V } from '../core.js';
import { INK, label, coinIcon } from '../draw.js';
import { Button, layoutTopRight, updateButton, layoutTopLeft, tapUpdate, drawStarIcon } from '../ui.js';
import { playMusic, toggleMute, sfx } from '../audio.js';
import { Particles } from '../particles.js';
import { pwa } from '../pwa.js';
import { InfoPanel } from '../info.js';
import { Gift } from '../celebrate.js';
import { MenuStage } from '../render/menuStage.js';
import { save, persist, totalStars } from '../storage.js';
import { playerVehicle } from '../game/garage.js';
import { goWorlds, goGarage, goSettings, goWorkshop, startLevel, preloadPlay } from './nav.js';
import { takeLinkCode, Toast } from '../share.js';
import { decodeCar } from '../game/garage.js';
import { decodeLevel, MAX_CUSTOM_LEVELS } from '../game/custom.js';

// Someone opened a shared link: add the car or level it carries to this device.
function importFromLink() {
  const code = takeLinkCode();
  if (!code) return null;
  const car = decodeCar(code);
  if (car) { car.id = Date.now().toString(36); save.customCars.push(car); save.vehicle = 'custom:' + car.id; persist(); return 'New car in the garage!'; }
  const lvl = decodeLevel(code);
  if (lvl && save.customLevels.length < MAX_CUSTOM_LEVELS) { save.customLevels.push(lvl); persist(); return 'New level in My levels!'; }
  return null;
}

export const GAME_TITLE = ['TURBO TUMBLE', 'RACERS'];

// The 3D stage is shared by menu scenes so switching screens doesn't rebuild it.
let sharedStage = null;
export function menuStage(game) {
  if (!sharedStage) sharedStage = new MenuStage(game.r3d.q);
  const { base, paint } = playerVehicle(save);
  const key = [base.id, paint, base.body, base.driver, base.skin].join('|');
  if (sharedStage.key !== key) {
    sharedStage.setVehicle(base, paint);
    sharedStage.key = key;
  }
  return sharedStage;
}
export function resetMenuStage() { sharedStage = null; }
// Show a car that isn't saved yet (car builder); the next menuStage() call restores the player's.
export function previewOnStage(game, def, paint) {
  const st = menuStage(game);
  st.setVehicle(def, paint);
  st.key = null;
  return st;
}

export class TitleScene {
  constructor(game) {
    this.game = game;
    this.t = 0;
    this.play = new Button('play', '#5cc95a', 78);
    this.play.pulse = true;
    this.btnPlayground = new Button('ball', '#f5962a', 40); this.btnPlayground.caption = 'Playground';
    this.btnChallenge = new Button('trophy', '#e8443a', 40); this.btnChallenge.caption = 'Challenge';
    this.btnGarage = new Button('car', '#3b8fe8', 40); this.btnGarage.caption = 'Vehicles';
    this.btnSettings = new Button('gear', '#9b5de5', 40); this.btnSettings.caption = 'Settings';
    this.btnBuild = new Button('hammer', '#f7a83c', 40); this.btnBuild.caption = 'Build';
    this.row = [this.btnPlayground, this.btnChallenge, this.btnGarage, this.btnBuild, this.btnSettings];
    this.toast = new Toast();
    const imported = importFromLink();
    if (imported) setTimeout(() => { this.toast.show(imported, '#5cc95a'); }, 600);
    this.sound = new Button('sound', '#3b8fe8', 34);
    this.infoBtn = new Button('info', '#9b5de5', 34);
    this.info = new InfoPanel();
    this.updBtn = updateButton();
    this.fx = new Particles();
    this.gift = pwa.justUpdated ? new Gift() : null;
    pwa.justUpdated = false;
    this.stage = menuStage(game);
    this.onResize();
  }
  onResize() {
    const land = !V.portrait;
    if (land) {
      this.play.x = V.w * 0.72; this.play.y = 400;
      this.logoY = 118; this.logoX = V.w / 2;
      this.stagePos = [0.36, 0.56];
    } else {
      this.play.x = V.w / 2; this.play.y = V.h * 0.66;
      this.logoY = V.h * 0.17; this.logoX = V.w / 2;
      this.stagePos = [0.5, 0.42];
    }
    const n = this.row.length, gap = Math.min(170 * V.ui, (V.w - V.safeL - V.safeR - 80) / n);
    const y = V.h - V.safeB - 92 * V.ui;
    this.row.forEach((b, i) => { b.x = V.w / 2 + (i - (n - 1) / 2) * gap; b.y = y; });
    layoutTopLeft(this.updBtn);
    layoutTopRight([this.sound, this.infoBtn]);
    this.stage.setAspect(this.game.r3d.aspect, ...this.stagePos);
  }
  enter() { playMusic('menu'); preloadPlay(); }
  onDown(p) {
    if (this.info.onDown(p, this.fx)) return;
    if (this.gift && !this.gift.done) { this.gift.onDown(p); return; }
    this.updBtn.visible = pwa.ready;
    if (this.updBtn.hit(p)) { tapUpdate(this.updBtn, this.fx); return; }
    if (this.infoBtn.hit(p)) { this.info.show(); return; }
    if (this.sound.hit(p)) { toggleMute(); sfx('tap'); return; }
    if (this.play.hit(p)) { sfx('pop'); goWorlds(this.game, 'adventure'); return; }
    if (this.btnPlayground.hit(p)) { sfx('pop'); startLevel(this.game, 'playground', 'playground'); return; }
    if (this.btnChallenge.hit(p)) { sfx('pop'); goWorlds(this.game, 'challenge'); return; }
    if (this.btnGarage.hit(p)) { sfx('pop'); goGarage(this.game); return; }
    if (this.btnSettings.hit(p)) { sfx('pop'); goSettings(this.game); return; }
    if (this.btnBuild.hit(p)) { sfx('pop'); goWorkshop(this.game); return; }
    this.fx.burst(p.x, p.y, 8);
    sfx('tap');
  }
  update(dt) {
    this.t += dt;
    this.fx.update(dt); this.info.update(dt); this.toast.update(dt);
    if (this.gift) this.gift.update(dt);
    this.stage.update(dt, this.game.r3d.w, this.game.r3d.h);
  }
  draw(ctx) {
    const t = this.t;
    // Wobbly multicolour logo, two lines.
    const colors = ['#e8443a', '#f5962a', '#f7d43c', '#5cc95a', '#3b8fe8', '#9b5de5', '#f06fb0'];
    const big = Math.min(92, (V.w - 60) / 8.5);
    GAME_TITLE.forEach((line, li) => {
      const size = li === 0 ? big : big * 0.8;
      ctx.save();
      ctx.translate(this.logoX, this.logoY + li * big * 0.98 + Math.sin(t * 1.5) * 5);
      ctx.rotate(-0.03 + li * 0.04);
      ctx.font = `900 ${size}px "Arial Rounded MT Bold", "Trebuchet MS", Arial, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      let x = -ctx.measureText(line).width / 2;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i], cw = ctx.measureText(ch).width, y = Math.sin(t * 4 + i * 0.6 + li) * 5;
        ctx.lineWidth = size * 0.2; ctx.strokeStyle = INK; ctx.lineJoin = 'round';
        ctx.strokeText(ch, x + cw / 2, y + 5);
        ctx.strokeText(ch, x + cw / 2, y);
        ctx.fillStyle = colors[(i + li * 3) % colors.length]; ctx.fillText(ch, x + cw / 2, y);
        x += cw;
      }
      ctx.restore();
    });
    // Totals: stars and coins
    const bx = V.safeL + 34, by = V.safeT + (pwa.ready ? 130 : 44);
    drawStarIcon(ctx, bx, by, 20, true);
    label(ctx, String(totalStars()), bx + 30, by + 2, 28, '#ffffff', 'left');
    coinIcon(ctx, bx, by + 50, 17);
    label(ctx, String(save.coins), bx + 30, by + 52, 28, '#ffe14d', 'left');

    this.play.draw(ctx, t);
    for (const b of this.row) b.draw(ctx, t);
    this.updBtn.visible = pwa.ready || this.updBtn.spinning;
    this.updBtn.draw(ctx, t);
    this.sound.draw(ctx, t);
    this.infoBtn.draw(ctx, t);
    this.info.draw(ctx, t);
    this.toast.draw(ctx, t);
    this.fx.draw(ctx);
    if (this.gift) this.gift.draw(ctx, t);
  }
}
