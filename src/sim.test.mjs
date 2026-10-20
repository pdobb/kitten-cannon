import assert from 'node:assert/strict';
import { buildCourse, resetCourse } from './course.js';
import { createKitten, resolveHit, runUntilDone, step } from './physics.js';
import { HIT } from './propspec.js';
import { skyRgb, spaceBlend, reachedMars, SPACE_FEET } from './sky.js';
import {
  aimVector,
  atTerminalSpeed,
  barrelMuzzle,
  feetFromAltitude,
  feetFromTravel,
  flightSeconds,
  formatFlight,
  formatMph,
  formatSpeed,
  launchPoint,
  mphFromSpeed,
  powerPercent,
  reachedFullPower,
  reachedTerminal,
  rightwardSpeed,
  POWER_MAX,
  POWER_MIN,
  SPEED_MAX,
  SPEED_MAX_MPH,
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

// Distance is feet. Height is feet above the grass. Mph is rightward
// px/frame, which is already ft/s. A dive and a bounce back are not speed.
{
  assert.equal(feetFromAltitude(GROUND_Y + PIXELS_PER_FOOT), 1);
  assert.equal(feetFromAltitude(GROUND_Y - 20), 0);
  assert.equal(rightwardSpeed(30), 30);
  assert.equal(rightwardSpeed(-30), 0);
  assert.equal(mphFromSpeed(30), 20);
  assert.equal(mphFromSpeed(-30), 0);
  assert.equal(formatMph(20), '20 mph');
  assert.equal(mphFromSpeed(SPEED_MAX), SPEED_MAX_MPH);
  assert.ok(atTerminalSpeed(SPEED_MAX));
  assert.equal(reachedTerminal(SPEED_MAX), true);
  assert.equal(reachedTerminal(SPEED_MAX * 0.5), false);
  assert.equal(formatSpeed(30), '→ 20 mph');
  assert.equal(formatSpeed(SPEED_MAX), `→ ${SPEED_MAX_MPH} mph MAX`);
  assert.equal(flightSeconds(0), 0);
  assert.equal(flightSeconds(30), 1);
  assert.equal(flightSeconds(90), 3);
  assert.equal(formatFlight(0), '0.0 s');
  assert.equal(formatFlight(flightSeconds(45)), '1.5 s');
  assert.equal(formatFlight(4.16), '4.2 s');
  assert.equal(formatFlight(59.94), '59.9 s');
  assert.equal(formatFlight(59.96), '1:00');
  assert.equal(formatFlight(90), '1:30');
  assert.equal(formatFlight(61.4), '1:01');
  assert.equal(formatFlight(3661), '1:01:01');
  assert.equal(mphFromSpeed(0), 0);
  // 240 px/frame used to be the ceiling, and it read as 164 mph. Past that still counts.
  assert.equal(mphFromSpeed(240), 164);
  assert.equal(mphFromSpeed(480), 327);
  assert.equal(powerPercent(POWER_MIN), 0);
  assert.equal(powerPercent(POWER_MAX), 100);
  assert.equal(powerPercent((POWER_MIN + POWER_MAX) / 2), 50);
  assert.equal(reachedFullPower(POWER_MAX), true);
  assert.equal(reachedFullPower(POWER_MIN), false);
  assert.equal(reachedFullPower((POWER_MIN + POWER_MAX) / 2), false);
}

// Daytime colors stay put. Above 1000 ft the sample is night, and it stays night.
{
  assert.deepEqual(skyRgb(0), [186, 220, 150]);
  assert.deepEqual(skyRgb(120), [165, 216, 242]);
  assert.deepEqual(skyRgb(8000), [46, 122, 196]);
  assert.equal(spaceBlend(100), 0);
  assert.equal(spaceBlend(860), 0);
  assert.equal(spaceBlend(930), 0.5);
  assert.equal(spaceBlend(SPACE_FEET), 1);
  assert.equal(spaceBlend(2000), 1);
  const night = skyRgb(GROUND_Y + SPACE_FEET * PIXELS_PER_FOOT);
  assert.deepEqual(night, [5, 7, 18]);
  assert.deepEqual(skyRgb(GROUND_Y + 4000 * PIXELS_PER_FOOT), night);
  assert.equal(reachedMars(999), false);
  assert.equal(reachedMars(SPACE_FEET), true);
  assert.equal(reachedMars(2000), true);
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

// A flat shot used to pass through a crate in front of the cannon. Hits waited
// 15 frames, and by then the kitten had already gone past the box.
{
  const k = createKitten(0, 62);
  const crate = prop('tnt', 860);
  let event = null;
  while (!k.dead && !crate.spent && k.frame < 30) event = step(k, [crate]);
  assert.equal(event, 'tnt');
  assert.equal(crate.spent, true);
  assert.ok(k.frame < 15, `the crate should go off before the old wait, frame ${k.frame}`);
  assert.ok(k.x < crate.x + 25, `the kitten should still be on the crate, x=${k.x}`);
}

// A long balloon chain stops at 256 mph instead of climbing without a ceiling.
{
  const k = createKitten(0, POWER_MAX);
  k.frame = 20;
  k.y = 200;
  for (let i = 0; i < 30; i++) {
    resolveHit(k, prop('balloon', k.x, 200));
  }
  assert.ok(k.vx <= SPEED_MAX + 1e-9, `vx ${k.vx} should stay at or under the cap`);
  assert.equal(mphFromSpeed(k.vx), SPEED_MAX_MPH);
  assert.ok(atTerminalSpeed(k.vx));
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

// A crate can push past the old 240 px/frame ceiling, and a fast step still
// hits the wood. Speed then stops at the 256 mph cap.
{
  const k = createKitten(10, 20);
  k.frame = 20;
  k.x = 100;
  k.y = 30;
  k.vx = 200;
  k.vy = -10;
  const crate = prop('tnt', 100, 30);
  assert.equal(step(k, [crate]), 'tnt');
  assert.equal(k.vx, 5 + 200 * 1.2);
  assert.ok(k.vx > 240);

  const fast = createKitten(10, 20);
  fast.frame = 20;
  fast.x = 40;
  fast.y = 26;
  fast.vx = 2000;
  fast.vy = 1;
  const far = prop('tnt', 100);
  assert.equal(step(fast, [far]), 'tnt');
  assert.equal(fast.vx, SPEED_MAX);
  assert.ok(atTerminalSpeed(fast.vx));
}

// The nose on the side of the crate counts, even while the kitten is climbing.
// The body point itself stays outside the painted box.
{
  const k = createKitten(10, 20);
  k.frame = 20;
  k.spin = 0;
  k.x = 60;
  k.y = 27;
  k.vx = 0;
  k.vy = 6;
  const crate = prop('tnt', 100);
  assert.ok(Math.abs(k.x - crate.x) > crate.hw);
  assert.equal(step(k, [crate]), 'tnt');
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

// Mph is the launch's rightward speed on a clean lob. The dive is a faster
// cat, and that fall does not count.
{
  const k = createKitten(70, POWER_MAX);
  const launch = rightwardSpeed(k.vx);
  let cat = 0;
  let guard = 0;
  while (!k.dead && guard < 80) {
    step(k, []);
    guard += 1;
    if (k.dead) break;
    cat = Math.max(cat, Math.hypot(k.vx, k.vy));
    assert.ok(Math.abs(rightwardSpeed(k.vx) - launch) < 1e-6);
  }
  assert.ok(cat > launch + 20, `dive ${cat.toFixed(1)} should outrun rightward ${launch.toFixed(1)}`);
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

// A full bar flies on its own. A low bar is a short hop. A full-power 32°
// shot catches crates with its nose and ends in a flytrap. A 70° lob pops
// balloons, then the wider tar catches the descent.
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
  assert.equal(feetFromTravel(natural.kitten.startX, natural.kitten.x), 2348);
  assert.equal(natural.kitten.cause, 'venus');
  assert.ok(natural.hits.includes('balloon') && natural.hits.includes('tnt'));
  assert.equal(feetFromTravel(lob.kitten.startX, lob.kitten.x), 2203);
  assert.equal(lob.kitten.cause, 'spikes');
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
  assert.equal(feetFromTravel(nearNatural.kitten.startX, nearNatural.kitten.x), 2348);
  assert.equal(nearNatural.kitten.cause, 'venus');
  assert.equal(feetFromTravel(nearLob.kitten.startX, nearLob.kitten.x), 2203);
  assert.equal(nearLob.kitten.cause, 'spikes');
}

// Two extra high lanes about triple the balloons. The learned course ignores it.
{
  assert.equal(buildCourse(0x20070321, 3).length, 1020);
  for (const seed of [1, 2, 9]) {
    const plain = buildCourse(seed);
    const thick = buildCourse(seed, 3);
    const plainBalloons = plain.filter((prop) => prop.type === 'balloon').length;
    const thickBalloons = thick.filter((prop) => prop.type === 'balloon').length;
    const ratio = thickBalloons / plainBalloons;
    assert.ok(ratio > 2.4 && ratio < 3.6, `seed ${seed} lane ${thickBalloons} vs ${plainBalloons}`);
  }
}

console.log('physics ok');
