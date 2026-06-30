// Small shared helpers.

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

export const lerp = (a, b, t) => a + (b - a) * t;

export const sign = (v) => (v < 0 ? -1 : v > 0 ? 1 : 0);

export const rand = (lo, hi) => lo + Math.random() * (hi - lo);

export const randInt = (lo, hi) => Math.floor(rand(lo, hi + 1));

export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export const chance = (p) => Math.random() < p;

// Axis-aligned bounding-box overlap. Boxes are {x, y, w, h} (top-left origin).
export function rectsOverlap(a, b) {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

// Linear approach: move `v` toward `target` by at most `step`.
export function approach(v, target, step) {
  if (v < target) return Math.min(v + step, target);
  if (v > target) return Math.max(v - step, target);
  return v;
}
