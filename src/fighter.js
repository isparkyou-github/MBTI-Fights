// The Fighter: physics, state machine, universal attacks, and special execution.
// Driven each logic step by an `intent` object (from the human input or the AI):
//   { left, right, jump, block, lp, hp, lk, hk, special }  (all booleans)

import {
  ARENA, PHYSICS, FIGHTER, MOVES,
  DEFENDER_METER_GAIN, BLOCK_METER_GAIN, CHIP_FACTOR,
} from "./config.js";
import { getSpecial, SPECIAL_METER_COST } from "./specials.js";
import { clamp, approach, rectsOverlap } from "./utils.js";

export class Fighter {
  constructor(character, x, facing) {
    this.character = character;
    this.maxHealth = character.stats.health;
    this.health = this.maxHealth;
    this.maxMeter = FIGHTER.maxMeter;
    this.meter = 0;

    this.x = x;
    this.y = ARENA.floorY;
    this.facing = facing; // 1 = right, -1 = left
    this.vx = 0;
    this.vy = 0;
    this.onGround = true;

    this.state = "idle"; // idle|walk|jump|attack|special|block|hitstun|ko|win
    this.animTime = 0;

    // attack bookkeeping
    this.move = null;
    this.currentMoveName = null;
    this.moveTimer = 0;
    this.attackHasHit = false;

    // special bookkeeping
    this.special = null;
    this.specialTimer = 0;
    this.specialStarted = false;
    this.specialHitTimer = 0;
    this.counterActive = false;
    this.noBodyCollision = false;

    this.hitstunTimer = 0;
    this.blockstunTimer = 0;

    this.buffs = { atkMult: 1, defMult: 1, reflect: false, timer: 0 };
    this.heal = { remaining: 0, perFrame: 0 };

    this.hitFlash = 0;
    this.armorFlash = 0;

    this.opponent = null;
    this.match = null;
  }

  // -------- boxes --------
  hurtbox() {
    const w = FIGHTER.bodyW;
    const h = FIGHTER.bodyH;
    return { x: this.x - w / 2, y: this.y - h, w, h };
  }

  attackHitbox() {
    if (!this.move) return null;
    const b = this.move.box;
    const x = this.facing === 1 ? this.x + b.x : this.x - b.x - b.w;
    return { x, y: this.y + b.y, w: b.w, h: b.h };
  }

  specialMeleeBox(melee) {
    if (melee.center) {
      return { x: this.x + melee.x, y: this.y + melee.y, w: melee.w, h: melee.h };
    }
    const x = this.facing === 1 ? this.x + melee.x : this.x - melee.x - melee.w;
    return { x, y: this.y + melee.y, w: melee.w, h: melee.h };
  }

  canAct() {
    return this.state === "idle" || this.state === "walk" ||
           this.state === "jump" || this.state === "block";
  }

  // -------- main update --------
  update(intent, opponent, match) {
    this.animTime++;
    this.opponent = opponent;
    this.match = match;

    this.tickTimers();

    if (this.state === "ko") {
      this.applyPhysics();
      return;
    }

    if (this.canAct() && this.onGround) {
      this.facing = opponent.x >= this.x ? 1 : -1;
    }

    switch (this.state) {
      case "attack": this.updateAttack(opponent, match); break;
      case "special": this.updateSpecial(opponent, match); break;
      case "hitstun": this.updateHitstun(); break;
      default: this.updateNeutral(intent); break;
    }

    this.applyPhysics();
  }

  tickTimers() {
    if (this.buffs.timer > 0) {
      this.buffs.timer--;
      if (this.buffs.timer <= 0) {
        this.buffs.atkMult = 1;
        this.buffs.defMult = 1;
        this.buffs.reflect = false;
      }
    }
    if (this.heal.remaining > 0) {
      const amt = Math.min(this.heal.perFrame, this.heal.remaining);
      this.health = Math.min(this.maxHealth, this.health + amt);
      this.heal.remaining -= amt;
    }
    if (this.hitFlash > 0) this.hitFlash--;
    if (this.armorFlash > 0) this.armorFlash--;
  }

  // -------- neutral (idle/walk/jump/block) --------
  updateNeutral(intent) {
    const speed = this.character.stats.speed;

    if (this.blockstunTimer > 0) {
      this.blockstunTimer--;
      this.state = "block";
      this.vx = approach(this.vx, 0, 1);
      return;
    }

    // ground action: special > attacks > jump > move/block
    if (this.onGround) {
      if (intent.special && this.meter >= SPECIAL_METER_COST && getSpecial(this.character.special)) {
        this.startSpecial();
        return;
      }
      if (intent.lp) return this.startAttack("light_punch");
      if (intent.hp) return this.startAttack("heavy_punch");
      if (intent.lk) return this.startAttack("light_kick");
      if (intent.hk) return this.startAttack("heavy_kick");

      if (intent.jump) {
        this.vy = this.character.stats.jump;
        this.onGround = false;
        this.state = "jump";
        return;
      }
    }

    let dx = 0;
    if (intent.left) dx -= 1;
    if (intent.right) dx += 1;

    if (this.onGround) {
      if (intent.block) {
        this.vx = 0;
        this.state = "block";
      } else if (dx !== 0) {
        this.vx = dx * speed;
        this.state = "walk";
      } else {
        this.vx = 0;
        this.state = "idle";
      }
    } else {
      // air drift
      if (dx !== 0) this.vx = clamp(this.vx + dx * PHYSICS.airDrift, -speed, speed);
      this.state = "jump";
    }
  }

  // -------- universal attacks --------
  startAttack(name) {
    this.state = "attack";
    this.currentMoveName = name;
    this.move = MOVES[name];
    this.moveTimer = 0;
    this.attackHasHit = false;
    this.vx = 0;
  }

  updateAttack(opponent, match) {
    this.moveTimer++;
    this.vx = 0;
    const m = this.move;
    const t = this.moveTimer;
    const activeStart = m.startup;
    const activeEnd = m.startup + m.active;

    if (t > activeStart && t <= activeEnd && !this.attackHasHit) {
      const hb = this.attackHitbox();
      if (hb && opponent.state !== "ko" && rectsOverlap(hb, opponent.hurtbox())) {
        this.attackHasHit = true;
        opponent.applyHit({
          damage: m.damage * this.buffs.atkMult,
          knockbackX: m.knockbackX, knockbackY: m.knockbackY,
          hitstun: m.hitstun, dir: this.facing, attacker: this, meterGain: m.meterGain,
        });
        this.addMeter(m.meterGain);
        match.addSparks(hb.x + hb.w / 2, hb.y + hb.h / 2, this.character.colors.accent);
      }
    }

    if (t >= m.startup + m.active + m.recovery) {
      this.state = "idle";
      this.move = null;
      this.currentMoveName = null;
    }
  }

  // -------- special --------
  startSpecial() {
    const sp = getSpecial(this.character.special);
    this.meter -= SPECIAL_METER_COST;
    this.state = "special";
    this.special = sp;
    this.specialTimer = 0;
    this.specialStarted = false;
    this.specialHitTimer = 0;
    this.counterActive = false;
    this.noBodyCollision = false;
    this.vx = 0;
  }

  updateSpecial(opponent, match) {
    this.specialTimer++;
    const sp = this.special;
    const t = this.specialTimer;
    const activeStart = sp.startup;
    const activeEnd = sp.startup + sp.active;

    if (t === activeStart + 1 && !this.specialStarted) {
      this.specialStarted = true;
      if (sp.noBodyCollision) this.noBodyCollision = true;
      if (sp.dashVy) { this.vy = sp.dashVy; this.onGround = false; }
      if (sp.onStart) sp.onStart(this, match);
    }

    if (t > activeStart && t <= activeEnd) {
      const af = t - activeStart - 1;
      if (sp.dashVx) this.vx = sp.dashVx * this.facing;
      if (sp.onActiveTick) sp.onActiveTick(this, match, af);
      if (sp.counter) this.counterActive = true;
      if (sp.melee) this.updateSpecialMelee(sp.melee, opponent, match);
    } else {
      this.counterActive = false;
    }

    if (t > activeEnd && this.onGround && sp.dashVx) this.vx *= 0.8;

    if (t >= sp.startup + sp.active + sp.recovery) {
      this.endSpecial();
    }
  }

  updateSpecialMelee(melee, opponent, match) {
    this.specialHitTimer--;
    if (this.specialHitTimer > 0) return;
    const hb = this.specialMeleeBox(melee);
    if (opponent.state !== "ko" && rectsOverlap(hb, opponent.hurtbox())) {
      opponent.applyHit({
        damage: melee.damage * this.buffs.atkMult,
        knockbackX: melee.knockbackX, knockbackY: melee.knockbackY,
        hitstun: melee.hitstun, dir: this.facing, attacker: this,
        launch: melee.launch, meterGain: 4,
      });
      this.specialHitTimer = melee.interval > 0 ? melee.interval : 99999;
      this.addMeter(2);
      match.addSparks(opponent.x, opponent.y - 70, this.character.colors.accent);
    }
  }

  endSpecial() {
    this.state = "idle";
    this.special = null;
    this.counterActive = false;
    this.noBodyCollision = false;
  }

  // -------- being hit --------
  applyHit(hit) {
    if (this.state === "ko") return;

    // ISFJ counter: negate and punish.
    if (this.counterActive) {
      const cd = (this.special && this.special.counterDamage) || 26;
      this.counterActive = false;
      this.endSpecial();
      if (hit.attacker && hit.attacker.state !== "ko") {
        hit.attacker.applyHit({
          damage: cd, knockbackX: 12, knockbackY: -4, hitstun: 26,
          dir: this.facing, attacker: this, meterGain: 0,
        });
      }
      this.match.addSparks(this.x, this.y - 90, "#ffffff");
      return;
    }

    let dmg = hit.damage * this.buffs.defMult;

    // Block (front only).
    if (this.state === "block" && this.facing === -hit.dir) {
      dmg *= CHIP_FACTOR;
      this.health -= dmg;
      this.vx = hit.dir * 2;
      this.blockstunTimer = FIGHTER.blockstun;
      this.addMeter(BLOCK_METER_GAIN);
      if (this.health <= 0) this.knockOut();
      return;
    }

    this.health -= dmg;
    this.addMeter(DEFENDER_METER_GAIN);

    // ISTJ super armor during startup: take damage, ignore stun/knockback.
    const armored =
      this.state === "special" && this.special && this.special.armorStartup &&
      this.specialTimer <= this.special.startup;
    if (armored) {
      this.armorFlash = 6;
      if (this.health <= 0) this.knockOut();
      return;
    }

    this.state = "hitstun";
    this.hitstunTimer = hit.hitstun;
    this.vx = hit.dir * (hit.knockbackX || 4);
    this.vy = hit.knockbackY || 0;
    if (hit.launch || this.vy < 0) this.onGround = false;
    this.hitFlash = 6;
    this.move = null;
    this.special = null;
    this.noBodyCollision = false;
    this.counterActive = false;

    if (this.health <= 0) this.knockOut();
  }

  updateHitstun() {
    this.hitstunTimer--;
    if (this.hitstunTimer <= 0 && this.onGround) this.state = "idle";
  }

  knockOut() {
    this.health = 0;
    this.state = "ko";
    this.vx *= 0.4;
  }

  // -------- physics --------
  applyPhysics() {
    if (!this.onGround) this.vy += PHYSICS.gravity;
    this.x += this.vx;
    this.y += this.vy;

    if (this.y >= ARENA.floorY) {
      this.y = ARENA.floorY;
      this.vy = 0;
      if (!this.onGround) {
        this.onGround = true;
        if (this.state === "jump") this.state = "idle";
        if (this.state === "hitstun" && this.hitstunTimer <= 0) this.state = "idle";
      }
    }

    if (this.onGround &&
        (this.state === "idle" || this.state === "hitstun" ||
         this.state === "block" || this.state === "ko")) {
      this.vx = approach(this.vx, 0, PHYSICS.friction);
    }

    this.x = clamp(this.x, ARENA.leftWall, ARENA.rightWall);
  }

  // -------- helpers --------
  addMeter(n) {
    if (this.state === "ko") return;
    this.meter = clamp(this.meter + n, 0, this.maxMeter);
  }

  startHeal(amount, frames) {
    this.heal = { remaining: amount, perFrame: amount / frames };
  }

  canSpecial() {
    return this.meter >= SPECIAL_METER_COST;
  }
}
