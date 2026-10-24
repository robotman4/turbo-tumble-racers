// Builds and animates the 3D view of a level from its definition and the running Sim.
// Course pieces become meshes, props and collectibles become instanced meshes, gadgets and
// movers get small animated toy models. The sim stays the source of truth for positions.
import * as THREE from 'three';
import { SURFACES } from '../game/worlds.js';
import { PROP_KINDS } from '../game/sim.js';
import { DEG } from '../game/launch.js';
import { toy, basic, roundBox, sphere, cylinder, cone, torus, starGeometry, wedgeGeometry, texture, texturedToy, addOutline, geo } from './materials.js';
import { buildEnvironment } from './environment.js';
import { buildVehicle } from './vehicleMesh.js';
import { Fx3D } from './fx3d.js';

const m4 = new THREE.Matrix4(), m4b = new THREE.Matrix4(), q = new THREE.Quaternion(), q2 = new THREE.Quaternion();
const v3 = new THREE.Vector3(), s3 = new THREE.Vector3(), e3 = new THREE.Euler();
const TOP_TEX = { grass: 'grass', wood: 'wood', plank: 'wood', deck: 'wood', sand: 'sand', moon: 'moon', candy: 'dots', cardboard: null };

function eulerQ(r) { e3.set((r?.[0] || 0) * DEG, (r?.[1] || 0) * DEG, (r?.[2] || 0) * DEG, 'YXZ'); return new THREE.Quaternion().setFromEuler(e3); }

// Waving flag: a plane whose vertices ripple in the vertex shader.
function flagMesh(color, w = 1.4, h = 0.9) {
  const g = new THREE.PlaneGeometry(w, h, 8, 3);
  g.translate(w / 2, 0, 0);
  const m = new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide, roughness: 0.6 });
  const u = { uT: { value: 0 } };
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uT = u.uT;
    sh.vertexShader = 'uniform float uT;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n transformed.z += sin(position.x * 4.0 - uT * 7.0) * 0.12 * position.x;');
  };
  const mesh = new THREE.Mesh(g, m);
  mesh.userData.u = u;
  mesh.castShadow = true;
  return mesh;
}

function pinGeometry() {
  return geo('pin', () => {
    const pts = [];
    const prof = [[0, -0.6], [0.16, -0.58], [0.22, -0.4], [0.24, -0.2], [0.18, 0.05], [0.1, 0.22], [0.1, 0.3], [0.14, 0.42], [0.12, 0.54], [0, 0.6]];
    for (const [x, y] of prof) pts.push(new THREE.Vector2(x, y));
    return new THREE.LatheGeometry(pts, 14);
  });
}

export class LevelView {
  constructor(sim, opts = {}) {
    this.sim = sim;
    this.level = sim.level;
    this.world = sim.world;
    this.opts = opts;
    this.q = opts.quality || { decor: 1, outlines: true, shadows: true };
    this.scene = new THREE.Scene();
    this.t = 0;
    this.anims = [];
    this.jelly = [];
    this.flags = [];
    this.trailT = 0;

    const b = this.bounds();
    this.env = buildEnvironment(this.world, b, this.q.decor, this.level.id.length + (this.level.world * 13));
    this.scene.add(this.env.group);
    this.scene.fog = this.env.fog;
    this.scene.background = new THREE.Color(this.world.sky[1]);

    this.buildParts();
    this.buildProps();
    this.buildMovers();
    this.buildGadgets();
    this.buildCollectibles();
    this.buildFinish();
    this.buildAim();
    this.fx = new Fx3D(this.q.decor < 0.5 ? 0.6 : 1);
    this.scene.add(this.fx.group);

    const V = sim.veh;
    this.vehicle = buildVehicle(V, opts.paint || V.paints[0].color, this.q.outlines);
    this.scene.add(this.vehicle.root);
    this.vpos = new THREE.Vector3(); this.vquat = new THREE.Quaternion();
    this.syncVehicle(1);
  }

  bounds() {
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    const grow = (p, r = 2) => { for (let i = 0; i < 3; i++) { min[i] = Math.min(min[i], p[i] - r); max[i] = Math.max(max[i], p[i] + r); } };
    for (const d of this.level.parts || []) grow(d.p, d.s ? Math.max(...d.s) / 2 : (d.r || 2));
    grow(this.level.start.p); grow(this.level.finish.p);
    if (!isFinite(min[0])) { min.fill(-20); max.fill(20); }
    this.b = { min, max };
    return this.b;
  }

  // ---------- course ----------
  topMaterial(mat, w, d) {
    const S = SURFACES[mat] || SURFACES.wood;
    const tex = TOP_TEX[mat];
    if (tex) return texturedToy(tex, '#ffffff', [Math.max(1, w / 3), Math.max(1, d / 3)], { rough: 0.8 });
    if (mat === 'jelly' || mat === 'crystal') return toy(S.top, { rough: 0.15, emissive: S.top, ei: 0.25, transparent: true, opacity: 0.85 });
    if (mat === 'icing') return toy(S.top, { rough: 0.12, metal: 0.1 });
    if (mat === 'sticky') return toy(S.top, { rough: 0.15, emissive: '#5a2a10', ei: 0.2 });
    return toy(S.top, { rough: 0.45 });
  }
  sideMaterial(mat) {
    const S = SURFACES[mat] || SURFACES.wood;
    if (mat === 'jelly' || mat === 'crystal') return toy(S.color, { rough: 0.15, emissive: S.color, ei: 0.2, transparent: true, opacity: 0.8 });
    if (mat === 'grass') return toy('#a0703f', { rough: 0.9 });
    if (mat === 'candy') return texturedToy('stripes', '#ffffff', [3, 1], { rough: 0.4 });
    if (mat === 'icing') return toy('#ffb3d9', { rough: 0.5 });
    return toy(S.color, { rough: 0.55 });
  }

  buildParts() {
    this.partMeshes = [];
    for (const part of this.sim.parts) {
      const d = part.def, mat = part.mat;
      const g = new THREE.Group();
      g.position.set(...d.p);
      if (d.t === 'box') {
        g.quaternion.copy(eulerQ(d.r));
        const [w, h, dd] = d.s;
        const body = new THREE.Mesh(roundBox(w, h, dd, Math.min(0.3, Math.min(w, h, dd) * 0.3)), this.sideMaterial(mat));
        body.castShadow = body.receiveShadow = true;
        g.add(body);
        if (h >= 0.3 && w > 0.8 && dd > 0.8) {
          const cap = new THREE.Mesh(roundBox(w - 0.12, 0.16, dd - 0.12, 0.07), this.topMaterial(mat, w, dd));
          cap.position.y = h / 2 - 0.05; cap.receiveShadow = true; cap.castShadow = false;
          g.add(cap);
          if (mat === 'sticky') this.addBubbles(g, w, h, dd);
        }
      } else if (d.t === 'cyl') {
        const body = new THREE.Mesh(cylinder(d.r, d.r * 1.04, d.h, 28), this.sideMaterial(mat));
        body.castShadow = body.receiveShadow = true;
        g.add(body);
        const cap = new THREE.Mesh(cylinder(d.r - 0.06, d.r - 0.06, 0.16, 28), this.topMaterial(mat, d.r * 2, d.r * 2));
        cap.position.y = d.h / 2 - 0.05; cap.receiveShadow = true;
        g.add(cap);
      } else if (d.t === 'wedge') {
        g.rotation.y = (d.yaw || 0) * DEG;
        const [l, h, w] = d.s;
        const body = new THREE.Mesh(wedgeGeometry(l, h, w), toy((SURFACES[mat] || SURFACES.wood).top, { rough: 0.5, flat: true }));
        body.castShadow = body.receiveShadow = true;
        g.add(body);
        // Chevron arrows painted on the slope point the way.
        const sl = Math.hypot(l, h), ang = Math.atan2(h, l);
        const piv = new THREE.Group(); piv.position.set(0, h / 2, 0); piv.rotation.z = ang; g.add(piv);
        const decal = new THREE.Mesh(new THREE.PlaneGeometry(sl * 0.92, w * 0.7), texturedToy('chevron', '#ffffff', [Math.max(1, Math.round(sl / 2.5)), 1], { rough: 0.5 }));
        decal.material.map.rotation = -Math.PI / 2; decal.material.map.center.set(0.5, 0.5);
        decal.rotation.x = -Math.PI / 2; decal.position.y = 0.03; decal.receiveShadow = true;
        piv.add(decal);
      }
      if (mat === 'jelly') this.jelly.push({ g, k: 0, v: 0, i: part.i });
      this.scene.add(g);
      this.partMeshes[part.i] = g;
    }
  }
  addBubbles(g, w, h, d) {
    const n = Math.min(12, Math.round((w * d) / 6));
    for (let i = 0; i < n; i++) {
      const b = new THREE.Mesh(sphere(0.2 + Math.random() * 0.2, 8), toy('#d47a40', { rough: 0.1, emissive: '#7a3a10', ei: 0.2 }));
      b.position.set((Math.random() - 0.5) * (w - 1), h / 2 + 0.08, (Math.random() - 0.5) * (d - 1));
      b.scale.y = 0.5;
      g.add(b);
    }
  }

  // ---------- props ----------
  buildProps() {
    this.propSlots = [];
    const byKind = new Map();
    for (const p of this.sim.props) {
      if (!byKind.has(p.kind)) byKind.set(p.kind, []);
      byKind.get(p.kind).push(p);
    }
    this.propMeshes = [];
    const palette = this.world.blocks;
    for (const [kind, list] of byKind) {
      const layers = this.propLayers(kind);
      const meshes = layers.map((L) => {
        const im = new THREE.InstancedMesh(L.geo, L.mat, list.length);
        im.castShadow = true; im.receiveShadow = true;
        im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.scene.add(im);
        return { im, local: L.local || null, color: L.color };
      });
      list.forEach((p, i) => {
        const c = new THREE.Color(this.propColor(kind, p, palette));
        meshes.forEach((m) => { if (m.color === 'inst') m.im.setColorAt(i, c); });
        const sc = p.def.s ? [p.def.s[0] / (p.K.half[0] * 2), p.def.s[1] / (p.K.half[1] * 2), p.def.s[2] / (p.K.half[2] * 2)] : [1, 1, 1];
        this.propSlots[p.i] = { meshes, i, scale: sc, color: '#' + c.getHexString(), hidden: false };
      });
      meshes.forEach((m) => { if (m.im.instanceColor) m.im.instanceColor.needsUpdate = true; });
      this.propMeshes.push(...meshes);
    }
    this.syncProps(true);
  }
  propColor(kind, p, palette) {
    if (p.def.color) return p.def.color;
    const c = p.def.c ?? p.i;
    if (kind === 'block' || kind === 'domino' || kind === 'gumdrop') return palette[c % palette.length];
    if (kind === 'crate') return this.world.id === 3 ? '#b8763d' : '#d9ad74';
    if (kind === 'barrel') return '#b8763d';
    if (kind === 'rock') return palette[c % palette.length];
    if (kind === 'ball') return ['#e8443a', '#3b8fe8', '#f7d43c', '#5cc95a'][c % 4];
    return '#ffffff';
  }
  propLayers(kind) {
    const K = PROP_KINDS[kind], h = K.half;
    const lm = (y = 0, rx = 0, s = [1, 1, 1]) => new THREE.Matrix4().compose(new THREE.Vector3(0, y, 0), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, 0, 0)), new THREE.Vector3(...s));
    switch (kind) {
      case 'block': return [{ geo: roundBox(h[0] * 2, h[1] * 2, h[2] * 2, 0.12), mat: toy('#ffffff', { rough: 0.45 }), color: 'inst' }];
      case 'plank': return [{ geo: roundBox(h[0] * 2, h[1] * 2, h[2] * 2, 0.06), mat: texturedToy('wood', '#ffffff', [1, 1]), color: null }];
      case 'crate': return [
        { geo: roundBox(1.2, 1.2, 1.2, 0.08), mat: toy('#ffffff', { rough: 0.85 }), color: 'inst' },
        { geo: roundBox(1.24, 1.24, 0.3, 0.06), mat: toy('#c9a06a', { rough: 0.6 }), color: null },
      ];
      case 'pin': return [
        { geo: pinGeometry(), mat: toy('#ffffff', { rough: 0.3 }), color: null },
        { geo: torus(0.105, 0.035, 14), mat: toy('#e8443a', { rough: 0.3 }), local: lm(0.26, Math.PI / 2), color: null },
      ];
      case 'domino': return [{ geo: roundBox(0.26, 1.3, 0.8, 0.08), mat: toy('#ffffff', { rough: 0.35 }), color: 'inst' }];
      case 'barrel': return [
        { geo: cylinder(K.r, K.r, K.hh * 2, 18), mat: texturedToy('wood', '#ffffff', [2, 1]), color: null },
        { geo: torus(K.r + 0.01, 0.05, 18), mat: toy('#5a5a6a', { rough: 0.4, metal: 0.3 }), local: lm(0.35, Math.PI / 2), color: null },
        { geo: torus(K.r + 0.01, 0.05, 18), mat: toy('#5a5a6a', { rough: 0.4, metal: 0.3 }), local: lm(-0.35, Math.PI / 2), color: null },
      ];
      case 'ball': return [
        { geo: sphere(K.r, 18), mat: texturedToy('stripes', '#ffffff', [2, 1], { rough: 0.35 }), color: null },
      ];
      case 'duck': return [
        { geo: sphere(K.r, 14), mat: toy('#ffd21a', { rough: 0.35 }), local: lm(-0.05, 0, [1.15, 0.85, 1]), color: null },
        { geo: sphere(K.r * 0.62, 12), mat: toy('#ffd21a', { rough: 0.35 }), local: new THREE.Matrix4().makeTranslation(0.32, 0.38, 0), color: null },
        { geo: cone(0.13, 0.3, 8), mat: toy('#ff8a1a', { rough: 0.4 }), local: new THREE.Matrix4().compose(new THREE.Vector3(0.62, 0.36, 0), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, -Math.PI / 2)), new THREE.Vector3(1, 1, 1)), color: null },
        { geo: sphere(0.06, 6), mat: toy('#2a1f3d'), local: new THREE.Matrix4().makeTranslation(0.5, 0.5, 0.18), color: null },
        { geo: sphere(0.06, 6), mat: toy('#2a1f3d'), local: new THREE.Matrix4().makeTranslation(0.5, 0.5, -0.18), color: null },
      ];
      case 'gumdrop': return [{ geo: sphere(K.r, 14), mat: toy('#ffffff', { rough: 0.6, emissive: '#ffffff', ei: 0.08 }), local: lm(0, 0, [1, 0.9, 1]), color: 'inst' }];
      case 'rock': return [{ geo: new THREE.DodecahedronGeometry(K.r, 0), mat: toy('#ffffff', { rough: 0.4, flat: true, emissive: '#6050a0', ei: 0.15 }), color: 'inst' }];
      default: return [{ geo: roundBox(1, 1, 1, 0.1), mat: toy('#ff00ff'), color: null }];
    }
  }
  syncProps(force = false) {
    const zero = m4b.makeScale(0, 0, 0);
    for (const p of this.sim.props) {
      const slot = this.propSlots[p.i];
      const body = this.sim.propBody(p);
      if (!body) {
        if (!slot.hidden) { for (const m of slot.meshes) { m.im.setMatrixAt(slot.i, zero); m.im.instanceMatrix.needsUpdate = true; } slot.hidden = true; }
        continue;
      }
      if (!force && body.isSleeping()) continue;
      const t = body.translation(), r = body.rotation();
      m4.compose(v3.set(t.x, t.y, t.z), q.set(r.x, r.y, r.z, r.w), s3.set(...slot.scale));
      for (const m of slot.meshes) {
        if (m.local) m4b.multiplyMatrices(m4, m.local); else m4b.copy(m4);
        m.im.setMatrixAt(slot.i, m4b);
        m.im.instanceMatrix.needsUpdate = true;
      }
    }
  }

  // ---------- movers ----------
  buildMovers() {
    this.moverMeshes = this.sim.movers.map((m) => {
      const d = m.def, g = new THREE.Group();
      const color = d.color || (SURFACES[d.mat] || {}).color || '#3b8fe8';
      const mesh = (geom, mat, pos = [0, 0, 0], rot) => { const x = new THREE.Mesh(geom, mat); x.position.set(...pos); if (rot) x.rotation.set(...rot); x.castShadow = x.receiveShadow = true; g.add(x); return x; };
      if (d.t === 'slider' || d.t === 'float') {
        const [w, h, dd] = d.s;
        mesh(roundBox(w, h, dd, Math.min(0.25, h * 0.4)), toy(color, { rough: 0.45 }));
        const cap = mesh(roundBox(w - 0.1, 0.12, dd - 0.1, 0.05), d.t === 'float' ? toy('#d6d2ee', { rough: 0.7 }) : texturedToy('wood', '#ffffff', [w / 3, dd / 3]), [0, h / 2 - 0.02, 0]);
        cap.castShadow = false;
        if (d.t === 'float') for (let i = 0; i < 3; i++) mesh(cone(0.3, 1.2, 5), toy('#7ee8ff', { emissive: '#7ee8ff', ei: 0.5, flat: true }), [(i - 1) * w * 0.3, -h / 2 - 0.5, (i % 2 - 0.5) * dd * 0.4], [Math.PI, 0, 0]);
      } else if (d.t === 'spinner') {
        const [l, h, th] = d.s;
        const mat = this.world.id === 2 ? texturedToy('stripes', '#ffffff', [4, 1], { rough: 0.3 }) : toy(color, { rough: 0.4 });
        const bar = mesh(roundBox(l, h, th, Math.min(0.2, th * 0.45)), mat);
        if (this.q.outlines) addOutline(bar, 0.04);
        if (d.arms === 2) mesh(roundBox(th, h, l, Math.min(0.2, th * 0.45)), mat);
        mesh(cylinder(0.5, 0.5, h + 0.3, 16), toy('#ffcc1a', { rough: 0.3 }));
      } else if (d.t === 'pendulum') {
        mesh(cylinder(0.1, 0.1, d.len, 8), toy('#5a5a6a', { metal: 0.4, rough: 0.4 }), [0, -d.len / 2, 0]);
        const hd = d.head || [1.2, 1.2, 1.6];
        const head = mesh(roundBox(hd[0], hd[1], hd[2], 0.25), toy(color, { rough: 0.4 }), [0, -d.len, 0]);
        if (this.q.outlines) addOutline(head, 0.05);
        mesh(roundBox(hd[0] * 1.05, hd[1] * 0.25, hd[2] * 1.05, 0.1), toy('#ffcc1a'), [0, -d.len, 0]);
        mesh(sphere(0.35, 12), toy('#ffcc1a', { metal: 0.3, rough: 0.3 }));
      } else if (d.t === 'bridge') {
        const w = d.w || 3;
        mesh(roundBox(d.len, 0.4, w, 0.12), texturedToy('wood', '#ffffff', [d.len / 3, 1]), [d.len / 2, -0.2, 0]);
        for (const s of [-1, 1]) mesh(roundBox(d.len, 0.2, 0.2, 0.08), toy('#8a5a2b'), [d.len / 2, 0.05, s * w / 2]);
      }
      this.scene.add(g);
      // Pendulum pivot posts / bridge hinge posts stay still.
      if (d.t === 'pendulum') {
        const beam = new THREE.Mesh(roundBox(0.5, 0.5, 4, 0.15), toy('#8a5a2b'));
        beam.position.set(d.p[0], d.p[1] + 0.3, d.p[2]); beam.rotation.y = (d.yaw || 0) * DEG + Math.PI / 2;
        beam.castShadow = true; this.scene.add(beam);
      }
      return g;
    });
  }
  syncMovers() {
    this.sim.movers.forEach((m, i) => {
      const b = this.sim.moverBody(m), t = b.translation(), r = b.rotation();
      const g = this.moverMeshes[i];
      g.position.set(t.x, t.y, t.z); g.quaternion.set(r.x, r.y, r.z, r.w);
    });
  }

  // ---------- gadgets ----------
  buildGadgets() {
    this.gadgetViews = this.sim.gadgets.map((gd) => {
      const d = gd.def, g = new THREE.Group();
      g.position.set(...d.p);
      const view = { g, d, k: 0 };
      const mesh = (geom, mat, pos = [0, 0, 0], parent = g) => { const x = new THREE.Mesh(geom, mat); x.position.set(...pos); x.castShadow = true; x.receiveShadow = true; parent.add(x); return x; };
      if (d.t === 'boost') {
        g.rotation.y = (d.yaw || 0) * DEG;
        const mat = texturedToy('boost', '#ffffff', [1, 2], { rough: 0.3, emissive: '#ffffff', ei: 0.6, emissiveMap: true });
        mat.map.rotation = -Math.PI / 2; mat.map.center.set(0.5, 0.5);
        const pad = mesh(new THREE.PlaneGeometry(d.s?.[0] || 3, d.s?.[1] || 2.6), mat, [0, 0.04, 0]);
        pad.rotation.x = -Math.PI / 2;
        mesh(roundBox((d.s?.[0] || 3) + 0.3, 0.1, (d.s?.[1] || 2.6) + 0.3, 0.05), toy('#2a1f3d'), [0, 0.0, 0]);
        view.tex = mat.map;
      } else if (d.t === 'spring') {
        g.rotation.y = (d.yaw || 0) * DEG;
        mesh(roundBox(1.9, 0.2, 1.9, 0.08), toy('#5a5a6a', { metal: 0.3 }), [0, -0.2, 0]);
        view.top = new THREE.Group(); g.add(view.top);
        for (let i = 0; i < 4; i++) mesh(torus(0.45, 0.08, 16), toy('#c3cad8', { metal: 0.6, rough: 0.3 }), [0, -0.05 + i * 0.12, 0], view.top).rotation.x = Math.PI / 2;
        const plate = mesh(roundBox(1.8, 0.16, 1.8, 0.07), toy('#e8443a'), [0, 0.5, 0], view.top);
        if (this.q.outlines) addOutline(plate, 0.05);
        const arrow = mesh(cone(0.4, 0.5, 3), toy('#ffffff', { emissive: '#ffffff', ei: 0.3 }), [0.2, 0.62, 0], view.top);
        arrow.rotation.set(0, 0, -Math.PI / 2); arrow.scale.set(1, 1, 0.2);
      } else if (d.t === 'trampoline') {
        const r = d.r || 1.6;
        mesh(torus(r, 0.18, 32), toy('#3b8fe8', { rough: 0.35 }), [0, 0.05, 0]).rotation.x = Math.PI / 2;
        view.top = mesh(cylinder(r - 0.05, r - 0.05, 0.06, 32), toy('#2a1f3d', { rough: 0.7 }), [0, 0.02, 0]);
        mesh(cylinder(r * 0.3, r * 0.3, 0.07, 20), toy('#ffe14d', { emissive: '#ffe14d', ei: 0.3 }), [0, 0.03, 0], view.top);
        for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; mesh(cylinder(0.08, 0.08, 0.8, 6), toy('#ffcc1a'), [Math.cos(a) * r, -0.35, Math.sin(a) * r]); }
      } else if (d.t === 'fan') {
        const yaw = (d.yaw || 0) * DEG, pitch = (d.pitch ?? 0) * DEG;
        view.dir = new THREE.Vector3(Math.cos(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.sin(yaw) * Math.cos(pitch));
        if (!d.current) {
          // Fan housing at the upwind end of the zone.
          const hous = new THREE.Group();
          const len = Math.abs(view.dir.x) * d.s[0] + Math.abs(view.dir.y) * d.s[1] + Math.abs(view.dir.z) * d.s[2];
          hous.position.copy(view.dir.clone().multiplyScalar(-len / 2));
          hous.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), view.dir);
          g.add(hous);
          const rr = Math.min(2.2, Math.min(...d.s) * 0.45);
          mesh(torus(rr, 0.25, 28), toy('#9b5de5'), [0, 0, 0], hous).rotation.x = Math.PI / 2;
          view.blades = new THREE.Group(); hous.add(view.blades);
          for (let i = 0; i < 4; i++) { const b = mesh(roundBox(rr * 0.9, 0.08, 0.5, 0.04), toy('#ffffff'), [0, 0, 0], view.blades); b.position.set(Math.cos(i * Math.PI / 2) * rr * 0.45, 0, Math.sin(i * Math.PI / 2) * rr * 0.45); b.rotation.y = -i * Math.PI / 2; b.rotation.x = 0.4; }
          mesh(sphere(0.35, 10), toy('#ffcc1a'), [0, 0, 0], hous);
        }
        const col = new THREE.Mesh(roundBox(d.s[0], d.s[1], d.s[2], 0.5), basic(d.current ? '#9fd8ff' : '#ffffff', { opacity: 0.08 }));
        g.add(col);
        view.windT = 0;
      } else if (d.t === 'gravity') {
        const col = new THREE.Mesh(roundBox(d.s[0], d.s[1], d.s[2], 0.5), basic('#b07bff', { opacity: 0.14 }));
        g.add(col);
        view.rings = [];
        for (let i = 0; i < 4; i++) { const r = new THREE.Mesh(torus(Math.min(d.s[0], d.s[2]) * 0.45, 0.06, 32), basic('#e0c8ff', { opacity: 0.6 })); r.rotation.x = Math.PI / 2; g.add(r); view.rings.push(r); }
        view.windT = 0;
      } else if (d.t === 'cannon') {
        view.turn = new THREE.Group(); g.add(view.turn);
        mesh(roundBox(1.8, 0.8, 1.8, 0.2), toy('#8a5a2b'), [0, -1.5, 0]);
        for (const s of [-1, 1]) mesh(cylinder(0.55, 0.55, 0.2, 16), toy('#5a3a1a'), [-0.3, -1.0, s * 0.85], view.turn).rotation.x = Math.PI / 2;
        view.barrel = new THREE.Group(); view.turn.add(view.barrel);
        view.barrel.rotation.z = (d.pitch ?? 40) * DEG;
        const br = mesh(cylinder(0.75, 0.95, 2.8, 20), toy('#3a3a4a', { metal: 0.5, rough: 0.35 }), [0.6, 0, 0], view.barrel);
        br.rotation.z = -Math.PI / 2;
        if (this.q.outlines) addOutline(br, 0.04);
        mesh(torus(0.8, 0.14, 20), toy('#ffcc1a', { metal: 0.4 }), [1.95, 0, 0], view.barrel).rotation.y = Math.PI / 2;
        if (d.tap) { view.ring = new THREE.Mesh(torus(1.6, 0.1, 30), basic('#ffe14d', { opacity: 0.8 })); view.ring.rotation.x = Math.PI / 2; g.add(view.ring); }
      }
      this.scene.add(g);
      return view;
    });
  }

  // ---------- coins, stars, secrets ----------
  buildCollectibles() {
    const L = this.level;
    const coins = L.coins || [];
    this.coinMesh = new THREE.InstancedMesh(cylinder(0.42, 0.42, 0.12, 22), toy('#ffcc1a', { metal: 0.6, rough: 0.25, emissive: '#ffb000', ei: 0.35 }), Math.max(1, coins.length));
    this.coinMesh.count = coins.length;
    this.coinMesh.castShadow = true;
    this.scene.add(this.coinMesh);
    this.coinAnim = coins.map(() => ({ k: 0 }));
    const stars = L.stars || [];
    this.starMesh = new THREE.InstancedMesh(starGeometry(0.75, 0.34, 0.25), toy('#ffd21a', { rough: 0.3, emissive: '#ffb81a', ei: 0.55 }), Math.max(1, stars.length));
    this.starMesh.count = stars.length;
    this.starMesh.castShadow = true;
    this.scene.add(this.starMesh);
    this.starAnim = stars.map(() => ({ k: 0 }));
    this.secretViews = (L.secrets || []).map((s) => {
      const g = new THREE.Group(); g.position.set(...s.p);
      const box = new THREE.Mesh(roundBox(0.9, 0.8, 0.9, 0.12), toy('#9b5de5')); box.castShadow = true; g.add(box);
      const rib = new THREE.Mesh(roundBox(0.95, 0.85, 0.22, 0.06), toy('#ffe14d')); g.add(rib);
      const rib2 = new THREE.Mesh(roundBox(0.22, 0.85, 0.95, 0.06), toy('#ffe14d')); g.add(rib2);
      const lid = new THREE.Mesh(roundBox(1.0, 0.22, 1.0, 0.08), toy('#b07bff')); lid.position.y = 0.5; g.add(lid);
      this.scene.add(g);
      return { g, lid, open: 0 };
    });
  }

  // ---------- finish and start ----------
  buildFinish() {
    const F = this.level.finish, r = this.sim.finishR;
    if (F.p[1] < -50) { this.finishG = null; return; }
    const g = new THREE.Group(); g.position.set(...F.p);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(r, 40), texturedToy('checker', '#ffffff', [r, r], { rough: 0.6 }));
    disc.rotation.x = -Math.PI / 2; disc.position.y = 0.05; disc.receiveShadow = true; g.add(disc);
    const rim = new THREE.Mesh(torus(r, 0.12, 48), toy('#ffcc1a', { emissive: '#ffcc1a', ei: 0.4 })); rim.rotation.x = Math.PI / 2; rim.position.y = 0.08; g.add(rim);
    const yaw = Math.atan2(-(this.level.start.p[2] - F.p[2]), this.level.start.p[0] - F.p[0]);
    // The arch stands on the far side of the finish pad, facing the way the player comes from.
    const arch = new THREE.Group(); arch.rotation.y = yaw + Math.PI / 2; g.add(arch);
    arch.position.set(-Math.cos(yaw) * r * 0.55, 0, Math.sin(yaw) * r * 0.55);
    const archMesh = new THREE.Mesh(new THREE.TorusGeometry(Math.min(r, 3.4), 0.3, 12, 32, Math.PI), texturedToy('stripes', '#ffffff', [8, 1], { rough: 0.4 }));
    archMesh.castShadow = true; arch.add(archMesh);
    if (this.q.outlines) addOutline(archMesh, 0.03);
    for (const s of [-1, 1]) {
      const pole = new THREE.Mesh(cylinder(0.08, 0.08, 2.2, 8), toy('#ffffff')); pole.position.set(s * Math.min(r, 3.4), Math.min(r, 3.4) * 0 + 1.1, 0); arch.add(pole);
      const flag = flagMesh(s < 0 ? '#e8443a' : '#3b8fe8'); flag.position.set(s * Math.min(r, 3.4), 1.9, 0); arch.add(flag);
      this.flags.push(flag);
    }
    const topFlag = flagMesh('#ffe14d', 1.6, 1); topFlag.position.set(0, Math.min(r, 3.4) + 1.2, 0); arch.add(topFlag); this.flags.push(topFlag);
    const tp = new THREE.Mesh(cylinder(0.07, 0.07, 1.8, 6), toy('#ffffff')); tp.position.set(0, Math.min(r, 3.4) + 0.75, 0); arch.add(tp);
    const glow = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 5, 40, 1, true), basic('#fff27a', { opacity: 0.12, side: THREE.DoubleSide, add: true }));
    glow.position.y = 2.5; g.add(glow);
    this.finishGlow = glow;
    this.scene.add(g);
    this.finishG = g;

    // Start pad with an arrow.
    const S = this.level.start;
    const sp = new THREE.Group(); sp.position.set(S.p[0], S.p[1] - 0.58, S.p[2]); sp.rotation.y = (S.yaw || 0);
    const pad = new THREE.Mesh(cylinder(1.4, 1.4, 0.08, 32), toy('#ffffff', { rough: 0.4 })); sp.add(pad);
    const pad2 = new THREE.Mesh(cylinder(1.1, 1.1, 0.1, 32), toy('#3b8fe8', { rough: 0.4 })); sp.add(pad2);
    const flagS = flagMesh('#5cc95a', 1, 0.7); flagS.position.set(-1.2, 1.6, 1.2); sp.add(flagS); this.flags.push(flagS);
    const pole = new THREE.Mesh(cylinder(0.05, 0.05, 1.9, 6), toy('#ffffff')); pole.position.set(-1.2, 0.95, 1.2); sp.add(pole);
    this.scene.add(sp);
  }

  // ---------- aiming preview ----------
  buildAim() {
    this.dots = new THREE.InstancedMesh(sphere(0.14, 8), toy('#ffffff', { emissive: '#ffffff', ei: 0.6 }), 48);
    this.dots.count = 0; this.dots.frustumCulled = false;
    this.scene.add(this.dots);
    this.target = new THREE.Group();
    const tr = new THREE.Mesh(torus(0.9, 0.1, 28), basic('#ffffff', { opacity: 0.9 })); tr.rotation.x = Math.PI / 2; this.target.add(tr);
    const tr2 = new THREE.Mesh(torus(0.45, 0.08, 20), basic('#ffe14d', { opacity: 0.9 })); tr2.rotation.x = Math.PI / 2; this.target.add(tr2);
    this.target.visible = false;
    this.scene.add(this.target);
    this.aimCol = new THREE.Color();
  }
  setAim(pred, power, t) {
    if (!pred) { this.dots.count = 0; this.target.visible = false; return; }
    const pts = pred.pts, n = Math.min(48, pts.length);
    this.aimCol.setHSL(0.15 - power * 0.15, 1, 0.6);
    for (let i = 0; i < n; i++) {
      const p = pts[i], s = 1 - (i / n) * 0.5;
      const bob = 1 + Math.sin(t * 10 - i * 0.6) * 0.15;
      m4.compose(v3.set(p[0], p[1], p[2]), q.identity(), s3.setScalar(s * bob));
      this.dots.setMatrixAt(i, m4);
      this.dots.setColorAt(i, i % 2 ? this.aimCol : new THREE.Color('#ffffff'));
    }
    this.dots.count = n;
    this.dots.instanceMatrix.needsUpdate = true;
    if (this.dots.instanceColor) this.dots.instanceColor.needsUpdate = true;
    if (pred.hit) { this.target.visible = true; this.target.position.set(pred.hit[0], pred.hit[1] + 0.08, pred.hit[2]); this.target.scale.setScalar(1 + Math.sin(t * 6) * 0.08); } else this.target.visible = false;
  }

  // ---------- per frame ----------
  syncVehicle(alpha) {
    const a = this.sim.prev, b = this.sim.vehiclePose();
    this.vpos.set(a.p[0] + (b.p[0] - a.p[0]) * alpha, a.p[1] + (b.p[1] - a.p[1]) * alpha, a.p[2] + (b.p[2] - a.p[2]) * alpha);
    q.set(...a.q); q2.set(...b.q);
    this.vquat.copy(q).slerp(q2, alpha);
    this.vehicle.root.position.copy(this.vpos);
    this.vehicle.root.quaternion.copy(this.vquat);
    // Tucked into a cannon barrel: shrink out of sight.
    const inCannon = this.sim.state === 'cannon';
    const s = this.vehicle.root.scale.x + ((inCannon ? 0.01 : 1) - this.vehicle.root.scale.x) * 0.3;
    this.vehicle.root.scale.setScalar(s);
  }

  update(dt, alpha, extra = {}) {
    this.t += dt;
    const t = this.t, sim = this.sim;
    this.syncVehicle(alpha);
    this.syncProps();
    this.syncMovers();
    const vel = sim.vehicleVel(), speed = Math.hypot(vel.x, vel.z);
    this.vehicle.animate(dt, { speed: sim.state === 'aim' ? 0 : speed, air: sim.st.air, aim: extra.aimPower || 0, finish: sim.finished, hit: extra.hit || 0 });

    // Trail puffs while flying fast.
    this.trailT -= dt;
    if (sim.st.air > 0.15 && Math.hypot(vel.x, vel.y, vel.z) > 8 && this.trailT <= 0 && sim.state !== 'cannon') {
      this.trailT = 0.035;
      this.fx.trail([this.vpos.x, this.vpos.y, this.vpos.z], this.boostT > 0 ? '#7ee8ff' : '#ffffff');
    }
    this.boostT = Math.max(0, (this.boostT || 0) - dt);

    // Coins spin, collected ones fly up and shrink.
    const coins = this.level.coins || [];
    coins.forEach((c, i) => {
      const a = this.coinAnim[i];
      const got = sim.st.coins.includes(i);
      if (got) a.k = Math.min(1, a.k + dt * 2.5);
      const s = got ? Math.max(0, 1 - a.k) * (1 + a.k) : 1;
      m4.compose(v3.set(c[0], c[1] + Math.sin(t * 2 + i) * 0.12 + a.k * 2.5, c[2]), q.setFromEuler(e3.set(Math.PI / 2, t * 3 + i * 0.4 + a.k * 20, 0, 'YXZ')), s3.setScalar(s));
      this.coinMesh.setMatrixAt(i, m4);
    });
    this.coinMesh.instanceMatrix.needsUpdate = true;
    (this.level.stars || []).forEach((c, i) => {
      const a = this.starAnim[i];
      const got = sim.st.stars.includes(i);
      if (got) a.k = Math.min(1, a.k + dt * 1.8);
      const s = got ? Math.max(0, 1 - a.k) * (1 + a.k * 2) : 1 + Math.sin(t * 4 + i) * 0.08;
      m4.compose(v3.set(c[0], c[1] + Math.sin(t * 1.6 + i) * 0.25 + a.k * 4, c[2]), q.setFromEuler(e3.set(0, t * 1.5 + i, 0)), s3.setScalar(s));
      this.starMesh.setMatrixAt(i, m4);
      if (!got && Math.random() < dt * 3) this.fx.sparkle(c, 1);
    });
    this.starMesh.instanceMatrix.needsUpdate = true;
    this.secretViews.forEach((sv, i) => {
      const got = sim.st.secrets.includes(i);
      if (got) sv.open = Math.min(1, sv.open + dt * 2);
      sv.lid.position.y = 0.5 + sv.open * 1.2; sv.lid.rotation.z = sv.open * 1.2;
      sv.g.rotation.y = t * 0.8;
      sv.g.scale.setScalar(got ? Math.max(0.01, 1 - Math.max(0, sv.open - 0.5) * 2) : 1 + Math.sin(t * 5) * 0.05);
      if (!got && Math.random() < dt * 4) this.fx.sparkle(this.level.secrets[i].p, 1, '#e0c8ff');
    });

    // Gadget animation
    for (const gv of this.gadgetViews) {
      const d = gv.d;
      gv.k = Math.max(0, gv.k - dt * 3);
      if (d.t === 'boost' && gv.tex) gv.tex.offset.x = -t * 1.5;
      else if (d.t === 'spring') gv.top.scale.y = 1 + gv.k * 1.2;
      else if (d.t === 'trampoline') gv.top.position.y = 0.02 - Math.sin(gv.k * Math.PI) * 0.4;
      else if (d.t === 'fan') {
        if (gv.blades) gv.blades.rotation.y += dt * 18;
        gv.windT -= dt;
        if (gv.windT <= 0) {
          gv.windT = d.current ? 0.03 : 0.05;
          const p = [d.p[0] + (Math.random() - 0.5) * d.s[0], d.p[1] + (Math.random() - 0.5) * d.s[1], d.p[2] + (Math.random() - 0.5) * d.s[2]];
          this.fx.wind(p, [gv.dir.x * 10, gv.dir.y * 10, gv.dir.z * 10], d.current ? '#bfe8ff' : '#ffffff');
        }
      } else if (d.t === 'gravity') {
        gv.rings.forEach((r, i) => { const k = ((t * 0.35 + i / gv.rings.length) % 1); r.position.y = (k - 0.5) * d.s[1] * Math.sign(d.g[1] - (sim.gravity)); r.material.opacity = Math.sin(k * Math.PI) * 0.7; });
      } else if (d.t === 'cannon') {
        const yaw = sim.cannonYaw(d, sim.t);
        gv.turn.rotation.y = yaw;
        gv.barrel.position.x = -gv.k * 0.5;
        if (gv.ring) { gv.ring.visible = sim.state === 'cannon' && sim.st.cannon?.g === this.gadgetViews.indexOf(gv); gv.ring.scale.setScalar(1 + Math.sin(t * 10) * 0.1); }
      }
    }

    // Jelly wobble
    for (const j of this.jelly) {
      j.v += (-j.k * 160 - j.v * 8) * dt; j.k += j.v * dt;
      j.g.scale.set(1 + j.k * 0.3, 1 - j.k, 1 + j.k * 0.3);
    }
    for (const f of this.flags) f.userData.u.uT.value = t;
    if (this.finishGlow) { this.finishGlow.material.opacity = 0.1 + Math.sin(t * 3) * 0.04; this.finishGlow.rotation.y = t; }

    this.fx.update(dt);
    this.env.update(t, this.vpos);
  }

  // Visual reaction to simulation events.
  onEvent(ev) {
    const fx = this.fx;
    switch (ev.type) {
      case 'launch': this.vehicle.bump(0.25); fx.dust(this.sim.st.rest.p, 12, '#ffffff', 1.4); break;
      case 'hit': {
        const k = Math.min(1, ev.dv / 14);
        this.vehicle.bump(0.1 + k * 0.3);
        fx.dust(ev.p, Math.round(4 + k * 10), ev.mat === 'grass' ? '#d8f0c0' : ev.mat === 'sand' ? '#ffe9b0' : ev.mat === 'moon' ? '#d6d2ee' : '#f2ece2', 0.6 + k);
        if (k > 0.5) fx.sparks(ev.p, 8, '#ffe14d', 5);
        if (ev.part >= 0) { const j = this.jelly.find((x) => x.i === ev.part); if (j) j.v += 1.5 + k * 3; }
        break;
      }
      case 'break': {
        const slot = this.propSlots[ev.prop];
        fx.debris(ev.p, ev.v, slot?.color || '#d9ad74', 9, ev.kind === 'crate' ? 0.4 : 0.3, this.level.killY ?? -6);
        fx.dust(ev.p, 8, '#fff6e0', 1.2);
        break;
      }
      case 'coin': fx.sparks(ev.p, 10, '#ffe14d', 4); fx.ring(ev.p, '#ffcc1a', 12, 5); break;
      case 'star': fx.sparks(ev.p, 24, '#fff27a', 7); fx.ring(ev.p, '#ffffff', 20, 8); break;
      case 'secret': fx.confetti(ev.p, 50); fx.sparks(ev.p, 20, '#e0c8ff', 6); break;
      case 'boost': this.boostT = 0.8; fx.sparks(ev.p, 12, '#7ee8ff', 5); this.gv(ev.g).k = 1; break;
      case 'spring': this.gv(ev.g).k = 1; this.vehicle.bump(-0.3); fx.dust(ev.p, 10, '#ffffff', 1.2); break;
      case 'trampoline': this.gv(ev.g).k = 1; this.vehicle.bump(0.3); fx.ring(ev.p, '#ffe14d', 14, 5); break;
      case 'cannonFire': { this.gv(ev.g).k = 1; const d = this.gv(ev.g).d; const p = [d.p[0] + Math.cos(ev.yaw) * 2.4, d.p[1] + 1, d.p[2] - Math.sin(ev.yaw) * 2.4]; fx.dust(p, 18, '#d8d8e0', 2.2); fx.sparks(p, 16, '#ff9a1a', 8); break; }
      case 'splash': fx.splash(ev.p, this.world.id === 2 ? '#c47a50' : this.world.id === 4 ? '#c8b8ff' : '#bff0ff'); break;
      case 'splashProp': fx.splash(ev.p, this.world.id === 2 ? '#c47a50' : this.world.id === 4 ? '#c8b8ff' : '#bff0ff', 10); break;
      case 'finish': fx.confetti([ev.p[0], ev.p[1] + 1, ev.p[2]], 120, 1.2); fx.sparks(ev.p, 30, '#ffe14d', 9); break;
      case 'land': if (ev.air > 0.8) { fx.dust(ev.p, 14, '#ffffff', 1.6); this.vehicle.bump(0.35); } break;
      case 'flipUp': fx.sparkle([this.vpos.x, this.vpos.y, this.vpos.z], 10, '#ffffff'); break;
      case 'respawn': fx.sparkle([this.vpos.x, this.vpos.y, this.vpos.z], 14, '#ffffff'); break;
      default: break;
    }
  }
  gv(i) { return this.gadgetViews[i] || { k: 0, d: {} }; }

  // Developer view: Rapier's own collider wireframes.
  setDebug(on) {
    if (!on) { if (this.debugLines) { this.scene.remove(this.debugLines); this.debugLines.geometry.dispose(); this.debugLines = null; } return; }
    if (!this.debugLines) {
      this.debugLines = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ vertexColors: true, depthTest: false, transparent: true }));
      this.debugLines.renderOrder = 999; this.debugLines.frustumCulled = false;
      this.scene.add(this.debugLines);
    }
    const { vertices, colors } = this.sim.pw.debugRender();
    const g = this.debugLines.geometry;
    g.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    g.setAttribute('color', new THREE.BufferAttribute(colors, 4));
  }

  // Shared geometries and materials stay cached for the next level; instance buffers go.
  dispose() {
    this.scene.traverse((o) => { if (o.isInstancedMesh) o.dispose(); });
  }
}
