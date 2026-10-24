// Playground: an open toy arena with no finish, no timer and unlimited launches.
import { slab, box, cyl, ramp, rail, coinRing, blockWall, tower, pyramid, crates, pins, dominoes, prop } from './kit.js';

export default {
  id: 'playground', name: 'Playground', world: 1, launches: 0,
  start: { p: [0, 0.6, 0], yaw: 0 },
  finish: { p: [0, -100, 0], r: 0.1 },
  cam: [0, 34, 34],
  killY: -6,
  parts: [
    slab(-30, 30, 0, { w: 60, mat: 'grass' }),
    rail(-30, 30, 0, 30.2), rail(-30, 30, 0, -30.2),
    box([30.2, 0.5, 0], [0.5, 1, 60], 'wood'), box([-30.2, 0.5, 0], [0.5, 1, 60], 'wood'),
    ramp(10, 0, 0, 6, 2.4, { w: 6, mat: 'wood' }),
    ramp(-10, 0, 0, 6, 2.4, { w: 6, mat: 'wood', yaw: 180 }),
    ramp(0, 0, -10, 6, 2.4, { w: 6, mat: 'plastic', yaw: 90 }),
    ramp(0, 0, 10, 6, 2.4, { w: 6, mat: 'plastic', yaw: -90 }),
    slab(18, 28, 3, { z: -18, w: 10, th: 3, mat: 'wood' }),
    ramp(10, 0, -18, 8, 3, { w: 6, mat: 'wood' }),
    cyl([-20, 0.25, 20], 4, 0.5, 'jelly'),
  ],
  gadgets: [
    { t: 'trampoline', p: [-18, 0, -14], r: 2, bounce: 16 },
    { t: 'trampoline', p: [20, 0, 16], r: 2, bounce: 14 },
    { t: 'boost', p: [-6, 0, 0], yaw: 180, speed: 22 },
    { t: 'boost', p: [6, 0, 0], yaw: 0, speed: 22 },
    { t: 'spring', p: [0, 0, 22], yaw: -90, pitch: 70, speed: 18 },
  ],
  movers: [{ t: 'spinner', p: [-16, 0.7, 6], s: [8, 1.2, 0.8], speed: 1.2, color: '#ff5ec4' }],
  props: [
    ...tower(24, 4, 0, 4), ...pyramid(24, -4, 0, 4),
    ...blockWall(-24, -4, 0, 6, 3),
    ...pins(14, 22, 0, 4),
    ...dominoes([-24, 14], [-8, 24], 16, 0),
    ...crates([[22, 3.6, -16], [22, 3.6, -20], [22, 4.8, -18], [26, 3.6, -18]]),
    prop('ball', [5, 0.7, -6]), prop('ball', [-5, 0.7, 6], { c: 1 }), prop('ball', [8, 0.7, 12], { c: 2 }),
    prop('duck', [-8, 0.6, -6]), prop('duck', [-12, 0.6, -20]), prop('duck', [12, 0.6, -6]),
    prop('barrel', [-20, 0.6, 2]), prop('barrel', [-20, 0.6, 3.2]), prop('barrel', [-20, 1.85, 2.6]),
  ],
  coins: [...coinRing([0, 1.2, 0], 7, 10), ...coinRing([-18, 6, -14], 2.5, 6)],
  stars: [[23, 5, -18], [0, 9, 22]],
  routes: {},
};
