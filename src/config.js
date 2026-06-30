// Global tunables. Everything is expressed in canvas pixels and 60fps frames.

export const GAME = {
  width: 960,
  height: 540,
  fps: 60,
  step: 1000 / 60, // fixed timestep in ms
};

export const ARENA = {
  floorY: 470, // y where fighters' feet rest
  leftWall: 30,
  rightWall: 930,
  p1StartX: 320,
  p2StartX: 640,
};

export const PHYSICS = {
  gravity: 0.9,
  friction: 0.55,
  walkSpeed: 3.6,
  airDrift: 0.6,
  jumpVelocity: -15.5,
  pushApart: 0.6, // how strongly overlapping bodies separate
};

export const FIGHTER = {
  bodyW: 60, // collision/hurtbox width
  bodyH: 130, // collision/hurtbox height (standing)
  maxHealth: 100,
  maxMeter: 100,
  blockstun: 8,
};

export const ROUND = {
  time: 75, // seconds
  startMeter: 0,
};

// Universal attacks. `box` is the hitbox in front of the fighter, measured from
// the fighter's feet-center origin and facing right (mirrored when facing left).
//   box.x  = horizontal offset of the box's near edge from center
//   box.y  = top of the box measured upward from the feet (negative = up)
//   box.w/h = size
export const MOVES = {
  light_punch: {
    name: "小拳", startup: 3, active: 3, recovery: 7,
    damage: 5, knockbackX: 3, knockbackY: 0, hitstun: 11, meterGain: 6,
    box: { x: 22, y: -108, w: 44, h: 26 },
  },
  heavy_punch: {
    name: "大拳", startup: 8, active: 4, recovery: 16,
    damage: 12, knockbackX: 7, knockbackY: -2, hitstun: 19, meterGain: 10,
    box: { x: 22, y: -112, w: 58, h: 30 },
  },
  light_kick: {
    name: "小脚", startup: 5, active: 4, recovery: 10,
    damage: 7, knockbackX: 4, knockbackY: 0, hitstun: 13, meterGain: 7,
    box: { x: 24, y: -66, w: 64, h: 28 },
  },
  heavy_kick: {
    name: "大脚", startup: 11, active: 5, recovery: 18,
    damage: 14, knockbackX: 9, knockbackY: -3, hitstun: 22, meterGain: 12,
    box: { x: 24, y: -78, w: 86, h: 34 },
  },
};

// Meter gained by the defender when hit (attacker uses move.meterGain).
export const DEFENDER_METER_GAIN = 4;
export const BLOCK_METER_GAIN = 2;
export const CHIP_FACTOR = 0.2; // fraction of damage taken while blocking

export const CONTROLS = {
  p1: {
    left: "KeyA", right: "KeyD", jump: "KeyW", block: "KeyS",
    lp: "KeyF", hp: "KeyG", lk: "KeyC", hk: "KeyV", special: "KeyR",
    // menu navigation
    navLeft: "KeyA", navRight: "KeyD", navUp: "KeyW", navDown: "KeyS", confirm: "KeyF",
  },
  p2: {
    left: "ArrowLeft", right: "ArrowRight", jump: "ArrowUp", block: "ArrowDown",
    lp: "KeyJ", hp: "KeyK", lk: "KeyN", hk: "KeyM", special: "KeyU",
    navLeft: "ArrowLeft", navRight: "ArrowRight", navUp: "ArrowUp", navDown: "ArrowDown", confirm: "KeyJ",
  },
};
