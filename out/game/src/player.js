// player.js — Leo Marín on foot: WASD movement, jump, sprint, punch, the
// third-person camera (drag to orbit, wheel to zoom), and the on-foot mesh.
import * as THREE from 'three';
import { clamp, lerp, angleLerp, pushOutCircle } from './util.js';

const WALK_SPEED = 6, SPRINT_SPEED = 9.5, ACCEL = 42, JUMP_V = 7.5, GRAVITY = -22;

export function createPlayerMesh() {
  const g = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: 0xc98d64 });
  const shirt = new THREE.MeshLambertMaterial({ color: 0x2e8f86 });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2a2f3a });
  const shoes = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.62, 0.3), shirt);
  torso.position.y = 1.08; torso.castShadow = true; g.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 0.3), skin);
  head.position.y = 1.56; head.castShadow = true; g.add(head);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.1, 0.34),
    new THREE.MeshLambertMaterial({ color: 0xe8632c }));
  cap.position.y = 1.74; g.add(cap);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.78, 0.22), pants);
  legL.position.set(-0.14, 0.39, 0); legL.castShadow = true; g.add(legL);
  const legR = legL.clone(); legR.position.x = 0.14; g.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.6, 0.18), shirt);
  armL.position.set(-0.34, 1.1, 0); g.add(armL);
  const armR = armL.clone(); armR.position.x = 0.34; g.add(armR);
  const shoeL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.34), shoes);
  shoeL.position.set(-0.14, 0.05, 0.05); g.add(shoeL);
  const shoeR = shoeL.clone(); shoeR.position.x = 0.14; g.add(shoeR);
  g.userData = { legL, legR, armL, armR, torso };
  return g;
}

// Simple person mesh (pedestrians, thugs, cops): shirt colour varies.
export function createPersonMesh(shirtColor, pantsColor = 0x2a2f3a) {
  const g = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: 0xc98d64 });
  const shirt = new THREE.MeshLambertMaterial({ color: shirtColor });
  const pants = new THREE.MeshLambertMaterial({ color: pantsColor });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.28), shirt);
  torso.position.y = 1.06; torso.castShadow = true; g.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.28), skin);
  head.position.y = 1.52; head.castShadow = true; g.add(head);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.76, 0.2), pants);
  legL.position.set(-0.13, 0.38, 0); g.add(legL);
  const legR = legL.clone(); legR.position.x = 0.13; g.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.58, 0.16), shirt);
  armL.position.set(-0.32, 1.08, 0); g.add(armL);
  const armR = armL.clone(); armR.position.x = 0.32; g.add(armR);
  g.userData = { legL, legR, armL, armR };
  return g;
}

export function updatePlayer(G, dt) {
  const p = G.player;
  const input = G.input;
  const m = input.consumeMouse();
  // camera orbit: on foot the drag turns the camera; in a car it orbits
  // around the chase camera's yaw instead.
  if (p.car) {
    G.camera.orbit = clamp(G.camera.orbit - m.dx * 0.0042, -2.4, 2.4);
    G.camera.pitch = clamp(G.camera.pitch + m.dy * 0.0032, 0.08, 0.9);
  } else {
    G.camera.yaw -= m.dx * 0.0042;
    G.camera.pitch = clamp(G.camera.pitch + m.dy * 0.0032, -0.15, 1.1);
  }
  G.camera.dist = clamp(G.camera.dist + m.wheel * 0.9, 4.5, 13);

  if (p.car) return; // driving is handled by vehicles.js

  // move relative to camera yaw
  let fx = 0, fz = 0;
  if (input.pressed('KeyW') || input.pressed('ArrowUp')) fz -= 1;
  if (input.pressed('KeyS') || input.pressed('ArrowDown')) fz += 1;
  if (input.pressed('KeyA') || input.pressed('ArrowLeft')) fx -= 1;
  if (input.pressed('KeyD') || input.pressed('ArrowRight')) fx += 1;
  const moving = fx !== 0 || fz !== 0;
  const sprint = input.pressed('ShiftLeft') || input.pressed('ShiftRight');
  const maxSpeed = sprint ? SPRINT_SPEED : WALK_SPEED;
  if (moving) {
    const len = Math.hypot(fx, fz);
    const cy = Math.cos(G.camera.yaw), sy = Math.sin(G.camera.yaw);
    // forward (W) is (-sin yaw, -cos yaw); right (D) is (cos yaw, -sin yaw)
    const wx = (sy * fz + cy * fx) / len;
    const wz = (cy * fz - sy * fx) / len;
    p.vx = lerp(p.vx, wx * maxSpeed, Math.min(1, ACCEL * dt / maxSpeed));
    p.vz = lerp(p.vz, wz * maxSpeed, Math.min(1, ACCEL * dt / maxSpeed));
    p.heading = Math.atan2(p.vx, p.vz);
    p.walkPhase += dt * (sprint ? 13 : 9);
  } else {
    p.vx = lerp(p.vx, 0, Math.min(1, 12 * dt));
    p.vz = lerp(p.vz, 0, Math.min(1, 12 * dt));
  }
  p.pos.x += p.vx * dt;
  p.pos.z += p.vz * dt;
  // gravity / jump
  if (input.takePressed('Space') && p.onGround) { p.vy = JUMP_V; p.onGround = false; }
  p.vy += GRAVITY * dt;
  p.pos.y += p.vy * dt;
  if (p.pos.y <= 0) { p.pos.y = 0; p.vy = 0; p.onGround = true; }
  // collide with buildings
  for (const b of G.city.colliders) pushOutCircle(p.pos, 0.55, b);
  // walk animation
  const swing = moving ? Math.sin(p.walkPhase) * 0.55 : 0;
  const u = p.mesh.userData;
  u.legL.rotation.x = swing; u.legR.rotation.x = -swing;
  u.armL.rotation.x = -swing * 0.8; u.armR.rotation.x = swing * 0.8;
  p.mesh.position.copy(p.pos);
  p.mesh.rotation.y = p.heading;
  // health regen after 8 s without damage
  if (G.time - p.lastHurt > 8 && p.health < 100) p.health = Math.min(100, p.health + 5 * dt);
}

export function updateCamera(G, dt) {
  const cam = G.camera;
  const target = G.player.car
    ? G.player.car.mesh.position
    : G.player.mesh.position;
  const ty = target.y + (G.player.car ? 1.6 : 1.5);
  if (G.player.car) {
    // chase camera: ease yaw toward the car's heading, keep mouse orbit
    const want = G.player.car.heading + Math.PI + cam.orbit;
    cam.yaw = angleLerp(cam.yaw, want, Math.min(1, 2.2 * dt));
    cam.dist = lerp(cam.dist, 11, Math.min(1, 3 * dt));
  }
  const d = cam.dist;
  const cx = target.x + Math.sin(cam.yaw) * Math.cos(cam.pitch) * d;
  const cz = target.z + Math.cos(cam.yaw) * Math.cos(cam.pitch) * d;
  const cy = ty + Math.sin(cam.pitch) * d;
  const sh = G.fx.shakeOffset();
  G.three.camera.position.set(cx + sh[0], cy + sh[1], cz);
  G.three.camera.lookAt(target.x, ty, target.z);
}
