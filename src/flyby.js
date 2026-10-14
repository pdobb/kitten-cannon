import { Container, Graphics } from 'pixi.js';
import { paint, strokeOf } from './look.js';
import { CAM_Z, viewHalfWidthAt } from './view.js';

// UFOs wait until the kitten is above the low cloud lanes.
export const FLYBY_Y = 980;

function drawCow() {
  const root = new Container();
  const g = new Graphics();
  const ink = new Graphics();
  const hide = 0x2a2c30;
  const milk = 0xf7f4ee;
  // +Y is up. Legs hang down the beam.
  paint(g, ink, (p) => p.ellipse(-2, 2, 22, 12), milk, 2.2);
  g.ellipse(-12, 4, 8, 5.2);
  g.ellipse(4, 6, 6.5, 4.2);
  g.ellipse(2, -2, 5.5, 3.6);
  g.fill(hide);
  paint(g, ink, (p) => p.ellipse(20, 5, 10, 7.2), milk, 2.2);
  g.ellipse(14, 10, 3.2, 4.2);
  g.ellipse(22, 11, 2.6, 3.4);
  g.fill(hide);
  g.ellipse(16, 7, 4.2, 3.2);
  g.fill(hide);
  g.ellipse(28, 3.2, 4.6, 3.2);
  g.fill(0xf3b2a4);
  g.ellipse(28, 3.2, 4.6, 3.2);
  g.stroke(strokeOf(1.3));
  g.circle(26.6, 3.4, 0.7);
  g.circle(29.4, 3.4, 0.7);
  g.fill(0x5c4038);
  g.circle(22, 7.2, 1.7);
  g.fill(0x1a120c);
  g.circle(22.6, 7.7, 0.55);
  g.fill(0xffffff);
  g.ellipse(4, -8, 4.2, 3);
  g.fill(0xf0a8b4);
  g.ellipse(4, -8, 4.2, 3);
  g.stroke(strokeOf(1.2));
  for (const x of [-14, -5, 4, 12]) {
    g.roundRect(x - 1.5, -20, 3.2, 12, 1.2);
    g.fill(milk);
    g.roundRect(x - 1.5, -20, 3.2, 12, 1.2);
    g.stroke(strokeOf(1.4));
    g.roundRect(x - 1.8, -22.4, 3.8, 3.6, 1);
    g.fill(hide);
  }
  g.moveTo(-22, 4);
  g.quadraticCurveTo(-32, 12, -28, 2);
  g.stroke(strokeOf(2, hide));
  g.circle(-28, 0.6, 2.6);
  g.fill(hide);
  root.addChild(g, ink);
  root.position.set(0, -186);
  return root;
}

function ufo() {
  const root = new Container();

  // The beam hangs straight down. The saucer wobbles around it.
  const hang = new Container();
  const beam = new Graphics();
  beam.poly([-10, -14, 10, -14, 52, -214, -52, -214]);
  beam.fill({ color: 0x8ee06a, alpha: 0.28 });
  beam.poly([-5, -14, 5, -14, 22, -214, -22, -214]);
  beam.fill({ color: 0xd8ff9a, alpha: 0.45 });
  beam.poly([-2, -14, 2, -14, 7, -214, -7, -214]);
  beam.fill({ color: 0xf6ffe4, alpha: 0.8 });
  for (let i = 0; i < 6; i++) {
    const y = -40 - i * 28;
    beam.ellipse(0, y, 10 + i * 6, 2.6);
    beam.fill({ color: 0xf3ffd2, alpha: 0.22 });
  }
  hang.addChild(beam);
  const motes = [];
  for (let i = 0; i < 5; i++) {
    const mote = new Graphics();
    mote.circle(0, 0, 1.7);
    mote.fill({ color: 0xf6ffe8, alpha: 0.9 });
    hang.addChild(mote);
    motes.push(mote);
  }
  // About half the passes are hauling a cow. The beam itself is always on.
  const cow = Math.random() < 0.55 ? drawCow() : null;
  if (cow) hang.addChild(cow);
  root.addChild(hang);

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
  return { mesh: root, parts: { lights, bulbs, hang, beam, cow, motes, glow } };
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
      const wobble = Math.sin(time * 1.2 + craft.phase) * 0.1;
      craft.mesh.rotation = wobble;
      if (craft.parts.hang) craft.parts.hang.rotation = -wobble;
      if (craft.parts.beam) {
        craft.parts.beam.alpha = 0.72 + Math.sin(time * 7 + craft.phase) * 0.28;
      }
      if (craft.parts.glow) {
        craft.parts.glow.alpha = 0.65 + Math.sin(time * 7 + craft.phase) * 0.35;
      }
      const motes = craft.parts.motes;
      if (motes) {
        for (let m = 0; m < motes.length; m++) {
          const u = (time * 0.32 + m * 0.19) % 1;
          motes[m].position.set(Math.sin(time * 2.2 + m) * (5 + u * 18), -24 - u * 160);
          motes[m].alpha = Math.sin(u * Math.PI) * 0.85;
        }
      }
      const cow = craft.parts.cow;
      if (cow) {
        // One haul per visit. The cow stays in the beam, then fades into the hatch.
        const rise = 4.6;
        if (craft.age < rise) {
          const u = craft.age / rise;
          cow.visible = true;
          const climb = u * (0.35 + 0.65 * u);
          cow.position.set(Math.sin(time * 1.6 + craft.phase) * 5, -200 + climb * 172);
          const s = 1.2 - climb * 0.45;
          cow.scale.set(s, s);
          let alpha = 1;
          if (u < 0.1) alpha = u / 0.1;
          else if (u > 0.93) alpha = (1 - u) / 0.07;
          cow.alpha = alpha;
          cow.rotation = Math.sin(time * 2.2 + craft.phase) * 0.18;
        } else {
          cow.visible = false;
        }
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
