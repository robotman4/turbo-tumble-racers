// Shared materials, geometries and small generated textures. Everything is cached so
// levels reuse the same GPU objects (fewer uploads, fewer state changes).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

export const INK = '#2a1f3d';
const mats = new Map();
const geos = new Map();
const texs = new Map();

// Toy plastic: soft, slightly glossy.
export function toy(color, o = {}) {
  const key = `toy|${color}|${o.rough ?? 0.5}|${o.emissive || ''}|${o.ei || 0}|${o.flat ? 1 : 0}|${o.map || ''}|${o.transparent ? o.opacity : ''}|${o.side || ''}`;
  let m = mats.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color, roughness: o.rough ?? 0.5, metalness: o.metal ?? 0,
      emissive: o.emissive || '#000000', emissiveIntensity: o.ei || 0,
      flatShading: !!o.flat,
    });
    if (o.map) m.map = texture(o.map);
    if (o.transparent) { m.transparent = true; m.opacity = o.opacity; m.depthWrite = false; }
    if (o.side) m.side = o.side;
    mats.set(key, m);
  }
  return m;
}
export function basic(color, o = {}) {
  const key = `basic|${color}|${o.opacity ?? 1}|${o.side || ''}|${o.add ? 1 : 0}`;
  let m = mats.get(key);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color, transparent: (o.opacity ?? 1) < 1, opacity: o.opacity ?? 1, side: o.side || THREE.FrontSide, depthWrite: (o.opacity ?? 1) >= 1 });
    if (o.add) m.blending = THREE.AdditiveBlending;
    mats.set(key, m);
  }
  return m;
}
// Thick dark outline (inverted hull), the same look as the template's 2D ink outlines.
export function outlineMat() { return basic(INK, { side: THREE.BackSide }); }

export function geo(key, make) {
  let g = geos.get(key);
  if (!g) { g = make(); geos.set(key, g); }
  return g;
}
export const roundBox = (w, h, d, r = 0.12, seg = 3) =>
  geo(`rb|${w.toFixed(3)}|${h.toFixed(3)}|${d.toFixed(3)}|${r}|${seg}`, () => new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2, h / 2, d / 2)));
export const sphere = (r = 1, seg = 16) => geo(`sp|${r}|${seg}`, () => new THREE.SphereGeometry(r, seg, Math.max(8, seg * 0.75 | 0)));
export const cylinder = (rt, rb, h, seg = 20) => geo(`cy|${rt}|${rb}|${h}|${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg));
export const cone = (r, h, seg = 16) => geo(`co|${r}|${h}|${seg}`, () => new THREE.ConeGeometry(r, h, seg));
export const torus = (r, t, seg = 24, arc = Math.PI * 2) => geo(`to|${r}|${t}|${seg}|${arc}`, () => new THREE.TorusGeometry(r, t, 10, seg, arc));

export function starGeometry(r1 = 0.6, r2 = 0.28, depth = 0.22) {
  return geo(`star|${r1}|${r2}|${depth}`, () => {
    const s = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? r2 : r1, a = Math.PI / 2 + (i * Math.PI) / 5;
      const x = Math.cos(a) * r, y = Math.sin(a) * r;
      if (i === 0) s.moveTo(x, y); else s.lineTo(x, y);
    }
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 2 });
    g.center();
    return g;
  });
}

// Wedge (ramp) geometry matching the physics convex hull: rises toward +x.
export function wedgeGeometry(l, h, w) {
  return geo(`wedge|${l}|${h}|${w}`, () => {
    const x0 = -l / 2, x1 = l / 2, z0 = -w / 2, z1 = w / 2;
    const P = [
      [x0, 0, z0], [x0, 0, z1], [x1, 0, z0], [x1, 0, z1], [x1, h, z0], [x1, h, z1],
    ];
    const tri = (a, b, c) => [...P[a], ...P[b], ...P[c]];
    const pos = [
      ...tri(0, 1, 5), ...tri(0, 5, 4), // slope
      ...tri(1, 3, 5), // side z1
      ...tri(0, 4, 2), // side z0
      ...tri(2, 4, 5), ...tri(2, 5, 3), // back
      ...tri(0, 2, 3), ...tri(0, 3, 1), // bottom
    ];
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    return g;
  });
}

// ---------- generated textures (canvas, no image files) ----------
export function texture(name) {
  let t = texs.get(name);
  if (t) return t;
  const c = document.createElement('canvas');
  const size = 128;
  c.width = c.height = size;
  const g = c.getContext('2d');
  if (name === 'chevron') {
    g.fillStyle = '#ffcc1a'; g.fillRect(0, 0, size, size);
    g.fillStyle = '#ff7a1a';
    for (let i = -1; i < 3; i++) {
      const y = i * 64;
      g.beginPath(); g.moveTo(0, y + 64); g.lineTo(64, y + 16); g.lineTo(128, y + 64); g.lineTo(128, y + 96); g.lineTo(64, y + 48); g.lineTo(0, y + 96); g.closePath(); g.fill();
    }
  } else if (name === 'boost') {
    g.fillStyle = '#2fd2ff'; g.fillRect(0, 0, size, size);
    g.fillStyle = '#ffffff';
    for (let i = -1; i < 3; i++) {
      const y = i * 64;
      g.beginPath(); g.moveTo(16, y + 64); g.lineTo(64, y + 20); g.lineTo(112, y + 64); g.lineTo(112, y + 92); g.lineTo(64, y + 48); g.lineTo(16, y + 92); g.closePath(); g.fill();
    }
  } else if (name === 'checker') {
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { g.fillStyle = (x + y) % 2 ? '#2a1f3d' : '#ffffff'; g.fillRect(x * 16, y * 16, 16, 16); }
  } else if (name === 'stripes') {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, size, size);
    g.fillStyle = '#e8443a';
    for (let i = -2; i < 6; i++) { g.beginPath(); g.moveTo(i * 32, 0); g.lineTo(i * 32 + 16, 0); g.lineTo(i * 32 + 16 + size, size); g.lineTo(i * 32 + size, size); g.closePath(); g.fill(); }
  } else if (name === 'grass') {
    g.fillStyle = '#7fd858'; g.fillRect(0, 0, size, size);
    for (let i = 0; i < 260; i++) {
      g.fillStyle = Math.random() < 0.5 ? 'rgba(80,170,60,0.5)' : 'rgba(170,240,120,0.5)';
      g.fillRect(Math.random() * size, Math.random() * size, 2, 5);
    }
  } else if (name === 'wood') {
    g.fillStyle = '#e0a868'; g.fillRect(0, 0, size, size);
    g.strokeStyle = 'rgba(150,90,40,0.35)'; g.lineWidth = 3;
    for (let y = 8; y < size; y += 16) { g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= size; x += 16) g.lineTo(x, y + Math.sin(x * 0.1 + y) * 2); g.stroke(); }
    g.fillStyle = 'rgba(120,70,30,0.5)'; for (let y = 0; y < size; y += 32) g.fillRect(0, y, size, 2);
  } else if (name === 'dots') {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, size, size);
    const cols = ['#ff5ec4', '#7ee8ff', '#fff27a', '#7cf2a0', '#b07bff'];
    for (let i = 0; i < 40; i++) { g.fillStyle = cols[i % cols.length]; g.fillRect(Math.random() * size, Math.random() * size, 6, 3); }
  } else if (name === 'moon') {
    g.fillStyle = '#c9c4e6'; g.fillRect(0, 0, size, size);
    for (let i = 0; i < 14; i++) {
      const x = Math.random() * size, y = Math.random() * size, r = 4 + Math.random() * 10;
      g.fillStyle = 'rgba(120,110,170,0.35)'; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.3)'; g.beginPath(); g.arc(x - 1, y - 1, r * 0.7, 0, 7); g.fill();
    }
  } else if (name === 'sand') {
    g.fillStyle = '#f2d38a'; g.fillRect(0, 0, size, size);
    for (let i = 0; i < 300; i++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(200,160,90,0.4)' : 'rgba(255,240,200,0.5)'; g.fillRect(Math.random() * size, Math.random() * size, 2, 2); }
  }
  t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  texs.set(name, t);
  return t;
}

// Material with its own copy of a texture (so it can be repeated / scrolled independently).
export function texturedToy(name, color = '#ffffff', repeat = [1, 1], o = {}) {
  const t = texture(name).clone();
  t.needsUpdate = true;
  t.repeat.set(repeat[0], repeat[1]);
  const m = new THREE.MeshStandardMaterial({ color, map: t, roughness: o.rough ?? 0.6, emissive: o.emissive || '#000000', emissiveIntensity: o.ei || 0 });
  if (o.emissiveMap) m.emissiveMap = t;
  return m;
}

export function addOutline(mesh, k = 0.06) {
  const o = new THREE.Mesh(mesh.geometry, outlineMat());
  o.scale.setScalar(1 + k);
  o.castShadow = false; o.receiveShadow = false;
  o.raycast = () => {};
  mesh.add(o);
  return o;
}
