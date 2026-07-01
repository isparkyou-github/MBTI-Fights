// Canvas-drawn menus: title, the 32-fighter select grid, and the result screen.
// Layout uses fixed internal coordinates (960x540); main.js maps the pointer in.

import { GAME } from "./config.js";
import { CHARACTERS, TYPES, CATEGORIES, FAMILY_ORDER } from "./characters.js";
import { getSprite } from "./sprites.js";

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

// Draw a character's sprite fitted into a box, anchored bottom-centre.
// Falls back to the procedural mini fighter if the sprite isn't loaded yet.
export function drawCharSprite(ctx, ch, cx, baseY, maxW, maxH) {
  const img = getSprite(ch.id);
  if (!img || !img.width) { drawMiniFighter(ctx, ch, cx, baseY, maxH / 150); return; }
  const scale = Math.min(maxH / img.height, maxW / img.width);
  const dw = img.width * scale, dh = img.height * scale;
  ctx.drawImage(img, cx - dw / 2, baseY - dh, dw, dh);
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

  // decorative fighters (sprite art)
  drawCharSprite(ctx, CHARACTERS[4], W / 2 - 255, 508, 180, 300);  // ENTJ male
  drawCharSprite(ctx, CHARACTERS[29], W / 2 + 255, 508, 180, 300); // ESTP female

  ctx.textAlign = "center";
  ctx.fillStyle = "#fff";
  ctx.font = "bold 72px system-ui, sans-serif";
  ctx.fillText("MBTI FIGHTS", W / 2, 150);
  ctx.font = "bold 26px system-ui, sans-serif";
  ctx.fillStyle = "#c9b6ff";
  ctx.fillText("16型人格 2D 格斗", W / 2, 195);

  // buttons
  button(ctx, TITLE_START, "开始 START ▶", true);
  button(ctx, TITLE_HOWTO, "操作教程 HOW TO", false);
  if (Math.floor(t / 30) % 2 === 0) {
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = "15px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Enter 开始  ·  H 教程", W / 2, 496);
  }
  ctx.font = "13px system-ui, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.textAlign = "center";
  ctx.fillText("原创动漫风格美术 · 角色灵感来自16型人格", W / 2, 524);
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

    drawCharSprite(ctx, ch, cell.x + cell.w / 2, cell.y + cell.h - 6, cell.w - 8, cell.h - 24);

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

// ---------- title buttons ----------
const TITLE_START = { x: W / 2 - 210, y: 246, w: 200, h: 54 };
const TITLE_HOWTO = { x: W / 2 + 10, y: 246, w: 200, h: 54 };
export function titleHit(x, y) {
  if (inside(TITLE_START, x, y)) return "start";
  if (inside(TITLE_HOWTO, x, y)) return "howto";
  return null;
}

// ---------- how to play ----------
const HOWTO_BACK = { x: W / 2 - 90, y: H - 50, w: 180, h: 38 };
export function howtoHit(x, y) { return inside(HOWTO_BACK, x, y) ? "back" : null; }

export function drawHowto(ctx) {
  ctx.fillStyle = "#16121f"; ctx.fillRect(0, 0, W, H);
  ctx.textAlign = "center"; ctx.textBaseline = "alphabetic"; ctx.fillStyle = "#fff";
  ctx.font = "bold 30px system-ui, sans-serif";
  ctx.fillText("操作教程 HOW TO PLAY", W / 2, 48);

  const rows = [
    ["动作 Action", "玩家1 P1", "玩家2 P2"],
    ["移动 Move", "A / D", "← / →"],
    ["跳 Jump", "W", "↑"],
    ["防御 Block (按住)", "S", "↓"],
    ["小拳 Light punch", "F", "J"],
    ["大拳 Heavy punch", "G", "K"],
    ["小脚 Light kick", "C", "N"],
    ["大脚 Heavy kick", "V", "M"],
    ["大招 Special", "R", "U"],
    ["暂停 Pause", "Esc / P", "Esc / P"],
  ];
  const actionX = 210, p1X = 560, p2X = 730, y0 = 82, rh = 27;
  for (let i = 0; i < rows.length; i++) {
    const y = y0 + i * rh;
    if (i === 0) { ctx.fillStyle = "rgba(255,255,255,0.12)"; ctx.fillRect(190, y - 20, 600, 26); }
    ctx.fillStyle = i === 0 ? "#c9b6ff" : "#eee";
    ctx.font = (i === 0 ? "bold " : "") + "16px system-ui, sans-serif";
    ctx.textAlign = "left"; ctx.fillText(rows[i][0], actionX, y);
    ctx.textAlign = "center"; ctx.fillText(rows[i][1], p1X, y);
    ctx.fillText(rows[i][2], p2X, y);
  }

  const ty = y0 + rows.length * rh + 16;
  ctx.textAlign = "center"; ctx.fillStyle = "#c9b6ff";
  ctx.font = "bold 16px system-ui, sans-serif";
  ctx.fillText("玩法提示 Tips", W / 2, ty);
  const tips = [
    "· 攻击或受击都会积攒能量条(血条下方),满格即可释放「大招」。",
    "· 每种人格拥有独一无二的大招:远程光束 / 治疗 / 反击 / 冲锋 / 旋风…",
    "· 面向对手按住「防御」可大幅减免伤害。血量归零或时间到血多者胜。",
    "· 单人模式 P2 由电脑控制;双人模式同一键盘对战(选人界面可切换)。",
  ];
  ctx.font = "14px system-ui, sans-serif"; ctx.fillStyle = "#ddd";
  for (let i = 0; i < tips.length; i++) ctx.fillText(tips[i], W / 2, ty + 24 + i * 22);

  button(ctx, HOWTO_BACK, "返回 Back (Esc)", false);
  ctx.textAlign = "left";
}

// ---------- pause menu ----------
const PAUSE_RESUME = { x: W / 2 - 130, y: 244, w: 260, h: 48 };
const PAUSE_SETTINGS = { x: W / 2 - 130, y: 302, w: 260, h: 48 };
const PAUSE_QUIT = { x: W / 2 - 130, y: 360, w: 260, h: 48 };
export function pauseHit(x, y) {
  if (inside(PAUSE_RESUME, x, y)) return "resume";
  if (inside(PAUSE_SETTINGS, x, y)) return "settings";
  if (inside(PAUSE_QUIT, x, y)) return "quit";
  return null;
}
export function drawPauseMenu(ctx) {
  ctx.fillStyle = "rgba(0,0,0,0.66)"; ctx.fillRect(0, 0, W, H);
  ctx.textAlign = "center"; ctx.textBaseline = "alphabetic"; ctx.fillStyle = "#fff";
  ctx.font = "bold 46px system-ui, sans-serif";
  ctx.fillText("暂停 PAUSED", W / 2, 190);
  button(ctx, PAUSE_RESUME, "继续 Resume", true);
  button(ctx, PAUSE_SETTINGS, "设置 Settings", false);
  button(ctx, PAUSE_QUIT, "退出到主菜单 Quit", false);
  ctx.fillStyle = "rgba(255,255,255,0.6)"; ctx.font = "14px system-ui, sans-serif";
  ctx.fillText("Esc / P 继续游戏", W / 2, 438);
  ctx.textAlign = "left";
}

// ---------- settings ----------
const SET_SOUND = { x: W / 2 - 130, y: 250, w: 260, h: 50 };
const SET_BACK = { x: W / 2 - 130, y: 320, w: 260, h: 44 };
export function settingsHit(x, y) {
  if (inside(SET_SOUND, x, y)) return "sound";
  if (inside(SET_BACK, x, y)) return "back";
  return null;
}
export function drawSettings(ctx, soundOn) {
  ctx.fillStyle = "rgba(0,0,0,0.74)"; ctx.fillRect(0, 0, W, H);
  ctx.textAlign = "center"; ctx.textBaseline = "alphabetic"; ctx.fillStyle = "#fff";
  ctx.font = "bold 40px system-ui, sans-serif";
  ctx.fillText("设置 SETTINGS", W / 2, 190);
  button(ctx, SET_SOUND, "音效 Sound: " + (soundOn ? "开 ON" : "关 OFF"), soundOn);
  button(ctx, SET_BACK, "返回 Back", false);
  ctx.fillStyle = "rgba(255,255,255,0.6)"; ctx.font = "14px system-ui, sans-serif";
  ctx.fillText("Esc 返回", W / 2, 398);
  ctx.textAlign = "left";
}
