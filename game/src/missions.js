// missions.js — the four story jobs, the beacon marker, and the 10 hidden
// cash stashes scattered around Solara Bay.
import * as THREE from 'three';
import { spawnEnemy } from './combat.js';
import { addWanted } from './police.js';
import { groundHeightAt } from './city.js';

const MISSIONS = [
  { id: 'm1', title: 'Wheels Up', reward: 400,
    brief: 'Delores needs a car. Steal one and bring it to the Chop Shop.' },
  { id: 'm2', title: 'The Pickup', reward: 900,
    brief: 'Three packages are waiting around the Marina. Collect them all.' },
  { id: 'm3', title: 'Heat Wave', reward: 1200,
    brief: 'The cops are all over you. Lose the heat — no stars, no tail.' },
  { id: 'm4', title: 'The Marina Job', reward: 5000,
    brief: 'Solara Trust. The vault. Get in, get out, and don\'t get caught.' },
];
const PACKAGES = [
  { x: 31, z: 175 }, { x: -124, z: 155 }, { x: 93, z: 217 },
];
const STASHES = [
  { x: -160, z: 235 }, { x: 124, z: -186 }, { x: -186, z: -124 },
  { x: 62, z: -186 }, { x: 186, z: 62 }, { x: -62, z: 186 },
  { x: 0, z: 300 }, { x: -186, z: 62 }, { x: 124, z: 124 }, { x: -31, z: -217 },
];
const RANKS = ['Wheelman', 'Hustler', 'Outlaw', 'Street King', 'King of Solara'];

export function rankFor(done) { return RANKS[Math.min(done, 4)]; }

export function buildStashes(G) {
  G.stashMeshes = [];
  for (const s of STASHES) {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.4, 0.7),
      new THREE.MeshLambertMaterial({ color: 0xffd23e, emissive: 0x664400 }));
    // sit on the ground under the stash — on the pier that is the deck top
    m.position.set(s.x, groundHeightAt(s.x, s.z) + 0.5, s.z);
    G.three.scene.add(m);
    G.stashMeshes.push(m);
  }
}

function makeBeacon(G) {
  const group = new THREE.Group();
  const cyl = new THREE.Mesh(
    new THREE.CylinderGeometry(1.4, 1.4, 16, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.22,
      side: THREE.DoubleSide, depthWrite: false }));
  cyl.position.y = 8;
  const diamond = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.9),
    new THREE.MeshBasicMaterial({ color: 0xffd23e }));
  diamond.position.y = 4;
  group.add(cyl); group.add(diamond);
  group.userData.diamond = diamond;
  group.visible = false;
  G.three.scene.add(group);
  return group;
}

export function startMission(G, index) {
  const m = MISSIONS[index];
  G.mission = {
    index, stage: 0, target: null, text: '',
    collected: 0, vaultT: 0, nextT: 0, done: false,
  };
  if (index === 2) addWanted(G, 3, 'The heat is on');
  G.hud.showBanner(`MISSION — ${m.title}`, m.brief);
  G.audio.mission();
}

function completeMission(G) {
  const m = MISSIONS[G.mission.index];
  G.money += m.reward;
  G.missionsDone++;
  G.mission.done = true;
  G.mission.nextT = 3;
  G.mission.target = null;
  G.hud.showBanner('MISSION PASSED', `${m.title} — +$${m.reward}`);
  G.audio.coin();
  G.saveGame();
  if (G.missionsDone >= MISSIONS.length) {
    G.hud.showBanner('KING OF SOLARA', 'Every job done. The city is yours.');
  }
}

function advance(G, text) {
  G.mission.stage++;
  G.mission.text = text;
}

function playerPos(G) {
  return G.player.car ? G.player.car.mesh.position : G.player.pos;
}

export function updateMissions(G, dt) {
  // stashes are always collectable, mission or not
  const pp = G.player.car ? G.player.car.mesh.position : G.player.pos;
  for (let i = 0; i < STASHES.length; i++) {
    if (G.stashesFound[i]) continue;
    if (Math.hypot(pp.x - STASHES[i].x, pp.z - STASHES[i].z) < 2.5) {
      G.stashesFound[i] = true;
      G.stashMeshes[i].visible = false;
      G.money += 150;
      G.hudMessage('Hidden stash found — +$150', 'good');
      G.audio.coin();
      G.saveGame();
    }
  }
  const M = G.mission;
  // mission complete: wait, then start the next one
  if (M.done) {
    M.nextT -= dt;
    if (M.nextT <= 0 && G.missionsDone < MISSIONS.length) startMission(G, G.missionsDone);
    return;
  }
  if (M.index < 0) return; // no active mission
  const p = playerPos(G);
  const distTo = (t) => Math.hypot(p.x - t.x, p.z - t.z);

  if (M.index === 0) {
    if (M.stage === 0) {
      M.text = 'Steal a car — press E next to one';
      M.target = null;
      if (G.player.car) { advance(G, 'Take the car to the Chop Shop'); }
    } else {
      M.text = 'Take the car to the Chop Shop';
      M.target = G.city.landmarks.chopShop;
      if (G.player.car && distTo(M.target) < 9) completeMission(G);
    }
  } else if (M.index === 1) {
    if (M.stage === 0) {
      M.text = `Collect the packages (${M.collected}/3)`;
      const next = PACKAGES[M.collected];
      M.target = next;
      if (distTo(next) < 3.5) {
        M.collected++;
        G.audio.coin();
        G.hudMessage(`Package ${M.collected}/3 collected`, 'good');
        if (M.collected === 2) addWanted(G, 1, 'Suspicious pickup');
        if (M.collected >= 3) {
          advance(G, 'The drop went sour — get to the Hideout');
          spawnEnemy(G, next.x + 6, next.z + 4, 'thug');
          spawnEnemy(G, next.x - 6, next.z - 4, 'thug');
        }
      }
    } else {
      M.text = 'Get to the Hideout';
      M.target = G.city.landmarks.hideout;
      if (distTo(M.target) < 9) completeMission(G);
    }
  } else if (M.index === 2) {
    M.text = 'Lose the cops — get to zero stars';
    M.target = null;
    if (G.wanted === 0) completeMission(G);
  } else if (M.index === 3) {
    if (M.stage === 0) {
      M.text = 'Go to Solara Trust';
      M.target = G.city.landmarks.bank;
      if (distTo(M.target) < 9) {
        advance(G, 'Hold E at the vault door');
        spawnEnemy(G, 44, -10, 'guard');
        spawnEnemy(G, 18, -10, 'guard');
      }
    } else if (M.stage === 1) {
      M.text = 'Hold E at the vault door';
      const vault = { x: 31, z: -14 }; // sidewalk at the tower's south face
      M.target = vault;
      const near = distTo(vault) < 6 && !G.player.car;
      if (near && G.input.pressed('KeyE')) {
        M.vaultT += dt;
        if (Math.random() < 0.3) G.fx.sparks(vault.x, 1.5, vault.z, 2);
        if (M.vaultT >= 5) {
          G.money += 500; // vault cash, on top of the job payout
          advance(G, 'Run! Get to the Hideout — 4 stars!');
          addWanted(G, 4, 'Bank job!');
        }
      } else {
        // letting go of E drains the crack progress twice as fast as it
        // builds, so a half-hearted attempt does not linger near done.
        M.vaultT = Math.max(0, M.vaultT - dt * 2);
      }
    } else {
      M.text = 'Get to the Hideout — lose the heat there';
      M.target = G.city.landmarks.hideout;
      if (distTo(M.target) < 9) completeMission(G);
    }
  }
}

export function updateBeacon(G, dt) {
  if (!G.beacon) G.beacon = makeBeacon(G);
  const M = G.mission;
  let target = null;
  if (M.index === 0 && M.stage === 0 && !G.player.car) {
    // point at the nearest stealable car
    let best = null, bestD = 1e9;
    for (const c of G.cars) {
      if (c.driver === 'police') continue;
      const d = Math.hypot(c.x - G.player.pos.x, c.z - G.player.pos.z);
      if (d < bestD) { bestD = d; best = c; }
    }
    if (best) target = { x: best.x, z: best.z };
  } else if (M.target) {
    target = M.target;
  }
  if (!target) { G.beacon.visible = false; return; }
  G.beacon.visible = true;
  G.beacon.position.set(target.x, 0, target.z);
  const d = G.beacon.userData.diamond;
  d.position.y = 4 + Math.sin(G.time * 2.5) * 0.5;
  d.rotation.y += dt * 2;
}

export { MISSIONS, STASHES };
