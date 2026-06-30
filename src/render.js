// All in-fight drawing: arena, procedural low-poly fighters, projectiles,
// particles and the HUD. Pure canvas, no images.

import { GAME, ARENA, FIGHTER, ROUND } from "./config.js";
import { SPECIAL_METER_COST } from "./specials.js";

// ---------- low-level shapes ----------
function seg(ctx, x1, y1, x2, y2, w1, w2, color) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  ctx.beginPath();
  ctx.moveTo(x1 + nx * w1, y1 + ny * w1);
  ctx.lineTo(x2 + nx * w2, y2 + ny * w2);
  ctx.lineTo(x2 - nx * w2, y2 - ny * w2);
  ctx.lineTo(x1 - nx * w1, y1 - ny * w1);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function dot(ctx, x, y, r, color) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

function poly(ctx, pts, color) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

// Draw a two-segment limb. Angles: 0 = straight down, + = toward +x (forward).
// a2 is the elbow/knee bend relative to a1. Returns the end point.
function limb(ctx, ox, oy, a1, l1, a2, l2, w, color) {
  const ex = ox + Math.sin(a1) * l1;
  const ey = oy + Math.cos(a1) * l1;
  seg(ctx, ox, oy, ex, ey, w, w * 0.85, color);
  const aa = a1 + a2;
  const hx = ex + Math.sin(aa) * l2;
  const hy = ey + Math.cos(aa) * l2;
  seg(ctx, ex, ey, hx, hy, w * 0.85, w * 0.7, color);
  dot(ctx, ex, ey, w * 0.85, color);
  return { x: hx, y: hy };
}

// ---------- pose ----------
function poseFor(f) {
  const at = f.animTime;
  const p = {
    bob: 0, lean: 0,
    backLeg: [-0.12, 0.06], frontLeg: [0.12, 0.06],
    backArm: [-0.18, 0.35], frontArm: [0.18, 0.35],
    glow: null,
  };

  // attack extension factor: negative = wind-up, 1 = extended, decays in recovery
  const moveExt = () => {
    const m = f.move; const t = f.moveTimer;
    if (!m) return 0;
    if (t <= m.startup) return -(t / m.startup) * 0.3;
    if (t <= m.startup + m.active) return 1;
    return Math.max(0, 1 - (t - m.startup - m.active) / m.recovery);
  };

  switch (f.state) {
    case "walk": {
      const s = Math.sin(at * 0.25);
      p.frontLeg = [0.12 + 0.5 * s, 0.12];
      p.backLeg = [-0.12 - 0.5 * s, 0.12];
      p.frontArm = [0.18 - 0.45 * s, 0.4];
      p.backArm = [-0.18 + 0.45 * s, 0.4];
      break;
    }
    case "jump": {
      p.frontLeg = [0.5, -1.0];
      p.backLeg = [0.3, -1.1];
      p.frontArm = [-0.6, -0.3];
      p.backArm = [-0.85, -0.3];
      break;
    }
    case "block": {
      p.bob = 6;
      p.frontLeg = [0.16, 0.28];
      p.backLeg = [-0.16, 0.28];
      p.frontArm = [0.95, -0.95];
      p.backArm = [0.75, -0.95];
      break;
    }
    case "hitstun": {
      p.lean = -0.28;
      p.frontArm = [-0.7, -0.2];
      p.backArm = [-0.95, -0.2];
      p.frontLeg = [0.32, 0.05];
      p.backLeg = [-0.22, 0.05];
      break;
    }
    case "attack": {
      const isKick = f.currentMoveName && f.currentMoveName.includes("kick");
      const isHeavy = f.currentMoveName && f.currentMoveName.includes("heavy");
      const ex = moveExt();
      const reach = isHeavy ? 1.35 : 1.1;
      if (isKick) {
        const pe = Math.max(0, ex);
        p.lean = -0.12 * pe;
        p.frontLeg = [0.12 + pe * reach, 0.1 - pe * 0.1];
        p.backLeg = [-0.12, 0.18];
        p.frontArm = [-0.25, 0.5];
        p.backArm = [-0.5, 0.4];
      } else {
        p.lean = Math.max(0, ex) * 0.12;
        p.frontArm = [0.2 + ex * reach, 0.4 - Math.max(0, ex) * 0.4];
        p.backArm = [-0.2 - Math.max(0, ex) * 0.25, 0.4];
        p.frontLeg = [0.18 + Math.max(0, ex) * 0.2, 0.1];
        p.backLeg = [-0.2, 0.12];
      }
      break;
    }
    case "special": {
      p.lean = 0.15;
      p.frontArm = [1.15, -0.15];
      p.backArm = [0.85, -0.1];
      p.frontLeg = [0.42, 0.1];
      p.backLeg = [-0.42, 0.12];
      p.glow = f.character.colors.accent;
      break;
    }
    default: {
      p.bob = Math.sin(at * 0.1) * 2;
    }
  }

  // buff aura (shield/heal/inspire/aura)
  if (!p.glow && (f.buffs.timer > 0 || f.heal.remaining > 0)) {
    p.glow = f.character.colors.light;
  }
  return p;
}

// ---------- fighter ----------
export function drawFighter(ctx, f) {
  const c = f.character.colors;
  const female = f.character.gender === "F";

  // shadow
  ctx.save();
  ctx.globalAlpha = 0.28;
  ctx.beginPath();
  ctx.ellipse(f.x, ARENA.floorY + 4, 34, 9, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#000";
  ctx.fill();
  ctx.restore();

  const pose = poseFor(f);

  ctx.save();
  ctx.translate(f.x, f.y + pose.bob);
  ctx.scale(f.facing, 1); // forward = +x

  if (f.state === "ko") {
    ctx.rotate(-1.25);
    ctx.translate(-10, 18);
  }

  // glow aura
  if (pose.glow) {
    const g = ctx.createRadialGradient(0, -70, 6, 0, -70, 78);
    g.addColorStop(0, pose.glow + "cc");
    g.addColorStop(1, pose.glow + "00");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, -70, 78, 0, Math.PI * 2);
    ctx.fill();
  }

  // proportions
  const hipY = -60, shoulderY = -112, headY = -134, headR = 14;
  const shoulderX = female ? 13 : 18;
  const legW = 8, armW = 6;
  const thigh = 30, shin = 30, upper = 25, fore = 23;

  const lean = pose.lean;
  const sx = Math.sin(lean) * 40; // shoulder x shift from lean
  const sShoulderY = shoulderY;

  // ---- back limbs (darker, drawn first) ----
  limb(ctx, -4, hipY, pose.backLeg[0], thigh, pose.backLeg[1], shin, legW, c.dark);
  limb(ctx, -shoulderX * 0.3 + sx, sShoulderY, pose.backArm[0], upper, pose.backArm[1], fore, armW, c.dark);

  // ---- torso ----
  const hipHalf = 12;
  poly(ctx, [
    [-hipHalf, hipY],
    [hipHalf, hipY],
    [shoulderX + sx, sShoulderY],
    [-shoulderX + sx, sShoulderY],
  ], c.main);
  // chest facet (lighter front)
  poly(ctx, [
    [0, hipY],
    [hipHalf, hipY],
    [shoulderX + sx, sShoulderY],
    [sx, sShoulderY],
  ], c.light);
  // female skirt
  if (female) {
    poly(ctx, [
      [-hipHalf - 5, hipY + 14],
      [hipHalf + 5, hipY + 14],
      [hipHalf, hipY - 6],
      [-hipHalf, hipY - 6],
    ], c.dark);
  }
  // belt accent
  seg(ctx, -hipHalf, hipY, hipHalf, hipY, 3, 3, c.accent);

  // ---- head ----
  const hx = sx * 1.1;
  poly(ctx, [
    [hx - headR, headY + headR],
    [hx - headR + 3, headY - headR],
    [hx + headR - 3, headY - headR],
    [hx + headR, headY + headR],
    [hx + 4, headY + headR + 6],
    [hx - 4, headY + headR + 6],
  ], c.skin);
  // hair
  if (female) {
    poly(ctx, [
      [hx - headR - 2, headY - headR + 2],
      [hx + headR, headY - headR - 3],
      [hx + headR, headY - 2],
      [hx - headR - 4, headY + 18],
      [hx - headR - 2, headY + 2],
    ], c.dark);
  }
  poly(ctx, [
    [hx - headR, headY - headR + 4],
    [hx - headR + 2, headY - headR - 2],
    [hx + headR - 2, headY - headR - 2],
    [hx + headR, headY - headR + 5],
  ], c.dark);
  // visor / eye accent on the forward face
  seg(ctx, hx + 2, headY, hx + headR, headY, 2.5, 2.5, c.accent);
  dot(ctx, hx + headR - 4, headY, 1.8, "#1a1a1a");

  // ---- front limbs (main color, drawn last) ----
  limb(ctx, 4, hipY, pose.frontLeg[0], thigh, pose.frontLeg[1], shin, legW, c.main);
  const hand = limb(ctx, shoulderX * 0.3 + sx, sShoulderY, pose.frontArm[0], upper, pose.frontArm[1], fore, armW, c.main);
  dot(ctx, hand.x, hand.y, armW * 0.8, c.light);

  ctx.restore();
}

// Small floating marker above a fighter so players are distinguishable even in
// mirror matches.
export function drawPlayerMarker(ctx, f, color, tag) {
  const bob = Math.sin(f.animTime * 0.12) * 2;
  const x = f.x;
  const y = f.y - FIGHTER.bodyH - 18 + bob;
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y + 10);
  ctx.lineTo(x - 8, y);
  ctx.lineTo(x + 8, y);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#10131a";
  ctx.font = "bold 10px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(tag, x, y - 2);
  ctx.textAlign = "left";
  ctx.restore();
}

// ---------- projectiles ----------
export function drawProjectiles(ctx, match) {
  for (const p of match.projectiles) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.scale(p.facing, 1);
    const glow = ctx.createRadialGradient(0, 0, 1, 0, 0, Math.max(p.w, p.h));
    glow.addColorStop(0, p.color);
    glow.addColorStop(1, p.color + "00");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(p.w, p.h) * 0.8, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = p.accent;
    if (p.kind === "beam") {
      roundRect(ctx, -p.w / 2, -p.h / 2, p.w, p.h, p.h / 2, p.color);
      roundRect(ctx, -p.w / 2 + 4, -p.h / 4, p.w - 12, p.h / 2, p.h / 4, p.accent);
    } else if (p.kind === "bomb") {
      dot(ctx, 0, 0, p.w / 2, p.color);
      seg(ctx, 0, -p.h / 2, 4, -p.h / 2 - 8, 1.5, 1.5, "#ffcc55");
    } else if (p.kind === "word") {
      poly(ctx, [[0, -p.h / 2], [p.w / 2, 0], [0, p.h / 2], [-p.w / 2, 0]], p.color);
    } else if (p.kind === "shock") {
      poly(ctx, [
        [-p.w / 2, p.h / 2], [-p.w / 4, -p.h / 2], [0, p.h / 4],
        [p.w / 4, -p.h / 2], [p.w / 2, p.h / 2],
      ], p.color);
    } else if (p.kind === "burst") {
      const r = Math.max(p.w, p.h) / 2;
      ctx.beginPath();
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const rr = i % 2 === 0 ? r : r * 0.5;
        const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fillStyle = p.color;
      ctx.fill();
    }
    ctx.restore();
  }
}

function roundRect(ctx, x, y, w, h, r, color) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

// ---------- particles ----------
export function drawParticles(ctx, match) {
  for (const pt of match.particles) {
    ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
    dot(ctx, pt.x, pt.y, pt.size, pt.color);
  }
  ctx.globalAlpha = 1;
}

// ---------- arena ----------
export function drawArena(ctx, p1, p2) {
  const W = GAME.width, H = GAME.height;
  // sky
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, "#2b2440");
  sky.addColorStop(0.6, "#3a3358");
  sky.addColorStop(1, "#1c1830");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // distant geometric ridges tinted by the two fighters' families
  ridge(ctx, H, "#000000", 0.18, 250, 1);
  ridge(ctx, H, p1.character.colors.dark, 0.22, 200, 0);
  ridge(ctx, H, p2.character.colors.dark, 0.22, 160, 1);

  // floor
  ctx.fillStyle = "#23202f";
  ctx.fillRect(0, ARENA.floorY, W, H - ARENA.floorY);
  ctx.fillStyle = "#2e2a3d";
  ctx.fillRect(0, ARENA.floorY, W, 6);
  // floor stripes
  ctx.strokeStyle = "rgba(255,255,255,0.05)";
  for (let x = 0; x < W; x += 60) {
    ctx.beginPath();
    ctx.moveTo(x, ARENA.floorY + 10);
    ctx.lineTo(x - 40, H);
    ctx.stroke();
  }
}

function ridge(ctx, H, color, alpha, baseY, seed) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, H);
  let x = 0;
  let up = true;
  let r = seed;
  while (x <= GAME.width) {
    r = (r * 9301 + 49297) % 233280;
    const peak = baseY + ((r / 233280) * 120 - 60);
    ctx.lineTo(x, peak);
    x += 70 + (up ? 30 : 0);
    up = !up;
  }
  ctx.lineTo(GAME.width, H);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// ---------- HUD ----------
export function drawHUD(ctx, match) {
  const W = GAME.width;
  const f1 = match.fighters[0], f2 = match.fighters[1];

  healthBar(ctx, 28, 28, 380, f1, false);
  healthBar(ctx, W - 28 - 380, 28, 380, f2, true);

  // names
  ctx.font = "bold 18px system-ui, sans-serif";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#fff";
  ctx.textAlign = "left";
  ctx.fillText(label(f1), 30, 86);
  ctx.textAlign = "right";
  ctx.fillText(label(f2), W - 30, 86);

  // timer
  ctx.textAlign = "center";
  ctx.font = "bold 40px system-ui, sans-serif";
  ctx.fillStyle = "#fff";
  ctx.fillText(Math.ceil(match.timeLeft).toString(), W / 2, 60);
  ctx.textAlign = "left";
}

function label(f) {
  return `${f.character.type} ${f.character.roleCN}${f.character.gender === "F" ? "♀" : "♂"}`;
}

function healthBar(ctx, x, y, w, f, mirror) {
  const h = 22;
  // frame
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.fillRect(x - 3, y - 3, w + 6, h + 6);
  ctx.fillStyle = "#3a3a44";
  ctx.fillRect(x, y, w, h);
  const frac = Math.max(0, f.health / f.maxHealth);
  const fw = w * frac;
  const hp = ctx.createLinearGradient(x, 0, x + w, 0);
  hp.addColorStop(0, "#ffd24a");
  hp.addColorStop(1, "#ff5a3c");
  ctx.fillStyle = hp;
  if (mirror) ctx.fillRect(x + w - fw, y, fw, h);
  else ctx.fillRect(x, y, fw, h);

  // super meter
  const my = y + h + 5, mh = 8;
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.fillRect(x - 2, my - 2, w + 4, mh + 4);
  ctx.fillStyle = "#222230";
  ctx.fillRect(x, my, w, mh);
  const mfrac = Math.min(1, f.meter / SPECIAL_METER_COST);
  const ready = f.meter >= SPECIAL_METER_COST;
  ctx.fillStyle = ready ? "#7df9ff" : "#3aa0c8";
  const mw = w * mfrac;
  if (mirror) ctx.fillRect(x + w - mw, my, mw, mh);
  else ctx.fillRect(x, my, mw, mh);
  if (ready) {
    ctx.fillStyle = "#fff";
    ctx.font = "bold 10px system-ui";
    ctx.textAlign = mirror ? "right" : "left";
    ctx.fillText("大招 READY", mirror ? x + w : x, my + 7);
    ctx.textAlign = "left";
  }
}

export { ROUND };
