// city.js — builds Solara Bay: road grid, districts, buildings, beach,
// ocean, pier, props, and the collision + road data the sim uses.
import * as THREE from 'three';
import { makeRng, rand, randi, pick } from './util.js';
import {
  makeFacadeTextures, makeRoadTexture, makeSidewalkTexture, makeSandTexture,
  makeBillboardTextures, makeSkyTexture,
} from './textures.js';

export const ROAD_LINES = [-186, -124, -62, 0, 62, 124, 186];
export const CITY = { minX: -240, maxX: 240, minZ: -240, maxZ: 280 };
export const BEACH_Z = 225;   // sand starts here
export const OCEAN_Z = 258;   // water starts here

function box(w, h, d, mat, x, y, z, ry = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.rotation.y = ry;
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

export function buildCity(scene) {
  const rng = makeRng(1337);
  const colliders = [];
  const parkedSpots = [];
  const buildingMeshes = []; // every solid building mesh, for bullet raycasts
  const group = new THREE.Group();
  scene.add(group);

  // ---- sky, sun, fog, lights -------------------------------------------------
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(900, 24, 16),
    new THREE.MeshBasicMaterial({ map: makeSkyTexture(), side: THREE.BackSide, fog: false }),
  );
  group.add(sky);
  const sun = new THREE.Mesh(
    new THREE.CircleGeometry(46, 32),
    new THREE.MeshBasicMaterial({ color: 0xffdf8a, fog: false }),
  );
  sun.position.set(-420, 150, -780); sun.lookAt(0, 0, 0);
  group.add(sun);
  scene.fog = new THREE.Fog(0xd98a5f, 120, 620);
  const hemi = new THREE.HemisphereLight(0xffc890, 0x3a2f28, 0.85);
  scene.add(hemi);
  const sunLight = new THREE.DirectionalLight(0xffb36b, 2.2);
  sunLight.position.set(-180, 220, -140);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.camera.left = -90; sunLight.shadow.camera.right = 90;
  sunLight.shadow.camera.top = 90; sunLight.shadow.camera.bottom = -90;
  sunLight.shadow.camera.far = 700;
  sunLight.shadow.bias = -0.0004;
  scene.add(sunLight);
  scene.add(sunLight.target);
  // warm fill from the south-east so shadowed faces stay readable
  const fill = new THREE.DirectionalLight(0xffd9a0, 0.55);
  fill.position.set(200, 120, 200);
  scene.add(fill);

  // ---- ground: grass base, roads, sidewalks, sand, ocean --------------------
  const groundMat = new THREE.MeshLambertMaterial({ color: 0x6d7a4a });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1100, 1100), groundMat);
  ground.rotation.x = -Math.PI / 2; ground.position.set(0, -0.08, 20);
  ground.receiveShadow = true;
  group.add(ground);

  const roadTex = makeRoadTexture();
  const walkTex = makeSidewalkTexture();
  // road strips (along X and along Z) + sidewalk strips beside them
  for (const c of ROAD_LINES) {
    for (const [w, l, x, z, ry] of [
      [10, 480, c, 20, 0], [10, 560, 20, c, Math.PI / 2],
    ]) {
      const t = roadTex.clone(); t.needsUpdate = true;
      t.repeat.set(1, l / 14);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, l),
        new THREE.MeshLambertMaterial({ map: t }));
      m.rotation.x = -Math.PI / 2; m.rotation.z = ry;
      m.position.set(x, 0.02, z); m.receiveShadow = true;
      group.add(m);
    }
    for (const off of [-7, 7]) {
      const swt = walkTex.clone(); swt.needsUpdate = true; swt.repeat.set(1, 30);
      const sw = new THREE.Mesh(new THREE.PlaneGeometry(4, 480),
        new THREE.MeshLambertMaterial({ map: swt }));
      sw.rotation.x = -Math.PI / 2; sw.position.set(c + off, 0.04, 20);
      sw.receiveShadow = true; group.add(sw);
      const swt2 = walkTex.clone(); swt2.needsUpdate = true; swt2.repeat.set(1, 35);
      const sw2 = new THREE.Mesh(new THREE.PlaneGeometry(4, 560),
        new THREE.MeshLambertMaterial({ map: swt2 }));
      sw2.rotation.x = -Math.PI / 2; sw2.rotation.z = Math.PI / 2;
      sw2.position.set(20, 0.04, c + off); sw2.receiveShadow = true; group.add(sw2);
    }
  }
  // boardwalk + sand + ocean
  const boardMat = new THREE.MeshLambertMaterial({ color: 0x9c6b3f });
  const board = new THREE.Mesh(new THREE.PlaneGeometry(480, 26), boardMat);
  board.rotation.x = -Math.PI / 2; board.position.set(0, 0.06, 212);
  board.receiveShadow = true; group.add(board);
  const sandTex = makeSandTexture();
  sandTex.repeat.set(24, 2);
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(480, 40),
    new THREE.MeshLambertMaterial({ map: sandTex }));
  sand.rotation.x = -Math.PI / 2; sand.position.set(0, 0.03, 242);
  sand.receiveShadow = true; group.add(sand);
  const oceanMat = new THREE.MeshPhongMaterial({
    color: 0x1d6f9e, shininess: 120, specular: 0xffc890, transparent: true, opacity: 0.94,
  });
  const ocean = new THREE.Mesh(new THREE.PlaneGeometry(1000, 500), oceanMat);
  ocean.rotation.x = -Math.PI / 2; ocean.position.set(0, -0.5, 520);
  group.add(ocean);
  const foamMat = new THREE.MeshBasicMaterial({ color: 0xeaf6ff, transparent: true, opacity: 0.5 });
  const foam = new THREE.Mesh(new THREE.PlaneGeometry(480, 3), foamMat);
  foam.rotation.x = -Math.PI / 2; foam.position.set(0, 0.02, 259);
  group.add(foam);

  // ---- pier ------------------------------------------------------------------
  const pierMat = new THREE.MeshLambertMaterial({ color: 0x8a5f36 });
  const pier = box(16, 1, 80, pierMat, 0, 0.4, 300);
  pier.castShadow = false; group.add(pier);
  for (let z = 268; z <= 336; z += 17) {
    for (const x of [-7, 7]) {
      const post = box(1, 3, 1, pierMat, x, -0.6, z);
      post.castShadow = false; group.add(post);
    }
  }
  const pierEnd = box(30, 1, 16, pierMat, 0, 0.4, 344);
  pierEnd.castShadow = false; group.add(pierEnd);

  // ---- buildings -------------------------------------------------------------
  const facades = makeFacadeTextures();
  const billboards = makeBillboardTextures();
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x4a4038 });
  const blockCenters = [-155, -93, -31, 31, 93, 155];
  const bankBlock = { x: 31, z: -31 };
  let buildingCount = 0;
  for (const bx of blockCenters) {
    for (const bz of blockCenters) {
      const downtown = Math.abs(bx) < 130 && Math.abs(bz) < 130;
      const harbor = bx < -130;
      const port = bx > 130;
      const hills = bz < -130;
      const marina = bz > 130;
      const spots = [];
      if (downtown) {
        spots.push({ w: 30, d: 30, h: rand(rng, 26, 56), dx: 0, dz: 0 });
        spots.push({ w: 16, d: 20, h: rand(rng, 10, 18), dx: -14, dz: 12 });
      } else if (harbor || port) {
        spots.push({ w: 36, d: 20, h: rand(rng, 7, 10), dx: 0, dz: 0 });
        spots.push({ w: 14, d: 14, h: rand(rng, 5, 8), dx: 14, dz: 10 });
      } else if (hills) {
        spots.push({ w: 12, d: 10, h: rand(rng, 5, 7), dx: -8, dz: -6 });
        spots.push({ w: 10, d: 12, h: rand(rng, 5, 8), dx: 10, dz: 8 });
      } else if (marina) {
        spots.push({ w: 20, d: 14, h: rand(rng, 6, 10), dx: 0, dz: 0 });
        spots.push({ w: 12, d: 10, h: rand(rng, 5, 7), dx: -12, dz: 10 });
      } else {
        spots.push({ w: 22, d: 18, h: rand(rng, 8, 16), dx: 0, dz: 0 });
        spots.push({ w: 14, d: 12, h: rand(rng, 6, 10), dx: 12, dz: -10 });
      }
      for (const s of spots) {
        const x = bx + s.dx, z = bz + s.dz;
        const fi = randi(rng, 0, 3);
        const tex = facades[fi].clone(); tex.needsUpdate = true;
        tex.repeat.set(Math.max(1, Math.round(s.w / 14)), Math.max(1, Math.round(s.h / 14)));
        const mats = [0, 1, 2, 3, 4, 5].map((f) =>
          f === 2 ? roofMat : new THREE.MeshLambertMaterial({ map: tex }));
        const b = new THREE.Mesh(new THREE.BoxGeometry(s.w, s.h, s.d), mats);
        b.position.set(x, s.h / 2, z);
        b.castShadow = true; b.receiveShadow = true;
        b.userData.tag = 'building';
        group.add(b);
        buildingMeshes.push(b);
        colliders.push({ minX: x - s.w / 2, maxX: x + s.w / 2, minZ: z - s.d / 2, maxZ: z + s.d / 2 });
        buildingCount++;
        // billboard on some tall downtown faces
        if (downtown && s.h > 30 && rng() < 0.4) {
          const bb = new THREE.Mesh(
            new THREE.PlaneGeometry(16, 8),
            new THREE.MeshBasicMaterial({ map: pick(rng, billboards) }),
          );
          bb.position.set(x, s.h - 6, z + s.d / 2 + 0.15);
          group.add(bb);
        }
      }
    }
  }
  // bank gets the Solara Trust billboard, facing the street
  const bankSign = new THREE.Mesh(
    new THREE.PlaneGeometry(18, 9),
    new THREE.MeshBasicMaterial({ map: billboards[3] }),
  );
  bankSign.position.set(bankBlock.x, 12, bankBlock.z + 15.5);
  group.add(bankSign);

  // ---- palms, lamps -----------------------------------------------------------
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2a });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2f7a3d });
  function palm(x, z) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 7, 6), trunkMat);
    trunk.position.y = 3.5; trunk.castShadow = true; g.add(trunk);
    for (let i = 0; i < 6; i++) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(1.1, 3.4, 4), leafMat);
      const a = (i / 6) * Math.PI * 2;
      leaf.position.set(Math.cos(a) * 1.4, 7.2, Math.sin(a) * 1.4);
      leaf.rotation.z = Math.cos(a) * 0.9; leaf.rotation.x = -Math.sin(a) * 0.9;
      g.add(leaf);
    }
    g.position.set(x, 0, z);
    group.add(g);
  }
  for (let x = -220; x <= 220; x += 22) { palm(x, 205); if (rng() < 0.6) palm(x + 8, 232); }
  for (let i = 0; i < 26; i++) palm(rand(rng, -220, 220), rand(rng, 150, 200));
  const lampMat = new THREE.MeshLambertMaterial({ color: 0x2c2f36 });
  const lampHeadMat = new THREE.MeshBasicMaterial({ color: 0xffe6a8 });
  for (const rx of ROAD_LINES) {
    for (const rz of ROAD_LINES) {
      if (rng() < 0.5) continue;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 6, 6), lampMat);
      pole.position.set(rx + 8, 3, rz + 8); pole.castShadow = true;
      group.add(pole);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.25, 0.4), lampHeadMat);
      head.position.set(rx + 8, 6.1, rz + 8);
      group.add(head);
    }
  }

  // ---- hideout house on the boardwalk (distinct) ------------------------------
  const hideMat = new THREE.MeshLambertMaterial({ color: 0x3f6d8e });
  const hide = box(12, 5, 9, hideMat, -160, 2.5, 208);
  hide.userData.tag = 'building';
  buildingMeshes.push(hide);
  group.add(hide);
  colliders.push({ minX: -166, maxX: -154, minZ: 203.5, maxZ: 212.5 });

  // ---- world bounds + ocean wall ----------------------------------------------
  colliders.push({ minX: CITY.minX - 10, maxX: CITY.minX, minZ: CITY.minZ, maxZ: CITY.maxZ });
  colliders.push({ minX: CITY.maxX, maxX: CITY.maxX + 10, minZ: CITY.minZ, maxZ: CITY.maxZ });
  colliders.push({ minX: CITY.minX, maxX: CITY.maxX, minZ: CITY.minZ - 10, maxZ: CITY.minZ });
  // ocean wall, split around the pier (player can walk the pier to its end)
  colliders.push({ minX: CITY.minX, maxX: -8, minZ: OCEAN_Z - 2, maxZ: OCEAN_Z + 40 });
  colliders.push({ minX: 8, maxX: CITY.maxX, minZ: OCEAN_Z - 2, maxZ: OCEAN_Z + 40 });
  colliders.push({ minX: -15, maxX: 15, minZ: 344, maxZ: 352 });

  // ---- parked car spots --------------------------------------------------------
  for (let i = 0; i < 30; i++) {
    const vertical = rng() < 0.5;
    const line = pick(rng, ROAD_LINES);
    const along = rand(rng, -180, 180);
    const side = rng() < 0.5 ? -1 : 1;
    if (vertical) parkedSpots.push({ x: line + side * 5.6, z: along, heading: side > 0 ? Math.PI : 0 });
    else parkedSpots.push({ x: along, z: line + side * 5.6, heading: side > 0 ? Math.PI / 2 : -Math.PI / 2 });
  }

  const landmarks = {
    hideout: { x: -160, z: 196 },
    chopShop: { x: 170, z: -170 },
    bank: { x: 31, z: -8 }, // sidewalk in front of the Solara Trust tower
    hospital: { x: -155, z: -155 },
    pier: { x: 0, z: 300 },
    marina: { x: 0, z: 185 },
    playerSpawn: { x: -148, z: 196 },
  };

  return {
    group, colliders, parkedSpots, landmarks, buildingCount, buildingMeshes,
    sunLight, foam, ocean,
    update(dt, t) {
      foam.material.opacity = 0.35 + 0.18 * Math.sin(t * 1.4);
      ocean.position.y = -0.5 + 0.08 * Math.sin(t * 0.7);
    },
  };
}
