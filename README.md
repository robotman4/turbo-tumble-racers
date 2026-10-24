# Kids game template

A starting point for small offline web games (PWAs) for kids aged 4–8, built for iPad (landscape) and iPhone.

It includes:
- A canvas engine with iPad and iPhone scaling, touch input, scenes, tweens and particles.
- Synthesized chiptune music and sound effects, with the iOS audio fixes already in place.
- Offline support, an in-game "update available" button with a celebration after updating, an ⓘ info panel for parents (data statement, disclaimer, version, check for updates), and automatic deploys to GitHub Pages.
- A small example game (pop the balloons) that shows the patterns to follow.
- `CLAUDE.md`, which holds the design rules and lessons for Claude to read when building a new game.

## Create a new game

1. On GitHub, click **Use this template** → **Create a new repository**.
2. In the new repo, go to **Settings → Pages → Source** and choose **GitHub Actions**.
3. Start a Claude Code session on the new repo and describe the game. Claude reads `CLAUDE.md` first.

The game will be at `https://<user>.github.io/<repo-name>/`. To install it on iPad or iPhone, open the link in Safari and choose Share → Add to Home Screen.

## Develop

```bash
npm install
npm run dev      # dev server reachable from a tablet on the same network
npm run build    # production build into dist/
npm run preview  # serve the built version
```
