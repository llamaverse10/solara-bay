// combat.js — pistol + fists, hitscan shooting with headshots, enemy AI
// (rival thugs and bank guards), and hurting the player.
import * as THREE from 'three';
import { createPersonMesh } from './player.js';
import { clamp } from './util.js';
import { addWanted, wastePlayer } from './police.js';

const PISTOL = { mag: 12, damage: 34, headMul: 2, cooldown: 0.26, range: 120 };
const raycaster = new THREE.Raycaster();
const _dir = new THREE.Vector3();
const _origin = new THREE.Vector3();

function tagTarget(mesh, tag, ref) {
  mesh.traverse((o) => { o.userData.tag = tag; o.userData.ref = ref; });
  mesh.userData.tag = tag; mesh.userData.ref = ref;
}

export function spawnEnemy(G, x, z, kind) {
  const shirt = kind === 'guard' ? 0x1d2b53 : 0x7a1f1f;
  const mesh = createPersonMesh(shirt, kind === 'guard' ? 0x14181d : 0x2a2f3a);
  mesh.position.set(x, 0, z);
  G.three.scene.add(mesh);
  const e = {
    mesh, x, z, hp: 100, kind, heading: 0, shootT: 1 + Math.random(),
    walkPhase: Math.random() * 6, dead: false, deadT: 0,
  };
  tagTarget(mesh, 'enemy', e);
  // mark the head box for headshots
  mesh.children.forEach((c) => { if (c.position.y > 1.4) c.userData.head = true; });
  G.enemies.push(e);
  return e;
}

export function hurtPlayer(G, dmg) {
  const p = G.player;
  if (G.mode !== 'playing' || p.health <= 0) return;
  p.health -= dmg;
  p.lastHurt = G.time;
  G.fx.damageFlash(document.getElementById('vignette'));
  G.fx.shake(0.25);
  if (p.health <= 0) { p.health = 0; wastePlayer(G); }
}

function collectTargets(G) {
  const list = G.city.buildingMeshes.slice();
  for (const c of G.cars) list.push(c.mesh);
  for (const p of G.peds) if (!p.down) list.push(p.mesh);
  for (const c of G.cops) list.push(c.mesh);
  for (const e of G.enemies) if (!e.dead) list.push(e.mesh);
  return list;
}

export function tryShoot(G) {
  const p = G.player;
  if (G.mode !== 'playing' || p.car || p.weapon !== 'pistol') return;
  if (G.time - p.lastShotT < PISTOL.cooldown) return;
  p.lastShotT = G.time;
  if (p.magAmmo <= 0) {
    G.audio.click();
    reloadWeapon(G);
    return;
  }
  p.magAmmo--;
  G.audio.shot();
  G.fx.shake(0.12);
  // muzzle flash at the gun (right side of the player)
  const mx = p.pos.x + Math.sin(p.heading) * 0.4 + Math.cos(p.heading) * 0.35;
  const mz = p.pos.z + Math.cos(p.heading) * 0.4 - Math.sin(p.heading) * 0.35;
  G.fx.sparks(mx, 1.35, mz, 4);
  // ray from the camera through the screen centre
  const cam = G.three.camera;
  cam.getWorldDirection(_dir);
  _origin.copy(cam.position);
  raycaster.set(_origin, _dir);
  raycaster.far = PISTOL.range;
  const hits = raycaster.intersectObjects(collectTargets(G), true);
  G.lastShot = { x: p.pos.x, z: p.pos.z };
  // firing is loud: a nearby cop hears it
  if (G.nearestCopDist() < 80) addWanted(G, 1, 'Shots fired');
  if (!hits.length) return;
  const h = hits[0];
  const tag = h.object.userData.tag;
  const ref = h.object.userData.ref;
  if (tag === 'enemy' && ref && !ref.dead) {
    const head = !!h.object.userData.head;
    ref.hp -= PISTOL.damage * (head ? PISTOL.headMul : 1);
    G.fx.blood(h.point.x, h.point.y, h.point.z, 8);
    G.hud.hitmarker(head);
    if (ref.hp <= 0) killEnemy(G, ref);
  } else if (tag === 'cop' && ref) {
    addWanted(G, 2, 'Cop down');
    G.money += 0;
    G.fx.blood(h.point.x, h.point.y, h.point.z, 8);
    G.hud.hitmarker(false);
    // the cop goes down: remove it from the chase
    G.three.scene.remove(ref.mesh);
    G.cops.splice(G.cops.indexOf(ref), 1);
  } else if (tag === 'ped' && ref) {
    G.fx.blood(h.point.x, h.point.y, h.point.z, 8);
    G.hud.hitmarker(false);
  } else if (tag === 'car' && ref) {
    ref.health -= 12;
    G.fx.sparks(h.point.x, h.point.y, h.point.z, 6);
    G.hud.hitmarker(false);
  } else {
    // building / ground: impact dust
    G.fx.burst(h.point.x, h.point.y, h.point.z, 4, [0.7, 0.65, 0.55], 1.5, 0.4, 1);
  }
}

function killEnemy(G, e) {
  e.dead = true; e.deadT = 5;
  e.mesh.rotation.x = Math.PI / 2 - 0.1;
  e.mesh.position.y = 0.25;
  G.money += 50;
  G.hudMessage('+ $50', 'good');
  G.audio.coin();
}

export function reloadWeapon(G) {
  const p = G.player;
  if (p.weapon !== 'pistol' || p.magAmmo === PISTOL.mag) return;
  p.magAmmo = PISTOL.mag;
  G.audio.reload();
}

export function punch(G) {
  const p = G.player;
  if (G.mode !== 'playing' || p.car || G.time - p.lastShotT < 0.45) return;
  p.lastShotT = G.time;
  G.audio.punch();
  const fx = Math.sin(p.heading), fz = Math.cos(p.heading);
  // nearest person in front, within 2.2 m
  let best = null, bestD = 2.2;
  const consider = (x, z, ref, kind) => {
    const dx = x - p.pos.x, dz = z - p.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < bestD && dx * fx + dz * fz > 0) { bestD = d; best = { ref, kind }; }
  };
  for (const ped of G.peds) if (!ped.down) consider(ped.x, ped.z, ped, 'ped');
  for (const e of G.enemies) if (!e.dead) consider(e.x, e.z, e, 'enemy');
  for (const c of G.cops) consider(c.x, c.z, c, 'cop');
  if (!best) return;
  if (best.kind === 'ped') {
    const ped = best.ref;
    ped.down = true; ped.stateT = 5;
    ped.mesh.rotation.x = Math.PI / 2 - 0.1;
    ped.mesh.position.y = 0.25;
    setTimeout(() => { ped.mesh.rotation.x = 0; ped.mesh.position.y = 0; }, 5000);
    if (G.nearestCopDist() < 60) addWanted(G, 1, 'Assault');
  } else if (best.kind === 'enemy') {
    best.ref.hp -= 20;
    if (best.ref.hp <= 0) killEnemy(G, best.ref);
  } else if (best.kind === 'cop') {
    addWanted(G, 1, 'Assaulting an officer');
    G.three.scene.remove(best.ref.mesh);
    G.cops.splice(G.cops.indexOf(best.ref), 1);
  }
}

export function updateEnemies(G, dt) {
  const p = G.player;
  const px = p.car ? p.car.x : p.pos.x;
  const pz = p.car ? p.car.z : p.pos.z;
  for (const e of G.enemies) {
    if (e.dead) {
      e.deadT -= dt;
      if (e.deadT <= 0) {
        G.three.scene.remove(e.mesh);
        G.enemies.splice(G.enemies.indexOf(e), 1);
      }
      continue;
    }
    const dx = px - e.x, dz = pz - e.z;
    const dist = Math.hypot(dx, dz);
    e.heading = Math.atan2(dx, dz);
    // approach to 10-18 m, then hold and shoot
    if (dist > 18) {
      e.x += Math.sin(e.heading) * 4.2 * dt;
      e.z += Math.cos(e.heading) * 4.2 * dt;
      e.walkPhase += dt * 9;
    } else if (dist < 9) {
      e.x -= Math.sin(e.heading) * 2 * dt;
      e.z -= Math.cos(e.heading) * 2 * dt;
    }
    const swing = Math.sin(e.walkPhase) * 0.5;
    const u = e.mesh.userData;
    u.legL.rotation.x = swing; u.legR.rotation.x = -swing;
    e.mesh.position.set(e.x, 0, e.z);
    e.mesh.rotation.y = e.heading;
    // shoot at the player with distance-based inaccuracy
    e.shootT -= dt;
    if (e.shootT <= 0 && dist < 42 && G.mode === 'playing') {
      e.shootT = 1.3 + Math.random() * 0.9;
      G.audio.enemyShot();
      G.fx.sparks(e.x, 1.35, e.z, 3);
      const hitChance = clamp(0.55 - dist * 0.011, 0.08, 0.5);
      if (Math.random() < hitChance) hurtPlayer(G, 6 + Math.random() * 6);
      // tracer dust near the player on a miss
      if (Math.random() < 0.5) {
        G.fx.burst(px + (Math.random() - 0.5) * 2, 1.2, pz + (Math.random() - 0.5) * 2,
          3, [1, 0.8, 0.4], 1, 0.3, 0.5);
      }
    }
  }
}
