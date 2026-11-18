// police.js — the wanted system: stars, police pursuit cars, foot cops,
// busts, and the heat decaying when the player lays low.
import { Car } from './vehicles.js';
import { createPersonMesh } from './player.js';
import { clamp, rand, pick } from './util.js';
import { ROAD_LINES } from './city.js';

const COP_SHIRT = 0x1d2b53;

export function addWanted(G, n, reason) {
  if (G.wanted >= 5 && n > 0) return;
  G.wanted = clamp(G.wanted + n, 0, 5);
  G.wantedTimer = 0;
  if (n > 0 && G.wanted > 0) G.hudMessage(`Wanted level ${G.wanted} — ${reason}`, 'bad');
}

function spawnPoliceCar(G) {
  const p = G.player;
  const px = p.car ? p.car.x : p.pos.x;
  const pz = p.car ? p.car.z : p.pos.z;
  // spawn on a road 60-90 m away
  const line = pick(Math.random, ROAD_LINES);
  const along = clamp((Math.random() < 0.5 ? pz : px) + (Math.random() < 0.5 ? -75 : 75), -200, 200);
  const vertical = Math.random() < 0.5;
  const x = vertical ? line : along;
  const z = vertical ? along : line;
  const car = new Car(G.three.scene, 'police', 0xe8e8e8, x, z, 0);
  car.driver = 'police';
  car.speed = 20;
  G.cars.push(car);
  G.policeCars.push({ car, ramCooldown: 0 });
}

function spawnFootCop(G) {
  const p = G.player;
  const px = p.car ? p.car.x : p.pos.x;
  const pz = p.car ? p.car.z : p.pos.z;
  const a = Math.random() * Math.PI * 2;
  const x = px + Math.cos(a) * rand(Math.random, 18, 30);
  const z = pz + Math.sin(a) * rand(Math.random, 18, 30);
  const mesh = createPersonMesh(COP_SHIRT, 0x14181d);
  mesh.position.set(x, 0, z);
  G.three.scene.add(mesh);
  G.cops.push({ mesh, x, z, heading: 0, speed: 7, bustT: 0, walkPhase: 0 });
}

export function updatePolice(G, dt) {
  const p = G.player;
  const px = p.car ? p.car.x : p.pos.x;
  const pz = p.car ? p.car.z : p.pos.z;
  const playerSpeed = p.car ? Math.abs(p.car.speed) : Math.hypot(p.vx, p.vz);

  // ---- heat decay: unseen for a while and the stars fall off ---------------
  // The wait grows with the heat (12 s + 3 s a star), so a 5-star chase
  // needs a long, clean break while 1 star fades fast on its own.
  let seen = false;
  for (const u of G.policeCars) {
    if (Math.hypot(u.car.x - px, u.car.z - pz) < 55) { seen = true; break; }
  }
  if (!seen) for (const c of G.cops) {
    if (Math.hypot(c.x - px, c.z - pz) < 40) { seen = true; break; }
  }
  if (G.wanted > 0) {
    if (seen) G.wantedTimer = 0;
    else {
      G.wantedTimer += dt;
      if (G.wantedTimer > 12 + G.wanted * 3) {
        G.wanted--;
        G.wantedTimer = 0;
        if (G.wanted === 0) G.hudMessage('You lost the cops. The heat is off.', 'good');
        else G.hudMessage(`Wanted level down to ${G.wanted}. Keep laying low.`, 'good');
      }
    }
  }

  // ---- match police presence to the wanted level ---------------------------
  while (G.policeCars.length < G.wanted) spawnPoliceCar(G);
  while (G.policeCars.length > G.wanted) {
    const u = G.policeCars.pop();
    G.cars.splice(G.cars.indexOf(u.car), 1);
    u.car.destroy(G.three.scene);
  }
  const wantCops = G.wanted >= 2 ? Math.min(2 + G.wanted, 4) : 0;
  while (G.cops.length < wantCops) spawnFootCop(G);
  while (G.cops.length > wantCops) {
    const c = G.cops.pop();
    G.three.scene.remove(c.mesh);
  }

  // ---- pursuit cars ---------------------------------------------------------
  G.sirenT -= dt;
  for (const u of G.policeCars) {
    const c = u.car;
    // steer toward the player's predicted position
    const pvx = p.car ? Math.sin(p.car.heading) * p.car.speed : p.vx;
    const pvz = p.car ? Math.cos(p.car.heading) * p.car.speed : p.vz;
    const tx = px + pvx * 0.45, tz = pz + pvz * 0.45;
    const want = Math.atan2(tx - c.x, tz - c.z);
    let dh = want - c.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    c.heading += clamp(dh, -2.4 * dt, 2.4 * dt);
    const dist = Math.hypot(tx - c.x, tz - c.z);
    const target = dist > 26 ? 40 : 26;
    c.speed += (target - c.speed) * Math.min(1, 1.4 * dt);
    c.mesh.position.x += Math.sin(c.heading) * c.speed * dt;
    c.mesh.position.z += Math.cos(c.heading) * c.speed * dt;
    c.mesh.rotation.y = c.heading;
    // ram the player's car
    u.ramCooldown -= dt;
    if (p.car && u.ramCooldown <= 0) {
      const d = Math.hypot(c.x - p.car.x, c.z - p.car.z);
      if (d < 4.4) {
        u.ramCooldown = 1.2;
        p.car.health -= 9;
        p.car.speed *= 0.75;
        G.fx.shake(0.5);
        G.fx.sparks(p.car.x, 0.9, p.car.z, 8);
        G.audio.crash();
        if (p.car.health <= 0 && !p.car.disabled) {
          p.car.disabled = true;
          G.hudMessage('Your car is wrecked! Get out and run!', 'bad');
        }
      }
    }
    // flashing light bar
    const phase = Math.floor(G.time * 2.4) % 2 === 0;
    const lr = c.mesh.userData.lightR, lb = c.mesh.userData.lightB;
    if (lr && lb) {
      lr.material.color.setHex(phase ? 0xff2222 : 0x550000);
      lb.material.color.setHex(phase ? 0x000055 : 0x2255ff);
    }
    if (G.sirenT <= 0 && dist < 70) { G.audio.sirenBlip(); G.sirenT = 1.4; }
  }

  // ---- foot cops --------------------------------------------------------------
  for (const c of G.cops) {
    const dx = px - c.x, dz = pz - c.z;
    const dist = Math.hypot(dx, dz);
    c.heading = Math.atan2(dx, dz);
    const speed = dist > 3 ? 7 : 3.5;
    c.x += Math.sin(c.heading) * speed * dt;
    c.z += Math.cos(c.heading) * speed * dt;
    c.walkPhase += dt * speed * 1.6;
    const swing = Math.sin(c.walkPhase) * 0.55;
    const u = c.mesh.userData;
    u.legL.rotation.x = swing; u.legR.rotation.x = -swing;
    c.mesh.position.set(c.x, 0, c.z);
    c.mesh.rotation.y = c.heading;
    // bust: close and the player is slow, on foot
    if (!p.car && dist < 2.4 && playerSpeed < 3) {
      c.bustT += dt;
      if (c.bustT > 1.5) { bustPlayer(G); return; }
    } else {
      c.bustT = Math.max(0, c.bustT - dt * 2);
    }
  }
}

export function bustPlayer(G) {
  if (G.mode !== 'playing') return;
  G.mode = 'busted';
  G.busted++;
  const fine = Math.min(200, G.money);
  G.money -= fine;
  G.wanted = 0;
  clearPolice(G);
  G.hud.showBusted(fine);
  G.audio.fail();
}

export function wastePlayer(G) {
  if (G.mode !== 'playing') return;
  G.mode = 'wasted';
  G.wasted++;
  const fee = Math.min(150, G.money);
  G.money -= fee;
  G.wanted = 0;
  clearPolice(G);
  if (G.player.car) {
    const car = G.player.car;
    car.driver = 'none';
    G.player.car = null;
    G.player.mesh.visible = true;
  }
  G.player.health = 100;
  G.player.pos.set(G.city.landmarks.hospital.x, 0, G.city.landmarks.hospital.z);
  G.player.mesh.position.copy(G.player.pos);
  G.hud.showWasted(fee);
  G.audio.fail();
}

export function clearPolice(G) {
  for (const u of G.policeCars) {
    G.cars.splice(G.cars.indexOf(u.car), 1);
    u.car.destroy(G.three.scene);
  }
  G.policeCars = [];
  for (const c of G.cops) G.three.scene.remove(c.mesh);
  G.cops = [];
}
