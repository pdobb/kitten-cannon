// Fixed-step flight from Kitten Cannon! v1.3 (Dan Fleming / BurstStudio, 2007).
//
// The Flash clip did this every enterFrame (about 30Hz):
//   xsp = power * cos(rot), ysp = power * sin(rot)   // rot is barrel angle
//   ysp += 1                                          // gravity, Flash +y is down
//   bounce 0.72 on a hard landing; a landing softer than 2px/frame ends the shot
//   TNT:     ysp = -28 - |ysp|, xsp = 5 + speed * 1.2, only while falling
//   balloon: ysp = -28 - |ysp|, xsp = 7 + speed * 1.2
//   trampoline: ysp = -ysp * 1.4 while falling, horizontal speed unchanged
//   spikes and the flytrap call setZeroes()
// Object hits count from the first step. A 15-frame wait let a flat shot
// pass through a crate that was already in front of the cannon.
//
// Here +y is up. Falling is vy < 0. Distances are still Flash pixels.

import {
  ARM_FRAME,
  BOUNCE,
  GRAVITY,
  GROUND_Y,
  SETTLE,
  aimVector,
  launchPoint,
} from './tune.js';

export function createKitten(angleDeg, power) {
  const p = launchPoint(angleDeg);
  const a = aimVector(angleDeg);
  return {
    x: p.x,
    y: p.y,
    startX: p.x,
    vx: a.x * power,
    vy: a.y * power,
    // Degrees. Nose is local +X. Positive rotation.z is nose-up; flight tumbles clockwise.
    spin: angleDeg,
    // Degrees per frame. Eases toward the motion, then kicks on a hit.
    turn: tumbleTarget(a.x * power, a.y * power),
    frame: 0,
    dead: false,
    cause: null,
  };
}

// Degrees per frame. A little roll comes from forward speed. Vertical speed
// is squared, so the top of the arc hangs and a steep climb or dive whirls.
function tumbleTarget(vx, vy) {
  return -(Math.abs(vx) * 0.045 + vy * vy * 0.012);
}

// Ground objects only connect when the kitten is on the way down, same as the
// Flash hit tests (`ysp > 0` with +y down). Balloons, flytraps, and TNT connect
// either way. The whole crate counts, not only a fall onto the lid.
function canHit(k, prop) {
  if (k.frame < ARM_FRAME || k.dead || prop.spent) return false;
  if (prop.ready && k.frame < prop.ready) return false;
  if (prop.type === 'balloon' || prop.type === 'venus' || prop.type === 'tnt') return true;
  return k.vy < 0;
}

// Nose, chest, belly, and paws. Local +X is the nose. spin matches the mesh:
// world = (lx cos - ly sin, lx sin + ly cos).
const TNT_POINTS = [
  [0, 0],
  [23, 1.2],
  [16, 1],
  [6, -1],
  [1, -8],
  [3, -13],
  [-2, -12],
];

function overlaps(k, prop) {
  const point = Math.abs(k.x - prop.x) < prop.hw && Math.abs(k.y - prop.y) < prop.hh;
  if (prop.type !== 'tnt') return point;
  // The body point keeps the padded box. Nose, chest, and paws use the painted
  // crate (x ±25, and y from 4 to 50 when the crate sits on cy 26).
  if (point) return true;
  const rad = (k.spin * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  for (let i = 1; i < TNT_POINTS.length; i++) {
    const lx = TNT_POINTS[i][0];
    const ly = TNT_POINTS[i][1];
    const x = k.x + lx * c - ly * s;
    const y = k.y + lx * s + ly * c;
    if (Math.abs(x - prop.x) < 25 && y > prop.y - 22 && y < prop.y + 24) return true;
  }
  return false;
}

function pickHit(k, props) {
  let best = null;
  let bestD = Infinity;
  for (let i = 0; i < props.length; i++) {
    const prop = props[i];
    // The nose sits well ahead of the body point, so a crate needs a longer reject.
    const reach = prop.type === 'tnt' ? 30 : 1;
    if (Math.abs(prop.x - k.x) > prop.hw + reach) continue;
    if (!canHit(k, prop) || !overlaps(k, prop)) continue;
    const d = Math.abs(k.x - prop.x) + Math.abs(k.y - prop.y);
    if (d < bestD) {
      best = prop;
      bestD = d;
    }
  }
  return best;
}

function land(k) {
  const falling = -k.vy;
  if (falling < SETTLE) {
    k.dead = true;
    k.vx = 0;
    k.vy = 0;
    k.turn = 0;
    k.cause = 'landed';
    return 'settle';
  }
  k.vx *= BOUNCE;
  k.vy = falling * BOUNCE;
  k.turn -= Math.min(14, falling * 0.35);
  return 'bounce';
}

export function resolveHit(k, prop) {
  if (prop.type === 'tnt') {
    k.vy = 28 + Math.abs(k.vy);
    k.vx = 5 + k.vx * 1.2;
    prop.spent = true;
    k.turn -= 11;
    return 'tnt';
  }
  if (prop.type === 'balloon') {
    k.vy = 28 + Math.abs(k.vy);
    k.vx = 7 + k.vx * 1.2;
    prop.spent = true;
    k.turn -= 13;
    return 'balloon';
  }
  if (prop.type === 'trampoline') {
    // One boing per pass. The Flash clip could retrigger every falling frame
    // while the kitten sat inside the bed; a few frames of cooldown keeps a
    // single landing as one hop.
    k.vy = -k.vy * 1.4;
    prop.ready = k.frame + 10;
    k.turn -= 8;
    return 'trampoline';
  }
  if (prop.type === 'spikes') {
    k.dead = true;
    k.vx = 0;
    k.vy = 0;
    k.turn = 0;
    k.cause = 'spikes';
    prop.spent = true;
    return 'spikes';
  }
  if (prop.type === 'venus') {
    k.dead = true;
    k.vx = 0;
    k.vy = 0;
    k.turn = 0;
    k.cause = 'venus';
    prop.spent = true;
    return 'venus';
  }
  return null;
}

// One 30Hz step. Long steps are sampled along the segment so a fast kitten
// cannot tunnel through a crate. Gravity is still applied once, like enterFrame.
export function step(k, props) {
  if (k.dead) return null;
  k.frame += 1;
  k.vy -= GRAVITY;
  const x0 = k.x;
  const y0 = k.y;
  const x1 = x0 + k.vx;
  const y1 = y0 + k.vy;
  // Horizontal speed barely changes on a clean arc, so a rate taken only
  // from vx looks constant. The rate eases toward tumbleTarget, and a hit
  // kicks it, so the sprite speeds up instead of snapping.
  const target = tumbleTarget(k.vx, k.vy);
  k.turn += (target - k.turn) * 0.25;
  k.spin += k.turn;

  // One sample per 10px, with no ceiling. Speeds under the old 480px step match
  // the capped sampler. Faster than that still walks the crate instead of skipping it.
  const samples = Math.max(1, Math.ceil(Math.hypot(k.vx, k.vy) / 10));
  for (let i = 1; i <= samples; i++) {
    const t = i / samples;
    k.x = x0 + (x1 - x0) * t;
    k.y = y0 + (y1 - y0) * t;
    const hit = pickHit(k, props);
    if (hit) return resolveHit(k, hit);
    if (k.y <= GROUND_Y && k.vy < 0) {
      k.y = GROUND_Y;
      return land(k);
    }
  }
  if (k.y < GROUND_Y) k.y = GROUND_Y;
  return null;
}

export function runUntilDone(angleDeg, power, props, maxFrames = 30 * 90) {
  const k = createKitten(angleDeg, power);
  const hits = [];
  let guard = 0;
  while (!k.dead && guard < maxFrames) {
    const event = step(k, props);
    if (event && event !== 'bounce' && event !== 'settle') hits.push(event);
    guard += 1;
  }
  return { kitten: k, hits, frames: guard };
}
