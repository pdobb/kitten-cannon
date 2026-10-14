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

export function createKitten() {
  const root = new Container();
  const fur = new Graphics();
  const dark = new Graphics();
  const detail = new Graphics();
  const ink = new Graphics();
  const furPaths = [];
  const darkPaths = [];

  function coat(paths, target, trace) {
    trace(target);
    target.fill(0xffffff);
    paths.push(trace);
  }
  const furShape = (trace) => coat(furPaths, fur, trace);
  const darkShape = (trace) => coat(darkPaths, dark, trace);

  // A round head on a round body. Nose stays toward +X.
  // The skull's back is headX - headR, which seats the head outside the muzzle.
  const headX = 16.5;
  const headR = 7.2;
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
  furShape((p) => p.circle(headX, 2.2, headR));
  darkShape((p) => p.poly([13.2, 8.4, 16.2, 17.4, 19.4, 8.2]));

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
  paint(detail, ink, (p) => p.poly([14.4, 9.2, 16.2, 15.4, 18.2, 9.0]), PAL.ear, 1.5);
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
  for (const trace of darkPaths) {
    trace(ink);
    ink.stroke(strokeOf(2.2));
  }

  // Legs sit under the body. The ear outline is on top so the tip stays a clean point.
  root.addChild(tail, legs, legInk, fur, dark, detail, eye, ink);

  let coatIndex = 0;
  fur.tint = COATS[0][0];
  legs.tint = COATS[0][0];
  tailFur.tint = COATS[0][0];
  dark.tint = COATS[0][1];

  function recolor() {
    let next = Math.floor(Math.random() * COATS.length);
    if (next === coatIndex) next = (next + 1) % COATS.length;
    coatIndex = next;
    fur.tint = COATS[next][0];
    legs.tint = COATS[next][0];
    tailFur.tint = COATS[next][0];
    dark.tint = COATS[next][1];
  }

  return {
    mesh: root,
    eye,
    tail,
    recolor,
    coat() { return COATS[coatIndex][0]; },
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

  pivot.addChild(bore, barrel, barrelInk, ticks, muzzle);
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
  return { root, pivot, ticks, muzzle };
}

function crate() {
  const root = new Container();
  const g = new Graphics();
  paint(g, g, (p) => p.roundRect(-25, 4, 50, 46, 5), PAL.red, 2.6);
  g.roundRect(-25, 18, 50, 16, 0);
  g.fill(PAL.cream);
  g.roundRect(-25, 18, 50, 16, 0);
  g.stroke(strokeOf(2.2));
  for (const [x, y] of [[-18, 10], [18, 10], [-18, 42], [18, 42]]) {
    g.circle(x, y, 2.1);
    g.fill(0x7a2418);
  }
  root.addChild(g);
  const label = letter('TNT', 72, 0x1c140f);
  label.scale.set(0.42, -0.42);
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

function balloon(salt) {
  const root = new Container();
  const color = BALLOON_COLORS[Math.abs(Math.round(salt)) % BALLOON_COLORS.length];
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

  const bag = new Graphics();
  paint(bag, bag, (p) => p.ellipse(0, 10, 15.5, 18.5), color, 2.5);
  bag.poly([-2.4, -6.5, 2.4, -6.5, 0, -11]);
  bag.fill(color);
  bag.stroke(strokeOf(2));
  bag.ellipse(-5.5, 16, 4.2, 7);
  bag.fill({ color: 0xffffff, alpha: 0.4 });
  root.addChild(bag);
  return { mesh: root, parts: { spark } };
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
  for (let i = 0; i < 280; i++) {
    pool.push({ life: 0, max: 1, x: 0, y: 0, vx: 0, vy: 0, r: 4, color: 0xffffff });
  }

  function spawn(x, y, color, count, speed, life, size) {
    let made = 0;
    for (let i = 0; i < pool.length && made < count; i++) {
      const p = pool[i];
      if (p.life > 0) continue;
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.35 + Math.random() * 0.85);
      p.vx = Math.cos(a) * s;
      p.vy = Math.abs(Math.sin(a)) * s * 0.8 + speed * 0.15;
      p.life = life * (0.7 + Math.random() * 0.5);
      p.max = p.life;
      p.x = x;
      p.y = y;
      p.r = size * (0.28 + Math.random() * 0.28);
      p.color = color;
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
      p.vy -= 40 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.r *= 1 + dt * 0.8;
      g.circle(p.x, p.y, Math.max(0.5, p.r));
      g.fill({ color: p.color, alpha: Math.max(0, p.life / p.max) });
    }
  }

  function clear() {
    for (let i = 0; i < pool.length; i++) pool[i].life = 0;
    g.clear();
  }

  return { spawn, update, clear };
}
