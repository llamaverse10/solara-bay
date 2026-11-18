// textures.js — every texture the city needs, drawn once on offscreen
// canvases. No image files, no network. All textures are canvas-generated.
import * as THREE from 'three';
import { makeRng } from './util.js';

function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.RepeatWrapping; }
  t.anisotropy = 4;
  return t;
}

// Building facades: warm stucco/concrete with a grid of windows, some lit
// amber for dusk. One texture per variant; buildings repeat it by height.
const FACADE_COLORS = ['#c98f5f', '#b98a6d', '#8fa3b0', '#d9b380', '#a87f6a', '#7d94a6'];
export function makeFacadeTextures() {
  const out = [];
  for (let v = 0; v < 4; v++) {
    const rng = makeRng(100 + v * 7);
    const base = FACADE_COLORS[(v * 2) % FACADE_COLORS.length];
    const base2 = FACADE_COLORS[(v * 2 + 3) % FACADE_COLORS.length];
    out.push(canvasTex(128, 256, (g, w, h) => {
      g.fillStyle = base; g.fillRect(0, 0, w, h);
      // subtle vertical shading bands
      for (let x = 0; x < w; x += 16) {
        g.fillStyle = rng() > 0.5 ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.05)';
        g.fillRect(x, 0, 16, h);
      }
      // ground floor: shopfront strip
      g.fillStyle = base2; g.fillRect(0, h - 26, w, 26);
      g.fillStyle = 'rgba(20,16,12,0.55)';
      for (let x = 6; x < w - 10; x += 22) g.fillRect(x, h - 22, 16, 18);
      // window grid
      for (let y = 8; y < h - 34; y += 22) {
        for (let x = 8; x < w - 12; x += 20) {
          const lit = rng() < 0.28;
          g.fillStyle = lit ? '#ffca6a' : (rng() < 0.5 ? '#2b3542' : '#1d2733');
          g.fillRect(x, y, 12, 14);
          g.fillStyle = 'rgba(255,255,255,0.14)';
          g.fillRect(x, y, 12, 3);
        }
      }
    }, true));
  }
  return out;
}

// Asphalt with a dashed centre line; tiled along each road.
export function makeRoadTexture() {
  return canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#4a4e55'; g.fillRect(0, 0, w, h);
    const rng = makeRng(42);
    for (let i = 0; i < 500; i++) {
      g.fillStyle = rng() > 0.5 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.08)';
      g.fillRect(rng() * w, rng() * h, 2, 2);
    }
    g.fillStyle = '#d8c25a';
    g.fillRect(w / 2 - 2, 8, 4, 26); g.fillRect(w / 2 - 2, 70, 4, 26);
    g.fillStyle = 'rgba(255,255,255,0.35)';
    g.fillRect(4, 0, 2, h); g.fillRect(w - 6, 0, 2, h);
  }, true);
}

export function makeSidewalkTexture() {
  return canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#9a938a'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 2;
    for (let i = 0; i <= 4; i++) {
      g.beginPath(); g.moveTo(0, i * 32); g.lineTo(w, i * 32); g.stroke();
      g.beginPath(); g.moveTo(i * 32, 0); g.lineTo(i * 32, h); g.stroke();
    }
    const rng = makeRng(7);
    for (let i = 0; i < 200; i++) {
      g.fillStyle = 'rgba(0,0,0,0.05)';
      g.fillRect(rng() * w, rng() * h, 2, 2);
    }
  }, true);
}

export function makeSandTexture() {
  return canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#e0c48f'; g.fillRect(0, 0, w, h);
    const rng = makeRng(99);
    for (let i = 0; i < 700; i++) {
      g.fillStyle = rng() > 0.5 ? 'rgba(255,240,200,0.25)' : 'rgba(120,90,40,0.18)';
      g.fillRect(rng() * w, rng() * h, 2, 2);
    }
  }, true);
}

// Billboards with original Solara Bay slogans.
const BILLBOARDS = [
  { bg: '#e8632c', fg: '#fff3dd', big: 'SOLARA BAY', small: 'SUN · SAND · SIRENS' },
  { bg: '#14506e', fg: '#bfe8ff', big: 'MARLIN CLUB', small: 'MEMBERS ONLY · PIER 9' },
  { bg: '#7a2d4d', fg: '#ffd9e8', big: 'VESPER MOTORS', small: 'DRIVE THE NIGHT' },
  { bg: '#2e6b3c', fg: '#e2ffd2', big: 'SOLARA TRUST', small: 'YOUR MONEY, OUR VAULT' },
];
export function makeBillboardTextures() {
  return BILLBOARDS.map((b) => canvasTex(256, 128, (g, w, h) => {
    g.fillStyle = b.bg; g.fillRect(0, 0, w, h);
    g.strokeStyle = b.fg; g.lineWidth = 6; g.strokeRect(6, 6, w - 12, h - 12);
    g.fillStyle = b.fg; g.textAlign = 'center';
    g.font = 'bold 34px system-ui, sans-serif';
    g.fillText(b.big, w / 2, h / 2 - 4);
    g.font = 'bold 17px system-ui, sans-serif';
    g.fillText(b.small, w / 2, h / 2 + 30);
  }));
}

// Vertical sunset gradient for the sky dome.
export function makeSkyTexture() {
  const t = canvasTex(4, 256, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0.0, '#2b3a6b');
    grad.addColorStop(0.35, '#7a5a8f');
    grad.addColorStop(0.55, '#e07a4e');
    grad.addColorStop(0.72, '#f7b267');
    grad.addColorStop(1.0, '#f9d976');
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
  });
  return t;
}

// Soft radial blob for particles (smoke / muzzle flash).
export function makeBlobTexture() {
  return canvasTex(64, 64, (g, w, h) => {
    const grad = g.createRadialGradient(32, 32, 2, 32, 32, 30);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.45)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
  });
}
