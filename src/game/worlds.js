// Surface materials (physics + colour) and the four themed worlds. Pure data.

// friction / bounce feed Rapier. `combine` picks how two surfaces mix:
// 'max' makes sticky and jelly surfaces win, 'min' makes icing slippery whatever touches it.
// `drag` slows a vehicle that is touching the surface (sticky goo).
export const SURFACES = {
  grass: { friction: 0.8, bounce: 0.1, color: '#6cc84a', top: '#86dc5e' },
  wood: { friction: 0.6, bounce: 0.15, color: '#d99a5b', top: '#e8b47a' },
  plank: { friction: 0.6, bounce: 0.1, color: '#b8763d', top: '#c98a50' },
  plastic: { friction: 0.5, bounce: 0.25, color: '#3b8fe8', top: '#5fa8ff' },
  cardboard: { friction: 0.7, bounce: 0.05, color: '#c9a06a', top: '#dbb683' },
  rubber: { friction: 0.8, bounce: 0.85, color: '#e8443a', top: '#ff6b5e', combine: 'max' },
  jelly: { friction: 0.5, bounce: 0.92, color: '#ff5ec4', top: '#ff8ad6', combine: 'max', wobble: true },
  candy: { friction: 0.7, bounce: 0.2, color: '#ffb3d9', top: '#ffd1e8' },
  icing: { friction: 0.04, bounce: 0.05, color: '#bff0ff', top: '#e6fbff', combine: 'min' },
  sticky: { friction: 1.5, bounce: 0.0, color: '#a0522d', top: '#c46a35', combine: 'max', drag: 3.5 },
  deck: { friction: 0.6, bounce: 0.1, color: '#a8672f', top: '#c07c3f' },
  sand: { friction: 0.9, bounce: 0.05, color: '#f2d38a', top: '#ffe3a3' },
  metal: { friction: 0.4, bounce: 0.2, color: '#a7b0c2', top: '#c3cad8' },
  moon: { friction: 1.0, bounce: 0.1, color: '#b9b4d6', top: '#d6d2ee' },
  crystal: { friction: 0.3, bounce: 0.6, color: '#7ee8ff', top: '#b5f4ff', combine: 'max' },
};

// Each world: look, music, default physics and which props skin to use.
//   void   what is below the course (falling in sends the vehicle back, no penalty)
export const WORLDS = [
  {
    id: 1, name: 'Backyard Mayhem', short: 'Backyard',
    sky: ['#5fbfff', '#d6f4ff'], fog: '#cbeeff', sun: '#fff3c4',
    void: { kind: 'pool', color: '#3ec5f0', deep: '#1d8fd1' },
    ground: 'grass', music: 'play', gravity: -18,
    card: ['#7fd858', '#3a9b34'], icon: 'duck',
    blocks: ['#e8443a', '#f7d43c', '#3b8fe8', '#5cc95a', '#f5962a', '#9b5de5'],
  },
  {
    id: 2, name: 'Candy Chaos', short: 'Candy',
    sky: ['#ff9ed2', '#fff0f8'], fog: '#ffe0f2', sun: '#fffbe0',
    void: { kind: 'chocolate', color: '#8a4a2a', deep: '#5c2d16' },
    ground: 'candy', music: 'candy', gravity: -18,
    card: ['#ff8ad6', '#c94595'], icon: 'lolly',
    blocks: ['#ff5ec4', '#7ee8ff', '#fff27a', '#b07bff', '#7cf2a0', '#ff9a5e'],
  },
  {
    id: 3, name: 'Pirate Panic', short: 'Pirate',
    sky: ['#4fb7e8', '#fff1c8'], fog: '#ffe9c0', sun: '#fff0a8',
    void: { kind: 'sea', color: '#1fa3c9', deep: '#11698f' },
    ground: 'sand', music: 'pirate', gravity: -18,
    card: ['#4fb7e8', '#1d6c94'], icon: 'skull',
    blocks: ['#b8763d', '#c98a50', '#8a5a2b', '#d9a066', '#a8672f', '#e0b070'],
  },
  {
    id: 4, name: 'Moon Madness', short: 'Moon',
    sky: ['#120b33', '#3a2a7a'], fog: '#2a1f5c', sun: '#d8d8ff',
    void: { kind: 'space', color: '#1a1240', deep: '#08051a' },
    ground: 'moon', music: 'space', gravity: -8,
    card: ['#6a55d6', '#2a1f6e'], icon: 'planet',
    blocks: ['#7ee8ff', '#b07bff', '#ff8ad6', '#fff27a', '#7cf2a0', '#9fb4ff'],
  },
];

export const worldById = (id) => WORLDS.find((w) => w.id === id) || WORLDS[0];
