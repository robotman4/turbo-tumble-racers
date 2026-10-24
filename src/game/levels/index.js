// All levels in play order, plus the playground arena.
import world1 from './world1.js';
import world2 from './world2.js';
import world3 from './world3.js';
import world4 from './world4.js';
import playground from './playground.js';

export const LEVELS = [...world1, ...world2, ...world3, ...world4];
export const PLAYGROUND = playground;
export const levelById = (id) => (id === PLAYGROUND.id ? PLAYGROUND : LEVELS.find((l) => l.id === id));
export const levelIndex = (id) => LEVELS.findIndex((l) => l.id === id);
export const levelsOfWorld = (w) => LEVELS.filter((l) => l.world === w);
