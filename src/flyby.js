import { Container, Graphics } from 'pixi.js';
import { INK, PAL, paint, strokeOf } from './look.js';
import { CAM_Z, viewHalfWidthAt } from './view.js';

// Clouds top out near y 470. Craft stay parked until the kitten is well above that.
export const FLYBY_Y = 980;

const LINE = strokeOf(2.4);

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

function rocket() {
  const root = new Container();
  const g = new Graphics();
  const ink = new Graphics();
  paint(g, ink, (p) => p.roundRect(-32, -10, 64, 20, 8), 0xf4f6f8, 2.4);
  paint(g, ink, (p) => {
    p.poly([28, -10, 28, 10, 52, 0]);
  }, PAL.red, 2.4);
  g.roundRect(-4, -11, 12, 22, 4);
  g.fill(0x2f6fbe);
  paint(g, ink, (p) => p.roundRect(-24, 8, 16, 12, 3), 0x2b2118, 2.2);
  paint(g, ink, (p) => p.roundRect(-24, -20, 16, 12, 3), 0x2b2118, 2.2);
  g.circle(8, 0, 4.5);
  g.fill(0x8fd4ff);
  g.stroke(LINE);
  root.addChild(g);

  const flame = new Container();
  flame.position.set(-32, 0);
  const flameGfx = new Graphics();
  flameGfx.poly([0, -7, 0, 7, -26, 0]);
  flameGfx.fill(0xff8a1e);
  flameGfx.poly([0, -3.4, 0, 3.4, -16, 0]);
  flameGfx.fill(0xfff6d0);
  flame.addChild(flameGfx);
  root.addChild(flame, ink);
  return { mesh: root, parts: { flame } };
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

function blimp() {
  const root = new Container();
  const g = new Graphics();
  const ink = new Graphics();
  // Authored at the on-screen size. The old hull was about 15 units once
  // the far depth had scaled it down, smaller than the kitten.
  paint(g, ink, (p) => p.ellipse(-4, 8, 108, 36), 0xf0d78c, 2.6);
  paint(g, ink, (p) => p.ellipse(86, 8, 24, 20), 0xf6e3a4, 2.4);
  g.ellipse(28, 8, 9, 37);
  g.fill(0xd23b2e);
  g.ellipse(-48, 8, 7, 37);
  g.fill(0xd23b2e);
  g.ellipse(-6, 22, 64, 10);
  g.fill({ color: 0xfff6d8, alpha: 0.9 });
  paint(g, ink, (p) => p.poly([-100, 18, -142, 58, -104, 16]), 0xd23b2e, 2.4);
  paint(g, ink, (p) => p.poly([-100, -4, -142, -40, -104, 2]), 0xd23b2e, 2.4);
  paint(g, ink, (p) => p.roundRect(-40, -38, 70, 24, 5), 0x4a3428, 2.4);
  for (const x of [-26, -8, 10]) {
    g.roundRect(x, -32, 13, 10, 2);
    g.fill(0xc9e7ff);
    g.roundRect(x, -32, 13, 10, 2);
    g.stroke(strokeOf(1.6));
  }
  g.moveTo(-22, -14);
  g.lineTo(-26, -6);
  g.moveTo(18, -14);
  g.lineTo(20, -6);
  g.stroke(strokeOf(2.2));
  root.addChild(g, ink);
  return { mesh: root, parts: {} };
}

const MAKERS = { ufo, rocket, plane, blimp };
const KINDS = Object.keys(MAKERS);

function pickKind() {
  return KINDS[Math.floor(Math.random() * KINDS.length)];
}

function parallaxFor(z) {
  return CAM_Z / (CAM_Z - z);
}

export function createFlybys(layer) {
  const crafts = [];
  let above = false;
  let wait = 0;

  function launch(cam, kittenY, kind, at) {
    const type = MAKERS[kind] ? kind : pickKind();
    const built = MAKERS[type]();
    let dir = Math.random() < 0.5 ? 1 : -1;
    if (type === 'rocket' && Math.random() < 0.75) dir = 1;
    const speed = type === 'rocket' ? 160 + Math.random() * 70
      : type === 'plane' ? 90 + Math.random() * 40
      : type === 'blimp' ? 46 + Math.random() * 26
      : 70 + Math.random() * 30;
    const z = at && at.z != null ? at.z : -4000 - Math.random() * 1600;
    const lead = viewHalfWidthAt(z) + 220 + Math.random() * 280;
    const lift = (Math.random() < 0.6 ? 1 : -1) * (220 + Math.random() * 180);
    const craft = {
      kind: type,
      mesh: built.mesh,
      parts: built.parts,
      x: at ? cam.x + at.x : cam.x - dir * lead,
      y: at ? kittenY + at.y : kittenY + lift,
      z,
      vx: at && at.vx != null ? at.vx : dir * speed,
      vy: at && at.vy != null ? at.vy : (type === 'rocket' ? 14 + Math.random() * 22 : type === 'blimp' ? (Math.random() - 0.5) * 6 : (Math.random() - 0.5) * 8),
      phase: Math.random() * Math.PI * 2,
      age: 0,
    };
    layer.addChild(craft.mesh);
    crafts.push(craft);
  }

  function update(time, dt, cam, kittenY, flying) {
    for (let i = crafts.length - 1; i >= 0; i--) {
      const craft = crafts[i];
      craft.age += dt;
      craft.x += craft.vx * dt;
      craft.y += craft.vy * dt;
      const parallax = parallaxFor(craft.z);
      const bobAmp = craft.kind === 'rocket' ? 4 : craft.kind === 'blimp' ? 18 : 10;
      const bobRate = craft.kind === 'blimp' ? 0.65 : 1.5;
      const bob = Math.sin(time * bobRate + craft.phase) * bobAmp;
      const shown = parallax / 0.2;
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
      } else {
        craft.mesh.rotation = Math.atan2(craft.vy, craft.vx);
      }
      if (craft.parts.prop) craft.parts.prop.scale.y = Math.sin(time * 32);
      if (craft.parts.flame) {
        const flick = 0.65 + Math.abs(Math.sin(time * 34 + craft.phase)) * 0.55;
        craft.parts.flame.scale.x = flick;
      }
      const past = Math.abs(craft.x - cam.x) > viewHalfWidthAt(craft.z) + 360
        && Math.sign(craft.x - cam.x) === Math.sign(craft.vx);
      if (past || craft.age > 48) {
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
    if (wait <= 0 && crafts.length < 1) {
      launch(cam, kittenY);
      wait = 7 + Math.random() * 6;
    }
  }

  function clear() {
    for (let i = 0; i < crafts.length; i++) {
      layer.removeChild(crafts[i].mesh);
      crafts[i].mesh.destroy({ children: true });
    }
    crafts.length = 0;
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
