// input.js — keyboard + mouse state. Drag orbits the camera, wheel zooms,
// left click shoots, right-drag also orbits. No pointer lock: drag-orbit is
// robust in every browser and needs no permission.
export function createInput(canvas) {
  const keys = new Set();
  const mouse = { dx: 0, dy: 0, down: false, rightDown: false, clicked: false, wheel: 0 };
  let dragging = false;

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    keys.add(e.code);
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());

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
    pressed(code) { return keys.has(code); },
    // Edge-triggered key: true once per physical press.
    takePressed(code) {
      if (!keys.has(code)) return false;
      keys.delete(code);
      return true;
    },
  };
}
