// A single fight: owns the two fighters, projectiles, particles, timer, and the
// win condition. Driven one fixed step at a time by main.js.

import { Fighter } from "./fighter.js";
import { updateProjectiles } from "./projectile.js";
import { aiIntent, createAIState } from "./ai.js";
import { ARENA, FIGHTER, ROUND, GAME } from "./config.js";
import { clamp, rand } from "./utils.js";
import { Sfx } from "./audio.js";

export class Match {
  constructor(charP1, charP2, mode) {
    this.fighters = [
      new Fighter(charP1, ARENA.p1StartX, 1),
      new Fighter(charP2, ARENA.p2StartX, -1),
    ];
    this.mode = mode; // 'cpu' | '2p'
    this.projectiles = [];
    this.particles = [];
    this.timeLeft = ROUND.time;
    this.over = false;
    this.winner = null; // 0 | 1 | 'draw'
    this.endTimer = 0;
    this.aiState = mode === "cpu" ? createAIState() : null;

    this.prevHealth = this.fighters.map((f) => f.health);
    this.prevSpecial = [false, false];
    this.prevGround = [true, true];
  }

  opponentOf(f) {
    return f === this.fighters[0] ? this.fighters[1] : this.fighters[0];
  }

  spawnProjectile(p) { this.projectiles.push(p); }

  addSparks(x, y, color) {
    for (let i = 0; i < 8; i++) {
      this.particles.push({
        x, y,
        vx: rand(-3.5, 3.5), vy: rand(-4.5, 1),
        life: rand(10, 24), maxLife: 24,
        size: rand(1.5, 3.8), color,
      });
    }
  }

  // intents: { p1, p2 } — each an intent object; p2 ignored in cpu mode.
  step(intents) {
    const [f1, f2] = this.fighters;

    if (this.over) {
      const blank = blankIntent();
      f1.update(blank, f2, this);
      f2.update(blank, f1, this);
      updateProjectiles(this);
      this.updateParticles();
      this.endTimer++;
      return;
    }

    this.timeLeft = Math.max(0, this.timeLeft - 1 / GAME.fps);

    const i1 = intents.p1 || blankIntent();
    const i2 = this.mode === "cpu" ? aiIntent(f2, f1, this.aiState) : (intents.p2 || blankIntent());

    f1.update(i1, f2, this);
    f2.update(i2, f1, this);

    this.bodyCollision();
    updateProjectiles(this);
    this.updateParticles();
    this.checkSfx();
    this.checkEnd();
  }

  bodyCollision() {
    const [f1, f2] = this.fighters;
    if (f1.noBodyCollision || f2.noBodyCollision) return;
    const dx = f2.x - f1.x;
    const minDist = FIGHTER.bodyW * 0.82;
    if (Math.abs(dx) < minDist) {
      const overlap = (minDist - Math.abs(dx)) / 2;
      const s = dx >= 0 ? 1 : -1;
      f1.x = clamp(f1.x - s * overlap, ARENA.leftWall, ARENA.rightWall);
      f2.x = clamp(f2.x + s * overlap, ARENA.leftWall, ARENA.rightWall);
    }
  }

  updateParticles() {
    for (const p of this.particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.22;
      p.life--;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
  }

  checkSfx() {
    for (let i = 0; i < 2; i++) {
      const f = this.fighters[i];
      const drop = this.prevHealth[i] - f.health;
      if (drop > 0.6) {
        if (f.state === "block") Sfx.block();
        else if (drop >= 10) Sfx.hitHeavy();
        else Sfx.hitLight();
      }
      const inSpecial = f.state === "special";
      if (inSpecial && !this.prevSpecial[i]) Sfx.special();
      if (!f.onGround && this.prevGround[i] && f.state === "jump") Sfx.jump();
      this.prevHealth[i] = f.health;
      this.prevSpecial[i] = inSpecial;
      this.prevGround[i] = f.onGround;
    }
  }

  checkEnd() {
    const [f1, f2] = this.fighters;
    const dead1 = f1.health <= 0, dead2 = f2.health <= 0;
    if (!dead1 && !dead2 && this.timeLeft > 0) return;

    this.over = true;
    if (dead1 && dead2) this.winner = "draw";
    else if (dead1) this.winner = 1;
    else if (dead2) this.winner = 0;
    else if (f1.health > f2.health) this.winner = 0;
    else if (f2.health > f1.health) this.winner = 1;
    else this.winner = "draw";

    if (this.winner !== "draw") this.fighters[this.winner].state = "idle";
    Sfx.ko();
  }
}

function blankIntent() {
  return {
    left: false, right: false, jump: false, block: false,
    lp: false, hp: false, lk: false, hk: false, special: false,
  };
}
