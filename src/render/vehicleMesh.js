// Procedural toy vehicles with their drivers. Each model is a builder registered by name,
// so a GLB/glTF model can later replace one by registering a builder that loads it.
// Models face +x and sit around the physics box from vehicles.js.
import * as THREE from 'three';
import { toy, roundBox, sphere, cylinder, cone, torus, addOutline } from './materials.js';

const BUILDERS = {};
export function registerVehicleModel(name, fn) { BUILDERS[name] = fn; }

function add(parent, geometry, color, pos, o = {}) {
  const m = new THREE.Mesh(geometry, typeof color === 'string' ? toy(color, o) : color);
  m.position.set(...pos);
  if (o.rot) m.rotation.set(...o.rot);
  if (o.scale) m.scale.set(...(Array.isArray(o.scale) ? o.scale : [o.scale, o.scale, o.scale]));
  m.castShadow = o.shadow !== false;
  if (o.outline && o.outlines) addOutline(m, o.outline === true ? 0.07 : o.outline);
  parent.add(m);
  return m;
}

function eyes(parent, x, y, z, r, sep, outlines) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  for (const s of [-1, 1]) {
    add(g, sphere(r, 12), '#ffffff', [0, 0, s * sep], { rough: 0.3 });
    add(g, sphere(r * 0.55, 10), '#1a1428', [r * 0.6, 0, s * sep], { rough: 0.2 });
    add(g, sphere(r * 0.18, 6), '#ffffff', [r * 0.95, r * 0.25, s * sep - r * 0.15], { rough: 0.1, emissive: '#ffffff', ei: 0.6 });
  }
  parent.add(g);
  return g;
}

function wheels(parent, pts, r, w, color, hub, outlines) {
  const list = [];
  for (const [x, y, z] of pts) {
    const piv = new THREE.Group();
    piv.position.set(x, y, z);
    const tire = add(piv, cylinder(r, r, w, 18), '#2a2438', [0, 0, 0], { rot: [Math.PI / 2, 0, 0], rough: 0.8, outline: 0.08, outlines });
    add(tire, cylinder(r * 0.55, r * 0.55, w * 1.08, 12), hub, [0, 0, 0], { rough: 0.35, shadow: false });
    parent.add(piv);
    list.push(piv);
  }
  return list;
}

registerVehicleModel('panda', (paint, outlines) => {
  const root = new THREE.Group(), body = new THREE.Group(), driver = new THREE.Group();
  root.add(body); body.add(driver);
  add(body, roundBox(1.45, 0.42, 0.95, 0.18), paint, [0, -0.08, 0], { outline: 0.05, outlines, rough: 0.35 });
  add(body, roundBox(0.5, 0.18, 0.8, 0.08), '#ffffff', [0.55, 0.12, 0], { rough: 0.4 });
  add(body, roundBox(0.16, 0.36, 0.95, 0.06), '#2a2438', [-0.7, 0.2, 0], {});
  add(body, roundBox(0.12, 0.08, 1.15, 0.04), '#ffcc1a', [-0.72, 0.42, 0], { outline: 0.1, outlines });
  add(body, sphere(0.08, 8), '#fff6a0', [0.74, -0.02, 0.32], { emissive: '#fff3a0', ei: 0.8 });
  add(body, sphere(0.08, 8), '#fff6a0', [0.74, -0.02, -0.32], { emissive: '#fff3a0', ei: 0.8 });
  const w = wheels(body, [[0.48, -0.26, 0.52], [0.48, -0.26, -0.52], [-0.46, -0.24, 0.52], [-0.46, -0.24, -0.52]], 0.24, 0.2, '#2a2438', '#ffcc1a', outlines);
  // Panda driver
  driver.position.set(-0.15, 0.32, 0);
  add(driver, sphere(0.26, 14), '#ffffff', [0, 0, 0], { scale: [1, 0.85, 1.05] });
  const head = new THREE.Group(); head.position.set(0.05, 0.36, 0); driver.add(head);
  add(head, sphere(0.3, 18), '#ffffff', [0, 0, 0], { outline: 0.06, outlines, rough: 0.6 });
  for (const s of [-1, 1]) {
    add(head, sphere(0.11, 10), '#2a2438', [-0.04, 0.24, s * 0.21]);
    add(head, sphere(0.09, 10), '#2a2438', [0.22, 0.05, s * 0.11], { scale: [0.6, 1.2, 1] });
  }
  const eye = eyes(head, 0.25, 0.06, 0, 0.06, 0.11, outlines);
  add(head, sphere(0.05, 8), '#2a2438', [0.3, -0.06, 0]);
  const mouth = add(head, sphere(0.05, 8), '#e8443a', [0.28, -0.14, 0], { scale: [0.5, 0.3, 1.2] });
  add(head, sphere(0.05, 8), '#ff9ab8', [0.24, -0.06, 0.18], { scale: [0.5, 0.6, 1] });
  add(head, sphere(0.05, 8), '#ff9ab8', [0.24, -0.06, -0.18], { scale: [0.5, 0.6, 1] });
  const arms = [];
  for (const s of [-1, 1]) {
    const a = new THREE.Group(); a.position.set(0.08, 0.06, s * 0.22); driver.add(a);
    add(a, sphere(0.09, 8), '#2a2438', [0.16, 0, 0], { scale: [1.8, 0.8, 0.8] });
    arms.push(a);
  }
  add(body, torus(0.12, 0.03, 16), '#2a2438', [0.2, 0.32, 0], { rot: [0, Math.PI / 2, 0.5] });
  return { root, body, driver, head, eye, mouth, arms, wheels: w, wheelR: 0.24 };
});

registerVehicleModel('dino', (paint, outlines) => {
  const root = new THREE.Group(), body = new THREE.Group(), driver = new THREE.Group();
  root.add(body); body.add(driver);
  add(body, roundBox(1.55, 0.12, 0.78, 0.06), '#ffcc1a', [0, -0.12, 0], { outline: 0.06, outlines, rough: 0.4 });
  add(body, roundBox(1.4, 0.03, 0.68, 0.015), '#2a2438', [0, -0.05, 0], { rough: 0.9, shadow: false });
  add(body, roundBox(0.25, 0.1, 0.6, 0.05), '#ffcc1a', [0.78, -0.07, 0], { rot: [0, 0, 0.35] });
  add(body, roundBox(0.25, 0.1, 0.6, 0.05), '#ffcc1a', [-0.78, -0.07, 0], { rot: [0, 0, -0.35] });
  const w = wheels(body, [[0.5, -0.24, 0.3], [0.5, -0.24, -0.3], [-0.5, -0.24, 0.3], [-0.5, -0.24, -0.3]], 0.12, 0.14, '#2a2438', '#ff5ec4', outlines);
  driver.position.set(0, 0.0, 0);
  // Body, belly, legs, tail and spikes
  add(driver, sphere(0.34, 16), paint, [-0.05, 0.36, 0], { scale: [1.15, 1, 0.9], outline: 0.06, outlines });
  add(driver, sphere(0.25, 12), '#fff3c4', [0.12, 0.33, 0], { scale: [0.7, 1, 0.85] });
  for (const s of [-1, 1]) add(driver, roundBox(0.18, 0.3, 0.16, 0.07), paint, [-0.02, 0.06, s * 0.18]);
  const tail = add(driver, cone(0.17, 0.7, 10), paint, [-0.5, 0.28, 0], { rot: [0, 0, Math.PI / 2 + 0.5] });
  for (let i = 0; i < 4; i++) add(driver, cone(0.07, 0.16, 6), '#ff9a3d', [-0.32 + i * 0.12, 0.66 - Math.abs(i - 1.5) * 0.04, 0], { rot: [0, 0, 0.2] });
  const head = new THREE.Group(); head.position.set(0.24, 0.74, 0); driver.add(head);
  add(head, sphere(0.27, 16), paint, [0, 0, 0], { scale: [1.15, 0.95, 0.95], outline: 0.06, outlines });
  add(head, sphere(0.2, 12), paint, [0.2, -0.07, 0], { scale: [1.1, 0.75, 0.95] });
  const eye = eyes(head, 0.13, 0.11, 0, 0.065, 0.13, outlines);
  const mouth = add(head, roundBox(0.08, 0.04, 0.24, 0.02), '#2a2438', [0.36, -0.13, 0]);
  for (const s of [-1, 1]) add(head, sphere(0.025, 6), '#2a2438', [0.39, -0.02, s * 0.06]);
  const arms = [];
  for (const s of [-1, 1]) {
    const a = new THREE.Group(); a.position.set(0.15, 0.45, s * 0.24); driver.add(a);
    add(a, roundBox(0.18, 0.07, 0.07, 0.03), paint, [0.08, 0, 0]);
    arms.push(a);
  }
  return { root, body, driver, head, eye, mouth, arms, wheels: w, wheelR: 0.12, tail };
});

registerVehicleModel('chicken', (paint, outlines) => {
  const root = new THREE.Group(), body = new THREE.Group(), driver = new THREE.Group();
  root.add(body); body.add(driver);
  // Wooden cart tub with a painted stripe
  add(body, roundBox(1.5, 0.5, 1.06, 0.12), '#c98a50', [0, -0.08, 0], { outline: 0.05, outlines, rough: 0.7 });
  add(body, roundBox(1.54, 0.12, 1.1, 0.05), paint, [0, 0.06, 0], { rough: 0.4 });
  add(body, roundBox(1.3, 0.1, 0.86, 0.04), '#8a5a2b', [0, 0.17, 0], { shadow: false });
  const w = wheels(body, [[0.45, -0.28, 0.58], [0.45, -0.28, -0.58], [-0.45, -0.28, 0.58], [-0.45, -0.28, -0.58]], 0.27, 0.16, '#2a2438', paint, outlines);
  driver.position.set(-0.05, 0.3, 0);
  add(driver, sphere(0.36, 16), '#ffffff', [0, 0.05, 0], { scale: [1.15, 1, 1], outline: 0.06, outlines, rough: 0.7 });
  const arms = [];
  for (const s of [-1, 1]) {
    const a = new THREE.Group(); a.position.set(-0.05, 0.08, s * 0.34); driver.add(a);
    add(a, sphere(0.16, 10), '#f2f2f2', [0, 0, 0], { scale: [1.3, 0.6, 0.4] });
    arms.push(a);
  }
  add(driver, cone(0.12, 0.3, 6), '#ffffff', [-0.42, 0.25, 0], { rot: [0, 0, 0.9] });
  const head = new THREE.Group(); head.position.set(0.22, 0.45, 0); driver.add(head);
  add(head, sphere(0.22, 16), '#ffffff', [0, 0, 0], { outline: 0.07, outlines, rough: 0.7 });
  for (let i = 0; i < 3; i++) add(head, sphere(0.07, 8), '#e8443a', [-0.08 + i * 0.08, 0.22 + (i === 1 ? 0.04 : 0), 0]);
  const beak = add(head, cone(0.08, 0.2, 8), '#ffb81a', [0.27, -0.02, 0], { rot: [0, 0, -Math.PI / 2] });
  const mouth = add(head, cone(0.06, 0.14, 8), '#ff9a1a', [0.23, -0.08, 0], { rot: [0, 0, -Math.PI / 2 - 0.3] });
  add(head, sphere(0.05, 8), '#e8443a', [0.18, -0.15, 0], { scale: [0.8, 1.4, 0.8] });
  const eye = eyes(head, 0.13, 0.06, 0, 0.055, 0.11, outlines);
  return { root, body, driver, head, eye, mouth, arms, wheels: w, wheelR: 0.27, beak };
});

// Builds the vehicle and returns an object with an animate() method.
export function buildVehicle(def, paintColor, outlines = true) {
  const parts = (BUILDERS[def.model] || BUILDERS.panda)(paintColor, outlines);
  const v = {
    ...parts, def, t: Math.random() * 10, squash: 0, squashV: 0, blink: 0, cheer: 0, mood: 'idle',
    // Spring-y squash and stretch: call bump(k) on landings and launches.
    bump(k) { this.squashV -= k; },
    animate(dt, s) {
      this.t += dt;
      // Squash spring
      this.squashV += (-this.squash * 120 - this.squashV * 12) * dt;
      this.squash += this.squashV * dt;
      const q = Math.max(-0.35, Math.min(0.35, this.squash));
      this.body.scale.set(1 - q * 0.5, 1 + q, 1 - q * 0.5);
      // Wheels roll with speed
      for (const w of this.wheels) w.children[0].rotation.y -= ((s.speed || 0) * dt) / this.wheelR;
      // Head bob, aiming lean and in-air excitement
      const air = s.air || 0, aim = s.aim || 0;
      this.head.rotation.z = Math.sin(this.t * 3) * 0.06 + (air > 0.2 ? 0.25 : 0) - aim * 0.25;
      this.head.rotation.x = Math.sin(this.t * 2.1) * 0.05;
      this.driver.rotation.z = -aim * 0.25;
      this.driverY ??= this.driver.position.y;
      this.driver.position.y = this.driverY + (s.speed > 1 ? Math.sin(this.t * 12) * 0.02 : 0);
      const cheer = s.finish ? 1 : air > 0.3 ? 0.7 : 0;
      this.cheer += (cheer - this.cheer) * Math.min(1, dt * 8);
      this.arms.forEach((a, i) => { a.rotation.x = (i ? -1 : 1) * (this.cheer * (1.4 + Math.sin(this.t * 14) * 0.3)); a.rotation.z = this.cheer * 0.9; });
      // Mouth opens wide in the air and while cheering
      const open = Math.max(this.cheer, s.hit || 0);
      this.mouth.scale.y = 0.3 + open * 1.4;
      // Blink now and then
      this.blink -= dt;
      if (this.blink < -3 - Math.random() * 3) this.blink = 0.12;
      this.eye.scale.y = this.blink > 0 ? 0.15 : 1 + open * 0.25;
      if (this.tail) this.tail.rotation.y = Math.sin(this.t * 8) * 0.3 * (1 + air);
      if (s.finish) this.driver.position.y = this.driverY + Math.abs(Math.sin(this.t * 9)) * 0.12;
    },
  };
  v.root.traverse((o) => { if (o.isMesh && o.material.side !== THREE.BackSide) o.castShadow = true; });
  return v;
}
