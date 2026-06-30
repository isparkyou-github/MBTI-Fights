// Preloads the 32 character sprites (assets/sprites/<ID>.png) and hands them out.

import { CHARACTERS } from "./characters.js";

const images = new Map();
let loaded = 0;
const total = CHARACTERS.length;

export function preloadSprites() {
  return Promise.all(CHARACTERS.map((ch) => new Promise((resolve) => {
    const img = new Image();
    img.onload = () => { images.set(ch.id, img); loaded++; resolve(); };
    img.onerror = () => { loaded++; resolve(); }; // never block the game on a bad file
    img.src = `assets/sprites/${ch.id}.png`;
  })));
}

export function getSprite(id) { return images.get(id); }
export function allSprites() { return images; }
export function spritesReady() { return loaded >= total; }
export function loadProgress() { return total ? loaded / total : 1; }
