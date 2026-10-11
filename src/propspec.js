// Hit volumes in Flash pixels. The mesh for each prop is built to this same box
// so the thing you see is the thing you hit. cy is the box center above the grass;
// balloons pass their own height instead.

export const HIT = {
  // The painted crate is 25 by 23 around the same center. The extra
  // space is so a graze still connects. The kitten is tested as a point.
  tnt: { hw: 32, hh: 30, cy: 26 },
  trampoline: { hw: 36, hh: 18, cy: 20 },
  spikes: { hw: 36, hh: 18, cy: 18 },
  venus: { hw: 24, hh: 30, cy: 42 },
  balloon: { hw: 24, hh: 26, cy: 0 },
};
