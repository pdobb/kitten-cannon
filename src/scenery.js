import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { PAL } from './look.js';

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

// Sky color is a function of world height, sampled down the screen. The warm
// band sits on world y = 0, the same line the grass and the ranges use.
const SKY_STOPS = [
  [-800, [196, 137, 78]],
  [0, [186, 220, 150]],
  [50, [176, 222, 236]],
  [160, [158, 212, 246]],
  [480, [110, 186, 232]],
  [1400, [74, 156, 214]],
  [5000, [46, 122, 196]],
];

function skyCss(y) {
  let i = 1;
  while (i < SKY_STOPS.length - 1 && y > SKY_STOPS[i][0]) i += 1;
  const a = SKY_STOPS[i - 1];
  const b = SKY_STOPS[i];
  const t = Math.max(0, Math.min(1, (y - a[0]) / (b[0] - a[0])));
  const c = a[1].map((v, k) => Math.round(v + (b[1][k] - v) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

function fillRidge(g, pts, x0, color, line) {
  const base = -48;
  g.moveTo(x0 + pts[0].x, base);
  for (let i = 0; i < pts.length; i++) g.lineTo(x0 + pts[i].x, pts[i].y);
  g.lineTo(x0 + pts[pts.length - 1].x, base);
  g.closePath();
  g.fill(color);
  g.moveTo(x0 + pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) g.lineTo(x0 + pts[i].x, pts[i].y);
  g.stroke({ width: 3, color: line, join: 'round', cap: 'round' });
}

function fillSnow(g, pts, x0, limit) {
  for (let i = 1; i < pts.length - 1; i++) {
    const y = pts[i].y;
    if (y < limit) continue;
    if (y < pts[i - 1].y || y < pts[i + 1].y) continue;
    const tip = pts[i];
    const left = pts[i - 1];
    const right = pts[i + 1];
    const snow = tip.y * 0.62;
    g.poly([
      x0 + left.x + (tip.x - left.x) * 0.35, left.y + (snow - left.y) * 0.15,
      x0 + tip.x, tip.y + 3,
      x0 + right.x + (tip.x - right.x) * 0.35, right.y + (snow - right.y) * 0.15,
    ]);
    g.fill(0xfffdf8);
  }
}

// Peaks along one tile. Both ends sit at y = 0 so the next copy meets this one.
function peakSamples(span, height, seed) {
  const rng = mulberry32(seed);
  const pts = [{ x: 0, y: 0 }];
  let x = 30;
  while (x < span - 100) {
    const gap = 60 + rng() * 200;
    const width = 200 + rng() * 480;
    const left = x + gap;
    const right = Math.min(span - 16, left + width);
    if (right - left < 120) break;
    const peak = height * (0.4 + rng() * 0.6);
    const power = 0.65 + rng() * 0.7;
    const skew = (rng() - 0.5) * 0.16;
    const steps = 16;
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const u = Math.max(0, Math.min(1, t - skew * Math.sin(t * Math.PI)));
      const bell = Math.sin(u * Math.PI) ** power;
      pts.push({ x: left + (right - left) * t, y: peak * bell });
    }
    x = right;
  }
  pts.push({ x: span, y: 0 });
  for (let i = 1; i < pts.length; i++) {
    if (pts[i].x <= pts[i - 1].x) pts[i].x = pts[i - 1].x + 1;
  }
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
    { color: 0xc5d8ea, line: 0xa9c4da, height: 320, parallax: 0.12, seed: 0x51a3, span: 3000, snow: 0.58 },
    { color: 0x8aa4bc, line: 0x6d8eab, height: 230, parallax: 0.28, seed: 0x51a2, span: 2600, snow: 0.64 },
    { color: 0x6d9462, line: 0x4e7848, height: 150, parallax: 0.46, seed: 0x51a1, span: 2200, snow: 0 },
  ].map((spec) => {
    const pts = peakSamples(spec.span, spec.height, spec.seed);
    return tiledLayer(world, spec.span, (g, x0) => {
      fillRidge(g, pts, x0, spec.color, spec.line);
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

  const clouds = [];
  const cloudRng = mulberry32(0xc10d);
  let cursor = 0;
  for (let i = 0; i < 14; i++) {
    const made = drawCloud(cloudRng);
    const gap = 180 + cloudRng() * 460;
    const cloud = {
      root: new Container(),
      width: made.width,
      home: cursor,
      altitude: 200 + cloudRng() * 260,
      phase: cloudRng() * Math.PI * 2,
      bob: 6 + cloudRng() * 10,
      rate: 0.15 + cloudRng() * 0.2,
    };
    cloud.root.addChild(made.graphic);
    world.addChild(cloud.root);
    clouds.push(cloud);
    cursor += made.width + gap;
  }
  const cloudSpan = cursor;
  const cloudOrigin = -cloudSpan * 0.45;
  for (const cloud of clouds) {
    cloud.root.position.set(cloudOrigin + cloud.home + cloud.width / 2, cloud.altitude);
  }

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
    update(time, cam, view) {
      paintSky(view.screenW, view.screenH, cam.y, view.scale);
      const halfW = view.halfW;
      const halfH = view.halfH;
      sun.position.set(cam.x - halfW * 0.72, cam.y + halfH * 0.58);
      for (let i = 0; i < ranges.length; i++) track(ranges[i], cam.x, ranges[i].parallax);
      for (let i = 0; i < foothills.length; i++) track(foothills[i], cam.x, foothills[i].parallax);
      track(tufts, cam.x, 1);
      ground.position.x = cam.x;
      const left = cam.x - cloudSpan * 0.45;
      for (let i = 0; i < clouds.length; i++) {
        const cloud = clouds[i];
        const x = cloud.root.position.x;
        cloud.root.position.x = left + ((x - left) % cloudSpan + cloudSpan) % cloudSpan;
        cloud.root.position.y = cloud.altitude + Math.sin(time * cloud.rate + cloud.phase) * cloud.bob;
      }
    },
  };
}
