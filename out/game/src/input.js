// input.js — keyboard + mouse state. Drag orbits the camera, wheel zooms,
// left click shoots, right-drag also orbits. No pointer lock: drag-orbit is
// robust in every browser and needs no permission.
//
// Keys are tracked two ways, and the split matters: `keys` is the physical
// held state (down until keyup), while `justPressed` holds the edge — one
// entry per physical press, consumed by takePressed. The vault hold in M4
// reads the held state (E held for 5 s) while the same press also fires the
// one-shot interact; if one set served both, the interact would eat the
// press and the vault could never be cracked.
export function createInput(canvas) {
  const keys = new Set();       // currently held down
  const justPressed = new Set(); // edge: one entry per physical press
  const mouse = { dx: 0, dy: 0, down: false, rightDown: false, clicked: false, wheel: 0 };
  let dragging = false;

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    keys.add(e.code);
    justPressed.add(e.code);
    // Space and the arrows scroll the page by default; the game owns them.
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => { keys.clear(); justPressed.clear(); });

  canvas.addEventListener('mousedown', (e) => {
    dragging = true;
    mouse.down = true;
    if (e.button === 2) mouse.rightDown = true;
    if (e.button === 0) mouse.clicked = true;
  });
  window.addEventListener('mouseup', (e) => {
    dragging = false; mouse.down = false;
    if (e.button === 2) mouse.rightDown = false;
  });
  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    mouse.dx += e.movementX || 0;
    mouse.dy += e.movementY || 0;
  });
  canvas.addEventListener('wheel', (e) => {
    mouse.wheel += Math.sign(e.deltaY);
    e.preventDefault();
  }, { passive: false });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  return {
    keys, mouse,
    // Consumed once per frame by the game loop.
    consumeMouse() {
      const m = { dx: mouse.dx, dy: mouse.dy, clicked: mouse.clicked, wheel: mouse.wheel };
      mouse.dx = 0; mouse.dy = 0; mouse.clicked = false; mouse.wheel = 0;
      return m;
    },
    // Held state: true the whole time the key is physically down.
    pressed(code) { return keys.has(code); },
    // Edge-triggered key: true once per physical press.
    takePressed(code) {
      if (!justPressed.has(code)) return false;
      justPressed.delete(code);
      return true;
    },
  };
}
