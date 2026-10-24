// Gameplay simulation: Rapier rigid bodies plus the game rules on top (launching, gadgets,
// collectibles, scoring, settling, respawning). No rendering and no DOM, so the exact same
// code runs in the browser, in the headless level solver and in the tests.
//
// Fixed timestep (DT). Everything is deterministic for a given level, vehicle and list of
// launches made when the vehicle comes to rest, which is what the solver relies on.
import RAPIER from '@dimforge/rapier3d-compat';
import { Euler, Quaternion, Vector3 } from 'three';
import { SURFACES, worldById } from './worlds.js';
import { ScoreKeeper } from './scoring.js';
import { launchVelocity, yawDir, DEG } from './launch.js';

export const DT = 1 / 60;

let ready = null;
export function initPhysics() {
  if (!ready) ready = RAPIER.init();
  return ready;
}

// Collision layers: membership << 16 | filter.
export const L_STATIC = 0x1, L_VEH = 0x2, L_PROP = 0x4, L_MOVER = 0x8;
const groups = (member, filter) => (member << 16) | filter;
const G_STATIC = groups(L_STATIC, L_VEH | L_PROP);
const G_MOVER = groups(L_MOVER, L_VEH | L_PROP);
const G_VEH = groups(L_VEH, L_STATIC | L_PROP | L_MOVER);
const G_PROP = groups(L_PROP, L_STATIC | L_PROP | L_MOVER | L_VEH);
export const G_CAMERA = groups(0xffff, L_STATIC | L_MOVER);
const G_PREDICT = groups(0xffff, L_STATIC | L_MOVER | L_PROP);

// Physical props. `knock`: how a prop counts as destroyed (moved away, tipped over).
// `breakDV`: change of speed in one hit that smashes it (null = unbreakable).
export const PROP_KINDS = {
  block: { shape: 'box', half: [0.4, 0.4, 0.4], density: 0.5, bounce: 0.1, friction: 0.7, breakDV: 9, knock: 1.0 },
  crate: { shape: 'box', half: [0.6, 0.6, 0.6], density: 0.18, bounce: 0.05, friction: 0.8, breakDV: 6, knock: 1.0 },
  plank: { shape: 'box', half: [0.15, 0.9, 0.9], density: 0.4, bounce: 0.1, friction: 0.7, breakDV: 8, knock: 1.0 },
  pin: { shape: 'cyl', r: 0.24, hh: 0.6, density: 0.35, bounce: 0.3, friction: 0.5, breakDV: null, knock: 'tilt' },
  domino: { shape: 'box', half: [0.13, 0.65, 0.4], density: 0.6, bounce: 0.05, friction: 0.6, breakDV: null, knock: 'tilt' },
  barrel: { shape: 'cyl', r: 0.48, hh: 0.6, density: 0.35, bounce: 0.2, friction: 0.6, breakDV: 12, knock: 1.5 },
  ball: { shape: 'ball', r: 0.65, density: 0.08, bounce: 0.85, friction: 0.5, breakDV: null, knock: 2.0 },
  duck: { shape: 'ball', r: 0.55, density: 0.12, bounce: 0.6, friction: 0.5, breakDV: null, knock: 1.5 },
  gumdrop: { shape: 'ball', r: 0.5, density: 0.25, bounce: 0.7, friction: 0.6, breakDV: null, knock: 1.5 },
  rock: { shape: 'ball', r: 0.6, density: 0.3, bounce: 0.4, friction: 0.7, breakDV: 10, knock: 1.5 },
};

const MAX_VEH_SPEED = 42, MAX_VEH_SPIN = 16, MAX_PROP_SPEED = 35;
const SETTLE_SPEED = 0.35, SETTLE_SPIN = 0.7, SETTLE_TIME = 0.5, FLIGHT_TIMEOUT = 14;

const _q = new Quaternion(), _q2 = new Quaternion(), _e = new Euler(), _v = new Vector3(), _ax = new Vector3();
const toQ = (r) => {
  if (!r) return { x: 0, y: 0, z: 0, w: 1 };
  _e.set(r[0] * DEG, r[1] * DEG, r[2] * DEG, 'YXZ');
  _q.setFromEuler(_e);
  return { x: _q.x, y: _q.y, z: _q.z, w: _q.w };
};
const yawQ = (yaw) => { _q.setFromAxisAngle(_v.set(0, 1, 0), yaw); return { x: _q.x, y: _q.y, z: _q.z, w: _q.w }; };
const len3 = (v) => Math.hypot(v.x, v.y, v.z);

function surfaceDesc(desc, matName) {
  const m = SURFACES[matName] || SURFACES.wood;
  desc.setFriction(m.friction).setRestitution(m.bounce);
  if (m.combine === 'max') { desc.setFrictionCombineRule(RAPIER.CoefficientCombineRule.Max); desc.setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Max); }
  if (m.combine === 'min') desc.setFrictionCombineRule(RAPIER.CoefficientCombineRule.Min);
  return desc;
}

// Point inside an oriented box zone (center p, full size s, rotated by yaw around y).
function inZone(pos, p, s, yaw = 0) {
  const dx = pos.x - p[0], dz = pos.z - p[2];
  const c = Math.cos(yaw), sn = Math.sin(yaw);
  const lx = dx * c - dz * sn, lz = dx * sn + dz * c;
  return Math.abs(lx) <= s[0] / 2 && Math.abs(pos.y - p[1]) <= s[1] / 2 && Math.abs(lz) <= s[2] / 2;
}

export class Sim {
  // opts: { easy, unlimited }
  constructor(level, vehicle, opts = {}) {
    this.level = level;
    this.veh = vehicle;
    this.opts = opts;
    this.world = worldById(level.world);
    this.gravity = level.gravity ?? this.world.gravity;
    this.maxLaunches = opts.unlimited || level.launches === 0 ? Infinity : (level.launches || 3);
    this.finishR = (level.finish.r || 3) * (opts.easy ? 1.4 : 1);
    this.collectR = opts.easy ? 1.7 : 1.15;
    this.moverSpeed = opts.easy ? 0.7 : 1;
    this.killY = level.killY ?? -6;
    this.groundDrag = 0.35 + Math.max(0, (18 + this.gravity) / 18) * 1.6;
    this.out = [];
    this.build();
  }

  // ---------- construction ----------
  build() {
    const L = this.level;
    const w = (this.pw = new RAPIER.World({ x: 0, y: this.gravity, z: 0 }));
    w.timestep = DT;
    this.queue = new RAPIER.EventQueue(true);
    this.colMap = new Map(); // collider handle -> { kind, ref }

    // Static course pieces all hang off one fixed body.
    const ground = w.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    this.parts = (L.parts || []).map((def, i) => {
      const part = { i, def, mat: def.mat || this.world.ground };
      const d = this.partCollider(def);
      d.setCollisionGroups(G_STATIC);
      surfaceDesc(d, part.mat);
      part.ch = w.createCollider(d, ground).handle;
      this.colMap.set(part.ch, { kind: 'part', ref: part });
      return part;
    });

    // Gadgets: zones handled in JS, some with a small static collider of their own.
    this.gadgets = (L.gadgets || []).map((def, i) => {
      const g = { i, def, cool: 0, anim: 0 };
      let d = null;
      if (def.t === 'spring') d = RAPIER.ColliderDesc.cuboid(0.9, 0.15, 0.9).setTranslation(def.p[0], def.p[1] - 0.15, def.p[2]);
      if (def.t === 'trampoline') d = RAPIER.ColliderDesc.cylinder(0.4, def.r || 1.6).setTranslation(def.p[0], def.p[1] - 0.4, def.p[2]);
      if (def.t === 'cannon') d = RAPIER.ColliderDesc.cuboid(0.9, 0.4, 0.9).setTranslation(def.p[0], def.p[1] - 1.5, def.p[2]);
      if (d) {
        d.setCollisionGroups(G_STATIC); surfaceDesc(d, def.t === 'trampoline' ? 'rubber' : 'metal');
        g.ch = w.createCollider(d, ground).handle;
        this.colMap.set(g.ch, { kind: 'gadget', ref: g });
      }
      return g;
    });

    // Moving obstacles: kinematic bodies driven from the sim clock.
    this.movers = (L.movers || []).map((def, i) => this.buildMover(def, i));

    // Props: dynamic bodies.
    this.props = (L.props || []).map((def, i) => this.buildProp(def, i));

    // The vehicle.
    const V = this.veh, S = L.start;
    const b = w.createRigidBody(RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(S.p[0], S.p[1], S.p[2]).setRotation(yawQ(S.yaw || 0))
      .setCcdEnabled(true).setAngularDamping(0.35).setLinearDamping(0.04)
      .setGravityScale(V.gravity));
    const hx = V.half;
    const cd = RAPIER.ColliderDesc.roundCuboid(hx[0] - V.round, hx[1] - V.round, hx[2] - V.round, V.round)
      .setDensity(V.density).setFriction(V.grip).setRestitution(V.bounce)
      .setCollisionGroups(G_VEH)
      .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS | RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS);
    const vc = w.createCollider(cd, b);
    this.vh = b.handle; this.vch = vc.handle;
    this.vmass = b.mass();
    vc.setContactForceEventThreshold(this.vmass * 60 * 1.5);
    this.colMap.set(this.vch, { kind: 'veh' });

    // Mutable game state (everything the snapshot needs besides Rapier itself).
    this.st = {
      t: 0, state: 'aim', used: 0, aimYaw: S.yaw || 0,
      rest: { p: [...S.p], yaw: S.yaw || 0 },
      flyT: 0, stillT: 0, air: 0, turns: 0, grounded: true,
      coins: [], stars: [], secrets: [], cannon: null, finishedT: -1,
      hitCool: 0, clackCool: 0, launches: [],
      props: this.props.map(() => ({ scored: false, broken: false, vhit: false, gone: false })),
      gcool: this.gadgets.map(() => 0),
    };
    this.score = new ScoreKeeper();
    this.prev = this.vehiclePose();
  }

  partCollider(def) {
    let d;
    if (def.t === 'box') d = RAPIER.ColliderDesc.cuboid(def.s[0] / 2, def.s[1] / 2, def.s[2] / 2);
    else if (def.t === 'cyl') d = RAPIER.ColliderDesc.cylinder(def.h / 2, def.r);
    else if (def.t === 'wedge') {
      const [l, h, wd] = def.s;
      const pts = new Float32Array([
        -l / 2, 0, -wd / 2, -l / 2, 0, wd / 2, l / 2, 0, -wd / 2, l / 2, 0, wd / 2, l / 2, h, -wd / 2, l / 2, h, wd / 2,
      ]);
      d = RAPIER.ColliderDesc.convexHull(pts);
    } else throw new Error('unknown part type ' + def.t);
    d.setTranslation(def.p[0], def.p[1], def.p[2]);
    // Only boxes take an [x, y, z] rotation; for cylinders `r` is the radius.
    d.setRotation(def.t === 'wedge' ? yawQ((def.yaw || 0) * DEG) : def.t === 'box' ? toQ(def.r) : toQ(null));
    return d;
  }

  buildMover(def, i) {
    const w = this.pw;
    const b = w.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(def.p[0], def.p[1], def.p[2]));
    const m = { i, def, h: b.handle, chs: [] };
    const add = (d) => {
      d.setCollisionGroups(G_MOVER); surfaceDesc(d, def.mat || 'plastic');
      const c = w.createCollider(d, b);
      m.chs.push(c.handle);
      this.colMap.set(c.handle, { kind: 'mover', ref: m });
    };
    if (def.t === 'slider' || def.t === 'float') add(RAPIER.ColliderDesc.cuboid(def.s[0] / 2, def.s[1] / 2, def.s[2] / 2));
    else if (def.t === 'spinner') {
      const [l, h, th] = def.s;
      add(RAPIER.ColliderDesc.cuboid(l / 2, h / 2, th / 2));
      if (def.arms === 2) add(RAPIER.ColliderDesc.cuboid(th / 2, h / 2, l / 2));
    } else if (def.t === 'pendulum') {
      add(RAPIER.ColliderDesc.cuboid(0.12, def.len / 2, 0.12).setTranslation(0, -def.len / 2, 0));
      const hd = def.head || [1.2, 1.2, 1.6];
      add(RAPIER.ColliderDesc.cuboid(hd[0] / 2, hd[1] / 2, hd[2] / 2).setTranslation(0, -def.len, 0));
    } else if (def.t === 'bridge') {
      add(RAPIER.ColliderDesc.cuboid(def.len / 2, 0.2, (def.w || 3) / 2).setTranslation(def.len / 2, -0.2, 0));
    } else throw new Error('unknown mover type ' + def.t);
    this.poseMover(m, 0, true);
    return m;
  }

  // Pose of a mover at time t. Kinematic bodies get it as their next target, so Rapier
  // gives them the right velocity and they push and carry things properly.
  poseMover(m, t, teleport = false) {
    const d = m.def, b = this.pw.getRigidBody(m.h);
    const ts = t * this.moverSpeed, TAU = Math.PI * 2;
    let pos = { x: d.p[0], y: d.p[1], z: d.p[2] }, rot = { x: 0, y: 0, z: 0, w: 1 };
    const per = d.period || 4, ph = d.phase || 0;
    if (d.t === 'slider' || d.t === 'float') {
      const to = d.to || [0, d.bob || 0.6, 0];
      const k = 0.5 - 0.5 * Math.cos(TAU * (ts / per + ph));
      pos = { x: d.p[0] + to[0] * k, y: d.p[1] + to[1] * k, z: d.p[2] + to[2] * k };
      rot = yawQ((d.yaw || 0) * DEG);
    } else if (d.t === 'spinner') {
      const axis = d.axis === 'x' ? [1, 0, 0] : d.axis === 'z' ? [0, 0, 1] : [0, 1, 0];
      _q.setFromAxisAngle(_v.set(...axis), (d.speed || 1.5) * ts + ph * TAU);
      _q2.setFromAxisAngle(_v.set(0, 1, 0), (d.yaw || 0) * DEG);
      _q2.multiply(_q);
      rot = { x: _q2.x, y: _q2.y, z: _q2.z, w: _q2.w };
    } else if (d.t === 'pendulum') {
      const yaw = (d.yaw || 0) * DEG, dir = yawDir(yaw);
      const a = (d.amp || 50) * DEG * Math.sin(TAU * (ts / per + ph));
      _ax.set(dir.z, 0, -dir.x).normalize();
      _q.setFromAxisAngle(_ax, a);
      _q2.setFromAxisAngle(_v.set(0, 1, 0), yaw);
      _q.multiply(_q2);
      rot = { x: _q.x, y: _q.y, z: _q.z, w: _q.w };
    } else if (d.t === 'bridge') {
      const k = 0.5 - 0.5 * Math.cos(TAU * (ts / per + ph));
      _q.setFromAxisAngle(_v.set(0, 1, 0), (d.yaw || 0) * DEG);
      _q2.setFromAxisAngle(_v.set(0, 0, 1), (d.amp || 60) * DEG * k);
      _q.multiply(_q2);
      rot = { x: _q.x, y: _q.y, z: _q.z, w: _q.w };
    }
    if (teleport) { b.setTranslation(pos, true); b.setRotation(rot, true); } else { b.setNextKinematicTranslation(pos); b.setNextKinematicRotation(rot); }
  }

  buildProp(def, i) {
    const K = PROP_KINDS[def.t];
    if (!K) throw new Error('unknown prop ' + def.t);
    const w = this.pw;
    const rot = def.r ? toQ(def.r) : yawQ((def.yaw || 0) * DEG);
    const b = w.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(def.p[0], def.p[1], def.p[2]).setRotation(rot)
      .setLinearDamping(0.05).setAngularDamping(0.2).setCcdEnabled(K.shape === 'ball'));
    let d;
    const half = def.s ? [def.s[0] / 2, def.s[1] / 2, def.s[2] / 2] : K.half;
    if (K.shape === 'box') d = RAPIER.ColliderDesc.cuboid(...half);
    else if (K.shape === 'cyl') d = RAPIER.ColliderDesc.cylinder(def.hh || K.hh, def.rad || K.r);
    else d = RAPIER.ColliderDesc.ball(def.rad || K.r);
    d.setDensity(K.density).setRestitution(K.bounce).setFriction(K.friction).setCollisionGroups(G_PROP)
      .setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS);
    const c = w.createCollider(d, b);
    const mass = b.mass();
    c.setContactForceEventThreshold(mass * 60 * 2.5);
    // Start asleep so towers stand still until something hits them.
    b.sleep();
    const p = { i, def, kind: def.t, K, h: b.handle, ch: c.handle, mass, home: [...def.p], half };
    this.colMap.set(p.ch, { kind: 'prop', ref: p });
    return p;
  }

  // ---------- queries ----------
  get state() { return this.st.state; }
  get t() { return this.st.t; }
  get launchesLeft() { return this.maxLaunches - this.st.used; }
  get finished() { return this.st.state === 'finished'; }
  body() { return this.pw.getRigidBody(this.vh); }
  propBody(p) { return this.st.props[p.i].gone ? null : this.pw.getRigidBody(p.h); }
  moverBody(m) { return this.pw.getRigidBody(m.h); }

  vehiclePose() {
    const b = this.body(), t = b.translation(), r = b.rotation();
    return { p: [t.x, t.y, t.z], q: [r.x, r.y, r.z, r.w] };
  }
  vehicleVel() { return this.body().linvel(); }

  // Heading of the vehicle (yaw of its nose projected on the ground).
  vehicleYaw() {
    const r = this.body().rotation();
    _q.set(r.x, r.y, r.z, r.w);
    _v.set(1, 0, 0).applyQuaternion(_q);
    if (Math.hypot(_v.x, _v.z) < 0.2) return this.st.aimYaw;
    return Math.atan2(-_v.z, _v.x);
  }
  vehicleUp() {
    const r = this.body().rotation();
    _q.set(r.x, r.y, r.z, r.w);
    return _v.set(0, 1, 0).applyQuaternion(_q).y;
  }

  // Ballistic preview of a launch, stopped at the first thing it would hit.
  predict(yaw, power, maxT = 2.6) {
    const v = launchVelocity(yaw, power, this.veh, this.level);
    const g = this.gravity * this.veh.gravity;
    const p0 = this.body().translation();
    const pts = [[p0.x, p0.y, p0.z]];
    let x = p0.x, y = p0.y, z = p0.z, vx = v.x, vy = v.y, vz = v.z, hit = null;
    const h = 1 / 30;
    const ray = new RAPIER.Ray({ x, y, z }, { x: 0, y: 1, z: 0 });
    for (let t = 0; t < maxT; t += h) {
      const nx = x + vx * h, ny = y + vy * h + 0.5 * g * h * h, nz = z + vz * h;
      vy += g * h;
      const dx = nx - x, dy = ny - y, dz = nz - z, l = Math.hypot(dx, dy, dz);
      ray.origin = { x, y, z }; ray.dir = { x: dx / l, y: dy / l, z: dz / l };
      // Skip the first few samples so the vehicle's own surroundings don't stop the line.
      const r = t > 0.08 ? this.pw.castRay(ray, l, true, undefined, G_PREDICT, undefined, this.body()) : null;
      if (r) { hit = [x + ray.dir.x * r.timeOfImpact, y + ray.dir.y * r.timeOfImpact, z + ray.dir.z * r.timeOfImpact]; pts.push(hit); break; }
      x = nx; y = ny; z = nz;
      pts.push([x, y, z]);
      if (y < this.killY) break;
    }
    return { pts, hit };
  }

  // Ray from `from` toward `to` against the course (for the camera). Returns the hit distance or null.
  rayStatic(from, to) {
    const dx = to[0] - from[0], dy = to[1] - from[1], dz = to[2] - from[2], l = Math.hypot(dx, dy, dz);
    if (l < 1e-3) return null;
    const ray = new RAPIER.Ray({ x: from[0], y: from[1], z: from[2] }, { x: dx / l, y: dy / l, z: dz / l });
    const r = this.pw.castRay(ray, l, true, undefined, G_CAMERA);
    return r ? r.timeOfImpact : null;
  }

  // ---------- actions ----------
  canLaunch() { return this.st.state === 'aim' && this.launchesLeft > 0; }

  launch(yaw, power) {
    if (!this.canLaunch()) return false;
    const st = this.st, b = this.body(), V = this.veh;
    const t = b.translation();
    st.rest = { p: [t.x, t.y, t.z], yaw: this.vehicleYaw() };
    st.used++;
    st.aimYaw = yaw;
    st.launches.push({ yaw, power, t: st.t });
    // Face the launch direction so it looks like the toy drives off.
    b.setRotation(yawQ(yaw), true);
    const v = launchVelocity(yaw, power, V, this.level);
    b.setLinvel(v, true);
    // A little playful forward tumble, more for the lively Dino Board.
    const d = yawDir(yaw), spin = (V.spin || 1) * (1 + power) * 1.2;
    b.setAngvel({ x: d.z * spin, y: 0, z: -d.x * spin }, true);
    st.state = 'fly'; st.flyT = 0; st.stillT = 0;
    this.emit('launch', { power });
    return true;
  }

  emit(type, data = {}) { this.out.push({ type, t: this.st.t, ...data }); }
  drain() { const o = this.out; this.out = []; return o; }

  // ---------- stepping ----------
  step() {
    const st = this.st;
    this.prev = this.vehiclePose();
    const tNext = st.t + DT;
    for (const m of this.movers) this.poseMover(m, tNext);
    if (st.state === 'fly' || st.state === 'finished') this.applyGadgets();
    if (st.state === 'cannon') this.holdCannon();
    this.pw.step(this.queue);
    st.t = tNext;
    this.handleEvents();
    this.capSpeeds();
    this.track();
    st.hitCool = Math.max(0, st.hitCool - DT);
    st.clackCool = Math.max(0, st.clackCool - DT);
    for (let i = 0; i < st.gcool.length; i++) if (st.gcool[i] > 0) st.gcool[i] -= DT;
  }

  applyGadgets() {
    const st = this.st, b = this.body(), pos = b.translation();
    for (const g of this.gadgets) {
      const d = g.def;
      if (d.t === 'fan' || d.t === 'gravity') {
        // Forces apply to the vehicle and to every awake prop inside the zone.
        const acc = d.t === 'fan' ? this.fanAccel(d) : [d.g[0], d.g[1] - this.gravity, d.g[2]];
        this.pushIn(b, pos, d, acc, this.veh.gravity);
        for (const p of this.props) {
          const pb = this.propBody(p);
          if (!pb || pb.isSleeping()) continue;
          this.pushIn(pb, pb.translation(), d, acc, 1);
        }
        continue;
      }
      if (st.gcool[g.i] > 0) continue;
      if (d.t === 'boost' && inZone(pos, [d.p[0], d.p[1] + 0.8, d.p[2]], [d.s?.[0] || 3, 2, d.s?.[1] || 2.6], (d.yaw || 0) * DEG)) {
        const dir = yawDir((d.yaw || 0) * DEG), v = b.linvel();
        const along = v.x * dir.x + v.z * dir.z, sp = d.speed || 22;
        const add = Math.max(sp - along, sp * 0.3);
        b.setLinvel({ x: v.x + dir.x * add, y: Math.max(v.y, 1.5), z: v.z + dir.z * add }, true);
        st.gcool[g.i] = 0.6; this.emit('boost', { g: g.i, p: [pos.x, pos.y, pos.z] });
      } else if (d.t === 'spring' && inZone(pos, [d.p[0], d.p[1] + 0.7, d.p[2]], [2.2, 1.6, 2.2], 0)) {
        const yaw = (d.yaw || 0) * DEG, pitch = (d.pitch ?? 60) * DEG, dir = yawDir(yaw), s = d.speed || 18;
        b.setLinvel({ x: dir.x * Math.cos(pitch) * s, y: Math.sin(pitch) * s, z: dir.z * Math.cos(pitch) * s }, true);
        b.setAngvel({ x: dir.z * 3, y: 0, z: -dir.x * 3 }, true);
        st.gcool[g.i] = 0.8; this.emit('spring', { g: g.i, p: [pos.x, pos.y, pos.z] });
      } else if (d.t === 'trampoline') {
        const r = d.r || 1.6, v = b.linvel();
        if (Math.hypot(pos.x - d.p[0], pos.z - d.p[2]) < r + 0.2 && pos.y - d.p[1] > -0.2 && pos.y - d.p[1] < 1.4 && v.y < 1) {
          b.setLinvel({ x: v.x * 0.9 + (d.push?.[0] || 0), y: d.bounce || 15, z: v.z * 0.9 + (d.push?.[1] || 0) }, true);
          st.gcool[g.i] = 0.35; this.emit('trampoline', { g: g.i, p: [pos.x, pos.y, pos.z] });
        }
      } else if (d.t === 'cannon' && !st.cannon) {
        if (Math.hypot(pos.x - d.p[0], pos.y - d.p[1], pos.z - d.p[2]) < (d.catch || 2.2)) {
          st.cannon = { g: g.i, t: 0 };
          st.state = 'cannon';
          b.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true);
          b.setLinvel({ x: 0, y: 0, z: 0 }, true); b.setAngvel({ x: 0, y: 0, z: 0 }, true);
          this.emit('cannonIn', { g: g.i });
        }
      }
    }
  }

  fanAccel(d) {
    const yaw = (d.yaw || 0) * DEG, pitch = (d.pitch ?? 0) * DEG, dir = yawDir(yaw), a = d.power || 24;
    return [dir.x * Math.cos(pitch) * a, Math.sin(pitch) * a, dir.z * Math.cos(pitch) * a];
  }

  pushIn(body, pos, d, acc, gscale) {
    if (!inZone(pos, d.p, d.s, (d.yaw || 0) * DEG * (d.t === 'gravity' ? 1 : 0))) return;
    const m = body.mass(), k = DT * m;
    // Gravity zones replace gravity, so scale the part that cancels world gravity.
    const ay = d.t === 'gravity' ? d.g[1] - this.gravity * gscale : acc[1];
    body.applyImpulse({ x: acc[0] * k, y: ay * k, z: acc[2] * k }, true);
  }

  // Inside a cannon: sit in the barrel, then fire (after a moment, or on tap).
  holdCannon() {
    const st = this.st, c = st.cannon, d = this.gadgets[c.g].def, b = this.body();
    c.t += DT;
    const yaw = this.cannonYaw(d, st.t);
    b.setNextKinematicTranslation({ x: d.p[0], y: d.p[1], z: d.p[2] });
    b.setNextKinematicRotation(yawQ(yaw));
    if (c.t >= (d.hold || 0.9) || c.fire) {
      b.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
      const pitch = (d.pitch ?? 40) * DEG, dir = yawDir(yaw), s = d.speed || 22;
      b.setTranslation({ x: d.p[0] + dir.x * 1.6, y: d.p[1] + Math.sin(pitch) * 1.6, z: d.p[2] + dir.z * 1.6 }, true);
      b.setLinvel({ x: dir.x * Math.cos(pitch) * s, y: Math.sin(pitch) * s, z: dir.z * Math.cos(pitch) * s }, true);
      b.setAngvel({ x: dir.z * 4, y: 0, z: -dir.x * 4 }, true);
      st.gcool[c.g] = 1.2;
      st.cannon = null; st.state = st.finishedT >= 0 ? 'finished' : 'fly'; st.stillT = 0; st.flyT = 0;
      this.emit('cannonFire', { g: c.g, p: [d.p[0], d.p[1], d.p[2]], yaw });
    }
  }
  cannonYaw(d, t) {
    const base = (d.yaw || 0) * DEG;
    return d.sweep ? base + d.sweep * DEG * Math.sin((Math.PI * 2 * t) / (d.sweepPeriod || 3)) : base;
  }
  // Tap while inside a cannon with `tap: true` fires it right away.
  fireCannon() { if (this.st.cannon && this.gadgets[this.st.cannon.g].def.tap) this.st.cannon.fire = true; }

  handleEvents() {
    const st = this.st, broken = [];
    this.queue.drainCollisionEvents((h1, h2, started) => {
      if (!started) return;
      const a = this.colMap.get(h1), b = this.colMap.get(h2);
      if (!a || !b) return;
      const o = a.kind === 'veh' ? b : b.kind === 'veh' ? a : null;
      if (o && o.kind === 'prop') st.props[o.ref.i].vhit = true;
    });
    this.queue.drainContactForceEvents((e) => {
      const a = this.colMap.get(e.collider1()), b = this.colMap.get(e.collider2());
      if (!a || !b) return;
      const f = e.totalForceMagnitude();
      const veh = a.kind === 'veh' ? b : b.kind === 'veh' ? a : null;
      if (veh) {
        const dv = (f * DT) / this.vmass;
        if (dv > 2.5 && st.hitCool <= 0) {
          const p = this.body().translation();
          st.hitCool = 0.12;
          this.emit('hit', { p: [p.x, p.y, p.z], dv, what: veh.kind, mat: veh.kind === 'part' ? veh.ref.mat : null, part: veh.kind === 'part' ? veh.ref.i : -1 });
        }
      }
      for (const [x, other] of [[a, b], [b, a]]) {
        if (x.kind !== 'prop') continue;
        const p = x.ref, ps = st.props[p.i];
        if (ps.broken || ps.gone) continue;
        let dv = (f * DT) / p.mass;
        if (other.kind === 'veh') dv *= this.veh.impact;
        if (this.opts.easy) dv *= 1.3;
        if (p.K.breakDV && dv > p.K.breakDV) broken.push(p);
        else if (dv > 3 && st.clackCool <= 0) {
          st.clackCool = 0.06;
          const t = this.pw.getRigidBody(p.h).translation();
          this.emit('clack', { p: [t.x, t.y, t.z], kind: p.kind, dv });
        }
      }
    });
    for (const p of broken) {
      const ps = st.props[p.i];
      if (ps.broken) continue;
      const b = this.pw.getRigidBody(p.h), t = b.translation(), r = b.rotation(), v = b.linvel();
      ps.broken = true; ps.gone = true;
      this.emit('break', { prop: p.i, kind: p.kind, p: [t.x, t.y, t.z], q: [r.x, r.y, r.z, r.w], v: [v.x, v.y, v.z] });
      this.pw.removeRigidBody(b);
      this.scoreProp(p);
    }
  }

  scoreProp(p) {
    const ps = this.st.props[p.i];
    if (ps.scored) return;
    ps.scored = true;
    const before = this.score.events.length;
    this.score.destroy('p' + p.i, this.st.t, !ps.vhit);
    const evs = this.score.events.slice(before);
    const pos = p.pos || p.home;
    for (const ev of evs) this.emit('score', { ev, p: pos });
  }

  capSpeeds() {
    const b = this.body();
    const v = b.linvel(), s = len3(v);
    if (s > MAX_VEH_SPEED) b.setLinvel({ x: (v.x / s) * MAX_VEH_SPEED, y: (v.y / s) * MAX_VEH_SPEED, z: (v.z / s) * MAX_VEH_SPEED }, true);
    const w = b.angvel(), ws = len3(w);
    if (ws > MAX_VEH_SPIN) b.setAngvel({ x: (w.x / ws) * MAX_VEH_SPIN, y: (w.y / ws) * MAX_VEH_SPIN, z: (w.z / ws) * MAX_VEH_SPIN }, true);
    if ((Math.round(this.st.t / DT) & 3) !== 0) return;
    for (const p of this.props) {
      const pb = this.propBody(p);
      if (!pb || pb.isSleeping()) continue;
      const pv = pb.linvel(), ps = len3(pv);
      if (ps > MAX_PROP_SPEED) pb.setLinvel({ x: (pv.x / ps) * MAX_PROP_SPEED, y: (pv.y / ps) * MAX_PROP_SPEED, z: (pv.z / ps) * MAX_PROP_SPEED }, true);
    }
  }

  // What the vehicle is touching: grounded flag, surface drag and the velocity of a moving floor.
  contacts() {
    const vc = this.pw.getCollider(this.vch);
    let n = 0, drag = 0, floorV = null, slide = false;
    this.pw.contactPairsWith(vc, (other) => {
      this.pw.contactPair(vc, other, (man) => {
        if (man.numContacts() === 0) return;
        n++;
        const info = this.colMap.get(other.handle);
        if (info && info.kind === 'part') {
          drag = Math.max(drag, SURFACES[info.ref.mat]?.drag || 0);
          if (SURFACES[info.ref.mat]?.combine === 'min') slide = true;
        }
        if (info && info.kind === 'mover') floorV = other.parent().linvel();
      });
    });
    return { grounded: n > 0, drag, floorV, slide };
  }

  track() {
    const st = this.st, L = this.level, b = this.body();
    const pos = b.translation();

    // Props: count knocked over / moved away, and remove ones that fell into the void.
    if ((Math.round(st.t / DT) % 6) === 0) {
      for (const p of this.props) {
        const ps = st.props[p.i];
        if (ps.gone) continue;
        const pb = this.pw.getRigidBody(p.h);
        if (pb.isSleeping() && ps.scored) continue;
        const t = pb.translation();
        p.pos = [t.x, t.y, t.z];
        if (t.y < this.killY) {
          ps.gone = true; this.pw.removeRigidBody(pb);
          this.emit('splashProp', { prop: p.i, p: [t.x, this.killY + 4, t.z] });
          this.scoreProp(p);
          continue;
        }
        if (ps.scored) continue;
        let knocked;
        if (p.K.knock === 'tilt') {
          const r = pb.rotation();
          _q.set(r.x, r.y, r.z, r.w);
          const up = _v.set(0, 1, 0).applyQuaternion(_q);
          const startUp = p.def.r ? 1 : 1; // pins and dominoes start upright
          knocked = up.y < 0.6 * startUp;
        } else {
          knocked = Math.hypot(t.x - p.home[0], t.y - p.home[1], t.z - p.home[2]) > p.K.knock;
        }
        if (knocked) this.scoreProp(p);
      }
    }

    if (st.state === 'cannon') return;

    // Collectibles.
    const R = this.collectR;
    (L.coins || []).forEach((c, i) => {
      if (st.coins.includes(i)) return;
      if (Math.abs(pos.x - c[0]) < R && Math.abs(pos.y - c[1]) < R + 0.3 && Math.abs(pos.z - c[2]) < R && Math.hypot(pos.x - c[0], pos.y - c[1], pos.z - c[2]) < R + 0.3) {
        st.coins.push(i);
        const ev = this.score.add('coin', 50, 'c' + i, st.t);
        this.emit('coin', { i, p: c, ev });
      }
    });
    (L.stars || []).forEach((c, i) => {
      if (st.stars.includes(i)) return;
      if (Math.hypot(pos.x - c[0], pos.y - c[1], pos.z - c[2]) < R + 0.5) {
        st.stars.push(i);
        const ev = this.score.add('star', 250, 's' + i, st.t);
        this.emit('star', { i, p: c, ev });
      }
    });
    (L.secrets || []).forEach((s, i) => {
      if (st.secrets.includes(i)) return;
      if (Math.hypot(pos.x - s.p[0], pos.y - s.p[1], pos.z - s.p[2]) < (s.r || 2) + (this.opts.easy ? 0.5 : 0)) {
        st.secrets.push(i);
        const ev = this.score.add('secret', 500, 'x' + i, st.t);
        this.emit('secret', { i, p: s.p, ev });
      }
    });

    // Finish zone: a generous cylinder.
    const F = L.finish;
    if (st.finishedT < 0 && Math.hypot(pos.x - F.p[0], pos.z - F.p[2]) < this.finishR && pos.y > F.p[1] - 1.5 && pos.y < F.p[1] + (F.h || 6)) {
      st.finishedT = st.t;
      st.state = 'finished';
      this.score.finish(this.launchesLeft, st.t);
      this.emit('finish', { p: [pos.x, pos.y, pos.z] });
      return;
    }

    // Fell into the void: back to where it was launched from. The launch still counts,
    // otherwise splashing on purpose would give endless free stunts and pickups.
    if (pos.y < this.killY) {
      if (st.state === 'finished') return;
      this.emit('splash', { p: [pos.x, this.killY + 4, pos.z] });
      this.respawn(false);
      if (this.launchesLeft <= 0) { st.state = 'out'; this.emit('settle', { state: 'out' }); }
      return;
    }

    if (st.state !== 'fly') return;
    st.flyT += DT;
    const c = this.contacts();
    // Rolling resistance while touching the ground, stronger in low gravity where friction
    // alone would let the vehicle slide off small moon islands. Sticky goo adds its own drag.
    if (c.grounded && !c.slide) c.drag += this.groundDrag;
    if (c.drag > 0) {
      const v = b.linvel(), k = Math.exp(-c.drag * DT);
      b.setLinvel({ x: v.x * k, y: v.y > 0 ? v.y * k : v.y, z: v.z * k }, true);
      const w = b.angvel(); b.setAngvel({ x: w.x * k, y: w.y * k, z: w.z * k }, true);
    }
    // Air time and flips for stunt points.
    if (!c.grounded) {
      st.air += DT;
      const w = b.angvel();
      st.turns += (len3(w) * DT) / (Math.PI * 2);
    } else {
      if (st.air > 0.35) {
        const up = this.vehicleUp() > 0.8;
        const evs = this.score.jump(st.air, st.turns, up, st.t).filter(Boolean);
        this.emit('land', { air: st.air, p: [pos.x, pos.y, pos.z] });
        for (const ev of evs) this.emit('score', { ev, p: [pos.x, pos.y + 1, pos.z] });
      }
      st.air = 0; st.turns = 0;
    }
    st.grounded = c.grounded;

    // Settled? Measured relative to a moving floor so riding a platform still counts.
    const v = b.linvel(), w = b.angvel();
    const fv = c.floorV || { x: 0, y: 0, z: 0 };
    const rel = Math.hypot(v.x - fv.x, v.y - fv.y, v.z - fv.z);
    if (c.grounded && rel < SETTLE_SPEED && len3(w) < SETTLE_SPIN) st.stillT += DT; else st.stillT = 0;
    if (st.stillT > SETTLE_TIME || st.flyT > FLIGHT_TIMEOUT) this.settle();
  }

  settle() {
    const st = this.st, b = this.body();
    // Landed on its side or roof: hop back onto its wheels.
    if (this.vehicleUp() < 0.75) {
      const yaw = this.vehicleYaw(), t = b.translation();
      b.setRotation(yawQ(yaw), true);
      b.setTranslation({ x: t.x, y: t.y + 0.5, z: t.z }, true);
      this.emit('flipUp');
    }
    b.setLinvel({ x: 0, y: 0, z: 0 }, true); b.setAngvel({ x: 0, y: 0, z: 0 }, true);
    st.state = this.launchesLeft > 0 ? 'aim' : 'out';
    this.emit('settle', { state: st.state });
  }

  respawn(refund = false) {
    const st = this.st, b = this.body();
    if (b.bodyType() !== RAPIER.RigidBodyType.Dynamic) b.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
    b.setTranslation({ x: st.rest.p[0], y: st.rest.p[1] + 0.3, z: st.rest.p[2] }, true);
    b.setRotation(yawQ(st.rest.yaw), true);
    b.setLinvel({ x: 0, y: 0, z: 0 }, true); b.setAngvel({ x: 0, y: 0, z: 0 }, true);
    if (refund && st.used > 0) st.used--;
    st.state = 'aim'; st.air = 0; st.turns = 0; st.cannon = null;
    this.emit('respawn');
  }

  // Developer helper: put the vehicle back where it was last launched from.
  resetVehicle() { if (this.st.state !== 'finished') this.respawn(false); }

  // ---------- snapshots (used by the solver) ----------
  snapshot() {
    const s = this.score;
    return {
      pw: this.pw.takeSnapshot(),
      st: structuredClone(this.st),
      score: { total: s.total, events: s.events.slice(), seen: [...s.seen], combo: s.combo, lastDestroyT: s.lastDestroyT, counts: { ...s.counts } },
      pos: this.props.map((p) => p.pos),
    };
  }
  restore(snap) {
    this.pw.free();
    this.pw = RAPIER.World.restoreSnapshot(snap.pw);
    this.st = structuredClone(snap.st);
    const s = new ScoreKeeper();
    Object.assign(s, snap.score, { events: snap.score.events.slice(), seen: new Set(snap.score.seen), counts: { ...snap.score.counts } });
    this.score = s;
    this.props.forEach((p, i) => { p.pos = snap.pos[i]; });
    this.out = [];
  }

  free() { try { this.pw.free(); } catch (e) { /* ignore */ } try { this.queue.free(); } catch (e) { /* ignore */ } }

  // Run until the vehicle can be launched again (or the level ends). Returns the state.
  runUntilRest(maxT = 20) {
    const t0 = this.st.t;
    while (this.st.t - t0 < maxT) {
      this.step();
      const s = this.st.state;
      if (s === 'aim' || s === 'out' || s === 'finished') break;
    }
    this.out.length = 0;
    return this.st.state;
  }
}
