// Pterodactyl snatch — same beast as Flit (Gabe-Torres/flit).
// Paces in from behind, grabs without freezing the shot, carries 1–5 s
// on a swoop arc, then ejects the kitten with a rightward boost (never a
// slowdown unless already at terminal).

import { Container, Graphics } from 'pixi.js';
import { FLYBY_EVERY_FT, FLYBY_Y } from './flyby.js';
import { atTerminalSpeed, SPEED_MAX, speedFromMph } from './tune.js';

// Same band gate as flybys; high enough that most long climbs still meet one.
export const SNATCH_CHANCE = 0.22;
export const SNATCH_APPROACH = 1.15;
export const SNATCH_CARRY_MIN = 1;
export const SNATCH_CARRY_MAX = 5;
// Eject adds this much mph on top of the carry speed (clamped at terminal).
export const SNATCH_BOOST_MPH_MIN = 30;
export const SNATCH_BOOST_MPH_MAX = 55;

// Body → kitten hang point. Local +X is beak-forward, +Y up.
const TALON_X = -6;
const TALON_Y = -36;

const INK = 0x2b2118;
const OUT = { width: 2.6, color: 0x6a3d16, join: 'round', cap: 'round' };

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

export function rollCarryDuration(rand = Math.random) {
  return SNATCH_CARRY_MIN + rand() * (SNATCH_CARRY_MAX - SNATCH_CARRY_MIN);
}

// Random up (+) or down (−) arc height in world px.
export function rollSwoop(rand = Math.random) {
  const amp = 90 + rand() * 110;
  return rand() < 0.5 ? amp : -amp;
}

// Flit drawPterodactyl, mirrored to face +X and flipped for y-up.
function drawPterodactyl(g, flap, grabbed) {
  g.clear();
  const lift = flap * 36;
  // Trailing wing (behind, −X).
  g.poly([-12, 8, -92, 58 + lift * 0.8, -118, 6 + lift * 0.15, -28, -10], true)
    .fill(0x8a4b2a)
    .stroke(OUT);
  // Leading wing (beak side, +X).
  g.poly([10, 10, 86, 70 - lift, 128, 2 - lift * 0.12, 18, -12], true)
    .fill(0xb56538)
    .stroke(OUT);
  g.moveTo(8, 8)
    .lineTo(84, 60 - lift)
    .stroke({ width: 5, color: 0x6b3a22, cap: 'round' });
  g.circle(84, 60 - lift, 3.4).fill(0xf2c14b);
  g.ellipse(-2, -2, 32, 14).fill(0xd4843f).stroke(OUT);
  g.ellipse(-8, -8, 17, 7).fill(0xf6d7a2);
  g.poly([-26, 2, -50, 14, -44, -10], true).fill(0xc47a3a).stroke(OUT);
  // Neck and head.
  g.moveTo(20, 2)
    .quadraticCurveTo(36, 18, 48, 8)
    .stroke({ width: 10, color: 0x6a3d16, cap: 'round' });
  g.moveTo(20, 2)
    .quadraticCurveTo(36, 18, 48, 8)
    .stroke({ width: 6, color: 0xd4843f, cap: 'round' });
  g.circle(50, 10, 10).fill(0xd4843f).stroke(OUT);
  // Crest.
  g.poly([48, 16, 32, 42, 38, 10], true).fill(0xe15a42).stroke(OUT);
  // Beak.
  g.poly([56, 12, 96, 4, 56, 2], true).fill(0xf2c14b).stroke(OUT);
  g.poly([56, 1, 84, -4, 56, -6], true).fill(0xe7a23a).stroke(OUT);
  g.circle(52, 13, 3.2).fill(0xfffdf6).stroke({ width: 1.6, color: 0x6a3d16 });
  g.circle(53.2, 13, 1.5).fill(INK);
  const footY = grabbed ? -34 : -20;
  g.moveTo(8, -12)
    .lineTo(12, footY)
    .stroke({ width: 3.4, color: 0x6b3a22, cap: 'round' });
  g.moveTo(-10, -12)
    .lineTo(-6, footY - 2)
    .stroke({ width: 3.4, color: 0x6b3a22, cap: 'round' });
  const claws = (x, y) => {
    g.moveTo(x, y)
      .lineTo(x + 11, y - 8)
      .stroke({ width: 2.7, color: 0x4a2a14, cap: 'round' });
    g.moveTo(x, y)
      .lineTo(x - 1, y - 10)
      .stroke({ width: 2.7, color: 0x4a2a14, cap: 'round' });
    g.moveTo(x, y)
      .lineTo(x - 10, y - 5)
      .stroke({ width: 2.7, color: 0x4a2a14, cap: 'round' });
  };
  claws(12, footY);
  claws(-6, footY - 2);
}

// Pure pose for tests and drawing. `kitten` is the live flight body during
// approach; `carry` is { x0, y0, vx, vy, duration, swoop } once latched.
export function snatchPose(time, kitten, entryX, entryY, carry = null) {
  const wing = Math.sin(time * 26);
  const grabX = kitten.x - TALON_X;
  const grabY = kitten.y - TALON_Y;
  if (time < SNATCH_APPROACH) {
    const u = time / SNATCH_APPROACH;
    const ease = u * u * (3 - 2 * u);
    // Close on the moving kitten from behind/above — flight keeps running.
    const dinoX = entryX + (grabX - entryX) * ease;
    const dinoY = entryY + (grabY - entryY) * ease
      + Math.sin(u * Math.PI) * 55;
    return {
      kittenX: kitten.x,
      kittenY: kitten.y,
      dinoX,
      dinoY,
      grabbed: false,
      wing,
      pitch: Math.sin(time * 3) * 0.08,
    };
  }
  const origin = carry || {
    x0: kitten.x,
    y0: kitten.y,
    vx: 0,
    vy: 0,
    duration: SNATCH_CARRY_MAX,
    swoop: 0,
  };
  const dur = Math.max(SNATCH_CARRY_MIN, origin.duration || SNATCH_CARRY_MAX);
  const u = clamp((time - SNATCH_APPROACH) / dur, 0, 1);
  // Carry advances at cruise px/frame × 30 Hz so distance keeps ticking.
  const frames = u * dur * 30;
  const arc = (origin.swoop || 0) * Math.sin(u * Math.PI);
  const kittenX = origin.x0 + origin.vx * frames;
  const kittenY = origin.y0 + origin.vy * frames + arc;
  // Tip the beak with the climb/dive of the arc.
  const pitch = -0.1 - ((origin.swoop || 0) / 220) * Math.cos(u * Math.PI) * 0.35;
  return {
    kittenX,
    kittenY,
    dinoX: kittenX - TALON_X,
    dinoY: kittenY - TALON_Y,
    grabbed: true,
    wing,
    pitch,
  };
}

// Always a positive rightward change unless already at the 256 mph cap.
export function ejectSpeed(currentVx, rand = Math.random) {
  if (atTerminalSpeed(currentVx) || currentVx >= SPEED_MAX) return SPEED_MAX;
  const boostMph = SNATCH_BOOST_MPH_MIN
    + rand() * (SNATCH_BOOST_MPH_MAX - SNATCH_BOOST_MPH_MIN);
  return Math.min(SPEED_MAX, currentVx + speedFromMph(boostMph));
}

// Kept for callers/tests that still say dropSpeed — same as ejectSpeed.
export function dropSpeed(currentVx, rand = Math.random) {
  return ejectSpeed(currentVx, rand);
}

export function createSnatch(layer) {
  const root = new Container();
  const art = new Graphics();
  root.addChild(art);
  root.visible = false;
  layer.addChild(root);

  let phase = 'idle'; // idle | armed | approach | carry | done
  let time = 0;
  let wait = 0;
  let entryX = 0;
  let entryY = 0;
  let lastBand = -1;
  let carry = null;
  let ejectVx = 0;
  let holdUntil = SNATCH_APPROACH + SNATCH_CARRY_MAX;

  function clear() {
    phase = 'idle';
    time = 0;
    wait = 0;
    entryX = 0;
    entryY = 0;
    lastBand = -1;
    carry = null;
    ejectVx = 0;
    holdUntil = SNATCH_APPROACH + SNATCH_CARRY_MAX;
    root.visible = false;
    art.clear();
  }

  function armOrRoll(travelFeet) {
    const band = Math.max(0, Math.floor(travelFeet / FLYBY_EVERY_FT));
    if (band <= lastBand) return;
    lastBand = band;
    if (phase !== 'idle') return;
    if (Math.random() < SNATCH_CHANCE) {
      phase = 'armed';
      wait = 0.8 + Math.random() * 1.6;
    }
  }

  function begin(kitten) {
    if (phase !== 'armed' && phase !== 'idle') return false;
    phase = 'approach';
    time = 0;
    wait = 0;
    // Pace in from behind and a little above — do not freeze the kitten.
    entryX = kitten.x - 340;
    entryY = kitten.y + 150;
    carry = null;
    ejectVx = 0;
    holdUntil = SNATCH_APPROACH + SNATCH_CARRY_MAX;
    root.visible = true;
    return true;
  }

  function latch(kitten) {
    const duration = rollCarryDuration();
    const swoop = rollSwoop();
    // Keep forward pace at grab; arc handles the vertical swoop.
    const cruiseVx = Math.max(kitten.vx, speedFromMph(70));
    carry = {
      x0: kitten.x,
      y0: kitten.y,
      vx: cruiseVx,
      vy: 0,
      duration,
      swoop,
    };
    holdUntil = SNATCH_APPROACH + duration;
    ejectVx = ejectSpeed(cruiseVx);
    phase = 'carry';
  }

  function update(dt, kitten, cam, flying, travelFeet) {
    if (!flying || !kitten || kitten.dead) {
      if (phase !== 'idle' && phase !== 'done') clear();
      else if (phase === 'done') afterglow(dt, cam);
      return null;
    }

    if (phase === 'done') {
      afterglow(dt, cam);
      return null;
    }

    if (phase === 'idle') {
      if (kitten.y >= FLYBY_Y) armOrRoll(travelFeet);
      return null;
    }

    if (phase === 'armed') {
      if (kitten.y < FLYBY_Y) return null;
      wait -= dt;
      if (wait <= 0) begin(kitten);
      else return null;
    }

    if (phase !== 'approach' && phase !== 'carry') return null;

    time += dt;

    let justGrabbed = false;
    if (phase === 'approach' && time >= SNATCH_APPROACH) {
      latch(kitten);
      justGrabbed = true;
    }

    const pose = snatchPose(
      time,
      kitten,
      entryX,
      entryY,
      carry,
    );
    drawPterodactyl(art, pose.wing, pose.grabbed);
    root.position.set(pose.dinoX, pose.dinoY);
    root.rotation = pose.pitch;

    if (phase === 'approach') {
      // Kitten keeps normal physics; only the dino moves.
      return { state: 'approach', grabbed: false };
    }

    // Instantaneous climb/dive for the HUD speed chips while held.
    const dur = carry.duration;
    const u = clamp((time - SNATCH_APPROACH) / dur, 0, 1);
    // d/dt of swoop*sin(u*pi) with u = t/dur → swoop*cos(u*pi)*pi/dur, in px/s
    // → px/frame at 30 Hz.
    const arcVy = (carry.swoop * Math.cos(u * Math.PI) * Math.PI / dur) / 30;

    // Carry: ride the talons forward. Props/gravity stay paused in main.
    kitten.x = pose.kittenX;
    kitten.y = pose.kittenY;
    kitten.vx = carry.vx;
    kitten.vy = carry.vy + arcVy;
    kitten.spin = -35;
    kitten.turn = 0;

    if (justGrabbed) {
      return { state: 'grab', grabbed: true };
    }

    if (time < holdUntil) {
      return { state: 'carry', grabbed: true };
    }

    // Eject forward with a boost — never slower than the carry unless capped.
    const fromVx = carry.vx;
    kitten.x = pose.kittenX;
    kitten.y = pose.kittenY;
    kitten.vx = ejectVx;
    // Toss along the last swoop direction a bit.
    const toss = carry.swoop >= 0 ? 8 + Math.random() * 8 : -2 + Math.random() * 6;
    kitten.vy = toss;
    kitten.spin = 14;
    kitten.turn = -(Math.abs(kitten.vx) * 0.04);
    phase = 'done';
    return { state: 'drop', grabbed: false, vx: ejectVx, from: fromVx };
  }

  function afterglow(dt, cam) {
    if (phase !== 'done' || !root.visible) return;
    time += dt;
    const age = time - holdUntil;
    if (age > 2.4) {
      root.visible = false;
      art.clear();
      return;
    }
    const flap = Math.sin(time * 26);
    drawPterodactyl(art, flap, false);
    // Keep banking the same way the swoop went as it peels off.
    const bank = carry && carry.swoop < 0 ? 0.22 : -0.22;
    root.x += 320 * dt;
    root.y += (carry && carry.swoop < 0 ? -40 : 55) * dt;
    root.rotation = bank;
    if (root.x > cam.x + 900) {
      root.visible = false;
      art.clear();
    }
  }

  function force(kitten) {
    clear();
    phase = 'armed';
    wait = 0;
    return begin(kitten);
  }

  return {
    clear,
    update,
    force,
    // Only the hold pauses physics. Approach paces beside a live flight.
    get active() {
      return phase === 'carry';
    },
    get phase() {
      return phase;
    },
  };
}
