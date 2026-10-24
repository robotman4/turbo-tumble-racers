// World look: sky, lights, the "void" under the course (pool, chocolate, sea, space)
// and scattered background decorations. Decorations are instanced and count scales with quality.
import * as THREE from 'three';
import { rng } from '../core.js';
import { toy, basic, roundBox, sphere, cylinder, cone, torus, texturedToy } from './materials.js';

const dummy = new THREE.Object3D();

function skyDome(top, bottom) {
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(top) }, bottom: { value: new THREE.Color(bottom) } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying vec3 vP; void main(){ float k = smoothstep(-0.15, 0.7, vP.y); gl_FragColor = vec4(mix(bottom, top, k), 1.0); \n#include <colorspace_fragment>\n }',
  });
  const s = new THREE.Mesh(new THREE.SphereGeometry(450, 24, 16), m);
  s.renderOrder = -10;
  return s;
}

// Water-like surface with gentle waves done in the vertex shader.
function liquid(color, deep, y, size, speed, opacity = 1) {
  const g = new THREE.PlaneGeometry(size, size, 80, 80);
  g.rotateX(-Math.PI / 2);
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.25, metalness: 0.05, transparent: opacity < 1, opacity });
  const uniforms = { uT: { value: 0 }, uDeep: { value: new THREE.Color(deep) } };
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uT = uniforms.uT;
    sh.vertexShader = 'uniform float uT;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      float w = sin(position.x * 0.18 + uT * ${speed.toFixed(2)}) * 0.25 + sin(position.z * 0.23 + uT * ${(speed * 0.8).toFixed(2)}) * 0.2 + sin((position.x + position.z) * 0.5 + uT * 2.0) * 0.06;
      transformed.y += w;`);
  };
  const mesh = new THREE.Mesh(g, m);
  mesh.position.y = y;
  mesh.receiveShadow = true;
  mesh.userData.uniforms = uniforms;
  return mesh;
}

function instanced(geometry, material, items, shadow = true) {
  const im = new THREE.InstancedMesh(geometry, material, Math.max(1, items.length));
  items.forEach((it, i) => {
    dummy.position.set(...it.p); dummy.rotation.set(...(it.r || [0, 0, 0])); dummy.scale.set(...(it.s || [1, 1, 1]));
    dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix);
    if (it.c) im.setColorAt(i, new THREE.Color(it.c));
  });
  im.count = items.length;
  im.castShadow = shadow; im.receiveShadow = true;
  if (im.instanceColor) im.instanceColor.needsUpdate = true;
  return im;
}

// Points on a ring around the course, avoiding the course box.
function ringPoints(R, n, center, rMin, rMax, y) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = R() * Math.PI * 2, r = rMin + R() * (rMax - rMin);
    out.push([center[0] + Math.cos(a) * r, y, center[2] + Math.sin(a) * r, a]);
  }
  return out;
}

function clouds(R, n, center, color, y0) {
  const items = [];
  for (let i = 0; i < n; i++) {
    const a = R() * Math.PI * 2, r = 90 + R() * 160, cx = center[0] + Math.cos(a) * r, cz = center[2] + Math.sin(a) * r, cy = y0 + R() * 40;
    for (let k = 0; k < 4; k++) items.push({ p: [cx + (k - 1.5) * 6 + R() * 3, cy + R() * 3, cz + R() * 4], s: [5 + R() * 4, 3.5 + R() * 2, 5 + R() * 3] });
  }
  return instanced(sphere(1, 12), toy(color, { rough: 1, emissive: color, ei: 0.25 }), items, false);
}

export function buildEnvironment(world, bounds, quality = 1, seed = 1) {
  const R = rng(seed * 7919 + world.id);
  const group = new THREE.Group();
  const center = [(bounds.min[0] + bounds.max[0]) / 2, 0, (bounds.min[2] + bounds.max[2]) / 2];
  const span = Math.max(bounds.max[0] - bounds.min[0], bounds.max[2] - bounds.min[2]);
  const inner = Math.max(55, span * 0.6 + 35);
  const updaters = [];

  group.add(skyDome(world.sky[0], world.sky[1]));

  // Lights: soft sky light plus a sun that casts the shadows.
  const hemi = new THREE.HemisphereLight(world.sky[0], world.id === 4 ? '#3a2a6a' : '#8a7a5a', world.id === 4 ? 1.4 : 1.25);
  group.add(hemi);
  const sun = new THREE.DirectionalLight(world.sun, world.id === 4 ? 2.0 : 2.4);
  sun.position.set(25, 45, 18);
  sun.castShadow = true;
  sun.shadow.camera.left = -28; sun.shadow.camera.right = 28; sun.shadow.camera.top = 28; sun.shadow.camera.bottom = -28;
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 140;
  sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.04;
  group.add(sun); group.add(sun.target);
  const amb = new THREE.AmbientLight('#ffffff', world.id === 4 ? 0.35 : 0.2);
  group.add(amb);

  const n = (k) => Math.round(k * quality);
  const vy = -3.2;

  if (world.void.kind === 'pool' || world.void.kind === 'chocolate' || world.void.kind === 'sea') {
    const choc = world.void.kind === 'chocolate';
    const water = liquid(world.void.color, world.void.deep, vy, 700, choc ? 0.7 : 1.2, choc ? 1 : 0.92);
    group.add(water);
    updaters.push((t) => { water.userData.uniforms.uT.value = t; });
  }

  if (world.id === 1) {
    // Lawn around the pool, trees, bushes, flowers, a fence and a house.
    const lawn = new THREE.Mesh(new THREE.RingGeometry(inner + 10, 600, 64, 1), toy('#6cc84a', { rough: 0.9 }));
    lawn.rotation.x = -Math.PI / 2; lawn.position.y = -2.4; lawn.receiveShadow = true;
    group.add(lawn);
    const edge = new THREE.Mesh(new THREE.TorusGeometry(inner + 8, 2.2, 8, 80), toy('#ffffff', { rough: 0.4 }));
    edge.rotation.x = -Math.PI / 2; edge.position.y = -2.7; group.add(edge);
    edge.position.x = center[0]; edge.position.z = center[2]; lawn.position.x = center[0]; lawn.position.z = center[2];
    const trees = ringPoints(R, n(26), center, inner + 20, inner + 90, -2.4);
    group.add(instanced(cylinder(0.8, 1.1, 6, 8), toy('#8a5a2b', { rough: 0.9 }), trees.map((p) => ({ p: [p[0], p[1] + 3, p[2]] }))));
    const greens = ['#4fb83a', '#62c94a', '#3fa63a', '#7ad65a'];
    group.add(instanced(sphere(1, 12), toy('#ffffff', { rough: 0.8 }), trees.flatMap((p, i) => [
      { p: [p[0], p[1] + 9, p[2]], s: [5, 4.5, 5], c: greens[i % 4] },
      { p: [p[0] + 2.5, p[1] + 7.5, p[2] + 1], s: [3.4, 3, 3.4], c: greens[(i + 1) % 4] },
    ])));
    const bushes = ringPoints(R, n(40), center, inner + 12, inner + 40, -2.4);
    group.add(instanced(sphere(1, 10), toy('#ffffff', { rough: 0.8 }), bushes.map((p, i) => ({ p: [p[0], p[1] + 0.8, p[2]], s: [2.2, 1.6, 2.2], c: greens[i % 4] }))));
    const flowerCols = ['#ff5e8a', '#ffe14d', '#ffffff', '#b07bff', '#ff9a3d'];
    const flowers = ringPoints(R, n(120), center, inner + 11, inner + 60, -2.4);
    group.add(instanced(sphere(0.5, 8), toy('#ffffff', { rough: 0.6 }), flowers.map((p, i) => ({ p: [p[0], p[1] + 0.4, p[2]], c: flowerCols[i % 5] })), false));
    // House far away
    const hx = center[0] - 40, hz = center[2] - inner - 70;
    const house = new THREE.Group(); house.position.set(hx, -2.4, hz);
    const hb = new THREE.Mesh(roundBox(36, 20, 20, 1), toy('#fff1d6')); hb.position.y = 10; house.add(hb);
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 16, 12, 4, 1), toy('#e8443a')); roof.scale.set(1.6, 1, 0.9); roof.rotation.y = Math.PI / 4; roof.position.y = 26; house.add(roof);
    for (const x of [-10, 0, 10]) { const w = new THREE.Mesh(roundBox(5, 5, 0.6, 0.3), toy('#7ee8ff', { emissive: '#7ee8ff', ei: 0.2 })); w.position.set(x, 12, 10.1); house.add(w); }
    const door = new THREE.Mesh(roundBox(5, 9, 0.6, 0.4), toy('#3b8fe8')); door.position.set(0, 4.5, 10.2); house.add(door);
    group.add(house);
    // Giant floating rubber duck and a beach ball in the pool
    const duck = new THREE.Group();
    const db = new THREE.Mesh(sphere(3, 16), toy('#ffd21a')); db.scale.set(1.3, 0.9, 1); duck.add(db);
    const dh = new THREE.Mesh(sphere(1.9, 16), toy('#ffd21a')); dh.position.set(2.2, 2.6, 0); duck.add(dh);
    const bk = new THREE.Mesh(cone(0.8, 1.6, 10), toy('#ff8a1a')); bk.rotation.z = -Math.PI / 2; bk.position.set(4.3, 2.4, 0); duck.add(bk);
    for (const s of [-1, 1]) { const e = new THREE.Mesh(sphere(0.3, 8), toy('#2a1f3d')); e.position.set(3.4, 3.1, s * 0.9); duck.add(e); }
    duck.position.set(center[0] + span * 0.3 + 10, vy + 0.6, center[2] + inner * 0.55);
    duck.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    group.add(duck);
    updaters.push((t) => { duck.position.y = vy + 0.6 + Math.sin(t * 1.3) * 0.25; duck.rotation.z = Math.sin(t * 1.1) * 0.05; duck.rotation.y = Math.sin(t * 0.2) * 0.4; });
    group.add(clouds(R, n(10), center, '#ffffff', 50));
  } else if (world.id === 2) {
    const ground = new THREE.Mesh(new THREE.RingGeometry(inner + 10, 600, 64, 1), toy('#ffc4e1', { rough: 0.8 }));
    ground.rotation.x = -Math.PI / 2; ground.position.set(center[0], -2.4, center[2]); ground.receiveShadow = true; group.add(ground);
    const cols = ['#ff5ec4', '#7ee8ff', '#fff27a', '#b07bff', '#7cf2a0', '#ff9a5e'];
    const lollis = ringPoints(R, n(22), center, inner + 15, inner + 80, -2.4);
    group.add(instanced(cylinder(0.35, 0.35, 12, 8), toy('#ffffff', { rough: 0.4 }), lollis.map((p) => ({ p: [p[0], p[1] + 6, p[2]] }))));
    group.add(instanced(cylinder(4, 4, 1.2, 24), toy('#ffffff', { rough: 0.3 }), lollis.map((p, i) => ({ p: [p[0], p[1] + 14, p[2]], r: [Math.PI / 2, p[3], 0], c: cols[i % 6] }))));
    group.add(instanced(torus(2.6, 0.5, 20), toy('#ffffff', { rough: 0.3 }), lollis.map((p) => ({ p: [p[0], p[1] + 14, p[2]], r: [0, p[3] + Math.PI / 2, 0] }))));
    const drops = ringPoints(R, n(36), center, inner + 12, inner + 60, -2.4);
    group.add(instanced(sphere(1, 14), toy('#ffffff', { rough: 0.35 }), drops.map((p, i) => ({ p: [p[0], p[1], p[2]], s: [3 + (i % 3), 3.5 + (i % 2) * 2, 3 + (i % 3)], c: cols[(i + 2) % 6] }))));
    const canes = ringPoints(R, n(14), center, inner + 20, inner + 70, -2.4);
    const caneMat = texturedToy('stripes', '#ffffff', [1, 6], { rough: 0.3 });
    group.add(instanced(cylinder(0.6, 0.6, 14, 12), caneMat, canes.map((p) => ({ p: [p[0], p[1] + 7, p[2]] }))));
    group.add(instanced(torus(2, 0.6, 16, Math.PI), caneMat, canes.map((p) => ({ p: [p[0] - 2, p[1] + 14, p[2]], r: [0, p[3], 0] }))));
    group.add(clouds(R, n(10), center, '#ffe0f2', 50));
  } else if (world.id === 3) {
    const isl = ringPoints(R, n(9), center, inner + 15, inner + 110, vy);
    group.add(instanced(sphere(1, 18), toy('#f2d38a', { rough: 0.9 }), isl.map((p) => ({ p: [p[0], p[1] - 2, p[2]], s: [14, 6, 14] }))));
    const palms = isl.flatMap((p) => [[p[0] + 2, p[2] - 1], [p[0] - 4, p[2] + 3]]);
    group.add(instanced(cylinder(0.5, 0.8, 10, 8), toy('#a0602d', { rough: 0.9 }), palms.map((q) => ({ p: [q[0], vy + 7, q[1]], r: [0.15, 0, 0.12] }))));
    group.add(instanced(cone(1.2, 7, 4), toy('#3fa63a', { rough: 0.8 }), palms.flatMap((q) => [0, 1, 2, 3, 4].map((k) => ({ p: [q[0] + Math.cos(k * 1.26) * 2.5, vy + 12, q[1] + Math.sin(k * 1.26) * 2.5], r: [Math.sin(k * 1.26) * 1.3, 0, -Math.cos(k * 1.26) * 1.3], s: [1, 1, 0.35] })))));
    const rocks = ringPoints(R, n(18), center, inner + 5, inner + 50, vy);
    group.add(instanced(new THREE.DodecahedronGeometry(1, 0), toy('#8a8a9a', { flat: true }), rocks.map((p, i) => ({ p: [p[0], p[1], p[2]], s: [2 + (i % 3), 2 + (i % 2) * 1.5, 2 + (i % 3)], r: [i, i * 2, 0] }))));
    // Pirate ship on the horizon
    const ship = new THREE.Group();
    const hull = new THREE.Mesh(roundBox(30, 7, 10, 2), toy('#8a5a2b')); hull.position.y = 2; ship.add(hull);
    const stripe = new THREE.Mesh(roundBox(30.4, 1.2, 10.4, 0.5), toy('#ffcc1a')); stripe.position.y = 4.4; ship.add(stripe);
    for (const [x, h] of [[-7, 22], [5, 26]]) {
      const mast = new THREE.Mesh(cylinder(0.5, 0.6, h, 8), toy('#6b4423')); mast.position.set(x, 4 + h / 2, 0); ship.add(mast);
      const sail = new THREE.Mesh(roundBox(0.6, h * 0.45, 12, 0.3), toy('#fff8e8', { rough: 0.9 })); sail.position.set(x + 0.8, 5 + h * 0.55, 0); ship.add(sail);
    }
    const flag = new THREE.Mesh(roundBox(0.2, 2.4, 3.6, 0.1), toy('#2a1f3d')); flag.position.set(5, 31.5, 1.6); ship.add(flag);
    ship.position.set(center[0] + 60, vy, center[2] - inner - 60); ship.rotation.y = 0.4;
    ship.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    group.add(ship);
    updaters.push((t) => { ship.rotation.z = Math.sin(t * 0.6) * 0.04; ship.position.y = vy + Math.sin(t * 0.8) * 0.4; });
    group.add(clouds(R, n(12), center, '#ffffff', 55));
  } else if (world.id === 4) {
    // Stars, planets and drifting space rocks.
    const N = n(1500), pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const u = R() * 2 - 1, a = R() * Math.PI * 2, r = 380, s = Math.sqrt(1 - u * u);
      pos[i * 3] = Math.cos(a) * s * r; pos[i * 3 + 1] = Math.abs(u) * r * 0.9 - 40; pos[i * 3 + 2] = Math.sin(a) * s * r;
    }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: '#ffffff', size: 1.6, sizeAttenuation: false, fog: false }));
    group.add(stars);
    const planet = new THREE.Mesh(sphere(30, 32), toy('#ff8ad6', { rough: 0.8, emissive: '#ff5ec4', ei: 0.15 }));
    planet.position.set(center[0] + 120, 90, center[2] - 220); group.add(planet);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(46, 3, 4, 64), toy('#ffe14d', { emissive: '#ffcc1a', ei: 0.2 }));
    ring.position.copy(planet.position); ring.rotation.set(1.2, 0.2, 0.3); group.add(ring);
    const earth = new THREE.Mesh(sphere(14, 24), toy('#3b8fe8', { emissive: '#1d5fb0', ei: 0.2 }));
    earth.position.set(center[0] - 150, 70, center[2] + 160); group.add(earth);
    for (let i = 0; i < 6; i++) { const c = new THREE.Mesh(sphere(5, 10), toy('#5cc95a', { emissive: '#3a9b34', ei: 0.2 })); c.position.set(Math.cos(i) * 10, Math.sin(i * 2) * 8, Math.sin(i) * 10); c.scale.set(1, 0.6, 1); earth.add(c); }
    const rocks = ringPoints(R, n(30), center, inner, inner + 100, 0).map((p) => [p[0], -20 + R() * 60, p[2]]);
    const rockMesh = instanced(new THREE.DodecahedronGeometry(1, 0), toy('#9a94c6', { flat: true }), rocks.map((p, i) => ({ p, s: [2 + (i % 4), 2 + (i % 3), 2 + (i % 4)], r: [i, i * 0.7, 0] })));
    group.add(rockMesh);
    updaters.push((t) => { rockMesh.rotation.y = t * 0.01; planet.rotation.y = t * 0.05; });
    // A big moon surface far below the course.
    const floor = new THREE.Mesh(new THREE.CircleGeometry(500, 48), toy('#4a3f7a', { rough: 1 }));
    floor.rotation.x = -Math.PI / 2; floor.position.set(center[0], -60, center[2]); group.add(floor);
  }

  return {
    group, sun, hemi,
    fog: new THREE.Fog(world.fog, world.id === 4 ? 120 : 110, world.id === 4 ? 420 : 380),
    update(t, focus) {
      for (const u of updaters) u(t);
      // Keep the sun's shadow box centred on the action so shadows stay sharp.
      if (focus) {
        sun.position.set(focus.x + 25, focus.y + 45, focus.z + 18);
        sun.target.position.set(focus.x, focus.y, focus.z);
      }
    },
  };
}
