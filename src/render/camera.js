// Arcade camera rig with damped movement. Modes:
//   intro     short fly-in from the level's overview position to the launch view
//   launch    elevated behind the vehicle, looking down the aim direction
//   follow    chasing the vehicle along its direction of travel
//   air       wider and higher while the vehicle flies
//   cannon    behind a cannon while it aims
//   finish    slow celebratory orbit
//   overview  free look over the whole course (drag to orbit)
// A ray against the course keeps the camera from ending up behind walls.
import * as THREE from 'three';
import { yawDir } from '../game/launch.js';

const damp = (k, dt) => 1 - Math.exp(-k * dt);
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export class CameraRig {
  constructor(level, bounds) {
    this.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 1000);
    this.level = level;
    this.b = bounds;
    this.center = new THREE.Vector3((bounds.min[0] + bounds.max[0]) / 2, 0, (bounds.min[2] + bounds.max[2]) / 2);
    this.span = Math.max(bounds.max[0] - bounds.min[0], bounds.max[2] - bounds.min[2], 20);
    this.pos = new THREE.Vector3(...(level.cam || [this.center.x, 25, this.center.z + 25]));
    this.look = this.center.clone();
    this.mode = 'intro';
    this.introT = 0;
    this.introLen = 2.6;
    this.yaw = level.start.yaw || 0;
    this.fov = 55; this.fovBase = 55;
    this.orbit = 0;
    this.ov = { yaw: 0.6, pitch: 0.75, dist: this.span * 0.85 + 15 };
    this.shakeT = 0; this.shakeK = 0;
    this.tmp = new THREE.Vector3(); this.desP = new THREE.Vector3(); this.desL = new THREE.Vector3();
    this.camera.position.copy(this.pos);
    this.camera.lookAt(this.look);
  }

  setAspect(a) {
    this.camera.aspect = a;
    // Keep roughly the same horizontal view in portrait by widening the vertical angle.
    const h = 72 * Math.PI / 180;
    this.fovBase = a >= 1.25 ? 55 : Math.min(95, Math.max(55, (2 * Math.atan(Math.tan(h / 2) / a)) * 180 / Math.PI));
    this.camera.updateProjectionMatrix();
  }

  skipIntro() { if (this.mode === 'intro') this.introT = this.introLen; }
  shake(k) { this.shakeK = Math.max(this.shakeK, Math.min(1, k)); this.shakeT = 0.35; }
  toggleOverview(on) {
    this.mode = on ? 'overview' : 'launch';
    if (on) this.ov.yaw = Math.atan2(this.pos.x - this.center.x, this.pos.z - this.center.z);
  }
  dragOverview(dx, dy) { this.ov.yaw -= dx * 0.008; this.ov.pitch = Math.max(0.25, Math.min(1.35, this.ov.pitch + dy * 0.006)); }

  // ctx: { target: Vector3, vel, sim, aimYaw, state }
  update(dt, ctx) {
    const { target, vel, sim } = ctx;
    const st = sim.state;
    let kP = 3.2, kL = 6, fov = this.fovBase;

    if (this.mode !== 'overview' && this.mode !== 'intro') {
      if (st === 'finished') this.mode = 'finish';
      else if (st === 'cannon') this.mode = 'cannon';
      else if (st === 'aim' || st === 'out') this.mode = 'launch';
      else this.mode = sim.st.air > 0.45 ? 'air' : 'follow';
    }

    const P = this.desP, L = this.desL;
    if (this.mode === 'launch' || this.mode === 'intro') {
      this.yaw = ctx.aimYaw;
      const d = yawDir(this.yaw);
      P.set(target.x - d.x * 9.5, target.y + 4.8, target.z - d.z * 9.5);
      L.set(target.x + d.x * 5, target.y + 1.4, target.z + d.z * 5);
      kP = 2.6;
    } else if (this.mode === 'follow' || this.mode === 'air') {
      const sp = Math.hypot(vel.x, vel.z);
      if (sp > 2.5) {
        const head = Math.atan2(-vel.z, vel.x);
        let dy = head - this.yaw;
        while (dy > Math.PI) dy -= Math.PI * 2;
        while (dy < -Math.PI) dy += Math.PI * 2;
        this.yaw += dy * damp(this.mode === 'air' ? 1.0 : 1.8, dt);
      }
      const d = yawDir(this.yaw), air = this.mode === 'air';
      const back = air ? 13 : 10, up = air ? 6.5 + Math.max(0, -vel.y) * 0.08 : 4.8;
      P.set(target.x - d.x * back, target.y + up, target.z - d.z * back);
      L.set(target.x + d.x * 4, target.y + (air ? 0 : 0.8), target.z + d.z * 4);
      if (air) fov += 8;
      kP = air ? 2.4 : 3.2;
    } else if (this.mode === 'cannon') {
      const g = sim.gadgets[sim.st.cannon?.g ?? 0]?.def;
      const yaw = g ? sim.cannonYaw(g, sim.t) : this.yaw;
      this.yaw = yaw;
      const d = yawDir(yaw);
      P.set(target.x - d.x * 9, target.y + 5, target.z - d.z * 9);
      L.set(target.x + d.x * 10, target.y + 3, target.z + d.z * 10);
    } else if (this.mode === 'finish') {
      this.orbit += dt * 0.5;
      const a = this.yaw + Math.PI + Math.sin(this.orbit) * 0.9;
      const d = yawDir(a);
      P.set(target.x + d.x * 11, target.y + 5, target.z + d.z * 11);
      L.set(target.x, target.y + 0.8, target.z);
      kP = 1.8; fov -= 4;
    } else if (this.mode === 'overview') {
      const o = this.ov;
      P.set(this.center.x + Math.sin(o.yaw) * Math.cos(o.pitch) * o.dist, Math.sin(o.pitch) * o.dist + 2, this.center.z + Math.cos(o.yaw) * Math.cos(o.pitch) * o.dist);
      L.copy(this.center);
      kP = 4;
    }

    // Don't let walls or decks come between the camera and the vehicle.
    if (this.mode !== 'overview' && this.mode !== 'intro') {
      const from = [target.x, target.y + 0.8, target.z];
      const hit = sim.rayStatic(from, [P.x, P.y, P.z]);
      if (hit !== null) {
        this.tmp.set(P.x - from[0], P.y - from[1], P.z - from[2]).normalize();
        const d = Math.max(2.5, hit - 0.6);
        P.set(from[0] + this.tmp.x * d, from[1] + this.tmp.y * d + 1.2, from[2] + this.tmp.z * d);
      }
      P.y = Math.max(P.y, (sim.killY ?? -6) + 5);
    }

    if (this.mode === 'intro') {
      this.introT += dt;
      const k = ease(Math.min(1, this.introT / this.introLen));
      const s = this.start || (this.start = { p: this.pos.clone(), l: this.look.clone() });
      this.pos.lerpVectors(s.p, P, k);
      this.look.lerpVectors(s.l, L, k);
      if (this.introT >= this.introLen) this.mode = 'launch';
    } else {
      this.pos.lerp(P, damp(kP, dt));
      this.look.lerp(L, damp(kL, dt));
    }
    this.fov += (fov - this.fov) * damp(3, dt);

    this.camera.position.copy(this.pos);
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      const k = this.shakeK * Math.max(0, this.shakeT / 0.35) * 0.25;
      this.camera.position.x += (Math.random() - 0.5) * k; this.camera.position.y += (Math.random() - 0.5) * k;
    }
    this.camera.lookAt(this.look);
    if (Math.abs(this.camera.fov - this.fov) > 0.01) { this.camera.fov = this.fov; this.camera.updateProjectionMatrix(); }
  }
}
