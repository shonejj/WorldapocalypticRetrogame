// Asset pipeline: assets-src/ (painted source art) → public/assets/ (optimised, game-ready).
// Run `npm run assets` after changing source art or the store name in src/config/game.ts.
import { mkdirSync, writeFileSync } from 'node:fs';
import { buildLayers } from './layers.mjs';
import { buildCharacters } from './characters.mjs';

const OUT = new URL('../public/assets/', import.meta.url).pathname;
const SRC = new URL('../assets-src/', import.meta.url).pathname;
mkdirSync(`${OUT}layers`, { recursive: true });
mkdirSync(`${OUT}chars`, { recursive: true });
const only = process.argv[2];
const t0 = Date.now();
const manifest = { layers: {}, chars: {} };
if (!only || only === 'layers') manifest.layers = await buildLayers(`${SRC}layers`, `${OUT}layers`);
if (!only || only === 'chars') manifest.chars = await buildCharacters(`${SRC}characters`, `${OUT}chars`);
if (!only) writeFileSync(new URL('../src/game/assetManifest.json', import.meta.url), JSON.stringify(manifest, null, 1));
console.log(`assets built in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
