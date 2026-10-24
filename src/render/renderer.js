// The WebGL renderer behind the 2D UI canvas. Owns quality settings, adaptive resolution
// and recovery from a lost graphics context (iOS drops it when memory runs low or the
// app sits in the background for a long time).
import * as THREE from 'three';

export const QUALITY = {
  low: { maxDpr: 1, shadows: false, shadowSize: 0, decor: 0.4, outlines: false, minDpr: 0.6 },
  medium: { maxDpr: 1.5, shadows: true, shadowSize: 1024, decor: 0.75, outlines: true, minDpr: 0.75 },
  high: { maxDpr: 2, shadows: true, shadowSize: 2048, decor: 1, outlines: true, minDpr: 1 },
};

export class Renderer3D {
  constructor(canvas) {
    this.canvas = canvas;
    this.lost = false;
    this.mode = 'auto';
    this.q = QUALITY.medium;
    this.dpr = 1;
    this.frameTimes = [];
    this.onRestored = [];
    this.create();
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.lost = true; }, false);
    canvas.addEventListener('webglcontextrestored', () => {
      this.lost = false;
      // Three re-initialises its GL state; force every texture and material to upload again.
      this.renderer.info.reset();
      for (const f of this.onRestored) f();
    }, false);
  }

  create() {
    const r = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance', alpha: false });
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;
    r.shadowMap.type = THREE.PCFShadowMap;
    this.renderer = r;
  }

  // 'auto' starts on medium on phones and high on big screens, then adapts to the frame rate.
  setQuality(mode) {
    this.mode = mode;
    const phone = Math.min(window.innerWidth, window.innerHeight) < 500;
    const key = mode === 'auto' ? (phone ? 'medium' : 'high') : mode;
    this.q = QUALITY[key] || QUALITY.medium;
    this.qKey = key;
    this.renderer.shadowMap.enabled = this.q.shadows;
    this.dpr = Math.min(window.devicePixelRatio || 1, this.q.maxDpr);
    this.resize();
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width) || window.innerWidth), h = Math.max(1, Math.round(r.height) || window.innerHeight);
    this.w = w; this.h = h;
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.setSize(w, h, false);
  }

  get aspect() { return (this.w || 1) / (this.h || 1); }

  // Adaptive resolution: drop the pixel ratio when frames are slow, raise it back when fast.
  adapt(dt) {
    if (this.mode !== 'auto') return;
    this.frameTimes.push(dt);
    if (this.frameTimes.length < 90) return;
    const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    this.frameTimes.length = 0;
    const max = Math.min(window.devicePixelRatio || 1, this.q.maxDpr);
    let d = this.dpr;
    if (avg > 1 / 40) d = Math.max(this.q.minDpr * 0.8, d - 0.25);
    else if (avg < 1 / 57 && d < max) d = Math.min(max, d + 0.125);
    if (d !== this.dpr) { this.dpr = d; this.resize(); }
    // Very slow even at low resolution: turn shadows off.
    if (avg > 1 / 25 && this.renderer.shadowMap.enabled && d <= this.q.minDpr * 0.8) {
      this.renderer.shadowMap.enabled = false;
      this.forceMaterialUpdate = true;
    }
  }

  render(stage) {
    if (this.lost || !stage) return;
    if (this.forceMaterialUpdate) {
      stage.scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { m.needsUpdate = true; }); });
      this.forceMaterialUpdate = false;
    }
    this.renderer.render(stage.scene, stage.camera);
  }

  // Simulate a lost context (developer panel) to test recovery.
  loseContext() {
    const ext = this.renderer.getContext().getExtension('WEBGL_lose_context');
    if (!ext) return;
    ext.loseContext();
    setTimeout(() => ext.restoreContext(), 1000);
  }
}
