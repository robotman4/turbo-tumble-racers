// Pooled 3D particles: dust, sparks, splashes, confetti and debris. Two instanced meshes
// (round puffs and flat chips) with a fixed number of slots, so effects never allocate.
import * as THREE from 'three';
import { R } from '../core.js';
import { toy, roundBox, sphere } from './materials.js';

const CONFETTI = ['#e8443a', '#f7d43c', '#5cc95a', '#3b8fe8', '#f06fb0', '#9b5de5', '#ffffff'];
const dummy = new THREE.Object3D();
const col = new THREE.Color();

class Pool {
  constructor(geometry, material, n) {
    this.mesh = new THREE.InstancedMesh(geometry, material, n);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    this.n = n;
    this.list = [];
    this.free = [];
    for (let i = n - 1; i >= 0; i--) this.free.push(i);
    dummy.scale.setScalar(0); dummy.updateMatrix();
    for (let i = 0; i < n; i++) { this.mesh.setMatrixAt(i, dummy.matrix); this.mesh.setColorAt(i, col.set('#ffffff')); }
  }
  spawn(o) {
    let slot = this.free.pop();
    if (slot === undefined) { const old = this.list.shift(); slot = old.slot; }
    const p = { slot, x: o.p[0], y: o.p[1], z: o.p[2], vx: o.v?.[0] || 0, vy: o.v?.[1] || 0, vz: o.v?.[2] || 0,
      life: o.life || 1, age: 0, size: o.size || 0.3, grow: o.grow || 0, g: o.g ?? -12, drag: o.drag ?? 1, floor: o.floor ?? -1e9,
      rx: R() * 6, ry: R() * 6, spin: o.spin ?? 0, shrink: o.shrink ?? true, sy: o.sy || 1 };
    this.mesh.setColorAt(slot, col.set(o.c || '#ffffff'));
    this.mesh.instanceColor.needsUpdate = true;
    this.list.push(p);
  }
  update(dt) {
    const keep = [];
    for (const p of this.list) {
      p.age += dt;
      if (p.age >= p.life) { dummy.scale.setScalar(0); dummy.position.set(0, -999, 0); dummy.updateMatrix(); this.mesh.setMatrixAt(p.slot, dummy.matrix); this.free.push(p.slot); continue; }
      const d = Math.exp(-p.drag * dt);
      p.vx *= d; p.vy *= d; p.vz *= d; p.vy += p.g * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.y < p.floor) { p.y = p.floor; p.vy *= -0.35; p.vx *= 0.7; p.vz *= 0.7; }
      p.size += p.grow * dt;
      p.rx += p.spin * dt; p.ry += p.spin * 0.7 * dt;
      const k = p.age / p.life;
      const s = p.shrink ? p.size * (k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3) : p.size;
      dummy.position.set(p.x, p.y, p.z); dummy.rotation.set(p.rx, p.ry, 0); dummy.scale.set(s, s * p.sy, s);
      dummy.updateMatrix(); this.mesh.setMatrixAt(p.slot, dummy.matrix);
      keep.push(p);
    }
    this.list = keep;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

export class Fx3D {
  constructor(scale = 1) {
    this.group = new THREE.Group();
    this.puffs = new Pool(sphere(1, 8), toy('#ffffff', { rough: 0.9, emissive: '#ffffff', ei: 0.15 }), Math.round(260 * scale));
    this.chips = new Pool(roundBox(1, 1, 1, 0.15, 1), toy('#ffffff', { rough: 0.6 }), Math.round(260 * scale));
    this.glow = new Pool(sphere(1, 6), toy('#ffffff', { emissive: '#ffffff', ei: 1.2 }), Math.round(160 * scale));
    this.group.add(this.puffs.mesh, this.chips.mesh, this.glow.mesh);
  }
  update(dt) { this.puffs.update(dt); this.chips.update(dt); this.glow.update(dt); }

  dust(p, n = 8, c = '#efe6da', strength = 1) {
    for (let i = 0; i < n; i++) {
      const a = R() * Math.PI * 2, s = (1.5 + R() * 2.5) * strength;
      this.puffs.spawn({ p: [p[0] + Math.cos(a) * 0.4, p[1] - 0.2, p[2] + Math.sin(a) * 0.4], v: [Math.cos(a) * s, 0.8 + R() * 1.5, Math.sin(a) * s], size: 0.1 + R() * 0.12, grow: 0.35, life: 0.45 + R() * 0.45, g: 0.5, drag: 3, c });
    }
  }
  sparks(p, n = 10, c = '#ffe14d', speed = 6) {
    for (let i = 0; i < n; i++) {
      const a = R() * Math.PI * 2, u = R() * 2 - 1, s = speed * (0.5 + R() * 0.7), h = Math.sqrt(1 - u * u);
      this.glow.spawn({ p, v: [Math.cos(a) * h * s, u * s + 2, Math.sin(a) * h * s], size: 0.08 + R() * 0.08, life: 0.35 + R() * 0.4, g: -10, drag: 2, c });
    }
  }
  sparkle(p, n = 6, c = '#fff7a8') {
    for (let i = 0; i < n; i++) this.glow.spawn({ p: [p[0] + (R() - 0.5) * 1.2, p[1] + (R() - 0.5) * 1.2, p[2] + (R() - 0.5) * 1.2], v: [0, 1 + R(), 0], size: 0.07 + R() * 0.07, life: 0.5 + R() * 0.5, g: 0, drag: 1, c });
  }
  splash(p, c = '#bff0ff', n = 22) {
    for (let i = 0; i < n; i++) {
      const a = R() * Math.PI * 2, s = 2 + R() * 4;
      this.puffs.spawn({ p, v: [Math.cos(a) * s, 6 + R() * 7, Math.sin(a) * s], size: 0.18 + R() * 0.2, life: 0.9 + R() * 0.5, g: -18, drag: 0.5, c });
    }
  }
  confetti(p, n = 60, spread = 1) {
    for (let i = 0; i < n; i++) {
      const a = R() * Math.PI * 2, s = (2 + R() * 6) * spread;
      this.chips.spawn({ p: [p[0], p[1], p[2]], v: [Math.cos(a) * s, 8 + R() * 9, Math.sin(a) * s], size: 0.14 + R() * 0.08, sy: 0.25, life: 2.2 + R() * 1.2, g: -6, drag: 1.4, spin: 8 + R() * 8, c: CONFETTI[i % CONFETTI.length], shrink: true });
    }
  }
  // Pieces of a smashed prop flying apart.
  debris(p, v, color, n = 8, size = 0.32, floor = -1e9) {
    for (let i = 0; i < n; i++) {
      const a = R() * Math.PI * 2, s = 2 + R() * 4;
      this.chips.spawn({ p: [p[0] + (R() - 0.5) * 0.6, p[1] + (R() - 0.5) * 0.6, p[2] + (R() - 0.5) * 0.6], v: [v[0] * 0.4 + Math.cos(a) * s, v[1] * 0.3 + 3 + R() * 4, v[2] * 0.4 + Math.sin(a) * s], size: size * (0.6 + R() * 0.6), life: 1.2 + R() * 0.6, g: -18, drag: 0.4, spin: 6 + R() * 6, c: color, floor });
    }
  }
  trail(p, c = '#ffffff') { this.puffs.spawn({ p, v: [(R() - 0.5), 0.5, (R() - 0.5)], size: 0.12 + R() * 0.08, grow: 0.4, life: 0.45, g: 0, drag: 2, c }); }
  ring(p, c = '#ffe14d', n = 18, s = 7) {
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; this.glow.spawn({ p, v: [Math.cos(a) * s, 0.5, Math.sin(a) * s], size: 0.12, life: 0.5, g: 0, drag: 2.5, c }); }
  }
  wind(p, v, c = '#ffffff') { this.puffs.spawn({ p, v, size: 0.07, sy: 4, life: 0.9, g: 0, drag: 0, c, shrink: true }); }
}
