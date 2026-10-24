import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { execSync } from 'node:child_process';

// Shown in the info panel: build date plus short commit id.
let sha = (process.env.GITHUB_SHA || '').slice(0, 7);
try { if (!sha) sha = execSync('git rev-parse --short HEAD').toString().trim(); } catch (e) { sha = 'dev'; }
const VERSION = `${new Date().toISOString().slice(0, 10)} (${sha})`;

// GitHub Pages serves the site from /<repo-name>/. The deploy workflow sets BASE_PATH
// from the repository name, so a repo created from this template needs no edits here.
const base = process.env.BASE_PATH || '/';

// Change these per game.
const NAME = 'Turbo Tumble Racers';
const SHORT = 'Turbo Tumble';
const DESCRIPTION = 'Launch funny toy vehicles through colourful 3D obstacle courses. A one-finger physics game for kids.';
const THEME = '#2a7fd4';

export default defineConfig({
  base,
  build: { chunkSizeWarningLimit: 4000 },
  define: { __APP_VERSION__: JSON.stringify(VERSION) },
  plugins: [
    VitePWA({
      // 'prompt': a new version waits until the player taps the update button (see src/pwa.js).
      registerType: 'prompt',
      includeAssets: ['icons/apple-touch-icon.png'],
      manifest: {
        name: NAME,
        short_name: SHORT,
        description: DESCRIPTION,
        display: 'fullscreen',
        orientation: 'any',
        background_color: THEME,
        theme_color: THEME,
        start_url: base,
        scope: base,
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      // The physics engine ships as WebAssembly inlined in a JS chunk (~2 MB), so raise the
      // precache limit or it would silently be left out and the game would not work offline.
      workbox: { globPatterns: ['**/*.{js,css,html,png,svg,wasm}'], maximumFileSizeToCacheInBytes: 8 * 1024 * 1024 },
    }),
  ],
});
