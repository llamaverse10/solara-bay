// util.js — small math helpers and a seeded RNG. No dependencies.
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const TAU = Math.PI * 2;

// Shortest signed angle difference, in (-PI, PI].
export function angleDiff(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}
export function angleLerp(a, b, t) { return a + angleDiff(a, b) * t; }

// Deterministic RNG (mulberry32) so the city layout is identical every run.
export function makeRng(seed) {
  let s = seed >>> 0;
  return function () {
    s |= 0; s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const rand = (rng, a, b) => a + rng() * (b - a);
export const randi = (rng, a, b) => Math.floor(rand(rng, a, b + 1));
export const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
export const choice = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Circle (x, z, r) vs AABB {minX, maxX, minZ, maxZ}: push the circle out.
// Returns true when a push happened. Mutates p (a {x, z} object).
export function pushOutCircle(p, r, box) {
  const cx = clamp(p.x, box.minX, box.maxX);
  const cz = clamp(p.z, box.minZ, box.maxZ);
  const dx = p.x - cx, dz = p.z - cz;
  const d2 = dx * dx + dz * dz;
  if (d2 >= r * r) return false;
  if (d2 > 1e-8) {
    const d = Math.sqrt(d2);
    p.x = cx + (dx / d) * r;
    p.z = cz + (dz / d) * r;
  } else {
    // Centre inside the box: push out along the smallest penetration axis.
    const pl = p.x - box.minX, pr = box.maxX - p.x;
    const pn = p.z - box.minZ, pf = box.maxZ - p.z;
    const m = Math.min(pl, pr, pn, pf);
    if (m === pl) p.x = box.minX - r;
    else if (m === pr) p.x = box.maxX + r;
    else if (m === pn) p.z = box.minZ - r;
    else p.z = box.maxZ + r;
  }
  return true;
}

// Distance from point (x,z) to segment (ax,az)-(bx,bz).
export function distToSegment(x, z, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const len2 = dx * dx + dz * dz;
  let t = len2 === 0 ? 0 : ((x - ax) * dx + (z - az) * dz) / len2;
  t = clamp(t, 0, 1);
  const px = ax + t * dx, pz = az + t * dz;
  return Math.hypot(x - px, z - pz);
}

// Shared scratch objects so hot loops allocate nothing.
export const _v = { a: null, b: null };
