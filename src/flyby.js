import { Container, Graphics } from 'pixi.js';
import { paint, strokeOf } from './look.js';
import { CAM_Z, viewHalfWidthAt } from './view.js';

// UFOs wait until the kitten is above the low cloud lanes.
export const FLYBY_Y = 980;
// Most climbs see an empty sky. A flight that does get a saucer gets one.
const FLYBY_CHANCE = 0.2;

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

  function launch(cam, kittenY, kind, at) {
    // Rockets are gone. Asking for one does not launch a UFO instead.
    if (kind === 'rocket' || kind === 'starship') return;
    const type = MAKERS[kind] ? kind : pickKind();
    let dir = Math.random() < 0.5 ? 1 : -1;
    const speed = 70 + Math.random() * 30;
    const z = at && at.z != null ? at.z : -5400 - Math.random() * 1200;
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
      craft.mesh.rotation = Math.sin(time * 1.2 + craft.phase) * 0.1;
      if (craft.parts.glow) {
        craft.parts.glow.alpha = 0.65 + Math.sin(time * 7 + craft.phase) * 0.35;
      }
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
    if (!high || seen) return;
    if (!rolled) {
      rolled = true;
      coming = Math.random() < FLYBY_CHANCE;
      wait = 1.4 + Math.random() * 2.6;
    }
    if (!coming) return;
    wait -= dt;
    if (wait <= 0 && crafts.length < 1) {
      launch(cam, kittenY);
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
