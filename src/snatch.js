// Pterodactyl snatch — same beast as Flit (Gabe-Torres/flit).
// Swoops in from the left, carries the kitten a beat, then drops it
// with rightward speed leveled to 100–120 mph.

import { Container, Graphics } from 'pixi.js';
import { FLYBY_EVERY_FT, FLYBY_Y } from './flyby.js';
import { speedFromMph } from './tune.js';

// Same band gate as flybys; high enough that most long climbs still meet one.
export const SNATCH_CHANCE = 0.22;
export const SNATCH_APPROACH = 0.92;
export const SNATCH_CARRY = 1.28;
export const SNATCH_DURATION = SNATCH_APPROACH + SNATCH_CARRY;
export const SNATCH_DROP_MPH_MIN = 100;
export const SNATCH_DROP_MPH_MAX = 120;

// Body → kitten hang point. Local +X is beak-forward, +Y up.
const TALON_X = -6;
const TALON_Y = -36;

const INK = 0x2b2118;
const OUT = { width: 2.6, color: 0x6a3d16, join: 'round', cap: 'round' };

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
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

export function snatchPose(time, caught, entryX) {
  const wing = Math.sin(time * 26);
  const grabX = caught.x - TALON_X;
  const grabY = caught.y - TALON_Y;
  if (time < SNATCH_APPROACH) {
    const u = time / SNATCH_APPROACH;
    const ease = u * u * (3 - 2 * u);
    const dinoX = entryX + (grabX - entryX) * ease;
    const dinoY = caught.y + 190 + (grabY - (caught.y + 190)) * ease
      + Math.sin(u * Math.PI) * 80;
    return {
      kittenX: caught.x,
      kittenY: caught.y,
      dinoX,
      dinoY,
      grabbed: false,
      wing,
    };
  }
  const u = clamp((time - SNATCH_APPROACH) / SNATCH_CARRY, 0, 1);
  const ease = 1 - (1 - u) * (1 - u);
  // Carry further right and a little up, then the drop happens at the end.
  const endX = grabX + 480;
  const endY = grabY + 140;
  const dinoX = grabX + (endX - grabX) * ease;
  const dinoY = grabY + (endY - grabY) * ease;
  return {
    kittenX: dinoX + TALON_X,
    kittenY: dinoY + TALON_Y,
    dinoX,
    dinoY,
    grabbed: true,
    wing,
  };
}

export function dropSpeed(rand = Math.random) {
  const mph = SNATCH_DROP_MPH_MIN
    + rand() * (SNATCH_DROP_MPH_MAX - SNATCH_DROP_MPH_MIN);
  return speedFromMph(mph);
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
  let caught = null;
  let entryX = 0;
  let lastBand = -1;
  let dropVx = 0;

  function clear() {
    phase = 'idle';
    time = 0;
    wait = 0;
    caught = null;
    entryX = 0;
    lastBand = -1;
    dropVx = 0;
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

  function begin(kitten, cam) {
    if (phase !== 'armed' && phase !== 'idle') return false;
    phase = 'approach';
    time = 0;
    wait = 0;
    caught = { x: kitten.x, y: kitten.y };
    entryX = cam.x - 420;
    dropVx = dropSpeed();
    kitten.vx = 0;
    kitten.vy = 0;
    kitten.turn = 0;
    root.visible = true;
    return true;
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
      if (wait <= 0) begin(kitten, cam);
      else return null;
    }

    if (phase !== 'approach' && phase !== 'carry') return null;

    time += dt;
    const pose = snatchPose(time, caught, entryX);
    drawPterodactyl(art, pose.wing, pose.grabbed);
    root.position.set(pose.dinoX, pose.dinoY);
    root.rotation = pose.grabbed ? -0.12 : Math.sin(time * 3) * 0.08;

    kitten.x = pose.kittenX;
    kitten.y = pose.kittenY;
    kitten.vx = 0;
    kitten.vy = 0;
    kitten.spin = pose.grabbed ? -35 : kitten.spin * 0.9;
    kitten.turn = 0;

    if (time < SNATCH_APPROACH) {
      phase = 'approach';
      return { state: 'approach', grabbed: false };
    }

    if (time < SNATCH_DURATION) {
      phase = 'carry';
      return { state: 'carry', grabbed: true };
    }

    // Drop: level speed to 100–120 mph, slight tumble.
    kitten.x = pose.kittenX;
    kitten.y = pose.kittenY;
    kitten.vx = dropVx;
    kitten.vy = -4 + Math.random() * 10;
    kitten.spin = 10;
    kitten.turn = -(Math.abs(kitten.vx) * 0.045);
    phase = 'done';
    return { state: 'drop', grabbed: false, vx: dropVx };
  }

  function afterglow(dt, cam) {
    if (phase !== 'done' || !root.visible) return;
    time += dt;
    const age = time - SNATCH_DURATION;
    if (age > 2.4) {
      root.visible = false;
      art.clear();
      return;
    }
    const flap = Math.sin(time * 26);
    drawPterodactyl(art, flap, false);
    root.x += 280 * dt;
    root.y += 40 * dt;
    root.rotation = -0.18;
    if (root.x > cam.x + 900) {
      root.visible = false;
      art.clear();
    }
  }

  function force(kitten, cam) {
    clear();
    phase = 'armed';
    wait = 0;
    return begin(kitten, cam);
  }

  return {
    clear,
    update,
    force,
    get active() {
      return phase === 'approach' || phase === 'carry';
    },
    get phase() {
      return phase;
    },
  };
}
