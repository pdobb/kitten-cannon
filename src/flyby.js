import { Container, Graphics } from 'pixi.js';
import { paint, strokeOf } from './look.js';
import { CAM_Z, viewHalfWidthAt } from './view.js';

// Visitors wait until the kitten is above the low cloud lanes.
export const FLYBY_Y = 980;
// Most high flights get a visitor (~2 in 3). Re-rolls every FLYBY_EVERY_FT.
export const FLYBY_CHANCE = 0.67;
// After the first high roll, try again every this many feet of travel.
export const FLYBY_EVERY_FT = 10000;

const INK = 0x2b2118;
const STROKE = 0x6a3d16;

function ufo() {
  const root = new Container();
  const g = new Graphics();
  const ink = new Graphics();
  paint(g, ink, (p) => p.ellipse(0, -2, 72, 12), 0x5fd0c4, 2.6);
  paint(g, ink, (p) => p.ellipse(0, 3, 58, 17), 0xd5dee8, 2.6);
  g.ellipse(0, -6, 48, 8);
  g.fill({ color: 0x8b97a4, alpha: 0.55 });
  g.ellipse(-12, 9, 24, 6);
  g.fill({ color: 0xffffff, alpha: 0.5 });
  g.ellipse(0, 1, 36, 7);
  g.stroke(strokeOf(1.5, 0x8b97a3));
  g.ellipse(0, -8, 16, 4);
  g.fill({ color: 0xdcff8a, alpha: 0.85 });
  paint(g, ink, (p) => p.ellipse(0, 16, 24, 15), 0x9ae6ff, 2.4);
  g.ellipse(-7, 20, 8, 5);
  g.fill({ color: 0xffffff, alpha: 0.4 });
  g.ellipse(1, 17, 8, 6.5);
  g.fill(0x6ec85a);
  g.circle(-1.6, 18.4, 2.1);
  g.circle(3.4, 18.4, 2.1);
  g.fill(0x142018);
  g.circle(-1.1, 19, 0.7);
  g.circle(3.9, 19, 0.7);
  g.fill(0xffffff);
  paint(g, ink, (p) => p.circle(0, 31, 3.4), 0xe7eef6, 1.8);
  root.addChild(g, ink);

  const glow = new Graphics();
  glow.ellipse(0, -8, 12, 5);
  glow.fill(0xdcff8a);
  glow.ellipse(0, -8, 6, 2.6);
  glow.fill(0xf6ffe0);
  root.addChild(glow);

  const lights = new Container();
  const bulbs = [];
  const colors = [0x39e07a, 0xffe56a, 0xff5a7a, 0x7ec8ff, 0xd07bff];
  for (let i = 0; i < 7; i++) {
    const bulb = new Graphics();
    const x = -48 + i * 16;
    bulb.circle(x, -2, 3.6);
    bulb.fill(colors[i % colors.length]);
    bulb.circle(x - 0.8, -1, 1.1);
    bulb.fill({ color: 0xffffff, alpha: 0.65 });
    lights.addChild(bulb);
    bulbs.push(bulb);
  }
  root.addChild(lights);
  return { mesh: root, parts: { lights, bulbs, glow } };
}

// Flit cameos (Gabe-Torres/flit). Drawn in KC style from those silhouettes.
// Local +X is beak-forward; launch flips the mesh when flying left.
// Art sits on an inner node so parallax scale on the root does not erase size.
// 0.8 keeps Flit cameos readable next to the UFO without matching its full bulk.
const BIRD_SCALE = 0.8;

function birdShell() {
  const mesh = new Container();
  const art = new Container();
  art.scale.set(BIRD_SCALE);
  mesh.addChild(art);
  return { mesh, art };
}

function flamingo() {
  const { mesh, art } = birdShell();
  const body = new Graphics();
  const ink = new Graphics();
  const wing = new Graphics();
  // Trailing legs.
  body.moveTo(-18, -6);
  body.lineTo(-28, -22);
  body.moveTo(-8, -8);
  body.lineTo(-14, -26);
  body.stroke(strokeOf(3.2, 0xf4b183));
  paint(body, ink, (p) => p.ellipse(-2, 2, 28, 16), 0xff8fb8, 2.4);
  // Long S-neck up to the head.
  paint(body, ink, (p) => {
    p.moveTo(18, 8);
    p.bezierCurveTo(28, 18, 42, 28, 52, 18);
    p.bezierCurveTo(58, 12, 56, 4, 48, 2);
    p.bezierCurveTo(40, 0, 28, 6, 20, 6);
    p.closePath();
  }, 0xff8fb8, 2.2);
  paint(body, ink, (p) => p.circle(50, 6, 10), 0xffb7cf, 2);
  paint(body, ink, (p) => p.poly([58, 4, 78, -6, 60, 10]), 0xfffdf6, 1.6);
  body.circle(52, 10, 2.4);
  body.fill(0xffffff);
  body.circle(53, 10, 1.2);
  body.fill(INK);
  paint(wing, ink, (p) => p.ellipse(2, 10, 22, 10), 0xff6fa8, 2);
  wing.ellipse(6, 12, 10, 4);
  wing.fill({ color: 0xffd0e0, alpha: 0.55 });
  art.addChild(body, ink, wing);
  return { mesh, parts: { bulbs: [], wings: [wing] } };
}

function magpie() {
  const { mesh, art } = birdShell();
  const body = new Graphics();
  const ink = new Graphics();
  const wing = new Graphics();
  paint(wing, ink, (p) => p.poly([-8, 4, -48, 18, -10, -8, 8, 0]), 0x1a2330, 2.2);
  wing.poly([-12, 2, -40, 12, -14, -2]);
  wing.fill(0x149a96);
  paint(body, ink, (p) => p.ellipse(0, 0, 24, 16), 0x1a2330, 2.4);
  paint(body, ink, (p) => p.ellipse(2, -6, 12, 8), 0xfffdf6, 1.8);
  paint(body, ink, (p) => p.ellipse(6, 6, 8, 5), 0xfffdf6, 1.6);
  paint(body, ink, (p) => p.ellipse(22, 4, 12, 10), 0x1a2330, 2.2);
  paint(body, ink, (p) => p.poly([32, 4, 58, 0, 34, -4]), 0x241c16, 1.8);
  body.circle(28, 8, 2.6);
  body.fill(0xffffff);
  body.circle(28, 8, 2.6);
  body.stroke(strokeOf(1.2, STROKE));
  body.circle(29, 8, 1.2);
  body.fill(INK);
  art.addChild(wing, body, ink);
  return { mesh, parts: { bulbs: [], wings: [wing] } };
}

function pelican() {
  const { mesh, art } = birdShell();
  const body = new Graphics();
  const ink = new Graphics();
  const wing = new Graphics();
  paint(wing, ink, (p) => p.poly([-6, 6, -52, 16, -8, -10, 10, 2]), 0xfffdf6, 2.2);
  wing.poly([-10, 2, -36, 8, -12, -4]);
  wing.fill(0xf3efe6);
  paint(body, ink, (p) => p.ellipse(0, 0, 26, 16), 0xfffdf6, 2.4);
  paint(body, ink, (p) => p.ellipse(2, -6, 14, 7), 0xf3efe6, 1.8);
  paint(body, ink, (p) => p.ellipse(22, 6, 12, 10), 0xfffdf6, 2.1);
  // Long yellow beak and orange pouch.
  paint(body, ink, (p) => p.poly([32, 4, 72, 2, 72, -2, 34, -2]), 0xf2c14b, 1.8);
  paint(body, ink, (p) => p.poly([64, 0, 80, -4, 66, -6]), 0xc45c28, 1.4);
  paint(body, ink, (p) => p.poly([30, -2, 40, -18, 56, -28, 70, -10, 72, -2, 48, -4]), 0xef8a2a, 1.8);
  body.poly([40, -8, 56, -22, 66, -8]);
  body.fill(0xffd27a);
  body.circle(26, 10, 2.4);
  body.fill(0xffffff);
  body.circle(26, 10, 2.4);
  body.stroke(strokeOf(1.1, STROKE));
  body.circle(27, 10, 1.1);
  body.fill(INK);
  art.addChild(wing, body, ink);
  return { mesh, parts: { bulbs: [], wings: [wing] } };
}

function bat() {
  const { mesh, art } = birdShell();
  const body = new Graphics();
  const ink = new Graphics();
  const wing = new Graphics();
  // Membrane wing, hinged near the shoulder.
  paint(wing, ink, (p) => p.poly([0, 2, -20, 28, -44, 18, -36, 2, -48, -8, -16, 0]), 0x3a2848, 2);
  paint(body, ink, (p) => p.ellipse(0, 0, 16, 11), 0x2b2118, 2.2);
  paint(body, ink, (p) => p.circle(16, 4, 12), 0x2b2118, 2);
  // Pointed ears with pink inners.
  paint(body, ink, (p) => p.poly([8, 10, 12, 28, 18, 10]), 0x2b2118, 1.6);
  paint(body, ink, (p) => p.poly([10, 12, 13, 24, 16, 12]), 0xf3a0b0, 1.2);
  paint(body, ink, (p) => p.poly([18, 10, 24, 30, 28, 10]), 0x2b2118, 1.6);
  paint(body, ink, (p) => p.poly([20, 12, 24, 24, 26, 12]), 0xf3a0b0, 1.2);
  paint(body, ink, (p) => p.ellipse(26, -2, 5, 3.4), 0x3a2a22, 1.4);
  paint(body, ink, (p) => p.circle(18, 6, 3.6), 0xf2c14b, 1.4);
  body.circle(19, 6, 1.6);
  body.fill(INK);
  // Tiny fangs.
  body.poly([24, -4, 26, -10, 28, -4]);
  body.poly([28, -4, 30, -9, 32, -3]);
  body.fill(0xfffdf6);
  body.stroke(strokeOf(0.9, INK));
  art.addChild(wing, body, ink);
  return { mesh, parts: { bulbs: [], wings: [wing] } };
}

// Flit pterodactyl silhouette (Gabe-Torres/flit), beak toward local +X.
function pterodactyl() {
  const { mesh, art } = birdShell();
  const body = new Graphics();
  const ink = new Graphics();
  const wing = new Graphics();
  // Trailing membrane; flap rotates this node.
  paint(wing, ink, (p) => p.poly([2, 0, -32, 16, -24, -2, -4, -10]), 0xb56538, 2.2);
  wing.moveTo(0, 0);
  wing.lineTo(-28, 10);
  wing.stroke(strokeOf(2.2, 0x6b3a22));
  paint(body, ink, (p) => p.ellipse(-2, -2, 13, 8), 0xd4843f, 2.4);
  body.ellipse(0, -6, 7, 3.6);
  body.fill(0xf6d7a2);
  paint(body, ink, (p) => p.ellipse(12, 1, 6.5, 5.2), 0xd4843f, 2);
  // Red crest.
  paint(body, ink, (p) => p.poly([8, 5, 2, 18, 14, 3]), 0xe15a42, 1.8);
  paint(body, ink, (p) => p.poly([16, 2, 36, 0, 16, -4]), 0xf2c14b, 2);
  body.poly([16, -1, 28, -3, 16, -5]);
  body.fill(0xe7a23a);
  body.circle(13, 2, 2.1);
  body.fill(0xffffff);
  body.circle(13.6, 2, 1);
  body.fill(INK);
  // Short legs.
  body.moveTo(-2, -8);
  body.lineTo(-5, -16);
  body.moveTo(4, -8);
  body.lineTo(6, -16);
  body.stroke(strokeOf(2.2, 0x6b3a22));
  art.addChild(wing, body, ink);
  return { mesh, parts: { bulbs: [], wings: [wing] } };
}

// Neon Runner (thomasbreland/neon-runner) via Flit's runner skin. Flit draws
// y-down; KC world is y-up, so Y is negated. Local +X is travel-forward.
// Tiny: sits on distant snow peaks behind nearer hills.
const RUNNER_SCALE = 0.62;

function neonRunner() {
  const mesh = new Container();
  const art = new Container();
  // Lift so the gold disc sits near local y = 0 (ridge contact).
  art.position.y = 17.5 * RUNNER_SCALE;
  art.scale.set(RUNNER_SCALE);
  mesh.addChild(art);
  const body = new Graphics();
  const ink = new Graphics();
  // Dark side face, light top plane, cyan torso, magenta visor stripe, gold disc.
  paint(body, ink, (p) => p.poly([6, 11, 13, 16, 13, -9, 6, -14]), 0x3aa8d4, 1.2);
  paint(body, ink, (p) => p.poly([-8, 11, 6, 11, 13, 16, -1, 16]), 0xd8f6ff, 1.2);
  paint(body, ink, (p) => p.poly([-8, 11, 6, 11, 6, -14, -8, -14]), 0x7bdcff, 1.4);
  body.poly([-8, 4, 6, 4, 6, 0.5, -8, 0.5]);
  body.fill(0xff4bd8);
  paint(body, ink, (p) => p.ellipse(-1, -17.5, 11, 3.4), 0xffd166, 1.2);
  body.ellipse(-1, -17.2, 6.5, 1.5);
  body.fill(0xfff0b8);
  const glow = new Graphics();
  glow.ellipse(-1, -17.5, 12, 4);
  glow.fill({ color: 0x7bdcff, alpha: 0.22 });
  glow.ellipse(-1, -17.5, 7, 2);
  glow.fill({ color: 0xffd166, alpha: 0.28 });
  art.addChild(glow, body, ink);
  return { mesh, parts: { bulbs: [], wings: [], glow, art } };
}

const MAKERS = {
  ufo,
  flamingo,
  magpie,
  pelican,
  bat,
  pterodactyl,
  runner: neonRunner,
};
const VISITORS = ['ufo', 'flamingo', 'magpie', 'pelican', 'bat', 'pterodactyl', 'runner'];

// Snow-capped ranges only (far + mid). Prefer far — way back, occluded by nearer hills.
const RIDGE_LANES = [
  { lane: 0, parallax: 0.12, z: -7187 },
  { lane: 1, parallax: 0.28, z: -2520 },
];

// Shuffle bag: each kind once per cycle so the UFO is not streakier than birds.
function freshBag() {
  const bag = VISITORS.slice();
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = bag[i];
    bag[i] = bag[j];
    bag[j] = t;
  }
  return bag;
}

function parallaxFor(z) {
  return CAM_Z / (CAM_Z - z);
}

// opts.ridgeAt(lane, camX, drawX) -> { y, slope }
// opts.ridgeLayer(lane) -> Container behind nearer hills (snow peaks only).
export function createFlybys(layer, opts = null) {
  const ridgeAt = typeof opts === 'function' ? opts : (opts && opts.ridgeAt);
  const ridgeLayer = opts && opts.ridgeLayer;
  const crafts = [];
  let wait = 0;
  let coming = false;
  // Travel-feet band of the last spawn roll (−1 = not yet).
  let lastBand = -1;
  let bag = freshBag();

  function pickKind() {
    if (bag.length < 1) bag = freshBag();
    return bag.pop();
  }

  function parentFor(spec) {
    if (spec.ridge && ridgeLayer) {
      const nest = ridgeLayer(spec.ridgeLane);
      if (nest) return nest;
    }
    return layer;
  }

  function add(type, spec) {
    const built = MAKERS[type]();
    const parent = parentFor(spec);
    const craft = {
      kind: type,
      mesh: built.mesh,
      parts: built.parts,
      parent,
      x: spec.x,
      y: spec.y,
      z: spec.z,
      vx: spec.vx,
      vy: spec.vy,
      phase: spec.phase == null ? Math.random() * Math.PI * 2 : spec.phase,
      age: 0,
      ridge: !!spec.ridge,
      ridgeLane: spec.ridgeLane == null ? 0 : spec.ridgeLane,
    };
    parent.addChild(craft.mesh);
    crafts.push(craft);
    return craft;
  }

  function drop(craft) {
    if (craft.parent) craft.parent.removeChild(craft.mesh);
    craft.mesh.destroy({ children: true });
  }

  // kittenVx helps right-bound visitors outrun the camera so they still cross.
  // Birds and the UFO share the same speed band so each kind stays on screen alike.
  function launch(cam, kittenY, kind, at, kittenVx = 0) {
    // Rockets are gone. Asking for one does not launch a visitor instead.
    if (kind === 'rocket' || kind === 'starship') return;
    const type = MAKERS[kind] ? kind : pickKind();
    const dir = at && at.vx != null
      ? (at.vx >= 0 ? 1 : -1)
      : (Math.random() < 0.5 ? 1 : -1);
    // Neon Runner skis snow crests slowly — far preferred, behind nearer hills.
    if (type === 'runner') {
      let lane = RIDGE_LANES[Math.random() < 0.7 ? 0 : 1];
      if (at && at.z != null) {
        lane = RIDGE_LANES.reduce((best, next) => (
          Math.abs(next.z - at.z) < Math.abs(best.z - at.z) ? next : best
        ));
      }
      const z = at && at.z != null ? at.z : lane.z;
      // Slow crawl; parallax damps on-screen speed further.
      const base = 55 + Math.random() * 35;
      const chase = dir > 0 ? Math.max(0, kittenVx) * 0.25 + 12 : 0;
      const speed = at && at.vx != null ? Math.abs(at.vx) : base + chase;
      const lead = 900 + Math.random() * 320;
      add(type, {
        x: at && at.x != null ? cam.x + at.x : cam.x - dir * lead,
        y: 180,
        z,
        vx: at && at.vx != null ? at.vx : dir * speed,
        vy: 0,
        ridge: true,
        ridgeLane: lane.lane,
      });
      return;
    }
    const base = 70 + Math.random() * 30;
    // Camera tracks a rightward kitten. Against-traffic (dir < 0) crosses easily;
    // with-traffic needs a push or it stays off the left edge forever.
    const chase = dir > 0 ? Math.max(0, kittenVx) * 0.85 + 40 : 0;
    const speed = base + chase;
    // Closer than the old −5400 lane so Flit cameos read clearly, not as specks.
    const z = at && at.z != null ? at.z : -3200 - Math.random() * 1000;
    const lead = viewHalfWidthAt(z) + (dir > 0 ? 360 : 220) + Math.random() * 280;
    const lift = (Math.random() < 0.6 ? 1 : -1) * (220 + Math.random() * 180);
    add(type, {
      x: at && at.x != null ? cam.x + at.x : cam.x - dir * lead,
      y: at && at.y != null ? kittenY + at.y : kittenY + lift,
      z,
      vx: at && at.vx != null ? at.vx : dir * speed,
      vy: at && at.vy != null ? at.vy : (Math.random() - 0.5) * 8,
    });
  }

  function update(time, dt, cam, kittenY, flying, kittenVx = 0, travelFeet = 0) {
    for (let i = crafts.length - 1; i >= 0; i--) {
      const craft = crafts[i];
      const parallax = parallaxFor(craft.z);
      craft.age += dt;
      craft.x += craft.vx * dt;
      const face = (craft.vx || 1) >= 0 ? 1 : -1;
      const drawX = cam.x + (craft.x - cam.x) * parallax;
      let drawY;
      let grade = 0;
      if (craft.ridge) {
        // Sit on the painted crest (absolute Y, like the ranges). Ski the grade.
        const hover = Math.sin(time * 4.2 + craft.phase) * 2;
        if (ridgeAt) {
          const crest = ridgeAt(craft.ridgeLane, cam.x, drawX);
          craft.y = crest.y + hover + 4;
          grade = crest.slope;
        } else {
          craft.y = 180 + hover;
        }
        drawY = craft.y;
      } else {
        craft.y += craft.vy * dt;
        drawY = cam.y + (craft.y - cam.y) * parallax + Math.sin(time * 1.5 + craft.phase) * 10;
      }
      // Ridge runners keep depth scale from parallax so far snow reads tiny.
      const shown = craft.ridge ? Math.max(0.22, parallax * 1.15) : parallax / 0.2;
      craft.mesh.position.set(drawX, drawY);
      if (craft.ridge) {
        craft.mesh.scale.set(shown * face, shown);
        // Pitch with the slope like a car on the road; tiny hover wobble.
        craft.mesh.rotation = face * Math.atan(grade) + Math.sin(time * 2.6 + craft.phase) * 0.025;
      } else {
        craft.mesh.scale.set(shown * face, shown);
        craft.mesh.rotation = Math.sin(time * 1.2 + craft.phase) * 0.1;
      }
      if (craft.parts.glow) {
        craft.parts.glow.alpha = craft.ridge
          ? 0.35 + Math.sin(time * 5 + craft.phase) * 0.2
          : 0.65 + Math.sin(time * 7 + craft.phase) * 0.35;
      }
      const bulbs = craft.parts.bulbs || [];
      for (let b = 0; b < bulbs.length; b++) {
        const wave = Math.sin(time * 4 + craft.phase + b * 0.9);
        bulbs[b].alpha = 0.45 + Math.max(0, wave) * 0.55;
      }
      const wings = craft.parts.wings || [];
      for (let w = 0; w < wings.length; w++) {
        wings[w].rotation = Math.sin(time * 9 + craft.phase) * 0.42;
      }
      // Despawn once past the far edge. Age cap is a long safety only — birds
      // used to use a faster lane and vanish before you could clock them.
      const past = Math.abs(craft.x - cam.x) > viewHalfWidthAt(craft.z) + 420
        && Math.sign(craft.x - cam.x) === Math.sign(craft.vx || 1);
      if (past || craft.age > 72) {
        drop(craft);
        crafts.splice(i, 1);
      }
    }

    const high = flying && kittenY >= FLYBY_Y;
    if (!high) return;
    // Band 0 on first high moment, then every FLYBY_EVERY_FT of travel.
    const band = Math.max(0, Math.floor(travelFeet / FLYBY_EVERY_FT));
    if (band > lastBand) {
      lastBand = band;
      if (!coming && Math.random() < FLYBY_CHANCE) {
        coming = true;
        // Short wait so the visitor still crosses before a short hop lands.
        wait = 0.4 + Math.random() * 1.2;
      }
    }
    if (!coming) return;
    wait -= dt;
    // Ridge skiers live on a deeper layer and linger; they do not block sky visitors.
    const skyBusy = crafts.some((c) => !c.ridge);
    if (wait <= 0 && !skyBusy) {
      launch(cam, kittenY, null, null, kittenVx);
      coming = false;
    }
  }

  function clear() {
    for (let i = crafts.length - 1; i >= 0; i--) {
      drop(crafts[i]);
      crafts.splice(i, 1);
    }
    wait = 0;
    coming = false;
    lastBand = -1;
    bag = freshBag();
  }

  return {
    update,
    clear,
    launch,
    stats() {
      return crafts.map((craft) => ({
        kind: craft.kind,
        x: craft.x,
        y: craft.y,
        z: craft.z,
      }));
    },
  };
}
