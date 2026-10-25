// Scene navigation in one place. The gameplay scene (with the physics engine) is loaded
// lazily so the menus appear fast; `preloadPlay()` warms it up in the background.
let playMod = null;
export function preloadPlay() {
  if (!playMod) playMod = import('./play.js').then((m) => { m.warmUp(); return m; });
  return playMod;
}

// mode: 'adventure' | 'challenge' | 'playground'
export function startLevel(game, id, mode = 'adventure', opts = {}) {
  preloadPlay().then((m) => game.go(new m.PlayScene(game, id, mode, opts)));
}

export async function goTitle(game) { const m = await import('./title.js'); game.go(new m.TitleScene(game)); }
export async function goWorlds(game, mode = 'adventure') { const m = await import('./worlds.js'); game.go(new m.WorldsScene(game, mode)); }
export async function goLevels(game, world, mode = 'adventure') { const m = await import('./levels.js'); game.go(new m.LevelsScene(game, world, mode)); }
export async function goGarage(game) { const m = await import('./garage.js'); game.go(new m.GarageScene(game)); }
export async function goSettings(game) { const m = await import('./settings.js'); game.go(new m.SettingsScene(game)); }
export async function goWorkshop(game) { const m = await import('./workshop.js'); game.go(new m.WorkshopScene(game)); }
export async function goBuilder(game, level) { const m = await import('./builder.js'); game.go(new m.BuilderScene(game, level)); }
