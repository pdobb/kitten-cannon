// The field is fixed, so a run can be learned the way the Flash game was.
// Opening props are placed on the landing spots of a full-power shot (see sim.test).
// After that, a seeded pattern keeps boosters and hazards coming.
// Low balloons stay near the grass. Extra lanes carry balloons up through the high sky.

import { HIT } from './propspec.js';

// Hand-placed lane for a full-power shot (power 64), in Flash pixels.
// Empty-field landings: ~15° → 4600, ~22° → 6200, ~32° → 7900, ~40° → 8500.
// The first stretch is boosters sitting on those arcs. Tar pits start after
// the cannon has already thrown the kitten. The hazard type stays 'spikes'.
const OPENING = [
  { type: 'balloon', x: 980, y: 210 },
  { type: 'tnt', x: 1200 },
  { type: 'trampoline', x: 1500 },
  { type: 'balloon', x: 1750, y: 250 },
  { type: 'balloon', x: 1500, y: 520 },
  { type: 'balloon', x: 2300, y: 640 },
  { type: 'balloon', x: 3000, y: 560 },
  { type: 'tnt', x: 3400 },
  { type: 'balloon', x: 3900, y: 360 },
  { type: 'trampoline', x: 4500 },
  { type: 'balloon', x: 5200, y: 240 },
  { type: 'tnt', x: 5600 },
  { type: 'trampoline', x: 6400 },
  { type: 'tnt', x: 7200 },
  { type: 'balloon', x: 7600, y: 220 },
  { type: 'trampoline', x: 8200 },
  { type: 'spikes', x: 9400 },
  { type: 'balloon', x: 10000, y: 320 },
  { type: 'venus', x: 11000 },
  { type: 'tnt', x: 11800 },
];

const CYCLE = [
  'tnt',
  'gap',
  'balloon',
  'trampoline',
  'spikes',
  'tnt',
  'balloon',
  'gap',
  'venus',
  'trampoline',
  'tnt',
  'balloon',
  'gap',
  'spikes',
];

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildCourse() {
  const raw = OPENING.map((p) => ({ ...p }));
  const rng = mulberry32(0x20070321);
  let x = 12800;
  let lastHazard = 11000;
  let i = 0;
  while (x < 260000) {
    const gap = 320 + rng() * 300;
    x += gap;
    const kind = CYCLE[i % CYCLE.length];
    i += 1;
    if (kind === 'gap') continue;
    if ((kind === 'spikes' || kind === 'venus') && x - lastHazard < 640) {
      raw.push({ type: 'tnt', x: Math.round(x) });
      continue;
    }
    if (kind === 'balloon') {
      raw.push({ type: 'balloon', x: Math.round(x), y: Math.round(150 + rng() * 190) });
      if (rng() < 0.4) {
        raw.push({
          type: 'balloon',
          x: Math.round(x + 150 + rng() * 80),
          y: Math.round(240 + rng() * 150),
        });
      }
      continue;
    }
    raw.push({ type: kind, x: Math.round(x) });
    if (kind === 'spikes' || kind === 'venus') lastHazard = x;
    if (kind === 'trampoline' && rng() < 0.75) {
      raw.push({
        type: 'balloon',
        x: Math.round(x + 170 + rng() * 40),
        y: Math.round(190 + rng() * 90),
      });
    }
  }
  addSkyBalloons(raw, rng);
  return raw.map(materialize);
}

// The hand-placed and low-lane balloons stay near the grass. These lanes
// continue upward from there, a few hundred pixels apart, so a high lob
// still has a balloon in view. The opening is the dense part. Farther down
// the field the lanes thin out.
function addSkyBalloons(raw, rng) {
  sprinkle(raw, rng, { from: 850, to: 42000, step: 1500, y0: 760, y1: 8800, rise: 520, skip: 0.18 });
  sprinkle(raw, rng, { from: 42000, to: 120000, step: 3000, y0: 760, y1: 5600, rise: 700, skip: 0.28 });
}

function sprinkle(raw, rng, zone) {
  for (let x = zone.from; x < zone.to; x += Math.round(zone.step * (0.86 + rng() * 0.28))) {
    for (let y = zone.y0; y < zone.y1; y += zone.rise) {
      if (rng() < zone.skip) continue;
      const bx = Math.round(x + (rng() - 0.5) * zone.step * 0.4);
      const by = Math.round(y + (rng() - 0.5) * zone.rise * 0.4);
      if (by < 690) continue;
      if (crowded(raw, bx, by)) continue;
      raw.push({ type: 'balloon', x: bx, y: by });
    }
  }
}

function crowded(raw, x, y) {
  for (let i = 0; i < raw.length; i++) {
    const other = raw[i];
    const oy = other.y || 0;
    if (Math.abs(other.x - x) < 90 && Math.abs(oy - y) < 90) return true;
  }
  return false;
}

export function materialize(raw) {
  const spec = HIT[raw.type];
  const y = raw.type === 'balloon' ? raw.y : spec.cy;
  return {
    type: raw.type,
    x: raw.x,
    y,
    baseY: y,
    hw: spec.hw,
    hh: spec.hh,
    spent: false,
    ready: 0,
    bob: raw.x * 0.017,
  };
}

export function resetCourse(props) {
  for (let i = 0; i < props.length; i++) {
    const prop = props[i];
    prop.spent = false;
    prop.ready = 0;
    prop.y = prop.baseY;
  }
}
