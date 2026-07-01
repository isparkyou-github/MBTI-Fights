// Entry point: canvas setup, the TITLE -> SELECT -> FIGHT -> RESULT state
// machine, the fixed-step loop, and input plumbing for both players.

import { GAME, CONTROLS } from "./config.js";
import { Input, Pointer } from "./input.js";
import { CHARACTERS } from "./characters.js";
import { Match } from "./match.js";
import { resumeAudio, Sfx, setMuted, isMuted } from "./audio.js";
import { drawArena, drawFighter, drawProjectiles, drawParticles, drawHUD, drawPlayerMarker } from "./render.js";
import {
  buildSelectLayout, hitSelect, drawTitle, drawSelect, drawResult, PICK_COLORS,
  titleHit, drawHowto, howtoHit, drawPauseMenu, pauseHit, drawSettings, settingsHit,
} from "./ui.js";
import { randInt } from "./utils.js";
import { preloadSprites, spritesReady, loadProgress, allSprites } from "./sprites.js";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const game = {
  state: "loading", // loading | title | howto | select | fight | result
  tick: 0,
  layout: buildSelectLayout(),
  sel: {
    p1: null, p2: null, active: "p1", mode: "cpu",
    cursor: { row: 0, col: 0 },
  },
  p1char: null, p2char: null,
  match: null,
  paused: false,
  pauseView: "menu", // menu | settings
};

// ---------- pointer ----------
function mapPointer(e) {
  const rect = canvas.getBoundingClientRect();
  Pointer.x = (e.clientX - rect.left) * (GAME.width / rect.width);
  Pointer.y = (e.clientY - rect.top) * (GAME.height / rect.height);
}
canvas.addEventListener("mousemove", mapPointer);
canvas.addEventListener("mousedown", (e) => {
  mapPointer(e);
  Pointer.clicked = true;
  resumeAudio();
});
window.addEventListener("keydown", resumeAudio, { once: true });

// ---------- logic ----------
function logicStep() {
  game.tick++;
  switch (game.state) {
    case "loading": stepLoading(); break;
    case "title": stepTitle(); break;
    case "howto": stepHowto(); break;
    case "select": stepSelect(); break;
    case "fight": stepFight(); break;
    case "result": stepResult(); break;
  }
  Input.endFrame();
  Pointer.clicked = false;
}

function stepLoading() {
  if (spritesReady()) game.state = "title";
}

function stepTitle() {
  if (Pointer.clicked) {
    const h = titleHit(Pointer.x, Pointer.y);
    if (h === "start") { Sfx.select(); game.state = "select"; return; }
    if (h === "howto") { Sfx.select(); game.state = "howto"; return; }
  }
  if (Input.wasPressed("KeyH")) { Sfx.select(); game.state = "howto"; return; }
  if (Input.wasPressed("Enter") || Input.wasPressed("Space")) {
    Sfx.select();
    game.state = "select";
  }
}

function stepHowto() {
  if (Input.wasPressed("Escape") || Input.wasPressed("Backspace") || Input.wasPressed("Enter") ||
      (Pointer.clicked && howtoHit(Pointer.x, Pointer.y))) {
    Sfx.select();
    game.state = "title";
  }
}

function stepSelect() {
  const s = game.sel;
  const L = game.layout;

  // mode / random / nav via keyboard
  if (Input.wasPressed("KeyM")) s.mode = s.mode === "cpu" ? "2p" : "cpu";
  if (Input.wasPressed("KeyR")) randomizePicks();
  if (Input.wasPressed("Backspace")) { game.state = "title"; return; }
  if (Input.wasPressed("Tab")) s.active = s.active === "p1" ? "p2" : "p1";

  if (Input.wasPressed("KeyW") || Input.wasPressed("ArrowUp")) s.cursor.row = Math.max(0, s.cursor.row - 1);
  if (Input.wasPressed("KeyS") || Input.wasPressed("ArrowDown")) s.cursor.row = Math.min(3, s.cursor.row + 1);
  if (Input.wasPressed("KeyA") || Input.wasPressed("ArrowLeft")) s.cursor.col = Math.max(0, s.cursor.col - 1);
  if (Input.wasPressed("KeyD") || Input.wasPressed("ArrowRight")) s.cursor.col = Math.min(7, s.cursor.col + 1);

  if (Input.wasPressed("Space")) {
    const cell = L.grid[s.cursor.row][s.cursor.col];
    if (cell) assignPick(cell.charIndex);
  }

  if (Input.wasPressed("Enter") && s.p1 != null && s.p2 != null) {
    startFight();
    return;
  }

  // pointer
  if (Pointer.clicked) {
    const hit = hitSelect(L, Pointer.x, Pointer.y);
    if (hit) {
      if (hit.kind === "cell") assignPick(hit.charIndex);
      else if (hit.kind === "mode") s.mode = s.mode === "cpu" ? "2p" : "cpu";
      else if (hit.kind === "random") randomizePicks();
      else if (hit.kind === "back") game.state = "title";
      else if (hit.kind === "start" && s.p1 != null && s.p2 != null) startFight();
    }
  }
}

function assignPick(charIndex) {
  const s = game.sel;
  if (s.active === "p1") { s.p1 = charIndex; s.active = "p2"; }
  else { s.p2 = charIndex; s.active = "p1"; }
  Sfx.select();
}

function randomizePicks() {
  const a = randInt(0, CHARACTERS.length - 1);
  let b = randInt(0, CHARACTERS.length - 1);
  if (b === a) b = (b + 1) % CHARACTERS.length;
  game.sel.p1 = a;
  game.sel.p2 = b;
  Sfx.select();
}

function startFight() {
  game.p1char = CHARACTERS[game.sel.p1];
  game.p2char = CHARACTERS[game.sel.p2];
  game.match = new Match(game.p1char, game.p2char, game.sel.mode);
  game.paused = false;
  game.pauseView = "menu";
  game.state = "fight";
  Sfx.select();
}

function humanIntent(map) {
  return {
    left: Input.isDown(map.left),
    right: Input.isDown(map.right),
    block: Input.isDown(map.block),
    jump: Input.wasPressed(map.jump),
    lp: Input.wasPressed(map.lp),
    hp: Input.wasPressed(map.hp),
    lk: Input.wasPressed(map.lk),
    hk: Input.wasPressed(map.hk),
    special: Input.wasPressed(map.special),
  };
}

function stepFight() {
  const m = game.match;
  if (game.paused) { stepPause(); return; }
  if (!m.over && (Input.wasPressed("Escape") || Input.wasPressed("KeyP"))) {
    game.paused = true;
    game.pauseView = "menu";
    Sfx.select();
    return;
  }
  const intents = {
    p1: humanIntent(CONTROLS.p1),
    p2: m.mode === "2p" ? humanIntent(CONTROLS.p2) : null,
  };
  m.step(intents);
  if (m.over && m.endTimer > 90) game.state = "result";
}

function stepPause() {
  if (game.pauseView === "settings") {
    if (Input.wasPressed("Escape") || Input.wasPressed("Backspace")) { game.pauseView = "menu"; return; }
    if (Pointer.clicked) {
      const h = settingsHit(Pointer.x, Pointer.y);
      if (h === "sound") { setMuted(!isMuted()); if (!isMuted()) Sfx.select(); }
      else if (h === "back") { Sfx.select(); game.pauseView = "menu"; }
    }
    return;
  }
  // pause menu
  if (Input.wasPressed("Escape") || Input.wasPressed("KeyP") || Input.wasPressed("Enter")) {
    game.paused = false;
    return;
  }
  if (Pointer.clicked) {
    const h = pauseHit(Pointer.x, Pointer.y);
    if (h === "resume") { Sfx.select(); game.paused = false; }
    else if (h === "settings") { Sfx.select(); game.pauseView = "settings"; }
    else if (h === "quit") { Sfx.select(); game.paused = false; game.state = "title"; }
  }
}

function stepResult() {
  // keep the scene settling
  game.match.step({ p1: null, p2: null });
  if (Input.wasPressed("Enter") || Pointer.clicked) {
    game.match = new Match(game.p1char, game.p2char, game.sel.mode);
    game.paused = false;
    game.pauseView = "menu";
    game.state = "fight";
    Sfx.select();
  } else if (Input.wasPressed("Backspace")) {
    game.state = "select";
  }
}

// ---------- render ----------
function render() {
  ctx.clearRect(0, 0, GAME.width, GAME.height);
  switch (game.state) {
    case "loading": drawLoading(); break;
    case "title": drawTitle(ctx, game.tick); break;
    case "howto": drawHowto(ctx); break;
    case "select": drawSelect(ctx, game.sel, game.layout, Pointer); break;
    case "fight":
      renderFight();
      if (game.paused) {
        if (game.pauseView === "settings") drawSettings(ctx, !isMuted());
        else drawPauseMenu(ctx);
      }
      break;
    case "result": renderFight(); drawResult(ctx, game.match, game.tick); break;
  }
}

function drawLoading() {
  const g = ctx.createLinearGradient(0, 0, 0, GAME.height);
  g.addColorStop(0, "#241d3a"); g.addColorStop(1, "#0e0b18");
  ctx.fillStyle = g; ctx.fillRect(0, 0, GAME.width, GAME.height);
  ctx.textAlign = "center"; ctx.fillStyle = "#fff";
  ctx.font = "bold 40px system-ui, sans-serif";
  ctx.fillText("MBTI FIGHTS", GAME.width / 2, GAME.height / 2 - 40);
  ctx.font = "18px system-ui, sans-serif";
  ctx.fillStyle = "#c9b6ff";
  ctx.fillText("加载角色中… Loading fighters", GAME.width / 2, GAME.height / 2);
  const bw = 360, bx = (GAME.width - bw) / 2, by = GAME.height / 2 + 24;
  ctx.fillStyle = "#222230"; ctx.fillRect(bx, by, bw, 12);
  ctx.fillStyle = "#7df9ff"; ctx.fillRect(bx, by, bw * loadProgress(), 12);
  ctx.textAlign = "left";
}

function renderFight() {
  const m = game.match;
  const [f1, f2] = m.fighters;
  drawArena(ctx, f1, f2);
  drawFighter(ctx, f1);
  drawFighter(ctx, f2);
  drawPlayerMarker(ctx, f1, PICK_COLORS.p1, "P1");
  drawPlayerMarker(ctx, f2, PICK_COLORS.p2, m.mode === "cpu" ? "CPU" : "P2");
  drawProjectiles(ctx, m);
  drawParticles(ctx, m);
  drawHUD(ctx, m);
  if (!m.over) {
    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Esc / P 暂停", GAME.width / 2, GAME.height - 10);
    ctx.restore();
  }
}

// ---------- loop ----------
let last = performance.now();
let acc = 0;
function frame(now) {
  acc += now - last;
  last = now;
  // catch up, but never spiral
  let steps = 0;
  while (acc >= GAME.step && steps < 5) {
    logicStep();
    acc -= GAME.step;
    steps++;
  }
  if (steps === 0 && acc > GAME.step) acc = 0;
  render();
  requestAnimationFrame(frame);
}

// expose a tiny bit of state for smoke tests
window.__mbti = game;
window.__sprites = allSprites();

preloadSprites();
requestAnimationFrame(frame);
