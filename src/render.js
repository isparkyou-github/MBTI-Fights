// All in-fight drawing: arena, procedural low-poly fighters, projectiles,
// particles and the HUD. Pure canvas, no images.

import { GAME, ARENA, FIGHTER, ROUND } from "./config.js";
import { SPECIAL_METER_COST } from "./specials.js";
import { getPalette } from "./palettes.js";

// darken/lighten a #rrggbb hex by factor f (>1 lightens)
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.round(((n >> 16) & 255) * f));
  const g = Math.min(255, Math.round(((n >> 8) & 255) * f));
  const b = Math.min(255, Math.round((n & 255) * f));
  return `rgb(${r},${g},${b})`;
}

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

// ---------- fighter (articulated anime figure) ----------
export function drawFighter(ctx, f) {
  const fam = f.character.colors;
  const female = f.character.gender === "F";
  const pal = getPalette(f.character.id) || {
    hair: fam.dark, skin: fam.skin, top: fam.main, bottom: fam.dark, accent: fam.accent,
  };

  // shadow
  ctx.save();
  ctx.globalAlpha = 0.26;
  ctx.beginPath();
  ctx.ellipse(f.x, ARENA.floorY + 4, 32, 8, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#000";
  ctx.fill();
  ctx.restore();

  // glow aura (special cast, or active buff / heal)
  const glow = f.state === "special" ? fam.accent
    : (f.buffs.timer > 0 || f.heal.remaining > 0) ? fam.light : null;
  if (glow) {
    const pulse = 74 + Math.sin(f.animTime * 0.3) * 8;
    const g = ctx.createRadialGradient(f.x, f.y - 80, 6, f.x, f.y - 80, pulse);
    g.addColorStop(0, glow + "bb");
    g.addColorStop(1, glow + "00");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(f.x, f.y - 80, pulse, 0, Math.PI * 2);
    ctx.fill();
  }

  const pose = poseFor(f);
  const flashing = (f.hitFlash > 0 || f.armorFlash > 0) && Math.floor(f.animTime) % 2 === 0;

  ctx.save();
  ctx.translate(f.x, f.y + (pose.bob || 0));
  ctx.scale(f.facing, 1); // forward = +x
  if (f.state === "ko") { ctx.rotate(-1.3); ctx.translate(-4, 4); }
  if (flashing) ctx.globalAlpha = 0.6;
  drawBody(ctx, pal, female, pose);
  ctx.restore();
}

// A chibi/anime figure drawn from a pose (limb angles) + a per-character palette.
// Limbs are jointed and posed by poseFor, so hands/feet move with each action.
function drawBody(ctx, p, female, pose) {
  const hipY = -54, shY = -92, neckY = -95, headCy = -120, headR = 22;
  const shoulderX = female ? 20 : 24, hipX = 16;
  const legW = 10, armW = 8, thigh = 24, shin = 22, upper = 19, fore = 17;
  const topC = p.top, topD = shade(p.top, 0.78), topL = shade(p.top, 1.12);
  const botC = p.bottom, botD = shade(p.bottom, 0.78);
  const skin = p.skin, skinD = shade(p.skin, 0.85);
  const hair = p.hair, hairD = shade(p.hair, 0.78);
  const lean = pose.lean || 0, sx = Math.sin(lean) * 30;
  let e;

  // back limbs (shaded darker, drawn first)
  e = limb(ctx, -hipX * 0.4, hipY, pose.backLeg[0], thigh, pose.backLeg[1], shin, legW, botD);
  dot(ctx, e.x, e.y, legW * 0.72, "#33333a");
  e = limb(ctx, -shoulderX * 0.3 + sx, shY, pose.backArm[0], upper, pose.backArm[1], fore, armW, topD);
  dot(ctx, e.x, e.y, armW * 0.78, skinD);

  // lower body: skirt (F) or shorts/hips (M)
  if (female) {
    poly(ctx, [[-hipX - 7, hipY + 20], [hipX + 7, hipY + 20], [hipX, hipY - 4], [-hipX, hipY - 4]], botC);
    poly(ctx, [[0, hipY - 4], [hipX + 7, hipY + 20], [0, hipY + 20]], botD);
  } else {
    poly(ctx, [[-hipX, hipY + 6], [hipX, hipY + 6], [hipX - 2, hipY - 10], [-hipX + 2, hipY - 10]], botC);
  }

  // torso (outfit) + collar accent + neck
  poly(ctx, [[-hipX, hipY], [hipX, hipY], [shoulderX + sx, shY], [-shoulderX + sx, shY]], topC);
  poly(ctx, [[0, hipY], [hipX, hipY], [shoulderX + sx, shY], [sx, shY]], topL);
  seg(ctx, -9 + sx, shY + 3, 9 + sx, shY + 3, 4, 4, p.accent);
  seg(ctx, sx, neckY + 5, sx, neckY - 3, 5, 5, skin);

  // head + hair + face
  const hx = sx * 1.1;
  if (female) {
    poly(ctx, [[hx - headR - 4, headCy - 6], [hx - headR + 2, headCy + headR + 22], [hx - headR + 12, headCy + headR + 22], [hx - headR + 6, headCy - 8]], hairD);
    poly(ctx, [[hx + headR + 4, headCy - 6], [hx + headR - 2, headCy + headR + 22], [hx + headR - 12, headCy + headR + 22], [hx + headR - 6, headCy - 8]], hairD);
  }
  dot(ctx, hx, headCy - 3, headR + 3, hair);
  dot(ctx, hx, headCy + 2, headR, skin);
  poly(ctx, [[hx - headR, headCy - 2], [hx - 3, headCy - 1], [hx - headR * 0.55, headCy + 9]], hair);
  poly(ctx, [[hx + headR, headCy - 2], [hx + 3, headCy - 1], [hx + headR * 0.55, headCy + 9]], hair);
  poly(ctx, [[hx - 7, headCy - 8], [hx + 7, headCy - 8], [hx, headCy + 2]], hair);
  const ey = headCy + 5;
  dot(ctx, hx - 7, ey, 3.4, "#2b2b34");
  dot(ctx, hx + 7, ey, 3.4, "#2b2b34");
  dot(ctx, hx - 6, ey - 1.2, 1.1, "#fff");
  dot(ctx, hx + 8, ey - 1.2, 1.1, "#fff");

  // front limbs (base colour, on top) with hands/feet
  e = limb(ctx, hipX * 0.4, hipY, pose.frontLeg[0], thigh, pose.frontLeg[1], shin, legW, botC);
  dot(ctx, e.x, e.y, legW * 0.8, "#26262b");
  e = limb(ctx, shoulderX * 0.3 + sx, shY, pose.frontArm[0], upper, pose.frontArm[1], fore, armW, topC);
  dot(ctx, e.x, e.y, armW * 0.9, skin);
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
