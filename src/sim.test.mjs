import assert from 'node:assert/strict';
import { buildCourse, resetCourse } from './course.js';
import { createKitten, runUntilDone, step } from './physics.js';
import { HIT } from './propspec.js';
import {
  aimVector,
  barrelMuzzle,
  feetFromAltitude,
  feetFromTravel,
  formatMph,
  launchPoint,
  mphFromSpeed,
  powerPercent,
  POWER_MAX,
  POWER_MIN,
  GROUND_Y,
  PIXELS_PER_FOOT,
} from './tune.js';

function prop(type, x, y) {
  const spec = HIT[type];
  return {
    type,
    x,
    y: y ?? spec.cy,
    hw: spec.hw,
    hh: spec.hh,
    spent: false,
    ready: 0,
  };
}

function shot(angle, power, props, frames = 30 * 60) {
  resetCourse(props);
  return runUntilDone(angle, power, props, frames);
}

// Distance is feet. Height is feet above the grass. Speed is stored as
// px/frame, which is already ft/s, and shown as mph.
{
  assert.equal(feetFromAltitude(GROUND_Y + PIXELS_PER_FOOT), 1);
  assert.equal(feetFromAltitude(GROUND_Y - 20), 0);
  assert.equal(mphFromSpeed(30), 20);
  assert.equal(formatMph(20), '20 mph');
  assert.equal(mphFromSpeed(0), 0);
  assert.equal(powerPercent(POWER_MIN), 0);
  assert.equal(powerPercent(POWER_MAX), 100);
  assert.equal(powerPercent((POWER_MIN + POWER_MAX) / 2), 50);
}

// The aim vector is the only barrel direction. 0° is +X, 90° is +Y.
{
  const flat = aimVector(0);
  const up = aimVector(90);
  assert.ok(Math.abs(flat.x - 1) < 1e-9 && Math.abs(flat.y) < 1e-9);
  assert.ok(Math.abs(up.y - 1) < 1e-9 && Math.abs(up.x) < 1e-9);
  const muzzleUp = barrelMuzzle(90);
  const muzzleFlat = barrelMuzzle(0);
  assert.ok(muzzleUp.y > muzzleFlat.y + 50, 'a vertical barrel sits above a flat one');
  assert.ok(Math.abs(muzzleUp.x - muzzleFlat.x) > 50, 'a vertical barrel pulls the muzzle back');
}

// A lofted shot climbs, then the grass ends it, and distance is horizontal travel / 30.
{
  const k = createKitten(40, 30);
  const startY = k.y;
  let peak = k.y;
  let bounced = false;
  let guard = 0;
  while (!k.dead && guard < 800) {
    const event = step(k, []);
    if (k.y > peak) peak = k.y;
    if (event === 'bounce') bounced = true;
    guard += 1;
  }
  assert.equal(k.cause, 'landed');
  assert.ok(peak > startY + 40, 'the kitten should climb');
  assert.ok(bounced, 'a hard landing bounces before the soft one that ends it');
  assert.ok(k.x > k.startX + 200, 'flight carries forward');
  assert.equal(feetFromTravel(k.startX, k.x), Math.max(0, Math.round((k.x - k.startX) / 30)));
}

// Nothing on the field can touch the kitten during the 15-frame arming window.
{
  const k = createKitten(20, 36);
  const crate = prop('tnt', k.x, k.y);
  let hit = null;
  for (let i = 0; i < 14; i++) hit = step(k, [crate]) || hit;
  assert.equal(hit, null);
  assert.equal(crate.spent, false);
  assert.equal(k.dead, false);
}

// Boosts match the Flash formulas. Falling is vy < 0.
{
  const k = createKitten(10, 20);
  k.frame = 20;
  k.x = 100;
  k.y = 30;
  k.vx = 20;
  k.vy = -10;
  const crate = prop('tnt', 100, 30);
  assert.equal(step(k, [crate]), 'tnt');
  // Gravity ticks once before the overlap test, so the boost sees vy = -11.
  assert.equal(k.vy, 28 + 11);
  assert.equal(k.vx, 5 + 20 * 1.2);
  assert.equal(crate.spent, true);
}

{
  const k = createKitten(10, 20);
  k.frame = 20;
  k.x = 100;
  k.y = 80;
  k.vx = 20;
  k.vy = 12;
  const bomb = prop('balloon', 100, 80);
  assert.equal(step(k, [bomb]), 'balloon');
  assert.equal(k.vy, 28 + 11);
  assert.equal(k.vx, 7 + 20 * 1.2);
}

{
  const k = createKitten(10, 20);
  k.frame = 20;
  k.x = 100;
  k.y = 20;
  k.vx = 22;
  k.vy = -8;
  const bed = prop('trampoline', 100);
  assert.equal(step(k, [bed]), 'trampoline');
  assert.equal(k.vx, 22);
  assert.ok(Math.abs(k.vy - 9 * 1.4) < 1e-9);
  assert.equal(bed.spent, false);
}

{
  const k = createKitten(10, 20);
  k.frame = 20;
  k.x = 100;
  k.y = 20;
  k.vx = 22;
  k.vy = 8;
  const spikes = prop('spikes', 100);
  assert.equal(step(k, [spikes]), null);
  assert.equal(k.dead, false);
}

{
  const k = createKitten(10, 20);
  k.frame = 20;
  k.x = 100;
  k.y = 20;
  k.vx = 22;
  k.vy = -8;
  const spikes = prop('spikes', 100);
  assert.equal(step(k, [spikes]), 'spikes');
  assert.equal(k.cause, 'spikes');
  assert.equal(k.vx, 0);
}

{
  const k = createKitten(10, 20);
  k.frame = 20;
  k.x = 100;
  k.y = 42;
  k.vx = 10;
  k.vy = 4;
  const plant = prop('venus', 100);
  assert.equal(step(k, [plant]), 'venus');
  assert.equal(k.cause, 'venus');
}

// Tumble rate follows the flight. Horizontal speed stays flat on a clean arc,
// so a rate taken only from vx would not move. The top hangs. The dive whirls.
// A bomb kicks it faster still.
{
  const k = createKitten(32, POWER_MAX);
  let calm = Infinity;
  let dive = 0;
  while (!k.dead && k.frame < 80) {
    step(k, []);
    if (k.dead) break;
    if (Math.abs(k.vy) < 4 && k.y > 400) calm = Math.min(calm, Math.abs(k.turn));
    if (k.vy < -22) dive = Math.max(dive, Math.abs(k.turn));
  }
  assert.ok(dive > 0, 'the shot should be falling fast before the first landing');
  assert.ok(calm < dive * 0.45, `apex tumble ${calm.toFixed(2)} should be much slower than the dive ${dive.toFixed(2)}`);

  const bomb = createKitten(20, 40);
  bomb.frame = 20;
  bomb.x = 100;
  bomb.y = 80;
  bomb.vx = 30;
  bomb.vy = -4;
  bomb.turn = -3;
  const crate = prop('tnt', 100, 80);
  assert.equal(step(bomb, [crate]), 'tnt');
  assert.ok(Math.abs(bomb.turn) > 11, 'a crate should speed the tumble');
}

// A full bar flies on its own. A low bar is a short hop. The field still
// rewards the default aim when the bar is full. Balloons continue up through
// the high sky, so a steep lob can pop several and travel much farther.
{
  const course = buildCourse();
  assert.equal(buildCourse().length, course.length);
  assert.equal(buildCourse()[0].x, course[0].x);
  const aloft = course.filter((prop) => prop.type === 'balloon' && prop.y > 4000);
  const tops = course.filter((prop) => prop.type === 'balloon' && prop.y > 7000);
  assert.ok(aloft.length > 40, 'balloons should sit well above the low lane');
  assert.ok(tops.length > 10, 'balloons should reach the top of a high lob');

  const natural = shot(32, POWER_MAX, course);
  const lob = shot(70, POWER_MAX, course, 30 * 160);
  const weak = shot(32, POWER_MIN, course);
  assert.equal(feetFromTravel(natural.kitten.startX, natural.kitten.x), 1269);
  assert.equal(natural.kitten.cause, 'landed');
  assert.ok(natural.hits.includes('balloon') && natural.hits.includes('tnt'));
  assert.equal(feetFromTravel(lob.kitten.startX, lob.kitten.x), 5001);
  assert.equal(lob.kitten.cause, 'landed');
  assert.ok(lob.hits.includes('balloon'));
  assert.ok(feetFromTravel(weak.kitten.startX, weak.kitten.x) < 20);

  const launched = launchPoint(30);
  assert.ok(launched.y > 15, 'the muzzle clears the grass');

  // The learned opening is unchanged. Past 10,000 ft the lane keeps going.
  assert.equal(course.length, 1020);
  let sum = 0;
  for (let n = 0; n < course.length; n++) {
    const prop = course[n];
    sum = Math.imul(sum ^ Math.round(prop.x * 10 + prop.y), 0x9e3779b1);
  }
  assert.equal(sum >>> 0, 1409172261);

  const farX = launchPoint(32).x + 20000 * PIXELS_PER_FOOT;
  course.grow(farX);
  const past = course.filter((prop) => prop.x > launchPoint(32).x + 10000 * PIXELS_PER_FOOT);
  for (const type of ['balloon', 'tnt', 'trampoline', 'spikes', 'venus']) {
    assert.ok(past.some((prop) => prop.type === type), `${type} should continue past 10,000 ft`);
  }
  assert.ok(
    past.some((prop) => prop.type === 'balloon' && prop.y > 1000),
    'high balloons should continue past 10,000 ft'
  );

  const stepped = buildCourse();
  let cursor = launchPoint(32).x;
  while (cursor < farX) {
    cursor += 8000;
    stepped.grow(cursor);
  }
  assert.equal(stepped.length, course.length);
  assert.equal(stepped[stepped.length - 1].x, course[course.length - 1].x);
  assert.equal(stepped[stepped.length - 1].y, course[course.length - 1].y);

  function runNear(angle, power, props, frames) {
    resetCourse(props);
    const k = createKitten(angle, power);
    const hits = [];
    let guard = 0;
    while (!k.dead && guard < frames) {
      props.grow(k.x + 16000);
      const event = step(k, props.near(k.x, k.x + k.vx));
      if (event && event !== 'bounce' && event !== 'settle') hits.push(event);
      guard += 1;
    }
    return { kitten: k, hits };
  }

  const nearNatural = runNear(32, POWER_MAX, course, 30 * 60);
  const nearLob = runNear(70, POWER_MAX, course, 30 * 160);
  assert.equal(feetFromTravel(nearNatural.kitten.startX, nearNatural.kitten.x), 1269);
  assert.equal(feetFromTravel(nearLob.kitten.startX, nearLob.kitten.x), 5001);
}

console.log('physics ok');
