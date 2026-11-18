// effects.js — particles (one THREE.Points pool, no per-frame allocation),
// screen shake and the damage vignette.
import * as THREE from 'three';
import { makeBlobTexture } from './textures.js';

const MAX = 240; // pool size: bursts recycle the oldest slot, never allocate

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.pos = new Float32Array(MAX * 3);
    this.vel = new Float32Array(MAX * 3);
    this.life = new Float32Array(MAX);
    this.maxLife = new Float32Array(MAX);
    this.col = new Float32Array(MAX * 3);
    this.base = new Float32Array(MAX * 3);
    this.head = 0;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.9, map: makeBlobTexture(), transparent: true, depthWrite: false,
      vertexColors: true, sizeAttenuation: true,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
    this.shakeAmp = 0;
    this.flash = null;
    for (let i = 0; i < MAX; i++) this.pos[i * 3 + 1] = -100;
  }
  spawn(x, y, z, vx, vy, vz, life, r, g, b) {
    const i = this.head;
    this.head = (this.head + 1) % MAX;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.life[i] = life; this.maxLife[i] = life;
    this.base[i * 3] = r; this.base[i * 3 + 1] = g; this.base[i * 3 + 2] = b;
    this.col[i * 3] = r; this.col[i * 3 + 1] = g; this.col[i * 3 + 2] = b;
  }
  burst(x, y, z, n, color, speed, life, up = 0) {
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.6);
      this.spawn(x, y, z, Math.cos(a) * s, up + Math.random() * speed * 0.6,
        Math.sin(a) * s, life * (0.6 + Math.random() * 0.7),
        color[0], color[1], color[2]);
    }
  }
  smoke(x, y, z, n = 6) { this.burst(x, y, z, n, [0.55, 0.55, 0.58], 1.2, 0.9, 1.2); }
  sparks(x, y, z, n = 10) { this.burst(x, y, z, n, [1.0, 0.75, 0.25], 4, 0.35, 2); }
  blood(x, y, z, n = 8) { this.burst(x, y, z, n, [0.75, 0.08, 0.08], 2.5, 0.5, 1.5); }
  shake(amount) { this.shakeAmp = Math.max(this.shakeAmp, amount); }
  damageFlash(el) { this.flash = el; if (el) { el.style.opacity = '0.55'; } }
  update(dt) {
    for (let i = 0; i < MAX; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) { this.pos[i * 3 + 1] = -100; continue; }
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.vel[i * 3 + 1] -= 3 * dt;
      const f = this.life[i] / this.maxLife[i];
      this.col[i * 3] = this.base[i * 3] * f;
      this.col[i * 3 + 1] = this.base[i * 3 + 1] * f;
      this.col[i * 3 + 2] = this.base[i * 3 + 2] * f;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
    this.shakeAmp = Math.max(0, this.shakeAmp - dt * 2.2);
    if (this.flash) {
      const o = parseFloat(this.flash.style.opacity || '0');
      const n = Math.max(0, o - dt * 1.8);
      this.flash.style.opacity = String(n);
      if (n === 0) this.flash = null;
    }
  }
  shakeOffset() {
    if (this.shakeAmp <= 0.01) return [0, 0];
    return [(Math.random() - 0.5) * this.shakeAmp, (Math.random() - 0.5) * this.shakeAmp];
  }
}
