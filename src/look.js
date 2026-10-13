// Flat colors for the side view. Outlines live on their own graphics so a
// coat tint cannot repaint the ink.

export const INK = 0x2b241c;

export const PAL = {
  belly: 0xfff8f2,
  ear: 0xf3a0b0,
  nose: 0xe56b86,
  wood: 0x8d522c,
  woodDark: 0x69381c,
  metal: 0x7d8791,
  metalDark: 0x2c333a,
  metalLite: 0xd5dde4,
  brass: 0xd1a85a,
  red: 0xd23b2e,
  cream: 0xfff6e6,
  leather: 0x7a4e2c,
  leatherDark: 0x4a2e16,
  grass: 0x5cb843,
  grassLite: 0x78cc58,
  grassDark: 0x3d9434,
  dirt: 0xc4894e,
  dirtDark: 0xa56b34,
  tar: 0x16130f,
  leaf: 0x2f8a3a,
  leafDark: 0x1e6a2c,
  mouth: 0xc43344,
  throat: 0x6e1824,
  tooth: 0xfff6e4,
};

export const LINE = { width: 2.6, color: INK, join: 'round', cap: 'round', alignment: 0.5 };

export function strokeOf(width, color = INK) {
  return { width, color, join: 'round', cap: 'round', alignment: 0.5 };
}

// trace() adds one shape. The fill is painted, then the same shape is inked
// so the outline sits on the path instead of a second, fatter copy.
export function paint(fill, ink, trace, color, width = 2.6) {
  trace(fill);
  fill.fill(color);
  if (!ink) return;
  trace(ink);
  ink.stroke(strokeOf(width));
}
