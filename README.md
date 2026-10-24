# Turbo Tumble Racers

A colourful 3D physics arcade game for kids aged 4 and up (and adults who like casual skill games).
Pull back, let go, and a cartoon vehicle tumbles through a toy obstacle course: ramps, jelly, cannons,
spinning lollipops and moon gravity. One finger or a mouse is all it takes. It's an offline-capable PWA,
built from the kids-game template.

- **Adventure:** 32 levels in 4 worlds (Backyard Mayhem, Candy Chaos, Pirate Panic, Moon Madness), unlocked in order, with 1–3 stars and best scores.
- **Playground:** an open toy arena with unlimited launches and an instant reset.
- **Challenge:** replay unlocked levels for best score, fewest launches and fastest time.
- **Vehicles:** Panda Kart (balanced), Dino Board (light and floaty) and Chicken Cart (heavy hitter), plus paint jobs bought with coins collected in the game. There's no real money anywhere.
- **Settings:** music, sounds, Easy Mode (wider finish, aiming help, bigger pickups, optional unlimited launches), graphics quality, reset progress.

## Develop

```bash
npm install
npm run dev      # dev server, reachable from a tablet on the same network
npm run build    # production build into dist/
npm run preview  # serve the built version
npm test         # unit tests + "every level can be finished by every vehicle"
npm run solve    # re-run the level solver after changing levels (writes solutions.json)
```

Developer mode: add `?debug` to the URL, or tap the bug button in Settings. A panel shows FPS,
vehicle coordinates, camera mode and scoring events, and has buttons to load any level, draw the
collision shapes, reset the vehicle, run the solver and auto-play its solution, and simulate a lost
graphics context.

## Architecture

Vanilla JS with Vite, as in the template. Three.js draws the 3D world on one canvas, and the template's
2D canvas sits on top for all UI (buttons, HUD, menus, popups). Rapier (`@dimforge/rapier3d-compat`,
WebAssembly) does the rigid-body physics.

| System | Files |
| --- | --- |
| Boot, loop, input, scene switching | `src/main.js` (2D UI canvas over a WebGL canvas) |
| Simulation (physics + game rules) | `src/game/sim.js`: no DOM, so it also runs in Node for tests and the solver |
| Launch math (drag to aim, power, aim assist) | `src/game/launch.js` |
| Scoring | `src/game/scoring.js` |
| Vehicles (data) | `src/game/vehicles.js` |
| Worlds and surfaces (data) | `src/game/worlds.js` |
| Levels (data) | `src/game/levels/*.js`, helpers in `kit.js`, checks in `schema.js` |
| Level solver | `src/game/solver.js`, `scripts/solve.mjs`, `scripts/probe.mjs` |
| Rendering | `src/render/renderer.js` (quality, adaptive resolution, context loss), `levelView.js`, `environment.js`, `vehicleMesh.js`, `fx3d.js` (pooled particles), `materials.js` (shared caches), `menuStage.js` |
| Camera | `src/render/camera.js` |
| Audio | `src/audio.js` (synthesized, no audio files) |
| Persistence | `src/storage.js` (versioned save with migrations) |
| UI scenes | `src/scenes/` (title, worlds, levels, play, garage, settings) |
| Developer mode | `src/debug.js` |

The sim runs on a fixed 60 Hz timestep. Vehicle speed and spin are capped, props have capped speed,
and collision layers keep the camera ray and the aim preview off props. When a vehicle falls into the
void (pool, chocolate, sea or space), it returns to where it was launched; the launch still counts, so splashing on purpose can't farm free stunts and pickups.
When it lands on its side, it hops back upright. When it hasn't settled after 14 seconds, it is stopped,
so a level can never get stuck.

## Level format

A level is a plain object (see `src/game/levels/world1.js`). Positions are in metres, y is up, yaw is
in degrees (0 faces +x, positive turns toward -z).

```js
{
  id: '1-2', name: 'Ramp It Up', world: 1,
  launches: 3,                       // 0 = unlimited
  pitch: 32, power: 1,               // optional launch angle and power scale (Moon uses 0.72)
  gravity: -18,                      // optional, defaults to the world's gravity
  start: { p: [0, 0.6, 0], yaw: 0 },
  finish: { p: [27, 3, 0], r: 3.5 }, // generous cylinder zone
  cam: [12, 20, 22],                 // where the intro fly-in starts
  parts: [                           // static course pieces
    { t: 'box', p, s: [w, h, d], mat, r: [rx, ry, rz] },
    { t: 'wedge', p, s: [len, h, w], yaw, mat },   // ramp, rises toward its yaw
    { t: 'cyl', p, r, h, mat },
  ],
  props: [{ t: 'block' | 'crate' | 'plank' | 'pin' | 'domino' | 'barrel' | 'ball' | 'duck' | 'gumdrop' | 'rock', p, yaw, s }],
  gadgets: [                         // zones run by the sim
    { t: 'boost', p, yaw, speed },
    { t: 'spring', p, yaw, pitch, speed },
    { t: 'trampoline', p, r, bounce },
    { t: 'fan', p, s, yaw, pitch, power, current },  // current: no fan housing (air current)
    { t: 'gravity', p, s, g: [x, y, z] },            // replaces gravity inside the zone
    { t: 'cannon', p, yaw, pitch, speed, hold, tap, sweep, sweepPeriod },
  ],
  movers: [                          // kinematic obstacles driven by the sim clock
    { t: 'slider' | 'float', p, s, to | bob, period, phase },
    { t: 'spinner', p, s: [len, h, thick], speed, axis, arms },
    { t: 'pendulum', p: pivot, len, amp, period, yaw, head },
    { t: 'bridge', p: hinge, len, w, amp, period, yaw },
  ],
  coins: [[x, y, z], ...], stars: [[x, y, z]], secrets: [{ p, r }],
  routes: { main: [[x, z], ...], alt: [...] },   // waypoints: help the solver and describe alternate routes
  thresholds: [two, three],          // optional; default comes from what the level offers
  tutorial: 'drag',                  // optional: show the hint hand right away
}
```

Surfaces (`mat`): grass, wood, plank, plastic, cardboard, rubber, jelly (bouncy), candy, icing (slippery),
sticky (caramel, slows you down), deck, sand, metal, moon, crystal (bouncy).

After changing a level, run `npm run solve <id>`, then `npm test`. The tests fail when any level can't
be finished by every vehicle. `node scripts/probe.mjs <id> [vehicle] [yaw]` prints where a grid of
launches ends up, which helps when tuning gaps and jumps.

## Scoring

Finish 1000, coin 50, star 250, each prop knocked over or smashed 25 (once per prop), chain reaction
+40, combo +15 per step, big air 80/s, flip 150, upright landing 100, unused launch 300, secret 500.
Stars: finishing is always at least 1 star; 2 and 3 stars need the level's thresholds.

## Extending

- **New vehicle:** add an entry to `VEHICLES` in `src/game/vehicles.js`. For a new look, register a
  builder with `registerVehicleModel(name, fn)` in `src/render/vehicleMesh.js`. A builder could load a
  GLB with `GLTFLoader` instead of building primitives. Then run `npm run solve` so the tests cover it.
- **New prop or gadget:** add the physics to `PROP_KINDS` or `applyGadgets()` in `sim.js`, the look to
  `levelView.js`, and the type to `schema.js`.
- **New world:** add it to `WORLDS` in `worlds.js` (sky, void, music, palette), a decoration branch in
  `environment.js`, and a `worldN.js` level file.
- **Save format change:** bump `SAVE_VERSION` in `storage.js` and add a step to `MIGRATIONS`.

## Known limitations

- The physics engine is about 2.2 MB of JavaScript (WebAssembly inlined), gzip about 0.85 MB. It
  loads in the background while the menu is showing and is cached for offline play after the first visit.
- Rendering in headless Chromium (software GL) runs at a few frames per second, so automated browser
  tests check flows and screenshots, not frame rate. Real-device performance still needs checking on
  the iPad and iPhone.
- Levels are proven finishable when each launch is made as soon as the vehicle comes to rest (that's
  how the solver plays). With moving obstacles, other timings can play out differently.
