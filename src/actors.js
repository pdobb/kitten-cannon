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

  // One bean and one head. The old pile of circles read as lumps, and the
  // tail was four beads. Nose stays toward +X. Local (20, 0) is that way.
  const headX = 16.5;
  const headR = 7.2;
  furShape((p) => {
    p.moveTo(10, 0.4);
    p.bezierCurveTo(8, 6.2, 1, 7.6, -6, 5.6);
    p.bezierCurveTo(-13, 3.6, -14.5, -1.2, -11, -4.6);
    p.bezierCurveTo(-7.5, -7.4, 0, -7.6, 7, -4.2);
    p.bezierCurveTo(11.5, -2, 12.4, -0.6, 10, 0.4);
    p.closePath();
  });
  furShape((p) => p.circle(headX, 2.2, headR));
  darkShape((p) => p.poly([12.6, 6.8, 15.6, 14.6, 19.6, 6.2]));

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

  paint(detail, ink, (p) => p.ellipse(-1, -3.2, 5.6, 2.8), PAL.belly, 2);
  paint(detail, ink, (p) => p.poly([13.8, 7.4, 15.6, 12.8, 17.8, 7]), PAL.ear, 1.6);
  paint(detail, ink, (p) => p.ellipse(15.4, 6.6, 6.4, 3.2), PAL.leather, 2);
  paint(detail, ink, (p) => p.roundRect(11.6, 8, 8.4, 2, 1), PAL.leatherDark, 1.8);
  paint(detail, ink, (p) => p.roundRect(12.8, -0.8, 6.8, 4.2, 2), PAL.leatherDark, 1.8);
  paint(detail, ink, (p) => p.ellipse(21.8, 1.2, 3.3, 2.4), PAL.belly, 1.8);
  paint(detail, ink, (p) => p.ellipse(24.2, 1.4, 1.25, 0.95), PAL.nose, 1.4);

  detail.moveTo(22.6, 0.2);
  detail.quadraticCurveTo(23.6, -0.6, 24.6, 0.15);
  detail.stroke(strokeOf(1.3, INK));
  for (const [y, tilt] of [[2.4, 0.7], [1.5, 0], [0.6, -0.6]]) {
    detail.moveTo(22.4, y);
    detail.lineTo(28.5, y + tilt);
    detail.stroke(strokeOf(1.05, 0x5c5148));
  }

  const eye = new Container();
  eye.position.set(16.2, 1.2);
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
    ink.stroke(strokeOf(2.3));
  }

  root.addChild(tail, fur, dark, detail, eye, ink);

  let coatIndex = 0;
  fur.tint = COATS[0][0];
  tailFur.tint = COATS[0][0];
  dark.tint = COATS[0][1];

  function recolor() {
    let next = Math.floor(Math.random() * COATS.length);
    if (next === coatIndex) next = (next + 1) % COATS.length;
    coatIndex = next;
    fur.tint = COATS[next][0];
    tailFur.tint = COATS[next][0];
    dark.tint = COATS[next][1];
  }

  return {
    mesh: root,
    eye,
    tail,
    recolor,
    coat() { return COATS[coatIndex][0]; },
    // Eyes clear the lip. The helmet sits high, so the body rides a little low
    // in the bore and the face stays in the opening.
    seat: { x: MUZZLE_LIP - (headX - headR) - 3, y: -4.5 },
  };
}

export function createCannon() {
  const root = new Container();
  root.position.set(CANNON_X, 0);
  const g = new Graphics();
  const ink = new Graphics();

  // Far wheel shares the ground line and only peeks out behind the near one.
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

  // Near wheel. The grass tops out near y = 10, so a bottom at y = 6 sits in it.
  paint(g, ink, (p) => p.circle(16, 29, 23), PAL.wood, 2.6);
  g.circle(16, 29, 16);
  g.fill(0x9a6236);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI;
    g.moveTo(16 + Math.cos(a) * 5, 29 + Math.sin(a) * 5);
    g.lineTo(16 + Math.cos(a) * 15.5, 29 + Math.sin(a) * 15.5);
    g.stroke(strokeOf(2.4, PAL.woodDark));
  }
  paint(g, ink, (p) => p.circle(16, 29, 5), PAL.brass, 2);

  // Cheek around the trunnion, overlapping the wheel so the barrel has a seat.
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
  const g = new Graphics();
  for (const x of [-24, 24]) {
    g.roundRect(x - 2, 2, 4, 16, 1.5);
    g.fill(0xc5ced6);
  }
  paint(g, g, (p) => p.roundRect(-32, 14, 64, 5, 2), PAL.metalDark, 2.2);
  root.addChild(g);

  const bed = new Container();
  bed.position.set(0, 18);
  const pad = new Graphics();
  pad.roundRect(-29, 0, 58, 8, 3);
  pad.fill(PAL.red);
  pad.roundRect(-29, 0, 58, 8, 3);
  pad.stroke(strokeOf(2.2));
  bed.addChild(pad);

  const stripe = new Graphics();
  stripe.roundRect(-29, -1.2, 58, 2.6, 1);
  stripe.fill(PAL.cream);
  stripe.position.y = 25.2;
  root.addChild(bed, stripe);
  return { mesh: root, parts: { bed, stripe } };
}

function tarPit() {
  const root = new Container();
  const g = new Graphics();
  paint(g, g, (p) => p.ellipse(-2, 5, 42, 13), 0x8a552c, 2.4);
  g.ellipse(2, 7, 34, 9);
  g.fill(0x5c3a22);
  paint(g, g, (p) => p.ellipse(0, 10, 30, 8), PAL.tar, 2.3);
  g.ellipse(-8, 12.4, 12, 2.1);
  g.fill({ color: 0x6a625a, alpha: 0.9 });
  g.ellipse(6, 11, 5, 1.2);
  g.fill({ color: 0xc8c0b4, alpha: 0.35 });
  root.addChild(g);

  const bubbles = [];
  for (const [x, y, r] of [[11, 14.2, 2.5], [-9, 13.2, 1.8], [0.5, 15.4, 1.35]]) {
    const bubble = new Container();
    bubble.position.set(x, y);
    bubble.userData = { baseY: y };
    const ball = new Graphics();
    ball.circle(0, 0, r);
    ball.fill(0x3f3832);
    ball.circle(-r * 0.28, r * 0.32, r * 0.34);
    ball.fill(0x8a837a);
    bubble.addChild(ball);
    root.addChild(bubble);
    bubbles.push(bubble);
  }
  return { mesh: root, parts: { bubbles } };
}

const TRAP_OPEN = 0.72;

function lobe(sign) {
  const pivot = new Container();
  const g = new Graphics();
  g.ellipse(-17, 0, 17, 7.2);
  g.fill(PAL.leaf);
  g.ellipse(-17, 0, 17, 7.2);
  g.stroke(strokeOf(2.5));
  g.ellipse(-16, sign * -1.4, 12, 3.8);
  g.fill(PAL.mouth);
  g.circle(-6, sign * -1.6, 3.2);
  g.fill(PAL.throat);
  const dir = sign > 0 ? -1 : 1;
  for (let i = 0; i < 6; i++) {
    const x = -8 - i * 3.6;
    const base = dir * -2.4;
    const tip = dir * -8;
    g.poly([x, base, x + 1.7, base, x + 0.85, tip]);
    g.fill(PAL.tooth);
  }
  pivot.addChild(g);
  pivot.rotation = sign > 0 ? -TRAP_OPEN : TRAP_OPEN;
  return pivot;
}

function venus() {
  const root = new Container();
  const g = new Graphics();
  for (let i = 0; i < 5; i++) {
    const ang = -1.15 + i * 0.55;
    g.ellipse(Math.cos(ang) * 14, 5 + Math.sin(ang) * 6, 13, 4.2);
    g.fill(i % 2 ? PAL.leaf : PAL.leafDark);
  }
  paint(g, g, (p) => p.roundRect(-1, 8, 8, 34, 4), PAL.leafDark, 2.2);
  root.addChild(g);

  const head = new Container();
  head.position.set(6, 46);
  const upper = lobe(1);
  const lower = lobe(-1);
  head.addChild(lower, upper);
  root.addChild(head);
  return { mesh: root, parts: { head, upper, lower, open: TRAP_OPEN } };
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
  g.fill(0xf4f0e4);
  g.stroke(strokeOf(2));
  for (let i = 0; i < 5; i++) {
    g.rect(-2.8, 14 + i * 11, 5.6, 6.5);
    g.fill(i % 2 ? PAL.red : 0xf7f3ea);
  }
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

  return { spawn, update };
}
