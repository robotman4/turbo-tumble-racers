// Small 3D diorama behind the menus: the chosen vehicle on a turntable in the backyard,
// hopping and flipping now and then. No physics, purely for show.
import * as THREE from 'three';
import { WORLDS } from '../game/worlds.js';
import { buildEnvironment } from './environment.js';
import { buildVehicle } from './vehicleMesh.js';
import { toy, roundBox, cylinder, sphere, torus, texturedToy } from './materials.js';

export class MenuStage {
  constructor(quality, worldId = 1) {
    this.q = quality;
    this.scene = new THREE.Scene();
    const world = WORLDS[worldId - 1];
    this.env = buildEnvironment(world, { min: [-20, 0, -20], max: [20, 0, 20] }, quality.decor * 0.8, 3);
    this.scene.add(this.env.group);
    this.scene.fog = this.env.fog;
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 1000);
    this.t = 0;
    this.shift = [0, 0];

    // Turntable island
    const base = new THREE.Mesh(cylinder(4.2, 4.6, 2.4, 40), toy('#a0703f', { rough: 0.9 }));
    base.position.y = -1.6; base.receiveShadow = true; this.scene.add(base);
    this.table = new THREE.Group(); this.scene.add(this.table);
    const top = new THREE.Mesh(cylinder(4, 4, 0.4, 40), texturedToy('grass', '#ffffff', [3, 3]));
    top.position.y = -0.2; top.receiveShadow = true; this.table.add(top);
    const ring = new THREE.Mesh(torus(4.05, 0.16, 48), toy('#ffcc1a', { emissive: '#ffcc1a', ei: 0.3 }));
    ring.rotation.x = Math.PI / 2; ring.position.y = 0; this.table.add(ring);
    // A few toys on the table
    const cols = world.blocks;
    [[2.4, 0.4, -1.6], [2.4, 1.2, -1.6], [2.4, 0.4, -0.8], [-2.6, 0.4, 1.2]].forEach((p, i) => {
      const b = new THREE.Mesh(roundBox(0.8, 0.8, 0.8, 0.12), toy(cols[i % cols.length])); b.position.set(...p); b.rotation.y = i * 0.4; b.castShadow = true; this.table.add(b);
    });
    const ball = new THREE.Mesh(sphere(0.6, 18), texturedToy('stripes', '#ffffff', [2, 1])); ball.position.set(-2.2, 0.6, -2); ball.castShadow = true; this.table.add(ball);
    this.coins = [];
    for (let i = 0; i < 6; i++) {
      const c = new THREE.Mesh(cylinder(0.35, 0.35, 0.1, 18), toy('#ffcc1a', { metal: 0.6, rough: 0.25, emissive: '#ffb000', ei: 0.35 }));
      c.rotation.x = Math.PI / 2; this.scene.add(c); this.coins.push(c);
    }
    this.vehicle = null;
    this.hop = { t: -1 };
  }

  setVehicle(def, paint) {
    if (this.vehicle) this.table.remove(this.vehicle.root);
    this.vehicle = buildVehicle(def, paint, this.q.outlines);
    this.vehicle.root.position.y = def.half[1] + 0.02;
    this.vehicle.root.scale.setScalar(1.5);
    this.table.add(this.vehicle.root);
    this.vehicle.bump(0.4);
    this.hop.t = 0;
  }

  // Where on screen the turntable sits, as a fraction of the view (0.5, 0.5 = centre).
  setAspect(a, cx = 0.5, cy = 0.5) {
    this.camera.aspect = a;
    this.camera.fov = a >= 1 ? 38 : 55;
    this.shift = [cx, cy];
    this.camera.updateProjectionMatrix();
  }

  update(dt, w = 1000, h = 750) {
    this.t += dt;
    const t = this.t;
    this.table.rotation.y = t * 0.35;
    // Camera framing with the table at the requested screen position.
    const dist = 23;
    this.camera.position.set(Math.sin(0.4) * dist, 5.2, Math.cos(0.4) * dist);
    this.camera.lookAt(0, 0.8, 0);
    this.camera.setViewOffset(w, h, (0.5 - this.shift[0]) * w, (0.5 - this.shift[1]) * h, w, h);
    this.coins.forEach((c, i) => {
      const a = t * 0.8 + (i / 6) * Math.PI * 2;
      c.position.set(Math.cos(a) * 3.2, 2.4 + Math.sin(t * 2 + i) * 0.3, Math.sin(a) * 3.2);
      c.rotation.z = t * 3 + i;
    });
    if (this.vehicle) {
      // Every few seconds: a happy hop with a flip.
      this.hop.t += dt;
      const ht = this.hop.t % 5;
      const v = this.vehicle;
      const base = v.def.half[1] * 1.5 + 0.02;
      if (ht < 1) {
        v.root.position.y = base + Math.sin(ht * Math.PI) * 2.2;
        v.root.rotation.z = ht * Math.PI * 2;
        if (ht > 0.95 && !this.hop.landed) { v.bump(0.35); this.hop.landed = true; }
      } else { v.root.position.y = base; v.root.rotation.z = 0; this.hop.landed = false; }
      v.animate(dt, { speed: 2, air: ht < 1 ? 1 : 0, aim: 0, finish: ht > 1 && ht < 2 });
    }
    this.env.update(t, null);
  }
}
