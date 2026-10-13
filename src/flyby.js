import { Container, Graphics } from 'pixi.js';
import { INK, PAL, paint } from './look.js';
import { CAM_Z, viewHalfWidthAt } from './view.js';

// UFOs and planes wait until the kitten is above the low cloud lanes.
export const FLYBY_Y = 980;

// Full stack, nose at local +X so atan2(vy, vx) aims it up the screen.
// The body is long on purpose: the mesh scale is not the parallax scale,
// or a far ship would shrink to a speck.
const R = 12;
const SKIRT = -146;
const JOINT = 2;
const SHOULDER = 102;
const TIP = 142;

const STEEL = 0xe7e2d8;
const STEEL_SHADE = 0xcfc9bd;
const TILE = 0x2a2c30;
const TILE_LINE = 0x4c5158;
const FLAP = 0x3a3d42;
const BELL = 0x6e5646;
const BELL_DARK = 0x1a1614;

function nosePoint(t) {
  const s = Math.sin(t);
  return [SHOULDER + (TIP - SHOULDER) * Math.pow(s, 0.7), R * Math.cos(t)];
}

function silhouette() {
  const pts = [SKIRT, R, SHOULDER, R];
  const steps = 14;
  for (let i = 1; i <= steps; i++) pts.push(...nosePoint((i / steps) * Math.PI));
  pts.push(SKIRT, -R);
  return pts;
}

function flap(x0, x1, inner, outer) {
  const sweep = (x1 - x0) * 0.62;
  return [
    x0, inner,
    x1, inner,
    x1 - sweep * 0.2, outer,
    x0 - sweep, inner + (outer - inner) * 0.92,
  ];
}

function waffle(g, ink, x, y, w, h) {
  paint(g, ink, (p) => p.roundRect(x, y, w, h, 2), 0xd5d0c4, 2);
  const pad = 2.4;
  const gap = 1.7;
  const cw = (w - pad * 2 - gap) / 2;
  const ch = (h - pad * 2 - gap) / 2;
  for (let col = 0; col < 2; col++) {
    for (let row = 0; row < 2; row++) {
      g.roundRect(x + pad + col * (cw + gap), y + pad + row * (ch + gap), cw, ch, 0.6);
      g.fill(0x23262b);
    }
  }
}

function starship() {
  const root = new Container();
  const g = new Graphics();
  const ink = new Graphics();

  const flame = new Container();
  flame.position.set(SKIRT - 18, 0);
  const flameGfx = new Graphics();
  flameGfx.poly([0, -7, 0, 7, -14, 16, -36, 13, -62, 5, -78, 0, -62, -5, -36, -13, -14, -16]);
  flameGfx.fill(0xff4c14);
  flameGfx.poly([0, 5.5, 0, 10, -24, 8, -34, 4]);
  flameGfx.fill(0xff6418);
  flameGfx.poly([0, -10, 0, -5.5, -34, -4, -24, -8]);
  flameGfx.fill(0xff6418);
  flameGfx.poly([0, -4.2, 0, 4.2, -12, 8, -30, 5, -52, 0, -30, -5, -12, -8]);
  flameGfx.fill(0xff9a28);
  flameGfx.poly([0, -2, 0, 2, -8, 3.4, -36, 0, -8, -3.4]);
  flameGfx.fill(0xfff6d0);
  flameGfx.poly([0, -1.5, 0, 1.5, -11, 0]);
  flameGfx.fill(0xc9f2ff);
  flame.addChild(flameGfx);
  root.addChild(flame);

  paint(g, ink, (p) => p.poly(silhouette()), STEEL, 2.4);

  g.rect(SKIRT, -R + 0.5, JOINT - SKIRT + 2, R * 2 - 1);
  g.fill(STEEL_SHADE);

  g.roundRect(SKIRT + 12, R - 5.6, SHOULDER - SKIRT - 28, 2.8, 1.3);
  g.fill(0xf7f4ee);

  const seams = [-112, -74, -38];
  for (let i = 0; i < seams.length; i++) {
    g.rect(seams[i], -R + 1.4, 1.3, R * 2 - 2.8);
    g.fill(0xb7b2a6);
  }

  const tile = [JOINT + 8, -0.4, SHOULDER, -0.4];
  for (let i = 0; i <= 8; i++) tile.push(...nosePoint(Math.PI / 2 + (i / 8) * (Math.PI / 2)));
  tile.push(JOINT + 8, -R);
  paint(g, ink, (p) => p.poly(tile), TILE, 2);

  for (let i = 0; i < 5; i++) {
    const x = JOINT + 16 + i * 14;
    g.roundRect(x, -4.2, 8, 2.3, 0.4);
    g.fill(TILE_LINE);
    g.roundRect(x + 5, -8.2, 8, 2.3, 0.4);
    g.fill(TILE_LINE);
    g.roundRect(x + 2, -11.2, 7, 2.1, 0.4);
    g.fill(0x3a3e44);
  }

  // Small canards under the nose. The big flaps are lower, at the ship's skirt.
  paint(g, ink, (p) => p.poly(flap(SHOULDER - 16, SHOULDER + 6, R, R + 16)), FLAP, 2.2);
  paint(g, ink, (p) => p.poly(flap(SHOULDER - 16, SHOULDER + 6, -R, -(R + 16))), FLAP, 2.2);
  paint(g, ink, (p) => p.poly(flap(JOINT + 10, JOINT + 44, R, R + 30)), FLAP, 2.2);
  paint(g, ink, (p) => p.poly(flap(JOINT + 10, JOINT + 44, -R, -(R + 30))), FLAP, 2.2);

  waffle(g, ink, JOINT - 40, R - 0.5, 22, 26);
  waffle(g, ink, JOINT - 40, -R - 25.5, 22, 26);
  paint(g, ink, (p) => p.roundRect(JOINT - 34, -7, 10, 14, 1.4), 0xc4bfb4, 1.6);
  g.roundRect(JOINT - 31, -4.2, 3.2, 3.2, 0.4);
  g.fill(0x23262b);
  g.roundRect(JOINT - 31, 1, 3.2, 3.2, 0.4);
  g.fill(0x23262b);

  paint(g, ink, (p) => p.roundRect(JOINT - 2, -R, 7, R * 2, 1), 0x2a2e33, 1.8);
  for (let i = 0; i < 4; i++) {
    g.roundRect(JOINT - 0.4, -8.5 + i * 5.4, 3.6, 2.4, 0.4);
    g.fill(0x121418);
  }

  const bells = [
    [-8.2, 2.35, 10],
    [-4.1, 2.55, 14],
    [0, 2.7, 17],
    [4.1, 2.55, 14],
    [8.2, 2.35, 10],
  ];
  for (let i = 0; i < bells.length; i++) {
    const y = bells[i][0];
    const w = bells[i][1];
    const len = bells[i][2];
    paint(g, ink, (p) => p.poly([
      SKIRT + 0.4, y - w,
      SKIRT + 0.4, y + w,
      SKIRT - len, y + w * 0.72,
      SKIRT - len, y - w * 0.72,
    ]), BELL, 1.6);
    g.ellipse(SKIRT - len + 0.2, y, 1.7, w * 0.55);
    g.fill(BELL_DARK);
  }

  root.addChild(g, ink);
  return { mesh: root, parts: { flame } };
}

function ufo() {
  const root = new Container();
  const g = new Graphics();
  const ink = new Graphics();
  paint(g, ink, (p) => p.ellipse(0, 0, 48, 13), 0xd5dde6, 2.4);
  paint(g, ink, (p) => p.ellipse(0, 14, 18, 12), 0x8fd4ff, 2.4);
  g.poly([-16, -8, 16, -8, 0, -46]);
  g.fill({ color: 0xb6ff9a, alpha: 0.35 });
  root.addChild(g, ink);

  const lights = new Container();
  const bulbs = [];
  const colors = [0x39e07a, 0xffe56a, 0xff5a7a, 0x7ec8ff];
  for (let i = 0; i < 6; i++) {
    const bulb = new Graphics();
    const x = -36 + i * 14.4;
    bulb.circle(x, -6, 3.4);
    bulb.fill(colors[i % colors.length]);
    lights.addChild(bulb);
    bulbs.push(bulb);
  }
  root.addChild(lights);
  return { mesh: root, parts: { lights, bulbs } };
}

function plane() {
  const root = new Container();
  const g = new Graphics();
  const ink = new Graphics();
  paint(g, ink, (p) => p.ellipse(0, 0, 40, 12), 0xc47a3a, 2.4);
  paint(g, ink, (p) => p.roundRect(-28, 10, 62, 7, 3), 0xf2c14e, 2.2);
  paint(g, ink, (p) => p.roundRect(-22, -16, 52, 6, 3), 0xf2c14e, 2.2);
  g.roundRect(-12, -16, 3.2, 34, 1);
  g.fill(INK);
  g.roundRect(14, -16, 3.2, 34, 1);
  g.fill(INK);
  paint(g, ink, (p) => p.roundRect(-52, 2, 18, 22, 3), PAL.red, 2.2);
  paint(g, ink, (p) => p.roundRect(-54, -3, 16, 5, 2), PAL.red, 2);
  paint(g, ink, (p) => p.ellipse(16, 6, 9, 6), 0x8fd4ff, 2.2);
  root.addChild(g);

  const prop = new Graphics();
  prop.ellipse(0, 0, 2.2, 16);
  prop.fill(INK);
  prop.position.set(42, 0);
  root.addChild(prop, ink);
  return { mesh: root, parts: { prop } };
}

const MAKERS = { ufo, starship, plane };
const VISITORS = ['ufo', 'plane'];

function pickKind() {
  return VISITORS[Math.floor(Math.random() * VISITORS.length)];
}

function parallaxFor(z) {
  return CAM_Z / (CAM_Z - z);
}

// World stations along the course. z is far (parallax about 0.05–0.07) so a
// pass lingers. scale is the drawn size, not the parallax, so a far stack
// stays large. y is the altitude band a shot at that distance flies through.
const ASCENTS = [
  { x: 11200, y: 2800, z: -15900, vx: 26, vy: 240, scale: 0.84 },
  { x: 27000, y: 7600, z: -16800, vx: 32, vy: 280, scale: 0.78 },
  { x: 48000, y: 3000, z: -15000, vx: 22, vy: 220, scale: 0.88 },
  { x: 76000, y: 8400, z: -17200, vx: 30, vy: 300, scale: 0.76 },
  { x: 116000, y: 14500, z: -16400, vx: 24, vy: 260, scale: 0.82 },
  { x: 172000, y: 23500, z: -15600, vx: 28, vy: 320, scale: 0.86 },
];

export function createFlybys(layer) {
  const crafts = [];
  let above = false;
  let wait = 0;

  function add(type, spec) {
    const built = MAKERS[type]();
    const craft = {
      kind: type === 'starship' ? 'rocket' : type,
      mesh: built.mesh,
      parts: built.parts,
      x: spec.x,
      y: spec.y,
      z: spec.z,
      vx: spec.vx,
      vy: spec.vy,
      phase: spec.phase == null ? Math.random() * Math.PI * 2 : spec.phase,
      age: 0,
      scale: spec.scale == null ? null : spec.scale,
      anchored: !!spec.anchored,
      homeX: spec.x,
      homeY: spec.y,
    };
    if (craft.anchored) craft.mesh.visible = false;
    layer.addChild(craft.mesh);
    crafts.push(craft);
    return craft;
  }

  function park(craft) {
    craft.x = craft.homeX;
    craft.y = craft.homeY;
    craft.age = 0;
    craft.mesh.visible = false;
  }

  for (let i = 0; i < ASCENTS.length; i++) {
    add('starship', { ...ASCENTS[i], anchored: true, phase: i * 1.3 });
  }

  function launch(cam, kittenY, kind, at) {
    const asked = kind === 'rocket' ? 'starship' : kind;
    const type = MAKERS[asked] ? asked : pickKind();
    if (type === 'starship') {
      const z = at && at.z != null ? at.z : -15900;
      const parallax = parallaxFor(z);
      add('starship', {
        x: at ? cam.x + at.x : cam.x + 200 / parallax,
        y: at ? kittenY + at.y : cam.y + 150 / parallax,
        z,
        vx: at && at.vx != null ? at.vx : 28,
        vy: at && at.vy != null ? at.vy : 280,
        scale: at && at.scale != null ? at.scale : 0.84,
        anchored: false,
      });
      return;
    }
    const builtKind = type;
    let dir = Math.random() < 0.5 ? 1 : -1;
    const speed = builtKind === 'plane' ? 90 + Math.random() * 40 : 70 + Math.random() * 30;
    const z = at && at.z != null ? at.z : -4000 - Math.random() * 1600;
    const lead = viewHalfWidthAt(z) + 220 + Math.random() * 280;
    const lift = (Math.random() < 0.6 ? 1 : -1) * (220 + Math.random() * 180);
    add(builtKind, {
      x: at ? cam.x + at.x : cam.x - dir * lead,
      y: at ? kittenY + at.y : kittenY + lift,
      z,
      vx: at && at.vx != null ? at.vx : dir * speed,
      vy: at && at.vy != null ? at.vy : (Math.random() - 0.5) * 8,
      anchored: false,
    });
  }

  function update(time, dt, cam, kittenY, flying) {
    for (let i = crafts.length - 1; i >= 0; i--) {
      const craft = crafts[i];
      const climber = craft.kind === 'rocket';
      if (craft.anchored) {
        if (flying) {
          craft.x += craft.vx * dt;
          craft.y += craft.vy * dt;
        }
        craft.mesh.visible = !!flying;
      } else {
        craft.age += dt;
        craft.x += craft.vx * dt;
        craft.y += craft.vy * dt;
      }
      const parallax = parallaxFor(craft.z);
      const bobAmp = climber ? 0 : 10;
      const bob = Math.sin(time * 1.5 + craft.phase) * bobAmp;
      const shown = craft.scale == null ? parallax / 0.2 : craft.scale;
      craft.mesh.position.set(
        cam.x + (craft.x - cam.x) * parallax,
        cam.y + (craft.y - cam.y) * parallax + bob,
      );
      craft.mesh.scale.set(shown, shown);
      if (craft.kind === 'ufo') {
        craft.mesh.rotation = Math.sin(time * 1.2 + craft.phase) * 0.14;
        const bulbs = craft.parts.bulbs;
        for (let b = 0; b < bulbs.length; b++) {
          const wave = Math.sin(time * 4 + craft.phase + b * 0.9);
          bulbs[b].alpha = 0.45 + Math.max(0, wave) * 0.55;
        }
      } else if (craft.vx || craft.vy) {
        craft.mesh.rotation = Math.atan2(craft.vy, craft.vx);
      }
      if (craft.parts.prop) craft.parts.prop.scale.y = Math.sin(time * 32);
      if (craft.parts.flame) {
        const flick = 0.72 + Math.abs(Math.sin(time * 34 + craft.phase)) * 0.5;
        craft.parts.flame.scale.x = flick;
        craft.parts.flame.scale.y = 0.86 + flick * 0.18;
      }
      if (craft.anchored) continue;
      const past = Math.abs(craft.x - cam.x) > viewHalfWidthAt(craft.z) + 360
        && Math.sign(craft.x - cam.x) === Math.sign(craft.vx || 1);
      if ((!climber && past) || craft.age > 48) {
        layer.removeChild(craft.mesh);
        craft.mesh.destroy({ children: true });
        crafts.splice(i, 1);
      }
    }

    const high = flying && kittenY >= FLYBY_Y;
    if (!high) {
      above = false;
      return;
    }
    if (!above) {
      above = true;
      wait = 0.35 + Math.random() * 0.75;
    }
    wait -= dt;
    let visitors = 0;
    for (let i = 0; i < crafts.length; i++) if (!crafts[i].anchored) visitors += 1;
    if (wait <= 0 && visitors < 1) {
      launch(cam, kittenY);
      wait = 7 + Math.random() * 6;
    }
  }

  function clear() {
    for (let i = crafts.length - 1; i >= 0; i--) {
      const craft = crafts[i];
      if (craft.anchored) {
        park(craft);
      } else {
        layer.removeChild(craft.mesh);
        craft.mesh.destroy({ children: true });
        crafts.splice(i, 1);
      }
    }
    above = false;
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
