import { Container, Graphics } from 'pixi.js';
import { paint } from './look.js';
import { CAM_Z, viewHalfWidthAt } from './view.js';

// UFOs wait until the kitten is above the low cloud lanes.
export const FLYBY_Y = 980;

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

const MAKERS = { ufo };
const VISITORS = ['ufo'];

function pickKind() {
  return VISITORS[Math.floor(Math.random() * VISITORS.length)];
}

function parallaxFor(z) {
  return CAM_Z / (CAM_Z - z);
}

export function createFlybys(layer) {
  const crafts = [];
  let above = false;
  let wait = 0;

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

  function launch(cam, kittenY, kind, at) {
    // Rockets are gone. Asking for one does not launch a UFO instead.
    if (kind === 'rocket' || kind === 'starship') return;
    const type = MAKERS[kind] ? kind : pickKind();
    let dir = Math.random() < 0.5 ? 1 : -1;
    const speed = 70 + Math.random() * 30;
    const z = at && at.z != null ? at.z : -4000 - Math.random() * 1600;
    const lead = viewHalfWidthAt(z) + 220 + Math.random() * 280;
    const lift = (Math.random() < 0.6 ? 1 : -1) * (220 + Math.random() * 180);
    add(type, {
      x: at ? cam.x + at.x : cam.x - dir * lead,
      y: at ? kittenY + at.y : kittenY + lift,
      z,
      vx: at && at.vx != null ? at.vx : dir * speed,
      vy: at && at.vy != null ? at.vy : (Math.random() - 0.5) * 8,
    });
  }

  function update(time, dt, cam, kittenY, flying) {
    for (let i = crafts.length - 1; i >= 0; i--) {
      const craft = crafts[i];
      const parallax = parallaxFor(craft.z);
      craft.age += dt;
      craft.x += craft.vx * dt;
      craft.y += craft.vy * dt;
      const bob = Math.sin(time * 1.5 + craft.phase) * 10;
      const shown = parallax / 0.2;
      craft.mesh.position.set(
        cam.x + (craft.x - cam.x) * parallax,
        cam.y + (craft.y - cam.y) * parallax + bob,
      );
      craft.mesh.scale.set(shown, shown);
      craft.mesh.rotation = Math.sin(time * 1.2 + craft.phase) * 0.14;
      const bulbs = craft.parts.bulbs;
      for (let b = 0; b < bulbs.length; b++) {
        const wave = Math.sin(time * 4 + craft.phase + b * 0.9);
        bulbs[b].alpha = 0.45 + Math.max(0, wave) * 0.55;
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
    for (let i = crafts.length - 1; i >= 0; i--) {
      const craft = crafts[i];
      layer.removeChild(craft.mesh);
      craft.mesh.destroy({ children: true });
      crafts.splice(i, 1);
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
