// Projectiles and the burst/explosion effects that specials spawn.
// Position (x, y) is the CENTER of the projectile.

import { ARENA, GAME } from "./config.js";
import { rectsOverlap } from "./utils.js";

const DEFAULTS = {
  vx: 0, vy: 0, gravity: 0,
  w: 30, h: 30,
  damage: 10, knockbackX: 5, knockbackY: 0, hitstun: 16,
  life: 120,
  kind: "beam", // beam | bomb | word | shock | burst | spark
  color: "#ffffff", accent: "#ffffff",
  pierce: false, // if true, can hit through (still one hit per target via hitSet)
  reflectable: false,
  launch: false,
  growW: 0, growH: 0,
  explodeOnGround: false,
  owner: null,
  facing: 1,
};

export class Projectile {
  constructor(opts) {
    Object.assign(this, DEFAULTS, opts);
    this.hitSet = new Set();
    this.age = 0;
    this.dead = false;
    this.onExpire = opts.onExpire || null;
  }

  update() {
    this.age++;
    this.x += this.vx;
    this.y += this.vy;
    this.vy += this.gravity;
    this.w += this.growW;
    this.h += this.growH;
    this.life--;
  }

  box() {
    return { x: this.x - this.w / 2, y: this.y - this.h / 2, w: this.w, h: this.h };
  }
}

// Run one step of all projectiles against the match. `match` must expose
// projectiles[], opponentOf(fighter), spawnProjectile(p), addSparks(x, y, color).
export function updateProjectiles(match) {
  for (const p of match.projectiles) {
    if (p.dead) continue;
    p.update();

    // Bombs detonate on the floor.
    if (p.explodeOnGround && p.y + p.h / 2 >= ARENA.floorY) {
      detonate(p, match);
      continue;
    }

    const target = match.opponentOf(p.owner);
    if (
      target &&
      target.state !== "ko" &&
      !p.hitSet.has(target) &&
      rectsOverlap(p.box(), target.hurtbox())
    ) {
      if (target.buffs.reflect && p.reflectable) {
        // Bounce it back at its original owner (INFJ shield).
        target.buffs.reflect = false;
        p.owner = target;
        p.facing *= -1;
        p.vx *= -1;
        p.hitSet.clear();
        p.color = target.character.colors.main;
        p.accent = target.character.colors.accent;
        match.addSparks(p.x, p.y, "#ffffff");
      } else {
        target.applyHit({
          damage: p.damage,
          knockbackX: p.knockbackX,
          knockbackY: p.knockbackY,
          hitstun: p.hitstun,
          dir: p.facing,
          attacker: p.owner,
          launch: p.launch,
          meterGain: 8,
          projectile: true,
        });
        p.hitSet.add(target);
        match.addSparks(p.x, p.y, p.accent);
        if (!p.pierce) {
          detonate(p, match);
          continue;
        }
      }
    }

    // Off-screen or expired.
    if (
      p.life <= 0 ||
      p.x < -80 || p.x > GAME.width + 80 ||
      p.y > GAME.height + 80
    ) {
      detonate(p, match);
    }
  }

  match.projectiles = match.projectiles.filter((p) => !p.dead);
}

function detonate(p, match) {
  if (p.dead) return;
  p.dead = true;
  if (p.onExpire) p.onExpire(match, p);
}
