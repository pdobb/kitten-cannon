// Hit volumes in Flash pixels. The mesh for each prop is built to this same box
// so the thing you see is the thing you hit. cy is the box center above the grass;
// balloons pass their own height instead.

export const HIT = {
  // Painted crate is x -25..25, y 4..50. The box is a little larger so the
  // body point still connects on a graze. Body points cover the rest of the cat.
  tnt: { hw: 32, hh: 30, cy: 26 },
  trampoline: { hw: 36, hh: 18, cy: 20 },
  // The pool is about half again as wide as the old one. The height stays flat.
  spikes: { hw: 54, hh: 18, cy: 18 },
  venus: { hw: 24, hh: 30, cy: 42 },
  balloon: { hw: 24, hh: 26, cy: 0 },
};
