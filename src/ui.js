// Canvas-drawn menus: title, the 32-fighter select grid, and the result screen.
// Layout uses fixed internal coordinates (960x540); main.js maps the pointer in.

import { GAME } from "./config.js";
import { CHARACTERS, TYPES, CATEGORIES, FAMILY_ORDER } from "./characters.js";

const W = GAME.width, H = GAME.height;
export const PICK_COLORS = { p1: "#ffd24a", p2: "#7df9ff" };

// ---------- layout ----------
// 8 logical columns (4 families x 2 genders) and 4 rows (types per family).
let layoutCache = null;
export function buildSelectLayout() {
  if (layoutCache) return layoutCache;
  const cells = [];
  const grid = []; // grid[row][col]
  for (let r = 0; r < 4; r++) grid.push([]);

  const gridTop = 96, tileH = 80;
  const colStep = (W - 40) / 4; // family column width
  for (let fam = 0; fam < 4; fam++) {
    const famX = 20 + fam * colStep;
    const half = (colStep - 12) / 2;
    for (let r = 0; r < 4; r++) {
      const typeIndex = fam * 4 + r;
      const y = gridTop + r * tileH;
      for (let g = 0; g < 2; g++) {
        const charIndex = typeIndex * 2 + g;
        const x = famX + 6 + g * half;
        const cell = {
          charIndex, row: r, col: fam * 2 + g,
          x, y, w: half - 4, h: tileH - 8,
          family: FAMILY_ORDER[fam],
        };
        cells.push(cell);
        grid[r][fam * 2 + g] = cell;
      }
    }
  }

  const modeBtn = { x: W - 200, y: 18, w: 180, h: 40 };
  const startBtn = { x: W / 2 - 110, y: H - 44, w: 220, h: 36 };
  const randomBtn = { x: 20, y: H - 44, w: 150, h: 36 };
  const backBtn = { x: W - 170, y: H - 44, w: 150, h: 36 };

  layoutCache = { cells, grid, modeBtn, startBtn, randomBtn, backBtn };
  return layoutCache;
}

export function hitSelect(layout, x, y) {
  if (inside(layout.modeBtn, x, y)) return { kind: "mode" };
  if (inside(layout.startBtn, x, y)) return { kind: "start" };
  if (inside(layout.randomBtn, x, y)) return { kind: "random" };
  if (inside(layout.backBtn, x, y)) return { kind: "back" };
  for (const c of layout.cells) if (inside(c, x, y)) return { kind: "cell", charIndex: c.charIndex };
  return null;
}

function inside(b, x, y) {
  return x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
}

// ---------- mini fighter ----------
export function drawMiniFighter(ctx, ch, cx, baseY, scale) {
  const c = ch.colors;
  const female = ch.gender === "F";
  ctx.save();
  ctx.translate(cx, baseY);
  ctx.scale(scale, scale);
  // legs
  seg(ctx, -7, -34, -9, 0, 5, 4, c.dark);
  seg(ctx, 7, -34, 9, 0, 5, 4, c.dark);
  // torso
  const sh = female ? 11 : 15;
  poly(ctx, [[-9, -34], [9, -34], [sh, -64], [-sh, -64]], c.main);
  poly(ctx, [[0, -34], [9, -34], [sh, -64], [0, -64]], c.light);
  if (female) poly(ctx, [[-13, -30], [13, -30], [9, -40], [-9, -40]], c.dark);
  // arms
  seg(ctx, -sh + 2, -62, -sh - 3, -38, 4, 3, c.dark);
  seg(ctx, sh - 2, -62, sh + 3, -38, 4, 3, c.main);
  // head
  dot(ctx, 0, -76, 11, c.skin);
  // hair
  if (female) poly(ctx, [[-12, -80], [12, -84], [11, -68], [-13, -64]], c.dark);
  poly(ctx, [[-11, -80], [11, -82], [10, -88], [-10, -88]], c.dark);
  ctx.restore();
}

function seg(ctx, x1, y1, x2, y2, w1, w2, color) {
  const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  ctx.beginPath();
  ctx.moveTo(x1 + nx * w1, y1 + ny * w1);
  ctx.lineTo(x2 + nx * w2, y2 + ny * w2);
  ctx.lineTo(x2 - nx * w2, y2 - ny * w2);
  ctx.lineTo(x1 - nx * w1, y1 - ny * w1);
  ctx.closePath();
  ctx.fillStyle = color; ctx.fill();
}
function dot(ctx, x, y, r, color) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
}
function poly(ctx, pts, color) {
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath(); ctx.fillStyle = color; ctx.fill();
}
function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function button(ctx, b, text, active) {
  rrect(ctx, b.x, b.y, b.w, b.h, 8);
  ctx.fillStyle = active ? "#4a5cff" : "rgba(255,255,255,0.12)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.3)";
  ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = "#fff";
  ctx.font = "bold 16px system-ui, sans-serif";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(text, b.x + b.w / 2, b.y + b.h / 2);
  ctx.textBaseline = "alphabetic";
}

// ---------- title ----------
export function drawTitle(ctx, t) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#241d3a"); g.addColorStop(1, "#0e0b18");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  // decorative fighters
  drawMiniFighter(ctx, CHARACTERS[4], W / 2 - 150, 380, 2.2);  // ENTJ M (purple)
  drawMiniFighter(ctx, CHARACTERS[29], W / 2 + 150, 380, 2.2); // ESTP F (yellow)

  ctx.textAlign = "center";
  ctx.fillStyle = "#fff";
  ctx.font = "bold 72px system-ui, sans-serif";
  ctx.fillText("MBTI FIGHTS", W / 2, 150);
  ctx.font = "bold 26px system-ui, sans-serif";
  ctx.fillStyle = "#c9b6ff";
  ctx.fillText("16型人格 2D 格斗", W / 2, 195);

  if (Math.floor(t / 30) % 2 === 0) {
    ctx.fillStyle = "#fff";
    ctx.font = "20px system-ui, sans-serif";
    ctx.fillText("点击 / 按 Enter 开始", W / 2, 470);
  }
  ctx.font = "13px system-ui, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.fillText("原创低多边形美术 · 角色灵感来自16型人格", W / 2, 510);
  ctx.textAlign = "left";
}

// ---------- select ----------
export function drawSelect(ctx, state, layout, pointer) {
  ctx.fillStyle = "#16121f"; ctx.fillRect(0, 0, W, H);

  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#fff";
  ctx.font = "bold 24px system-ui, sans-serif";
  ctx.fillText("选择角色 SELECT", 20, 44);

  // chosen previews
  drawChosen(ctx, state, 0, 70);
  drawChosen(ctx, state, 1, 70);

  // family headers
  const colStep = (W - 40) / 4;
  ctx.font = "bold 15px system-ui, sans-serif";
  ctx.textAlign = "center";
  for (let fam = 0; fam < 4; fam++) {
    const cat = CATEGORIES[FAMILY_ORDER[fam]];
    ctx.fillStyle = cat.colors.light;
    ctx.fillText(`${cat.name} · ${cat.cn}`, 20 + fam * colStep + colStep / 2, 88);
  }

  const hovered = pointer ? hitSelect(layout, pointer.x, pointer.y) : null;
  const hoverIdx = hovered && hovered.kind === "cell" ? hovered.charIndex : -1;

  for (const cell of layout.cells) {
    const ch = CHARACTERS[cell.charIndex];
    const cat = CATEGORIES[ch.category];
    // base tile
    rrect(ctx, cell.x, cell.y, cell.w, cell.h, 6);
    ctx.fillStyle = cell.charIndex === hoverIdx ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.28)";
    ctx.fill();
    ctx.strokeStyle = cat.colors.dark; ctx.lineWidth = 1; ctx.stroke();

    drawMiniFighter(ctx, ch, cell.x + cell.w / 2, cell.y + cell.h - 16, 0.46);

    ctx.fillStyle = "#eee";
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(ch.type + (ch.gender === "F" ? "♀" : "♂"), cell.x + cell.w / 2, cell.y + 13);

    // selection borders
    if (state.p1 === cell.charIndex) selBorder(ctx, cell, PICK_COLORS.p1, "P1");
    if (state.p2 === cell.charIndex) selBorder(ctx, cell, PICK_COLORS.p2, "P2");
  }

  // keyboard cursor
  if (state.cursor) {
    const cur = layout.grid[state.cursor.row][state.cursor.col];
    if (cur) {
      ctx.strokeStyle = state.active === "p1" ? PICK_COLORS.p1 : PICK_COLORS.p2;
      ctx.lineWidth = 3;
      rrect(ctx, cur.x - 1, cur.y - 1, cur.w + 2, cur.h + 2, 7);
      ctx.stroke();
    }
  }

  // buttons
  button(ctx, layout.modeBtn, state.mode === "cpu" ? "模式: 单人 VS CPU" : "模式: 双人对战", false);
  button(ctx, layout.randomBtn, "随机 Random", false);
  button(ctx, layout.backBtn, "返回 Back", false);
  const ready = state.p1 != null && state.p2 != null;
  button(ctx, layout.startBtn, ready ? "开始 START ▶" : "请选择两名角色", ready);

  ctx.textAlign = "left";
}

function selBorder(ctx, cell, color, tag) {
  ctx.strokeStyle = color; ctx.lineWidth = 3;
  rrect(ctx, cell.x + 1, cell.y + 1, cell.w - 2, cell.h - 2, 6);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.font = "bold 11px system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(tag, cell.x + 4, cell.y + cell.h - 4);
}

function drawChosen(ctx, state, who, y) {
  const idx = who === 0 ? state.p1 : state.p2;
  const color = who === 0 ? PICK_COLORS.p1 : PICK_COLORS.p2;
  const label = who === 0 ? "P1" : (state.mode === "cpu" ? "CPU" : "P2");
  ctx.textAlign = who === 0 ? "left" : "right";
  const x = who === 0 ? 220 : W - 220;
  ctx.fillStyle = color;
  ctx.font = "bold 16px system-ui, sans-serif";
  if (idx == null) {
    ctx.fillText(`${label}: —`, x, y);
  } else {
    const ch = CHARACTERS[idx];
    ctx.fillText(`${label}: ${ch.type} ${ch.roleCN}${ch.gender === "F" ? "♀" : "♂"}`, x, y);
  }
  ctx.textAlign = "left";
}

// ---------- result ----------
export function drawResult(ctx, match, t) {
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = "center";
  ctx.fillStyle = "#fff";
  ctx.font = "bold 56px system-ui, sans-serif";

  let text;
  if (match.winner === "draw") text = "平局 DRAW";
  else {
    const ch = match.fighters[match.winner].character;
    const who = match.winner === 0 ? "P1" : (match.mode === "cpu" ? "CPU" : "P2");
    text = `${who} 获胜!`;
    ctx.fillText(text, W / 2, H / 2 - 30);
    ctx.font = "bold 26px system-ui, sans-serif";
    ctx.fillStyle = ch.colors.light;
    ctx.fillText(`${ch.type} ${ch.roleCN}${ch.gender === "F" ? "♀" : "♂"} — ${ch.specialName}`, W / 2, H / 2 + 14);
    text = null;
  }
  if (text) ctx.fillText(text, W / 2, H / 2);

  if (Math.floor(t / 30) % 2 === 0) {
    ctx.fillStyle = "#fff";
    ctx.font = "20px system-ui, sans-serif";
    ctx.fillText("Enter 再战  ·  Backspace 重新选择", W / 2, H / 2 + 80);
  }
  ctx.textAlign = "left";
}
