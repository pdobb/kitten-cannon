import * as THREE from 'three';
import { createAudio } from './audio.js';
import {
  createCannon,
  createKitten as makeKittenMesh,
  createParticles,
  createProp,
  createStake,
} from './actors.js';
import { buildCourse, resetCourse } from './course.js';
import { createLook } from './look.js';
import { createKitten as makeState, step } from './physics.js';
import { createFlybys } from './flyby.js';
import { createScenery } from './scenery.js';
import {
  ANGLE_MAX,
  ANGLE_MIN,
  DEFAULT_ANGLE,
  CANNON_X,
  GROUND_Y,
  MAX_SPEED,
  PIVOT_X,
  PIXELS_PER_FOOT,
  POWER_MAX,
  POWER_MIN,
  STEP,
  aimVector,
  barrelMuzzle,
  feetFromAltitude,
  feetFromTravel,
  formatFt,
  formatMph,
  launchPoint,
  mphFromSpeed,
  peekPoint,
  powerFromClock,
} from './tune.js';

document.getElementById('need-js')?.remove();

// The published page is one file. Register only that build, so the dev server
// does not keep a worker around. updateViaCache skips a stale sw.js.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).catch(() => {});
}

const FAR_KEY = 'kitten-cannon-best-ft';
const HIGH_KEY = 'kitten-cannon-highest-ft';
const FAST_KEY = 'kitten-cannon-fastest';
const KITTY_Z = 6;
const PROP_Z = 2;
const NOTES = {
  landed: 'Soft landing.',
  spikes: 'The spikes got there first.',
  venus: 'The flytrap was hungry.',
};
const SHOUT = {
  tnt: 'BOOM',
  balloon: 'POP',
  trampoline: 'BOING',
  spikes: 'YOW',
  venus: 'GULP',
};

const app = document.querySelector('#app');
const canvas = document.querySelector('#view');
const distanceEl = document.querySelector('#distance');
const altitudeEl = document.querySelector('#altitude');
const speedEl = document.querySelector('#speed');
const recordsEl = document.querySelector('#records');
const titleBestEl = document.querySelector('#title-best');
const angleEl = document.querySelector('#angle');
const powerEl = document.querySelector('#power');
const powerLabelEl = document.querySelector('#power-label');
const bannerEl = document.querySelector('#banner');
const muteEl = document.querySelector('#mute');
const cardEl = document.querySelector('#card');
const cardKickerEl = document.querySelector('#card-kicker');
const cardFeetEl = document.querySelector('#card-feet');
const cardNoteEl = document.querySelector('#card-note');
const cardBestEl = document.querySelector('#card-best');
const padFireEl = document.querySelector('#pad-fire');

const look = createLook();
const audio = createAudio();
const course = buildCourse();

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.setClearColor(0x9ed4f6);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(34, 1, 1, 20000);

scene.add(new THREE.HemisphereLight(0xd7ecff, 0x6ea044, 0.95));
const keyLight = new THREE.DirectionalLight(0xfff3d4, 1.3);
keyLight.position.set(60, 200, 160);
scene.add(keyLight);
const fillLight = new THREE.DirectionalLight(0xc5ddff, 0.4);
fillLight.position.set(-80, 60, 40);
scene.add(fillLight);

const scenery = createScenery(scene, look);
const flybys = createFlybys(scene, look);
const kitten = makeKittenMesh(look);
scene.add(kitten.mesh);
const cannon = createCannon(look);
scene.add(cannon.root);
const stake = createStake(look);
scene.add(stake);
// Record poles stay for this visit. The end flag still marks the latest landing.
const poles = [];
const particles = createParticles(look, scene);

for (let i = 0; i < course.length; i++) {
  const prop = course[i];
  const built = createProp(prop.type, look, prop.x);
  prop.mesh = built.mesh;
  prop.parts = built.parts;
  prop.squash = 0;
  prop.chomp = 0;
  built.mesh.position.set(prop.x, prop.type === 'balloon' ? prop.y : 0, PROP_Z);
  scene.add(built.mesh);
}

const shadow = new THREE.Mesh(
  new THREE.CircleGeometry(16, 18),
  new THREE.MeshBasicMaterial({ color: 0x1d3a16, transparent: true, opacity: 0.28, depthWrite: false })
);
shadow.rotation.x = -Math.PI / 2;
shadow.position.y = 0.7;
scene.add(shadow);

const game = {
  phase: 'title',
  angle: DEFAULT_ANGLE,
  power: POWER_MIN,
  kitten: null,
  feet: 0,
  furthest: loadNumber(FAR_KEY),
  furthestX: 0,
  highest: loadNumber(HIGH_KEY),
  fastest: loadNumber(FAST_KEY),
  peakY: 0,
  peakSpeed: 0,
  was: { furthest: 0, highest: 0, fastest: 0 },
  hold: 0,
  squash: 0,
  sink: 0,
  recoil: 0,
  checked: false,
};
const cam = { x: 500, y: 120, z: 980, shake: 0 };
const hold = { ArrowUp: 0, ArrowDown: 0 };

const params = new URLSearchParams(location.search);

function loadNumber(key) {
  try {
    return Number(localStorage.getItem(key)) || 0;
  } catch {
    return 0;
  }
}

function saveRecords() {
  try {
    localStorage.setItem(FAR_KEY, String(game.furthest));
    localStorage.setItem(HIGH_KEY, String(game.highest));
    localStorage.setItem(FAST_KEY, String(game.fastest));
  } catch {
    // Private mode can refuse storage. The score still shows for this run.
  }
}

function xForFeet(feet) {
  return launchPoint(DEFAULT_ANGLE).x + feet * PIXELS_PER_FOOT;
}

function plantPole(x, feet) {
  if (!(feet > 0) || !Number.isFinite(x)) return;
  for (const pole of poles) {
    if (Math.abs(pole.x - x) < 48) {
      if (x > pole.x) {
        pole.x = x;
        pole.feet = feet;
        pole.mesh.position.x = x;
      }
      return;
    }
  }
  const mesh = createStake(look);
  mesh.visible = true;
  mesh.position.set(x, 0, 10);
  scene.add(mesh);
  poles.push({ x, feet, mesh });
}

function setPhase(phase) {
  game.phase = phase;
  app.dataset.phase = phase;
  cardEl.classList.toggle('hidden', phase !== 'result');
  padFireEl.textContent = phase === 'result' ? 'Again' : 'Fire';
  paintRecords();
}

function recordRows() {
  return [
    ['Furthest', game.furthest > 0 ? formatFt(game.furthest) : '—', 'far'],
    ['Highest', game.highest > 0 ? formatFt(game.highest) : '—', 'high'],
    ['Fastest', game.fastest > 0 ? formatMph(mphFromSpeed(game.fastest)) : '—', 'fast'],
  ];
}

function appendRecordRows(el, marks) {
  for (const [label, value, key] of recordRows()) {
    const row = document.createElement('p');
    if (marks && marks[key]) row.className = 'fresh';
    const name = document.createElement('span');
    name.textContent = label;
    const num = document.createElement('b');
    num.textContent = marks && marks[key] ? `${value}  new` : value;
    row.append(name, num);
    el.append(row);
  }
}

function paintRecords() {
  recordsEl.replaceChildren();
  appendRecordRows(recordsEl, null);
  titleBestEl.replaceChildren();
  if (game.furthest > 0 || game.highest > 0 || game.fastest > 0) {
    appendRecordRows(titleBestEl, null);
  }
}

function clampAngle() {
  game.angle = Math.max(ANGLE_MIN, Math.min(ANGLE_MAX, game.angle));
}

function nudge(dir) {
  if (game.phase !== 'aim') return;
  game.angle += dir;
  clampAngle();
}

function shout(text) {
  bannerEl.textContent = text;
  bannerEl.classList.remove('show');
  // Restart the CSS animation.
  void bannerEl.offsetWidth;
  bannerEl.classList.add('show');
}

function burst(x, y, colors, count, speed, life, size) {
  for (let i = 0; i < colors.length; i++) {
    particles.spawn(x, y, colors[i], count, speed, life, size);
  }
}

function safeAudio(fn) {
  try {
    fn();
  } catch {
    // A phone can refuse the audio context. The shot still happens.
  }
}

function startAim() {
  flybys.clear();
  setPhase('aim');
  stake.visible = false;
  kitten.mesh.visible = true;
  game.kitten = null;
  game.sink = 0;
  game.squash = 0;
  safeAudio(() => audio.unlock());
}

function beginShot(forcedPower) {
  safeAudio(() => audio.unlock());
  const power = forcedPower == null ? powerFromClock(performance.now() / 1000) : forcedPower;
  game.power = power;
  game.was = { furthest: game.furthest, highest: game.highest, fastest: game.fastest };
  game.kitten = makeState(game.angle, power);
  game.feet = 0;
  game.peakY = game.kitten.y;
  game.peakSpeed = Math.hypot(game.kitten.vx, game.kitten.vy);
  commitRecords();
  game.hold = 0;
  game.squash = 0;
  game.sink = 0;
  game.recoil = 26;
  stake.visible = false;
  kitten.mesh.visible = true;
  cam.shake = Math.min(1.4, cam.shake + 0.7);
  const muzzle = barrelMuzzle(game.angle);
  burst(muzzle.x, muzzle.y, [0xfff6e0, 0xc9c3ba, 0xffb703], 8, 70, 0.5, 18);
  audio.launch();
  audio.meow();
  setPhase('flight');
}

function afterStep() {
  const k = game.kitten;
  if (!k) return;
  if (k.y > game.peakY) game.peakY = k.y;
  const speed = Math.hypot(k.vx, k.vy);
  if (speed > game.peakSpeed) game.peakSpeed = speed;
}

function commitRecords() {
  const k = game.kitten;
  if (!k) return;
  const far = feetFromTravel(k.startX, k.x);
  const high = feetFromAltitude(game.peakY);
  const fast = game.peakSpeed;
  let dirty = false;
  if (far > game.furthest) {
    game.furthest = far;
    game.furthestX = k.x;
    dirty = true;
  }
  if (high > game.highest) {
    game.highest = high;
    dirty = true;
  }
  if (fast > game.fastest) {
    game.fastest = fast;
    dirty = true;
  }
  if (dirty) {
    saveRecords();
    paintRecords();
  }
}

function finish() {
  const k = game.kitten;
  afterStep();
  commitRecords();
  game.feet = feetFromTravel(k.startX, k.x);
  const marks = {
    far: game.feet > game.was.furthest,
    high: feetFromAltitude(game.peakY) > game.was.highest,
    fast: game.peakSpeed > game.was.fastest,
  };
  const fresh = [];
  if (marks.far) fresh.push('furthest');
  if (marks.high) fresh.push('highest');
  if (marks.fast) fresh.push('fastest');
  cardKickerEl.textContent = fresh.length === 0 ? 'Distance' : fresh.length === 1 ? `New ${fresh[0]}` : 'New records';
  cardFeetEl.textContent = formatFt(game.feet);
  cardNoteEl.textContent = NOTES[k.cause] || 'That is the end of the line.';
  cardBestEl.replaceChildren();
  const peakFt = feetFromAltitude(game.peakY);
  if (peakFt > 100) {
    const up = document.createElement('p');
    up.className = 'flight-up';
    up.textContent = `${peakFt.toLocaleString('en-US')} FT UP`;
    cardBestEl.append(up);
  }
  const pace = document.createElement('p');
  pace.className = 'flight-speed';
  pace.textContent = formatMph(mphFromSpeed(game.peakSpeed));
  cardBestEl.append(pace);
  appendRecordRows(cardBestEl, marks);
  if (game.furthest > game.was.furthest) plantPole(game.furthestX, game.furthest);
  const marked = poles.some((pole) => Math.abs(pole.x - k.x) < 48);
  if (marked) {
    stake.visible = false;
  } else {
    stake.position.set(k.x, 0, 10);
    stake.visible = true;
  }
  setPhase('result');
}

function retry() {
  resetCourse(course);
  for (let i = 0; i < course.length; i++) {
    const prop = course[i];
    prop.squash = 0;
    prop.chomp = 0;
    prop.mesh.visible = true;
    prop.mesh.scale.set(1, 1, 1);
    if (prop.parts.bed) prop.parts.bed.scale.y = 1;
    if (prop.parts.head) prop.parts.head.scale.set(1.05, 0.9, 0.95);
    if (prop.parts.stripe) prop.parts.stripe.position.y = 25.2;
  }
  game.snap = true;
  startAim();
}

function onEvent(event) {
  const k = game.kitten;
  if (!event) return;
  if (event === 'bounce') {
    game.squash = 1;
    cam.shake = Math.min(1.2, cam.shake + 0.22);
    audio.bounce(Math.abs(k.vx));
    burst(k.x, GROUND_Y + 4, [0xe7d3a4, 0xc4a574], 4, 50, 0.35, 10);
    if (Math.abs(k.vx) > 18) burst(k.x, GROUND_Y + 6, [0xe23b2e], 2, 40, 0.25, 8);
    return;
  }
  if (event === 'settle') {
    game.hold = 0.45;
    audio.bounce(8);
    return;
  }
  const prop = course.find((p) => p.spent && p.type === event) || null;
  if (event === 'tnt' || event === 'balloon') {
    cam.shake = Math.min(1.6, cam.shake + 0.85);
    audio[event === 'tnt' ? 'boom' : 'pop']();
    burst(k.x, k.y, [0xfff1c2, 0xffb703, 0xff5a1f], 6, 120, 0.55, 22);
    shout(SHOUT[event]);
  } else if (event === 'trampoline') {
    cam.shake = Math.min(1, cam.shake + 0.35);
    audio.boing();
    shout(SHOUT.trampoline);
    const bed = course.find((p) => p.type === 'trampoline' && p.ready === k.frame + 10);
    if (bed) bed.squash = 1;
  } else if (event === 'spikes') {
    game.hold = 0.7;
    cam.shake = Math.min(1.4, cam.shake + 0.7);
    audio.yow();
    burst(k.x, k.y, [0xfff6e0, 0xe23b2e], 5, 70, 0.4, 12);
    shout(SHOUT.spikes);
  } else if (event === 'venus') {
    game.hold = 0.8;
    cam.shake = Math.min(1.2, cam.shake + 0.55);
    audio.chomp();
    kitten.mesh.visible = false;
    shout(SHOUT.venus);
    if (prop) prop.chomp = 1;
    else {
      const plant = course.find((p) => p.type === 'venus' && p.spent);
      if (plant) plant.chomp = 1;
    }
  }
}

function applyHold(dt) {
  if (game.phase !== 'aim') return;
  const now = performance.now();
  if (hold.ArrowUp && now - hold.ArrowUp > 150) game.angle += 70 * dt;
  if (hold.ArrowDown && now - hold.ArrowDown > 150) game.angle -= 70 * dt;
  clampAngle();
}

function press(code) {
  if (hold[code]) return;
  hold[code] = performance.now();
  nudge(code === 'ArrowUp' ? 1 : -1);
}

function release(code) {
  hold[code] = 0;
}

function onAction() {
  if (game.phase === 'title') startAim();
  else if (game.phase === 'aim') beginShot(null);
  else if (game.phase === 'flight' || game.phase === 'result') retry();
}

window.addEventListener('keydown', (e) => {
  const accept = e.code === 'Space' || e.code === 'Enter' || e.code === 'NumpadEnter';
  if (accept || e.code === 'ArrowUp' || e.code === 'ArrowDown') e.preventDefault();
  if (e.code === 'ArrowUp' || e.code === 'ArrowDown') {
    if (!e.repeat) press(e.code);
    return;
  }
  if (e.repeat) return;
  if (accept) onAction();
  else if (e.code === 'KeyR') retry();
  else if (e.code === 'KeyM') {
    safeAudio(() => audio.unlock());
    paintMute(audio.toggleMute());
  }
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'ArrowUp' || e.code === 'ArrowDown') release(e.code);
});

// iOS drops click on a local file, and it also drops the first tap when a
// full-screen parent has pointer-events: none. touchend is the gesture that fires.
function bindTap(el, fn) {
  let last = 0;
  const run = (event) => {
    const now = performance.now();
    if (now - last < 400) return;
    last = now;
    if (event.cancelable) event.preventDefault();
    fn();
  };
  el.addEventListener('click', run);
  el.addEventListener('touchend', run, { passive: false });
}

const fullscreenEl = document.querySelector('#fullscreen');

function fullscreenOn() {
  return !!(document.fullscreenElement || document.webkitFullscreenElement);
}

function paintFullscreen() {
  const on = fullscreenOn();
  fullscreenEl.classList.toggle('is-full', on);
  fullscreenEl.setAttribute('aria-label', on ? 'Exit full screen' : 'Full screen');
}

function toggleFullscreen() {
  try {
    if (fullscreenOn()) {
      const exit = document.exitFullscreen || document.webkitExitFullscreen;
      if (!exit) return;
      const pending = exit.call(document);
      if (pending && typeof pending.catch === 'function') pending.catch(() => {});
      return;
    }
    const root = document.documentElement;
    const req = root.requestFullscreen || root.webkitRequestFullscreen;
    if (!req) return;
    let pending;
    try {
      pending = req.call(root, { navigationUI: 'hide' });
    } catch {
      pending = req.call(root);
    }
    if (pending && typeof pending.catch === 'function') pending.catch(() => {});
  } catch {
    // iOS Safari refuses page fullscreen. The button stays put.
  }
}

if (document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen) {
  bindTap(fullscreenEl, toggleFullscreen);
  document.addEventListener('fullscreenchange', paintFullscreen);
  document.addEventListener('webkitfullscreenchange', paintFullscreen);
} else {
  fullscreenEl.hidden = true;
}

bindTap(document.querySelector('#start'), startAim);
bindTap(document.querySelector('#again'), retry);
function paintMute(muted) {
  muteEl.classList.toggle('is-muted', muted);
  muteEl.setAttribute('aria-label', muted ? 'Sound off' : 'Sound on');
}

bindTap(muteEl, () => {
  safeAudio(() => audio.unlock());
  paintMute(audio.toggleMute());
});

// A tap on the field is Enter. A vertical drag aims. Buttons keep their own taps.
let touchAim = null;
function fieldTarget(target) {
  return !(target && target.closest && target.closest('button, a'));
}
app.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'mouse' || !fieldTarget(e.target)) return;
  safeAudio(() => audio.unlock());
  touchAim = {
    id: e.pointerId,
    x: e.clientX,
    y: e.clientY,
    lastY: e.clientY,
    moved: false,
  };
});
app.addEventListener('pointermove', (e) => {
  if (!touchAim || e.pointerId !== touchAim.id) return;
  const dy = e.clientY - touchAim.lastY;
  const adx = Math.abs(e.clientX - touchAim.x);
  const ady = Math.abs(e.clientY - touchAim.y);
  if (!touchAim.moved) {
    if (Math.hypot(adx, ady) < 16) return;
    touchAim.moved = true;
  }
  touchAim.lastY = e.clientY;
  if ((game.phase === 'aim' || game.phase === 'title') && ady >= adx) {
    game.angle -= dy * 0.32;
    clampAngle();
  }
});
function endTouchAim(e) {
  if (!touchAim || e.pointerId !== touchAim.id) return;
  const tap = !touchAim.moved && fieldTarget(e.target);
  touchAim = null;
  if (tap) onAction();
}
app.addEventListener('pointerup', endTouchAim);
app.addEventListener('pointercancel', endTouchAim);

for (const button of document.querySelectorAll('#pad button')) {
  const act = button.dataset.act;
  button.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    safeAudio(() => audio.unlock());
    if (act === 'fire') onAction();
    else press(act === 'up' ? 'ArrowUp' : 'ArrowDown');
  });
  button.addEventListener('pointerup', () => {
    if (act === 'up') release('ArrowUp');
    if (act === 'down') release('ArrowDown');
  });
  button.addEventListener('pointerleave', () => {
    if (act === 'up') release('ArrowUp');
    if (act === 'down') release('ArrowDown');
  });
}

function resize() {
  const vv = window.visualViewport;
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    window.navigator.standalone === true;
  // The installed app used to size to the visual viewport and leave a sky-blue
  // strip under the canvas. Cover the whole screen there. A browser tab still
  // follows the visual viewport so the address bar can come and go.
  if (standalone) {
    app.style.left = '0px';
    app.style.top = '0px';
    app.style.width = `${window.innerWidth}px`;
    app.style.height = `${window.innerHeight}px`;
    app.style.right = 'auto';
    app.style.bottom = 'auto';
  } else if (vv) {
    app.style.left = `${vv.offsetLeft}px`;
    app.style.top = `${vv.offsetTop}px`;
    app.style.width = `${vv.width}px`;
    app.style.height = `${vv.height}px`;
    app.style.right = 'auto';
    app.style.bottom = 'auto';
  }
  const w = canvas.clientWidth || window.innerWidth;
  const h = canvas.clientHeight || window.innerHeight;
  camera.aspect = w / Math.max(1, h);
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
}
let viewportFrame = 0;
function queueResize() {
  if (viewportFrame) return;
  viewportFrame = requestAnimationFrame(() => {
    viewportFrame = 0;
    resize();
  });
}
window.addEventListener('resize', queueResize);
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', queueResize);
  window.visualViewport.addEventListener('scroll', queueResize);
}
resize();

function placeKitten(time) {
  const flying = game.phase === 'flight' || game.phase === 'result';
  if (!flying) {
    const peek = peekPoint(game.angle);
    const bob = Math.sin(time * 3.2) * 1.1;
    kitten.mesh.position.set(peek.x, peek.y + bob, KITTY_Z);
    kitten.mesh.rotation.z = (game.angle * Math.PI) / 180;
    kitten.mesh.scale.set(1, 1, 1);
    kitten.eye.scale.y = Math.sin(time * 0.7) > 0.975 ? 0.12 : 1;
    return;
  }
  const k = game.kitten;
  const y = k.cause === 'spikes' ? Math.max(8, k.y - game.sink) : k.y;
  kitten.mesh.position.set(k.x, y, KITTY_Z);
  if (k.cause === 'landed') {
    const current = kitten.mesh.rotation.z;
    const rest = Math.round(current / (Math.PI * 2)) * Math.PI * 2;
    kitten.mesh.rotation.z = current + (rest - current) * 0.18;
  } else {
    kitten.mesh.rotation.z = (k.spin * Math.PI) / 180;
  }
  const s = game.squash;
  kitten.mesh.scale.set(1 + s * 0.28, 1 - s * 0.32, 1);
  kitten.eye.scale.y = 1;
}

function updateProps(time, dt) {
  for (let i = 0; i < course.length; i++) {
    const prop = course[i];
    if (prop.type === 'balloon') {
      if (!prop.spent) prop.y = prop.baseY + Math.sin(time * 1.5 + prop.bob) * 11;
      prop.mesh.position.y = prop.y;
      prop.mesh.visible = !prop.spent;
      if (prop.parts.spark && !prop.spent) {
        prop.parts.spark.scale.setScalar(0.85 + Math.sin(time * 14 + prop.bob) * 0.35);
      }
    }
    if (prop.squash > 0) {
      prop.squash *= Math.exp(-dt * 7);
      if (prop.parts.bed) {
        prop.parts.bed.scale.y = 1 - prop.squash * 0.65;
        if (prop.parts.stripe) prop.parts.stripe.position.y = 25.2 - prop.squash * 3;
      }
    }
    if (prop.parts.head && prop.type === 'venus') {
      const shut = prop.chomp || 0;
      prop.parts.head.scale.set(1.05, 0.9 * (1 - shut * 0.5), 0.95);
    }
    if ((prop.type === 'tnt' || prop.type === 'spikes') && prop.spent) {
      // Spikes stay; the crate is gone after it blows.
      if (prop.type === 'tnt') prop.mesh.visible = false;
    }
  }
}

function updateCamera(dt) {
  const flying = game.phase === 'flight' || game.phase === 'result';
  const k = game.kitten;
  // One distance for the whole flight. The camera follows; it does not zoom.
  // The lead shrinks on a narrow screen so the kitten stays in frame.
  const z = 980;
  const halfW = Math.tan((camera.fov * Math.PI) / 360) * z * Math.max(0.3, camera.aspect);
  const lead = Math.min(220, halfW * 0.42);
  // x=490 looks down the field. A narrow view then starts past the wheels.
  const aimX = Math.min(490, CANNON_X + PIVOT_X - 84 + halfW);
  const focusX = flying ? k.x + lead : aimX;
  const focusY = flying ? Math.max(120, k.y - 36) : 120;
  if (flying) {
    cam.x = focusX;
    cam.y = focusY;
    cam.z = z;
  } else {
    const blend = 1 - Math.exp(-dt * (game.snap ? 40 : 4));
    cam.x += (focusX - cam.x) * blend;
    cam.y += (focusY - cam.y) * blend;
    cam.z += (z - cam.z) * blend;
  }
  game.snap = false;
  cam.shake *= Math.exp(-dt * 5.5);
  const t = performance.now() * 0.05;
  camera.position.set(cam.x + Math.sin(t) * cam.shake * 12, cam.y + 30 + Math.cos(t * 0.8) * cam.shake * 8, cam.z);
  camera.lookAt(cam.x, cam.y, 0);
}

function updateHud() {
  const power = powerFromClock(performance.now() / 1000);
  const pct = (power - POWER_MIN) / (POWER_MAX - POWER_MIN);
  angleEl.textContent = `${Math.round(game.angle)}°`;
  powerEl.style.width = `${Math.round(pct * 100)}%`;
  powerLabelEl.textContent = `${Math.round(pct * 100)}%`;
  if (game.kitten && (game.phase === 'flight' || game.phase === 'result')) {
    const feet = feetFromTravel(game.kitten.startX, game.kitten.x);
    game.feet = feet;
    distanceEl.textContent = formatFt(feet);
    const alt = feetFromAltitude(game.kitten.y);
    const mph = mphFromSpeed(Math.hypot(game.kitten.vx, game.kitten.vy));
    if (alt > 100) {
      altitudeEl.textContent = `${alt.toLocaleString('en-US')} FT UP`;
      if (altitudeEl.hidden) {
        altitudeEl.hidden = false;
        altitudeEl.classList.remove('pop');
        void altitudeEl.offsetWidth;
        altitudeEl.classList.add('pop');
      }
    } else {
      altitudeEl.hidden = true;
      altitudeEl.textContent = '';
      altitudeEl.classList.remove('pop');
    }
    if (game.phase === 'flight' && !game.kitten.dead && mph > 0) {
      speedEl.hidden = false;
      speedEl.textContent = formatMph(mph);
    } else {
      speedEl.hidden = true;
      speedEl.textContent = '';
    }
  }
  cannon.ticks.visible = game.phase === 'aim' || game.phase === 'title';
  cannon.pivot.rotation.z = (game.angle * Math.PI) / 180;
  cannon.pivot.position.x = PIVOT_X - game.recoil;
}

function assertFrames() {
  const flat = aimVector(0);
  const up = aimVector(90);
  if (flat.x < 0.999 || Math.abs(flat.y) > 1e-6) throw new Error('aim 0 should point +X');
  if (up.y < 0.999 || Math.abs(up.x) > 1e-6) throw new Error('aim 90 should point +Y');

  cannon.pivot.rotation.z = Math.PI / 2;
  cannon.pivot.position.x = PIVOT_X;
  cannon.root.updateWorldMatrix(true, true);
  const mark = new THREE.Vector3();
  cannon.muzzle.getWorldPosition(mark);
  const expected = barrelMuzzle(90);
  if (Math.abs(mark.x - expected.x) > 0.25 || Math.abs(mark.y - expected.y) > 0.25) {
    throw new Error(`muzzle ${mark.x.toFixed(1)},${mark.y.toFixed(1)} != ${expected.x.toFixed(1)},${expected.y.toFixed(1)}`);
  }

  kitten.mesh.rotation.z = (game.angle * Math.PI) / 180;
  kitten.mesh.updateWorldMatrix(true, true);
  const origin = new THREE.Vector3();
  const nose = new THREE.Vector3(20, 0, 0);
  kitten.mesh.getWorldPosition(origin);
  kitten.mesh.localToWorld(nose);
  nose.sub(origin).normalize();
  const aim = aimVector(game.angle);
  const dot = nose.x * aim.x + nose.y * aim.y;
  if (dot < 0.98) throw new Error(`kitten nose is ${dot.toFixed(3)} off the barrel`);
}

let acc = 0;
let last = performance.now();

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const time = now / 1000;
  applyHold(dt);
  game.recoil *= Math.exp(-dt * 6);
  game.squash *= Math.exp(-dt * 9);
  if (game.kitten && game.kitten.cause === 'spikes') game.sink = Math.min(12, game.sink + dt * 22);

  if (game.phase === 'flight' && game.kitten && !game.kitten.dead) {
    acc += dt;
    let steps = 0;
    while (acc >= STEP && steps < 5 && !game.kitten.dead) {
      for (let i = 0; i < course.length; i++) {
        const prop = course[i];
        if (prop.type === 'balloon' && !prop.spent) {
          prop.y = prop.baseY + Math.sin(time * 1.5 + prop.bob) * 11;
        }
      }
      onEvent(step(game.kitten, course));
      afterStep();
      acc -= STEP;
      steps += 1;
    }
    audio.wind(Math.abs(game.kitten.vx) / MAX_SPEED);
    commitRecords();
  } else {
    acc = 0;
    audio.wind(0);
  }

  if (game.phase === 'flight' && game.kitten && game.kitten.dead) {
    game.hold -= dt;
    if (game.hold <= 0) finish();
  }

  updateProps(time, dt);
  placeKitten(time);
  updateHud();
  updateCamera(dt);

  const h = Math.max(0, kitten.mesh.position.y - GROUND_Y);
  shadow.position.x = kitten.mesh.position.x;
  shadow.position.z = KITTY_Z;
  shadow.scale.setScalar(Math.max(0.35, 1.25 - h / 200));
  shadow.material.opacity = Math.max(0.04, 0.32 - h / 420);
  shadow.visible = kitten.mesh.visible;

  scenery.update(time, cam);
  flybys.update(time, dt, cam, game.kitten ? game.kitten.y : 0, game.phase === 'flight' && game.kitten && !game.kitten.dead);
  particles.update(dt);
  renderer.render(scene, camera);

  if (!game.checked) {
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    if (dir.z > -0.5) throw new Error(`camera should look toward -Z, got ${dir.z.toFixed(2)}`);
    if (game.kitten) {
      const projected = new THREE.Vector3(game.kitten.x, game.kitten.y, KITTY_Z);
      projected.project(camera);
      if (Math.abs(projected.x) > 1 || Math.abs(projected.y) > 1) {
        throw new Error(`kitten off screen (${projected.x.toFixed(2)}, ${projected.y.toFixed(2)})`);
      }
    }
    game.checked = true;
    window.__kitten.ready = true;
  }
}

if (game.furthest > 0) {
  game.furthestX = xForFeet(game.furthest);
  plantPole(game.furthestX, game.furthest);
}

assertFrames();
setPhase('title');
paintRecords();

window.__kitten = {
  ready: false,
  get phase() { return game.phase; },
  get angle() { return game.angle; },
  get feet() { return game.feet; },
  get records() {
    return { furthest: game.furthest, highest: game.highest, fastest: game.fastest };
  },
  get poles() {
    return poles.map((pole) => ({ x: pole.x, feet: pole.feet }));
  },
  get sky() { return flybys.stats(); },
  get cause() { return game.kitten ? game.kitten.cause : null; },
  get x() { return game.kitten ? game.kitten.x : launchPoint(game.angle).x; },
  get y() { return game.kitten ? game.kitten.y : launchPoint(game.angle).y; },
  start: startAim,
  aim(n) { game.angle = n; clampAngle(); },
  fire(power) { beginShot(power == null ? null : Number(power)); },
  show(kind, at) {
    flybys.launch(cam, game.kitten ? game.kitten.y : cam.y, kind, at || null);
  },
  retry,
};

if (params.get('phase') === 'aim') startAim();

if (params.has('demo')) {
  game.angle = Number(params.get('angle') || 30);
  clampAngle();
  startAim();
  beginShot(Number(params.get('power') || POWER_MAX));
  const frames = Number(params.get('frames') || 0);
  for (let i = 0; i < frames && game.kitten && !game.kitten.dead; i++) {
    onEvent(step(game.kitten, course));
    afterStep();
  }
  commitRecords();
  if (frames > 0 && game.kitten && game.kitten.dead) game.hold = 0;
}

renderer.setAnimationLoop(frame);
