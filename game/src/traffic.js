// traffic.js — traffic cars that follow the road grid and pedestrians that
// walk the sidewalks (and flee gunfire). Both despawn/respawn around the
// player so the streets always feel alive.
import { Car, COLORS, collideCars } from './vehicles.js';
import { createPersonMesh } from './player.js';
import { makeRng, rand, randi, pick, pushOutCircle } from './util.js';
import { ROAD_LINES } from './city.js';

const SHIRTS = [0xd8a020, 0x3f7d4e, 0x8a8f96, 0x6b4a8a, 0xc23b2e, 0x2e6db4, 0xe8e0cc, 0xdd6a9a];

function randomNode(rng) {
  return { x: pick(rng, ROAD_LINES), z: pick(rng, ROAD_LINES) };
}
function neighborNode(rng, n) {
  const ix = ROAD_LINES.indexOf(n.x), iz = ROAD_LINES.indexOf(n.z);
  const opts = [];
  if (ix > 0) opts.push({ x: ROAD_LINES[ix - 1], z: n.z });
  if (ix < ROAD_LINES.length - 1) opts.push({ x: ROAD_LINES[ix + 1], z: n.z });
  if (iz > 0) opts.push({ x: n.x, z: ROAD_LINES[iz - 1] });
  if (iz < ROAD_LINES.length - 1) opts.push({ x: n.x, z: ROAD_LINES[iz + 1] });
  return pick(rng, opts);
}
// Lane offset: right-hand traffic, 3.2 m from the road centre. side -1 is
// the oncoming lane, used when a car overtakes a slow one ahead of it.
function laneTarget(from, to, side = 1) {
  const o = 3.2 * side;
  if (to.x > from.x) return { x: to.x, z: to.z + o };
  if (to.x < from.x) return { x: to.x, z: to.z - o };
  if (to.z > from.z) return { x: to.x - o, z: to.z };
  return { x: to.x + o, z: to.z };
}

export function spawnTraffic(G) {
  const rng = makeRng(555);
  G.traffic = [];
  for (let i = 0; i < 12; i++) {
    const node = randomNode(rng);
    const next = neighborNode(rng, node);
    const kind = pick(rng, ['sedan', 'sedan', 'coupe', 'taxi', 'van', 'pickup']);
    const car = new Car(G.three.scene, kind, pick(rng, COLORS), node.x, node.z, 0);
    car.driver = 'traffic';
    car.speed = rand(rng, 7, 11);
    G.cars.push(car);
    G.traffic.push({ car, node, next, target: laneTarget(node, next), speed: car.speed,
      blockedT: 0, overtake: false });
  }
  G.peds = [];
  for (let i = 0; i < 20; i++) {
    const mesh = createPersonMesh(pick(rng, SHIRTS));
    const x = rand(rng, -200, 200), z = rand(rng, -200, 210);
    mesh.position.set(x, 0, z);
    G.three.scene.add(mesh);
    G.peds.push({
      mesh, x, z, heading: rand(rng, 0, Math.PI * 2),
      speed: rand(rng, 1.0, 1.6), tx: x, tz: z, state: 'walk',
      stateT: 0, walkPhase: rand(rng, 0, 6), down: false,
    });
  }
}

function carAhead(G, car, dist) {
  const hx = Math.sin(car.heading), hz = Math.cos(car.heading);
  for (const o of G.cars) {
    if (o === car || o.driver === 'none') continue; // parked cars sit at the kerb
    const dx = o.x - car.x, dz = o.z - car.z;
    const along = dx * hx + dz * hz;
    if (along > 0 && along < dist && Math.abs(dx * hz - dz * hx) < 2.2) return true;
  }
  return false;
}

export function updateTraffic(G, dt) {
  const px = G.player.car ? G.player.car.x : G.player.pos.x;
  const pz = G.player.car ? G.player.car.z : G.player.pos.z;
  for (const t of G.traffic) {
    const c = t.car;
    const dx = t.target.x - c.x, dz = t.target.z - c.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 4) {
      t.node = t.next;
      t.next = neighborNode(Math.random, t.node);
      t.target = laneTarget(t.node, t.next, t.overtake ? -1 : 1);
    }
    const want = Math.atan2(dx, dz);
    let dh = want - c.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    c.heading += Math.max(-1.6 * dt, Math.min(1.6 * dt, dh));
    const blocked = carAhead(G, c, 10);
    // stuck behind a slow car for a while? Pull into the oncoming lane and
    // overtake instead of sitting on its bumper; fall back once clear.
    // The 0.8 s grace stops a car from swerving for a car that is itself
    // about to turn off at the next junction.
    if (blocked) {
      t.blockedT += dt;
      if (t.blockedT > 0.8 && !t.overtake) {
        t.overtake = true;
        t.target = laneTarget(t.node, t.next, -1);
      }
    } else {
      t.blockedT = 0;
      if (t.overtake) {
        t.overtake = false;
        t.target = laneTarget(t.node, t.next, 1);
      }
    }
    c.speed += ((blocked ? 0 : t.speed) - c.speed) * Math.min(1, 2 * dt);
    c.mesh.position.x += Math.sin(c.heading) * c.speed * dt;
    c.mesh.position.z += Math.cos(c.heading) * c.speed * dt;
    c.mesh.rotation.y = c.heading;
    // keep the flow near the player: teleport far cars to a road nearby
    if (Math.hypot(c.x - px, c.z - pz) > 190) {
      const n = randomNode(Math.random);
      c.setPos(n.x + (Math.random() < 0.5 ? -3.2 : 3.2), n.z);
      t.node = n; t.next = neighborNode(Math.random, n);
      t.target = laneTarget(n, t.next);
      t.blockedT = 0; t.overtake = false;
    }
  }
  // car-car collisions (traffic vs player car and each other)
  for (let i = 0; i < G.cars.length; i++) {
    for (let j = i + 1; j < G.cars.length; j++) {
      const a = G.cars[i], b = G.cars[j];
      if (a.driver === 'none' && b.driver === 'none') continue;
      collideCars(a, b);
    }
  }
  // pedestrians
  for (const p of G.peds) {
    if (p.down) {
      p.stateT -= dt;
      if (p.stateT <= 0) { p.down = false; p.state = 'flee'; p.stateT = 3; }
      continue;
    }
    if (p.state === 'flee') {
      p.stateT -= dt;
      if (p.stateT <= 0) p.state = 'walk';
    } else if (G.lastShot && Math.hypot(p.x - G.lastShot.x, p.z - G.lastShot.z) < 26) {
      p.state = 'flee'; p.stateT = 3;
      p.heading = Math.atan2(p.x - G.lastShot.x, p.z - G.lastShot.z);
    }
    const speed = p.state === 'flee' ? 3.6 : p.speed;
    if (p.state === 'walk') {
      const dx = p.tx - p.x, dz = p.tz - p.z;
      if (Math.hypot(dx, dz) < 2) {
        const line = pick(Math.random, ROAD_LINES);
        if (Math.random() < 0.5) { p.tx = line + (Math.random() < 0.5 ? -7 : 7); p.tz = rand(Math.random, -200, 200); }
        else { p.tx = rand(Math.random, -200, 200); p.tz = line + (Math.random() < 0.5 ? -7 : 7); }
      }
      p.heading = Math.atan2(p.tx - p.x, p.tz - p.z);
    }
    const pp = { x: p.x, z: p.z };
    p.x += Math.sin(p.heading) * speed * dt;
    p.z += Math.cos(p.heading) * speed * dt;
    for (const b of G.city.colliders) pushOutCircle(pp, 0.5, b);
    p.x = pp.x; p.z = pp.z;
    p.walkPhase += dt * speed * 4;
    const swing = Math.sin(p.walkPhase) * 0.5;
    const u = p.mesh.userData;
    u.legL.rotation.x = swing; u.legR.rotation.x = -swing;
    u.armL.rotation.x = -swing * 0.7; u.armR.rotation.x = swing * 0.7;
    p.mesh.position.set(p.x, 0, p.z);
    p.mesh.rotation.y = p.heading;
  }
}

// A pedestrian goes down (punched or shot): falls over, then flees.
export function knockPed(G, ped) {
  if (ped.down) return;
  ped.down = true; ped.stateT = 5;
  ped.mesh.rotation.x = Math.PI / 2 - 0.1;
  ped.mesh.position.y = 0.25;
  setTimeout(() => { ped.mesh.rotation.x = 0; ped.mesh.position.y = 0; }, 5000);
}
