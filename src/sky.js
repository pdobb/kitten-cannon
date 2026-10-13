import { GROUND_Y, PIXELS_PER_FOOT } from './tune.js';

// The altitude readout is in feet. The sky is sampled in world pixels.
export const SPACE_FEET = 1000;

// The blue holds through the cloud lanes. This is where it starts to thin.
const TWILIGHT_FEET = 860;

export function spaceBlend(feet) {
  if (feet <= TWILIGHT_FEET) return 0;
  if (feet >= SPACE_FEET) return 1;
  return (feet - TWILIGHT_FEET) / (SPACE_FEET - TWILIGHT_FEET);
}

// Sky color is a function of world height. The warm band sits on world y = 0,
// the same line the grass and the ranges use. Above 1000 ft the sample is night.
const SKY_STOPS = [
  [-800, [196, 137, 78]],
  [0, [186, 220, 150]],
  [50, [176, 222, 236]],
  [160, [158, 212, 246]],
  [480, [110, 186, 232]],
  [1400, [74, 156, 214]],
  [5000, [46, 122, 196]],
  [GROUND_Y + TWILIGHT_FEET * PIXELS_PER_FOOT, [46, 122, 196]],
  [GROUND_Y + 940 * PIXELS_PER_FOOT, [18, 32, 78]],
  [GROUND_Y + SPACE_FEET * PIXELS_PER_FOOT, [5, 7, 18]],
];

export function skyRgb(y) {
  let i = 1;
  while (i < SKY_STOPS.length - 1 && y > SKY_STOPS[i][0]) i += 1;
  const a = SKY_STOPS[i - 1];
  const b = SKY_STOPS[i];
  const t = Math.max(0, Math.min(1, (y - a[0]) / (b[0] - a[0])));
  return a[1].map((v, k) => Math.round(v + (b[1][k] - v) * t));
}

export function skyCss(y) {
  const c = skyRgb(y);
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}
