// A lightweight CPU controller. Produces the same `intent` shape the human
// input produces, so the Fighter doesn't care who's driving it.
//
// Movement is continuous (recomputed every frame); attacks/jumps/specials fire
// only on a "decision tick" every ~12-20 frames so the CPU feels human and not
// frame-perfect.

import { randInt, pick, chance } from "./utils.js";

const RANGED = new Set(["beam", "bomb", "barrage", "shockwave", "burst"]);

function blankIntent() {
  return {
    left: false, right: false, jump: false, block: false,
    lp: false, hp: false, lk: false, hk: false, special: false,
  };
}

export function createAIState(difficulty = 0.7) {
  return { timer: 0, difficulty };
}

export function aiIntent(self, opp, st) {
  const intent = blankIntent();
  if (self.state === "ko" || opp.state === "ko") return intent;

  const dist = opp.x - self.x;
  const adist = Math.abs(dist);
  const toOpp = dist >= 0 ? 1 : -1;

  // Reactive block: opponent is committing to an attack up close.
  const oppAttacking = opp.state === "attack" || opp.state === "special";
  if (self.onGround && oppAttacking && adist < 130 && chance(0.12 * st.difficulty + 0.04)) {
    intent.block = true;
    return intent;
  }

  // Continuous spacing.
  if (adist > 160) {
    if (toOpp > 0) intent.right = true; else intent.left = true;
  } else if (adist < 64) {
    if (chance(0.25) && self.onGround) { if (toOpp > 0) intent.left = true; else intent.right = true; }
  } else {
    if (chance(0.65)) { if (toOpp > 0) intent.right = true; else intent.left = true; }
  }

  // Decision tick — fire at most one committal action.
  st.timer--;
  if (st.timer <= 0) {
    st.timer = randInt(12, 20);

    const ranged = RANGED.has(self.character.special);
    const specialReady = self.canSpecial();
    const specialInRange = ranged ? adist < 420 : adist < 110;

    if (specialReady && specialInRange && chance(0.5 * st.difficulty + 0.2)) {
      intent.special = true;
    } else if (adist < 96 && self.onGround) {
      // close: weighted poke / heavy
      intent[pick(["lp", "lp", "lk", "hp", "hk"])] = true;
    } else if (adist >= 96 && adist < 150 && self.onGround && chance(0.35)) {
      intent.jump = true; // hop in
    } else if (ranged && specialReady && chance(0.3)) {
      intent.special = true; // zone from afar
    }
  }

  return intent;
}
