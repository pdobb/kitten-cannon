import { Container, Graphics, Text } from 'pixi.js';
import { PAL, paint, strokeOf, INK } from './look.js';
import { BARREL_LEN, CANNON_X, PIVOT_X, PIVOT_Y } from './tune.js';

// Metal stops short of the muzzle marker so the face can clear the lip.
const MUZZLE_LIP = BARREL_LEN - 16;

const COATS = [
  [0x24222a, 0x141318],
  [0xd9822b, 0xa85e16],
  [0x8d939c, 0x5e646c],
  [0xb08968, 0x7a5a3a],
  [0x6b4632, 0x3f2918],
  [0xd9c2a8, 0xb39678],
  [0x4e5964, 0x2e363e],
  [0xe7e2da, 0xc4beb4],
];

const BALLOON_COLORS = [0xe23b3b, 0xf2c14e, 0x3d8fe0, 0x7ac943, 0xf28a2e];

const lettering = [];

function letter(text, size, color) {
  const label = new Text({
    text,
    style: {
      fontFamily: 'Lilita One, Trebuchet MS, sans-serif',
      fontSize: size,
      fill: color,
      align: 'center',
    },
  });
  label.anchor.set(0.5);
  lettering.push(label);
  return label;
}

export function refreshLettering() {
  for (let i = 0; i < lettering.length; i++) {
    const label = lettering[i];
    if (label.destroyed) continue;
    const value = label.text;
    label.text = `${value}\u200b`;
    label.text = value;
  }
}

// Flight suit is `nasa`: white pressure suit, round white helmet, gold face visor.
// Older looks stay callable for comparison. Demo: __kitten.shotSuit('nasa').
export const SUIT_STYLES = [
  'nasa', // white suit, round helmet, gold Apollo visor
  'v01', // clear fishbowl + antenna
  'v02', // chrome double-rim bowl
  'v03', // red-ring bowl
  'v04', // gold mirrored visor
  'v05', // visor flipped up
  'v06', // orange suit + clear helmet
  'v07', // white suit, face window
  'v08', // silver suit, dark slit
  'v09', // bowl + big backpack + hose
  'v10', // harness straps + bowl
  'v11', // open vest + bowl
  'v12', // forehead lamp
  'v13', // radio ear-cups
  'v14', // screw-thread neck
  'v15', // wide oval dome
  'v16', // tall dome + ball antenna
  'v17', // hose to a tiny tank
  'v18', // cyan glow rim
  'v19', // mission badge + bowl
  'v20', // hard white shell, clear face
  // Riffs on the hard-front helmet (white shell behind, clear face window).
  'hf01', // base: rear shell, face window, blue antenna
  'hf02', // thicker rim
  'hf03', // bigger face window
  'hf04', // smaller window, more shell
  'hf05', // red antenna
  'hf06', // no antenna
  'hf07', // gold window rim
  'hf08', // side antenna
  'hf09', // tall shell over the ear
  'hf10', // double rim, short antenna
  // White suit (no tail pack) + white helmet, black flip-up visor, gold eye glass.
  'wg01', // base
  'wg02', // bigger gold pane
  'wg03', // small gold pane over the eye
  'wg04', // visor flipped higher
  'wg05', // visor closer to the gold
  'wg06', // gold glass see-through
  'wg07', // gold mirror
  'wg08', // thicker black visor
];

export function createKitten() {
  const root = new Container();
  const fur = new Graphics();
  const detail = new Graphics();
  const ink = new Graphics();
  const furPaths = [];

  function coat(paths, target, trace) {
    trace(target);
    target.fill(0xffffff);
    paths.push(trace);
  }
  const furShape = (trace) => coat(furPaths, fur, trace);

  // A round head on a round body. Nose stays toward +X.
  // The skull's back is headX - headR, which seats the head outside the muzzle.
  const headX = 16.5;
  const headR = 7.2;
  const headY = 2.2;
  const legs = new Graphics();
  const legInk = new Graphics();
  const limb = (trace) => {
    trace(legs);
    legs.fill(0xffffff);
    trace(legInk);
    legInk.stroke(strokeOf(2.3));
  };
  // Tops tuck under the belly. The paws hang below it so the round body has legs.
  limb((p) => {
    p.moveTo(-1.2, -2.4);
    p.bezierCurveTo(0.4, -7.2, -2.6, -11.4, -5.6, -13.6);
    p.bezierCurveTo(-8.2, -15.4, -11.4, -14.6, -11.0, -12.2);
    p.bezierCurveTo(-10.6, -10.2, -8.0, -10.0, -6.6, -8.4);
    p.bezierCurveTo(-5.2, -6.6, -5.6, -4.2, -4.2, -2.2);
    p.closePath();
  });
  limb((p) => {
    p.moveTo(4.6, -2.6);
    p.bezierCurveTo(6.8, -6.2, 7.6, -10.2, 6.4, -13.2);
    p.bezierCurveTo(5.4, -15.2, 2.2, -14.8, 2.4, -12.4);
    p.bezierCurveTo(2.6, -10.2, 3.6, -7.6, 2.8, -5.2);
    p.bezierCurveTo(2.2, -3.4, 2.6, -2.4, 4.6, -2.6);
    p.closePath();
  });
  // Plump body. Nearly as tall as it is long, and it meets the head with no pinched neck.
  furShape((p) => {
    p.ellipse(0.6, 0.3, 12.2, 9.6);
  });
  furShape((p) => p.circle(headX, headY, headR));

  // Ear lives in its own layer so a bubble helmet can tuck it away in space.
  const ear = new Container();
  const earFur = new Graphics();
  const earDetail = new Graphics();
  const earInk = new Graphics();
  const earOuter = (p) => p.poly([13.2, 8.4, 16.2, 17.4, 19.4, 8.2]);
  earOuter(earFur);
  earFur.fill(0xffffff);
  paint(earDetail, earInk, (p) => p.poly([14.4, 9.2, 16.2, 15.4, 18.2, 9.0]), PAL.ear, 1.5);
  earOuter(earInk);
  earInk.stroke(strokeOf(2.2));
  ear.addChild(earFur, earDetail, earInk);

  const tail = new Container();
  tail.position.set(-11.5, 2.2);
  const tailFur = new Graphics();
  const tailInk = new Graphics();
  const tailShape = (p) => {
    p.moveTo(2.6, -2.6);
    p.bezierCurveTo(-1.5, 0.2, -7, 3.2, -10.5, 9);
    p.quadraticCurveTo(-13.2, 13.2, -8.6, 11.4);
    p.bezierCurveTo(-6.4, 7.2, -3.2, 2.4, 0.4, 1.6);
    p.closePath();
  };
  tailShape(tailFur);
  tailFur.fill(0xffffff);
  tailShape(tailInk);
  tailInk.stroke(strokeOf(2.4));
  tail.addChild(tailFur, tailInk);

  paint(detail, ink, (p) => p.ellipse(0.2, -5.4, 5.2, 2.5), PAL.belly, 2);
  paint(detail, ink, (p) => p.ellipse(21.8, 1.2, 3.3, 2.4), PAL.belly, 1.8);
  paint(detail, ink, (p) => p.ellipse(24.2, 1.4, 1.25, 0.95), PAL.nose, 1.4);

  detail.moveTo(22.6, 0.2);
  detail.quadraticCurveTo(23.6, -0.6, 24.6, 0.15);
  detail.stroke(strokeOf(1.3, INK));

  const eye = new Container();
  eye.position.set(18.4, 4.2);
  const gaze = new Graphics();
  gaze.circle(0, 0, 2.15);
  gaze.fill(0xfffaf4);
  gaze.circle(0.55, -0.1, 1.05);
  gaze.fill(0x1c1720);
  gaze.circle(0.95, 0.45, 0.38);
  gaze.fill(PAL.cream);
  eye.addChild(gaze);

  for (const trace of furPaths) {
    trace(ink);
    ink.stroke(strokeOf(2.5));
  }

  // Space gear. Drawn above the cat. Clear glass leaves the face readable.
  const suit = new Container();
  suit.visible = false;
  suit.alpha = 0;
  const suitFill = new Graphics();
  const suitInk = new Graphics();
  const glass = new Graphics();
  const glassInk = new Graphics();
  suit.addChild(suitFill, suitInk, glass, glassInk);

  let suitStyle = 'nasa';
  const WHITE = 0xf4f7fb;
  const METAL = 0xb8c2ce;
  const GOLD = 0xd4a012;
  const ORANGE = 0xf07828;
  const SILVER = 0xc5ced8;
  const GLASS = 0x9ec9f0;
  // Ear tip is near y = 17.4. A dome of this size clears it.
  const HR = 15.0;
  const HY = headY + 3.0;

  function clearSuitGfx() {
    suitFill.clear();
    suitInk.clear();
    glass.clear();
    glassInk.clear();
  }

  function bowl(rx = HR, ry = HR, cy = HY, alpha = 0.16) {
    glass.ellipse(headX, cy, rx, ry);
    glass.fill({ color: GLASS, alpha });
    glass.ellipse(headX + 4.6, cy + 5.6, 4.2, 2.3);
    glass.fill({ color: 0xffffff, alpha: 0.36 });
  }

  function rim(color, width, rx = HR, ry = HR, cy = HY) {
    glassInk.ellipse(headX, cy, rx, ry);
    glassInk.stroke(strokeOf(width, color));
    glassInk.ellipse(headX, cy, rx, ry);
    glassInk.stroke(strokeOf(1.5));
  }

  function seal() {
    paint(suitFill, suitInk, (p) => p.ellipse(headX - 1.0, HY - HR + 1.6, 9.2, 3.6), METAL, 2.4);
    paint(suitFill, suitInk, (p) => p.ellipse(headX - 1.0, HY - HR + 1.8, 6.8, 2.2), WHITE, 1.8);
  }

  function antenna(tip = 0xff5a1f) {
    const top = HY + HR;
    paint(suitFill, suitInk, (p) => p.roundRect(headX - 3.0, top - 2.0, 4.2, 3.0, 1.0), METAL, 1.4);
    suitInk.moveTo(headX - 0.9, top);
    suitInk.lineTo(headX - 0.9, top + 6.0);
    suitInk.stroke(strokeOf(2.5));
    paint(suitFill, suitInk, (p) => p.circle(headX - 0.9, top + 7.0, 1.9), tip, 1.4);
  }

  function pack() {
    paint(suitFill, suitInk, (p) => p.roundRect(-20.0, -6.0, 10.0, 14.0, 2.4), METAL, 2.2);
    paint(suitFill, suitInk, (p) => p.roundRect(-18.2, -3.5, 5.8, 3.6, 1.1), WHITE, 1.4);
    paint(suitFill, suitInk, (p) => p.roundRect(-18.0, 1.6, 5.4, 3.4, 1.0), WHITE, 1.4);
  }

  function bodySuit(color, shade) {
    // Torso only — stops short of the face so a clear helmet can show the cat.
    paint(suitFill, suitInk, (p) => p.ellipse(0.0, -0.4, 14.2, 12.0), color, 2.6);
    paint(suitFill, suitInk, (p) => p.ellipse(-7.5, 5.5, 5.5, 4.2), shade, 1.8);
    paint(suitFill, suitInk, (p) => p.roundRect(-5.5, -3.2, 11.0, 8.5, 2.2), WHITE, 1.8);
    paint(suitFill, suitInk, (p) => p.circle(0.2, 1.2, 1.8), 0x3d8fe0, 1.4);
  }

  function paintSuit(style) {
    const kind = SUIT_STYLES.includes(style) ? style : 'nasa';
    suitStyle = kind;
    clearSuitGfx();

    if (kind === 'nasa') {
      paintNasa();
    } else if (kind === 'v01') {
      bowl(); rim(WHITE, 4.2); seal(); antenna();
    } else if (kind === 'v02') {
      bowl(HR, HR, HY, 0.2);
      rim(0xd8dee6, 5.6);
      glassInk.ellipse(headX, HY, HR - 2.2, HR - 2.2);
      glassInk.stroke(strokeOf(2.0, METAL));
      seal();
    } else if (kind === 'v03') {
      bowl(); rim(WHITE, 4.4); seal();
      glassInk.ellipse(headX, HY, HR, HR);
      glassInk.stroke(strokeOf(2.6, 0xd23b2e));
      antenna(0xd23b2e);
    } else if (kind === 'v04') {
      // Gold mirror covers the face. Body fur stays.
      paint(suitFill, suitInk, (p) => p.circle(headX, HY, 13.2), WHITE, 2.6);
      glass.ellipse(headX + 1.4, HY + 0.4, 10.0, 10.6);
      glass.fill({ color: GOLD, alpha: 0.92 });
      glass.ellipse(headX + 4.0, HY + 4.2, 3.2, 1.8);
      glass.fill({ color: 0xffe9a0, alpha: 0.5 });
      glassInk.ellipse(headX + 1.4, HY + 0.4, 10.0, 10.6);
      glassInk.stroke(strokeOf(2.2));
      seal(); antenna();
    } else if (kind === 'v05') {
      // Hard cap on the crown; gold visor parked up so the face stays open.
      paint(suitFill, suitInk, (p) => p.ellipse(headX, HY + 9.0, 12.0, 6.0), WHITE, 2.4);
      paint(suitFill, suitInk, (p) => p.ellipse(headX + 1.0, HY + 12.2, 8.0, 2.8), GOLD, 2.0);
      paint(suitFill, null, (p) => p.ellipse(headX + 3.0, HY + 12.8, 2.6, 1.1), 0xffe9a0);
      seal(); antenna();
    } else if (kind === 'v06') {
      pack();
      bodySuit(ORANGE, 0xb85014);
      bowl(13.2, 13.2); rim(WHITE, 4.0, 13.2, 13.2); seal();
    } else if (kind === 'v07') {
      pack();
      bodySuit(WHITE, METAL);
      bowl(13.0, 13.0, HY, 0.22); rim(METAL, 3.6, 13.0, 13.0); seal(); antenna();
    } else if (kind === 'v08') {
      pack();
      bodySuit(SILVER, 0x8a949e);
      paint(suitFill, suitInk, (p) => p.circle(headX, HY, 12.6), 0xe2e8ee, 2.4);
      glass.roundRect(headX - 2.5, HY - 5.0, 13.5, 9.5, 3.2);
      glass.fill({ color: 0x1a2430, alpha: 0.88 });
      glass.ellipse(headX + 5.0, HY + 0.5, 2.6, 1.3);
      glass.fill({ color: 0x6ec8ff, alpha: 0.4 });
      glassInk.roundRect(headX - 2.5, HY - 5.0, 13.5, 9.5, 3.2);
      glassInk.stroke(strokeOf(2.0));
      seal();
    } else if (kind === 'v09') {
      pack();
      suitInk.moveTo(headX - 8.0, HY - HR + 3);
      suitInk.bezierCurveTo(0, HY - 8, -8, 1, -14, -1);
      suitInk.stroke(strokeOf(2.8, METAL));
      bowl(); rim(WHITE, 4.0); seal();
    } else if (kind === 'v10') {
      paint(suitFill, suitInk, (p) => p.roundRect(-2.2, 4.0, 3.0, 11.0, 1.1), WHITE, 1.7);
      paint(suitFill, suitInk, (p) => p.roundRect(4.2, 3.6, 3.0, 10.5, 1.1), WHITE, 1.7);
      paint(suitFill, suitInk, (p) => p.roundRect(-3.5, -2.2, 13.0, 3.2, 1.3), METAL, 1.8);
      bowl(); rim(WHITE, 3.8); seal();
    } else if (kind === 'v11') {
      paint(suitFill, suitInk, (p) => {
        p.moveTo(-11.0, 6.0); p.quadraticCurveTo(-13.0, 0, -10.5, -6.5);
        p.lineTo(-3.0, -7.0); p.lineTo(-1.8, 6.5); p.closePath();
      }, WHITE, 2.1);
      paint(suitFill, suitInk, (p) => {
        p.moveTo(11.5, 5.2); p.quadraticCurveTo(13.0, -0.5, 11.0, -6.0);
        p.lineTo(4.2, -6.5); p.lineTo(3.2, 6.0); p.closePath();
      }, WHITE, 2.1);
      bowl(); rim(WHITE, 3.8); seal();
    } else if (kind === 'v12') {
      bowl(); rim(WHITE, 3.8); seal();
      paint(suitFill, suitInk, (p) => p.circle(headX + 2.0, HY + HR - 2.4, 3.0), METAL, 1.7);
      paint(suitFill, suitInk, (p) => p.circle(headX + 2.0, HY + HR - 2.4, 1.8), 0xfff1a8, 1.3);
    } else if (kind === 'v13') {
      bowl(); rim(WHITE, 3.6); seal();
      paint(suitFill, suitInk, (p) => p.ellipse(headX - 12.2, HY + 1.0, 3.6, 4.8), METAL, 1.9);
      paint(suitFill, suitInk, (p) => p.ellipse(headX + 12.2, HY + 1.0, 3.6, 4.8), METAL, 1.9);
      antenna(0xf2c14e);
    } else if (kind === 'v14') {
      bowl(); rim(WHITE, 3.6);
      const base = HY - HR + 1.2;
      for (let i = 0; i < 5; i++) {
        paint(suitFill, suitInk, (p) => p.ellipse(headX - 1.0, base - i * 2.1, 8.8 - i * 0.2, 1.6), i % 2 ? WHITE : METAL, 1.5);
      }
      antenna();
    } else if (kind === 'v15') {
      bowl(17.2, 12.8, HY + 1.2); rim(WHITE, 4.4, 17.2, 12.8, HY + 1.2);
      paint(suitFill, suitInk, (p) => p.ellipse(headX - 1.0, HY - 9.6, 10.2, 3.0), METAL, 2.2);
      antenna();
    } else if (kind === 'v16') {
      bowl(14.0, 16.8, HY + 1.6); rim(WHITE, 4.2, 14.0, 16.8, HY + 1.6); seal();
      const top = HY + 16.8 + 1.6;
      paint(suitFill, suitInk, (p) => p.circle(headX - 0.8, top + 4.5, 2.6), METAL, 1.7);
      suitInk.moveTo(headX - 0.8, HY + 16);
      suitInk.lineTo(headX - 0.8, top + 2);
      suitInk.stroke(strokeOf(2.3));
    } else if (kind === 'v17') {
      paint(suitFill, suitInk, (p) => p.roundRect(-16.0, -2.5, 6.5, 8.5, 1.8), METAL, 2.0);
      suitInk.moveTo(headX - 7.0, HY - HR + 3);
      suitInk.bezierCurveTo(2, HY - 6, -4, 2, -12, 1);
      suitInk.stroke(strokeOf(2.6, METAL));
      bowl(); rim(WHITE, 3.8); seal();
    } else if (kind === 'v18') {
      glass.circle(headX, HY, 16.0);
      glass.stroke({ width: 6, color: 0x6ec8ff, alpha: 0.55 });
      glass.circle(headX, HY, 13.2);
      glass.stroke({ width: 2.5, color: 0xffffff, alpha: 0.45 });
      antenna(0x6ec8ff);
    } else if (kind === 'v19') {
      paint(suitFill, suitInk, (p) => p.roundRect(-4.2, -3.0, 10.5, 8.5, 2.0), WHITE, 2.0);
      paint(suitFill, null, (p) => p.circle(1.0, 1.2, 3.0), 0x1a3a6a);
      paint(suitFill, null, (p) => p.circle(1.0, 1.2, 1.7), 0xf2c14e);
      paint(suitFill, suitInk, (p) => p.circle(1.0, 1.2, 3.0), 0x1a3a6a, 1.4);
      bowl(); rim(WHITE, 3.8); seal();
    } else if (kind === 'v20' || kind.startsWith('hf')) {
      paintHardFront(kind === 'v20' ? 'hf01' : kind);
    } else if (kind.startsWith('wg')) {
      paintWhiteGold(kind);
    }
  }

  // v07 white torso, no tail pack. White shell leaves the face open.
  // Black visor sits up on the crown. Gold glass covers only the eye.
  function paintWhiteGold(kind) {
    const specs = {
      wg01: { gx: 4.8, gy: 3.5, gAlpha: 0.74, vx: 3.2, vy: 8.2, vw: 7.4, vh: 2.35 },
      wg02: { gx: 7.4, gy: 5.2, gAlpha: 0.74, vx: 3.6, vy: 9.0, vw: 8.2, vh: 2.5 },
      wg03: { gx: 3.1, gy: 2.35, gAlpha: 0.8, vx: 2.8, vy: 7.6, vw: 6.6, vh: 2.1 },
      wg04: { gx: 4.8, gy: 3.5, gAlpha: 0.74, vx: 1.4, vy: 11.4, vw: 6.8, vh: 2.15 },
      wg05: { gx: 4.8, gy: 3.5, gAlpha: 0.74, vx: 4.0, vy: 5.6, vw: 7.2, vh: 2.15 },
      wg06: { gx: 5.0, gy: 3.6, gAlpha: 0.4, vx: 3.2, vy: 8.2, vw: 7.4, vh: 2.35 },
      wg07: { gx: 5.0, gy: 3.6, gAlpha: 0.96, vx: 3.2, vy: 8.4, vw: 7.4, vh: 2.4 },
      wg08: { gx: 4.6, gy: 3.3, gAlpha: 0.74, vx: 3.0, vy: 8.8, vw: 8.0, vh: 4.2 },
    };
    const s = specs[kind] || specs.wg01;

    bodySuit(WHITE, METAL);

    // Rear shell stops short of the eye. Brow and chin frame the opening.
    paint(suitFill, suitInk, (p) => p.ellipse(headX - 6.6, HY + 1.4, 7.4, 10.6), WHITE, 2.6);
    paint(suitFill, suitInk, (p) => p.ellipse(headX + 1.6, HY + 6.4, 8.6, 2.5), WHITE, 2.2);
    paint(suitFill, suitInk, (p) => p.ellipse(headX + 0.4, HY - 6.6, 7.2, 2.8), WHITE, 2.2);
    paint(suitFill, suitInk, (p) => p.ellipse(headX - 3.2, HY - 8.2, 7.6, 2.6), METAL, 2.0);
    paint(suitFill, suitInk, (p) => p.ellipse(headX - 3.2, HY - 7.8, 5.4, 1.6), WHITE, 1.4);

    const eyeX = 20.0;
    const eyeY = 4.5;
    glass.ellipse(eyeX, eyeY, s.gx, s.gy);
    glass.fill({ color: GOLD, alpha: s.gAlpha });
    glass.ellipse(eyeX + s.gx * 0.28, eyeY + s.gy * 0.32, s.gx * 0.32, s.gy * 0.22);
    glass.fill({ color: 0xfff1c4, alpha: 0.55 });
    glassInk.ellipse(eyeX, eyeY, s.gx, s.gy);
    glassInk.stroke(strokeOf(2.2, 0x1a1a1a));

    // Visor on the ink layer so it sits over the white shell.
    const visorX = headX + s.vx;
    const visorY = HY + s.vy;
    glassInk.ellipse(visorX, visorY, s.vw, s.vh);
    glassInk.fill({ color: 0x1a1a1a });
    glassInk.ellipse(visorX + 1.4, visorY + s.vh * 0.25, s.vw * 0.42, s.vh * 0.32);
    glassInk.fill({ color: 0x3a3a3a });
    glassInk.ellipse(visorX, visorY, s.vw, s.vh);
    glassInk.stroke(strokeOf(2.0, 0x1a1a1a));

    const hingeX = headX - 5.2;
    const hingeY = HY + 4.6;
    glassInk.circle(hingeX, hingeY, 1.7);
    glassInk.fill({ color: METAL });
    glassInk.circle(hingeX, hingeY, 0.7);
    glassInk.fill({ color: 0x2c333a });
    glassInk.circle(hingeX, hingeY, 1.7);
    glassInk.stroke(strokeOf(1.4));
  }

  // White shell on the back of the skull, clear window over the face.
  function paintHardFront(kind) {
    const specs = {
      hf01: { shell: 12.2, win: 11.2, rimW: 3.4, rimC: METAL, ant: 'top', tip: 0x3d8fe0, shift: -3.2 },
      hf02: { shell: 12.4, win: 11.0, rimW: 5.4, rimC: 0x8a949e, ant: 'top', tip: 0x3d8fe0, shift: -3.0 },
      hf03: { shell: 11.0, win: 13.2, rimW: 3.2, rimC: METAL, ant: 'top', tip: 0x3d8fe0, shift: -5.5 },
      hf04: { shell: 13.6, win: 8.6, rimW: 3.6, rimC: WHITE, ant: 'top', tip: 0x3d8fe0, shift: -1.5 },
      hf05: { shell: 12.2, win: 11.2, rimW: 3.4, rimC: METAL, ant: 'top', tip: 0xff5a1f, shift: -3.2 },
      hf06: { shell: 12.2, win: 11.2, rimW: 3.6, rimC: METAL, ant: 'none', tip: 0, shift: -3.2 },
      hf07: { shell: 12.2, win: 11.2, rimW: 4.0, rimC: GOLD, ant: 'top', tip: 0xd4a012, shift: -3.2 },
      hf08: { shell: 12.2, win: 11.2, rimW: 3.4, rimC: METAL, ant: 'side', tip: 0xff5a1f, shift: -3.2 },
      hf09: { shell: 14.8, win: 11.0, rimW: 3.4, rimC: METAL, ant: 'top', tip: 0x3d8fe0, shift: -2.4, tall: true },
      hf10: { shell: 12.4, win: 10.6, rimW: 3.2, rimC: WHITE, ant: 'short', tip: 0xff5a1f, shift: -3.0, double: true },
    };
    const s = specs[kind] || specs.hf01;
    const cy = HY + (s.tall ? 2.2 : 0.6);
    const sy = s.tall ? s.shell + 2.4 : s.shell;
    paint(suitFill, suitInk, (p) => p.ellipse(headX + s.shift, cy, s.shell * 0.72, sy), WHITE, 2.6);
    bowl(s.win, s.win * (s.tall ? 1.08 : 1.02), cy, 0.18);
    rim(s.rimC, s.rimW, s.win, s.win * (s.tall ? 1.08 : 1.02), cy);
    if (s.double) {
      glassInk.ellipse(headX, cy, s.win - 1.8, s.win - 1.6);
      glassInk.stroke(strokeOf(2.0, METAL));
    }
    seal();
    if (s.ant === 'top') antenna(s.tip);
    else if (s.ant === 'short') {
      const top = cy + s.win;
      paint(suitFill, suitInk, (p) => p.circle(headX - 0.6, top + 2.2, 1.7), s.tip, 1.3);
      suitInk.moveTo(headX - 0.6, cy + s.win - 1);
      suitInk.lineTo(headX - 0.6, top + 0.6);
      suitInk.stroke(strokeOf(2.2));
    } else if (s.ant === 'side') {
      const ax = headX + s.win - 1;
      const ay = cy + 3;
      paint(suitFill, suitInk, (p) => p.circle(ax, ay, 2.2), METAL, 1.5);
      suitInk.moveTo(ax + 1.2, ay + 1.2);
      suitInk.lineTo(ax + 6.5, ay + 7.2);
      suitInk.stroke(strokeOf(2.2));
      paint(suitFill, suitInk, (p) => p.circle(ax + 7.0, ay + 7.8, 1.5), s.tip, 1.2);
    }
  }

  // Apollo helmet: white sphere over the whole head, gold visor, neck ring, antenna.
  // The shell covers the ear. The antenna is the thing that sticks out.
  function paintNasa() {
    paint(suitFill, suitInk, (p) => p.ellipse(-0.4, -1.6, 12.8, 9.8), WHITE, 2.6);

    const cx = headX - 0.2;
    const cy = headY + 4.2;
    const r = 13.4;
    paint(suitFill, suitInk, (p) => p.circle(cx, cy, r), WHITE, 3.0);
    paint(suitFill, suitInk, (p) => p.ellipse(cx - 1.2, cy - r + 2.0, 8.4, 2.8), 0x7d8791, 2.2);
    paint(suitFill, suitInk, (p) => p.ellipse(cx - 1.2, cy - r + 2.3, 6.0, 1.5), WHITE, 1.5);

    const vx = headX + 2.6;
    const vy = headY + 0.6;
    glass.ellipse(vx, vy, 6.8, 7.6);
    glass.fill({ color: GOLD });
    glass.ellipse(vx + 2.0, vy + 2.6, 2.2, 1.2);
    glass.fill({ color: 0xffe9a8 });
    glassInk.ellipse(vx, vy, 6.8, 7.6);
    glassInk.stroke(strokeOf(2.6, 0x1a1a1a));

    const top = cy + r;
    const ax = cx - 0.4;
    paint(suitFill, suitInk, (p) => p.roundRect(ax - 2.2, top - 1.6, 4.4, 2.8, 1.0), METAL, 1.6);
    suitInk.moveTo(ax, top);
    suitInk.lineTo(ax, top + 7.2);
    suitInk.stroke(strokeOf(2.4));
    paint(suitFill, suitInk, (p) => p.circle(ax, top + 8.4, 2.0), 0xff5a1f, 1.5);
  }

  paintSuit('nasa');

  // Suit above fur; glass above face so the bowl rim reads, face shows through.
  root.addChild(tail, legs, legInk, fur, detail, ear, eye, ink, suit);

  let coatIndex = 0;
  let suited = false;
  // Pop timer: 0 = idle/hidden, >0 animating in after materialize.
  let suitPop = 0;
  fur.tint = COATS[0][0];
  legs.tint = COATS[0][0];
  tailFur.tint = COATS[0][0];
  earFur.tint = COATS[0][1];

  function recolor() {
    let next = Math.floor(Math.random() * COATS.length);
    if (next === coatIndex) next = (next + 1) % COATS.length;
    coatIndex = next;
    fur.tint = COATS[next][0];
    legs.tint = COATS[next][0];
    tailFur.tint = COATS[next][0];
    earFur.tint = COATS[next][1];
  }

  function applySuitVisual(on) {
    suited = on;
    // The helmet shell covers the ear. It comes back when the suit comes off.
    ear.visible = !on;
    if (on) {
      suit.visible = true;
      suit.alpha = 0;
      suit.scale.set(0.35);
      suitPop = 0.0001;
    } else {
      suit.visible = false;
      suit.alpha = 0;
      suit.scale.set(1);
      suitPop = 0;
    }
  }

  function setSuited(on) {
    if (on === suited && (on ? suit.visible : !suit.visible)) return false;
    applySuitVisual(!!on);
    return true;
  }

  function setSuitStyle(style) {
    paintSuit(style);
    return suitStyle;
  }

  // Ease the suit from a tiny sparkle into place. Call each frame with dt.
  function tickSuit(dt) {
    if (!suited) return;
    if (suitPop <= 0 && suit.alpha >= 0.99) {
      suit.alpha = 1;
      suit.scale.set(1);
      return;
    }
    suitPop += dt;
    const t = Math.min(1, suitPop / 0.38);
    // Overshoot then settle.
    const bounce = t < 0.7
      ? (t / 0.7) * 1.12
      : 1.12 - ((t - 0.7) / 0.3) * 0.12;
    suit.scale.set(0.35 + bounce * 0.65);
    suit.alpha = Math.min(1, t * 1.35);
    if (t >= 1) {
      suit.scale.set(1);
      suit.alpha = 1;
      suitPop = 0;
    }
  }

  return {
    mesh: root,
    eye,
    tail,
    recolor,
    coat() { return COATS[coatIndex][0]; },
    suited() { return suited; },
    suitStyle() { return suitStyle; },
    setSuited,
    setSuitStyle,
    tickSuit,
    // Lip metal ends near x = 82. The skull's back is headX - headR, so this
    // puts the whole head outside the muzzle and leaves a little neck showing.
    seat: { x: MUZZLE_LIP - (headX - headR) + 8, y: -1 },
  };
}

export function createCannon() {
  const root = new Container();
  root.position.set(CANNON_X, 0);
  const g = new Graphics();
  const ink = new Graphics();

  // Far wheel. It shares the ground line and only peeks out behind the carriage.
  paint(g, ink, (p) => p.circle(-2, 27, 21), PAL.woodDark, 2.4);
  g.circle(-2, 27, 14);
  g.fill(0x4a2c16);

  // The trail runs back from the axle and sits on the grass. That foot is
  // what keeps the barrel from reading as a tube in the air.
  paint(g, ink, (p) => p.poly([
    -6, 40,
    4, 30,
    -62, 12,
    -70, 18,
  ]), PAL.wood, 2.4);
  paint(g, ink, (p) => p.roundRect(-88, 4, 32, 10, 3), PAL.woodDark, 2.2);

  // Cheek around the trunnion. The barrel sits on this, behind the near wheel.
  paint(g, ink, (p) => p.poly([
    -8, 36,
    36, 34,
    40, 50,
    22, 62,
    0, 60,
    -14, 46,
  ]), PAL.wood, 2.4);
  paint(g, ink, (p) => p.poly([
    2, 42,
    28, 40,
    30, 50,
    16, 56,
    4, 52,
  ]), PAL.woodDark, 2);

  root.addChild(g, ink);

  const pivot = new Container();
  pivot.position.set(PIVOT_X, PIVOT_Y);

  // Child 0 stays behind the kitten. placeKitten inserts the cat at child 1.
  const bore = new Graphics();
  bore.circle(MUZZLE_LIP - 2, 0, 12);
  bore.fill(0x14181c);

  const barrel = new Graphics();
  const barrelInk = new Graphics();
  const lip = MUZZLE_LIP;
  paint(barrel, barrelInk, (p) => {
    p.poly([
      -14, -14,
      20, -15,
      lip - 8, -17,
      lip, -15,
      lip, 15,
      lip - 8, 17,
      20, 15,
      -14, 14,
    ]);
  }, PAL.metal, 2.6);
  barrel.poly([8, 6, lip - 18, 8, lip - 18, 4, 14, 3]);
  barrel.fill({ color: PAL.metalLite, alpha: 0.72 });
  for (const x of [18, 46]) {
    barrel.roundRect(x - 4, -18.5, 9, 37, 2);
    barrel.fill(PAL.metalDark);
  }
  // The band ends at the lip so it frames the neck and leaves the face clear.
  barrel.roundRect(lip - 12, -18, 14, 36, 3);
  barrel.fill(PAL.metalDark);

  // Burning wick on the breech (top rear), same spark language as the balloon bombs.
  const wick = new Graphics();
  wick.moveTo(-11, 9);
  wick.quadraticCurveTo(-18, 14, -16, 21);
  wick.stroke(strokeOf(1.8, 0xc2a15a));
  wick.moveTo(-11, 9);
  wick.lineTo(-12, 11);
  wick.stroke(strokeOf(2.2, 0x4a4038));

  const spark = new Graphics();
  spark.circle(0, 0, 2.4);
  spark.fill(0xffb703);
  spark.circle(-0.7, 0.7, 0.9);
  spark.fill(0xfff6d0);
  spark.circle(0.8, -0.4, 1.1);
  spark.fill({ color: 0xff6b1a, alpha: 0.85 });
  spark.position.set(-16, 21);

  const ticks = new Container();
  for (let i = 0; i < 6; i++) {
    const dot = new Graphics();
    dot.circle(BARREL_LEN + 18 + i * 26, 0, 3.2);
    dot.fill(0xfff4c4);
    dot.stroke(strokeOf(1.6));
    ticks.addChild(dot);
  }
  const muzzle = new Container();
  muzzle.position.set(BARREL_LEN, 0);

  const pin = new Graphics();
  const pinInk = new Graphics();
  paint(pin, pinInk, (p) => p.circle(PIVOT_X, PIVOT_Y, 6.5), PAL.brass, 2.2);

  pivot.addChild(bore, barrel, barrelInk, wick, spark, ticks, muzzle);
  root.addChild(pivot, pin, pinInk);

  // Near wheel last, so it covers the barrel as well as the cheek. The far
  // wheel stays in the carriage layer behind. The grass tops out near y = 10,
  // so a bottom at y = 6 sits in it. The kitten is up at the muzzle.
  const near = new Graphics();
  const nearInk = new Graphics();
  paint(near, nearInk, (p) => p.circle(16, 29, 23), PAL.wood, 2.6);
  near.circle(16, 29, 16);
  near.fill(0x9a6236);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI;
    near.moveTo(16 + Math.cos(a) * 5, 29 + Math.sin(a) * 5);
    near.lineTo(16 + Math.cos(a) * 15.5, 29 + Math.sin(a) * 15.5);
    near.stroke(strokeOf(2.4, PAL.woodDark));
  }
  paint(near, nearInk, (p) => p.circle(16, 29, 5), PAL.brass, 2);
  root.addChild(near, nearInk);
  return { root, pivot, ticks, muzzle, spark };
}

function tntStick(x) {
  const stick = new Container();
  stick.position.set(x, 0);
  const g = new Graphics();
  // Wrapped stick charge strapped to the crate.
  paint(g, g, (p) => p.roundRect(-6.5, 2, 13, 48, 3.2), 0xd9c28a, 2);
  g.roundRect(-6.5, 10, 13, 5, 0);
  g.roundRect(-6.5, 24, 13, 5, 0);
  g.roundRect(-6.5, 38, 13, 5, 0);
  g.fill(0xb89a5e);
  g.roundRect(-5.2, 4, 10.4, 8, 2);
  g.fill(0x7a2418);
  g.moveTo(0, 2);
  g.quadraticCurveTo(4, -4, 1.5, -9);
  g.stroke(strokeOf(1.5, 0x4a4038));
  g.circle(1.5, -9.5, 1.7);
  g.fill(0xffb703);
  stick.addChild(g);
  return stick;
}

function crate() {
  const root = new Container();
  // Side sticks first so the crate face and label sit in front.
  root.addChild(tntStick(-31), tntStick(31));

  const g = new Graphics();
  paint(g, g, (p) => p.roundRect(-24, 4, 48, 46, 5), PAL.red, 2.6);
  // Cream band tall enough for the TNT stamp.
  g.roundRect(-24, 16, 48, 20, 0);
  g.fill(PAL.cream);
  g.roundRect(-24, 16, 48, 20, 0);
  g.stroke(strokeOf(2.2));
  // Rope straps tying the side sticks to the box.
  for (const y of [14, 40]) {
    g.moveTo(-31, y);
    g.lineTo(31, y);
    g.stroke(strokeOf(2.4, 0x6b4632));
    g.moveTo(-31, y + 2.2);
    g.lineTo(31, y + 2.2);
    g.stroke(strokeOf(1.2, 0x9a6236));
  }
  for (const [x, y] of [[-17, 10], [17, 10], [-17, 42], [17, 42]]) {
    g.circle(x, y, 2.1);
    g.fill(0x7a2418);
  }
  root.addChild(g);
  // Scale so the stamp sits inside the cream band (~20px tall, ~48px wide).
  const label = letter('TNT', 48, 0x1c140f);
  label.scale.set(0.38, -0.38);
  label.position.set(0, 26);
  root.addChild(label);
  return { mesh: root, parts: {} };
}

function trampoline() {
  const root = new Container();
  const frame = new Graphics();
  // Short A-frames in the grass. The bed is a round mat, not a plank on edge.
  const brace = (outer, inner, apex) => {
    frame.moveTo(outer, 2.2);
    frame.lineTo(apex, 11.5);
    frame.lineTo(inner, 2.2);
    frame.stroke(strokeOf(3.3, 0x4e5963));
  };
  brace(-34, -18, -26);
  brace(34, 18, 26);
  frame.roundRect(-38, 0.7, 16, 3.4, 1.3);
  frame.roundRect(-20, 0.7, 10, 3.4, 1.3);
  frame.roundRect(10, 0.7, 10, 3.4, 1.3);
  frame.roundRect(22, 0.7, 16, 3.4, 1.3);
  frame.fill(PAL.metalDark);

  // Same flat-oval read as a tar pool, lifted just enough to show the legs.
  frame.ellipse(0, 15.5, 30, 8.2);
  frame.fill(PAL.metal);
  frame.ellipse(0, 15.5, 30, 8.2);
  frame.stroke(strokeOf(2.4));
  for (const x of [-20, -10, 0, 10, 20]) {
    frame.moveTo(x - 2.1, 9.2);
    frame.quadraticCurveTo(x, 12.4, x + 2.1, 9.4);
    frame.stroke(strokeOf(1.6, PAL.metalDark));
  }
  for (const x of [-26.5, 26.5]) {
    frame.moveTo(x, 14.2);
    frame.lineTo(x + Math.sign(x) * 2.6, 16.2);
    frame.moveTo(x, 17.2);
    frame.lineTo(x + Math.sign(x) * 2.6, 19.2);
    frame.stroke(strokeOf(1.6, PAL.metalDark));
  }
  root.addChild(frame);

  // The red oval is the top you land on. A pale center marks the middle.
  const bed = new Container();
  bed.position.set(0, 17.4);
  const pad = new Graphics();
  pad.ellipse(0, 0, 23.5, 5.4);
  pad.fill(PAL.red);
  pad.ellipse(0, 0, 23.5, 5.4);
  pad.stroke(strokeOf(2.2));
  pad.ellipse(0, -1.5, 17, 2.6);
  pad.fill(0xb42e24);
  pad.ellipse(0, 1.5, 10.5, 2.1);
  pad.fill(0xfff6e4);
  pad.ellipse(0, 1.7, 3.1, 0.95);
  pad.fill(0xf3b2a4);
  bed.addChild(pad);
  root.addChild(bed);
  return { mesh: root, parts: { bed } };
}

function tarPit() {
  const root = new Container();
  const g = new Graphics();
  // Half again as wide as the old pool. No dirt ring. The black is the tar.
  for (const [x, y, rx, ry] of [[-6, 12, 54, 16.5], [-33, 10.8, 24, 10.5], [30, 11.4, 22.5, 10]]) {
    g.ellipse(x, y, rx, ry);
    g.fill(0x0c0b09);
  }
  g.ellipse(0, 15, 36, 9);
  g.fill(0x14110e);
  g.ellipse(-14, 18.5, 20, 3.4);
  g.fill({ color: 0x1c3a28, alpha: 0.55 });
  g.ellipse(12, 16.6, 9, 2.1);
  g.fill({ color: 0xd7d2c6, alpha: 0.18 });
  // A rib and a skull, stuck in the tar.
  g.moveTo(-18, 14);
  g.quadraticCurveTo(-8, 28, 2, 15);
  g.stroke(strokeOf(2.4, 0xe4dcc8));
  g.moveTo(-16, 16);
  g.quadraticCurveTo(-8, 24, 0, 16.5);
  g.stroke(strokeOf(1.5, 0xe4dcc8));
  g.ellipse(22, 20, 5.2, 4.2);
  g.fill(0xe4dcc8);
  g.circle(20.4, 21.2, 1.15);
  g.circle(23.8, 21.2, 1.15);
  g.fill(0x1a120c);
  for (const [x, y, h, lean] of [[-52, 6, 12, -2], [-40, 5, 8, 1.4], [40, 5.5, 9, -1], [52, 6, 11, 2.2], [6, 4, 7, 0.5]]) {
    g.poly([x, y, x + 2.4, y, x + 1.2 + lean, y + h]);
    g.fill(PAL.grassDark);
  }
  root.addChild(g);

  const bubbles = [];
  for (const [x, y, r] of [[16, 18, 3.6], [-12, 17, 2.6], [2, 20, 2], [-28, 15, 1.8]]) {
    const bubble = new Container();
    bubble.position.set(x, y);
    bubble.userData = { baseY: y };
    const ball = new Graphics();
    ball.circle(0, 0, r);
    ball.fill(0x2a261f);
    ball.circle(-r * 0.28, r * 0.3, r * 0.32);
    ball.fill({ color: 0xe7e2d6, alpha: 0.55 });
    bubble.addChild(ball);
    root.addChild(bubble);
    bubbles.push(bubble);
  }
  return { mesh: root, parts: { bubbles } };
}

const TRAP_OPEN = 0.9;
const TRAP_GREEN = 0x7ec84a;
const TRAP_GREEN_DARK = 0x2f8a34;
const TRAP_PINK = 0xf27d86;

// One jaw. The lip points up. sign flips it to the other side of the stem.
function trapLobe(sign) {
  const pivot = new Container();
  const g = new Graphics();
  const s = sign > 0 ? 1 : -1;
  paint(g, g, (p) => p.ellipse(s * 2, 22, 10, 18), TRAP_GREEN, 2.2);
  g.ellipse(s * 0.6, 24, 5.4, 11);
  g.fill(TRAP_PINK);
  const teeth = [6.2, 7.2, 6.4, 5.2];
  for (let i = 0; i < teeth.length; i++) {
    const y = 12 + i * 7;
    const base = s * -2;
    const tip = s * -(2 + teeth[i]);
    g.poly([base - s * 1.6, y - 2.1, base + s * 1.6, y + 2.1, tip, y]);
    g.fill(PAL.tooth);
  }
  pivot.addChild(g);
  pivot.rotation = sign > 0 ? -TRAP_OPEN : TRAP_OPEN;
  return pivot;
}

function trapHead(open) {
  const head = new Container();
  const lower = trapLobe(-1);
  const upper = trapLobe(1);
  if (open != null) {
    upper.rotation = -open;
    lower.rotation = open;
  }
  const tongue = new Graphics();
  tongue.ellipse(0, 12, 4.2, 7);
  tongue.fill(PAL.mouth);
  const knuckle = new Graphics();
  knuckle.circle(0, 0, 4.6);
  knuckle.fill(TRAP_GREEN_DARK);
  knuckle.circle(0, 0, 4.6);
  knuckle.stroke(strokeOf(2));
  head.addChild(tongue, lower, upper, knuckle);
  return { head, upper, lower };
}

function venus() {
  const root = new Container();
  const g = new Graphics();
  g.ellipse(0, 2, 11, 3);
  g.fill(TRAP_GREEN_DARK);
  g.ellipse(0, 2, 11, 3);
  g.stroke(strokeOf(1.8));
  paint(g, g, (p) => p.ellipse(-12, 7, 11, 3.6), TRAP_GREEN, 2);
  paint(g, g, (p) => p.ellipse(13, 6, 10, 3.2), TRAP_GREEN, 2);
  paint(g, g, (p) => p.roundRect(-4.5, 4, 9, 48, 4), TRAP_GREEN, 2.2);
  root.addChild(g);

  const main = trapHead();
  main.head.position.set(0, 50);
  root.addChild(main.head);

  return { mesh: root, parts: { head: main.head, upper: main.upper, lower: main.lower, open: TRAP_OPEN } };
}

// World is y-up. Bomb sits below the balloon bag; fuse and spark hang under it.
function bombCharge() {
  const root = new Container();
  const g = new Graphics();
  g.moveTo(0, -4);
  g.quadraticCurveTo(5, -12, 0, -18);
  g.stroke(strokeOf(1.4, 0x4a4038));
  paint(g, g, (p) => p.circle(0, -24, 8.5), 0x242424, 2.3);
  g.circle(-2.6, -21.2, 2.1);
  g.fill({ color: 0xffffff, alpha: 0.2 });
  g.moveTo(3, -17);
  g.quadraticCurveTo(8, -12, 6, -6);
  g.stroke(strokeOf(1.7, 0xc2a15a));
  root.addChild(g);

  const spark = new Graphics();
  spark.circle(0, 0, 2.3);
  spark.fill(0xffb703);
  spark.circle(-0.6, 0.6, 0.8);
  spark.fill(0xfff6d0);
  spark.position.set(6, -5);
  root.addChild(spark);
  return { root, spark };
}

function bombBalloon(color) {
  const root = new Container();
  const bag = new Graphics();
  paint(bag, bag, (p) => p.ellipse(0, 10, 15.5, 18.5), color, 2.5);
  bag.poly([-2.4, -6.5, 2.4, -6.5, 0, -11]);
  bag.fill(color);
  bag.stroke(strokeOf(2));
  bag.ellipse(-5.5, 16, 4.2, 7);
  bag.fill({ color: 0xffffff, alpha: 0.4 });
  root.addChild(bag);

  const charge = bombCharge();
  root.addChild(charge.root);
  return { mesh: root, parts: { spark: charge.spark } };
}

// Classic party balloon (y-up: bag high, knot and bomb low) hauling a bomb.
function partyBalloon(color) {
  const root = new Container();
  // Charge first (under), bag last so the balloon always paints above its bomb.
  const charge = bombCharge();
  // bombCharge centers the ball near local y=-24; sit it well under the knot.
  charge.root.position.set(0, -22);
  charge.root.scale.set(0.72);
  root.addChild(charge.root);

  const bag = new Graphics();
  // Tall oval above the origin, same orientation as the bomb-bag balloon.
  paint(bag, bag, (p) => p.ellipse(0, 16, 14, 20), color, 2.4);
  bag.poly([-3.2, -2, 3.2, -2, 0, -9]);
  bag.fill(color);
  bag.stroke(strokeOf(2));
  bag.ellipse(-5, 22, 4.2, 8);
  bag.fill({ color: 0xffffff, alpha: 0.38 });
  // Curly ribbon string hanging down toward the bomb.
  bag.moveTo(0, -9);
  bag.quadraticCurveTo(8, -16, 1, -24);
  bag.quadraticCurveTo(-7, -32, 0, -40);
  bag.stroke(strokeOf(1.6, 0x4a4038));
  root.addChild(bag);
  return { mesh: root, parts: { spark: charge.spark } };
}

function balloon(salt) {
  const n = Math.abs(Math.round(salt));
  const color = BALLOON_COLORS[n % BALLOON_COLORS.length];
  // About one in four. Hash the x salt so round coordinates do not bias the mix.
  const party = ((n * 2654435761) >>> 0) % 4 === 0;
  if (party) return partyBalloon(color);
  return bombBalloon(color);
}

export function createProp(type, salt) {
  if (type === 'tnt') return crate();
  if (type === 'trampoline') return trampoline();
  if (type === 'spikes') return tarPit();
  if (type === 'venus') return venus();
  return balloon(salt);
}

export function createStake() {
  const root = new Container();
  const g = new Graphics();
  g.roundRect(-2.2, 0, 4.4, 76, 1.2);
  g.fill(0xb4bec6);
  g.stroke(strokeOf(2));
  g.roundRect(-0.55, 3, 1.15, 66, 0.5);
  g.fill(0xe8eef2);
  g.circle(0, 76, 2.5);
  g.fill(0xd5dde4);
  g.circle(0, 76, 2.5);
  g.stroke(strokeOf(1.6));
  g.roundRect(2, 62, 38, 18, 3);
  g.fill(PAL.red);
  g.roundRect(2, 62, 38, 18, 3);
  g.stroke(strokeOf(2.2));
  root.addChild(g);

  const label = letter('', 96, 0xfff6e8);
  label.scale.set(0.2, -0.2);
  label.position.set(21, 71);
  root.addChild(label);
  root.paintRank = (rank) => {
    label.text = String(rank);
  };
  root.visible = false;
  return root;
}

export function createParticles(parent) {
  const g = new Graphics();
  parent.addChild(g);
  const pool = [];
  for (let i = 0; i < 360; i++) {
    pool.push({
      life: 0,
      max: 1,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      r: 4,
      color: 0xffffff,
      grow: 0.8,
      drag: 0,
      gravity: 40,
      fade: 1,
    });
  }

  // opts: { aim, spread, lift, grow, drag, gravity, jitter, fade }
  // aim is radians in world space (+x right, +y up). spread is half-angle.
  // fade scales peak opacity (1 = full).
  function spawn(x, y, color, count, speed, life, size, opts = {}) {
    const aim = opts.aim;
    const spread = opts.spread == null ? Math.PI : opts.spread;
    const lift = opts.lift == null ? 0.15 : opts.lift;
    const grow = opts.grow == null ? 0.8 : opts.grow;
    const drag = opts.drag || 0;
    const gravity = opts.gravity == null ? 40 : opts.gravity;
    const jitter = opts.jitter || 0;
    const fade = opts.fade == null ? 1 : opts.fade;
    let made = 0;
    for (let i = 0; i < pool.length && made < count; i++) {
      const p = pool[i];
      if (p.life > 0) continue;
      const a = aim == null
        ? Math.random() * Math.PI * 2
        : aim + (Math.random() * 2 - 1) * spread;
      const s = speed * (0.35 + Math.random() * 0.85);
      p.vx = Math.cos(a) * s;
      p.vy = aim == null
        ? Math.abs(Math.sin(a)) * s * 0.8 + speed * lift
        : Math.sin(a) * s + speed * lift * Math.random();
      p.life = life * (0.7 + Math.random() * 0.5);
      p.max = p.life;
      p.x = x + (Math.random() * 2 - 1) * jitter;
      p.y = y + (Math.random() * 2 - 1) * jitter;
      p.r = size * (0.28 + Math.random() * 0.28);
      p.color = color;
      p.grow = grow;
      p.drag = drag;
      p.gravity = gravity;
      p.fade = fade;
      made += 1;
    }
  }

  function update(dt) {
    g.clear();
    for (let i = 0; i < pool.length; i++) {
      const p = pool[i];
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) continue;
      const damp = Math.max(0, 1 - p.drag * dt);
      p.vx *= damp;
      p.vy *= damp;
      p.vy -= p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.r *= 1 + dt * p.grow;
      const t = Math.max(0, p.life / p.max);
      // Soft ease-out so puffs dissolve instead of hanging as a slab.
      const alpha = Math.min(1, (p.fade == null ? 1 : p.fade) * t * t * (3 - 2 * t));
      g.circle(p.x, p.y, Math.max(0.5, p.r));
      g.fill({ color: p.color, alpha });
    }
  }

  function clear() {
    for (let i = 0; i < pool.length; i++) pool[i].life = 0;
    g.clear();
  }

  return { spawn, update, clear };
}
