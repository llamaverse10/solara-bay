// vehicles.js — car factory, arcade driving, enter/exit, car collisions.
import * as THREE from 'three';
import { clamp, lerp, pushOutCircle } from './util.js';
import { groundHeightAt } from './city.js';

const KINDS = {
  sedan: { len: 4.4, wid: 1.9, h: 0.72, cabin: 0.62, top: 1.35, max: 34, accel: 15 },
  coupe: { len: 4.1, wid: 1.85, h: 0.66, cabin: 0.55, top: 1.28, max: 40, accel: 18 },
  taxi: { len: 4.4, wid: 1.9, h: 0.72, cabin: 0.62, top: 1.35, max: 33, accel: 14 },
  van: { len: 5.0, wid: 2.0, h: 1.0, cabin: 0.9, top: 1.7, max: 28, accel: 11 },
  pickup: { len: 4.8, wid: 1.95, h: 0.85, cabin: 0.7, top: 1.5, max: 32, accel: 13 },
  police: { len: 4.5, wid: 1.95, h: 0.72, cabin: 0.62, top: 1.35, max: 42, accel: 20 },
};
const COLORS = [0xc23b2e, 0x2e6db4, 0xd8a020, 0x3f7d4e, 0x8a8f96, 0x6b4a8a, 0x20242a, 0xd8d2c4];

export function createCarMesh(kind, color) {
  const k = KINDS[kind];
  const g = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color });
  const dark = new THREE.MeshLambertMaterial({ color: 0x14181d });
  const glass = new THREE.MeshLambertMaterial({ color: 0x1d2b36 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(k.wid, k.h, k.len), paint);
  body.position.y = 0.62; body.castShadow = true; g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(k.wid * 0.86, k.cabin, k.len * 0.48), glass);
  cabin.position.set(0, 0.62 + k.h / 2 + k.cabin / 2 - 0.08, -k.len * 0.06);
  cabin.castShadow = true; g.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 12);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x0d0d0d });
  for (const [wx, wz] of [[-0.85, 1.35], [0.85, 1.35], [-0.85, -1.35], [0.85, -1.35]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.36, wz);
    g.add(w);
  }
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff2c0 });
  for (const s of [-1, 1]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.08), lightMat);
    h.position.set(s * 0.6, 0.72, k.len / 2 + 0.02);
    g.add(h);
  }
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xd21f1f });
  for (const s of [-1, 1]) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.08), tailMat);
    t.position.set(s * 0.6, 0.72, -k.len / 2 - 0.02);
    g.add(t);
  }
  if (kind === 'taxi') {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.4),
      new THREE.MeshBasicMaterial({ color: 0xffd23e }));
    sign.position.set(0, 1.62, -0.2); g.add(sign);
  }
  if (kind === 'police') {
    const barR = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.3),
      new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    barR.position.set(-0.35, 1.66, -0.2); g.add(barR);
    const barB = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.3),
      new THREE.MeshBasicMaterial({ color: 0x2255ff }));
    barB.position.set(0.35, 1.66, -0.2); g.add(barB);
    g.userData.lightR = barR; g.userData.lightB = barB;
  }
  g.userData.kind = kind;
  return g;
}

export class Car {
  constructor(scene, kind, color, x, z, heading) {
    this.kind = kind;
    this.spec = KINDS[kind];
    this.mesh = createCarMesh(kind, color);
    this.mesh.position.set(x, 0, z);
    this.mesh.rotation.y = heading;
    this.mesh.traverse((o) => { o.userData.tag = 'car'; o.userData.ref = this; });
    scene.add(this.mesh);
    this.heading = heading;
    this.speed = 0;
    this.steer = 0;
    this.health = 100;
    this.disabled = false;
    this.driver = 'none'; // 'none' | 'player' | 'traffic' | 'police'
    this.radius = 1.9;
    this.smokeT = 0;
  }
  get x() { return this.mesh.position.x; }
  get z() { return this.mesh.position.z; }
  setPos(x, z) { this.mesh.position.x = x; this.mesh.position.z = z; }
  destroy(scene) { scene.remove(this.mesh); }
}

// Arcade drive step for the player's car. Returns true when a hard hit happened.
export function drivePlayerCar(G, car, dt) {
  const input = G.input;
  if (car.disabled) {
    car.speed = lerp(car.speed, 0, Math.min(1, 4 * dt));
  } else {
    const fwd = input.pressed('KeyW') || input.pressed('ArrowUp');
    const back = input.pressed('KeyS') || input.pressed('ArrowDown');
    const left = input.pressed('KeyA') || input.pressed('ArrowLeft');
    const right = input.pressed('KeyD') || input.pressed('ArrowRight');
    const brake = input.pressed('Space');
    if (fwd) car.speed += car.spec.accel * dt;
    if (back) car.speed -= (car.speed > 0.5 ? 26 : 12) * dt;
    if (brake) car.speed = lerp(car.speed, 0, Math.min(1, 6 * dt));
    car.speed = clamp(car.speed, -10, car.spec.max);
    car.speed *= (1 - 0.35 * dt); // rolling drag
    const steerTarget = (left ? 1 : 0) - (right ? 1 : 0);
    car.steer = lerp(car.steer, steerTarget, Math.min(1, 10 * dt));
    const spd = Math.abs(car.speed);
    const turn = car.steer * clamp(spd / 11, 0, 1) * 1.85 * Math.sign(car.speed || 1);
    car.heading += turn * dt;
    if (brake && spd > 12 && Math.random() < 0.5) {
      G.fx.smoke(car.x - Math.sin(car.heading) * 1.5, 0.4, car.z - Math.cos(car.heading) * 1.5, 2);
    }
  }
  car.mesh.position.x += Math.sin(car.heading) * car.speed * dt;
  car.mesh.position.z += Math.cos(car.heading) * car.speed * dt;
  car.mesh.rotation.y = car.heading;
  // ride the ground under the car (the pier deck is raised)
  car.mesh.position.y = groundHeightAt(car.x, car.z);
  // buildings
  let hit = false;
  for (const b of G.city.colliders) {
    if (pushOutCircle(car.mesh.position, car.radius, b)) {
      if (Math.abs(car.speed) > 12) {
        hit = true;
        car.health -= Math.abs(car.speed) * 0.7;
        G.audio.crash();
        G.fx.sparks(car.mesh.position.x, 0.8, car.mesh.position.z, 8);
        G.fx.shake(0.35);
      }
      car.speed *= 0.45;
    }
  }
  if (car.health <= 0 && !car.disabled) {
    car.disabled = true;
    G.fx.burst(car.x, 1, car.z, 30, [1, 0.6, 0.2], 5, 0.8, 3);
    G.audio.crash();
    G.fx.shake(0.8);
  }
  if (car.disabled || car.health < 40) {
    car.smokeT -= dt;
    if (car.smokeT <= 0) {
      car.smokeT = 0.12;
      G.fx.smoke(car.x, 1.2, car.z, 2);
    }
  }
  return hit;
}

// Circle-circle push between two cars; exchanges a little speed. A rear-end
// bump slows the car behind harder, so it falls back instead of sticking
// to the bumper in front of it. The 0.7 dot threshold means the bump only
// counts as a rear-end when the cars are roughly nose-to-tail, not in a
// side swipe — those keep the even split.
export function collideCars(a, b) {
  const dx = b.x - a.x, dz = b.z - a.z;
  const d = Math.hypot(dx, dz);
  const min = a.radius + b.radius - 0.4;
  if (d >= min || d < 1e-6) return false;
  const push = (min - d) / 2;
  const nx = dx / d, nz = dz / d;
  a.mesh.position.x -= nx * push; a.mesh.position.z -= nz * push;
  b.mesh.position.x += nx * push; b.mesh.position.z += nz * push;
  const rel = Math.abs(a.speed - b.speed);
  if (rel > 6) {
    // who rear-ended whom: the car whose heading points at the other one
    const aRear = (Math.sin(a.heading) * nx + Math.cos(a.heading) * nz) > 0.7 && a.speed > b.speed;
    const bRear = (Math.sin(b.heading) * -nx + Math.cos(b.heading) * -nz) > 0.7 && b.speed > a.speed;
    if (aRear) { a.speed *= 0.5; b.speed *= 0.85; }
    else if (bRear) { b.speed *= 0.5; a.speed *= 0.85; }
    else { a.speed *= 0.7; b.speed *= 0.7; }
  }
  return true;
}

export function nearestCar(G, x, z, maxDist) {
  let best = null, bestD = maxDist;
  for (const c of G.cars) {
    if (c.driver === 'police') continue; // police interceptors are locked
    const d = Math.hypot(c.x - x, c.z - z);
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}

export function enterCar(G, car) {
  const p = G.player;
  p.car = car;
  car.driver = 'player';
  p.mesh.visible = false;
  G.camera.orbit = 0;
  G.audio.engine(0, true);
}

export function exitCar(G) {
  const p = G.player;
  const car = p.car;
  if (!car) return;
  car.driver = 'none';
  p.car = null;
  const side = Math.cos(car.heading) > 0 ? 1 : -1;
  p.pos.set(car.x + side * 2.4, 0, car.z + 1.2);
  p.vx = 0; p.vz = 0; p.vy = 0;
  p.mesh.visible = true;
  p.mesh.position.copy(p.pos);
  G.audio.engine(0, false);
}

export { COLORS };
