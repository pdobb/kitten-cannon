import { Application, Container, Graphics } from 'pixi.js';
import { createAudio } from './audio.js';
import {
  createCannon,
  createKitten as makeKittenMesh,
  createParticles,
  createProp,
  createStake,
  refreshLettering,
} from './actors.js';
import { buildCourse, resetCourse } from './course.js';
import { createKitten as makeState, step } from './physics.js';
import { createFlybys } from './flyby.js';
import { createScenery } from './scenery.js';
import { applyWorld, viewHalfWidth } from './view.js';
import {
  ANGLE_MAX,
  ANGLE_MIN,
  DEFAULT_ANGLE,
  CANNON_X,
  GROUND_Y,
  MAX_SPEED,
  PIVOT_X,
  PIVOT_Y,
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
  rightwardSpeed,
  powerFromClock,
  powerPercent,
} from './tune.js';

document.getElementById('need-js')?.remove();

// The published page is one file. Register only that build, so the dev server
// does not keep a worker around. updateViaCache skips a stale sw.js.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).catch(() => {});
}

// iPhone grays the screen out on its idle timer. A home-screen app can hold
// the screen on since iOS 18.4. The browser drops the lock when the app is
// hidden, so coming back asks again. A low battery can refuse.
function keepScreenAwake() {
  if (!navigator.wakeLock) return;
  let sentinel = null;
  let pending = null;

  async function request() {
    if (sentinel || pending || document.visibilityState !== 'visible') return;
    const job = navigator.wakeLock.request('screen');
    pending = job;
    try {
      const lock = await job;
      sentinel = lock;
      lock.addEventListener('release', () => {
        if (sentinel === lock) sentinel = null;
      });
    } catch {
      // Hidden page, low battery, or a home-screen app older than iOS 18.4.
    } finally {
      if (pending === job) pending = null;
    }
  }

  window.addEventListener('pointerdown', request);
  window.addEventListener('keydown', request);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') request();
  });
  request();
}

keepScreenAwake();

const FAR_KEY = 'kitten-cannon-best-ft';
const HIGH_KEY = 'kitten-cannon-highest-ft';
// The old key stored the kitten's full speed, dive included. It is not a
// rightward record, so it does not carry over.
const FAST_KEY = 'kitten-cannon-fastest-x';
const END_KEY = 'kitten-cannon-endings';
const ENDINGS = [
  ['landed', 'Soft landing'],
  ['spikes', 'Tar pit'],
  ['venus', 'Flytrap'],
];
const NOTES = {
  landed: 'Soft landing',
  spikes: 'Stuck in the tar',
  venus: 'The flytrap was hungry',
};
const SHOUT = {
  tnt: 'BOOM',
  balloon: 'POP',
  trampoline: 'BOING',
  spikes: 'GLUG',
  venus: 'GULP',
};
const NEAR_PROP = 8000;
const FAR_PROP = 14000;

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
const powerCheerEl = document.querySelector('#power-cheer');
const muteEl = document.querySelector('#mute');
const pauseBtn = document.querySelector('#pause-btn');
const pauseEl = document.querySelector('#pause');
const pauseFeetEl = document.querySelector('#pause-feet');
const pauseNoteEl = document.querySelector('#pause-note');
const pauseSheetEl = document.querySelector('#pause-sheet');
const resumeEl = document.querySelector('#resume');
const cardEl = document.querySelector('#card');
const cardKickerEl = document.querySelector('#card-kicker');
const cardFeetEl = document.querySelector('#card-feet');
const cardNoteEl = document.querySelector('#card-note');
const cardBestEl = document.querySelector('#card-best');
const padFireEl = document.querySelector('#pad-fire');

const audio = createAudio();
const course = buildCourse();

const pixi = new Application();
const world = new Container();
const propLayer = new Container();
const actorLayer = new Container();
let scenery;
let flybys;
let kitten;
let cannon;
let stake;
let particles;
let shadow;
const poles = [];
let view = { scale: 1, halfW: 1, halfH: 1, screenW: 1, screenH: 1, camX: 0, camY: 0 };

// How far past the kitten the field is filled. Wide enough for the view and
// for several fast frames, and the same on every screen so the lane does
// not depend on the window.
const FIELD_AHEAD = 16000;

function fieldProps(k) {
  course.grow(k.x + FIELD_AHEAD);
  return course.near(k.x, k.x + k.vx);
}

function releaseProp(prop) {
  if (!prop.mesh) return;
  prop.mesh.destroy({ children: true });
  prop.mesh = null;
  prop.parts = null;
}

function ensureProp(prop) {
  if (prop.mesh) return;
  const built = createProp(prop.type, prop.x);
  prop.mesh = built.mesh;
  prop.parts = built.parts;
  prop.squash = prop.squash || 0;
  prop.chomp = prop.chomp || 0;
  prop.mesh.position.set(prop.x, prop.type === 'balloon' ? prop.y : 0);
  propLayer.addChild(prop.mesh);
}

const params = new URLSearchParams(location.search);

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
  paused: false,
  endings: loadEndings(),
};
const cam = { x: 500, y: 120, z: 980, shake: 0 };
const hold = { ArrowUp: 0, ArrowDown: 0 };

function loadNumber(key) {
  try {
    return Number(localStorage.getItem(key)) || 0;
  } catch {
    return 0;
  }
}

function emptyEndings() {
  return { landed: 0, spikes: 0, venus: 0 };
}

function loadEndings() {
  const counts = emptyEndings();
  try {
    const raw = JSON.parse(localStorage.getItem(END_KEY) || '{}');
    if (!raw || typeof raw !== 'object') return counts;
    for (const key of Object.keys(counts)) {
      counts[key] = Math.max(0, Math.round(Number(raw[key]) || 0));
    }
  } catch {
    // Private mode, or a bad value. Start from zero.
  }
  return counts;
}

function saveEndings() {
  try {
    localStorage.setItem(END_KEY, JSON.stringify(game.endings));
  } catch {
    // The count still shows for this visit.
  }
}

function tallyEnding(cause) {
  if (!Object.prototype.hasOwnProperty.call(game.endings, cause)) return;
  game.endings[cause] += 1;
  saveEndings();
}

function endingTotal() {
  return game.endings.landed + game.endings.spikes + game.endings.venus;
}

function appendEndingRows(el, cause, kicker = true) {
  const total = endingTotal();
  if (kicker) {
    const label = document.createElement('p');
    label.className = 'endings-kicker';
    label.textContent = 'Landings';
    el.append(label);
  }
  for (const [key, label] of ENDINGS) {
    const n = game.endings[key];
    const row = document.createElement('p');
    if (cause === key) row.className = 'fresh';
    const name = document.createElement('span');
    name.textContent = label;
    const num = document.createElement('b');
    num.textContent = total > 0 ? `${n.toLocaleString('en-US')} · ${Math.round((n / total) * 100)}%` : '0';
    row.append(name, num);
    el.append(row);
  }
}

try {
  localStorage.removeItem('kitten-cannon-fastest');
} catch {
  // Private mode can refuse storage.
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

function rankPoles() {
  const ordered = poles.slice().sort((a, b) => (b.feet - a.feet) || (b.x - a.x));
  for (let i = 0; i < ordered.length; i++) {
    const rank = i + 1;
    if (ordered[i].rank === rank) continue;
    ordered[i].rank = rank;
    ordered[i].mesh.paintRank(rank);
  }
}

function repaintRanks() {
  for (const pole of poles) {
    if (pole.rank) pole.mesh.paintRank(pole.rank);
  }
}

function plantPole(x, feet) {
  if (!(feet > 0) || !Number.isFinite(x)) return;
  for (const pole of poles) {
    if (Math.abs(pole.x - x) < 48) {
      if (x > pole.x) {
        pole.x = x;
        pole.feet = feet;
        pole.mesh.position.x = x;
        rankPoles();
      }
      return;
    }
  }
  const mesh = createStake();
  mesh.visible = true;
  mesh.position.set(x, 0);
  actorLayer.addChild(mesh);
  poles.push({ x, feet, mesh, rank: 0 });
  rankPoles();
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

function fillShotLine(el, cause) {
  const pct = powerPercent(game.power);
  const parts = [NOTES[cause] || 'That is the end of the line'];
  const peakFt = feetFromAltitude(game.peakY);
  if (peakFt > 100) parts.push(`${peakFt.toLocaleString('en-US')} ft up`);
  parts.push(formatMph(mphFromSpeed(game.peakSpeed)));
  parts.push(`${Math.round(game.angle)}°`);
  el.replaceChildren(document.createTextNode(`${parts.join(' · ')} · `));
  const mark = document.createElement('b');
  if (pct >= 100) mark.className = 'perfect';
  mark.textContent = `${pct}% power`;
  el.append(mark);
}

function appendBestsKicker(el) {
  const best = document.createElement('p');
  best.className = 'kicker';
  const name = document.createElement('span');
  name.textContent = 'Your bests';
  const where = document.createElement('i');
  where.textContent = 'on this device';
  best.append(name, where);
  el.append(best);
}

function appendPersonalStats(el, marks, cause) {
  appendBestsKicker(el);
  appendRecordRows(el, marks);
  appendEndingRows(el, cause, true);
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
    appendBestsKicker(titleBestEl);
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

// Hit shouts reuse #banner, and the first balloon is close enough to pop
// inside this same second. The percent gets its own line so that shout
// cannot wipe it.
function celebratePower(power) {
  const pct = powerPercent(power);
  const perfect = pct >= 100;
  powerCheerEl.className = perfect ? 'perfect' : '';
  powerCheerEl.replaceChildren();
  if (perfect) {
    for (const spot of ['a', 'b', 'c', 'd']) {
      const star = document.createElement('span');
      star.className = `spark ${spot}`;
      star.setAttribute('aria-hidden', 'true');
      star.textContent = '★';
      powerCheerEl.append(star);
    }
    const kicker = document.createElement('span');
    kicker.className = 'kicker';
    kicker.textContent = 'Full power!';
    powerCheerEl.append(kicker);
  }
  const num = document.createElement('b');
  num.textContent = `${pct}%`;
  powerCheerEl.append(num);
  if (!perfect) {
    const caption = document.createElement('span');
    caption.className = 'caption';
    caption.textContent = 'Power';
    powerCheerEl.append(caption);
  }
  void powerCheerEl.offsetWidth;
  powerCheerEl.classList.add('show');
}

function burst(x, y, colors, count, speed, life, size) {
  if (!particles) return;
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
  if (!kitten || !flybys) return;
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
  const power = forcedPower == null ? powerFromClock(playSeconds()) : forcedPower;
  game.power = power;
  game.was = { furthest: game.furthest, highest: game.highest, fastest: game.fastest };
  game.kitten = makeState(game.angle, power);
  game.feet = 0;
  game.peakY = game.kitten.y;
  game.peakSpeed = rightwardSpeed(game.kitten.vx);
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
  celebratePower(power);
}

function afterStep() {
  const k = game.kitten;
  if (!k) return;
  if (k.y > game.peakY) game.peakY = k.y;
  const speed = rightwardSpeed(k.vx);
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
  cardKickerEl.textContent = fresh.length === 0 ? 'Your shot' : fresh.length === 1 ? `New ${fresh[0]}` : 'New records';
  cardFeetEl.textContent = formatFt(game.feet);
  fillShotLine(cardNoteEl, k.cause);
  tallyEnding(k.cause);
  cardBestEl.replaceChildren();
  appendPersonalStats(cardBestEl, marks, k.cause);
  if (game.furthest > game.was.furthest) plantPole(game.furthestX, game.furthest);
  // The landing stake hides on the next shot. This pole stays for the visit,
  // including a landing that did not set a new furthest.
  plantPole(k.x, game.feet);
  const marked = poles.some((pole) => Math.abs(pole.x - k.x) < 48);
  if (marked) {
    stake.visible = false;
  } else {
    stake.position.set(k.x, 0);
    stake.visible = true;
  }
  setPhase('result');
}

function retry() {
  if (!kitten) return;
  resetCourse(course);
  for (let i = 0; i < course.length; i++) {
    const prop = course[i];
    prop.squash = 0;
    prop.chomp = 0;
    if (!prop.mesh || !prop.parts) continue;
    prop.mesh.visible = true;
    prop.mesh.scale.set(1, 1);
    if (prop.parts.bed) prop.parts.bed.scale.y = 1;
    if (prop.parts.upper) {
      const open = prop.parts.open;
      prop.parts.upper.rotation = -open;
      prop.parts.lower.rotation = open;
    }
    if (prop.parts.stripe) prop.parts.stripe.position.y = 25.2;
  }
  game.snap = true;
  kitten.recolor();
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
    burst(k.x, k.y, [0x1a1612, 0x3a3228], 5, 70, 0.4, 12);
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
  if (!kitten) return;
  if (game.phase === 'title') startAim();
  else if (game.phase === 'aim') beginShot(null);
  else if (game.phase === 'flight' || game.phase === 'result') retry();
}

window.addEventListener('keydown', (e) => {
  const accept = e.code === 'Space' || e.code === 'Enter' || e.code === 'NumpadEnter';
  if (accept || e.code === 'ArrowUp' || e.code === 'ArrowDown' || e.code === 'KeyP') e.preventDefault();
  if (game.paused) {
    if (!e.repeat && (accept || e.code === 'Escape' || e.code === 'KeyP')) setPaused(false);
    return;
  }
  if (e.code === 'ArrowUp' || e.code === 'ArrowDown') {
    if (!e.repeat) press(e.code);
    return;
  }
  if (e.repeat) return;
  if (accept) onAction();
  else if (e.code === 'KeyR') retry();
  else if (e.code === 'KeyP') setPaused(true);
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
  // 0 would ignore a tap in the first 400ms, because performance.now() starts at 0.
  let last = -Infinity;
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
    // The button is desktop-only. A refusal leaves it in place.
  }
}

const fullscreenQuery = window.matchMedia('(pointer: coarse), (hover: none)');
function syncFullscreenButton() {
  const root = document.documentElement;
  const supported = !!(root.requestFullscreen || root.webkitRequestFullscreen);
  fullscreenEl.hidden = !(supported && !fullscreenQuery.matches);
}
syncFullscreenButton();
fullscreenQuery.addEventListener('change', syncFullscreenButton);
bindTap(fullscreenEl, toggleFullscreen);
document.addEventListener('fullscreenchange', paintFullscreen);
document.addEventListener('webkitfullscreenchange', paintFullscreen);

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

let clockOffset = 0;
let pausedAt = 0;

// The aim bar and the shot both read this. A pause adds to clockOffset, so a
// raw performance.now() would fire a different percent than the bar shows.
function playSeconds(now = performance.now()) {
  return (now - clockOffset) / 1000;
}

function setPaused(on) {
  if (on === game.paused) return;
  game.paused = on;
  app.classList.toggle('is-paused', on);
  pauseEl.classList.toggle('hidden', !on);
  pauseBtn.setAttribute('aria-label', on ? 'Resume' : 'Pause');
  if (on) {
    pausedAt = performance.now();
    touchAim = null;
    audio.wind(0);
    fillPauseCard();
    resumeEl.focus();
    return;
  }
  clockOffset += performance.now() - pausedAt;
  last = performance.now();
}

function fillPauseCard() {
  const k = game.kitten;
  const inShot = !!(k && (game.phase === 'flight' || game.phase === 'result'));
  const stillFlying = inShot && game.phase === 'flight' && !k.dead;
  pauseFeetEl.hidden = !inShot;
  pauseFeetEl.textContent = inShot ? formatFt(feetFromTravel(k.startX, k.x)) : '';
  if (!inShot) pauseNoteEl.replaceChildren();
  else if (stillFlying) pauseNoteEl.textContent = 'So far';
  else fillShotLine(pauseNoteEl, k.cause);
  pauseSheetEl.replaceChildren();
  appendPersonalStats(pauseSheetEl, null, stillFlying || !inShot ? null : k.cause);
}

bindTap(pauseBtn, () => setPaused(!game.paused));
bindTap(resumeEl, () => setPaused(false));
pauseEl.addEventListener('pointerdown', (e) => {
  e.stopPropagation();
  if (e.target === pauseEl) setPaused(false);
});

// A tap or a mouse click on the field is Enter. A vertical touch drag aims.
// A mouse drag does not aim. Buttons keep their own taps.
let touchAim = null;
function fieldTarget(target) {
  return !(target && target.closest && target.closest('button, a'));
}
// A long press on the field must not start a selection. The stats cards
// and the pause card are the only text a player can select.
app.addEventListener('selectstart', (event) => {
  const panel = event.target.closest && event.target.closest('#card .panel, #pause .panel');
  if (panel && !(event.target.closest && event.target.closest('button'))) return;
  event.preventDefault();
});

app.addEventListener('pointerdown', (e) => {
  if (!fieldTarget(e.target)) return;
  if (e.pointerType !== 'mouse') safeAudio(() => audio.unlock());
  touchAim = {
    id: e.pointerId,
    x: e.clientX,
    y: e.clientY,
    lastY: e.clientY,
    moved: false,
    mouse: e.pointerType === 'mouse',
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
  if (touchAim.mouse) return;
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
  if (!pixi.renderer) return;
  const w = canvas.clientWidth || window.innerWidth;
  const h = canvas.clientHeight || window.innerHeight;
  pixi.renderer.resize(Math.max(1, w), Math.max(1, h));
  layoutView(0, 0);
  // A resize clears the canvas. The paused loop does not draw, so a turn of
  // the phone would leave the dirt color until Resume.
  if (game.paused && game.checked) {
    updateCamera(0);
    layoutView(0, 0);
    pixi.render();
  }
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
function seatKitten() {
  if (kitten.mesh.parent === cannon.pivot) return;
  // Bore is child 0. The tube is drawn after the cat, so the body stays inside.
  cannon.pivot.addChildAt(kitten.mesh, 1);
}

function releaseKitten() {
  if (kitten.mesh.parent === actorLayer) return;
  const at = actorLayer.getChildIndex(shadow);
  actorLayer.addChildAt(kitten.mesh, at + 1);
}

function kittenAnchor() {
  if (kitten.mesh.parent !== cannon.pivot) {
    return { x: kitten.mesh.position.x, y: kitten.mesh.position.y };
  }
  const a = cannon.pivot.rotation;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const lx = kitten.mesh.position.x;
  const ly = kitten.mesh.position.y;
  const pivot = cannon.pivot.position;
  const root = cannon.root.position;
  return {
    x: root.x + pivot.x + lx * cos - ly * sin,
    y: root.y + pivot.y + lx * sin + ly * cos,
  };
}

function placeKitten(time) {
  const flying = game.phase === 'flight' || game.phase === 'result';
  if (!flying) {
    seatKitten();
    const bob = Math.sin(time * 2.5) * 0.45;
    kitten.mesh.position.set(kitten.seat.x, kitten.seat.y + bob);
    kitten.mesh.rotation = Math.sin(time * 1.7) * 0.025;
    const breathe = 1 + Math.sin(time * 3.1) * 0.028;
    kitten.mesh.scale.set(1, breathe);
    kitten.tail.rotation = Math.sin(time * 2.2) * 0.22;
    kitten.eye.scale.y = Math.sin(time * 0.7) > 0.975 ? 0.12 : 1;
    return;
  }
  releaseKitten();
  const k = game.kitten;
  const y = k.cause === 'spikes' ? Math.max(8, k.y - game.sink) : k.y;
  kitten.mesh.position.set(k.x, y);
  if (k.cause === 'landed') {
    const current = kitten.mesh.rotation;
    const rest = Math.round(current / (Math.PI * 2)) * Math.PI * 2;
    kitten.mesh.rotation = current + (rest - current) * 0.18;
    kitten.tail.rotation = Math.sin(time * 2.4) * 0.2;
  } else {
    kitten.mesh.rotation = (k.spin * Math.PI) / 180;
    kitten.tail.rotation = k.dead ? 0.35 : Math.sin(time * 6.5) * 0.12 - 0.22;
  }
  const s = game.squash;
  kitten.mesh.scale.set(1 + s * 0.28, 1 - s * 0.32);
  kitten.eye.scale.y = 1;
}

function updateProps(time, dt) {
  for (let i = 0; i < course.length; i++) {
    const prop = course[i];
    const dist = Math.abs(prop.x - cam.x);
    // Build the picture only near the lens, and drop it again on a long flight.
    // The hit data stays on the course either way.
    if (dist > (prop.mesh ? FAR_PROP : NEAR_PROP)) {
      releaseProp(prop);
      continue;
    }
    const gone = (prop.type === 'tnt' || prop.type === 'balloon') && prop.spent;
    if (gone && !prop.mesh) continue;
    ensureProp(prop);
    if (prop.type !== 'balloon' && !(prop.type === 'tnt' && prop.spent)) prop.mesh.visible = true;
    if (prop.type === 'balloon') {
      if (!prop.spent) prop.y = prop.baseY + Math.sin(time * 1.5 + prop.bob) * 11;
      prop.mesh.position.y = prop.y;
      prop.mesh.visible = !prop.spent;
      if (prop.parts.spark && !prop.spent) {
        const spark = 0.85 + Math.sin(time * 14 + prop.bob) * 0.35;
        prop.parts.spark.scale.set(spark, spark);
      }
    }
    if (prop.squash > 0) {
      prop.squash *= Math.exp(-dt * 7);
      if (prop.parts.bed) {
        prop.parts.bed.scale.y = 1 - prop.squash * 0.65;
        if (prop.parts.stripe) prop.parts.stripe.position.y = 25.2 - prop.squash * 3;
      }
    }
    if (prop.parts.upper && prop.type === 'venus') {
      const shut = prop.chomp || 0;
      const open = prop.parts.open * (1 - shut);
      prop.parts.upper.rotation = -open;
      prop.parts.lower.rotation = open;
    }
    if (prop.parts.bubbles) {
      const bubbles = prop.parts.bubbles;
      for (let b = 0; b < bubbles.length; b++) {
        const bubble = bubbles[b];
        bubble.position.y = bubble.userData.baseY + Math.sin(time * 2.4 + b * 1.7) * 1.1;
        const s = 0.85 + Math.sin(time * 3.1 + b) * 0.15;
        bubble.scale.set(s, s);
      }
    }
    if ((prop.type === 'tnt' || prop.type === 'spikes') && prop.spent) {
      // The tar pit stays. The crate is gone after it blows.
      if (prop.type === 'tnt') prop.mesh.visible = false;
    }
  }
}

function updateCamera(dt) {
  const flying = game.phase === 'flight' || game.phase === 'result';
  const k = game.kitten;
  // One distance for the whole flight. The camera follows; it does not zoom.
  // The lead shrinks on a narrow screen so the kitten stays in frame.
  const w = canvas.clientWidth || window.innerWidth;
  const h = canvas.clientHeight || window.innerHeight;
  const halfW = viewHalfWidth(w / Math.max(1, h));
  const lead = Math.min(220, halfW * 0.42);
  // The score card sits on the center of the screen. On the result, look
  // further ahead so the landing flag clears that card. Flight keeps the
  // shorter lead. The clamp keeps the kitten on screen.
  let focusLead = lead;
  if (game.phase === 'result') {
    const viewW = canvas.clientWidth || window.innerWidth;
    const cardPx = Math.min(560, Math.max(0, viewW - 32));
    const cardHalfWorld = (cardPx * 0.5) / Math.max(1, viewW) * (halfW * 2);
    focusLead = Math.min(halfW * 0.78, Math.max(lead, cardHalfWorld + 48));
  }
  // x=490 looks down the field. A narrow view then starts past the wheels.
  const aimX = Math.min(490, CANNON_X + PIVOT_X - 84 + halfW);
  const focusX = flying ? k.x + focusLead : aimX;
  const focusY = flying ? Math.max(120, k.y - 36) : 120;
  if (flying) {
    cam.x = focusX;
    cam.y = focusY;
  } else {
    const blend = 1 - Math.exp(-dt * (game.snap ? 40 : 4));
    cam.x += (focusX - cam.x) * blend;
    cam.y += (focusY - cam.y) * blend;
  }
  game.snap = false;
  cam.shake *= Math.exp(-dt * 5.5);
}

function updateHud() {
  const power = powerFromClock(playSeconds());
  const pct = powerPercent(power);
  angleEl.textContent = `${Math.round(game.angle)}°`;
  powerEl.style.width = `${pct}%`;
  powerLabelEl.textContent = `${pct}%`;
  if (game.kitten && (game.phase === 'flight' || game.phase === 'result')) {
    const feet = feetFromTravel(game.kitten.startX, game.kitten.x);
    game.feet = feet;
    distanceEl.textContent = formatFt(feet);
    const alt = feetFromAltitude(game.kitten.y);
    const mph = mphFromSpeed(game.kitten.vx);
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
  cannon.pivot.rotation = (game.angle * Math.PI) / 180;
  // Kick straight back along the barrel. The carriage stays on the ground.
  const aim = aimVector(game.angle);
  cannon.pivot.position.set(
    PIVOT_X - aim.x * game.recoil,
    PIVOT_Y - aim.y * game.recoil,
  );
}

function layoutView(jx, jy) {
  const w = canvas.clientWidth || window.innerWidth || 1;
  const h = canvas.clientHeight || window.innerHeight || 1;
  view = applyWorld(world, Math.max(1, w), Math.max(1, h), cam.x + jx, cam.y + jy);
}

function worldOf(display, localX = 0, localY = 0) {
  const p = display.toGlobal({ x: localX, y: localY });
  return {
    x: view.camX + (p.x - view.screenW / 2) / view.scale,
    y: view.camY - (p.y - view.screenH / 2) / view.scale,
  };
}

function assertFrames() {
  const flat = aimVector(0);
  const up = aimVector(90);
  if (flat.x < 0.999 || Math.abs(flat.y) > 1e-6) throw new Error('aim 0 should point +X');
  if (up.y < 0.999 || Math.abs(up.x) > 1e-6) throw new Error('aim 90 should point +Y');

  cannon.pivot.rotation = Math.PI / 2;
  cannon.pivot.position.x = PIVOT_X;
  layoutView(0, 0);
  const mark = worldOf(cannon.muzzle);
  const expected = barrelMuzzle(90);
  if (Math.abs(mark.x - expected.x) > 0.5 || Math.abs(mark.y - expected.y) > 0.5) {
    throw new Error(`muzzle ${mark.x.toFixed(1)},${mark.y.toFixed(1)} != ${expected.x.toFixed(1)},${expected.y.toFixed(1)}`);
  }

  const screenUp = world.toGlobal({ x: view.camX, y: view.camY + 80 });
  const origin = world.toGlobal({ x: view.camX, y: view.camY });
  const screenRight = world.toGlobal({ x: view.camX + 80, y: view.camY });
  if (!(screenUp.y < origin.y - 1)) throw new Error('world up should be up the screen');
  if (!(screenRight.x > origin.x + 1)) throw new Error('world +X should point right');

  kitten.mesh.rotation = (game.angle * Math.PI) / 180;
  const nose = worldOf(kitten.mesh, 20, 0);
  const at = worldOf(kitten.mesh);
  const dx = nose.x - at.x;
  const dy = nose.y - at.y;
  const len = Math.hypot(dx, dy) || 1;
  const aim = aimVector(game.angle);
  const dot = (dx / len) * aim.x + (dy / len) * aim.y;
  if (dot < 0.98) throw new Error(`kitten nose is ${dot.toFixed(3)} off the barrel`);
}

let acc = 0;
let last = performance.now();

function frame(now) {
  requestAnimationFrame(frame);
  if (!kitten) return;
  if (game.paused && game.checked) return;
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const time = playSeconds(now);
  applyHold(dt);
  game.recoil *= Math.exp(-dt * 6);
  game.squash *= Math.exp(-dt * 9);
  if (game.kitten && game.kitten.cause === 'spikes') game.sink = Math.min(12, game.sink + dt * 22);

  if (game.phase === 'flight' && game.kitten && !game.kitten.dead) {
    acc += dt;
    let steps = 0;
    while (acc >= STEP && steps < 5 && !game.kitten.dead) {
      const props = fieldProps(game.kitten);
      for (let i = 0; i < props.length; i++) {
        const prop = props[i];
        if (prop.type === 'balloon' && !prop.spent) {
          prop.y = prop.baseY + Math.sin(time * 1.5 + prop.bob) * 11;
        }
      }
      onEvent(step(game.kitten, props));
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

  const t = performance.now() * 0.05;
  const jx = Math.sin(t) * cam.shake * 10;
  const jy = Math.cos(t * 0.8) * cam.shake * 7;
  layoutView(jx, jy);
  const draw = { x: view.camX, y: view.camY };

  const anchor = kittenAnchor();
  const h = Math.max(0, anchor.y - GROUND_Y);
  const shade = Math.max(0.35, 1.25 - h / 200);
  shadow.position.x = anchor.x;
  shadow.scale.set(shade, shade);
  shadow.alpha = Math.max(0.04, 0.32 - h / 420);
  shadow.visible = kitten.mesh.visible;

  scenery.update(time, draw, view);
  flybys.update(time, dt, draw, game.kitten ? game.kitten.y : 0, game.phase === 'flight' && game.kitten && !game.kitten.dead);
  particles.update(dt);
  pixi.render();

  if (!game.checked) {
    if (game.kitten) {
      const at = worldOf(kitten.mesh);
      if (Math.abs(at.x - view.camX) > view.halfW || Math.abs(at.y - view.camY) > view.halfH) {
        throw new Error(`kitten off screen (${at.x.toFixed(0)}, ${at.y.toFixed(0)})`);
      }
    }
    game.checked = true;
    window.__kitten.ready = true;
  }
}

async function boot() {
  const w0 = canvas.clientWidth || window.innerWidth || 800;
  const h0 = canvas.clientHeight || window.innerHeight || 600;
  await pixi.init({
    canvas,
    width: Math.max(1, w0),
    height: Math.max(1, h0),
    background: 0x9ed4f6,
    antialias: true,
    resolution: Math.min(2, window.devicePixelRatio || 1),
    autoDensity: false,
    preference: 'webgl',
    autoStart: false,
    accessibilityOptions: { activateOnTab: false },
  });
  pixi.stage.eventMode = 'none';
  if (pixi.renderer.events) pixi.renderer.events.autoPreventDefault = false;

  scenery = createScenery(world);
  flybys = createFlybys(scenery.flyLayer);
  pixi.stage.addChild(scenery.sky, world);
  world.addChild(propLayer, actorLayer);

  kitten = makeKittenMesh();
  cannon = createCannon();
  stake = createStake();
  shadow = new Graphics();
  shadow.ellipse(0, 2, 16, 5.5);
  shadow.fill({ color: 0x1d3a16, alpha: 1 });
  actorLayer.addChild(cannon.root, shadow, kitten.mesh, stake);
  particles = createParticles(actorLayer);

  resize();
  if (game.furthest > 0) {
    game.furthestX = xForFeet(game.furthest);
    plantPole(game.furthestX, game.furthest);
  }
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
      repaintRanks();
      refreshLettering();
    }).catch(() => {});
  }

  assertFrames();
  setPhase('title');
  paintRecords();
  applyQuery();
  requestAnimationFrame(frame);
}

// The query runs after the picture exists. A demo steps the flight before
// the first frame, so a screenshot lands on that shot.
function applyQuery() {
  if (params.get('phase') === 'aim') startAim();
  if (!params.has('demo')) return;
  game.angle = Number(params.get('angle') || 30);
  clampAngle();
  startAim();
  beginShot(Number(params.get('power') || POWER_MAX));
  const frames = Number(params.get('frames') || 0);
  for (let i = 0; i < frames && game.kitten && !game.kitten.dead; i++) {
    onEvent(step(game.kitten, fieldProps(game.kitten)));
    afterStep();
  }
  commitRecords();
  if (frames > 0 && game.kitten && game.kitten.dead) game.hold = 0;
}

boot().catch((error) => {
  const pre = document.createElement('pre');
  pre.id = 'boot-error';
  pre.textContent = error && error.stack ? error.stack : String(error);
  document.body.appendChild(pre);
});

window.__kitten = {
  ready: false,
  get phase() { return game.phase; },
  get angle() { return game.angle; },
  get feet() { return game.feet; },
  get records() {
    return { furthest: game.furthest, highest: game.highest, fastest: game.fastest };
  },
  get poles() {
    return poles.map((pole) => ({ x: pole.x, feet: pole.feet, rank: pole.rank }));
  },
  get coat() { return kitten.coat(); },
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
