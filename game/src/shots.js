// shots.js — staging for the four dossier screenshots. Each setup puts the
// game in a state that shows several systems at once, then the driver
// captures the frame. Only used with ?shot=<name>.
import { Car } from './vehicles.js';
import { spawnEnemy } from './combat.js';

function placePlayerInCar(G, kind, color, x, z, heading, speed) {
  const car = new Car(G.three.scene, kind, color, x, z, heading);
  car.driver = 'player';
  car.speed = speed;
  G.cars.push(car);
  G.player.car = car;
  G.player.mesh.visible = false;
  G.player.pos.set(x, 0, z);
  G.camera.yaw = heading + Math.PI;
  G.camera.pitch = 0.3;
  G.camera.dist = 11;
  G.camera.orbit = 0;
  return car;
}

function placePlayerOnFoot(G, x, z, heading) {
  G.player.pos.set(x, 0, z);
  G.player.heading = heading;
  G.player.mesh.position.copy(G.player.pos);
  G.player.mesh.rotation.y = heading;
  G.camera.yaw = heading + Math.PI;
  G.camera.pitch = 0.35;
  G.camera.dist = 8;
  G.camera.orbit = 0;
}

// The start-mission banner lingers for 4 game-seconds; headless runs slow,
// so hide it for every shot except the cover, where it is part of the frame.
function hideBanner(G) {
  G.hud.bannerT = 0.01;
}

export function stageShot(G, name) {
  G.mode = 'playing';
  G.hud.showScreen(null);
  if (name === '1-chase') {
    // cover: police chase, 3 stars, minimap, mission objective, city behind.
    // The chase camera looks forward, so the pursuit is staged AHEAD: a
    // roadblock closing in head-on, plus two units behind for the minimap.
    G.money = 2450;
    G.mission = { index: 2, stage: 0, target: null, text: 'Lose the cops — get to zero stars',
      collected: 0, vaultT: 0, nextT: 0, done: false };
    placePlayerInCar(G, 'coupe', 0xd8a020, -40, 62, Math.PI / 2, 22);
    G.wanted = 3;
    // the roadblock sits just ahead of the player's line, close enough to
    // read at capture: headless runs slow, so the player only closes a few
    // dozen metres between staging and the shutter.
    const ahead = [[25, 62, -Math.PI / 2], [40, 55, -Math.PI / 2], [15, 70, -Math.PI / 2]];
    for (const [x, z, h] of ahead) {
      const c = new Car(G.three.scene, 'police', 0xe8e8e8, x, z, h);
      c.driver = 'police'; c.speed = 20;
      G.cars.push(c);
      G.policeCars.push({ car: c, ramCooldown: 0 });
    }
    const behind = [[-70, 62, Math.PI / 2], [-95, 55, Math.PI / 2]];
    for (const [x, z, h] of behind) {
      const c = new Car(G.three.scene, 'police', 0xe8e8e8, x, z, h);
      c.driver = 'police'; c.speed = 30;
      G.cars.push(c);
      G.policeCars.push({ car: c, ramCooldown: 0 });
    }
    G.hud.showBanner('HEAT WAVE', 'Lose the cops — get to zero stars');
  } else if (name === '2-drive') {
    // golden-hour cruise down the Marina with traffic and the skyline
    G.money = 1200;
    G.mission = { index: 0, stage: 1, target: G.city.landmarks.chopShop,
      text: 'Take the car to the Chop Shop', collected: 0, vaultT: 0, nextT: 0, done: false };
    placePlayerInCar(G, 'sedan', 0x2e6db4, -124, 0, Math.PI / 2, 30);
    G.city.sunLight.position.set(-260, 60, 120); // low sun from the west
    hideBanner(G);
  } else if (name === '3-mission') {
    // on foot at the bank job: pistol out, guards, 2 stars, vault beacon.
    // Player stands on road z=0 facing north at the Solara Trust tower.
    G.money = 900;
    G.mission = { index: 3, stage: 1, target: { x: 31, z: -14 },
      text: 'Hold E at the vault door', collected: 0, vaultT: 2.1, nextT: 0, done: false };
    placePlayerOnFoot(G, 31, 4, Math.PI);
    G.player.weapon = 'pistol';
    G.wanted = 2;
    spawnEnemy(G, 44, -10, 'guard');
    spawnEnemy(G, 18, -10, 'guard');
    const c = new Car(G.three.scene, 'police', 0xe8e8e8, 62, -31, Math.PI);
    c.driver = 'police'; c.speed = 0;
    G.cars.push(c);
    G.policeCars.push({ car: c, ramCooldown: 0 });
    hideBanner(G);
  } else if (name === '4-city') {
    // the vista: pier planks in the foreground, then beach, boardwalk,
    // palms and the skyline — the whole world in one frame. The player
    // stands on the pier deck itself, facing north into the city.
    G.money = 400;
    G.mission = { index: -1, stage: 0, target: null, text: '',
      collected: 0, vaultT: 0, nextT: 0, done: false };
    placePlayerOnFoot(G, 0, 320, Math.PI); // on the pier deck, face north
    G.camera.pitch = 0.42;
    G.camera.dist = 12;
    hideBanner(G);
  }
  G.hud.update(0);
}
