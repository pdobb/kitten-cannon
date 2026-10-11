// Shared numbers for the Kitten Cannon tribute.
//
// Flight is a direct port of the v1.3 (2007) kitty enterFrame:
//   g = 1, bounce = 0.72, ysp += g, stop when a landing is softer than 2px/frame,
//   score = round(horizontal pixels / 30) feet.
// Flash +y points down. This game is y-up, so gravity and vertical speed flip sign.
// One aim vector feeds the muzzle, the launch velocity, and the kitten's nose.

export const STEP = 1 / 30;
export const GRAVITY = 1;
export const BOUNCE = 0.72;
export const SETTLE = 2;
export const ARM_FRAME = 15;
export const PIXELS_PER_FOOT = 30;
export const MAX_SPEED = 240;

// Kitten body-center height when it is sitting on the grass.
export const GROUND_Y = 15;

export const CANNON_X = 70;
export const PIVOT_X = 12;
export const PIVOT_Y = 44;
export const BARREL_LEN = 96;
// How far past the muzzle lip the body center sits when the shot begins.
export const LAUNCH_CLEAR = 8;

// The bar is the cannon. A low tick is a short hop; a full bar clears
// a few hundred feet before any bomb gets involved.
export const POWER_MIN = 10;
export const POWER_MAX = 64;
export const POWER_PERIOD = 1.6;
export const ANGLE_MIN = 0;
export const ANGLE_MAX = 80;
export const DEFAULT_ANGLE = 32;

// rotation.z = +θ sends local +X to (cos θ, sin θ). θ = 90° → straight up.
export function aimVector(angleDeg) {
  const r = (angleDeg * Math.PI) / 180;
  return { x: Math.cos(r), y: Math.sin(r) };
}

export function barrelMuzzle(angleDeg) {
  const a = aimVector(angleDeg);
  return {
    x: CANNON_X + PIVOT_X + a.x * BARREL_LEN,
    y: PIVOT_Y + a.y * BARREL_LEN,
  };
}

export function launchPoint(angleDeg) {
  const a = aimVector(angleDeg);
  const m = barrelMuzzle(angleDeg);
  return { x: m.x + a.x * LAUNCH_CLEAR, y: m.y + a.y * LAUNCH_CLEAR };
}

// Pulled back into the barrel so the face peeks out of the muzzle before the shot.
export function peekPoint(angleDeg) {
  const a = aimVector(angleDeg);
  const m = barrelMuzzle(angleDeg);
  return { x: m.x + a.x * 10, y: m.y + a.y * 10 };
}

export function powerFromClock(seconds) {
  const u = (seconds % POWER_PERIOD) / POWER_PERIOD;
  const tri = u < 0.5 ? u * 2 : (1 - u) * 2;
  return POWER_MIN + (POWER_MAX - POWER_MIN) * tri;
}

export function feetFromTravel(startX, x) {
  return Math.max(0, Math.round((x - startX) / PIXELS_PER_FOOT));
}

export function feetFromAltitude(y) {
  return Math.max(0, Math.round((y - GROUND_Y) / PIXELS_PER_FOOT));
}

// One frame is 1/30 s and 30 px is one foot, so px/frame is already ft/s.
export function mphFromSpeed(pxPerFrame) {
  return Math.max(0, Math.round((pxPerFrame * 3600) / 5280));
}

export function formatFt(n) {
  return `${Math.max(0, Math.round(n)).toLocaleString('en-US')} ft`;
}

export function formatMph(mph) {
  return `${Math.max(0, Math.round(mph)).toLocaleString('en-US')} mph`;
}
