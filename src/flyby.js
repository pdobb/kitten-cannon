import { Container, Graphics } from 'pixi.js';
import { paint, strokeOf } from './look.js';
import { CAM_Z, viewHalfWidthAt } from './view.js';

// Visitors wait until the kitten is above the low cloud lanes.
export const FLYBY_Y = 980;
// A climb past FLYBY_Y rolls once. A little rare, not exceedingly rare.
const FLYBY_CHANCE = 0.28;

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
// Kitten body is ~28 wide; long bird art is ~100–130, so ~0.35 reads cat-sized.
const BIRD_SCALE = 0.35;

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

function pterodactyl() {
  const { mesh, art } = birdShell();
  const body = new Graphics();
  const ink = new Graphics();
  const wing = new Graphics();
  paint(wing, ink, (p) => p.poly([0, 4, -20, 36, -64, 22, -8, -6, 12, 2]), 0xb56538, 2.2);
  paint(body, ink, (p) => p.ellipse(0, 0, 24, 14), 0xd4843f, 2.4);
  // Red head crest.
  paint(body, ink, (p) => p.poly([-4, 10, -18, 32, 4, 6]), 0xe15a42, 1.8);
  paint(body, ink, (p) => p.poly([18, 2, 56, 6, 20, -6]), 0xf2c14b, 2);
  body.circle(14, 6, 2.4);
  body.fill(INK);
  art.addChild(wing, body, ink);
  return { mesh, parts: { bulbs: [], wings: [wing] } };
}

const MAKERS = {
  ufo,
  flamingo,
  magpie,
  pelican,
  bat,
  pterodactyl,
};
const VISITORS = ['ufo', 'flamingo', 'magpie', 'pelican', 'bat', 'pterodactyl'];

function pickKind() {
  return VISITORS[Math.floor(Math.random() * VISITORS.length)];
}

function parallaxFor(z) {
  return CAM_Z / (CAM_Z - z);
}

export function createFlybys(layer) {
  const crafts = [];
  let wait = 0;
  let rolled = false;
  let coming = false;
  let seen = false;

  function add(type, spec) {
    const built = MAKERS[type]();
    const craft = {
      kind: type,
      mesh: built.mesh,
      parts: built.parts,
      x: spec.x,
      y: spec.y,
      z: spec.z,
      vx: spec.vx,
      vy: spec.vy,
      phase: spec.phase == null ? Math.random() * Math.PI * 2 : spec.phase,
      age: 0,
    };
    layer.addChild(craft.mesh);
    crafts.push(craft);
    return craft;
  }

  // kittenVx helps right-bound visitors outrun the camera so they still cross.
  function launch(cam, kittenY, kind, at, kittenVx = 0) {
    // Rockets are gone. Asking for one does not launch a visitor instead.
    if (kind === 'rocket' || kind === 'starship') return;
    const type = MAKERS[kind] ? kind : pickKind();
    const dir = Math.random() < 0.5 ? 1 : -1;
    const bird = type !== 'ufo';
    const base = bird ? 100 + Math.random() * 50 : 70 + Math.random() * 30;
    // Camera tracks a rightward kitten. Against-traffic (dir < 0) crosses easily;
    // with-traffic needs a push or it stays off the left edge forever.
    const chase = dir > 0 ? Math.max(0, kittenVx) * 0.85 + 40 : 0;
    const speed = base + chase;
    const z = at && at.z != null ? at.z : -5400 - Math.random() * 1200;
    const lead = viewHalfWidthAt(z) + (dir > 0 ? 360 : 220) + Math.random() * 280;
    const lift = (Math.random() < 0.6 ? 1 : -1) * (220 + Math.random() * 180);
    add(type, {
      x: at ? cam.x + at.x : cam.x - dir * lead,
      y: at ? kittenY + at.y : kittenY + lift,
      z,
      vx: at && at.vx != null ? at.vx : dir * speed,
      vy: at && at.vy != null ? at.vy : (Math.random() - 0.5) * 8,
    });
  }

  function update(time, dt, cam, kittenY, flying, kittenVx = 0) {
    for (let i = crafts.length - 1; i >= 0; i--) {
      const craft = crafts[i];
      const parallax = parallaxFor(craft.z);
      craft.age += dt;
      craft.x += craft.vx * dt;
      craft.y += craft.vy * dt;
      const bob = Math.sin(time * 1.5 + craft.phase) * 10;
      const shown = parallax / 0.2;
      const face = (craft.vx || 1) >= 0 ? 1 : -1;
      craft.mesh.position.set(
        cam.x + (craft.x - cam.x) * parallax,
        cam.y + (craft.y - cam.y) * parallax + bob,
      );
      craft.mesh.scale.set(shown * face, shown);
      craft.mesh.rotation = Math.sin(time * 1.2 + craft.phase) * 0.1;
      if (craft.parts.glow) {
        craft.parts.glow.alpha = 0.65 + Math.sin(time * 7 + craft.phase) * 0.35;
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
      const past = Math.abs(craft.x - cam.x) > viewHalfWidthAt(craft.z) + 360
        && Math.sign(craft.x - cam.x) === Math.sign(craft.vx || 1);
      if (past || craft.age > 48) {
        layer.removeChild(craft.mesh);
        craft.mesh.destroy({ children: true });
        crafts.splice(i, 1);
      }
    }

    const high = flying && kittenY >= FLYBY_Y;
    if (!high || seen) return;
    if (!rolled) {
      rolled = true;
      coming = Math.random() < FLYBY_CHANCE;
      wait = 1.4 + Math.random() * 2.6;
    }
    if (!coming) return;
    wait -= dt;
    if (wait <= 0 && crafts.length < 1) {
      launch(cam, kittenY, null, null, kittenVx);
      seen = true;
    }
  }

  function clear() {
    for (let i = crafts.length - 1; i >= 0; i--) {
      const craft = crafts[i];
      layer.removeChild(craft.mesh);
      craft.mesh.destroy({ children: true });
      crafts.splice(i, 1);
    }
    rolled = false;
    coming = false;
    seen = false;
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
