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
// The first step can hit. The old 15-frame wait matched a Flash clip whose
// speed stayed 0, but this port launches at full speed, so the wait let a
// flat shot pass through a crate.
export const ARM_FRAME = 1;
export const PIXELS_PER_FOOT = 30;

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

// Same rounding the aim bar uses, so a full bar and a fired shot both read 100%.
export function powerPercent(power) {
  return Math.round(((power - POWER_MIN) / (POWER_MAX - POWER_MIN)) * 100);
}

export function feetFromTravel(startX, x) {
  return Math.max(0, Math.round((x - startX) / PIXELS_PER_FOOT));
}

export function feetFromAltitude(y) {
  return Math.max(0, Math.round((y - GROUND_Y) / PIXELS_PER_FOOT));
}

// Rightward px/frame only. A climb, a dive, and a bounce back toward the
// cannon are not mph. One frame is 1/30 s and 30 px is one foot, so this
// number is already ft/s.
export function rightwardSpeed(vx) {
  return Math.max(0, vx);
}

export function mphFromSpeed(pxPerFrame) {
  return Math.max(0, Math.round((rightwardSpeed(pxPerFrame) * 3600) / 5280));
}

// Balloon chains used to climb without a ceiling and stall the step sampler.
export const SPEED_MAX_MPH = 256;
export const SPEED_MAX = (SPEED_MAX_MPH * 5280) / 3600;

export function atTerminalSpeed(vx) {
  return mphFromSpeed(vx) >= SPEED_MAX_MPH;
}

// Peak rightward speed that hits the 256 mph cap.
export function reachedTerminal(vx) {
  return atTerminalSpeed(vx);
}

export function formatSpeed(vx) {
  const label = `→ ${formatMph(mphFromSpeed(vx))}`;
  return atTerminalSpeed(vx) ? `${label} MAX` : label;
}

export function formatFt(n) {
  return `${Math.max(0, Math.round(n)).toLocaleString('en-US')} ft`;
}

export function formatMph(mph) {
  return `${Math.max(0, Math.round(mph)).toLocaleString('en-US')} mph`;
}

// This ride only. One frame is STEP seconds, so a pause does not add time.
export function flightSeconds(frame) {
  return Math.max(0, frame) * STEP;
}

// A short hop keeps a tenth of a second. A minute or more reads as a clock.
export function formatFlight(seconds) {
  const safe = Math.max(0, seconds);
  const tenths = Math.round(safe * 10) / 10;
  if (tenths < 60) return `${tenths.toFixed(1)} s`;
  const whole = Math.round(safe);
  const h = Math.floor(whole / 3600);
  const m = Math.floor((whole % 3600) / 60);
  const s = whole % 60;
  const ss = String(s).padStart(2, '0');
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${ss}`;
  return `${m}:${ss}`;
}
