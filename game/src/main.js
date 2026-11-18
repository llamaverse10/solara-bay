// main.js — SOLARA BAY boot, the fixed-step game loop, and all the wiring
// between the modules. One clear job: start the game and run it.
import * as THREE from 'three';
import { buildCity } from './city.js';
import { createInput } from './input.js';
import { AudioSys } from './audio.js';
import { Effects } from './effects.js';
import { loadSave, writeSave } from './save.js';
import { createPlayerMesh, updatePlayer, updateCamera } from './player.js';
import { Car, COLORS, drivePlayerCar, nearestCar, enterCar, exitCar } from './vehicles.js';
import { spawnTraffic, updateTraffic } from './traffic.js';
import { addWanted, updatePolice, clearPolice } from './police.js';
import { tryShoot, reloadWeapon, punch, updateEnemies } from './combat.js';
import { buildStashes, startMission, updateMissions, updateBeacon } from './missions.js';
import { HUD } from './hud.js';
import { stageShot } from './shots.js';
import { pick, rand } from './util.js';

// surface page errors for the headless screenshot driver
window.__solaraErrors = [];
window.addEventListener('error', (e) => window.__solaraErrors.push(String(e.message)));
window.addEventListener('unhandledrejection', (e) => window.__solaraErrors.push('rejection: ' + String(e.reason)));

const G = {
  time: 0, mode: 'menu',
  money: 0, wanted: 0, wantedTimer: 0, sirenT: 0,
  missionsDone: 0, busted: 0, wasted: 0,
  stashesFound: new Array(10).fill(false),
  cars: [], policeCars: [], cops: [], traffic: [], peds: [], enemies: [],
  lastShot: null, sunOverride: null, beacon: null,
  mission: { index: -1, stage: 0, target: null, text: '',
    collected: 0, vaultT: 0, nextT: 0, done: false },
  player: null, camera: { yaw: Math.PI, pitch: 0.35, dist: 8, orbit: 0 },
  three: null, city: null, input: null, audio: null, fx: null, hud: null,
};
window.__G = G;

// ---------- three.js --------------------------------------------------------
const canvas = document.getElementById('game');
const params = new URLSearchParams(window.location.search);
const lowfx = params.has('lowfx');
const isShotMode = params.has('shot'); // headless capture: run more sim steps per frame
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !lowfx });
renderer.setPixelRatio(lowfx ? 1 : Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = !lowfx;
renderer.shadowMap.type = THREE.PCFShadowMap;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87b5d6);
scene.fog = new THREE.Fog(0x9fc3d8, 220, 560);
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
G.three = { scene, camera, renderer };
G.city = buildCity(scene);
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- systems ----------------------------------------------------------
G.input = createInput(canvas);
G.audio = new AudioSys();
G.fx = new Effects(scene);
const saved = loadSave();
if (saved) {
  G.money = saved.money || 0;
  G.missionsDone = Array.isArray(saved.missionsDone) ? saved.missionsDone.length : 0;
  G.busted = saved.busted || 0;
  G.wasted = saved.wasted || 0;
  if (Array.isArray(saved.stashes) && saved.stashes.length === 10) G.stashesFound = saved.stashes;
}
G.saveGame = () => writeSave({
  ...G,
  missionsDone: Array.from({ length: G.missionsDone }, (_, i) => i),
  rankIndex: G.missionsDone,
});

// ---------- player ------------------------------------------------------------
const spawn = G.city.landmarks.playerSpawn;
const pmesh = createPlayerMesh();
scene.add(pmesh);
G.player = {
  pos: new THREE.Vector3(spawn.x, 0, spawn.z), vx: 0, vz: 0, vy: 0,
  heading: Math.PI, walkPhase: 0, onGround: true, health: 100,
  weapon: 'pistol', magAmmo: 12, lastShotT: -9, lastHurt: -99,
  car: null, mesh: pmesh,
};
pmesh.position.copy(G.player.pos);

// ---------- parked cars --------------------------------------------------------
for (let i = 0; i < Math.min(9, G.city.parkedSpots.length); i++) {
  const s = G.city.parkedSpots[i];
  const kind = pick(Math.random, ['sedan', 'sedan', 'coupe', 'taxi', 'van', 'pickup']);
  const car = new Car(scene, kind, pick(Math.random, COLORS), s.x, s.z, s.heading);
  car.driver = 'none';
  G.cars.push(car);
}
spawnTraffic(G);
buildStashes(G);
for (let i = 0; i < G.stashesFound.length; i++) {
  if (G.stashesFound[i] && G.stashMeshes[i]) G.stashMeshes[i].visible = false;
}

G.hud = new HUD(G);
G.hudMessage = (t, k) => G.hud.showMessage(t, k);
G.nearestCopDist = () => {
  let d = Infinity;
  const px = G.player.car ? G.player.car.x : G.player.pos.x;
  const pz = G.player.car ? G.player.car.z : G.player.pos.z;
  for (const u of G.policeCars) d = Math.min(d, Math.hypot(u.car.x - px, u.car.z - pz));
  for (const c of G.cops) d = Math.min(d, Math.hypot(c.x - px, c.z - pz));
  return d;
};

// ---------- interactions --------------------------------------------------------
function interact() {
  const p = G.player;
  if (p.car) { exitCar(G); return; }
  const car = nearestCar(G, p.pos.x, p.pos.z, 3.5);
  if (!car) return;
  if (car.driver === 'traffic') {
    const t = G.traffic.find((x) => x.car === car);
    if (t) G.traffic.splice(G.traffic.indexOf(t), 1);
    G.hudMessage('You jacked the car! The driver ran off.', '');
  }
  enterCar(G, car);
  if (G.nearestCopDist() < 50) addWanted(G, 1, 'Grand theft auto');
}

function startPlaying() {
  G.audio.ensure();
  G.mode = 'playing';
  G.hud.showScreen(null);
  if (G.missionsDone < 4 && G.mission.index === -1) startMission(G, G.missionsDone);
}

document.getElementById('play-btn').addEventListener('click', startPlaying);
document.getElementById('resume-btn').addEventListener('click', () => {
  G.mode = 'playing';
  G.hud.showScreen(null);
});
document.getElementById('end-btn').addEventListener('click', () => {
  const p = G.player;
  p.health = 100;
  if (G.mode === 'busted') {
    const h = G.city.landmarks.hideout;
    p.pos.set(h.x + 8, 0, h.z);
    p.mesh.position.copy(p.pos);
  }
  G.mode = 'playing';
  G.hud.showScreen(null);
});
document.getElementById('restart-btn').addEventListener('click', () => {
  G.mode = 'playing';
  G.hud.showScreen(null);
});

// ---------- per-frame keys -------------------------------------------------------
function handleKeys() {
  const input = G.input;
  if (input.takePressed('KeyE')) interact();
  if (input.takePressed('KeyF')) punch(G);
  if (input.takePressed('KeyR')) reloadWeapon(G);
  if (input.takePressed('Digit1')) { G.player.weapon = 'fists'; G.audio.click(); }
  if (input.takePressed('Digit2')) { G.player.weapon = 'pistol'; G.audio.click(); }
  if (input.takePressed('KeyP') || input.takePressed('Escape')) {
    if (G.mode === 'playing') {
      G.mode = 'paused';
      G.hud.showScreen('pause');
    } else if (G.mode === 'paused') {
      G.mode = 'playing';
      G.hud.showScreen(null);
    }
  }
  if (input.takePressed('KeyM')) G.audio.muted = !G.audio.muted;
}

// ---------- main loop -------------------------------------------------------------
let last = performance.now();
let acc = 0;
const STEP = 1 / 60;
let menuAngle = 0;

function step(dt) {
  G.time += dt;
  G.city.update(dt, G.time);
  if (G.sunOverride) G.city.sunLight.position.set(
    G.sunOverride[0], G.sunOverride[1], G.sunOverride[2]);
  if (G.mode === 'playing') {
    handleKeys();
    updatePlayer(G, dt);
    if (G.player.car) {
      const car = G.player.car;
      drivePlayerCar(G, car, dt);
      G.audio.engine(Math.abs(car.speed) / car.spec.max, true);
      if (car.disabled) G.audio.engine(0, false);
    } else {
      G.audio.engine(0, false);
    }
    updateTraffic(G, dt);
    updatePolice(G, dt);
    updateEnemies(G, dt);
    updateMissions(G, dt);
    updateBeacon(G, dt);
    updateCamera(G, dt);
  } else if (G.mode === 'menu') {
    menuAngle += dt * 0.02;
    camera.position.set(Math.sin(menuAngle) * 250, 110, Math.cos(menuAngle) * 250);
    camera.lookAt(0, 10, 0);
  }
  G.fx.update(dt);
  if (G.mode !== 'menu') G.hud.update(dt);
}

function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.25) dt = 0.25; // tab was hidden: never simulate more than a quarter second
  acc += dt;
  let n = 0;
  // Headless screenshot mode runs the sim 12 steps a frame (slow GPU); the
  // live game caps at 3 so a slow frame never spirals into a death loop.
  const maxSteps = isShotMode ? 12 : 3;
  while (acc >= STEP && n < maxSteps) { step(STEP); acc -= STEP; n++; }
  renderer.render(scene, camera);
  if (!window.__solaraReady) window.__solaraReady = true;
}
requestAnimationFrame(frame);

// mouse: click to shoot (on foot, pistol out)
canvas.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return;
  if (G.mode === 'playing' && !G.player.car && G.player.weapon === 'pistol') tryShoot(G);
});

// ---------- ?shot= staging / autostart --------------------------------------------
const shot = params.get('shot');
if (shot) {
  G.audio.muted = true; // silent, deterministic captures
  startPlaying();
  stageShot(G, shot);
  if (shot === '2-drive') G.sunOverride = [-260, 60, 120];
} else if (params.get('autostart')) {
  startPlaying();
}
