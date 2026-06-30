// The 16 unique 大招 (specials), built from a handful of reusable mechanics:
// projectile, arc-bomb, multi-projectile, dash, melee strike, spin-AoE,
// heal, buff, counter, ground-shockwave, ranged-burst, launcher.
//
// Each special declares timing (startup/active/recovery) and optional hooks the
// Fighter runs while it executes:
//   onStart(f, m)            once, when the active phase begins
//   onActiveTick(f, m, i)    every active frame (i = 0-based active frame)
//   melee {...}              a hitbox the Fighter checks each active frame
//   counter:true             counter stance during active
//   armorStartup:true        super armor during startup
//   dashVx / dashVy          velocity applied once at activation
//   noBodyCollision:true     pass through opponent's body during the move

import { Projectile } from "./projectile.js";
import { ARENA } from "./config.js";
import { rand } from "./utils.js";

const Y = ARENA.floorY;

function forward(f, over) {
  const c = f.character.colors;
  return new Projectile({
    owner: f,
    facing: f.facing,
    x: f.x + f.facing * 48,
    y: Y - 92,
    color: c.main,
    accent: c.accent,
    ...over,
  });
}

function explosion(f, x, y, over) {
  const c = f.character.colors;
  return new Projectile({
    owner: f, facing: f.facing,
    x, y, vx: 0, vy: 0, gravity: 0,
    w: 24, h: 24, growW: 9, growH: 9,
    life: 14, kind: "burst", pierce: true, reflectable: false,
    color: c.light, accent: c.accent,
    ...over,
  });
}

export const SPECIALS = {
  // --- Analysts ---
  beam: { // INTJ — charged energy beam
    startup: 12, active: 6, recovery: 22,
    onStart(f, m) {
      m.spawnProjectile(forward(f, {
        vx: 11 * f.facing, w: 56, h: 28,
        damage: 22, knockbackX: 9, knockbackY: -2, hitstun: 24,
        life: 95, kind: "beam", reflectable: true,
      }));
    },
  },

  bomb: { // INTP — lobbed bomb that explodes into an AoE
    startup: 12, active: 8, recovery: 24,
    onStart(f, m) {
      m.spawnProjectile(forward(f, {
        vx: 7 * f.facing, vy: -9, gravity: 0.6, w: 30, h: 30,
        damage: 9, knockbackX: 5, hitstun: 14,
        life: 120, kind: "bomb", reflectable: true, explodeOnGround: true,
        onExpire: (mm, p) => {
          mm.spawnProjectile(explosion(f, p.x, Y - 36, {
            w: 40, h: 40, growW: 11, growH: 11, life: 16,
            damage: 18, knockbackX: 8, knockbackY: -5, hitstun: 22,
          }));
          mm.addSparks(p.x, Y - 36, f.character.colors.accent);
        },
      }));
    },
  },

  rush: { // ENTJ — dashing multi-hit charge
    startup: 8, active: 16, recovery: 18,
    dashVx: 9, noBodyCollision: true,
    melee: { x: 8, y: -118, w: 76, h: 100, damage: 6, knockbackX: 4, knockbackY: 0, hitstun: 12, interval: 5 },
  },

  barrage: { // ENTP — rapid spread of small projectiles
    startup: 10, active: 18, recovery: 20,
    onActiveTick(f, m, i) {
      if (i % 3 === 0) {
        m.spawnProjectile(forward(f, {
          y: Y - 96 + rand(-6, 6),
          vx: 10 * f.facing, vy: rand(-1.6, 1.6), w: 26, h: 18,
          damage: 5, knockbackX: 3, hitstun: 10, life: 70,
          kind: "word", reflectable: true,
        }));
      }
    },
  },

  // --- Diplomats ---
  shield: { // INFJ — defensive buff + reflect next projectile
    startup: 6, active: 4, recovery: 14,
    onStart(f) {
      f.buffs.defMult = 0.5;
      f.buffs.reflect = true;
      f.buffs.timer = 240;
    },
  },

  heal: { // INFP — self heal over time
    startup: 8, active: 6, recovery: 26,
    onStart(f) { f.startHeal(30, 60); },
  },

  inspire: { // ENFJ — strike that also buffs own attack
    startup: 10, active: 5, recovery: 18,
    melee: { x: 18, y: -112, w: 60, h: 62, damage: 16, knockbackX: 8, knockbackY: -3, hitstun: 20, interval: 0 },
    onStart(f) { f.buffs.atkMult = 1.5; f.buffs.timer = 300; },
  },

  whirlwind: { // ENFP — spinning AoE around self
    startup: 8, active: 22, recovery: 18,
    melee: { x: -62, y: -122, w: 124, h: 122, damage: 5, knockbackX: 5, knockbackY: -1, hitstun: 12, interval: 6, center: true },
  },

  // --- Sentinels ---
  armorstrike: { // ISTJ — armored heavy strike
    startup: 14, active: 6, recovery: 24,
    armorStartup: true,
    melee: { x: 18, y: -120, w: 68, h: 84, damage: 26, knockbackX: 12, knockbackY: -4, hitstun: 26, interval: 0 },
  },

  counter: { // ISFJ — counter stance, auto-punishes the next hit
    startup: 4, active: 36, recovery: 16,
    counter: true,
    counterDamage: 26,
  },

  shockwave: { // ESTJ — ground shockwave
    startup: 12, active: 6, recovery: 22,
    onStart(f, m) {
      m.spawnProjectile(forward(f, {
        x: f.x + f.facing * 40, y: Y - 22,
        vx: 8 * f.facing, w: 48, h: 46,
        damage: 20, knockbackX: 9, knockbackY: -6, hitstun: 22,
        life: 80, kind: "shock", reflectable: false,
      }));
    },
  },

  aura: { // ESFJ — heal + defensive buff (support)
    startup: 8, active: 6, recovery: 22,
    onStart(f) { f.startHeal(18, 45); f.buffs.defMult = 0.6; f.buffs.timer = 300; },
  },

  // --- Explorers ---
  combo: { // ISTP — fast wrench dash combo
    startup: 6, active: 20, recovery: 16,
    dashVx: 7, noBodyCollision: true,
    melee: { x: 6, y: -112, w: 66, h: 92, damage: 4, knockbackX: 2, knockbackY: 0, hitstun: 9, interval: 3 },
  },

  burst: { // ISFP — colorful expanding burst at range
    startup: 12, active: 10, recovery: 20,
    onStart(f, m) {
      m.spawnProjectile(explosion(f, f.x + f.facing * 120, Y - 84, {
        w: 22, h: 22, growW: 8, growH: 8, life: 16,
        damage: 22, knockbackX: 8, knockbackY: -4, hitstun: 22, kind: "burst",
      }));
    },
  },

  flyingkick: { // ESTP — leaping launcher kick
    startup: 8, active: 14, recovery: 20,
    dashVx: 8, dashVy: -11, noBodyCollision: true,
    melee: { x: 14, y: -132, w: 64, h: 116, damage: 20, knockbackX: 6, knockbackY: -15, hitstun: 26, interval: 0, launch: true },
  },

  spotlight: { // ESFP — dazzling multi-hit around self + brief stun
    startup: 8, active: 18, recovery: 18,
    melee: { x: -56, y: -132, w: 112, h: 132, damage: 5, knockbackX: 3, knockbackY: -1, hitstun: 18, interval: 6, center: true },
    onActiveTick(f, m, i) {
      if (i % 4 === 0) m.addSparks(f.x + rand(-50, 50), Y - rand(40, 130), f.character.colors.accent);
    },
  },
};

export const SPECIAL_METER_COST = 100;

export function getSpecial(id) {
  return SPECIALS[id];
}
