// Keyboard tracking with edge detection.
//   isDown(code)     -> currently held
//   wasPressed(code) -> went down since the last endFrame()
// Call endFrame() once per logic step after everyone has read input.

const down = new Set();
const pressed = new Set();

// Keys we don't want to scroll/select the page.
const PREVENT = new Set([
  "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space",
]);

window.addEventListener("keydown", (e) => {
  if (PREVENT.has(e.code)) e.preventDefault();
  if (!down.has(e.code)) pressed.add(e.code);
  down.add(e.code);
});

window.addEventListener("keyup", (e) => {
  down.delete(e.code);
});

// Lose focus -> release everything so a fighter doesn't "stick".
window.addEventListener("blur", () => {
  down.clear();
});

export const Input = {
  isDown: (code) => down.has(code),
  wasPressed: (code) => pressed.has(code),
  anyPressed: () => pressed.size > 0,
  endFrame: () => pressed.clear(),
};

// Pointer state for the menus (set by main.js on the canvas).
export const Pointer = {
  x: 0,
  y: 0,
  clicked: false, // true for the single frame after a click
};
