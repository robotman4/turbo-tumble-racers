// Vehicle definitions. Pure data: the physics (sim.js) reads the numbers, the renderer
// (render/vehicleMesh.js) looks up `model` to build the toy. To add a vehicle, add an entry
// here and, if it needs a new look, a builder under the same model name in vehicleMesh.js.
//
//   half      half extents of the collision box [length, height, width] in metres
//   round     corner rounding of the box (bigger = tumbles more like a ball)
//   density   heavier vehicles push props harder
//   bounce    restitution against surfaces
//   grip      friction
//   gravity   gravity scale (below 1 = floatier flights)
//   speed     launch speed multiplier
//   impact    multiplier on the force used to break props
//   spin      how much playful tumble a launch adds
//   voice     sound effect played on launch and big hits

export const VEHICLES = [
  {
    id: 'panda', name: 'Panda Kart', model: 'panda',
    half: [0.72, 0.36, 0.5], round: 0.14,
    density: 1.0, bounce: 0.3, grip: 0.55, gravity: 1.0, speed: 1.0, impact: 1.0, spin: 1.0,
    voice: 'honk',
    paints: [
      { id: 'blue', color: '#3b8fe8', cost: 0 },
      { id: 'red', color: '#e8443a', cost: 120 },
      { id: 'mint', color: '#3fd4a4', cost: 240 },
      { id: 'gold', color: '#ffc21a', cost: 400 },
    ],
  },
  {
    id: 'dino', name: 'Dino Board', model: 'dino',
    half: [0.78, 0.26, 0.44], round: 0.12,
    density: 0.6, bounce: 0.55, grip: 0.45, gravity: 0.86, speed: 1.0, impact: 0.8, spin: 1.4,
    voice: 'rawr',
    paints: [
      { id: 'green', color: '#5cc95a', cost: 0 },
      { id: 'purple', color: '#9b5de5', cost: 120 },
      { id: 'orange', color: '#f5962a', cost: 240 },
      { id: 'rainbow', color: '#ff5ec4', cost: 400 },
    ],
  },
  {
    id: 'chicken', name: 'Chicken Cart', model: 'chicken',
    half: [0.78, 0.42, 0.55], round: 0.12,
    density: 2.2, bounce: 0.15, grip: 0.6, gravity: 1.08, speed: 1.04, impact: 1.8, spin: 0.7,
    voice: 'bawk',
    paints: [
      { id: 'red', color: '#e8443a', cost: 0 },
      { id: 'yellow', color: '#f7d43c', cost: 120 },
      { id: 'teal', color: '#2fb8c9', cost: 240 },
      { id: 'pink', color: '#f06fb0', cost: 400 },
    ],
  },
];

export const vehicleById = (id) => VEHICLES.find((v) => v.id === id) || VEHICLES[0];
