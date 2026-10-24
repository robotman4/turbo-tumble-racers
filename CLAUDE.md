# Kids game template: notes for Claude

This repo is the starting point for small PWA games for kids aged 4–8. Each game lives in its own repo created from this template. Read this whole file before changing anything. It holds lessons learned the hard way on the first game (Rocket Hunt, `robotman4/rocketgame`).

## The owner and how to work with them

- They do devops: bash, python, powershell, Linux, Docker, Git, Ansible. They are not a game developer.
- Give clear, direct answers. Start with yes or no when it fits. No praise, no filler. If an explanation is needed, give it first, then the answer.
- Keep it conversational. No long lists of things to test.
- They test on a real iPad, and sometimes an iPhone. Bugs get reported as "on one level the treasure jumped out of reach". Reproduce the exact situation in a headless browser before fixing it, and say honestly when you couldn't reproduce it.

## Design rules for the games

- **Players are 4–8:** simple but thoughtful.
- **Almost no text:** guide the player with icons, arrows, glow and a pointing hand. Numbers are fine for a countdown.
- **iPad landscape first, iPhone second:** when the two conflict, the iPad wins. Portrait shows a "rotate your device" screen (in `index.html`).
- **Never punishing:** no dying and no losing progress. Enemies may annoy (push, steal, block) but never take anything away for good. The owner may ask for a clearly marked harder mode as an exception. Rocket Hunt planets 21–30 have two hearts and restart the planet on the second hit, but have no game-over screen, and are announced with a warning sign, a red sky and spiky enemies.
- **Scoring:** 1–3 stars, never 0. Finishing a level is always a success.
- **Hints:** if the player has done nothing for about 5 seconds, show the hint hand or an arrow.
- **Touch:** generous hit areas (radius plus 20–30), and tapping should work everywhere dragging does.
- **Look:** bright, rounded, thick dark outline (`INK` in `draw.js`). Everything is drawn in code, with no image files except the app icons.
- **Sound:** synthesized chiptune / keygen-style music and sound effects (`audio.js`), with a mute button on every screen. The songs are `menu`, `calm`, `play`, `danger` (tense) and `space` (no drums). The effects include pop, coin, snap, bounce, jump, hit, hurt, alarm, lose, star, ready, whoosh and fanfare.
- **Saving:** progress lives on the device in `localStorage`, one player.

## Architecture

- Vanilla JS on a 2D canvas, built with Vite. Offline and update support come from `vite-plugin-pwa`. No framework and no game engine, on purpose.
- **Logical coordinates:** the height is always 768 and the width follows the screen aspect (1024 on iPad, about 1660 on iPhone). `V` in `core.js` holds the size, the scale, the safe-area insets (`safeL`, `safeR`, `safeT`, `safeB`) and the UI scale (`V.ui`, bigger buttons on phones).
- **Scenes:** `main.js` runs the loop and calls `scene.update(dt)`, `scene.draw(ctx)`, `scene.onDown/onMove/onUp(p)` and `scene.enter()`/`exit()`. Use `game.go(scene)` for a fade transition, or set `game.scene = x; x.enter()` for an instant switch, for example to keep an animation seamless.
- **Never name a scene property `update`.** It overwrites the `update()` method. That bug already happened once with the update button, which is why it's called `updBtn`.
- **Helpers:** `Tweens` (with an `arc` option for jumps), `Particles` (smoke, sparks, stars, confetti, fireworks), `rng(seed)` for planets or levels that look the same every visit, `Button` with icon names, and `drawHand`/`drawArrow` for hints.
- **Colour helpers** (`shade`, `mix`) take and return hex. Feeding their output back in must keep working; a `rgb()` string once broke all night-time colours.
- `window.__game` exposes the running game, for headless tests and debugging.

## iOS lessons (important)

- **Don't create the AudioContext before the first touch.** iOS keeps a context created outside a gesture silent forever, even after `resume()`. `audio.js` waits for the first tap. `playMusic()` called before that only remembers the song.
- **After the app has been in the background, or audio was interrupted** (notification, Siri, another app), iOS can report the context as "running" while it plays nothing. `audio.js` rebuilds the context on the next tap. Turning sound back on also rebuilds it.
- **Unlock on `pointerdown`, `touchend`, `pointerup` and `click`,** and start a 1-sample silent buffer inside the gesture.
- Set `navigator.audioSession.type = 'playback'` (iOS 17+).
- **Safe areas:** the notch and rounded corners eat about 90 logical units on the left and right of an iPhone in landscape. Keep anything the player must see or tap inside `V.safeL + 100` to `V.w - V.safeR - 100`.
- `touch-action: none`, no long-press callouts, no double-tap zoom, no overscroll. All of this is in `index.html` and `main.js`.
- **Don't size the canvas from `window.innerHeight`.** iOS sometimes reports it too small or stale (after rotating, returning to the app, around the home indicator), which left a strip of page background at the bottom. The canvas is stretched by CSS (`position: fixed; inset: 0`), and `main.js` measures its real box, re-checks after rotating and returning, and runs a once-a-second safety check.

## Gameplay lessons

- **Anything that can fly or bounce must stay reachable.** Clamp the x position to the reachable range on every frame while it moves, and once it lands. Make revealed items jump toward the player, never toward an edge.
- **Things that roll or move out of the way** (rocks and so on) should move toward the middle of the level and end upright.
- **Enemy contact checks need a short grace period** after a grab or a hit. Otherwise "touching" counts as caught or hit again straight away.
- **Difficulty should grow slowly per level,** controlled from one function (like `levelSpec(level)`), so it's easy to tune after the kids have played.
- **Scheduled music:** if the scheduler falls behind (busy frame, app paused), skip ahead instead of playing all the missed notes at once.

## Deploy and update

- `.github/workflows/deploy.yml` builds and deploys to GitHub Pages on push to `main` or `claude/**`. `BASE_PATH` is set from the repo name automatically. The workflow skips the template repo itself.
- **One-time setup per new repo:** Settings → Pages → Source must be set to **GitHub Actions**. "Deploy from a branch" publishes the unbuilt source, and the page loads blank.
- The `github-pages` environment usually only allows the default branch to deploy. If a `claude/...` branch is blocked, either merge to `main` or allow `claude/*` under Settings → Environments → github-pages.
- **Update flow:** when a new version is downloaded, a green pulsing download button appears top-left on the title screen (`pwa.js`, `updateButton()` in `ui.js`). Tapping it calls `tapUpdate()`: the button spins with sparkles and confetti, then the app reloads into the new version, and the save is kept. The app checks for updates every 2 hours and whenever it comes back from the background.
- **Update celebration:** before reloading, `pwa.apply()` sets a flag in `localStorage`. After the reload, the title screen shows a wrapped present (`Gift` in `celebrate.js`). Tapping it opens it with a fanfare, confetti, fireworks and a prize flying out. That tap is also the first touch, so iOS lets the sound play. Swap the crown prize for something from the game (Rocket Hunt shoots out a rocket with a special part). Change the flag prefix in `pwa.js` per game.
- **Info panel (ⓘ button, `info.js`):** for parents. It covers what the game is, the data statement (nothing collected, progress only on the device, offline), the "as is / own risk" disclaimer, the version (`__APP_VERSION__`: build date plus commit, defined in `vite.config.js`) and a **Check for updates** button (`pwa.check()` returns `'available'`, `'latest'` or `'error'`). Text is allowed here because it is for adults. The text is bigger on phones. Update the first section for each game.

## How to test

- Run `npm run build && npx vite preview --port 4173`, then drive the game with Playwright. It's installed globally (`require('/opt/node22/lib/node_modules/playwright')`); Chromium lives in `/opt/pw-browsers`. Do not run `playwright install`.
- Test at 1024×768 (iPad) and 844×390 (iPhone). To simulate the notch, inject the style `#safe{padding:0 47px 21px 47px !important}`.
- Drive scenes through `window.__game.scene` (call `onDown` with logical coordinates, or use real `page.mouse.click`). Take screenshots and look at them. Write automated play-throughs ("bots") that finish whole levels, and check for page errors.
- Class names are minified in the build, so don't rely on `constructor.name`.
- Background `vite preview` servers die between shell calls. Start one in the same command as the test, or check that it's up first.

## Starting a new game from this template

1. Change `GAME_TITLE` in `src/scenes/title.js`, `NAME`/`DESCRIPTION`/`THEME` in `vite.config.js`, the `<title>` and `apple-mobile-web-app-title` in `index.html`, `KEY` in `src/storage.js`, `FLAG` in `src/pwa.js`, the first section in `src/info.js`, and `name` in `package.json`.
2. Regenerate the icons with `python3 scripts/make_icons.py` (needs Pillow). Change the drawing in that script for the new game.
3. Replace `src/scenes/play.js` (an example balloon-popping game) with the real game. Keep the patterns: hint after idle time, 1–3 stars, `recordLevel`, a home and a sound button.
4. Update `README.md` for the new game, and this file with anything new learned.
