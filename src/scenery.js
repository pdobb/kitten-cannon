import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { PAL } from './look.js';
import { skyCss, spaceBlend } from './sky.js';
import { CANNON_X, GROUND_Y, PIXELS_PER_FOOT } from './tune.js';

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function fillRidge(g, pts, x0, color, line, sharp) {
  const base = -48;
  g.moveTo(x0 + pts[0].x, base);
  for (let i = 0; i < pts.length; i++) g.lineTo(x0 + pts[i].x, pts[i].y);
  g.lineTo(x0 + pts[pts.length - 1].x, base);
  g.closePath();
  g.fill(color);
  g.moveTo(x0 + pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) g.lineTo(x0 + pts[i].x, pts[i].y);
  g.stroke({
    width: 3,
    color: line,
    join: sharp ? 'miter' : 'round',
    cap: 'butt',
    miterLimit: 3,
  });
}

// Where the ridge crosses the snowline. The cap ends on that point so the
// hem meets the slope instead of dropping straight down beside it.
function snowlinePoint(below, above, line) {
  const dy = above.y - below.y;
  if (dy === 0) return { x: above.x, y: line };
  const t = Math.max(0, Math.min(1, (line - below.y) / dy));
  return { x: below.x + (above.x - below.x) * t, y: line };
}

// Snow follows this crest only. The inner edge echoes the ridge and pinches
// to the outline, so the cap does not end in a flat cut across the slope.
function fillSnow(g, pts, x0, limit) {
  for (let i = 1; i < pts.length - 1; i++) {
    const tip = pts[i];
    if (tip.y < limit) continue;
    if (tip.y <= pts[i - 1].y || tip.y <= pts[i + 1].y) continue;
    const line = tip.y * 0.6;
    let left = i;
    while (left > 1 && pts[left - 1].y >= line && pts[left - 1].y <= pts[left].y) left -= 1;
    let right = i;
    while (right < pts.length - 2 && pts[right + 1].y >= line && pts[right + 1].y <= pts[right].y) right += 1;
    if (right - left < 2) continue;
    const top = [];
    if (left > 0 && pts[left - 1].y < line && pts[left].y > line) {
      top.push(snowlinePoint(pts[left - 1], pts[left], line));
    }
    for (let k = left; k <= right; k++) top.push(pts[k]);
    if (right < pts.length - 1 && pts[right + 1].y < line && pts[right].y > line) {
      top.push(snowlinePoint(pts[right], pts[right + 1], line));
    }
    if (top.length < 3) continue;
    const cap = [];
    for (let k = 0; k < top.length; k++) cap.push(x0 + top[k].x, top[k].y);
    for (let k = top.length - 1; k >= 0; k--) {
      const drop = (top[k].y - line) * 0.72;
      cap.push(x0 + top[k].x, top[k].y - drop);
    }
    g.poly(cap);
    g.fill(0xfffdf8);
  }
}

function addBell(pts, left, right, peak, power, skew) {
  const steps = 24;
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    const u = Math.max(0, Math.min(1, t + skew * Math.sin(t * Math.PI)));
    const bell = Math.sin(u * Math.PI) ** power;
    pts.push({ x: left + (right - left) * t, y: peak * bell });
  }
}

// Broad bells. Both ends sit at y = 0 so the next copy meets this one.
// A grand range is wider and stays tall. A near range is lower and rounder.
// saddle[0] is where peaks stop. lead is a flat opening. A crown past the
// middle of the tile is the peak on the left of the title. One before that
// is the peak on the right. The sun sits in the opening, not on a crest.
function peakSamples(span, height, seed, grand, saddle, crown, lead, spread = 1) {
  const rng = mulberry32(seed);
  const pts = [{ x: 0, y: 0 }];
  const stop = saddle ? saddle[0] : span;
  const crownAtEnd = !!(crown && crown.at > span * 0.5);
  let x = Math.max(16, lead || 0);
  if (crown && !crownAtEnd) {
    const left = Math.max(18, crown.at - crown.width * 0.5);
    const right = Math.min(stop - 8, left + crown.width);
    addBell(pts, left, right, height * 0.98, 1.22, 0.04);
    x = Math.max(x, right);
  }
  const peakStop = crownAtEnd ? Math.min(stop, crown.at - crown.width * 0.5) : stop;
  while (x < peakStop - 80) {
    const gap = ((grand ? 90 : 40) + rng() * (grand ? 140 : 120)) * spread;
    const width = ((grand ? 720 : 260) + rng() * (grand ? 520 : 280)) * spread;
    const left = x + gap;
    const right = Math.min(peakStop - 8, left + width);
    if (right - left < (grand ? 420 : 180) * spread) break;
    const peak = height * (grand ? 0.9 + rng() * 0.1 : 0.58 + rng() * 0.36);
    const power = grand ? 1.2 + rng() * 0.35 : 1.35 + rng() * 0.45;
    const skew = (rng() - 0.42) * 0.18;
    addBell(pts, left, right, peak, power, skew);
    x = right;
  }
  if (crownAtEnd) {
    const right = Math.min(span - 1, crown.at + crown.width * 0.5);
    const left = Math.max(x + 8, right - crown.width);
    if (right - left > 180) addBell(pts, left, right, height * 0.98, 1.22, 0.04);
  }
  pts.push({ x: span, y: 0 });
  for (let i = 1; i < pts.length; i++) {
    if (pts[i].x <= pts[i - 1].x) pts[i].x = pts[i - 1].x + 1;
  }
  pts[0].x = 0;
  pts[0].y = 0;
  pts[pts.length - 1].x = span;
  pts[pts.length - 1].y = 0;
  return pts;
}

// Integer cycles, so the wave at x = 0 matches the wave at x = span.
function waveSamples(span, base, amp, freq, phase) {
  const pts = [];
  const n = 72;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const y = base
      + Math.sin(t * Math.PI * 2 * freq + phase) * amp
      + Math.sin(t * Math.PI * 2 * freq * 3 + phase * 1.4) * amp * 0.28;
    pts.push({ x: t * span, y: Math.max(0, y) });
  }
  return pts;
}

function tiledLayer(world, span, draw) {
  const layer = new Container();
  const g = new Graphics();
  for (let i = 0; i < 3; i++) draw(g, i * span);
  layer.addChild(g);
  world.addChild(layer);
  return { layer, span };
}

function track(entry, camX, parallax) {
  const span = entry.span;
  const scroll = ((camX * parallax) % span + span) % span;
  entry.layer.position.x = camX - scroll - span;
}

const CLOUD_LAYOUTS = [
  [[0, 0.05, 0.5, 0.36], [0.42, 0, 0.34, 0.24], [-0.36, 0.02, 0.28, 0.2]],
  [[-1.1, 0, 0.55, 0.36], [-0.45, 0.1, 0.5, 0.4], [0.2, 0.14, 0.58, 0.38], [0.85, 0.04, 0.46, 0.32], [1.35, -0.02, 0.34, 0.26]],
  [[0, 0.1, 0.7, 0.46], [-0.5, -0.02, 0.4, 0.3], [0.52, 0.02, 0.38, 0.28]],
  [[-0.7, 0, 0.46, 0.32], [-0.1, 0.08, 0.52, 0.36], [0.5, 0, 0.42, 0.3], [-0.3, 0.42, 0.34, 0.26], [0.22, 0.4, 0.3, 0.24]],
];

function drawCloud(rng) {
  const layout = CLOUD_LAYOUTS[Math.floor(rng() * CLOUD_LAYOUTS.length)];
  const size = 34 + rng() * 48;
  const mirror = rng() < 0.5 ? -1 : 1;
  const g = new Graphics();
  const puffs = [];
  for (let i = 0; i < layout.length; i++) {
    const p = layout[i];
    puffs.push({
      x: (p[0] + (rng() - 0.5) * 0.08) * size * mirror,
      y: (p[1] + (rng() - 0.5) * 0.06) * size,
      rx: p[2] * size * (0.9 + rng() * 0.2),
      ry: p[3] * size * (0.9 + rng() * 0.2),
    });
  }
  let minX = Infinity;
  let maxX = -Infinity;
  for (const p of puffs) {
    g.ellipse(p.x, p.y - p.ry * 0.35, p.rx, p.ry * 0.82);
    g.fill(0xd7e0ea);
    minX = Math.min(minX, p.x - p.rx);
    maxX = Math.max(maxX, p.x + p.rx);
  }
  for (const p of puffs) {
    g.ellipse(p.x, p.y, p.rx, p.ry);
    g.fill(0xfffdf8);
  }
  for (const p of puffs) {
    g.ellipse(p.x - p.rx * 0.2, p.y + p.ry * 0.28, p.rx * 0.45, p.ry * 0.28);
    g.fill({ color: 0xffffff, alpha: 0.65 });
  }
  const mid = (minX + maxX) / 2;
  g.position.x = -mid;
  return { graphic: g, width: maxX - minX };
}

// Same pattern on every tile, so the wrap meets. Stars are small on purpose.
// A dot of a few world units is a point of light once the view is on screen.
function drawStars(g, x0, span) {
  const rng = mulberry32(0x57a11);
  const band = 860;
  for (let i = 0; i < 360; i++) {
    const x = x0 + rng() * span;
    const y = (rng() - 0.5) * band;
    const bright = rng();
    const color = bright > 0.88 ? 0xffe2b8 : bright > 0.72 ? 0xc9d7ff : 0xfffdf8;
    const r = bright > 0.94 ? 2.4 + rng() * 1.3 : 0.7 + rng() * 1.1;
    const alpha = 0.45 + rng() * 0.55;
    if (bright > 0.96) {
      g.circle(x, y, r * 2.6);
      g.fill({ color, alpha: 0.16 });
    }
    g.circle(x, y, r);
    g.fill({ color, alpha });
    if (bright > 0.975) {
      const arm = r * 3.6;
      g.moveTo(x - arm, y);
      g.lineTo(x + arm, y);
      g.stroke({ width: 0.7, color, alpha: 0.85, cap: 'round' });
      g.moveTo(x, y - arm);
      g.lineTo(x, y + arm);
      g.stroke({ width: 0.7, color, alpha: 0.85, cap: 'round' });
    }
  }
}

// Rust, a dark plain, a pale cap. Drawn at radius 100. The view scales it.
function drawMars(g) {
  g.circle(0, 0, 114);
  g.fill({ color: 0xd98a6a, alpha: 0.16 });

  g.circle(0, 0, 100);
  g.fill(0xc24a28);

  g.ellipse(-6, 6, 46, 28);
  g.fill(0x8c2e14);
  g.ellipse(22, -28, 24, 16);
  g.fill(0x9a3418);
  g.circle(-30, -18, 9);
  g.fill(0x7c2812);

  // The right limb stays inside the disc. +Y is up, so the cap sits at the top.
  g.ellipse(46, -4, 28, 72);
  g.fill({ color: 0x4a160c, alpha: 0.55 });

  g.ellipse(0, 86, 28, 12);
  g.fill(0xfff7f1);
  g.ellipse(-2, 88, 16, 7);
  g.fill(0xffffff);

  g.ellipse(-46, 34, 22, 14);
  g.fill({ color: 0xffd2b4, alpha: 0.5 });
}

function grassDecor(g, x0, span) {
  const rng = mulberry32(0x67a55);
  for (let i = 0; i < 28; i++) {
    const x = x0 + 12 + rng() * (span - 24);
    const h = 7 + rng() * 12;
    const lean = (rng() - 0.5) * 6;
    g.poly([x, 2, x + 2.2, 2, x + 1.1 + lean, 2 + h]);
    g.fill(rng() < 0.45 ? PAL.grassDark : 0x2f7a28);
  }
  const flowers = [0xfff4d2, 0xf2d24e, 0xe86b8a, 0xffffff];
  for (let i = 0; i < 8; i++) {
    const x = x0 + 18 + rng() * (span - 36);
    const y = 8 + rng() * 5;
    g.rect(x - 0.5, 2, 1, y - 2);
    g.fill(PAL.grassDark);
    g.circle(x, y, 2.3);
    g.fill(flowers[i % flowers.length]);
  }
  for (let i = 0; i < 5; i++) {
    const x = x0 + 16 + rng() * (span - 32);
    g.ellipse(x, 3, 3.2 + rng() * 2, 1.8);
    g.fill(0x8d8478);
  }
}

export function createScenery(world) {
  const skyCanvas = document.createElement('canvas');
  skyCanvas.width = 1;
  skyCanvas.height = 256;
  const skyCtx = skyCanvas.getContext('2d');
  const skyTexture = Texture.from(skyCanvas);
  const sky = new Sprite(skyTexture);
  let skyKey = '';

  // Distant, so the field follows the camera and only creeps as the shot travels.
  // The band is taller than the view, and the alpha is what brings it in at 1000 ft.
  const starSpan = 2200;
  const stars = tiledLayer(world, starSpan, (g, x0) => drawStars(g, x0, starSpan));

  const mars = new Container();
  const marsGfx = new Graphics();
  drawMars(marsGfx);
  mars.addChild(marsGfx);
  world.addChild(mars);

  const sun = new Container();
  const sunGfx = new Graphics();
  sunGfx.circle(0, 0, 118);
  sunGfx.fill({ color: 0xffe7a3, alpha: 0.28 });
  sunGfx.circle(0, 0, 78);
  sunGfx.fill({ color: 0xfff0c2, alpha: 0.45 });
  sunGfx.circle(0, 0, 42);
  sunGfx.fill(0xffe38a);
  sunGfx.circle(-10, 10, 10);
  sunGfx.fill({ color: 0xfff8dc, alpha: 0.85 });
  sun.addChild(sunGfx);
  world.addChild(sun);

  const ranges = [
    // Open on the right of the title, where the sun sits. The crown is the peak on the left.
    { color: 0xc5d8ea, line: 0xa9c4da, height: 740, parallax: 0.12, seed: 0x51a3, span: 5200, snow: 0.55, grand: true, spread: 2, saddle: null, crown: { at: 4700, width: 1600 }, lead: 1200 },
    { color: 0x8aa4bc, line: 0x6d8eab, height: 268, parallax: 0.28, seed: 0x51a2, span: 3800, snow: 0.55, grand: true, saddle: [3280, 3800], crown: { at: 400, width: 800 } },
    { color: 0x6d9462, line: 0x4e7848, height: 168, parallax: 0.46, seed: 0x51a1, span: 2400, snow: 0, grand: false, saddle: null, crown: null },
  ].map((spec) => {
    const pts = peakSamples(spec.span, spec.height, spec.seed, spec.grand, spec.saddle, spec.crown, spec.lead, spec.spread || 1);
    return tiledLayer(world, spec.span, (g, x0) => {
      fillRidge(g, pts, x0, spec.color, spec.line, false);
      if (spec.snow) fillSnow(g, pts, x0, spec.height * spec.snow);
    });
  });

  const foothills = [
    { color: 0x8ed468, line: 0x62b44c, base: 34, amp: 18, freq: 2, phase: 0.4, parallax: 0.66, span: 1800 },
    { color: 0x3f8f62, line: 0x2f7048, base: 20, amp: 12, freq: 3, phase: 1.1, parallax: 0.82, span: 1400 },
  ].map((spec) => {
    const pts = waveSamples(spec.span, spec.base, spec.amp, spec.freq, spec.phase);
    return {
      ...tiledLayer(world, spec.span, (g, x0) => fillRidge(g, pts, x0, spec.color, spec.line)),
      parallax: spec.parallax,
    };
  });
  ranges.forEach((entry, i) => {
    entry.parallax = [0.12, 0.28, 0.46][i];
  });

  // Each band wraps on its own. Clouds stop below 50 ft, so a climb leaves them.
  // clearLaunch: keep the barrel sky open on the title / aim view.
  function scatterClouds(rng, count, y0, y1, gap0, gap1, clearLaunch) {
    const group = [];
    let cursor = rng() * 280;
    for (let i = 0; i < count; i++) {
      const made = drawCloud(rng);
      const gap = gap0 + rng() * (gap1 - gap0);
      let altitude = y0 + rng() * (y1 - y0);
      if (clearLaunch) {
        // Sit above the muzzle / first arc so a puff does not mask the shot.
        altitude = Math.max(altitude, 290 + rng() * Math.max(40, y1 - 290));
      }
      let home = cursor;
      if (clearLaunch) {
        // Aim cam looks near the cannon. Nudge homes that would park a low
        // cloud across the barrel into the open sky beside it.
        const center = home + made.width / 2;
        const near = Math.abs(center - CANNON_X) < 420 || Math.abs(center - 500) < 380;
        if (near) home += 520 + rng() * 640;
      }
      const cloud = {
        root: new Container(),
        width: made.width,
        home,
        altitude,
        phase: rng() * Math.PI * 2,
        bob: 7 + rng() * 16,
        rate: 0.12 + rng() * 0.22,
      };
      cloud.root.addChild(made.graphic);
      world.addChild(cloud.root);
      group.push(cloud);
      cursor = Math.max(cursor, home) + made.width + gap;
    }
    const span = Math.max(cursor, 1);
    const origin = -span * 0.45;
    for (const cloud of group) {
      cloud.span = span;
      // Fixed world anchor so a camera snap (Fire again) rematerializes the
      // same lane. Only fillClouds / reshuffleClouds rolls a new layout.
      cloud.anchor = origin + cloud.home + cloud.width / 2;
      cloud.root.position.set(cloud.anchor, cloud.altitude);
    }
    return group;
  }

  // Puffs and the bob sit above the anchor. 84 keeps that drawing under 50 ft.
  const cloudTop = GROUND_Y + 50 * PIXELS_PER_FOOT - 84;
  const clouds = [];

  function fillClouds(seed) {
    for (let i = clouds.length - 1; i >= 0; i--) {
      const cloud = clouds[i];
      world.removeChild(cloud.root);
      cloud.root.destroy({ children: true });
      clouds.pop();
    }
    const cloudRng = mulberry32(seed >>> 0);
    clouds.push(
      ...scatterClouds(cloudRng, 12, 150, 470, 70, 200, true),
      ...scatterClouds(cloudRng, 10, 400, 1150, 80, 220, false),
      ...scatterClouds(cloudRng, 10, 1000, cloudTop, 80, 230, false),
    );
  }

  fillClouds((Math.random() * 0xffffffff) >>> 0);

  const flyLayer = new Container();
  world.addChild(flyLayer);

  const ground = new Graphics();
  ground.rect(-8000, -6000, 16000, 5930);
  ground.fill(PAL.dirt);
  ground.rect(-8000, -78, 16000, 86);
  ground.fill(PAL.grassDark);
  ground.rect(-8000, -8, 16000, 18);
  ground.fill(PAL.grass);
  ground.rect(-8000, 2, 16000, 8);
  ground.fill(PAL.grassLite);
  world.addChild(ground);

  const tuftSpan = 960;
  const tufts = tiledLayer(world, tuftSpan, (g, x0) => grassDecor(g, x0, tuftSpan));

  function paintSky(screenW, screenH, camY, scale) {
    sky.width = screenW;
    sky.height = screenH;
    const key = `${screenW}|${screenH}|${camY.toFixed(1)}|${scale.toFixed(4)}`;
    if (key === skyKey) return;
    skyKey = key;
    const grd = skyCtx.createLinearGradient(0, 0, 0, skyCanvas.height);
    const steps = 14;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const worldY = camY + (screenH / 2 - t * screenH) / scale;
      grd.addColorStop(t, skyCss(worldY));
    }
    skyCtx.fillStyle = grd;
    skyCtx.fillRect(0, 0, 1, skyCanvas.height);
    skyTexture.source.update();
  }

  return {
    sky,
    flyLayer,
    reshuffleClouds() {
      fillClouds((Math.random() * 0xffffffff) >>> 0);
    },
    update(time, cam, view) {
      paintSky(view.screenW, view.screenH, cam.y, view.scale);
      const halfW = view.halfW;
      const halfH = view.halfH;
      const feet = (cam.y - GROUND_Y) / PIXELS_PER_FOOT;
      const space = spaceBlend(feet);
      track(stars, cam.x, 0.02);
      stars.layer.position.y = cam.y;
      stars.layer.alpha = space;
      stars.layer.visible = space > 0.02;
      // The camera looks ahead, so the kitten is left of center by this lead.
      // Keep the disc smaller, further left, and a little lower than that path.
      const lead = Math.min(220, halfW * 0.42);
      const margin = 36;
      const room = Math.max(20, (halfW - lead - margin - 18) / 2);
      const radius = Math.max(12, Math.min(halfH * 0.125, room / 1.35, 38));
      const reach = radius * 1.16;
      mars.scale.set(radius / 100);
      const prefer = cam.x - lead - margin - reach - 22;
      const minX = cam.x - halfW + radius + 6;
      mars.position.set(Math.max(prefer, minX), cam.y - halfH * 0.16);
      mars.alpha = space;
      mars.visible = space > 0.02;
      // The disc stays lit in the night sky. 84 keeps the core inside the corner.
      sun.position.set(cam.x + halfW - 84, cam.y + halfH - 84);
      for (let i = 0; i < ranges.length; i++) track(ranges[i], cam.x, ranges[i].parallax);
      for (let i = 0; i < foothills.length; i++) track(foothills[i], cam.x, foothills[i].parallax);
      track(tufts, cam.x, 1);
      ground.position.x = cam.x;
      for (let i = 0; i < clouds.length; i++) {
        const cloud = clouds[i];
        const left = cam.x - cloud.span * 0.45;
        cloud.root.position.x = left
          + ((cloud.anchor - left) % cloud.span + cloud.span) % cloud.span;
        cloud.root.position.y = cloud.altitude + Math.sin(time * cloud.rate + cloud.phase) * cloud.bob;
      }
    },
  };
}
